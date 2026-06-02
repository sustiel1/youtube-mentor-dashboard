import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { ExternalLink, Sparkles, Eye, X, Clock, StickyNote, Calendar, Link2, Moon, Sun, ClipboardList, Info, Trash2, Pin, Copy, CheckCircle2, AlertCircle, BookMarked, Zap, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Video } from "@/api/entities";
import { analyzeVideoWithAI } from "@/api/functions";
import { analyzeVideoWithProvider } from "@/services/aiVideoAnalyzer";
import { getClaudeAnalyzerStatus } from "@/services/claudeVideoAnalyzer";
import { fetchGeminiVideoContent } from "@/services/geminiVideoContent";
import {
  analyzeVideoWithOllama,
  checkOllamaStatus,
  quickTestOllamaModel,
  OLLAMA_PULL_COMMAND,
  OLLAMA_SERVE_COMMAND,
} from "@/services/ollamaVideoAnalyzer";
import {
  analyzeVideo,
  buildFallbackAiChapters,
  chaptersToVideoTopics,
  generateChaptersFromTranscript,
  getChapterSource,
  getVideoDurationSeconds,
  isGenericChapterTitle,
  normalizeAiAnalysisResult,
  resolveVideoChapters,
  validateAiAnalysisQuality,
  validateChaptersForSave,
} from "@/services/videoAnalytics";
import { fetchTranscript, fetchTranscriptPayload, getBestTranscript, parseTranscript, validateTranscriptUsable } from "@/services/youtubeTranscript";
import { extractTimestampsFromDescription, getVideoIdFromUrl } from "@/services/youtubeMetadata";
import { fetchVideoDescription, fetchVideoMetadata } from "@/services/youtubeApi";
import {
  getCachedVideoMetadata,
  setCachedVideoMetadata,
  shouldFetchVideoMetadata,
} from "@/services/youtubeChapterCache";
import { loadVideos } from "@/services/videoStorage";
import { usePersistedVideo } from "@/hooks/usePersistedVideo";
import { useUpdateSummary } from "@/hooks/useVideos";
import { useNotesByVideo } from "@/hooks/useNotes";
import { formatVideoDuration } from "@/lib/videoDuration";
import {
  deleteSavedAnalysis,
  loadSavedAnalysis,
  saveSavedAnalysis,
} from "@/lib/localAnalysisStore";
import { replaceLocalNotesForVideo } from "@/lib/localNoteStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { ObsidianExportButton } from "./ObsidianExportButton";
import { buildVideoFullNote, downloadMarkdown, getSelectedAtomicKnowledge, resolvePrimaryTopic } from "@/lib/obsidianExport";
import { getManualNotesByTopic } from "@/lib/localManualNoteStore";
import { createKnowledgeItemFromVideo, getKnowledgeItems, upsertKnowledgeItem } from "@/lib/localKnowledgeItemStore";
import { CategoryBadge } from "./CategoryBadge";
import { LearningStatusBadge, LEARNING_STATUSES } from "./LearningStatusBadge";
import { SaveButton } from "./SaveButton";
import { NoteEditor } from "./NoteEditor";
import ChapterItem from "./ChapterItem";
import { BrainDestinationPicker } from "./BrainDestinationPicker";
import { QUICK_COPY_ACTIONS, QUICK_COPY_GROUPS } from "@/ai/quickCopyPrompts";
import { classifyVideoForGem, GEM_CATEGORY_MAP, getGemSubCategoryFallback, normalizeCategoryName } from "@/lib/gemRecommender";
import { getGemUrl, openGeminiGemUrl } from "@/lib/gemsConfig";
import { resolveChannelToMentor } from "@/lib/channelMentorResolver";
import { hasObsidianSavedStatus, getBrainSaveButtonLabel } from "@/lib/obsidianSavedStatus";
import { isBase44Enabled } from "@/config/base44Flags";

function getWatchUrl(video) {
  if (!video) return "";
  const raw = video.url || video.link || video.videoUrl;
  return typeof raw === "string" ? raw.trim() : "";
}

function requestAutoTranscript(_video) {
  return {
    status: "not_implemented",
    message: "Whisper auto-transcription is planned for a future version",
  };
}

function buildTranscriptTextFromSegments(segments) {
  return (Array.isArray(segments) ? segments : [])
    .map((segment) => {
      const startSeconds = Number(segment?.startSeconds ?? segment?.start ?? 0);
      const text = String(segment?.text || "").trim();
      if (!Number.isFinite(startSeconds) || !text) return null;
      const totalSeconds = Math.max(0, Math.floor(startSeconds));
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const stamp = hours > 0
        ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        : `${minutes}:${String(seconds).padStart(2, "0")}`;
      return `${stamp} ${text}`;
    })
    .filter(Boolean)
    .join("\n");
}

function parseManualTranscript(text) {
  const raw = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!raw) {
    return { segments: [], hasTimestamps: false };
  }

  const toSeconds = (stamp) => {
    const parts = String(stamp || "")
      .split(":")
      .map((part) => Number.parseInt(part, 10));
    if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return null;
  };

  const timestampRegex = /(^|\s)(\d{1,2}:\d{2}(?::\d{2})?)(?=\s|$)/gm;
  const markers = [];
  let match;
  while ((match = timestampRegex.exec(raw)) !== null) {
    const stamp = match[2];
    const startSeconds = toSeconds(stamp);
    if (!Number.isFinite(startSeconds)) continue;
    const markerStart = match.index + match[1].length;
    markers.push({
      stamp,
      startSeconds,
      markerStart,
      markerEnd: markerStart + stamp.length,
    });
  }

  if (markers.length >= 2) {
    const segments = markers
      .map((marker, index) => {
        const nextMarker = markers[index + 1];
        const chunkEnd = nextMarker ? nextMarker.markerStart : raw.length;
        const chunkText = raw
          .slice(marker.markerEnd, chunkEnd)
          .replace(/^[\s\-–—:|•]+/, "")
          .replace(/\s+/g, " ")
          .trim();
        if (!chunkText) return null;

        const durationSeconds = nextMarker
          ? Math.max(0, nextMarker.startSeconds - marker.startSeconds)
          : 0;

        return {
          text: chunkText,
          startSeconds: marker.startSeconds,
          durationSeconds,
          start: marker.startSeconds,
        };
      })
      .filter(Boolean);

    if (segments.length >= 2) {
      return { segments, hasTimestamps: true };
    }
  }

  const lineSegments = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const lineMatch = line.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+([\s\S]+)/);
      if (!lineMatch) return null;
      const h = parseInt(lineMatch[1] || "0", 10);
      const min = parseInt(lineMatch[2], 10);
      const sec = parseInt(lineMatch[3], 10);
      const startSeconds = h * 3600 + min * 60 + sec;
      const lineText = lineMatch[4].trim();
      if (!lineText) return null;
      return { text: lineText, startSeconds, durationSeconds: 0, start: startSeconds };
    })
    .filter(Boolean);

  if (lineSegments.length >= 2) {
    for (let i = 0; i < lineSegments.length - 1; i += 1) {
      lineSegments[i].durationSeconds = Math.max(
        0,
        lineSegments[i + 1].startSeconds - lineSegments[i].startSeconds
      );
    }
    return { segments: lineSegments, hasTimestamps: true };
  }

  return {
    segments: [{ text: raw, startSeconds: 0, durationSeconds: 0, start: 0 }],
    hasTimestamps: false,
  };
}

function normalizeManualChapters(chapters) {
  return (Array.isArray(chapters) ? chapters : [])
    .map(ch => {
      const title = String(ch?.title || '').trim();
      const summary = String(ch?.summary || ch?.description || '').trim();
      if (!title || !summary) return null;
      const startSeconds = Math.max(0, Math.floor(Number(ch?.startSeconds) || 0));
      const endRaw = Number(ch?.endSeconds);
      const endSeconds = Number.isFinite(endRaw) && endRaw >= startSeconds ? Math.floor(endRaw) : null;
      return { ...ch, title, summary, description: summary, startSeconds, endSeconds, timeSource: 'manual_ai', chapterSource: 'manual_transcript' };
    })
    .filter(Boolean)
    .sort((a, b) => a.startSeconds - b.startSeconds);
}


const STOPWORDS_HE = new Set([
  "של","על","עם","זה","זאת","אני","אתה","את","אנחנו","הם","הן","היא","הוא","היה","היו","יהיה","תהיה","כל","גם","אבל","כי","כדי","אם","או","לא","כן","מה","מי","איך","למה",
  "אז","עוד","מאוד","יותר","פחות","כמו","בין","תוך","אחרי","לפני","כאן","שם","הזה","הזו","האלה","הם","הן",
]);
const STOPWORDS_EN = new Set([
  "the","a","an","and","or","but","if","then","this","that","these","those","is","are","was","were","be","been","being",
  "to","of","in","on","for","with","as","at","by","from","it","we","you","they","i","he","she","them","us","our","your",
]);

function extractKeywords(text, { max = 6 } = {}) {
  const raw = String(text || "");
  const tokens = raw
    .replace(/[^\p{L}\p{N}\s$._-]+/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const counts = new Map();
  const bump = (t, w = 1) => counts.set(t, (counts.get(t) || 0) + w);

  for (const tok of tokens) {
    const lower = tok.toLowerCase();
    if (lower.length < 3) continue;
    if (STOPWORDS_HE.has(lower) || STOPWORDS_EN.has(lower)) continue;

    // prioritize tickers / acronyms / numbers
    const isTicker = /^[A-Z]{2,10}$/.test(tok) || /^\$[A-Za-z]{2,10}$/.test(tok);
    const hasDigits = /\d/.test(tok);
    const isHebrew = /[\u0590-\u05FF]/.test(tok);
    const weight = isTicker ? 4 : hasDigits ? 3 : isHebrew ? 2 : 1;

    bump(tok, weight);
  }

  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);

  return sorted.slice(0, max);
}

function makeTitleFromText(text) {
  const kws = extractKeywords(text, { max: 3 });
  if (kws.length === 0) return "קטע נוסף";
  return kws.join(" · ");
}

function chapterChunkTextFromSegments(transcriptSegments, startSeconds, endSeconds) {
  const start = Number.isFinite(startSeconds) ? startSeconds : 0;
  const end = Number.isFinite(endSeconds) ? endSeconds : Infinity;
  return (Array.isArray(transcriptSegments) ? transcriptSegments : [])
    .filter((s) => {
      const t = Number(s?.startSeconds ?? s?.start ?? 0);
      return Number.isFinite(t) && t >= start && t < end;
    })
    .map((s) => String(s?.text || "").trim())
    .filter(Boolean)
    .join(" ");
}

function retitleGenericChapters(chapters, { transcriptSegments } = {}) {
  const list = Array.isArray(chapters) ? chapters : [];
  if (list.length === 0) return list;

  return list.map((c) => {
    const title = String(c?.title || "").trim();
    if (!isGenericChapterTitle(title)) return c;

    const chunk = chapterChunkTextFromSegments(transcriptSegments, c?.startSeconds, c?.endSeconds);
    const nextTitle = makeTitleFromText(chunk);
    return { ...c, title: nextTitle || title };
  });
}

function splitPlainTranscriptToChapters(text, videoDurationSeconds) {
  const raw = String(text || "").trim();
  if (!raw) return [];

  const paragraphs = raw
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const blocks = paragraphs.length > 0 ? paragraphs : raw.split(/\n+/g).map((p) => p.trim()).filter(Boolean);
  const joined = blocks.join("\n\n");
  const totalChars = joined.length || 1;

  // choose 4-7 chapters based on size
  const desired =
    totalChars < 1200 ? 3 :
    totalChars < 2600 ? 4 :
    totalChars < 5200 ? 5 :
    totalChars < 9000 ? 6 : 7;

  const targetChars = Math.max(400, Math.floor(totalChars / desired));
  const chunks = [];
  let acc = "";
  for (const b of blocks) {
    if (!acc) acc = b;
    else if (acc.length + b.length < targetChars) acc = `${acc}\n\n${b}`;
    else {
      chunks.push(acc);
      acc = b;
    }
  }
  if (acc) chunks.push(acc);

  const durationSec = Number.isFinite(videoDurationSeconds) && videoDurationSeconds > 0 ? videoDurationSeconds : null;

  const chapters = chunks.map((chunk, i) => {
    const startSeconds = durationSec ? Math.floor((i / chunks.length) * durationSec) : i * 60;
    const endSeconds =
      durationSec
        ? (i < chunks.length - 1 ? Math.floor(((i + 1) / chunks.length) * durationSec) : durationSec)
        : (i < chunks.length - 1 ? (i + 1) * 60 : null);
    const title = makeTitleFromText(chunk);
    const keyPoints = extractKeywords(chunk, { max: 4 }).slice(0, 3);
    const summary = chunk.split(/\n+/).map(s => s.trim()).filter(Boolean).slice(0, 2).join(" ");
    return {
      title,
      startSeconds,
      endSeconds: endSeconds == null ? null : Math.max(startSeconds, endSeconds),
      summary: summary || "קטע מתוך התמלול",
      keyPoints: keyPoints.length ? keyPoints : [title].filter(Boolean),
      timeSource: durationSec ? "estimated_from_text" : "outline",
      chapterSource: "manual_transcript",
    };
  });

  return chapters;
}

function calculateAnalysisQuality({
  transcriptText = "",
  transcriptSegments = [],
  chapters = [],
  analysisProvider = null,
  analysisStatus = null,
  transcriptStatus = null,
  fallbackUsed = false,
  claudeCompleted = false,
}) {
  const transcriptLength = String(transcriptText || "").trim().length;
  const segmentsCount = Array.isArray(transcriptSegments) ? transcriptSegments.length : 0;
  const chapterCount = Array.isArray(chapters) ? chapters.length : 0;
  const timestampsDetected = Array.isArray(transcriptSegments)
    ? transcriptSegments.some((segment) => Number.isFinite(Number(segment?.startSeconds ?? segment?.start)))
    : false;

  if (
    analysisStatus === "failed" ||
    analysisStatus === "error" ||
    transcriptLength === 0 ||
    chapterCount === 0
  ) {
    return "weak";
  }

  if (
    claudeCompleted &&
    analysisProvider === "claude" &&
    transcriptLength >= 1400 &&
    segmentsCount >= 12 &&
    timestampsDetected &&
    chapterCount >= 5 &&
    !fallbackUsed
  ) {
    return "excellent";
  }

  if (
    claudeCompleted &&
    analysisProvider === "claude" &&
    transcriptLength >= 700 &&
    chapterCount >= 4 &&
    timestampsDetected &&
    segmentsCount >= 2 &&
    !fallbackUsed
  ) {
    return "good";
  }

  if (
    fallbackUsed ||
    transcriptLength < 700 ||
    segmentsCount < 2 ||
    chapterCount < 4 ||
    transcriptStatus === "manual"
  ) {
    return "partial";
  }

  return "weak";
}

function getAnalysisQualityUi(quality) {
  const normalized = String(quality || "").trim().toLowerCase();
  switch (normalized) {
    case "high":
    case "excellent":
      return { label: "מצוין", className: "bg-green-50 text-green-700 border-green-200", dotClass: "bg-green-500" };
    case "medium":
    case "good":
      return { label: "טוב", className: "bg-amber-50 text-amber-700 border-amber-200", dotClass: "bg-amber-500" };
    case "low":
    case "partial":
      return { label: "חלקי", className: "bg-red-50 text-red-700 border-red-200", dotClass: "bg-red-400" };
    case "none":
    default:
      return { label: "לא נותח", className: "bg-gray-50 text-gray-600 border-gray-200", dotClass: "bg-gray-400" };
  }
}

function buildAnalysisQualityExplanation({
  quality,
  analysisProvider,
  transcriptText,
  transcriptSegments,
  chapters,
  analysisStatus,
  timestampsDetected,
  fallbackUsed,
  claudeCompleted,
}) {
  const transcriptLength = String(transcriptText || "").trim().length;
  const segmentsCount = Array.isArray(transcriptSegments) ? transcriptSegments.length : 0;
  const chapterCount = Array.isArray(chapters) ? chapters.length : 0;
  const providerLabel = analysisProvider === "claude" ? "Claude" : "ניתוח מקומי";

  switch (String(quality || "").toLowerCase()) {
    case "excellent":
    case "high":
      return `${providerLabel} הצליח · ${segmentsCount} segments · timestamps זוהו · ${chapterCount} chapters`;
    case "good":
    case "medium":
      return `${providerLabel} הצליח · transcript usable (${transcriptLength} תווים) · ${chapterCount} chapters`;
    case "partial":
    case "low":
      return `${providerLabel === "Claude" ? "Transcript חלקי" : "Fallback חלקי"} · ${segmentsCount} segments · ${fallbackUsed ? "fallback הופעל" : "timestamps חלקיים"}`;
    default:
      return analysisStatus === "completed" && chapterCount > 0
        ? `אין transcript usable מלא · ${chapterCount} chapters בלבד`
        : "אין transcript usable או שהניתוח נכשל";
  }
}

const PROVIDER_LABELS = { claude: "Claude", gemini: "Gemini", "llama3.2": "llama3.2" };

function extractSavedAnalysisMeta(saved) {
  if (!saved) return null;
  const provider = saved.analysisProvider || "unknown";
  return {
    provider,
    providerLabel: PROVIDER_LABELS[provider] ?? "לא ידוע",
    savedAt: saved.analysisSavedAt || saved.savedAt || null,
  };
}

/** startSeconds may arrive as string from JSON/localStorage */
function resolveChapterStartSeconds(chapter) {
  const s = chapter?.startSeconds;
  if (typeof s === "number" && Number.isFinite(s) && s >= 0) return s;
  if (typeof s === "string" && s.trim() !== "") {
    const n = Number(s);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

const BRAIN_HIGHLIGHT_SECTIONS = ['Reusable Insights', 'Principles', 'Rules', 'Reusable Actions', 'Key Concepts'];
function extractBrainHighlights(brainSummary, keyInsights, keyPoints) {
  if (brainSummary && typeof brainSummary === 'string') {
    const bullets = [];
    let inSection = false;
    for (const line of brainSummary.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('## ')) { inSection = BRAIN_HIGHLIGHT_SECTIONS.some(s => trimmed.includes(s)); continue; }
      if (inSection && (trimmed.startsWith('- ') || trimmed.startsWith('* '))) {
        const text = trimmed.slice(2).trim().replace(/\*\*/g, '');
        if (text && text !== '...' && !text.includes('[מלא ידנית]')) bullets.push(text);
      }
      if (bullets.length >= 10) break;
    }
    if (bullets.length >= 2) return bullets;
  }
  return [
    ...(Array.isArray(keyInsights) ? keyInsights : []),
    ...(Array.isArray(keyPoints) ? keyPoints : []),
  ].slice(0, 10);
}

// ─── GEMS Quick-Copy Action Panel ────────────────────────────────────────────
const MARKET_SUB_IDS = new Set(['gemini-fundamental', 'gemini-technical', 'gemini-macro', 'gemini-news']);

const MARKET_DROPDOWN_ITEMS = [
  { id: 'gemini-fundamental', icon: '📊', label: 'פונדמנטלי' },
  { id: 'gemini-news',        icon: '📰', label: 'מבזק בוקר' },
  { id: 'app-builder',        icon: '🏗️', label: 'App Builder', isAppBuilder: true },
  { id: 'gemini-technical',   icon: '📈', label: 'טכני',  soon: true },
  { id: 'gemini-macro',       icon: '🌍', label: 'מאקרו', soon: true },
];

function GeminiActionsPanel({ video, fullTranscriptText, transcriptWordCount, storedTranscriptSegments, transcriptSourceLabel, handleQuickCopy }) {
  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false);
  const marketRef = useRef(null);

  useEffect(() => {
    if (!marketDropdownOpen) return;
    function onMouseDown(e) {
      if (marketRef.current && !marketRef.current.contains(e.target)) setMarketDropdownOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [marketDropdownOpen]);

  const durationDisplay = (() => {
    const d = video?.duration;
    if (!d) return null;
    if (typeof d === 'string' && d.includes(':')) return d;
    if (typeof d === 'number') {
      const m = Math.floor(d / 60);
      const s = String(Math.floor(d % 60)).padStart(2, '0');
      return `${m}:${s}`;
    }
    return String(d);
  })();

  const stats = [
    { label: 'מקור',         value: transcriptSourceLabel || '—' },
    { label: 'מקטעים',       value: storedTranscriptSegments?.length ?? '—' },
    { label: 'מילים',        value: transcriptWordCount ? transcriptWordCount.toLocaleString() : '—' },
    { label: 'אורך הסרטון',  value: durationDisplay || '—' },
  ];

  const mainActions = QUICK_COPY_ACTIONS.filter(a => !MARKET_SUB_IDS.has(a.id));

  function handleMarketItem(item) {
    if (item.soon) return;
    if (item.isAppBuilder) {
      if (fullTranscriptText) navigator.clipboard.writeText(fullTranscriptText).catch(() => {});
      window.open('https://gemini.google.com/gem/c195e8991418', '_blank');
      setMarketDropdownOpen(false);
      return;
    }
    const action = QUICK_COPY_ACTIONS.find(a => a.id === item.id);
    if (action) { handleQuickCopy(action); setMarketDropdownOpen(false); }
  }

  return (
    <div dir="rtl" className="space-y-2">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-1.5">
        {stats.map(stat => (
          <div key={stat.label} className="rounded-lg bg-slate-100/80 dark:bg-zinc-800/50 px-2 py-2 text-center">
            <div className="text-[9px] uppercase tracking-wide text-slate-400 dark:text-zinc-500 mb-0.5">{stat.label}</div>
            <div className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate tabular-nums">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Action cards — 4 per row */}
      <div className="grid grid-cols-4 gap-1.5">
        {mainActions.map(action => {
          const isMarketToggle = action.id === 'gemini-combo';
          if (isMarketToggle) {
            return (
              <div key={action.id} className="relative" ref={marketRef}>
                <button
                  type="button"
                  onClick={() => setMarketDropdownOpen(p => !p)}
                  className={`w-full rounded-xl py-3 px-2 flex flex-col items-center gap-1.5 border transition-all group ${
                    marketDropdownOpen
                      ? 'bg-slate-100 dark:bg-zinc-800 border-slate-400 dark:border-zinc-600'
                      : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30'
                  }`}
                >
                  <span className="text-base leading-none">{action.icon}</span>
                  <span className={`text-[11px] font-medium leading-tight text-center ${marketDropdownOpen ? 'text-slate-700 dark:text-zinc-200' : 'text-slate-600 dark:text-zinc-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300'}`}>
                    {action.label.replace('Gemini ', '')}
                  </span>
                  <ChevronDown className={`h-2.5 w-2.5 text-slate-400 dark:text-zinc-500 transition-transform duration-200 ${marketDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {marketDropdownOpen && (
                  <div className="absolute top-full mt-1 right-0 z-50 w-44 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
                    {MARKET_DROPDOWN_ITEMS.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleMarketItem(item)}
                        disabled={item.soon}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                          item.soon
                            ? 'text-slate-300 dark:text-zinc-600 cursor-not-allowed'
                            : item.isAppBuilder
                              ? 'text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                              : 'text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800/80'
                        }`}
                      >
                        <span className="text-base leading-none">{item.icon}</span>
                        <span className="flex-1 text-right">{item.label}</span>
                        {item.soon && <span className="text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 px-1.5 py-0.5 rounded-full">בקרוב</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          // Check if this action has a configured Gem URL
          const actionGemKey = action.flow ? action.flow.replace('gem-', '') : null;
          const actionGemUrl = actionGemKey ? getGemUrl(actionGemKey) : (action.url || null);
          const hasUrl = Boolean(actionGemUrl);
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => handleQuickCopy(action)}
              disabled={!fullTranscriptText}
              title={hasUrl ? `פתח ${action.label.replace('Gemini ','')} ב-Gemini` : 'Gem URL לא מוגדר — לחץ להעתקה בלבד'}
              className={`rounded-xl py-3 px-2 flex flex-col items-center gap-1 border transition-all group disabled:opacity-40 disabled:cursor-not-allowed ${
                hasUrl
                  ? 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30'
                  : 'bg-slate-50 dark:bg-zinc-950 border-dashed border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
              }`}
            >
              <span className="text-base leading-none">{action.icon}</span>
              <span className={`text-[11px] font-medium leading-tight text-center ${hasUrl ? 'text-slate-600 dark:text-zinc-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300' : 'text-slate-400 dark:text-zinc-600'}`}>
                {action.label.replace('Gemini ', '')}
              </span>
              {!hasUrl && (
                <span className="text-[9px] text-slate-300 dark:text-zinc-700 leading-none">🔗 הגדר</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export function VideoDetailPanel({
  video: videoProp,
  mentorName,
  open,
  onOpenChange,
  topics = [],
  onSaveToggle,
  onLearningStatusChange,
  onRemoveTopic,
  onAnalyzeDone,
  onVideoPatch,
  isDark = false,
  toggleTheme,
  initialChapterIndex = null,
  navigateTo,
}) {
  const isDev = import.meta?.env?.DEV === true;
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(null);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [showLowQualityWarning, setShowLowQualityWarning] = useState(false);
  const [claudeStatus, setClaudeStatus] = useState({ configured: null, provider: "claude", missingEnvKey: null });
  const [transcriptDiagnostics, setTranscriptDiagnostics] = useState(null);
  const [isCheckingTranscript, setIsCheckingTranscript] = useState(false);
  const [isAutoTranscriptModalOpen, setIsAutoTranscriptModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("chapters");
  const [highlightedChapterIndex, setHighlightedChapterIndex] = useState(null);
  const [isManualTranscriptOpen, setIsManualTranscriptOpen] = useState(false);
  const [manualTranscriptInput, setManualTranscriptInput] = useState("");
  const [isSavingManualTranscript, setIsSavingManualTranscript] = useState(false);
  const [isFetchingYtApiTranscript, setIsFetchingYtApiTranscript] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState("idle");
  const [geminiMessage, setGeminiMessage] = useState(null);
  const [llamaStatus, setLlamaStatus] = useState("idle");
  const [llamaMessage, setLlamaMessage] = useState(null);
  const [llamaHealthStatus, setLlamaHealthStatus] = useState("idle");
  const [llamaHealthMessage, setLlamaHealthMessage] = useState(null);
  const [llamaQuickTestStatus, setLlamaQuickTestStatus] = useState("idle");
  const [llamaQuickTestMessage, setLlamaQuickTestMessage] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [goldenExample, setGoldenExample] = useState(null);
  const [goldenFindError, setGoldenFindError] = useState(null);
  const [youtubeChaptersHint, setYoutubeChaptersHint] = useState(null);
  const [isYoutubeChaptersFetch, setIsYoutubeChaptersFetch] = useState(false);
  const [savedAnalysisMeta, setSavedAnalysisMeta] = useState(null);
  const restoredAnalysisRef = useRef(null);
  const ollamaStatusRequestRef = useRef(false);
  const updateSummary = useUpdateSummary();
  const { video: persistedVideo, patch: patchVideo, setVideo: setVideoState } = usePersistedVideo(videoProp?.id, videoProp);
  // Use videoProp as fallback while the persisted-state hook initializes on first select
  const video = persistedVideo ?? videoProp;
  const [selectedItems, setSelectedItems] = useState(() => video?.selectedKnowledgeItems ?? {});
  const [isKnowledgePickerOpen, setIsKnowledgePickerOpen] = useState(false);
  const [isTranscriptViewerOpen, setIsTranscriptViewerOpen] = useState(false);
  const [isGemsPasteOpen, setIsGemsPasteOpen] = useState(false);
  const [gemsPasteInput, setGemsPasteInput] = useState("");
  const [gemsPasteError, setGemsPasteError] = useState("");
  const [brainPickerOpen, setBrainPickerOpen] = useState(false);
  const [pendingBrainSave, setPendingBrainSave] = useState(null);
  const [saveAllConfirmOpen, setSaveAllConfirmOpen] = useState(false);
  const [saveAllContent, setSaveAllContent] = useState(null);
  const [categoryOverride, setCategoryOverride] = useState(null);
  const [subCategoryOverride, setSubCategoryOverride] = useState(null);
  const [recApplied, setRecApplied] = useState(false);
  const [vaultSubtopics, setVaultSubtopics] = useState([]);
  const hasSavedAnalysis = !!savedAnalysisMeta;
  const queryClient = useQueryClient();

  useEffect(() => { setShowLowQualityWarning(false); }, [video?.id]);
  useEffect(() => { setSelectedItems(video?.selectedKnowledgeItems ?? {}); }, [video?.id]);
  useEffect(() => {
    setCategoryOverride(null);
    setSubCategoryOverride(null);
    setRecApplied(false);
    setVaultSubtopics([]);
  }, [video?.id]);
  useEffect(() => {
    if (pendingBrainSave && !isKnowledgePickerOpen) {
      setBrainPickerOpen(true);
    }
  }, [pendingBrainSave, isKnowledgePickerOpen]);

  const persistSelectedItems = (next) => {
    setSelectedItems(next);
    patchVideo({ selectedKnowledgeItems: next });
  };

  const selectableBrainHighlights = useMemo(
    () => extractBrainHighlights(video?.brainSummary, video?.keyInsights, video?.keyPoints),
    [video?.brainSummary, video?.keyInsights, video?.keyPoints]
  );

  const selectableAtomicFields = useMemo(
    () => [
      { key: 'mainLesson',      emoji: '🎯', label: 'רעיון מרכזי', items: video?.mainLesson ? [String(video.mainLesson)] : [] },
      { key: 'brainHighlights', emoji: '🧠', label: 'תובנות בריין', items: selectableBrainHighlights },
      { key: 'keyInsights',     emoji: '⚡', label: 'תובנות',      items: Array.isArray(video?.keyInsights)     ? video.keyInsights.filter(Boolean).map(String)     : [] },
      { key: 'rules',           emoji: '✅', label: 'כללים',       items: Array.isArray(video?.rules)           ? video.rules.filter(Boolean).map(String)           : [] },
      { key: 'actionItems',     emoji: '🔁', label: 'פעולות',      items: Array.isArray(video?.actionItems)     ? video.actionItems.filter(Boolean).map(String)     : [] },
      { key: 'mistakesToAvoid', emoji: '⚠️', label: 'טעויות',     items: Array.isArray(video?.mistakesToAvoid) ? video.mistakesToAvoid.filter(Boolean).map(String) : [] },
      { key: 'concepts',        emoji: '🧩', label: 'מושגים',      items: Array.isArray(video?.concepts)        ? video.concepts.filter(Boolean).map(String)        : [] },
    ].filter((field) => field.items.length > 0),
    [video?.mainLesson, video?.keyInsights, video?.rules, video?.actionItems, video?.mistakesToAvoid, video?.concepts, selectableBrainHighlights]
  );

  const totalSelectedKnowledgeItems = useMemo(
    () => Object.values(selectedItems).filter(Boolean).length,
    [selectedItems]
  );

  const totalSelectableKnowledgeItems = useMemo(
    () => selectableAtomicFields.reduce((sum, field) => sum + field.items.length, 0),
    [selectableAtomicFields]
  );

  const gemRec = useMemo(() => {
    if (!video) return null;
    const transcriptText = String(video?.transcript || '');
    const mentorResolved = resolveChannelToMentor(video);
    const forcedCategoryLabel = mentorResolved?.categoryLabel ?? null;
    return classifyVideoForGem(video, transcriptText, { forcedCategoryLabel });
  }, [video?.id, video?.title, video?.channelTitle, video?.category, video?.contentType, video?.tags]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || initialChapterIndex == null) {
      setHighlightedChapterIndex(null);
      return;
    }
    setHighlightedChapterIndex(initialChapterIndex);
    setActiveTab("chapters");
  }, [open, initialChapterIndex]);

  useEffect(() => {
    if (highlightedChapterIndex == null) return;
    const timer = setTimeout(() => {
      document.getElementById(`chap-hl-${highlightedChapterIndex}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => clearTimeout(timer);
  }, [highlightedChapterIndex]);

  const scrollToLearningNotes = () => {
    const el = document.getElementById("learning-notes");
    el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  const scrollToAnalysisTabs = () => {
    const el = document.getElementById("analysis-tabs");
    el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  const runClaudeAnalysisFromCard = () => {
    setActiveTab("summary");
    scrollToAnalysisTabs();
    handleAnalyze();
  };

  const refreshLlamaStatusSilently = async () => {
    if (ollamaStatusRequestRef.current) return null;
    ollamaStatusRequestRef.current = true;
    try {
      const result = await checkOllamaStatus();
      setLlamaHealthStatus(result.status);
      setLlamaHealthMessage(result.message);
      return result;
    } catch {
      const message = "Ollama לא פעיל. הפעל במחשב: ollama serve";
      setLlamaHealthStatus("ollama_offline");
      setLlamaHealthMessage(message);
      return { status: "ollama_offline", message };
    } finally {
      ollamaStatusRequestRef.current = false;
    }
  };

  const handleCheckLlamaStatus = async () => {
    setLlamaHealthStatus("loading");
    setLlamaHealthMessage("בודק את Ollama ואת llama3.2...");
    try {
      const result = await checkOllamaStatus();
      setLlamaHealthStatus(result.status);
      setLlamaHealthMessage(result.message);
      if (result.status === "ready") {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch {
      const message = "Ollama לא פעיל. הפעל במחשב: ollama serve";
      setLlamaHealthStatus("ollama_offline");
      setLlamaHealthMessage(message);
      toast.error(message);
    }
  };

  const handleCopyCommand = async (command) => {
    try {
      await navigator.clipboard.writeText(command);
      toast.success("הפקודה הועתקה");
    } catch {
      toast.error("לא ניתן היה להעתיק את הפקודה");
    }
  };

  const handleQuickTestLlama = async () => {
    setLlamaQuickTestStatus("loading");
    setLlamaQuickTestMessage("מריץ בדיקת תגובה מהמודל...");
    try {
      const result = await quickTestOllamaModel();
      setLlamaQuickTestStatus(result.status);
      setLlamaQuickTestMessage(result.message);
      if (result.status === "ready") {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch {
      const message = "בדיקת תגובה של llama3.2 נכשלה";
      setLlamaQuickTestStatus("failed");
      setLlamaQuickTestMessage(message);
      toast.error(message);
    }
  };

  useEffect(() => {
    if (!open) return undefined;

    refreshLlamaStatusSilently();
    const intervalId = window.setInterval(() => {
      refreshLlamaStatusSilently();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [open]);

  const runLlamaAnalysisFromCard = async () => {
    if (llamaStatus === "loading") return;

    const transcriptText =
      typeof video?.transcript === "string" && video.transcript.trim().length > 0
        ? video.transcript.trim()
        : typeof video?.manualTranscript === "string" && video.manualTranscript.trim().length > 0
          ? video.manualTranscript.trim()
          : "";

    const transcriptSegments =
      Array.isArray(video?.transcriptSegments) && video.transcriptSegments.length > 0
        ? video.transcriptSegments
        : video?.transcriptStatus === "manual"
          ? parseManualTranscript(transcriptText).segments
          : parseTranscript(transcriptText).lines.map((segment) => ({
              text: segment?.text || "",
              startSeconds: Number(segment?.start ?? 0),
              durationSeconds: 0,
            }));

    if (!transcriptText || transcriptText.length < 80) {
      const message = "לא נמצא תמלול תקין לניתוח עם llama3.2";
      setLlamaStatus("failed");
      setLlamaMessage(message);
      setAnalyzeError(message);
      toast.error(message);
      return;
    }

    setLlamaStatus("loading");
    setLlamaMessage(null);
    setAnalyzeError(null);
    setActiveTab("summary");
    scrollToAnalysisTabs();

    try {
      const result = await analyzeVideoWithOllama({
        videoId: video.id,
        title: video.title,
        transcript: transcriptText,
        durationSeconds: getVideoDurationSeconds(video),
        mentor: mentorName || null,
        category: video.category || null,
      });

      const normalized = validateAiAnalysisQuality(result);
      const normalizedChapters = normalizeTranscriptBackedChapters(normalized.chapters, transcriptSegments);
      const chaptersValidation = validateChaptersForSave(normalizedChapters, { allowGenericTitles: false });

      if (!chaptersValidation.ok) {
        throw new Error(`llama3.2 לא החזיר פרקים תקינים: ${chaptersValidation.reason || "שגיאה לא ידועה"}`);
      }

      const chaptersToSave = chaptersValidation.chapters;
      const analysisSavedAt = Date.now();
      const patch = {
        shortSummary: normalized.shortSummary,
        fullSummary: normalized.fullSummary,
        keyPoints: normalized.keyPoints,
        tags: normalized.tags,
        aiSummaryShort: normalized.shortSummary,
        aiSummaryLong: normalized.fullSummary,
        aiChapters: chaptersToSave,
        chapters: chaptersToSave,
        videoTopics: chaptersToVideoTopics(chaptersToSave),
        analysisProvider: "llama3.2",
        analysisStatus: "saved",
        analysisSavedAt,
        transcriptStatus: video.transcriptStatus || "manual",
        transcriptSource: video.transcriptSource || (video.transcriptStatus === "manual" ? "manual" : "youtube"),
        transcriptError: null,
        analysisError: null,
        chapterSource: video.transcriptStatus === "manual" ? "manual_transcript" : "transcript",
        analyzedAt: new Date().toISOString(),
        analysisQuality: calculateAnalysisQuality({
          transcriptText,
          transcriptSegments,
          chapters: chaptersToSave,
          analysisProvider: "llama3.2",
          analysisStatus: "completed",
          transcriptStatus: video.transcriptStatus || null,
          fallbackUsed: false,
          claudeCompleted: false,
        }),
      };

      const saved = persistAnalysisState(patch);
      const nextVideo = { ...(saved || video), ...patch };
      setVideoState(nextVideo);
      const snapshot = {
        ...buildAnalysisSnapshot(nextVideo),
        analysisSavedAt,
      };
      saveSavedAnalysis(video.id, snapshot);
      setSavedAnalysisMeta(extractSavedAnalysisMeta({
        analysisProvider: "llama3.2",
        analysisSavedAt,
      }));
      onVideoPatch?.(nextVideo);
      onAnalyzeDone?.(nextVideo);
      setLlamaStatus("success");
      setLlamaMessage("נותח עם llama3.2 ונשמר מקומית");
      toast.success("הניתוח נשמר עם llama3.2");
    } catch (error) {
      const message =
        error?.code === "OLLAMA_UNAVAILABLE"
          ? "Ollama לא פעיל. הפעל במחשב: ollama serve"
          : error?.code === "OLLAMA_MODEL_NOT_FOUND"
            ? "מודל llama3.2 לא מותקן. הרץ במחשב: ollama pull llama3.2"
          : error?.message || "llama3.2 נכשל בניתוח הסרטון";
      setLlamaStatus("failed");
      setLlamaMessage(message);
      setAnalyzeError(message);
      toast.error(message);
    }
  };

  useEffect(() => {
    let active = true;
    if (!open) return undefined;

    getClaudeAnalyzerStatus()
      .then((status) => {
        if (!active) return;
        setClaudeStatus({
          configured: Boolean(status?.configured),
          provider: status?.provider || "claude",
          missingEnvKey: status?.missingEnvKey || null,
        });
        if (!status?.configured) {
          console.log("[Claude] missing API key");
        }
      })
      .catch(() => {
        if (!active) return;
        setClaudeStatus({ configured: null, provider: "claude", missingEnvKey: null });
      });

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!video?.id) { setSavedAnalysisMeta(null); return; }
    setSavedAnalysisMeta(extractSavedAnalysisMeta(loadSavedAnalysis(video.id)));
  }, [video?.id, open]);

  useEffect(() => {
    if (!open || !video?.id) return;
    const savedAnalysis = loadSavedAnalysis(video.id);
    if (!savedAnalysis) return;

    const restoreToken = `${video.id}:${savedAnalysis.savedAt || "saved"}`;
    if (restoredAnalysisRef.current === restoreToken) return;
    restoredAnalysisRef.current = restoreToken;

    const patch = buildDefinedPatch({
      transcript: savedAnalysis.transcript ?? undefined,
      manualTranscript: savedAnalysis.manualTranscript ?? undefined,
      transcriptSource: savedAnalysis.transcriptSource ?? undefined,
      transcriptStatus: savedAnalysis.transcriptStatus ?? undefined,
      transcriptLanguage: savedAnalysis.transcriptLanguage ?? undefined,
      transcriptError: savedAnalysis.transcriptError ?? undefined,
      shortSummary: savedAnalysis.shortSummary ?? undefined,
      fullSummary: savedAnalysis.fullSummary ?? undefined,
      aiSummaryShort: savedAnalysis.aiSummaryShort ?? undefined,
      aiSummaryLong: savedAnalysis.aiSummaryLong ?? undefined,
      keyPoints: Array.isArray(savedAnalysis.keyPoints) ? savedAnalysis.keyPoints : undefined,
      keyInsights: Array.isArray(savedAnalysis.keyInsights) ? savedAnalysis.keyInsights : undefined,
      actionItems: Array.isArray(savedAnalysis.actionItems) ? savedAnalysis.actionItems : undefined,
      tags: Array.isArray(savedAnalysis.tags) ? savedAnalysis.tags : undefined,
      videoTopics: Array.isArray(savedAnalysis.videoTopics) ? savedAnalysis.videoTopics : undefined,
      chapters: Array.isArray(savedAnalysis.chapters) ? savedAnalysis.chapters : undefined,
      aiChapters: Array.isArray(savedAnalysis.aiChapters) ? savedAnalysis.aiChapters : undefined,
      descriptionChapters: Array.isArray(savedAnalysis.descriptionChapters) ? savedAnalysis.descriptionChapters : undefined,
      analysisStatus: savedAnalysis.analysisStatus ?? undefined,
      analysisQuality: savedAnalysis.analysisQuality ?? undefined,
      analysisError: savedAnalysis.analysisError ?? undefined,
      analysisProvider: savedAnalysis.analysisProvider ?? undefined,
      analyzedAt: savedAnalysis.analyzedAt ?? undefined,
      analysisVersion: savedAnalysis.analysisVersion ?? undefined,
      chapterSource: savedAnalysis.chapterSource ?? undefined,
      mainLesson: savedAnalysis.mainLesson ?? undefined,
      strategyOrMethod: savedAnalysis.strategyOrMethod ?? undefined,
      rules: Array.isArray(savedAnalysis.rules) ? savedAnalysis.rules : undefined,
      mistakesToAvoid: Array.isArray(savedAnalysis.mistakesToAvoid) ? savedAnalysis.mistakesToAvoid : undefined,
      duration: savedAnalysis.duration ?? undefined,
      viewCount: savedAnalysis.viewCount ?? undefined,
    });

    const savedVideo = patchVideo(patch);
    onVideoPatch?.(savedVideo ?? { ...video, ...patch });

    if (savedAnalysis.activeTab) {
      setActiveTab(savedAnalysis.activeTab);
    }

    if (Array.isArray(savedAnalysis.notes) && savedAnalysis.notes.length > 0) {
      replaceLocalNotesForVideo(video.id, savedAnalysis.notes);
      queryClient.invalidateQueries({ queryKey: ["notes", "video", video.id] });
    }
  }, [open, video?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveVideoFields = useCallback(async (updates) => {
    patchVideo(updates);
    onVideoPatch?.({ ...video, ...updates });
    if (isBase44Enabled()) {
      try {
        await Video.update(video.id, updates);
      } catch (err) {
        console.warn('[Save] Base44 sync failed (non-blocking):', err?.message);
      }
    }
  }, [patchVideo, onVideoPatch, video]);

  // handleQuickCopy defined after videoDuration+fullTranscriptText to avoid TDZ — see below.

  const handleApplyRecommendation = useCallback(async () => {
    if (!gemRec) return;
    const catCode = gemRec.recommendedCategoryCode ?? null;
    const catLabel = categoryOverride ?? gemRec.recommendedCategoryLabel ?? null;
    const subCat = subCategoryOverride ?? gemRec.recommendedSubCategory ?? 'כללי';
    await saveVideoFields({ category: catLabel, subCategory: subCat });
    setRecApplied(true);
    toast.success('המלצת הניתוח נשמרה לסרטון');
  }, [gemRec, categoryOverride, subCategoryOverride, saveVideoFields]);

  const buildVaultDestination = useCallback((brainId, subBrainId, customBrainName, customSubName) => {
    return { brainId: brainId || null, subBrainId: subBrainId || null, customBrainName: customBrainName || null, customSubName: customSubName || null };
  }, []);

  // buildSaveAllContent / handleSaveAllToBrain / handleSaveAllConfirmed are defined
  // AFTER videoNotes (line ~1198) to avoid TDZ — see bottom of hook section.

  const enrichedVideo = useMemo(() => video || {}, [video]);

  const chapterSourceInfo = useMemo(() => {
    const resolved = resolveVideoChapters(video || {});
    if (resolved.length > 0) {
      const source =
        resolved[0]?.chapterSource ||
        (resolved[0]?.timeSource === "transcript" ? "transcript"
        : resolved[0]?.timeSource === "real" ? "description_timestamp"
        : resolved[0]?.timeSource === "estimated" ? "duration_fallback"
        : "none");
      return {
        source,
        chapterSource: source,
        analysisQuality: source === "duration_fallback" ? "low" : source === "description_timestamp" ? "medium" : "high",
        chapters: resolved,
        message:
          source === "description_timestamp"
            ? "לא נמצא תמלול מלא, אבל נמצאו פרקים מתוך תיאור הסרטון."
            : source === "duration_fallback"
              ? "לא נמצא תמלול מלא. מוצגת חלוקה בסיסית לפי זמן הסרטון בלבד."
              : null,
      };
    }
    return getChapterSource(video || {});
  }, [video]);

  const baseChapters = useMemo(() => {
    return chapterSourceInfo.chapters || [];
  }, [chapterSourceInfo]);

  useEffect(() => {
    setYoutubeChaptersHint(null);
    setTranscriptDiagnostics(null);
  }, [video?.id]);

  const handleFetchYoutubeChapters = async () => {
    setYoutubeChaptersHint(null);
    const watchUrl = getWatchUrl(video);
    const videoId = getVideoIdFromUrl(watchUrl);
    if (!videoId) {
      toast.error("לא ניתן לזהות מזהה סרטון מהקישור — ודא שיש url / link / videoUrl בפורמט watch או youtu.be");
      return;
    }

    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!apiKey?.trim()) {
      setYoutubeChaptersHint("no_api_key");
      return;
    }

    setIsYoutubeChaptersFetch(true);
    try {
      let descText = "";
      let chaptersResult = [];

      if (!shouldFetchVideoMetadata(videoId)) {
        const cached = getCachedVideoMetadata(videoId);
        descText = cached?.description ?? "";
        chaptersResult = Array.isArray(cached?.chapters) ? cached.chapters : [];
      } else {
        const fetched = await fetchVideoDescription(videoId);
        if (fetched == null) {
          setYoutubeChaptersHint("fetch_failed");
          return;
        }
        descText = fetched;
        chaptersResult = extractTimestampsFromDescription(descText);
        setCachedVideoMetadata(videoId, { description: descText, chapters: chaptersResult });
      }

      if (!chaptersResult.length) {
        setYoutubeChaptersHint("no_timestamps");
        return;
      }

      const aiChapters = chaptersResult.map((c) => {
        const sec = resolveChapterStartSeconds(c);
        return {
          ...c,
          ...(sec != null ? { startSeconds: sec } : {}),
          timeSource: c.timeSource || "real",
          chapterSource: "description_timestamp",
          source: "description_timestamp",
        };
      });
      const mergedDesc =
        descText ||
        (typeof video.description === "string" ? video.description : "") ||
        "";
      const updates = {
        aiChapters,
        chapters: aiChapters,
        descriptionChapters: aiChapters,
        chapterSource: "description_timestamp",
        analysisQuality: "medium",
        ...(mergedDesc ? { description: mergedDesc } : {}),
      };

      const localSaved = patchVideo(updates);
      if (localSaved) {
        onVideoPatch?.(localSaved);
        toast.success("פרקים עם timestamps אמיתיים נשמרו");
        return;
      }

      try {
        await Video.update(video.id, updates);
        patchVideo(updates);
        queryClient.invalidateQueries({ queryKey: ["videos"] });
        onVideoPatch?.({ ...video, ...updates });
        toast.success("פרקים עם timestamps אמיתיים נשמרו");
      } catch {
        toast.error("לא ניתן לשמור את הפרקים בשרת");
      }
    } catch {
      setYoutubeChaptersHint("fetch_failed");
    } finally {
      setIsYoutubeChaptersFetch(false);
    }
  };

  const { data: videoNotes = [] } = useNotesByVideo(video?.id);
  const hasNote = videoNotes.length > 0;
  const notePreview = hasNote ? videoNotes[0].content : null;

  // Defined here (after videoNotes) to avoid TDZ crash
  const buildSaveAllContent = useCallback(() => {
    const fmtSec = (sec) => {
      if (!Number.isFinite(sec)) return '';
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
    };
    const lines = [];
    const stats = {};
    const sect = (title, items, formatter) => {
      if (!Array.isArray(items) || items.length === 0) return 0;
      lines.push(`## ${title}`, '');
      items.forEach(item => { const t = formatter(item); if (t) lines.push(t); });
      lines.push('');
      return items.length;
    };
    const chapters = (video?.aiChapters || video?.chapters || []);
    if (chapters.length) {
      lines.push('## 📑 פרקים', '');
      chapters.forEach(ch => {
        const ts = ch.startSeconds != null ? ` \`${fmtSec(ch.startSeconds)}\`` : '';
        lines.push(`### ${ch.title}${ts}`);
        if (ch.summary) { lines.push(''); lines.push(ch.summary); }
        lines.push('');
      });
      stats['פרקים'] = chapters.length;
    }
    stats['תובנות'] = sect('⚡ תובנות מרכזיות', video?.keyInsights, i => `- ${i}`);
    stats['ידע שימושי'] = sect('💡 ידע שימושי', video?.keyPoints, p => `- ${p}`);
    stats['כללים'] = sect('✅ כללים', video?.rules, r => `- ${r}`);
    stats['מושגים'] = sect('🧩 מושגים', video?.concepts, c => `- ${c}`);
    stats['פעולות'] = sect('🔁 פעולות', video?.actionItems, a => `- ${a}`);
    stats['טעויות'] = sect('⚠️ טעויות', video?.mistakesToAvoid, m => `- ${m}`);
    if (Array.isArray(videoNotes) && videoNotes.length > 0) {
      lines.push('## 📝 הערות', '');
      videoNotes.forEach(n => { const t = n.content || n.text || ''; if (t) lines.push(`- ${t}`); });
      lines.push('');
      stats['הערות'] = videoNotes.length;
    }
    const totalItems = Object.values(stats).reduce((a, b) => a + b, 0);
    return { markdown: lines.join('\n'), stats, totalItems };
  }, [video, videoNotes]);

  const handleSaveAllToBrain = useCallback(() => {
    const content = buildSaveAllContent();
    const cleanStr = (s) => String(s || '').replace(/[/\\?*:|"<>]/g, '').trim();
    const topicPart = cleanStr(video?.category || 'כללי').slice(0, 40);
    const subPart = cleanStr(video?.subCategory || '');
    const titlePart = cleanStr(video?.title || 'סרטון').slice(0, 60);
    const path = subPart && subPart !== 'כללי'
      ? `${topicPart}/${subPart}/${titlePart}.md`
      : `${topicPart}/${titlePart}.md`;
    setSaveAllContent({ ...content, path });
    setSaveAllConfirmOpen(true);
  }, [buildSaveAllContent, video]);

  const handleSaveAllConfirmed = useCallback(async () => {
    if (!saveAllContent) return;
    try {
      const res = await fetch('/api/vault/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: saveAllContent.path,
          content: saveAllContent.markdown,
          videoTitle: video?.title,
          videoUrl: getWatchUrl(video),
          channelTitle: video?.channelTitle,
          duration: video?.duration,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`✅ נשמרו ${saveAllContent.totalItems} פריטים למוח`, {
          description: `נתיב: ${saveAllContent.path}`,
          duration: 6000,
        });
        setSaveAllConfirmOpen(false);
        setSaveAllContent(null);
      } else {
        toast.error(`שגיאה בשמירה: ${data.error || 'לא ידוע'}`);
      }
    } catch (err) {
      toast.error(`שגיאה: ${err.message}`);
    }
  }, [saveAllContent, video]);

  const knowledgeItemId = useMemo(() => {
    const sourceId = String(video?.videoId || video?.id || "");
    return sourceId ? `youtube:${sourceId}` : null;
  }, [video?.videoId, video?.id]);

  const isSavedInWorkspace = useMemo(() => {
    if (!knowledgeItemId) return false;
    try {
      return getKnowledgeItems().some((i) => i?.id === knowledgeItemId);
    } catch {
      return false;
    }
  }, [knowledgeItemId]);

  if (!video) return null;

  const persistAnalysisState = (updates) => {
    const saved = patchVideo(updates);
    onVideoPatch?.(saved ?? { ...video, ...updates });
    return saved;
  };

  const buildDefinedPatch = (patch) =>
    Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined)
    );

  const buildAnalysisSnapshot = (videoOverride) => {
    const v = videoOverride ?? video;
    return {
      activeTab,
      transcript: typeof v.transcript === "string" ? v.transcript : null,
      manualTranscript: typeof v.manualTranscript === "string" ? v.manualTranscript : null,
      transcriptSource: v.transcriptSource ?? null,
      transcriptStatus: v.transcriptStatus ?? null,
      transcriptLanguage: v.transcriptLanguage ?? null,
      transcriptError: v.transcriptError ?? null,
      shortSummary: v.shortSummary ?? null,
      fullSummary: v.fullSummary ?? null,
      aiSummaryShort: v.aiSummaryShort ?? null,
      aiSummaryLong: v.aiSummaryLong ?? null,
      keyPoints: Array.isArray(v.keyPoints) ? v.keyPoints : [],
      keyInsights: Array.isArray(v.keyInsights) ? v.keyInsights : [],
      actionItems: Array.isArray(v.actionItems) ? v.actionItems : [],
      tags: Array.isArray(v.tags) ? v.tags : [],
      videoTopics: Array.isArray(v.videoTopics) ? v.videoTopics : [],
      chapters: Array.isArray(v.chapters) ? v.chapters : [],
      aiChapters: Array.isArray(v.aiChapters) ? v.aiChapters : [],
      descriptionChapters: Array.isArray(v.descriptionChapters) ? v.descriptionChapters : [],
      analysisStatus: v.analysisStatus ?? null,
      analysisQuality: v.analysisQuality ?? null,
      analysisError: v.analysisError ?? null,
      analysisProvider: v.analysisProvider ?? null,
      analyzedAt: v.analyzedAt ?? null,
      analysisVersion: v.analysisVersion ?? null,
      chapterSource: v.chapterSource ?? null,
      mainLesson: v.mainLesson ?? null,
      strategyOrMethod: v.strategyOrMethod ?? null,
      rules: Array.isArray(v.rules) ? v.rules : [],
      mistakesToAvoid: Array.isArray(v.mistakesToAvoid) ? v.mistakesToAvoid : [],
      duration: v.duration ?? null,
      viewCount: v.viewCount ?? null,
      analysisSavedAt: new Date().toISOString(),
      notes: Array.isArray(videoNotes)
        ? videoNotes.map((note) => ({
            id: note?.id ?? null,
            content: note?.content ?? "",
            timestampSeconds: note?.timestampSeconds ?? null,
            timestampLabel: note?.timestampLabel ?? null,
            createdAt: note?.createdAt ?? null,
            updatedAt: note?.updatedAt ?? null,
          }))
        : [],
    };
  };

  const handleSaveAnalysis = () => {
    const snapshot = buildAnalysisSnapshot();
    const ok = saveSavedAnalysis(video.id, snapshot);
    if (!ok) {
      toast.error("לא ניתן לשמור את הניתוח");
      return;
    }
    setSavedAnalysisMeta(extractSavedAnalysisMeta({
      analysisProvider: video.analysisProvider || null,
      analysisSavedAt: snapshot.analysisSavedAt,
    }));
    toast.success("הניתוח נשמר");
  };

  const handleApplyGemsJson = () => {
    const raw = gemsPasteInput.trim();
    if (!raw) { setGemsPasteError("הדבק JSON לפני לחיצה על החל"); return; }
    let parsed;
    try { parsed = JSON.parse(raw); } catch { setGemsPasteError("JSON לא תקין — בדוק שאין שגיאות syntax"); return; }
    try {
      const normalized = normalizeAiAnalysisResult(parsed);
      if (!normalized) { setGemsPasteError("לא זוהה פורמט ניתוח תקין"); return; }
      persistAnalysisState(normalized);
      setGemsPasteInput("");
      setGemsPasteError("");
      setIsGemsPasteOpen(false);
      toast.success("ניתוח GEMS הוחל בהצלחה");
    } catch (err) {
      setGemsPasteError(`שגיאה בעיבוד: ${err.message}`);
    }
  };

  const handleDeleteSavedAnalysis = () => {
    const ok = deleteSavedAnalysis(video.id);
    if (!ok) {
      toast.error("לא ניתן למחוק את הניתוח השמור");
      return;
    }
    setSavedAnalysisMeta(null);
    restoredAnalysisRef.current = null;
    patchVideo({
      aiChapters: [],
      chapters: [],
      shortSummary: null,
      fullSummary: null,
      aiSummaryShort: null,
      aiSummaryLong: null,
      keyPoints: [],
      keyInsights: [],
      actionItems: [],
      videoTopics: [],
      mainLesson: null,
      strategyOrMethod: null,
      rules: [],
      mistakesToAvoid: [],
      tags: [],
      analysisProvider: null,
      analyzedAt: null,
      analysisVersion: null,
      chapterSource: null,
      analysisStatus: "not_analyzed",
      analysisError: null,
      analysisQuality: null,
    });
    toast.success("הניתוח השמור נמחק");
  };

  const clearAiAnalysisFields = (analysisError) => ({
    chapters: [],
    aiChapters: [],
    shortSummary: null,
    fullSummary: null,
    aiSummaryShort: null,
    aiSummaryLong: null,
    keyPoints: [],
    keyInsights: [],
    actionItems: [],
    videoTopics: [],
    analysisStatus: "failed",
    analysisError,
  });

  const normalizeTranscriptBackedChapters = (chapters, transcriptSegments) => {
    const normalized = Array.isArray(chapters) ? chapters : [];
    if (normalized.length === 0) return [];

    const transcriptEnd = Array.isArray(transcriptSegments) && transcriptSegments.length > 0
      ? transcriptSegments.reduce((maxEnd, segment) => {
          const start = Number(segment?.startSeconds ?? segment?.start ?? 0);
          const duration = Number(segment?.durationSeconds ?? segment?.duration ?? 0);
          if (!Number.isFinite(start)) return maxEnd;
          return Math.max(maxEnd, start + (Number.isFinite(duration) ? duration : 0));
        }, 0)
      : 0;

    return normalized
      .map((chapter) => {
        const title = String(chapter?.title || "").trim();
        const summary = String(chapter?.summary || chapter?.description || "").trim();
        const startSeconds = Number(chapter?.startSeconds);
        const endSeconds = Number(chapter?.endSeconds);

        if (!title || !summary || !Number.isFinite(startSeconds) || startSeconds < 0) {
          return null;
        }

        return {
          ...chapter,
          title,
          summary,
          description: summary,
          startSeconds: Math.floor(startSeconds),
          endSeconds: Number.isFinite(endSeconds) && endSeconds >= 0 ? Math.floor(endSeconds) : null,
          timeSource: "transcript",
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.startSeconds - b.startSeconds)
      .map((chapter, index, arr) => {
        const next = arr[index + 1];
        const fallbackEnd = Number.isFinite(next?.startSeconds)
          ? next.startSeconds
          : transcriptEnd > chapter.startSeconds
            ? Math.ceil(transcriptEnd)
            : null;
        return {
          ...chapter,
          endSeconds:
            Number.isFinite(chapter.endSeconds) && chapter.endSeconds >= chapter.startSeconds
              ? chapter.endSeconds
              : fallbackEnd,
        };
      })
      .filter((chapter) => Number.isFinite(chapter.endSeconds) && chapter.endSeconds >= chapter.startSeconds);
  };

  const handleRemoveManualTranscript = () => {
    persistAnalysisState({
      manualTranscript: null,
      transcriptStatus: "unavailable",
    });
    toast.success("התמלול הידני הוסר");
  };

  const handleSaveManualTranscript = async () => {
    const text = manualTranscriptInput.trim();
    if (text.length < 40) {
      toast.error("התמלול קצר מדי — הדבק טקסט מלא");
      return;
    }
    setIsSavingManualTranscript(true);
    setIsManualTranscriptOpen(false);
    setManualTranscriptInput("");
    try {
      persistAnalysisState({
        manualTranscript: text,
        transcriptStatus: "manual",
        transcriptError: null,
        analysisError: null,
      });
      toast.success("התמלול נשמר — מריץ ניתוח AI...");
      await runAiAnalysis({ force: true, manualTranscriptOverride: text });
    } finally {
      setIsSavingManualTranscript(false);
    }
  };

  const getMetadataBackedVideo = async (ytId) => {
    if (!ytId) return video;

    let metadata = null;
    if (!shouldFetchVideoMetadata(ytId)) {
      metadata = getCachedVideoMetadata(ytId);
      console.log("[metadata] cache hit", ytId, {
        hasDescription: !!metadata?.description,
        hasDuration: !!metadata?.duration,
        viewCount: metadata?.viewCount ?? null,
      });
    }
    if (metadata && !metadata.duration) {
      metadata = null;
    }
    if (!metadata) {
      metadata = await fetchVideoMetadata(ytId);
      console.log("[metadata] fetched", ytId, metadata || null);
      if (metadata) {
        const cachedDescription = typeof metadata.description === "string" ? metadata.description : "";
        const cachedChapters = extractTimestampsFromDescription(cachedDescription);
        setCachedVideoMetadata(ytId, {
          ...metadata,
          description: cachedDescription,
          chapters: cachedChapters,
        });
      }
    }

    if (!metadata) return video;

    const merged = {
      ...video,
      ...(metadata.description ? { description: metadata.description } : {}),
      ...(metadata.duration ? { duration: metadata.duration } : {}),
      ...(Number.isFinite(metadata.viewCount) ? { viewCount: metadata.viewCount } : {}),
    };
    onVideoPatch?.(merged);
    return merged;
  };

  const legacyHandleAnalyze = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    console.log("[Claude] analyzer selected", { videoId: video.id, force });
    setAnalyzeError(null);
    setAnalysisStage("קורא תמלול");
    try {
      const watchUrl = getWatchUrl(video);
      const ytId = getVideoIdFromUrl(watchUrl);

      let transcriptRaw = null;
      let parsed = null;
      if (typeof video.transcript === "string" && video.transcript.trim().length > 40) {
        transcriptRaw = video.transcript.trim();
        parsed = parseTranscript(transcriptRaw);
      } else if (ytId) {
        transcriptRaw = await fetchTranscript(ytId);
        if (transcriptRaw) parsed = parseTranscript(transcriptRaw);
      }

      const fromTranscript =
        parsed?.lines?.length ? generateChaptersFromTranscript(parsed, video) : null;

      const result = await analyzeVideoWithAI({
        videoId:     video.id,
        title:       video.title,
        description: video.fullSummary || video.shortSummary || "",
        keyPoints:   video.keyPoints || [],
        analysisMode: "golden_reference",
        transcriptStatus: typeof video?.transcriptStatus === "string" ? video.transcriptStatus : undefined,
        transcriptQuality: typeof video?.transcriptQuality === "string" ? video.transcriptQuality : undefined,
      });

      const transcriptToStore =
        transcriptRaw && transcriptRaw.length > 0
          ? transcriptRaw
          : undefined;
      console.log("[transcript] store length", transcriptToStore?.length ?? 0);

      const patch = {
        id: video.id,
        ...result,
        ...(fromTranscript?.length
          ? {
              aiChapters: fromTranscript,
              ...(transcriptToStore ? { transcript: transcriptToStore } : {}),
            }
          : {}),
      };
      const saved = await updateSummary.mutateAsync(patch);

      onVideoPatch?.(saved || { ...video, ...patch });
      onAnalyzeDone?.({
        ...result,
        status: "done",
        ...(fromTranscript?.length ? { aiChapters: fromTranscript } : {}),
      });

      const triedTranscript =
        (typeof video.transcript === "string" && video.transcript.trim().length > 40) || !!ytId;
      if (triedTranscript && !fromTranscript?.length) {
        toast.info("לא נמצא תמלול, הפרקים נוצרו ללא ניווט מדויק");
      }
    } catch (err) {
      const code = err?.code;
      setAnalyzeError(
        code === "QUOTA_ZERO"             ? "ה-API Key אין לו quota פעיל. ניתן להפעיל GEMINI_MOCK=true לבדיקה." :
        code === "GEMINI_API_KEY_MISSING" ? "מפתח ה-API חסר — הוסף GEMINI_API_KEY ב-Base44 → Environment Variables" :
        code === "RATE_LIMIT"            ? "הגעת למגבלת הבקשות — נסה שוב בעוד כמה שניות" :
                                           "הניתוח נכשל — נסה שוב"
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Update chapters navigation WITHOUT AI — no duration fallback.
  const legacyHandleReanalyzeLocal = async () => {
    setIsReanalyzing(true);
    try {
      const descText = typeof video.description === "string" ? video.description : "";
      const descChaptersRaw = descText ? extractTimestampsFromDescription(descText) : [];
      const descChapters = Array.isArray(descChaptersRaw)
        ? descChaptersRaw
            .map((c, idx) => {
              const startSeconds = resolveChapterStartSeconds(c);
              return {
                title: String(c?.title || c?.name || c?.heading || `פרק ${idx + 1}`).trim() || `פרק ${idx + 1}`,
                startSeconds: startSeconds ?? null,
                endSeconds: null,
                summary: "פרק מתוך תיאור הסרטון",
                keyPoints: [],
                timeSource: "real",
              };
            })
            .filter((c) => Number.isFinite(c.startSeconds))
            .sort((a, b) => (a.startSeconds || 0) - (b.startSeconds || 0))
        : [];

      if (descChapters.length >= 2) {
        for (let i = 0; i < descChapters.length - 1; i += 1) {
          const nextStart = descChapters[i + 1]?.startSeconds;
          if (Number.isFinite(nextStart)) descChapters[i].endSeconds = nextStart;
        }
      }

      if (descChapters.length < 2) {
        toast.error("אי אפשר לעדכן ניווט בלי timestamps בתיאור או תמלול. כדי לנתח כמו הסרטון לדוגמה — הדבק תמלול ידני.");
        return;
      }

      const updates = {
        aiChapters: descChapters,
        chapters: descChapters,
        videoTopics: chaptersToVideoTopics(descChapters),
        chapterSource: "description_timestamps",
        analysisQuality: "medium",
        analysisStatus: "chapters_only",
        analysisError: null,
        analyzedAt: new Date().toISOString(),
      };

      const localSaved = patchVideo(updates);
      if (localSaved) {
        onVideoPatch?.(localSaved);
        toast.success("פרקים עודכנו — ניווט אמיתי מהתיאור");
        return;
      }

      try {
        await Video.update(video.id, updates);
        patchVideo(updates);
        queryClient.invalidateQueries({ queryKey: ["videos"] });
        onVideoPatch?.({ ...video, ...updates });
        toast.success("פרקים עודכנו — ניווט אמיתי מהתיאור");
      } catch {
        toast.error("לא ניתן לשמור — נסה שוב");
      }
    } finally {
      setIsReanalyzing(false);
    }
  };

  // תאריך יחסי — "לפני X שעות/ימים", ועבור ישנים: תאריך מלא
  const runAiAnalysis = async ({ force = false, manualTranscriptOverride = null } = {}) => {
    if (isAnalyzing || isReanalyzing) return;

    if (force) setIsReanalyzing(true);
    else setIsAnalyzing(true);

    setAnalyzeError(null);
    console.log("[analyze-button] handler", force ? "reanalyze" : "analyze", video.id);
    console.log("[ai-reanalyze] start", video.id);
    console.log("[analysis] videoId", video.id);
    console.log("[analysis] transcriptStatus", video.transcriptStatus);

    persistAnalysisState({
      analysisStatus: "analyzing",
      analysisError: null,
    });

    try {
      const watchUrl = getWatchUrl(video);
      const ytId = getVideoIdFromUrl(watchUrl);

      const manualTranscriptText =
        typeof manualTranscriptOverride === 'string' && manualTranscriptOverride.trim().length > 40
          ? manualTranscriptOverride.trim()
          : typeof video.manualTranscript === 'string' && video.manualTranscript.trim().length > 40
            ? video.manualTranscript.trim()
            : null;

      let transcriptRaw = null;
      let transcriptPayload = null;
      let isManualTranscript = false;
      let manualHasTimestamps = false;

      if (manualTranscriptText) {
        const parsed = parseManualTranscript(manualTranscriptText);
        transcriptRaw = manualTranscriptText;
        transcriptPayload = { ok: true, body: manualTranscriptText, source: 'manual', language: null, segments: parsed.segments };
        isManualTranscript = true;
        manualHasTimestamps = parsed.hasTimestamps;
        console.log("[manual-transcript] hasTimestamps", manualHasTimestamps, "segments", parsed.segments.length);
      } else {
        transcriptRaw =
          typeof video.transcript === "string" && video.transcript.trim().length > 40
            ? video.transcript.trim()
            : null;
        const storedSegments =
          Array.isArray(video.transcriptSegments) && video.transcriptSegments.length > 0
            ? video.transcriptSegments
            : null;
        transcriptPayload = transcriptRaw
          ? {
              ok: true,
              body: transcriptRaw,
              source: video.transcriptSource || "stored",
              language: video.transcriptLanguage || null,
              segments: storedSegments || parseTranscript(transcriptRaw).lines,
            }
          : null;

        if ((!transcriptPayload?.segments?.length || (transcriptRaw && transcriptRaw.length <= 40)) && ytId) {
          transcriptPayload = await getBestTranscript(ytId);
          transcriptRaw = transcriptPayload?.body || null;
        }
      }

      const transcriptSegments = Array.isArray(transcriptPayload?.segments) ? transcriptPayload.segments : [];
      console.log("[transcript] segments usable", transcriptSegments.length);
      const effectiveTranscriptStatus =
        isManualTranscript
          ? "manual"
          : (transcriptPayload?.transcriptStatus || (transcriptSegments.length > 0 ? "partial" : "none"));
      const effectiveTranscriptQuality =
        isManualTranscript
          ? (manualHasTimestamps ? "high" : "low")
          : transcriptPayload?.transcriptQuality;
      console.log("[transcript] status", effectiveTranscriptStatus);
      const transcriptText = isManualTranscript && !manualHasTimestamps
        ? transcriptRaw
        : transcriptSegments
            .map((line) => `[${Math.floor(line.startSeconds ?? line.start ?? 0)}] ${line.text}`)
            .join("\n");
      console.log("[transcript] full text length", transcriptText?.length ?? 0);

      console.log("[analysis] transcript segments", transcriptSegments.length);
      console.log("[analysis] first segment", transcriptSegments[0] || null);
      console.log("[analysis] last segment", transcriptSegments[transcriptSegments.length - 1] || null);
      console.log("[ai-reanalyze] transcript segments", transcriptSegments.length);
      console.log("[analysis] source", transcriptPayload?.source || (isManualTranscript ? "manual" : "unknown"));
      console.log("[transcript] attempts", transcriptPayload?.diagnostics?.attempts || transcriptPayload?.attempts || []);

      if (!claudeStatus.configured) {
        const message = "Claude לא מוגדר — חסר VITE_ANTHROPIC_API_KEY";
        console.log("[Claude] missing API key");
        persistAnalysisState(clearAiAnalysisFields(message));
        setAnalyzeError(message);
        toast.error(message);
        return;
      }

      if (!transcriptPayload?.ok || transcriptSegments.length === 0) {
        const failureMessage = transcriptPayload?.reason || "לא נמצא תמלול תקין לניתוח AI";

        // Fallback 1: description timestamps → chapters (no AI, no fake summaries)
        const manualTranscriptCta = `${failureMessage} הדבק תמלול ידני כדי לאפשר ניתוח Claude`;

        console.log("[analysis] fallback source", "none");
        console.log("[analysis] fallback chapters", 0);

        persistAnalysisState({
          ...clearAiAnalysisFields(manualTranscriptCta),
          transcriptStatus: transcriptPayload?.transcriptStatus || "unavailable",
          transcriptError: failureMessage,
          analysisProvider: null,
        });
        setAnalyzeError(manualTranscriptCta);
        toast.error(manualTranscriptCta);
        return;

        const descText = typeof video.description === "string" ? video.description : "";
        const descChaptersRaw = descText ? extractTimestampsFromDescription(descText) : [];
        const descChapters = Array.isArray(descChaptersRaw)
          ? descChaptersRaw
              .map((c, idx) => {
                const startSeconds = resolveChapterStartSeconds(c);
                return {
                  title: String(c?.title || c?.name || c?.heading || `פרק ${idx + 1}`).trim() || `פרק ${idx + 1}`,
                  startSeconds: startSeconds ?? null,
                  endSeconds: null, // filled below
                  summary: "פרק מתוך תיאור הסרטון",
                  keyPoints: [],
                  timeSource: "real",
                };
              })
              .filter((c) => Number.isFinite(c.startSeconds))
              .sort((a, b) => (a.startSeconds || 0) - (b.startSeconds || 0))
          : [];

        if (descChapters.length >= 2) {
          // Fill endSeconds as next startSeconds (last stays null)
          for (let i = 0; i < descChapters.length - 1; i += 1) {
            const nextStart = descChapters[i + 1]?.startSeconds;
            if (Number.isFinite(nextStart)) descChapters[i].endSeconds = nextStart;
          }

          const patch = {
            id: video.id,
            aiChapters: descChapters,
            chapters: descChapters,
            videoTopics: chaptersToVideoTopics(descChapters),
            chapterSource: "description_timestamps",
            analysisQuality: "medium",
            analysisProvider: "local_fallback",
            analysisStatus: "chapters_only",
            analysisError: null,
            transcriptStatus: "description_timestamps",
            transcriptError: failureMessage,
            analyzedAt: new Date().toISOString(),
            _fullVideo: video,
          };

          console.log("[analysis] fallback source", "description_timestamps");
          console.log("[analysis] transcript length", 0);
          console.log("[analysis] chapters count", descChapters.length);

          const saved = await updateSummary.mutateAsync(patch);
          const nextVideo = saved || { ...video, ...patch };
          onVideoPatch?.(nextVideo);
          onAnalyzeDone?.(nextVideo);
          toast.success("נוצרו פרקים מתוך תיאור הסרטון (ללא תמלול)");
          return;
        }

        // Fallback 2: native chapters already stored on video (only if seekable)
        const native = Array.isArray(video.chapters) ? video.chapters : Array.isArray(video.aiChapters) ? video.aiChapters : [];
        const nativeSeekable = native
          .map((c, idx) => ({
            title: String(c?.title || c?.name || `פרק ${idx + 1}`).trim() || `פרק ${idx + 1}`,
            startSeconds: Number.isFinite(c?.startSeconds) ? c.startSeconds : Number.isFinite(c?.timestampSeconds) ? c.timestampSeconds : null,
            endSeconds: Number.isFinite(c?.endSeconds) ? c.endSeconds : null,
            summary: String(c?.summary || c?.description || "").trim() || "פרק מתוך חלוקת YouTube",
            keyPoints: Array.isArray(c?.keyPoints) ? c.keyPoints : [],
            timeSource: c?.timeSource || "real",
          }))
          .filter((c) => Number.isFinite(c.startSeconds))
          .sort((a, b) => (a.startSeconds || 0) - (b.startSeconds || 0));

        if (nativeSeekable.length >= 2) {
          for (let i = 0; i < nativeSeekable.length - 1; i += 1) {
            if (nativeSeekable[i].endSeconds == null && Number.isFinite(nativeSeekable[i + 1]?.startSeconds)) {
              nativeSeekable[i].endSeconds = nativeSeekable[i + 1].startSeconds;
            }
          }

          const patch = {
            id: video.id,
            aiChapters: nativeSeekable,
            chapters: nativeSeekable,
            videoTopics: chaptersToVideoTopics(nativeSeekable),
            chapterSource: "native_chapters",
            analysisQuality: "medium",
            analysisProvider: "local_fallback",
            analysisStatus: "chapters_only",
            analysisError: null,
            transcriptStatus: "native_chapters",
            transcriptError: failureMessage,
            analyzedAt: new Date().toISOString(),
            _fullVideo: video,
          };

          console.log("[analysis] fallback source", "native_chapters");
          console.log("[analysis] transcript length", 0);
          console.log("[analysis] chapters count", nativeSeekable.length);

          const saved = await updateSummary.mutateAsync(patch);
          const nextVideo = saved || { ...video, ...patch };
          onVideoPatch?.(nextVideo);
          onAnalyzeDone?.(nextVideo);
          toast.success("נמצאו פרקים קיימים (ללא תמלול)");
          return;
        }

        persistAnalysisState({
          analysisStatus: "error",
          analysisError: failureMessage,
          transcriptStatus: transcriptPayload?.transcriptStatus || "unavailable",
          transcriptError: failureMessage,
        });
        setAnalyzeError(failureMessage);
        toast.error(failureMessage);
        return;
      }

      setAnalysisStage("שולח ל־Claude");
      toast.info("מנתח עם Claude...");
      const ai = await analyzeVideoWithProvider({
        videoId: video.id,
        title: video.title,
        transcript: transcriptText,
        durationSeconds: getVideoDurationSeconds(video),
        mentor: mentorName || null,
        category: null,
        transcriptStatus: effectiveTranscriptStatus,
        transcriptQuality: effectiveTranscriptQuality,
        analysisMode: "golden_reference",
      });
      const result = ai.raw;
      setAnalysisStage("בונה פרקים וסיכום");

      console.log("[ai-reanalyze] raw result", result);

      const normalized = validateAiAnalysisQuality(result);
      const normalizedChapters = isManualTranscript && !manualHasTimestamps
        ? normalizeManualChapters(normalized.chapters)
        : normalizeTranscriptBackedChapters(normalized.chapters, transcriptSegments);
      console.log("[ai-reanalyze] chapters", normalizedChapters.length);

      const videoDurationSeconds = getVideoDurationSeconds(video);
      const enforceCoverage75 = (chapters) => {
        const list = Array.isArray(chapters) ? chapters : [];
        if (list.length === 0) return list;
        if (!Number.isFinite(videoDurationSeconds) || videoDurationSeconds <= 0) return list;
        const last = list[list.length - 1];
        const lastEnd = Number.isFinite(last?.endSeconds) ? last.endSeconds : (Number.isFinite(last?.startSeconds) ? last.startSeconds : 0);
        if (lastEnd >= 0.75 * videoDurationSeconds) return list;
        const next = [...list];
        next[next.length - 1] = { ...last, endSeconds: Math.floor(videoDurationSeconds) };
        return next;
      };

      const validateForSave = (candidateChapters, { allowGenericTitles } = {}) =>
        validateChaptersForSave(candidateChapters, {
          minChapters: 3,
          minSummaryChars: 20,
          requireKeyPoints: true,
          allowNullEndSecondsForLast: true,
          maxGenericTitleRatio: allowGenericTitles ? 1 : 0.3,
        });

      // 1) fix generic titles using transcript chunk text
      let chaptersCandidate = retitleGenericChapters(normalizedChapters, { transcriptSegments });
      chaptersCandidate = enforceCoverage75(chaptersCandidate);
      let chaptersValidation = validateForSave(chaptersCandidate, { allowGenericTitles: false });

      const hasGenericTitleIssue = !normalized.isValid || String(chaptersValidation.reason || "").includes("כותרות");
      if (isManualTranscript && hasGenericTitleIssue) {
        // Manual transcript: do not fail analysis on generic titles.
        // If still bad: generate topic-ish chapters from manual text (no timestamps) using keywords.
        if (!chaptersValidation.ok && !manualHasTimestamps) {
          const generated = splitPlainTranscriptToChapters(transcriptRaw, videoDurationSeconds);
          const generatedFixed = enforceCoverage75(generated);
          chaptersValidation = validateForSave(generatedFixed, { allowGenericTitles: false });
        }
        if (!chaptersValidation.ok) {
          // last resort: allow saving, but keep it non-blocking and warn user.
          chaptersValidation = validateForSave(chaptersCandidate, { allowGenericTitles: true });
        } else {
          chaptersValidation = validateForSave(chaptersValidation.chapters, { allowGenericTitles: true });
        }
        toast.success("הניתוח הושלם. ניתן לערוך כותרות ידנית.");
      }

      if (!chaptersValidation.ok) {
        const message = `הניתוח נכשל: ${chaptersValidation.reason || "פרקים לא תקינים"}`;
        persistAnalysisState(clearAiAnalysisFields(message));
        setAnalyzeError(message);
        toast.error(message);
        return;
      }

      const chaptersToSave = chaptersValidation.chapters;
      console.log("[analysis] chapters count", chaptersToSave.length);

      const transcriptToStore =
        !isManualTranscript && transcriptRaw && transcriptRaw.length > 0
          ? transcriptRaw
          : undefined;
      console.log("[transcript] store length", transcriptToStore?.length ?? 0);

      const analysisVersion = Number(video.analysisVersion || 0) + 1;
      const patch = {
        id: video.id,
        shortSummary: normalized.shortSummary,
        fullSummary: normalized.fullSummary,
        keyPoints: normalized.keyPoints,
        tags: normalized.tags,
        aiSummaryShort: normalized.shortSummary,
        aiSummaryLong: normalized.fullSummary,
        aiChapters: chaptersToSave,
        chapters: chaptersToSave,
        videoTopics: chaptersToVideoTopics(chaptersToSave),
        keyInsights: normalized.keyInsights,
        actionItems: normalized.actionItems,
        mainLesson: normalized.mainLesson,
        strategyOrMethod: normalized.strategyOrMethod,
        rules: normalized.rules,
        mistakesToAvoid: normalized.mistakesToAvoid,
        chapterSource: isManualTranscript ? 'manual_transcript' : 'transcript',
        analysisQuality: calculateAnalysisQuality({
          transcriptText,
          transcriptSegments,
          chapters: chaptersToSave,
          analysisProvider: ai.provider || "claude",
          analysisStatus: "completed",
          transcriptStatus: effectiveTranscriptStatus,
          fallbackUsed: false,
          claudeCompleted: (ai.provider || "claude") === "claude",
        }),
        analysisProvider: ai.provider || "claude",
        transcriptSource: isManualTranscript ? "manual" : (transcriptPayload?.source || "youtube"),
        transcriptStatus: effectiveTranscriptStatus,
        transcriptQuality: effectiveTranscriptQuality,
        transcriptError: null,
        analysisStatus: "completed",
        analysisError: null,
        analyzedAt: new Date().toISOString(),
        analysisVersion,
        ...(transcriptToStore ? { transcript: transcriptToStore } : {}),
        brainSummary: normalized.brainSummary || null,
        _fullVideo: video,
      };

      const saved = await updateSummary.mutateAsync(patch);
      const nextVideo = saved || { ...video, ...patch };

      setVideoState(nextVideo);

      // Auto-save analysis on every successful completion
      const snapshot = buildAnalysisSnapshot(nextVideo);
      saveSavedAnalysis(video.id, snapshot);
      setSavedAnalysisMeta(extractSavedAnalysisMeta({
        analysisProvider: nextVideo.analysisProvider || null,
        analysisSavedAt: snapshot.analysisSavedAt,
      }));

      onVideoPatch?.(nextVideo);
      onAnalyzeDone?.(nextVideo);
      console.log("[ai-reanalyze] saved", video.id);
      toast.success("הניתוח הושלם בהצלחה");
    } catch (err) {
      const code = err?.code;
      // Log raw error for debugging — never show raw err.message in toast
      console.error("[Claude] analysis error", { code, message: err?.message });
      const claudeMessage =
        code === "CLAUDE_API_KEY_MISSING"
          ? "מפתח Claude חסר — הוסף ANTHROPIC_API_KEY או VITE_ANTHROPIC_API_KEY ב־Environment Variables."
          : code === "TRANSCRIPT_REQUIRED"
            ? "לא נמצא תמלול תקין לניתוח AI"
            : code === "CLAUDE_ERROR" || !code
              ? "ניתוח Claude נכשל — בדוק שה-API key תקין ונסה שוב"
              : null;
      if (claudeMessage) {
        persistAnalysisState({
          ...clearAiAnalysisFields(claudeMessage),
          analysisQuality: "weak",
        });
        setAnalyzeError(claudeMessage);
        toast.error(claudeMessage);
        return;
      }
      const message =
        code === "QUOTA_ZERO"            ? "ה-API Key נגמרה ה-quota שלו. אפשר להפעיל GEMINI_MOCK=true לבדיקה." :
        code === "GEMINI_API_KEY_MISSING" ? "מפתח ה-API חסר — הוסף GEMINI_API_KEY ב-Environment Variables" :
        code === "RATE_LIMIT"            ? "הגעת למגבלות הבקשות — נסה שוב בעוד כמה שניות" :
        "הניתוח נכשל — נסה שוב";
      persistAnalysisState({
        ...clearAiAnalysisFields(message),
        analysisQuality: "weak",
      });
      setAnalyzeError(message);
      toast.error(message);
    } finally {
      setAnalysisStage(null);
      setIsAnalyzing(false);
      setIsReanalyzing(false);
    }
  };

  const handleAnalyze = async () => {
    const ytId = getVideoIdFromUrl(getWatchUrl(video));
    const disabledReason =
      isAnalyzing || isReanalyzing
        ? "כבר מנתח"
        : !ytId && !(typeof video?.manualTranscript === "string" && video.manualTranscript.trim().length > 40)
          ? "חסר videoId"
          : null;
    console.log("[analyze-button] clicked", video.id);
    console.log("[analyze-button] disabled?", disabledReason);
    console.log("[analyze-button] source", typeof video?.manualTranscript === "string" && video.manualTranscript.trim().length > 40 ? "manualTranscript" : "youtube");

    // Even when there's no transcript, we still want to respond with a clear message.
    if (disabledReason) {
      toast.error(disabledReason === "כבר מנתח" ? "כבר מתבצע ניתוח" : "חסר videoId — לא ניתן לנתח");
      return;
    }
    // Quality gate: pause on first click if transcript quality is known to be low
    if (video.transcriptQuality === "low" && !showLowQualityWarning) {
      setShowLowQualityWarning(true);
      return;
    }
    setShowLowQualityWarning(false);
    await runAiAnalysis({ force: false });
  };

  const handleReanalyzeLocal = async () => {
    await legacyHandleReanalyzeLocal();
  };

  const relativeDate = (() => {
    if (!video.publishedAt) return null;
    try {
      const date    = new Date(video.publishedAt);
      const diffMs  = Date.now() - date.getTime();
      const hours   = diffMs / (1000 * 60 * 60);
      const days    = diffMs / (1000 * 60 * 60 * 24);
      if (hours  <  1) return "לפני פחות משעה";
      if (hours  < 24) return `לפני ${Math.floor(hours)} שעות`;
      if (days   <  2) return "אתמול";
      if (days   <  7) return `לפני ${Math.floor(days)} ימים`;
      if (days   < 30) return `לפני ${Math.floor(days / 7)} שבועות`;
      return format(date, "d MMMM yyyy", { locale: he });
    } catch { return null; }
  })();

  const viewCountFormatted = (() => {
    const n = video.viewCount ?? video.statistics?.viewCount ?? video.metadata?.viewCount;
    if (!n) return null;
    if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M צפיות`;
    if (n >= 1_000)     return `${+(n / 1_000).toFixed(1)}K צפיות`;
    return `${n} צפיות`;
  })();

  const videoDuration = formatVideoDuration(
    video.duration ??
    video.durationSeconds ??
    video.videoDuration ??
    video.metadata?.duration
  );
  const videoDateLabel = video.publishedAt ? format(new Date(video.publishedAt), "d MMMM yyyy", { locale: he }) : null;
  const videoMentorLabel = mentorName && mentorName !== "לא ידוע" ? mentorName : null;
  const videoCategoryLabel = typeof video.category === "string" && video.category.trim() ? video.category.trim() : null;
  const metadataItems = [
    videoDuration,
    viewCountFormatted,
  ].filter(Boolean);
  const hasManualTranscript = typeof video.manualTranscript === 'string' && video.manualTranscript.trim().length > 40;
  const videoYtId = getVideoIdFromUrl(getWatchUrl(video));
  const handleOpenYoutube = () => {
    if (videoYtId) window.open(`https://www.youtube.com/watch?v=${videoYtId}`, '_blank');
  };
  const handleYtApiTranscript = async () => {
    const ytId = getVideoIdFromUrl(getWatchUrl(video));
    if (!ytId) {
      toast.error("לא ניתן לזהות videoId לסרטון הזה");
      return;
    }
    setIsFetchingYtApiTranscript(true);
    console.log("[transcript] fetching via proxy ytId=" + ytId);
    try {
      // Uses GET /api/youtube-transcript?v=<ytId> — the correct endpoint
      const payload = await fetchTranscriptPayload(ytId);
      console.log("[transcript-handler] payload=", {
        ok: payload !== null,
        bodyLen: typeof payload?.body === "string" ? payload.body.length : "N/A",
        lang: payload?.lang ?? "N/A",
        segmentsCount: Array.isArray(payload?.segments) ? payload.segments.length : "N/A",
        fetchedAt: payload?.fetchedAt ?? "N/A",
        firstSegment: Array.isArray(payload?.segments) && payload.segments.length > 0 ? payload.segments[0] : null,
      });
      const segments = Array.isArray(payload?.segments) ? payload.segments : [];
      const body = typeof payload?.body === "string" ? payload.body : "";

      if (!segments.length && body.length < 40) {
        const reason = "לא נמצא תמלול זמין דרך YouTube";
        console.log("[transcript] unavailable reason=empty-payload");
        setAnalyzeError(reason);
        toast.error(reason);
        return;
      }

      const qualityResult = (() => {
        try { return validateTranscriptUsable({ segments }); } catch { return {}; }
      })();

      const patch = {
        transcript: body,
        transcriptSegments: segments,
        transcriptSource: "youtube-timedtext",
        transcriptLanguage: payload?.lang || null,
        transcriptStatus: "youtube",
        transcriptQuality: qualityResult.transcriptQuality || "low",
        transcriptError: null,
      };

      persistAnalysisState(patch);
      console.log("[transcript] success lang=" + (payload?.lang || "?") + " segments=" + segments.length);
      setAnalyzeError(null);
      toast.success("תמלול נשמר בהצלחה");
    } catch (error) {
      const reason = error?.message || "שגיאת רשת בעת משיכת תמלול";
      toast.error(reason);
      setAnalyzeError(reason);
    } finally {
      setIsFetchingYtApiTranscript(false);
    }
  };

  const handleDeleteTranscript = () => {
    persistAnalysisState({
      transcript: null,
      transcriptSegments: null,
      transcriptSource: null,
      transcriptLanguage: null,
      transcriptStatus: "unavailable",
      transcriptError: null,
    });
    toast.success("התמלול נמחק");
  };

  const handleGeminiContent = async () => {
    console.log("[Gemini] content fetch clicked", video.id);
    setGeminiStatus("loading");
    setGeminiMessage(null);
    console.log("[Gemini] request started", video.id);

    try {
      const chapterHints = resolveVideoChapters(video || {});
      const result = await fetchGeminiVideoContent({
        videoId: video.id,
        title: video.title,
        description: typeof video.description === "string" ? video.description : "",
        durationSeconds: getVideoDurationSeconds(video),
        mentor: mentorName || null,
        category: video.category || null,
        chapterHints,
      });

      const transcriptText = typeof result?.transcriptText === "string" ? result.transcriptText.trim() : "";
      const parsed = parseManualTranscript(transcriptText);
      const transcriptSegments = Array.isArray(parsed?.segments) ? parsed.segments : [];
      const usableLength = transcriptText.length;

      if (!transcriptText || usableLength < 80) {
        throw new Error("Gemini לא החזיר טקסט usable לסרטון הזה");
      }

      persistAnalysisState({
        transcript: transcriptText,
        transcriptSegments,
        transcriptSource: "gemini",
        transcriptLanguage: result?.language || "he",
        transcriptStatus: "gemini",
        transcriptError: null,
      });

      setAnalyzeError(null);
      setGeminiStatus("success");
      setGeminiMessage("Gemini הביא תוכן usable מהסרטון. אפשר עכשיו לנתח עם Claude.");
      console.log("[Gemini] request completed", {
        length: usableLength,
        segments: transcriptSegments.length,
      });
      toast.success("תוכן מהסרטון נשמר דרך Gemini");
    } catch (error) {
      const code = error?.code;
      const message =
        code === "GEMINI_API_KEY_MISSING" || code === "INVALID_KEY"
          ? "Gemini לא מוגדר — חסר או לא תקין API key"
          : error?.message || "Gemini לא הצליח להביא תוכן usable מהסרטון";
      setGeminiStatus("failed");
      setGeminiMessage(message);
      console.error("[Gemini] request failed", message);
      toast.error(message);
    }
  };
  const chapterSourceBadge =
    chapterSourceInfo.source === "manual_transcript"
      ? "ניתוח מבוסס תמלול ידני"
      : chapterSourceInfo.source === "transcript"
        ? "מבוסס תמלול"
        : chapterSourceInfo.source === "description_timestamp"
          ? "מבוסס פרקי YouTube/תיאור"
          : null;
  const chapterSourceBadgeClass =
    "bg-blue-50 text-blue-700 border-blue-200";
  const storedTranscriptSegments =
    Array.isArray(video.transcriptSegments) && video.transcriptSegments.length > 0
      ? video.transcriptSegments
      : typeof video.transcript === "string" && video.transcript.trim().length > 0
        ? parseTranscript(video.transcript).lines
        : typeof video.manualTranscript === "string" && video.manualTranscript.trim().length > 0
          ? parseManualTranscript(video.manualTranscript).segments
          : [];
  const transcriptTextLength =
    typeof video.transcript === "string" ? video.transcript.trim().length
    : typeof video.manualTranscript === "string" ? video.manualTranscript.trim().length
    : 0;
  const hasStoredTranscript = storedTranscriptSegments.length > 0 || transcriptTextLength > 100;
  const transcriptSourceLabel =
    video.transcriptSource === "youtube-transcript-api" ? "youtube-transcript-api"
    : video.transcriptSource === "youtube-timedtext" ? "YouTube"
    : video.transcriptStatus === "manual" ? "ידני"
    : video.transcriptStatus === "gemini" ? "Gemini"
    : video.transcriptStatus === "youtube" ? "YouTube"
    : null;
  const fullTranscriptText =
    typeof video.transcript === "string" && video.transcript.trim().length > 40
      ? video.transcript.trim()
      : typeof video.manualTranscript === "string" && video.manualTranscript.trim().length > 40
        ? video.manualTranscript.trim()
        : storedTranscriptSegments.length > 0
          ? storedTranscriptSegments.map(s => s.text || '').join(' ')
          : "";
  const transcriptWordCount = fullTranscriptText ? fullTranscriptText.split(/\s+/).filter(Boolean).length : 0;

  // Regular function (not useCallback) — avoids React hooks-after-return violation
  const handleQuickCopy = async (action) => {
    if (!fullTranscriptText) {
      toast.error("אין תמלול זמין לשליחה");
      return;
    }
    const prompt = action.buildPrompt({
      title: video?.title || '',
      duration: videoDuration || '',
      transcript: fullTranscriptText,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success(action.toastMsg);
    } catch {
      toast.error("לא ניתן לגשת ללוח");
    }
    // Resolve Gem URL from flow field (e.g. 'gem-political' → getGemUrl('political'))
    const gemKey = action.flow ? action.flow.replace('gem-', '') : null;
    const gemUrl = gemKey ? getGemUrl(gemKey) : (action.url || null);
    if (gemUrl) {
      openGeminiGemUrl(gemUrl);
    } else if (gemKey) {
      toast.info(`Gem "${action.label.replace('Gemini ', '')}" לא מוגדר — הגדר URL בהגדרות Gems`);
    }
  };
  const qualityChapters = resolveVideoChapters(video || {});
  const qualityFallbackUsed = Boolean(
    chapterSourceInfo.source &&
    chapterSourceInfo.source !== "transcript" &&
    chapterSourceInfo.source !== "manual_transcript"
  );
  const derivedAnalysisQuality = calculateAnalysisQuality({
    transcriptText: typeof video.transcript === "string" ? video.transcript : typeof video.manualTranscript === "string" ? video.manualTranscript : "",
    transcriptSegments: storedTranscriptSegments,
    chapters: qualityChapters,
    analysisProvider: video.analysisProvider || (qualityFallbackUsed ? "local_fallback" : "claude"),
    analysisStatus: video.analysisStatus || null,
    transcriptStatus: video.transcriptStatus || null,
    fallbackUsed: qualityFallbackUsed,
    claudeCompleted: video.analysisProvider === "claude" && video.analysisStatus === "completed",
  });
  const analysisQualityValue = video.analysisQuality || derivedAnalysisQuality;
  const analysisQualityUi = getAnalysisQualityUi(analysisQualityValue);
  const analysisProviderLabel =
    video.chapterSource === "manual_transcript" ? "תמלול ידני"
    : video.analysisProvider === "claude" ? "Claude AI"
    : video.analysisProvider === "local_fallback" ? "ניתוח מקומי"
    : video.analysisProvider ? video.analysisProvider
    : "—";
  const analysisQualityExplanation = buildAnalysisQualityExplanation({
    quality: analysisQualityValue,
    analysisProvider: video.analysisProvider || (qualityFallbackUsed ? "local_fallback" : "claude"),
    transcriptText: typeof video.transcript === "string" ? video.transcript : typeof video.manualTranscript === "string" ? video.manualTranscript : "",
    transcriptSegments: storedTranscriptSegments,
    chapters: qualityChapters,
    analysisStatus: video.analysisStatus || null,
    timestampsDetected: storedTranscriptSegments.some((segment) => Number.isFinite(Number(segment?.startSeconds ?? segment?.start))),
    fallbackUsed: qualityFallbackUsed,
    claudeCompleted: video.analysisProvider === "claude" && video.analysisStatus === "completed",
  });
  const aiRequiresTranscript =
    !hasManualTranscript &&
    chapterSourceInfo.source !== "transcript" &&
    chapterSourceInfo.source !== "manual_transcript" &&
    (String(video.transcriptStatus || "").trim() === "" ||
      ["none", "found_empty_body", "no_caption_tracks", "unavailable", "missing_timestamps", "too_short"].includes(video.transcriptStatus || ""));
  const claudeMissingMessage = !claudeStatus.configured
    ? "Claude לא מוגדר — חסר VITE_ANTHROPIC_API_KEY"
    : null;
  const isClaudeAnalysisRunning = isAnalyzing || isReanalyzing;
  const analysisStageLabel = analysisStage || "קורא תמלול";

  const videoTopics = (video.topicIds || [])
    .map((id) => topics.find((t) => t.id === id))
    .filter(Boolean);

  const handleOpenInWorkspace = () => {
    console.log("[Workspace CTA] clicked", {
      hasNavigateTo: !!navigateTo,
      topicIds: video.topicIds,
      obsidianTopic: video.obsidianTopic,
      topicsLoaded: topics.length,
    });

    if (!navigateTo) {
      toast.error("ניווט ל-Workspace לא זמין");
      return;
    }

    const closeAndNavigate = (page, params) => {
      onOpenChange(false);
      toast.success("עובר ל-Workspace...", { duration: 1500 });
      setTimeout(() => navigateTo(page, params), 80);
    };

    // Priority 1: structured topicIds linked to real topic objects
    if (video.topicIds?.length) {
      console.log("[Workspace CTA] → topicId:", video.topicIds[0]);
      try { upsertKnowledgeItem(createKnowledgeItemFromVideo(video, video.topicIds[0])); } catch {}
      closeAndNavigate("TopicKnowledgePage", { topicId: video.topicIds[0] });
      return;
    }

    // Priority 2: obsidianTopic name → match against topics list
    if (video.obsidianTopic) {
      const match = topics.find((t) => t.name?.toLowerCase() === video.obsidianTopic.toLowerCase());
      if (match) {
        console.log("[Workspace CTA] → obsidianTopic match:", match.id);
        try { upsertKnowledgeItem(createKnowledgeItemFromVideo(video, match.id)); } catch {}
        closeAndNavigate("TopicKnowledgePage", { topicId: match.id });
        return;
      }
    }

    // Priority 3: auto-resolved topic name → match against topics list
    const primaryTopicName = resolvePrimaryTopic(video);
    if (primaryTopicName) {
      const match = topics.find((t) => t.name?.toLowerCase() === primaryTopicName.toLowerCase());
      if (match) {
        console.log("[Workspace CTA] → primaryTopic match:", match.id);
        try { upsertKnowledgeItem(createKnowledgeItemFromVideo(video, match.id)); } catch {}
        closeAndNavigate("TopicKnowledgePage", { topicId: match.id });
        return;
      }
    }

    // No topic found → land on Workspace with a hint
    console.log("[Workspace CTA] → no topic match, going to Workspace root");
    try { upsertKnowledgeItem(createKnowledgeItemFromVideo(video, null)); } catch {}
    closeAndNavigate("Workspace", { hint: "choose-topic" });
  };

  const handleCopyLink = async () => {
    const fallbackUrl =
      typeof window !== "undefined" ? window.location.href : "";
    const urlToCopy = getWatchUrl(video) || fallbackUrl;

    if (!urlToCopy) {
      toast.error("לא נמצא קישור להעתקה");
      return;
    }

    try {
      await navigator.clipboard.writeText(urlToCopy);
      toast.success("הקישור הועתק");
    } catch {
      toast.error("לא ניתן היה להעתיק את הקישור");
    }
  };

  const findGoldenExample = () => {
    setGoldenFindError(null);
    try {
      const all = loadVideos();
      const needleA = "חצי קאש חצי סטוק";
      const needleB = "ההופעה שזעזעה את וול סטריט";
      const match = all.find((v) => {
        const t = String(v?.title || "").toLowerCase();
        return t.includes(needleA.toLowerCase()) || t.includes(needleB.toLowerCase());
      });
      if (!match) {
        setGoldenExample(null);
        setGoldenFindError("לא נמצא סרטון דוגמה זהב ב-localStorage");
        return;
      }
      setGoldenExample(match);
    } catch (e) {
      setGoldenExample(null);
      setGoldenFindError(e?.message || "שגיאה בחיפוש דוגמה זהב");
    }
  };

  const getVideoDna = (v) => {
    const safe = v || {};
    const rawTranscript = typeof safe.transcript === "string" ? safe.transcript : "";
    const manualTranscript = typeof safe.manualTranscript === "string" ? safe.manualTranscript : "";
    const whisperTranscript = typeof safe.whisperTranscript === "string" ? safe.whisperTranscript : "";
    const manualExists = manualTranscript.trim().length > 0;
    const whisperExists = whisperTranscript.trim().length > 0;
    const transcriptLength = manualExists
      ? manualTranscript.trim().length
      : whisperExists
        ? whisperTranscript.trim().length
        : rawTranscript.trim().length;
    const chapters =
      Array.isArray(safe.aiChapters) && safe.aiChapters.length > 0
        ? safe.aiChapters
        : Array.isArray(safe.chapters)
          ? safe.chapters
          : [];
    return {
      title: safe.title || "—",
      videoId: String(safe.videoId || safe.id || "—"),
      transcriptSource: String(safe.transcriptSource || "—"),
      transcriptStatus: String(safe.transcriptStatus || "—"),
      manualTranscript: manualExists,
      whisperTranscript: whisperExists,
      transcriptLength,
      chaptersCount: Array.isArray(chapters) ? chapters.length : 0,
      chapterSource: String(safe.chapterSource || "—"),
      analysisMode: String(safe.analysisMode || "—"),
      analysisQuality: String(safe.analysisQuality || "—"),
      firstChapter: (Array.isArray(chapters) && chapters.length > 0) ? chapters[0] : null,
      lastChapter: (Array.isArray(chapters) && chapters.length > 0) ? chapters[chapters.length - 1] : null,
    };
  };

  const getCellTone = ({ value, refValue, kind }) => {
    // returns "ok" | "warn" | "bad"
    if (kind === "bool") {
      const v = Boolean(value);
      const r = Boolean(refValue);
      if (r && !v) return "bad";      // golden has it, current missing
      if (!r && !v) return "ok";      // both don't have it
      if (r && v) return "ok";        // both have it
      return "warn";                  // current has it but golden doesn't
    }
    if (kind === "number") {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return "bad";
      if (n < 250) return "warn";
      return "ok";
    }
    if (kind === "count") {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return "bad";
      if (n === 1) return "warn";
      return "ok";
    }
    if (kind === "chapter") {
      return value ? "ok" : "bad";
    }
    // string-ish
    const s = String(value ?? "").trim();
    const rs = String(refValue ?? "").trim();
    if (!s || s === "—") return "bad";
    if (rs && s === rs) return "ok";
    return "warn";
  };

  const toneClass = (tone) => {
    if (tone === "ok") return "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-900/60";
    if (tone === "warn") return "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900/60";
    return "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/30 dark:text-rose-200 dark:border-rose-900/60";
  };

  const renderCompareTable = (currentVideo, goldenVideo) => {
    if (!currentVideo || !goldenVideo) return null;
    const current = getVideoDna(currentVideo);
    const golden = getVideoDna(goldenVideo);

    const rows = [
      { key: "title", label: "title", kind: "string" },
      { key: "videoId", label: "videoId", kind: "string" },
      { key: "transcriptSource", label: "transcriptSource", kind: "string" },
      { key: "transcriptStatus", label: "transcriptStatus", kind: "string" },
      { key: "manualTranscript", label: "manualTranscript", kind: "bool" },
      { key: "whisperTranscript", label: "whisperTranscript", kind: "bool" },
      { key: "transcriptLength", label: "transcript length", kind: "number" },
      { key: "chaptersCount", label: "chapters count", kind: "count" },
      { key: "chapterSource", label: "chapterSource", kind: "string" },
      { key: "analysisMode", label: "analysisMode", kind: "string" },
      { key: "analysisQuality", label: "analysisQuality", kind: "string" },
      { key: "firstChapter", label: "first chapter", kind: "chapter" },
      { key: "lastChapter", label: "last chapter", kind: "chapter" },
    ];

    const formatValue = (k, v) => {
      if (k === "manualTranscript" || k === "whisperTranscript") return v ? "כן" : "לא";
      if (k === "firstChapter" || k === "lastChapter") return v ? "קיים" : "חסר";
      return String(v ?? "—");
    };

    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid grid-cols-3 gap-2 text-[11px] font-semibold text-slate-700 dark:text-zinc-200">
          <div className="text-slate-500 dark:text-zinc-400">שדה</div>
          <div className="text-right">סרטון נוכחי</div>
          <div className="text-right">דוגמה זהב</div>
        </div>

        <div className="mt-2 space-y-1">
          {rows.map((r) => {
            const curVal = current[r.key];
            const refVal = golden[r.key];
            const curTone = getCellTone({ value: curVal, refValue: refVal, kind: r.kind });
            const refTone = getCellTone({ value: refVal, refValue: refVal, kind: r.kind });
            return (
              <div key={r.key} className="grid grid-cols-3 gap-2 items-start">
                <div className="py-1 text-slate-500 dark:text-zinc-400">{r.label}</div>
                <div className={`rounded-lg border px-2 py-1 text-right ${toneClass(curTone)}`}>
                  {formatValue(r.key, curVal)}
                </div>
                <div className={`rounded-lg border px-2 py-1 text-right ${toneClass(refTone)}`}>
                  {formatValue(r.key, refVal)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">current: first/last</div>
            <pre className="mt-1 whitespace-pre-wrap break-words text-[11px] text-slate-700 dark:text-zinc-200">{JSON.stringify({ first: current.firstChapter, last: current.lastChapter }, null, 2)}</pre>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">golden: first/last</div>
            <pre className="mt-1 whitespace-pre-wrap break-words text-[11px] text-slate-700 dark:text-zinc-200">{JSON.stringify({ first: golden.firstChapter, last: golden.lastChapter }, null, 2)}</pre>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className={`${isDark ? "dark " : ""}max-w-[96vw] w-[96vw] h-[94vh] p-0 overflow-hidden flex flex-col gap-0 bg-white text-slate-900 dark:bg-zinc-950 dark:text-zinc-100`}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{video?.title || "פרטי סרטון"}</DialogTitle>
          <DialogDescription>
            צפייה בפרטי הסרטון, סיכום, פרקים, נקודות מפתח והערות.
          </DialogDescription>
        </DialogHeader>
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3 left-3 z-50 p-1.5 rounded-full bg-white/85 shadow-sm transition-colors text-slate-600 hover:bg-slate-100 dark:bg-zinc-900/85 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <X className="h-4 w-4" />
        </button>
        {toggleTheme && (
          <button
            onClick={toggleTheme}
            className="absolute top-3 left-14 z-50 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900/85 dark:text-zinc-200 dark:hover:bg-zinc-800"
            title={isDark ? "עבור למצב בהיר" : "עבור למצב כהה"}
          >
            {isDark ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5" />}
            <span>{isDark ? "מצב בהיר" : "מצב כהה"}</span>
          </button>
        )}

        <ScrollArea className="flex-1">
          <div className="w-full px-5 py-6 space-y-5 bg-white text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">

            {isDev && (
              <div className="hidden rounded-xl border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-800 dark:text-zinc-100">Debug (DEV)</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDebug((v) => !v)}
                      className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      {showDebug ? "הסתר Debug" : "הצג Debug"}
                    </button>
                    {showDebug && (
                      <button
                        type="button"
                        onClick={findGoldenExample}
                        className="text-xs px-2.5 py-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600"
                      >
                        מצא דוגמה זהב
                      </button>
                    )}
                  </div>
                </div>

                {showDebug && (
                  <>
                    {goldenFindError && (
                      <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 dark:bg-amber-950/30 dark:border-amber-900/60 dark:text-amber-200">
                        {goldenFindError}
                      </div>
                    )}
                    {goldenExample && renderCompareTable(video, goldenExample)}
                  </>
                )}
              </div>
            )}

            {/* ── Thumbnail ── */}
            <div className="grid w-full items-stretch gap-4 xl:grid-cols-4 md:grid-cols-2" dir="rtl">
              <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 text-right flex flex-col" dir="rtl">
                <div className="border-b border-slate-100 dark:border-zinc-800 pb-2 mb-2" dir="rtl">
                  <div className="text-right text-lg font-bold text-slate-900 dark:text-white">פרטי וידאו</div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-zinc-800" dir="rtl">
                  {[
                    { label: "ערוץ",          value: videoMentorLabel,                                                mono: false },
                    { label: "נושא",           value: videoTopics[0]?.name || null,                                  mono: false },
                    { label: "תת-נושא",        value: subCategoryOverride ?? video.subCategory ?? null,               mono: false },
                    { label: "קטגוריה",        value: videoCategoryLabel,                                             mono: false },
                    { label: "תאריך פרסום",    value: video.publishedAt ? format(new Date(video.publishedAt), "dd/MM/yyyy", { locale: he }) : null, mono: true },
                    { label: "אורך הסרטון",    value: videoDuration,                                                  mono: true  },
                    { label: "צפיות",          value: viewCountFormatted ? viewCountFormatted.replace(/\s*צפיות$/, "") : null, mono: true },
                    { label: "Video ID",       value: videoYtId || video.id || null,                                  mono: true  },
                    { label: "Obsidian",       value: hasObsidianSavedStatus(video) ? "✅ נשמר" : null,               mono: false },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="grid grid-cols-[5rem_1fr] items-center py-1.5 gap-x-2">
                      <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 text-right shrink-0">{label}</span>
                      <span className={`text-xs font-semibold truncate text-left ${mono ? "font-mono tabular-nums" : ""} ${value ? "text-slate-800 dark:text-zinc-100" : "text-slate-300 dark:text-zinc-600"}`} dir={mono ? "ltr" : "rtl"} title={value || ""}>
                        {value || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 text-right flex flex-col" dir="rtl">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 py-3 mb-2 min-h-[88px]" dir="rtl">
                  <div className="text-right text-lg font-bold text-slate-900 dark:text-white">ניתוח AI</div>
                  <div className="flex flex-col items-start gap-1 text-xs" dir="rtl">
                    <span className="hidden items-center gap-1.5 flex-row-reverse text-violet-700 dark:text-violet-300">
                      <span className="h-2 w-2 rounded-full bg-violet-500 dark:bg-violet-300" />
                      <span className="font-semibold">מקור:</span>
                      <span className="font-medium">{analysisProviderLabel}</span>
                    </span>
                    <span className={`inline-flex items-center gap-1.5 flex-row-reverse border rounded-md px-2 py-0.5 ${analysisQualityUi.className}`}>
                      <span className={`h-2 w-2 rounded-full ${analysisQualityUi.dotClass}`} />
                      <span className="font-semibold">איכות:</span>
                      <span className="font-medium">{analysisQualityUi.label}</span>
                      <Info className="h-3.5 w-3.5 opacity-70" />
                    </span>
                  </div>
                </div>

                {/* Saved analysis status */}
                <div className="pt-2 pb-1 text-right" dir="rtl">
                  {savedAnalysisMeta ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 w-fit">
                        <button
                          type="button"
                          onClick={handleDeleteSavedAnalysis}
                          title="מחק ניתוח שמור"
                          className="inline-flex items-center justify-center rounded-md p-1 text-red-500 hover:text-red-600 transition-colors dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs dark:border-emerald-800 dark:bg-emerald-900/30 flex-row-reverse w-fit">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">ניתוח שמור</span>
                          <span className="text-slate-400 dark:text-zinc-500">·</span>
                          <span className="text-emerald-700 dark:text-emerald-400">{savedAnalysisMeta.providerLabel}</span>
                        </div>
                      </div>
                      {savedAnalysisMeta.savedAt && (
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500 pr-0.5">
                          {format(new Date(savedAnalysisMeta.savedAt), "dd/MM/yyyy HH:mm", { locale: he })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-slate-400 dark:text-zinc-500">טרם נשמר ניתוח AI</span>
                      <span className="text-[10px] text-slate-300 dark:text-zinc-600">בחר מודל לניתוח</span>
                    </div>
                  )}
                </div>

                {/* ── GEM Recommendation ─────────────────────────────── */}
                {gemRec && (() => {
                  const effectiveCat = categoryOverride ?? gemRec.recommendedCategoryLabel ?? '';
                  const options = vaultSubtopics.length > 0 ? vaultSubtopics : getGemSubCategoryFallback(gemRec.gemKey);
                  const effectiveSubCat = subCategoryOverride ?? gemRec.recommendedSubCategory ?? 'כללי';
                  const isOverridden = subCategoryOverride != null && subCategoryOverride !== gemRec.recommendedSubCategory;
                  const gemUrl = getGemUrl(gemRec.gemKey);
                  return (
                    <div className="flex flex-col gap-2 py-2 border-t border-slate-100 dark:border-zinc-800">
                      {/* Row 1: Gem badge + confidence */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{gemRec.gemIcon}</span>
                          <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">Gem: {gemRec.gemLabel}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                            gemRec.confidence === 'high' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            gemRec.confidence === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>{gemRec.confidencePct}%</span>
                        </div>
                        {gemUrl && (
                          <button
                            type="button"
                            onClick={() => openGeminiGemUrl(gemUrl)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-200 transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" />
                            פתח Gem
                          </button>
                        )}
                      </div>
                      {/* Row 2: Category */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 dark:text-zinc-500 shrink-0">קטגוריה:</span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200 flex-1 truncate">{effectiveCat || '—'}</span>
                      </div>
                      {/* Row 3: Sub-category selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 dark:text-zinc-500 shrink-0">תת-נושא:</span>
                        <select
                          value={effectiveSubCat}
                          onChange={(e) => setSubCategoryOverride(e.target.value)}
                          className="flex-1 text-xs rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-400"
                        >
                          {options.map(opt => (
                            <option key={opt} value={opt}>{opt}{opt === gemRec.recommendedSubCategory && !isOverridden ? ' ★' : ''}</option>
                          ))}
                        </select>
                      </div>
                      {/* Row 4: Action buttons */}
                      <div className="flex gap-2 mt-1">
                        <button
                          type="button"
                          onClick={handleApplyRecommendation}
                          disabled={recApplied}
                          className={`flex-1 text-[11px] font-semibold h-7 rounded-lg transition-colors ${
                            recApplied
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 cursor-default'
                              : 'bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50'
                          }`}
                        >
                          {recApplied ? '✓ נשמר' : '💾 שמור סיווג'}
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveAllToBrain}
                          className="flex-1 text-[11px] font-semibold h-7 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 transition-colors"
                        >
                          🧠 שמור למוח
                        </button>
                      </div>
                      {/* Row 5: Paste JSON from GEMS */}
                      <button
                        type="button"
                        onClick={() => { setIsGemsPasteOpen(true); setGemsPasteError(""); setGemsPasteInput(""); }}
                        className="w-full h-8 flex items-center justify-center gap-2 rounded-lg bg-violet-600 text-white text-[11px] font-semibold hover:bg-violet-700 active:scale-95 transition-all flex-row-reverse mt-1"
                      >
                        <ClipboardList className="h-3.5 w-3.5" />
                        📥 הדבק JSON מ-GEMS
                      </button>
                    </div>
                  );
                })()}

                {/* ── ObsidianExportButton (folder picker) ─────────────── */}
                <div className="pt-1 border-t border-slate-100 dark:border-zinc-800 mt-1">
                  <ObsidianExportButton
                    key={video.id}
                    video={video}
                    mentorName={mentorName}
                    notes={videoNotes}
                    onPatch={patchVideo}
                  />
                </div>

                <div className="hidden flex-1 flex-col gap-2 pt-3">
                    <button
                      onClick={runClaudeAnalysisFromCard}
                      disabled={isClaudeAnalysisRunning}
                      className="w-full h-10 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 active:scale-95 transition-all shadow-sm flex-row-reverse"
                      title={
                        isClaudeAnalysisRunning
                          ? "כבר מתבצע ניתוח"
                          : aiRequiresTranscript
                            ? "אין תמלול מלא. עדיין אפשר ללחוץ ולקבל שגיאה ברורה / להשתמש בתמלול חלקי/ידני."
                            : undefined
                      }
                    >
                      {isClaudeAnalysisRunning ? (
                        <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      נתח עם קלוד
                    </button>

                    <button
                      type="button"
                      onClick={handleGeminiContent}
                      disabled={geminiStatus === "loading"}
                      className="w-full h-10 flex items-center justify-center gap-2 px-4 py-2 bg-pink-600 text-white text-sm font-semibold rounded-xl hover:bg-pink-700 disabled:opacity-50 active:scale-95 transition-all shadow-sm flex-row-reverse"
                      title={geminiStatus === "loading" ? "Gemini עובד..." : "נתח עם Gemini"}
                    >
                      {geminiStatus === "loading" ? (
                        <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      נתח עם Gemini
                    </button>

                    <button
                      type="button"
                      onClick={runLlamaAnalysisFromCard}
                      disabled={llamaStatus === "loading"}
                      className="w-full h-10 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 active:scale-95 transition-all shadow-sm flex-row-reverse"
                      title="נתח עם llama3.2"
                    >
                      {llamaStatus === "loading" ? (
                        <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {llamaStatus === "loading" ? "מנתח עם llama3.2..." : "נתח עם llama3.2"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCheckLlamaStatus}
                      disabled={llamaHealthStatus === "loading"}
                      className="w-full h-10 flex items-center justify-center gap-2 px-4 py-2 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50 active:scale-95 transition-all shadow-sm dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900 flex-row-reverse"
                      title="בדוק llama3.2"
                    >
                      {llamaHealthStatus === "loading" ? (
                        <div className="h-4 w-4 border-2 border-slate-400/50 border-t-slate-700 rounded-full animate-spin dark:border-zinc-500/40 dark:border-t-zinc-100" />
                      ) : (
                        <Info className="h-4 w-4" />
                      )}
                      בדוק llama3.2
                    </button>
                    {llamaHealthMessage && (
                      <div
                        className={cn(
                          "w-full rounded-xl border px-3 py-2 text-right text-xs leading-relaxed",
                          llamaHealthStatus === "ready"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                            : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300"
                        )}
                      >
                        {llamaHealthMessage}
                      </div>
                    )}
                    <div className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-right dark:border-zinc-800 dark:bg-zinc-950/70">
                      <div className="mb-2 flex items-center justify-between gap-2 flex-row-reverse">
                        <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">סטטוס Ollama מקומי</span>
                        {llamaHealthStatus === "ready" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300 flex-row-reverse">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            מוכן
                          </span>
                        ) : llamaHealthStatus === "loading" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:border-sky-800/50 dark:bg-sky-950/30 dark:text-sky-300 flex-row-reverse">
                            <div className="h-3 w-3 border-2 border-sky-400/40 border-t-sky-700 rounded-full animate-spin dark:border-sky-500/30 dark:border-t-sky-200" />
                            בודק
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300 flex-row-reverse">
                            <AlertCircle className="h-3.5 w-3.5" />
                            דורש בדיקה
                          </span>
                        )}
                      </div>
                      <div className="mb-2 text-[11px] text-slate-500 dark:text-zinc-400">בדיקה אוטומטית פעילה</div>

                      <div className="space-y-2 text-xs text-slate-600 dark:text-zinc-300">
                        {(llamaHealthStatus === "ollama_offline" || !llamaHealthStatus || llamaHealthStatus === "idle") && (
                          <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/70">
                            <div className="font-medium text-slate-900 dark:text-zinc-100">Ollama לא פעיל</div>
                            <div className="mt-1 flex items-center justify-between gap-2 flex-row-reverse">
                              <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">{OLLAMA_SERVE_COMMAND}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyCommand(OLLAMA_SERVE_COMMAND)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 flex-row-reverse"
                              >
                                <Copy className="h-3 w-3" />
                                העתק
                              </button>
                            </div>
                          </div>
                        )}

                        {llamaHealthStatus === "model_missing" && (
                          <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/70">
                            <div className="font-medium text-slate-900 dark:text-zinc-100">המודל llama3.2 לא מותקן</div>
                            <div className="mt-1 flex items-center justify-between gap-2 flex-row-reverse">
                              <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">{OLLAMA_PULL_COMMAND}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyCommand(OLLAMA_PULL_COMMAND)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 flex-row-reverse"
                              >
                                <Copy className="h-3 w-3" />
                                העתק
                              </button>
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={handleQuickTestLlama}
                          disabled={llamaQuickTestStatus === "loading"}
                          className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 flex-row-reverse"
                        >
                          {llamaQuickTestStatus === "loading" ? (
                            <div className="h-4 w-4 border-2 border-slate-400/50 border-t-slate-700 rounded-full animate-spin dark:border-zinc-500/40 dark:border-t-zinc-100" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          בדיקת תגובה מהמודל
                        </button>

                        {llamaQuickTestMessage && (
                          <div
                            className={cn(
                              "rounded-lg border px-3 py-2 text-xs leading-relaxed",
                              llamaQuickTestStatus === "ready"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300"
                            )}
                          >
                            {llamaQuickTestMessage}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveAnalysis}
                      className="w-full h-10 flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 active:scale-95 transition-all shadow-sm dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 flex-row-reverse"
                    >
                      <StickyNote className="h-4 w-4" />
                      שמור ניתוח
                    </button>
                </div>
              </div>
              <div className="hidden rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 text-right">
                <div className="mb-3 text-base font-bold text-slate-900 dark:text-white">שמירת ניתוח</div>
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={handleSaveAnalysis}
                    className="w-full h-10 text-xs font-medium px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 flex-row-reverse"
                  >
                    <StickyNote className="h-3.5 w-3.5" />
                    שמור ניתוח
                  </button>
                  <p className="text-[11px] leading-5 text-slate-500 dark:text-zinc-400">
                    נשמר מקומית תחת הסרטון הזה וישוחזר אוטומטית בפתיחה הבאה.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 text-right" dir="rtl">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 py-3 mb-2" dir="rtl">
                  <div className="text-right text-lg font-bold text-slate-900 dark:text-white">סטטוס תמלול</div>
                  {hasStoredTranscript ? (
                    <span className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      תמלול זמין
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-slate-400 dark:text-zinc-500 font-medium text-sm">
                      <span className="h-2 w-2 rounded-full bg-slate-400" />
                      אין תמלול usable
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  {hasStoredTranscript ? (
                    <>
                      {transcriptSourceLabel && (
                        <div className="flex items-center justify-between text-xs" dir="rtl">
                          <span className="text-slate-500 dark:text-zinc-400">מקור</span>
                          <span className="font-medium text-slate-800 dark:text-zinc-200">{transcriptSourceLabel}</span>
                        </div>
                      )}
                      {storedTranscriptSegments.length > 0 && (
                        <div className="flex items-center justify-between text-xs" dir="rtl">
                          <span className="text-slate-500 dark:text-zinc-400">מקטעים</span>
                          <span className="font-medium text-slate-800 dark:text-zinc-200 tabular-nums">{storedTranscriptSegments.length}</span>
                        </div>
                      )}
                      {transcriptTextLength > 0 && (
                        <div className="flex items-center justify-between text-xs" dir="rtl">
                          <span className="text-slate-500 dark:text-zinc-400">אורך</span>
                          <span className="font-medium text-slate-800 dark:text-zinc-200 tabular-nums">{transcriptTextLength.toLocaleString()} תווים</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-slate-500 dark:text-zinc-400">
                      אין תמלול זמין — אפשר להדביק תמלול ידני או לנסות למשוך תמלול מ-YouTube
                    </div>
                  )}

                  {/* Transcript actions (UI-only move from sidebar) */}
                  <div className="pt-2 mt-1 border-t border-slate-100 dark:border-zinc-800 space-y-2">
                    {hasStoredTranscript && (
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setIsTranscriptViewerOpen(true)}
                          className="h-9 text-xs font-medium px-2 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center gap-1"
                        >
                          📄 פתח תמלול
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(fullTranscriptText).then(() => toast.success('התמלול הועתק ללוח')).catch(() => toast.error('לא ניתן להעתיק'));
                          }}
                          className="h-9 text-xs font-medium px-2 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center gap-1"
                        >
                          📋 העתק תמלול
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsManualTranscriptOpen(true)}
                      className="w-full h-9 text-xs font-medium px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1.5 flex-row-reverse"
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      הדבק תמלול ידני
                    </button>
                    <button
                      type="button"
                      onClick={handleYtApiTranscript}
                      disabled={isFetchingYtApiTranscript}
                      className="w-full h-9 text-xs font-medium px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5 dark:bg-emerald-950/30 dark:border-emerald-800/50 dark:text-emerald-300 dark:hover:bg-emerald-900/40 flex-row-reverse"
                    >
                      {isFetchingYtApiTranscript ? "מביא תמלול..." : "נסה תמלול YouTube"}
                    </button>
                    {hasStoredTranscript && (
                      <button
                        type="button"
                        onClick={handleDeleteTranscript}
                        className="w-full h-9 text-xs font-medium rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-900/30"
                      >
                        <Trash2 className="h-3 w-3" />
                        מחק תמלול
                      </button>
                    )}
                  </div>

                  {/* ── GEMS Quick-Copy shortcuts ──────────────────────── */}
                  <div className="pt-2 mt-1 border-t border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Zap className="h-3 w-3 text-indigo-500 dark:text-indigo-400" />
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide">העתק + שלח ל-Gem</span>
                    </div>
                    <GeminiActionsPanel
                      video={video}
                      fullTranscriptText={fullTranscriptText}
                      transcriptWordCount={transcriptWordCount}
                      storedTranscriptSegments={storedTranscriptSegments}
                      transcriptSourceLabel={transcriptSourceLabel}
                      handleQuickCopy={handleQuickCopy}
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 text-right" dir="rtl">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 py-3 mb-3" dir="rtl">
                  <div className="text-right text-lg font-bold text-slate-900 dark:text-white">סטטוס למידה</div>
                  {videoYtId && (
                    <a
                      href={getWatchUrl(video) || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (!getWatchUrl(video)) e.preventDefault();
                      }}
                      className="inline-flex items-center gap-1.5 flex-row-reverse text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      dir="ltr"
                    >
                      <ExternalLink className="h-4 w-4" />
                      פתח YouTube
                    </a>
                  )}
                </div>
                <div className="flex flex-col pt-2" dir="rtl">
                  <div id="learning-notes" className="max-h-[210px] overflow-auto pr-1">
                    <NoteEditor videoId={video.id} hideEmptyState />
                  </div>
                  <div className="mt-3 flex flex-row gap-2 justify-start items-center flex-wrap">
                    <button
                      onClick={handleCopyLink}
                      className="inline-flex min-h-9 items-center gap-1.5 flex-row-reverse rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <Link2 className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-400" />
                      העתק קישור
                    </button>
                    <a
                      href="https://notebooklm.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-9 items-center gap-1.5 flex-row-reverse rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-400" />
                      NotebookLM
                    </a>
                    {/* Permanent pin toggle */}
                    <button
                      onClick={() => {
                        const wasPinned = video?.isPermanent;
                        const pinPatch = {
                          isPermanent: !wasPinned,
                          ...(wasPinned ? { unpinnedAt: new Date().toISOString() } : { unpinnedAt: null }),
                        };
                        const saved = patchVideo(pinPatch);
                        onVideoPatch?.(saved ?? { ...video, ...pinPatch });
                      }}
                      className={[
                        "inline-flex min-h-9 items-center gap-1.5 flex-row-reverse rounded-xl border px-3 py-1.5 text-xs font-medium shadow-sm transition-colors",
                        video?.isPermanent
                          ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-600/40 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20"
                          : "border-slate-200 bg-white/90 text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
                      ].join(" ")}
                      title={video?.isPermanent ? "בטל שמירה לצמיתות" : "שמור לצמיתות — לא יימחק אחרי 30 יום"}
                    >
                      <Pin className={["h-3.5 w-3.5", video?.isPermanent ? "text-amber-500 fill-amber-400" : "text-slate-400 dark:text-zinc-400"].join(" ")} />
                      {video?.isPermanent ? "מוצמד" : "לצמיתות"}
                    </button>
                  </div>

                  {/* Workspace CTA */}
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/60">
                      <span className="text-slate-600 dark:text-zinc-300">Workspace</span>
                      <span
                        className={[
                          "font-semibold",
                          isSavedInWorkspace
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-400 dark:text-zinc-500",
                        ].join(" ")}
                      >
                        {isSavedInWorkspace ? "Saved in Workspace" : "Not saved yet"}
                      </span>
                    </div>
                    {/* Primary: navigate into the knowledge layer */}
                    <button
                      type="button"
                      onClick={handleOpenInWorkspace}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors shadow-sm"
                    >
                      <BookMarked className="h-4 w-4" />
                      פתח ב-Workspace
                    </button>
                    {/* Secondary: copy / download raw markdown */}
                    <ObsidianExportButton key={video.id} video={video} mentorName={mentorName} notes={videoNotes} onPatch={patchVideo} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 items-start" dir="rtl">
              <aside className="hidden w-full space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 text-right">
                  <div className="mb-3 text-base font-bold text-slate-900 dark:text-white">פעולות AI</div>
                  {showLowQualityWarning && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 px-3 py-2.5 text-right mb-2">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-2">
                        ⚠️ איכות התמלול נמוכה — ניתוח AI עלול להיות לא מדויק
                      </p>
                      <div className="flex gap-2 justify-start flex-row-reverse">
                        <button
                          type="button"
                          onClick={() => setShowLowQualityWarning(false)}
                          className="text-xs px-3 py-1 rounded-lg border border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-50"
                        >
                          ביטול
                        </button>
                        <button
                          type="button"
                          onClick={async () => { setShowLowQualityWarning(false); await runAiAnalysis({ force: false }); }}
                          className="text-xs px-3 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
                        >
                          המשך בכל זאת
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2.5">
                    <button
                      onClick={runClaudeAnalysisFromCard}
                      disabled={isClaudeAnalysisRunning}
                      className="w-full h-11 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 active:scale-95 transition-all shadow-sm flex-row-reverse"
                      title={
                        isClaudeAnalysisRunning
                          ? "כבר מתבצע ניתוח"
                          : aiRequiresTranscript
                            ? "אין תמלול מלא. עדיין אפשר ללחוץ ולקבל שגיאה ברורה / להשתמש בתמלול חלקי/ידני."
                            : undefined
                      }
                    >
                      {isClaudeAnalysisRunning ? (
                        <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      נתח עם קלוד
                    </button>
                    <button
                      type="button"
                      onClick={handleGeminiContent}
                      disabled={geminiStatus === "loading"}
                      className="w-full h-11 flex items-center justify-center gap-2 px-4 py-2 bg-pink-600 text-white text-sm font-semibold rounded-xl hover:bg-pink-700 disabled:opacity-50 active:scale-95 transition-all shadow-sm flex-row-reverse"
                      title={geminiStatus === "loading" ? "Gemini עובד..." : "נתח עם Gemini"}
                    >
                      {geminiStatus === "loading" ? (
                        <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      נתח עם Gemini
                    </button>
                    <button
                      type="button"
                      onClick={runLlamaAnalysisFromCard}
                      disabled={llamaStatus === "loading"}
                      className="w-full h-11 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 active:scale-95 transition-all shadow-sm flex-row-reverse"
                      title="נתח עם llama3.2"
                    >
                      {llamaStatus === "loading" ? (
                        <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {llamaStatus === "loading" ? "מנתח עם llama3.2..." : "נתח עם llama3.2"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCheckLlamaStatus}
                      disabled={llamaHealthStatus === "loading"}
                      className="w-full h-11 flex items-center justify-center gap-2 px-4 py-2 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50 active:scale-95 transition-all shadow-sm dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900 flex-row-reverse"
                      title="בדוק llama3.2"
                    >
                      {llamaHealthStatus === "loading" ? (
                        <div className="h-4 w-4 border-2 border-slate-400/50 border-t-slate-700 rounded-full animate-spin dark:border-zinc-500/40 dark:border-t-zinc-100" />
                      ) : (
                        <Info className="h-4 w-4" />
                      )}
                      בדוק llama3.2
                    </button>
                    {llamaHealthMessage && (
                      <div
                        className={cn(
                          "w-full rounded-xl border px-3 py-2 text-right text-xs leading-relaxed",
                          llamaHealthStatus === "ready"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                            : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300"
                        )}
                      >
                        {llamaHealthMessage}
                      </div>
                    )}
                    <div className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-right dark:border-zinc-800 dark:bg-zinc-950/70">
                      <div className="mb-2 flex items-center justify-between gap-2 flex-row-reverse">
                        <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">סטטוס Ollama מקומי</span>
                        {llamaHealthStatus === "ready" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300 flex-row-reverse">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            מוכן
                          </span>
                        ) : llamaHealthStatus === "loading" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:border-sky-800/50 dark:bg-sky-950/30 dark:text-sky-300 flex-row-reverse">
                            <div className="h-3 w-3 border-2 border-sky-400/40 border-t-sky-700 rounded-full animate-spin dark:border-sky-500/30 dark:border-t-sky-200" />
                            בודק
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300 flex-row-reverse">
                            <AlertCircle className="h-3.5 w-3.5" />
                            דורש בדיקה
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 text-xs text-slate-600 dark:text-zinc-300">
                        {(llamaHealthStatus === "ollama_offline" || !llamaHealthStatus || llamaHealthStatus === "idle") && (
                          <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/70">
                            <div className="font-medium text-slate-900 dark:text-zinc-100">Ollama לא פעיל</div>
                            <div className="mt-1 flex items-center justify-between gap-2 flex-row-reverse">
                              <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">{OLLAMA_SERVE_COMMAND}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyCommand(OLLAMA_SERVE_COMMAND)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 flex-row-reverse"
                              >
                                <Copy className="h-3 w-3" />
                                העתק
                              </button>
                            </div>
                          </div>
                        )}

                        {llamaHealthStatus === "model_missing" && (
                          <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/70">
                            <div className="font-medium text-slate-900 dark:text-zinc-100">המודל llama3.2 לא מותקן</div>
                            <div className="mt-1 flex items-center justify-between gap-2 flex-row-reverse">
                              <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">{OLLAMA_PULL_COMMAND}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyCommand(OLLAMA_PULL_COMMAND)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 flex-row-reverse"
                              >
                                <Copy className="h-3 w-3" />
                                העתק
                              </button>
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={handleQuickTestLlama}
                          disabled={llamaQuickTestStatus === "loading"}
                          className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 flex-row-reverse"
                        >
                          {llamaQuickTestStatus === "loading" ? (
                            <div className="h-4 w-4 border-2 border-slate-400/50 border-t-slate-700 rounded-full animate-spin dark:border-zinc-500/40 dark:border-t-zinc-100" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          בדיקת תגובה מהמודל
                        </button>

                        {llamaQuickTestMessage && (
                          <div
                            className={cn(
                              "rounded-lg border px-3 py-2 text-xs leading-relaxed",
                              llamaQuickTestStatus === "ready"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300"
                            )}
                          >
                            {llamaQuickTestMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transcript actions were moved into "סטטוס תמלול" card (UI-only). */}

                {hasManualTranscript && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 shadow-sm dark:border-rose-900/40 dark:bg-rose-950/20 text-right">
                    <button
                      onClick={handleRemoveManualTranscript}
                      className="w-full h-10 inline-flex items-center justify-center gap-1.5 flex-row-reverse rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 shadow-sm transition-colors hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
                    >
                      הסר תמלול ידני
                    </button>
                  </div>
                )}
              </aside>

              <div className="min-w-0 w-full flex justify-center">
            <div className="w-full max-w-3xl">
            <div className="text-right" dir="rtl">
              <div className="mb-2 flex items-start gap-3 flex-row-reverse">
                <h2 className="flex-1 text-right text-2xl font-bold leading-snug text-slate-900 tracking-tight dark:text-zinc-100">
                  {video.title}
                </h2>
                <SaveButton isSaved={video.isSaved} onClick={() => onSaveToggle?.(video)} size="md" />
              </div>
            </div>

            <div className="w-full mt-0">
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-100 shadow-md dark:bg-zinc-900">
                <img
                  src={video.thumbnail || video.thumbnailUrl}
                  alt={video.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const youtubeId = video.youtubeId;
                    if (youtubeId && !e.target.dataset.triedHq) {
                      e.target.dataset.triedHq = "1";
                      e.target.src = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
                      return;
                    }
                    e.target.src =
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360' fill='%23f3f4f6'%3E%3Crect width='640' height='360'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='18'%3ENo Thumbnail%3C/text%3E%3C/svg%3E";
                  }}
                />
                <a
                  href={getWatchUrl(video) || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    if (!getWatchUrl(video)) e.preventDefault();
                  }}
                >
                  <div className="bg-white/90 rounded-full p-3 shadow-lg">
                    <ExternalLink className="h-5 w-5 text-slate-800" />
                  </div>
                </a>
              </div>
            </div>

            {/* ── כותרת ── */}
            <div className="hidden space-y-3">
              <div className="flex items-start gap-2 flex-row-reverse">
                <h2 className="flex-1 text-right text-2xl font-bold leading-snug text-slate-900 tracking-tight dark:text-zinc-100">
                  <span className="inline-flex flex-wrap items-center justify-end gap-2">
                    {videoDuration ? (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
                        {videoDuration}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                        משך לא זמין
                      </span>
                    )}
                    <span>{video.title}</span>
                  </span>
                </h2>
                <SaveButton isSaved={video.isSaved} onClick={() => onSaveToggle?.(video)} size="md" />
              </div>
              <div className="hidden rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80" dir="rtl" />
              {metadataItems.length > 0 && (
                <div className="hidden flex flex-wrap items-center justify-end gap-2 text-sm text-slate-600 dark:text-zinc-300" dir="rtl">
                  {metadataItems.map((item, index) => (
                    <span key={`${item}-${index}`} className="inline-flex items-center gap-2">
                      {index > 0 && <span className="text-slate-400 dark:text-zinc-500">·</span>}
                      <span className="tabular-nums">{item}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Metadata chips — white cards with border */}
              <div className="hidden flex flex-wrap items-center gap-2.5" dir="rtl">
                {videoDuration && (
                  <span className="inline-flex min-h-9 items-center gap-1.5 bg-white/90 border border-slate-200 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                    <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-400" />
                    {videoDuration}
                  </span>
                )}
                {viewCountFormatted && (
                  <span className="inline-flex min-h-9 items-center gap-1.5 bg-white/90 border border-slate-200 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                    <Eye className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-400" />
                    {viewCountFormatted}
                  </span>
                )}
                {relativeDate && (
                  <span className="inline-flex min-h-9 items-center gap-1.5 bg-white/90 border border-slate-200 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                    <Calendar className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-400" />
                    {relativeDate}
                  </span>
                )}
                <button
                  onClick={handleCopyLink}
                  className="inline-flex min-h-9 items-center gap-1.5 bg-white/90 border border-slate-200 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm hover:bg-slate-50 transition-colors dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Link2 className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-400" />
                  העתק קישור
                </button>
                {mentorName && mentorName !== "לא ידוע" && (
                  <span className="inline-flex min-h-9 items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-medium px-2.5 py-1.5 rounded-xl">
                    <span className="w-4 h-4 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                      {mentorName.charAt(0).toUpperCase()}
                    </span>
                    {mentorName}
                  </span>
                )}
                <a
                  href="https://notebooklm.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center gap-1.5 bg-white/90 border border-slate-200 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm hover:bg-slate-50 transition-colors dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-400" />
                  NotebookLM
                </a>
                <CategoryBadge category={video.category} />
                <StatusBadge status={video.status} />
              </div>
            </div>

            {/* Note preview */}
            {false && notePreview && (
              <button
                onClick={scrollToLearningNotes}
                className="flex items-start gap-1.5 flex-row-reverse text-right hover:opacity-70 transition-opacity w-full"
              >
                <StickyNote className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-500 line-clamp-2 leading-relaxed">{notePreview}</p>
              </button>
            )}

            {/* ── תקציר — white card with shadow ── */}
            <div className="hidden bg-slate-50 border border-slate-200 rounded-2xl shadow-sm px-4 py-4 text-right dark:bg-zinc-900 dark:border-zinc-800">
              {(video.shortSummary || enrichedVideo.aiSummaryShort) ? (
                <>
                  <p className="text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest">מה תלמד כאן</p>
                  <p className="text-sm text-gray-800 leading-7 line-clamp-3">{(video.shortSummary || enrichedVideo.aiSummaryShort).replace(/\[MOCK\]\s*/g, '')}</p>
                </>
              ) : (
                <p className="text-xs text-gray-500 text-center py-1">ניתוח AI זמין לאחר בחירה באחת מפעולות הניתוח</p>
              )}
            </div>

            {/* ── Progress bar + סטטוס למידה ── */}
            {false && (() => {
              const pctMap = { not_started: 0, in_progress: 40, learned: 80, completed: 100 };
              const pct    = pctMap[video.learningStatus] ?? 0;
              return (
                <div className="space-y-3">
                  {/* Status row */}
                  <div className="flex items-center justify-between">
                    <Select
                      value={video.learningStatus || "not_started"}
                      onValueChange={(val) => onLearningStatusChange?.(video, val)}
                    >
                      <SelectTrigger className="h-7 text-xs bg-white border-slate-200 text-slate-900 w-[145px] dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100" dir="rtl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        {LEARNING_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">סטטוס למידה</span>
                      <LearningStatusBadge status={video.learningStatus} />
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="relative h-2.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-visible" dir="ltr">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: "linear-gradient(90deg, #6366f1 0%, #818cf8 100%)",
                      }}
                    />
                    {pct > 0 && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-full bg-indigo-600 border-[3px] border-white shadow-md transition-all duration-500"
                        style={{ left: `calc(${pct}% - 9px)` }}
                      />
                    )}
                  </div>
                </div>
              );
            })()}

            {/* נושאים */}
            {false && videoTopics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 flex-row-reverse">
                {videoTopics.map((topic) => (
                  <span key={topic.id} className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">
                    #{topic.name}
                    {onRemoveTopic && (
                      <button onClick={() => onRemoveTopic(video, topic.id)} className="hover:text-gray-700 leading-none">×</button>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* Error */}
            {video.status === "error" && video.errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-right">
                <p className="text-sm text-red-700">{video.errorMessage}</p>
              </div>
            )}

            {/* ── טאבים ── */}
            <Tabs id="analysis-tabs" value={activeTab} onValueChange={setActiveTab} className="w-full mt-4" dir="rtl">
              <div className="flex flex-wrap items-center gap-2">
                <TabsList className="inline-flex w-auto max-w-full flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <TabsTrigger
                    value="summary"
                    className="px-4 text-xs rounded-xl py-2 data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=active]:text-slate-900 dark:data-[state=active]:text-zinc-100 text-slate-500 dark:text-zinc-400 transition-all"
                  >
                    סיכום
                  </TabsTrigger>
                  <TabsTrigger
                    value="keypoints"
                    className="px-4 text-xs rounded-xl py-2 data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=active]:text-slate-900 dark:data-[state=active]:text-zinc-100 text-slate-500 dark:text-zinc-400 transition-all"
                  >
                    נקודות מפתח
                  </TabsTrigger>
                  <TabsTrigger
                    value="chapters"
                    className="px-4 text-xs rounded-xl py-2 data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=active]:text-slate-900 dark:data-[state=active]:text-zinc-100 text-slate-500 dark:text-zinc-400 transition-all"
                  >
                    פרקים
                  </TabsTrigger>
                  <TabsTrigger
                    value="notes"
                    className="px-4 text-xs rounded-xl py-2 data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=active]:text-slate-900 dark:data-[state=active]:text-zinc-100 text-slate-500 dark:text-zinc-400 transition-all"
                  >
                    הערות
                  </TabsTrigger>
                </TabsList>

                <button
                  type="button"
                  onClick={() => setIsKnowledgePickerOpen(true)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/80 px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
                >
                  <span>🧠 בחר ידע לברין</span>
                  <span className="text-[11px] font-medium text-indigo-500 dark:text-indigo-300">
                    נבחרו {totalSelectedKnowledgeItems} מתוך {totalSelectableKnowledgeItems}
                  </span>
                </button>
              </div>

              {/* ── Summary tab ── */}
              <TabsContent value="summary" className="mt-5 min-h-[320px]" dir="rtl">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-3 space-y-3 text-right">
                  {isClaudeAnalysisRunning && (
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-right dark:border-indigo-500/30 dark:bg-indigo-500/10">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full border-2 border-indigo-300 border-t-indigo-700 animate-spin dark:border-indigo-300/40 dark:border-t-indigo-200" />
                          <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">Claude מנתח את התמלול...</span>
                        </div>
                        <span className="text-xs font-medium text-indigo-700 dark:text-indigo-200">{analysisStageLabel}</span>
                      </div>
                      <p className="mt-2 text-xs text-indigo-700/90 dark:text-indigo-200/90">
                        זה יכול לקחת עד דקה בסרטונים ארוכים
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {["קורא תמלול", "שולח ל־Claude", "בונה פרקים וסיכום"].map((step, index) => {
                          const steps = ["קורא תמלול", "שולח ל־Claude", "בונה פרקים וסיכום"];
                          const activeIndex = Math.max(steps.indexOf(analysisStageLabel), 0);
                          const isActive = index <= activeIndex;
                          return (
                            <span
                              key={step}
                              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                isActive
                                  ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-100"
                                  : "bg-white/80 text-indigo-500 dark:bg-zinc-900 dark:text-indigo-300/70"
                              }`}
                            >
                              {step}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* No-transcript notice */}
                  {false && transcriptDiagnostics && (
                    <div className="rounded-lg border border-slate-200 bg-white/80 dark:border-zinc-700 dark:bg-zinc-950/70 p-3 space-y-1 text-xs text-slate-700 dark:text-zinc-200">
                      <p><strong>videoId:</strong> {transcriptDiagnostics.videoId}</p>
                      <p><strong>captionTracks:</strong> {transcriptDiagnostics.diagnostics?.foundCaptionTracks ? "כן" : "לא"}</p>
                      <p><strong>tracks:</strong> {transcriptDiagnostics.diagnostics?.tracksCount ?? 0}</p>
                      <p><strong>languages:</strong> {(transcriptDiagnostics.diagnostics?.languages || []).join(", ") || "—"}</p>
                      <p><strong>manual:</strong> {transcriptDiagnostics.diagnostics?.hasManualCaptions ? "כן" : "לא"} | <strong>auto:</strong> {transcriptDiagnostics.diagnostics?.hasAutoCaptions ? "כן" : "לא"}</p>
                      <p><strong>json3:</strong> {transcriptDiagnostics.diagnostics?.json3Succeeded ? "כן" : "לא"} | <strong>srv3:</strong> {transcriptDiagnostics.diagnostics?.srv3Succeeded ? "כן" : "לא"}</p>
                      <p><strong>segments:</strong> {transcriptDiagnostics.segmentsCount ?? 0}</p>
                      <p><strong>source:</strong> {transcriptDiagnostics.source || "—"}</p>
                      <p><strong>reason:</strong> {transcriptDiagnostics.reason || "ok"}</p>
                    </div>
                  )}
                </div>
                {(() => {
                  const summaryShort = (video.shortSummary || enrichedVideo.aiSummaryShort)?.replace(/\[MOCK\]\s*/g, '');
                  const summaryLong  = (video.fullSummary  || enrichedVideo.aiSummaryLong)?.replace(/\[MOCK\]\s*/g, '');
                  const chapters = baseChapters;
                  const watchUrl = getWatchUrl(video);
                  const brainHighlights = extractBrainHighlights(video.brainSummary, video.keyInsights, video.keyPoints);
                  const hasData = summaryShort || summaryLong || video.keyPoints?.length > 0 || chapters?.length > 0 || brainHighlights.length > 0;
                  if (hasData) {
                    return (
                      <>
                        {summaryShort && (
                          <div className="text-right">
                            <h4 className="text-sm font-bold text-gray-900 mb-2">סיכום קצר</h4>
                            <p className="text-sm text-gray-800 leading-7">{summaryShort}</p>
                          </div>
                        )}
                        {summaryLong && (
                          <div className="text-right">
                            <h4 className="text-sm font-bold text-gray-900 mb-2">סיכום מלא</h4>
                            <p className="text-sm text-gray-800 leading-7 whitespace-pre-line">{summaryLong}</p>
                          </div>
                        )}
                        {chapterSourceInfo.message && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 text-right leading-relaxed">
                            {chapterSourceInfo.message}
                          </div>
                        )}
                        {video.keyPoints?.length > 0 && (
                          <div className="text-right" dir="rtl">
                            <h4 className="text-sm font-semibold text-gray-800 mb-3">נקודות מפתח</h4>
                            <ul className="space-y-2.5" dir="rtl">
                              {video.keyPoints.map((point, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-800">
                                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                                  <span className="leading-relaxed flex-1">{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* תובנות מרכזיות */}
                        {(() => {
                          const bh = brainHighlights;
                          if (bh.length === 0) return null;
                          return (
                            <div dir="rtl">
                              <div className="flex items-center gap-2 mb-3">
                                <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                                <h4 className="text-sm font-bold text-gray-900 flex-1 min-w-0">תובנות מרכזיות</h4>
                                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium shrink-0">{bh.length}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {bh.map((point, i) => {
                                  const itemKey = `brainHighlights:${i}`;
                                  const isSelected = !!selectedItems[itemKey];
                                  return (
                                    <button
                                      key={itemKey}
                                      type="button"
                                      onClick={() => {
                                        const next = { ...selectedItems, [itemKey]: !isSelected };
                                        persistSelectedItems(next);
                                      }}
                                      className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 shadow-sm text-right transition-all ${
                                        isSelected
                                          ? "border-blue-300 bg-blue-50/80 text-blue-950"
                                          : "border-amber-200 bg-amber-50/70 text-gray-800 hover:border-blue-200 hover:bg-blue-50/40"
                                      }`}
                                      dir="rtl"
                                      aria-pressed={isSelected}
                                    >
                                      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 text-[9px] font-bold ${
                                        isSelected ? "border-blue-500 bg-blue-500 text-white" : "border-amber-300 bg-white text-transparent"
                                      }`}>
                                        ✓
                                      </span>
                                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isSelected ? "bg-blue-400" : "bg-amber-400"}`} aria-hidden />
                                      <span className="min-w-0 flex-1 text-sm leading-relaxed">{point}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Chapters */}
                        {(() => {
                          const hasOldChapters = chapters?.some(
                            (c) => c.timeSource === "estimated" && !Number.isFinite(c.startSeconds)
                          );
                          const allClickable = chapters?.length > 0 && chapters.every(
                            (c) => Number.isFinite(c.startSeconds)
                          );
                          return (
                            <div className="text-right">
                              <div className="flex items-center justify-between flex-row-reverse mb-3">
                                <div className="flex items-center gap-2 flex-row-reverse">
                                  <h4 className="text-sm font-bold text-gray-900">פרקי הסרטון</h4>
                                  {chapterSourceBadge && (
                                    <span className={`text-[10px] border px-1.5 py-0.5 rounded-full ${chapterSourceBadgeClass}`}>
                                      {chapterSourceBadge}
                                    </span>
                                  )}
                                  {allClickable && (
                                    <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">
                                      ניווט זמין
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-gray-400 leading-snug text-left max-w-[200px]">
                                  ניווט לפי timestamp כאשר זמין
                                </span>
                              </div>

                              {/* Old chapters banner */}
                              {hasOldChapters && !isReanalyzing && (
                                <div className="flex items-center justify-between gap-2 px-3 py-2 mb-3 rounded-lg bg-blue-50 border border-blue-200" dir="rtl">
                                  <span className="text-xs text-blue-700">פרקים ישנים — ניווט לא זמין</span>
                                  <button
                                    onClick={handleReanalyzeLocal}
                                    className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium shrink-0"
                                  >
                                    עדכן ניווט
                                  </button>
                                </div>
                              )}

                              {/* Chapter list or loading */}
                              {isReanalyzing ? (
                                <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
                                  <div className="h-4 w-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
                                  <span className="text-xs">מעדכן פרקים...</span>
                                </div>
                              ) : chapters?.length > 0 ? (
                                <div className="chapters-list">
                                  {chapters.map((chapter, index) => (
                                    <ChapterItem
                                      key={`ch-${index}-${String(chapter.startSeconds ?? "na")}-${String(chapter.title || "")}`}
                                      section={chapter}
                                      playerRef={undefined}
                                      videoUrl={watchUrl}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-400">עדיין לא נוצרו פרקים</p>
                              )}
                            </div>
                          );
                        })()}

                        {claudeMissingMessage && (
                          <div className="w-full rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-700 text-right leading-relaxed">{claudeMissingMessage}</div>
                        )}
                        {analyzeError && (
                          <div className="w-full rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-700 text-right leading-relaxed">{analyzeError}</div>
                        )}
                      </>
                    );
                  }
                  return (
                    <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-10 text-center dark:border-zinc-800 dark:bg-zinc-950/40">
                      <div className="rounded-2xl bg-indigo-50 p-3 dark:bg-indigo-500/10">
                        <Sparkles className="h-6 w-6 text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">אין עדיין תוצאות ניתוח</p>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                          כדי להתחיל, לחץ על <span className="font-semibold">"נתח עם קלוד"</span> בכרטיס <span className="font-semibold">"ניתוח AI"</span> למעלה.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          scrollToAnalysisTabs();
                        }}
                        className="text-xs font-medium text-slate-600 hover:text-slate-800 underline underline-offset-2"
                      >
                        גלול לאזור הניתוח
                      </button>
                    </div>
                  );
                })()}
              </TabsContent>

              {/* ── Key Points tab ── */}
              <TabsContent value="keypoints" className="mt-5 min-h-[320px]" dir="rtl">
                {video.keyPoints && video.keyPoints.length > 0 ? (
                  <ul className="space-y-3 text-right" dir="rtl">
                    {video.keyPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="mt-0.5 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm text-gray-800 leading-7 flex-1">{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                    אין נקודות מפתח זמינות
                  </div>
                )}
                {video.tags && video.tags.length > 0 && (
                  <div className="text-right pt-2">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">תגיות</h4>
                    <div className="flex flex-wrap gap-2 flex-row-reverse">
                      {video.tags.map((tag, i) => (
                        <span key={i} className="inline-flex items-center rounded-full bg-gray-100 px-3 py-0.5 text-xs font-medium text-gray-700">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── Notes tab ── */}
                <TabsContent value="chapters" className="mt-4 min-h-[320px]" dir="rtl">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-4 flex items-center justify-between gap-3 flex-row-reverse">
                    <div className="flex items-center gap-2 flex-row-reverse">
                      <h4 className="text-base font-bold text-slate-900 dark:text-zinc-100">פרקי הסרטון</h4>
                      {chapterSourceBadge && (
                        <span className={`text-[10px] border px-1.5 py-0.5 rounded-full ${chapterSourceBadgeClass}`}>
                          {chapterSourceBadge}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500">לחץ על הזמן כדי לנווט</span>
                  </div>
                  {chapterSourceInfo.message && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 text-right leading-relaxed">
                      {chapterSourceInfo.message}
                    </div>
                  )}
                  {baseChapters?.length > 0 ? (
                      <div className="space-y-3">
                      {baseChapters.map((chapter, index) => (
                        <div key={`chapters-tab-${index}`} id={`chap-hl-${index}`}>
                          <ChapterItem
                            section={chapter}
                            playerRef={undefined}
                            videoUrl={getWatchUrl(video)}
                            isHighlighted={index === highlightedChapterIndex}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-[180px] flex-col items-start justify-center gap-4 text-right" dir="rtl">
                      <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">אין עדיין חלוקה לפרקים</p>
                      <button
                        type="button"
                        onClick={handleFetchYoutubeChapters}
                        disabled={isYoutubeChaptersFetch}
                        className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      >
                        {isYoutubeChaptersFetch ? "טוען..." : "נסה פרקים"}
                      </button>
                    </div>
                  )}
                </div>
              </TabsContent>

                <TabsContent value="notes" className="mt-5 min-h-[320px]" dir="rtl">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div id="learning-notes" className="max-h-[260px] overflow-auto pr-1">
                      <NoteEditor videoId={video.id} hideEmptyState />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Debug section removed for dense UI */}
            </div>{/* closes max-w-3xl */}
              </div>{/* closes flex justify-center */}

            </div>{/* closes main grid */}

          </div>{/* closes w-full px-5 py-6 */}
        </ScrollArea>
      </DialogContent>
    </Dialog>

    {/* Auto Transcript (Whisper) Modal */}
    <Dialog open={isAutoTranscriptModalOpen} onOpenChange={setIsAutoTranscriptModalOpen}>
      <DialogContent dir="rtl" className="max-w-md z-[200]">
        <DialogHeader>
          <DialogTitle>תמלול אוטומטי</DialogTitle>
          <DialogDescription>
            תמלול אוטומטי מאודיו באמצעות Whisper יתווסף בהמשך.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-right space-y-2">
          <p className="text-sm text-slate-700 font-medium">מה מתוכנן:</p>
          <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside" dir="rtl">
            <li>הורדת אודיו מהסרטון</li>
            <li>תמלול אוטומטי באמצעות Whisper</li>
            <li>ניתוח AI מלא על בסיס התמלול</li>
          </ul>
          <p className="text-xs text-slate-500 pt-2">
            בינתיים אפשר להדביק תמלול ידנית מ-YouTube ← הצג תמלול.
          </p>
        </div>
        <div className="flex gap-2 justify-start flex-row-reverse">
          <button
            onClick={() => setIsAutoTranscriptModalOpen(false)}
            className="px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700"
          >
            הבנתי
          </button>
          <button
            onClick={() => { setIsAutoTranscriptModalOpen(false); setIsManualTranscriptOpen(true); }}
            className="px-4 py-2 text-sm border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50"
          >
            הדבק תמלול ידני עכשיו
          </button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Manual Transcript Modal */}
    <Dialog open={isManualTranscriptOpen} onOpenChange={setIsManualTranscriptOpen}>
      <DialogContent dir="rtl" className="max-w-2xl z-[200]">
        <DialogHeader>
          <DialogTitle>הדבק תמלול ידני</DialogTitle>
          <DialogDescription>
            הדבק תמלול מ-YouTube, Whisper, או כל מקור אחר. עם או בלי timestamps (00:00 כותרת...).
          </DialogDescription>
        </DialogHeader>
        <textarea
          className="w-full h-64 rounded-lg border border-slate-200 p-3 text-sm text-slate-800 resize-y font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-300"
          placeholder="הדבק כאן תמלול מלא של הסרטון (עם או בלי timestamps)..."
          value={manualTranscriptInput}
          onChange={(e) => setManualTranscriptInput(e.target.value)}
          dir="auto"
        />
        <div className="text-xs text-slate-500 text-right">
          {manualTranscriptInput.trim().length} תווים
          {manualTranscriptInput.includes(':') && /\d:\d{2}/.test(manualTranscriptInput) && (
            <span className="mr-2 text-emerald-600">· timestamps זוהו</span>
          )}
        </div>
        <div className="flex gap-2 justify-start flex-row-reverse">
          <button
            onClick={() => { setIsManualTranscriptOpen(false); setManualTranscriptInput(""); }}
            className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
          >
            ביטול
          </button>
          <button
            onClick={handleSaveManualTranscript}
            disabled={manualTranscriptInput.trim().length < 40 || isSavingManualTranscript}
            className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg disabled:opacity-50 hover:bg-indigo-700 font-semibold flex items-center gap-2"
          >
            {isSavingManualTranscript
              ? <><div className="h-3.5 w-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />שומר ומנתח...</>
              : <><Sparkles className="h-3.5 w-3.5" />שמור תמלול והרץ ניתוח AI</>
            }
          </button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isKnowledgePickerOpen} onOpenChange={setIsKnowledgePickerOpen}>
      <DialogContent dir="rtl" className="max-w-3xl z-[210]">
        <DialogHeader>
          <DialogTitle>🧠 בחר ידע לברין</DialogTitle>
          <DialogDescription>
            בחר אילו פריטי ידע לשמור לברין או לייצא כקובץ נבחר.
          </DialogDescription>
        </DialogHeader>

        {(() => {
          if (selectableAtomicFields.length === 0) {
            return (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                עדיין אין פריטי ידע מובנים לבחירה בסרטון הזה.
              </div>
            );
          }

          const previewData = getSelectedAtomicKnowledge(video, selectedItems);
          const previewFields = [
            { label: '🎯 רעיון מרכזי', items: previewData.mainLesson ? [previewData.mainLesson] : [] },
            { label: '🧠 תובנות בריין', items: previewData.brainHighlights },
            { label: '⚡ תובנות', items: previewData.keyInsights },
            { label: '✅ כללים', items: previewData.rules },
            { label: '🔁 פעולות', items: previewData.actionItems },
            { label: '⚠️ טעויות', items: previewData.mistakesToAvoid },
            { label: '🧩 מושגים', items: previewData.concepts },
          ].filter((field) => field.items.length > 0);

          return (
            <div dir="rtl" className="rounded-xl border border-indigo-100 bg-white p-4 space-y-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900 dark:text-zinc-100">בחר ידע לברין</span>
                  {totalSelectedKnowledgeItems > 0 && (
                    <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-medium">{totalSelectedKnowledgeItems}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const next = {};
                      selectableAtomicFields.forEach(({ key, items }) => {
                        items.forEach((_, idx) => { next[`${key}:${idx}`] = true; });
                      });
                      persistSelectedItems(next);
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    בחר הכל
                  </button>
                  <button
                    type="button"
                    onClick={() => persistSelectedItems({})}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    נקה
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-400 -mt-1">
                {totalSelectedKnowledgeItems > 0
                  ? `נבחרו ${totalSelectedKnowledgeItems} פריטי ידע מתוך ${totalSelectableKnowledgeItems}`
                  : 'בחר פריטים כדי לשמור לברין / לייצא'}
              </p>

              <div className="max-h-[50vh] overflow-auto pr-1 space-y-4">
                {selectableAtomicFields.map(({ key: fieldKey, emoji, label, items }) => {
                  const sectionSelected = items.filter((_, idx) => !!selectedItems[`${fieldKey}:${idx}`]).length;
                  return (
                    <div key={fieldKey}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">{emoji} {label}</span>
                        <span className="text-[10px] text-gray-400">({sectionSelected}/{items.length})</span>
                      </div>
                      <div className="space-y-1.5">
                        {items.map((item, idx) => {
                          const itemKey = `${fieldKey}:${idx}`;
                          const isSelected = !!selectedItems[itemKey];
                          return (
                            <button
                              key={itemKey}
                              type="button"
                              onClick={() => {
                                const next = { ...selectedItems, [itemKey]: !isSelected };
                                persistSelectedItems(next);
                              }}
                              className={`w-full flex items-start gap-2.5 rounded-lg border px-3 py-2 text-right transition-all text-sm ${
                                isSelected
                                  ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                                  : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-indigo-200 hover:bg-indigo-50/40'
                              }`}
                            >
                              <span className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center text-[9px] font-bold ${
                                isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300 bg-white text-transparent'
                              }`}>
                                ✓
                              </span>
                              <span className="flex-1 leading-relaxed text-right">{item}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalSelectedKnowledgeItems > 0 && previewFields.length > 0 && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 space-y-2.5">
                  <span className="text-xs font-semibold text-indigo-700 block">תצוגה מקדימה — פריטים נבחרים</span>
                  {previewFields.map(({ label, items }) => (
                    <div key={label}>
                      <span className="text-[10px] font-semibold text-indigo-600">{label}</span>
                      <ul className="mt-1 space-y-0.5">
                        {items.map((item, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-indigo-900">
                            <span className="mt-1 w-1 h-1 rounded-full bg-indigo-400 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={totalSelectedKnowledgeItems === 0}
                  onClick={() => {
                    const item = createKnowledgeItemFromVideo({ ...video, selectedKnowledgeItems: selectedItems }, video.topicIds?.[0] ?? null);
                    if (!item) { toast.error("אין פריטים נבחרים לשמירה"); return; }
                    upsertKnowledgeItem(item);
                    toast.success(`נשמר לברין — ${totalSelectedKnowledgeItems} פריטים`);
                  }}
                  className={`flex-1 rounded-xl text-sm font-semibold py-2.5 transition-colors ${
                    totalSelectedKnowledgeItems > 0
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  שמור לברין{totalSelectedKnowledgeItems > 0 ? ` (${totalSelectedKnowledgeItems})` : ''}
                </button>
                <button
                  type="button"
                  disabled={totalSelectedKnowledgeItems === 0}
                  onClick={() => {
                    const item = createKnowledgeItemFromVideo({ ...video, selectedKnowledgeItems: selectedItems }, video.topicIds?.[0] ?? null);
                    if (!item) { toast.error("אין פריטים נבחרים לייצוא"); return; }
                    downloadMarkdown(item.markdown, `${(video.title || 'knowledge').replace(/[^\w֐-׿\s]/g, '').trim().slice(0, 50)}-selected.md`);
                  }}
                  className={`px-4 rounded-xl border text-sm font-medium py-2.5 transition-colors ${
                    totalSelectedKnowledgeItems > 0
                      ? 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                      : 'border-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  ייצוא
                </button>
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>

    {/* ── Transcript Viewer ───────────────────────────────── */}
    <Dialog open={isTranscriptViewerOpen} onOpenChange={setIsTranscriptViewerOpen}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-right text-base font-bold truncate">
            📄 תמלול — {video?.title || 'סרטון'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 px-1 py-1 shrink-0">
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-zinc-400">
            {transcriptSourceLabel && <span>מקור: <strong>{transcriptSourceLabel}</strong></span>}
            {storedTranscriptSegments.length > 0 && <span>מקטעים: <strong>{storedTranscriptSegments.length}</strong></span>}
            {transcriptWordCount > 0 && <span>מילים: <strong>{transcriptWordCount.toLocaleString()}</strong></span>}
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(fullTranscriptText).then(() => toast.success('התמלול הועתק ללוח')).catch(() => {})}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors flex items-center gap-1 shrink-0"
          >
            📋 העתק
          </button>
        </div>
        <div className="flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/80 dark:bg-zinc-900/80 min-h-0">
          <pre className="whitespace-pre-wrap break-words px-4 py-3 text-sm leading-7 text-slate-800 dark:text-zinc-100 text-right" dir="rtl">
            {fullTranscriptText || 'אין תמלול זמין'}
          </pre>
        </div>
      </DialogContent>
    </Dialog>

    {/* ── Brain Destination Picker ─────────────────────────── */}
    <BrainDestinationPicker
      open={brainPickerOpen}
      onOpenChange={(open) => {
        setBrainPickerOpen(open);
        if (!open) setPendingBrainSave(null);
      }}
      video={video}
      onConfirm={({ brainId, subBrainId, customBrainName, customSubName }) => {
        setBrainPickerOpen(false);
        setPendingBrainSave(null);
        handleSaveAllToBrain();
      }}
    />

    {/* ── Save All Confirmation Dialog ─────────────────────── */}
    <Dialog open={saveAllConfirmOpen} onOpenChange={setSaveAllConfirmOpen}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-lg font-bold">🧠 שמור סרטון מלא למוח</DialogTitle>
        </DialogHeader>
        {saveAllContent && (
          <div className="space-y-4 text-right">
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              יישמרו <strong>{saveAllContent.totalItems}</strong> פריטים לנתיב:
            </p>
            <code className="block text-xs bg-slate-50 dark:bg-zinc-800 rounded-lg px-3 py-2 break-all text-slate-700 dark:text-zinc-300">
              {saveAllContent.path}
            </code>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setSaveAllConfirmOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleSaveAllConfirmed}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                שמור
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* ── GEMS JSON Paste Dialog ────────────────────────────── */}
    <Dialog open={isGemsPasteOpen} onOpenChange={(open) => { setIsGemsPasteOpen(open); if (!open) { setGemsPasteInput(""); setGemsPasteError(""); } }}>
      <DialogContent dir="rtl" className="max-w-xl z-[200]">
        <DialogHeader>
          <DialogTitle className="text-right text-base font-bold">📥 הדבק JSON מ-GEMS</DialogTitle>
          <DialogDescription className="text-right text-sm text-slate-500">
            הדבק JSON שקיבלת מ-Gemini Gem (תוצאת ניתוח).
          </DialogDescription>
        </DialogHeader>
        <textarea
          className="w-full h-52 rounded-lg border border-slate-200 p-3 text-xs text-slate-800 resize-y font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-300 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
          placeholder='{ "allPoints": [...], "chapters": [...], ... }'
          value={gemsPasteInput}
          onChange={(e) => { setGemsPasteInput(e.target.value); setGemsPasteError(""); }}
          dir="ltr"
        />
        {gemsPasteError && (
          <p className="text-xs text-red-600 dark:text-red-400 text-right">{gemsPasteError}</p>
        )}
        <div className="flex gap-2 justify-start flex-row-reverse">
          <button
            onClick={() => { setIsGemsPasteOpen(false); setGemsPasteInput(""); setGemsPasteError(""); }}
            className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200"
          >
            ביטול
          </button>
          <button
            onClick={handleApplyGemsJson}
            disabled={!gemsPasteInput.trim()}
            className="px-5 py-2 text-sm bg-violet-600 text-white rounded-lg disabled:opacity-50 hover:bg-violet-700 font-semibold"
          >
            החל ניתוח
          </button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
