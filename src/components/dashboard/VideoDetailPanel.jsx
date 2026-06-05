import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
import { fetchTranscript, fetchTranscriptPayload, getBestTranscript, parseTranscript, validateTranscriptUsable, clearTranscriptCache } from "@/services/youtubeTranscript";
import { clearSegments } from "@/lib/localSegmentStore";
import { deleteChunks } from "@/lib/localChunkStore";
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
import { buildVideoFullNote, buildObsidianUrl, openObsidianUrl, downloadMarkdown, getSelectedAtomicKnowledge, resolvePrimaryTopic } from "@/lib/obsidianExport";
import { getManualNotesByTopic } from "@/lib/localManualNoteStore";
import { createKnowledgeItemFromVideo, getKnowledgeItems, upsertKnowledgeItem } from "@/lib/localKnowledgeItemStore";
import { CategoryBadge } from "./CategoryBadge";
import { LearningStatusBadge, LEARNING_STATUSES } from "./LearningStatusBadge";
import { SaveButton } from "./SaveButton";
import { NoteEditor } from "./NoteEditor";
import ChapterItem from "./ChapterItem";
import { BrainDestinationPicker } from "./BrainDestinationPicker";
import { QUICK_COPY_ACTIONS, QUICK_COPY_GROUPS } from "@/ai/quickCopyPrompts";
import { classifyVideoForGem, GEM_ALT_OPTIONS, GEM_CATEGORY_MAP, getGemSubCategoryFallback, normalizeCategoryName } from "@/lib/gemRecommender";
import { getGemUrl, openGeminiGemUrl } from "@/lib/gemsConfig";
import { resolveChannelToMentor } from "@/lib/channelMentorResolver";
import { hasObsidianSavedStatus, getBrainSaveButtonLabel } from "@/lib/obsidianSavedStatus";
import { getTopicRule } from "@/lib/topicRules";
import { isBase44Enabled } from "@/config/base44Flags";
import { useThumbnailFallback } from "@/hooks/useThumbnailFallback";

// ── PanelThumbnail — uses full fallback chain + gray-placeholder detection ────
function PanelThumbnail({ video }) {
  const youtubeId = video?.youtubeId;
  const storedUrl = video?.thumbnail || video?.thumbnailUrl;

  const { src, status, onError: hookOnError, onLoad: hookOnLoad, refresh } = useThumbnailFallback({
    youtubeId,
    storedUrl,
  });

  useEffect(() => {
    if (youtubeId) {
      console.log(`[Thumbnail] videoId=${youtubeId}`);
      console.log(`[Thumbnail] original url=${storedUrl || '(none)'}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeId]);

  const handleLoad = useCallback((e) => {
    console.log(`[Thumbnail] load success — videoId=${youtubeId} url=${src}`);
    hookOnLoad(e);
  }, [youtubeId, src, hookOnLoad]);

  const handleError = useCallback(() => {
    console.log(`[Thumbnail] load failed — videoId=${youtubeId} url=${src}`);
    console.log(`[Thumbnail] fallback activated — videoId=${youtubeId}`);
    hookOnError();
  }, [youtubeId, src, hookOnError]);

  if (status === 'failed') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-100 dark:bg-zinc-900">
        <span className="text-slate-400 dark:text-zinc-500 text-sm select-none">📺 אין תמונה זמינה</span>
        {youtubeId && (
          <button
            type="button"
            onClick={() => {
              console.log(`[Thumbnail] manual refresh — videoId=${youtubeId}`);
              refresh();
            }}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            רענן תמונת סרטון
          </button>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={video?.title}
      className="w-full h-full object-cover"
      onError={handleError}
      onLoad={handleLoad}
    />
  );
}

// ── ErrorBoundary for political tab content ──────────────────────────────────
class PoliticalTabBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) {
    console.error('[Render Error] political tab failed:', error.message, error.stack?.split('\n')[1]?.trim());
  }
  render() {
    if (this.state.error) {
      return (
        <div dir="rtl" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-right dark:border-red-800/50 dark:bg-red-950/20">
          <p className="text-sm font-bold text-red-700 dark:text-red-300">אירעה שגיאה בהצגת הטאב — בדוק Console</p>
          <p className="text-xs text-red-500 dark:text-red-400 mt-1 font-mono">{this.state.error.message}</p>
          <button type="button" onClick={() => this.setState({ error: null })} className="mt-2 text-xs text-red-600 hover:underline dark:text-red-400">נסה שוב</button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

const PROVIDER_LABELS = { claude: "Claude", gemini: "Gemini", "llama3.2": "llama3.2", gems: "GEMS JSON" };

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
// GEMS JSON repair helpers

function repairGemsJson(raw) {
  let s = raw.trim();
  const fixes = [];

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  if (/^```(?:json)?\s*/i.test(s)) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    fixes.push('Removed markdown wrapper');
  }

  // Skip leading non-JSON text before first { or [
  const jsonStart = s.search(/[{[]/);
  if (jsonStart > 0) {
    s = s.slice(jsonStart);
    fixes.push('Skipped leading non-JSON text');
  }

  // Fix curly/smart quotes → standard ASCII quotes
  const beforeQuotes = s;
  s = s.replace(/[“”„‟]/g, '"').replace(/[‘’‚‛]/g, "'");
  if (s !== beforeQuotes) fixes.push('Fixed smart/curly quotes');

  // Remove trailing commas before } or ]
  const beforeTrailing = s;
  s = s.replace(/,(\s*[}\]])/g, '$1');
  if (s !== beforeTrailing) fixes.push('Fixed trailing comma');

  // Remove ASCII control chars except tab/newline/carriage-return (handled below)
  const beforeControl = s;
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  if (s !== beforeControl) fixes.push('Removed control characters');

  // Escape literal newlines / carriage-returns / tabs embedded inside JSON string values.
  // JSON spec forbids unescaped \n \r \t inside string literals.
  // AI models sometimes emit real line-breaks inside strings → "Bad control character" error.
  {
    const beforeNl = s;
    let out = '';
    let inS = false, esc = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (esc) { out += c; esc = false; continue; }
      if (c === '\\' && inS) { out += c; esc = true; continue; }
      if (c === '"') { inS = !inS; out += c; continue; }
      if (inS) {
        if (c === '\n') { out += '\\n'; continue; }
        if (c === '\r') { out += '\\r'; continue; }
        if (c === '\t') { out += '\\t'; continue; }
      }
      out += c;
    }
    s = out;
    if (s !== beforeNl) fixes.push('Escaped literal line-breaks inside strings');
  }

  // Remove extra/unmatched closing brackets/braces
  {
    const removeSet = new Set();
    const sc = [];
    let inS = false, esc = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (esc) { esc = false; continue; }
      if (c === '\\' && inS) { esc = true; continue; }
      if (c === '"') { inS = !inS; continue; }
      if (inS) continue;
      if (c === '{') sc.push({ c: '}', i });
      else if (c === '[') sc.push({ c: ']', i });
      else if (c === '}' || c === ']') {
        if (sc.length && sc[sc.length - 1].c === c) sc.pop();
        else removeSet.add(i);
      }
    }
    if (removeSet.size > 0) {
      s = [...s].filter((_, idx) => !removeSet.has(idx)).join('');
      fixes.push(`Removed ${removeSet.size} extra closing bracket(s)`);
    }
  }

  // Balance missing closing brackets/braces (scans outside string literals)
  const stack = [];
  let inStr = false, escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\' && inStr) { escaped = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') { if (stack.length && stack[stack.length - 1] === c) stack.pop(); }
  }
  if (stack.length > 0) {
    const closing = stack.reverse().join('');
    s = s + '\n' + closing;
    fixes.push(`Added missing closing bracket(s): ${closing}`);
  }

  // Escape unescaped quotes inside string values.
  // Pass 1 (regex): Hebrew gershayim כ"ט / abbreviations (word-char " word-char).
  //   ְ-׿ covers the full Hebrew Unicode block (alef–tav, nikud, punctuation)
  const beforeGershayim = s;
  s = s.replace(/([ְ-׿\w])"([ְ-׿\w])/g, '$1\\"$2');
  if (s !== beforeGershayim) fixes.push('Escaped Hebrew gershayim / in-word quote(s)');

  // Pass 2 (position-based): remaining unescaped quotes caught by parse error position.
  //   Works in Chrome <120 / Node.js where error message contains "position N" / "at N".
  let quoteFixes = 0;
  for (let attempt = 0; attempt < 15; attempt++) {
    try { JSON.parse(s); break; } catch (err) {
      const loc = getJsonErrorLocation(s, err.message);
      if (!loc || loc.pos <= 0) break;
      if (s[loc.pos - 1] !== '"') break;
      s = s.slice(0, loc.pos - 1) + '\\"' + s.slice(loc.pos);
      quoteFixes++;
    }
  }
  if (quoteFixes > 0) fixes.push(`Escaped ${quoteFixes} additional unescaped quote(s)`);

  fixes.forEach(fix => console.log(`[JSON Repair] ${fix}`));
  if (fixes.length === 0) console.log('[JSON Repair] No automatic fixes needed');
  return s;
}

function getJsonErrorLocation(raw, errMsg) {
  // Chrome/Node: "at position N" or "position N"
  const posMatch = errMsg.match(/position (\d+)/i);
  if (posMatch) {
    const pos = parseInt(posMatch[1], 10);
    const before = raw.slice(0, pos);
    const lines = before.split('\n');
    return { pos, line: lines.length, col: lines[lines.length - 1].length + 1, char: raw[pos] ?? 'EOF' };
  }
  // Firefox: "at line N column M of the JSON data"
  const lcMatch = errMsg.match(/line (\d+) column (\d+)/i);
  if (lcMatch) {
    const line = parseInt(lcMatch[1], 10);
    const col = parseInt(lcMatch[2], 10);
    const rawLines = raw.split('\n');
    let pos = 0;
    for (let i = 0; i < line - 1 && i < rawLines.length; i++) pos += rawLines[i].length + 1;
    pos += col - 1;
    return { pos, line, col, char: raw[pos] ?? 'EOF' };
  }
  // Fallback: bare "at N"
  const atMatch = errMsg.match(/\bat (\d+)\b/);
  if (atMatch) {
    const pos = parseInt(atMatch[1], 10);
    const before = raw.slice(0, pos);
    const lines = before.split('\n');
    return { pos, line: lines.length, col: lines[lines.length - 1].length + 1, char: raw[pos] ?? 'EOF' };
  }
  return null;
}

function translateJsonError(msg) {
  if (!msg) return null;
  const m = String(msg);
  if (/Unexpected string/i.test(m)) return { en: 'Unexpected string', he: 'מחרוזת לא צפויה — ייתכן חסרה פסיק או טקסט מחוץ ל-JSON' };
  if (/Expected.*,/i.test(m) || /Missing comma/i.test(m)) return { en: 'Missing comma', he: 'חסרה פסיק בין שדות' };
  if (/Unexpected token/i.test(m)) return { en: 'Unexpected token', he: 'תו לא צפוי — בעיה בתחביר' };
  if (/Unexpected end/i.test(m)) return { en: 'Unexpected end of JSON', he: 'ה-JSON לא הושלם — ייתכן חסרים סוגריים בסוף' };
  if (/Expected.*:/i.test(m)) return { en: 'Missing colon', he: 'חסרה נקודתיים' };
  if (/Extra data/i.test(m)) return { en: 'Extra data after JSON', he: 'טקסט מחוץ ל-JSON' };
  return { en: m, he: 'שגיאת תחביר' };
}

function getJsonErrorContext(raw, pos, linesBefore = 3, linesAfter = 3) {
  if (pos == null || pos < 0) return null;
  const lines = raw.split('\n');
  const before = raw.slice(0, pos);
  const errorLineIdx = before.split('\n').length - 1;
  const start = Math.max(0, errorLineIdx - linesBefore);
  const end = Math.min(lines.length - 1, errorLineIdx + linesAfter);
  return lines.slice(start, end + 1).map((text, i) => ({
    lineNum: start + i + 1,
    text,
    isError: start + i === errorLineIdx,
  }));
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
  const [geminiAnalysisMode, setGeminiAnalysisMode] = useState("smart");
  const [geminiAnalysisSource, setGeminiAnalysisSource] = useState(null);
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
  const [gemsParsedErrorInfo, setGemsParsedErrorInfo] = useState(null);
  const [gemsRepairApplied, setGemsRepairApplied] = useState(false);
  const [gemsErrorContext, setGemsErrorContext] = useState(null);
  const [gemsJsonApplied, setGemsJsonApplied] = useState(false);
  const [politicalSummary, setPoliticalSummary] = useState(null);
  const [isPoliticalSummaryLoading, setIsPoliticalSummaryLoading] = useState(false);
  const [politicalSummaryError, setPoliticalSummaryError] = useState(null);
  const [savedPsSections, setSavedPsSections] = useState({});
  const [brainPickerOpen, setBrainPickerOpen] = useState(false);
  const [pendingBrainSave, setPendingBrainSave] = useState(null);
  const [saveAllConfirmOpen, setSaveAllConfirmOpen] = useState(false);
  const [saveAllContent, setSaveAllContent] = useState(null);
  const [categoryOverride, setCategoryOverride] = useState(null);
  const [subCategoryOverride, setSubCategoryOverride] = useState(null);
  const [recApplied, setRecApplied] = useState(false);
  const [vaultSubtopics, setVaultSubtopics] = useState([]);
  const [gemOverride, setGemOverride] = useState(null);
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [transcriptSearchIndex, setTranscriptSearchIndex] = useState(0);
  const hasSavedAnalysis = !!savedAnalysisMeta;
  const queryClient = useQueryClient();

  useEffect(() => { setShowLowQualityWarning(false); }, [video?.id]);
  useEffect(() => { setSelectedItems(video?.selectedKnowledgeItems ?? {}); }, [video?.id]);
  useEffect(() => {
    if (!video) { setPoliticalSummary(null); return; }
    const key = `political_summary_${video.id || video.youtubeId}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log(`[PoliticalSummary] loaded from JSON for videoId=${video.id || video.youtubeId}`);
        setPoliticalSummary(parsed);
      } else {
        setPoliticalSummary(null);
      }
    } catch { setPoliticalSummary(null); }
    setPoliticalSummaryError(null);
  }, [video?.id, video?.youtubeId]);
  useEffect(() => {
    const videoId = video?.youtubeId || video?.id;
    if (!videoId) { setSavedPsSections({}); return; }
    const prefix = `political:${videoId}:`;
    const saved = {};
    getKnowledgeItems().forEach(item => {
      if (item.id?.startsWith(prefix)) saved[item.id.slice(prefix.length)] = true;
    });
    setSavedPsSections(saved);
  }, [video?.id, video?.youtubeId]);
  useEffect(() => {
    if (!isGemsPasteOpen) return;
    const saved = video?.id ? (localStorage.getItem(`gems-paste-${video.id}`) || '') : '';
    setGemsPasteInput(saved);
    setGemsPasteError('');
    setGemsParsedErrorInfo(null);
    setGemsRepairApplied(false);
    setGemsErrorContext(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGemsPasteOpen]);
  useEffect(() => {
    setCategoryOverride(null);
    setSubCategoryOverride(null);
    setRecApplied(false);
    setVaultSubtopics([]);
    setGemOverride(video?.gemOverride ?? null);
    const appliedKey = video?.id ? `gems-applied-${video.id}` : null;
    setGemsJsonApplied(appliedKey ? localStorage.getItem(appliedKey) === 'true' : false);
  }, [video?.id]); // eslint-disable-line react-hooks/exhaustive-deps
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
    const firstTopicId = Array.isArray(video.topicIds) ? video.topicIds[0] : null;
    const forcedTopicName = firstTopicId ? (topics.find(t => t.id === firstTopicId)?.name ?? null) : null;
    const result = classifyVideoForGem(video, transcriptText, { forcedCategoryLabel, forcedTopicName });
    console.log('[GemDecision]', {
      channel: video?.channelTitle || video?.channelName || video?.channel || '',
      mentorCategory: forcedCategoryLabel ?? 'none',
      topic: forcedTopicName ?? 'none',
      subTopic: result.recommendedSubCategory,
      aiCategory: result.recommendedCategoryLabel,
      selectedGem: result.gemKey,
      decisionSource: mentorResolved
        ? (forcedTopicName ? 'topic_hard_rule' : 'channel_hard_rule')
        : 'ai_classification',
    });
    return result;
  }, [video?.id, video?.title, video?.channelTitle, video?.category, video?.contentType, video?.tags, video?.topicIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveGemInfo = useMemo(() => {
    if (!gemRec) return null;
    if (gemOverride) {
      const manual = GEM_ALT_OPTIONS.find(g => g.key === gemOverride);
      if (manual) {
        const manualCatMap = GEM_CATEGORY_MAP[manual.key];
        return {
          ...gemRec,
          gemKey: manual.key,
          gemLabel: manual.label,
          gemIcon: manual.icon,
          recommendedCategoryLabel: manualCatMap?.categoryLabel ?? gemRec.recommendedCategoryLabel,
          isManual: true,
        };
      }
    }
    return { ...gemRec, isManual: false };
  }, [gemRec, gemOverride]);

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

  useEffect(() => {
    setTranscriptSearchIndex(0);
    const timer = setTimeout(() => {
      document.getElementById("ts-match-0")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return () => clearTimeout(timer);
  }, [transcriptSearch]);

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
    const saved = loadSavedAnalysis(video.id);
    if (saved) {
      console.log(`[AI Analysis] loaded from storage for videoId=${video.id}`);
      setSavedAnalysisMeta(extractSavedAnalysisMeta(saved));
      return;
    }
    // Fallback: derive from video fields when no formal save exists
    if (video.analysisProvider && (video.shortSummary || video.fullSummary || video.keyInsights?.length)) {
      console.log(`[AI Analysis] loaded from storage for videoId=${video.id} (fallback from video state)`);
      setSavedAnalysisMeta({
        provider: video.analysisProvider,
        providerLabel: PROVIDER_LABELS[video.analysisProvider] ?? 'ניתוח קיים',
        savedAt: video.analyzedAt || null,
      });
    } else {
      console.log(`[AI Analysis] no saved analysis found for videoId=${video.id}`);
      setSavedAnalysisMeta(null);
    }
  }, [video?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

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
      warnings: Array.isArray(savedAnalysis.warnings) ? savedAnalysis.warnings : undefined,
      concepts: Array.isArray(savedAnalysis.concepts) ? savedAnalysis.concepts : undefined,
      frameworks: Array.isArray(savedAnalysis.frameworks) ? savedAnalysis.frameworks : undefined,
      thesis: Array.isArray(savedAnalysis.thesis) ? savedAnalysis.thesis : undefined,
      questions: Array.isArray(savedAnalysis.questions) ? savedAnalysis.questions : undefined,
      checklists: Array.isArray(savedAnalysis.checklists) ? savedAnalysis.checklists : undefined,
      brainSummary: savedAnalysis.brainSummary ?? undefined,
      contentType: savedAnalysis.contentType ?? undefined,
      mainClaim: savedAnalysis.mainClaim ?? undefined,
      speakerPosition: savedAnalysis.speakerPosition ?? undefined,
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
    const catLabel = categoryOverride ?? gemRec.recommendedCategoryLabel ?? null;
    const subCat = subCategoryOverride ?? gemRec.recommendedSubCategory ?? 'כללי';
    const firstTopicId = Array.isArray(video?.topicIds) ? video.topicIds[0] : null;
    const topicName = firstTopicId ? (topics.find(t => t.id === firstTopicId)?.name ?? null) : null;
    const topicRule = topicName ? getTopicRule(topicName) : null;
    const obsidianTopic = topicRule?.obsidianPrimary ?? null;
    await saveVideoFields({ category: catLabel, subCategory: subCat, ...(obsidianTopic ? { obsidianTopic } : {}) });
    setRecApplied(true);
    toast.success('המלצת הניתוח נשמרה לסרטון');
  }, [gemRec, categoryOverride, subCategoryOverride, saveVideoFields, video?.topicIds, topics]);

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

  const handleAutoDetectChapters = async () => {
    setYoutubeChaptersHint(null);

    // Debug: log current state before detection
    const _apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    const _segs = storedTranscriptSegments; // closure — defined later in render scope, initialized by call time
    console.log(`[Chapters] transcriptExists=${Boolean(_segs?.length > 0)} apiKeyExists=${Boolean(_apiKey?.trim())} chapterSource=${chapterSourceInfo?.source ?? 'none'}`);

    // Step 1: check existing description for timestamps (no API call needed)
    const existingDesc = typeof video?.description === 'string' ? video.description.trim() : '';
    if (existingDesc) {
      const descChapters = extractTimestampsFromDescription(existingDesc);
      if (descChapters.length >= 2) {
        const aiChapters = descChapters.map((c) => ({
          ...c,
          timeSource: c.timeSource || 'real',
          chapterSource: 'description_timestamp',
          source: 'description_timestamp',
        }));
        const updates = {
          aiChapters,
          chapters: aiChapters,
          descriptionChapters: aiChapters,
          chapterSource: 'description_timestamp',
          analysisQuality: 'medium',
        };
        const localSaved = patchVideo(updates);
        if (localSaved) {
          onVideoPatch?.(localSaved);
        } else {
          try {
            await Video.update(video.id, updates);
            patchVideo(updates);
            queryClient.invalidateQueries({ queryKey: ['videos'] });
            onVideoPatch?.({ ...video, ...updates });
          } catch {
            toast.error('לא ניתן לשמור את הפרקים');
          }
        }
        toast.success(`נמצאו ${aiChapters.length} פרקים מתיאור הסרטון`);
        return;
      }
    }

    // Step 2: if transcript is already loaded locally, generate chapters directly — no YouTube API needed
    if (_segs?.length) {
      console.log(`[Chapters] transcript available (${_segs.length} segments) — generating without YouTube API`);
      handleGenerateTranscriptChapters();
      return;
    }

    // Step 3: no description timestamps, no local transcript — try YouTube API
    await handleFetchYoutubeChapters();
  };

  const handleGenerateTranscriptChapters = () => {
    // storedTranscriptSegments is defined later in the render scope — safely accessible here as a closure
    const segs = storedTranscriptSegments;
    if (!segs?.length) {
      toast.error('אין תמלול זמין לצור פרקים');
      return;
    }
    const parsed = {
      lines: segs.map((s) => ({
        text: s.text || '',
        start: s.startSeconds ?? s.start ?? 0,
      })),
    };
    const chapters = generateChaptersFromTranscript(parsed, video);
    if (!chapters?.length) {
      toast.error('התמלול קצר מדי לצור פרקים');
      return;
    }
    const aiChapters = chapters.map((c) => ({
      ...c,
      chapterSource: 'ai_transcript',
      source: 'ai_transcript',
      timeSource: c.timeSource || 'transcript',
    }));
    const updates = { aiChapters, chapters: aiChapters, chapterSource: 'ai_transcript' };
    const localSaved = patchVideo(updates);
    if (localSaved) {
      onVideoPatch?.(localSaved);
    } else {
      Video.update(video.id, updates)
        .then(() => {
          patchVideo(updates);
          queryClient.invalidateQueries({ queryKey: ['videos'] });
          onVideoPatch?.({ ...video, ...updates });
        })
        .catch(() => toast.error('לא ניתן לשמור את הפרקים'));
    }
    setYoutubeChaptersHint(null);
    toast.success(`נוצרו ${aiChapters.length} פרקים מהתמלול`);
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

  const handleGeneratePoliticalSummary = useCallback(async () => {
    if (!fullTranscriptText || fullTranscriptText.trim().length < 100) return;
    setIsPoliticalSummaryLoading(true);
    setPoliticalSummaryError(null);
    try {
      const res = await fetch('/api/political-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video?.youtubeId || video?.id,
          title: video?.title || '',
          transcriptText: fullTranscriptText,
          channelName: video?.channelTitle || video?.channelName || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `שגיאה ${res.status}`);
      const _vid = video?.youtubeId || video?.id;
      if (data.politicalSummary) {
        console.log(`[PoliticalSummary] loaded from JSON for videoId=${_vid}`);
      } else {
        console.log(`[PoliticalSummary] generated fallback for videoId=${_vid}`);
      }
      setPoliticalSummary(data);
      const key = `political_summary_${video?.id || video?.youtubeId}`;
      localStorage.setItem(key, JSON.stringify(data));
      console.log(`[PoliticalSummary] saved for videoId=${_vid}`);
    } catch (err) {
      setPoliticalSummaryError(err.message || 'שגיאה ביצירת הסיכום');
    } finally {
      setIsPoliticalSummaryLoading(false);
    }
  // fullTranscriptText is defined at line ~3011 (after this callback).
  // It's safe to omit from deps — it's recaptured from closure on every render via video change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video]);

  const handleDeletePoliticalSummary = useCallback(() => {
    setPoliticalSummary(null);
    setPoliticalSummaryError(null);
    const key = `political_summary_${video?.id || video?.youtubeId}`;
    localStorage.removeItem(key);
  }, [video]);

  // Auto-generate political summary when video opens and has transcript but no stored summary.
  // Deps: video id + gem key only — does NOT trigger on manual delete (by design).
  useEffect(() => {
    const isPolitical = effectiveGemInfo?.gemKey === 'political';
    const videoId = video?.youtubeId || video?.id;
    if (!isPolitical || !videoId) return;

    // If already stored in localStorage, the load-effect will restore state — skip
    const savedKey = `political_summary_${videoId}`;
    if (localStorage.getItem(savedKey)) return;

    const hasTranscript = (
      (typeof video?.transcript === 'string' && video.transcript.trim().length >= 100) ||
      (typeof video?.manualTranscript === 'string' && video.manualTranscript.trim().length >= 100) ||
      (Array.isArray(video?.transcriptSegments) && video.transcriptSegments.length > 10)
    );
    const hasAnalysisData = (
      video?.keyInsights?.length > 0 ||
      video?.arguments?.length > 0 ||
      video?.knowledgePoints?.length > 0 ||
      video?.viralQuotes?.length > 0
    );

    if (!hasTranscript && !hasAnalysisData) {
      console.log(`[PoliticalSummary] no transcript found for videoId=${videoId}`);
      return;
    }

    console.log(`[PoliticalSummary] transcript exists for videoId=${videoId}`);

    // Has analysis data but no full transcript — build fallback from existing fields
    if (hasAnalysisData && !hasTranscript) {
      const fallback = {
        keyInsights: video.keyInsights || [],
        arguments: video.arguments || [],
        counterArguments: video.counterArguments || [],
        knowledgePoints: video.knowledgePoints || [],
        viralQuotes: video.viralQuotes || [],
        debateResponses: video.debateResponses || [],
      };
      console.log(`[PoliticalSummary] fallback generated for videoId=${videoId}`);
      setPoliticalSummary(fallback);
      localStorage.setItem(savedKey, JSON.stringify(fallback));
      console.log(`[PoliticalSummary] saved for videoId=${videoId}`);
      return;
    }

    // Has transcript — call API for full analysis
    console.log(`[PoliticalSummary] auto generation started for videoId=${videoId}`);
    handleGeneratePoliticalSummary();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id, video?.youtubeId, effectiveGemInfo?.gemKey]);

  const handleSavePsSection = useCallback((sectionKey, sectionLabel, content, sectionTypeOverride) => {
    const videoId = video?.youtubeId || video?.id;
    if (!videoId || !content) return;
    const markdownContent = Array.isArray(content)
      ? content.map((s, i) => `${i + 1}. ${s}`).join('\n')
      : String(content);
    const resolvedSectionType = sectionTypeOverride || 'politicalSummary';
    const itemId = `political:${videoId}:${sectionKey}`;
    const now = new Date().toISOString();
    const item = {
      id: itemId,
      title: `${sectionLabel} — ${video?.title || 'סרטון'}`,
      content: `## ${sectionLabel}\n\n${markdownContent}\n\n---\nמקור: [${video?.title || ''}](https://youtube.com/watch?v=${videoId})\nערוץ: ${video?.channelTitle || video?.channelName || ''}`,
      topicId: video?.topicIds?.[0] || null,
      videoId,
      videoTitle: video?.title || '',
      channelTitle: video?.channelTitle || video?.channelName || '',
      sourceType: 'youtube',
      sourceId: videoId,
      sectionType: resolvedSectionType,
      sectionName: sectionKey,
      workspacePath: (() => {
        const POLITICAL_PATHS = {
          politicalSummary:         'פוליטיקה/סיכום פוליטי',
          ideologyAnalysis:         'פוליטיקה/אידיאולוגיה וערכים',
          theologyAnalysis:         'פוליטיקה/דת ותיאולוגיה',
          liberalJewishPerspective: 'פוליטיקה/יהדות ליברלית',
          opponentView:             'פוליטיקה/דעת הצד השני',
          debateResponses:          'פוליטיקה/תגובות לוויכוחים',
          commentBank:              'פוליטיקה/בנק תגובות',
          campaignKit:              'פוליטיקה/קיט קמפיין',
          reusableKnowledge:        'פוליטיקה/ידע רב פעמי',
        };
        const base = POLITICAL_PATHS[resolvedSectionType] || 'פוליטיקה';
        return `${base}/${(video?.title || videoId).slice(0, 40)}/${sectionLabel}.md`;
      })(),
      createdAt: now,
      updatedAt: now,
      metadata: {
        contentRole: 'my_position',
        perspective: 'self',
        userPosition: 'endorsed',
        sectionType: resolvedSectionType,
        sectionName: sectionKey,
        videoId,
        videoTitle: video?.title || '',
        channelTitle: video?.channelTitle || video?.channelName || '',
        topic: video?.category || null,
        subTopic: video?.subCategory || null,
        createdAt: now,
      },
    };
    upsertKnowledgeItem(item);
    setSavedPsSections(prev => ({ ...prev, [sectionKey]: true }));
    toast.success(`✅ ${sectionLabel} נשמר למוח`);
  }, [video]);

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
      warnings: Array.isArray(v.warnings) ? v.warnings : [],
      concepts: Array.isArray(v.concepts) ? v.concepts : [],
      frameworks: Array.isArray(v.frameworks) ? v.frameworks : [],
      thesis: Array.isArray(v.thesis) ? v.thesis : [],
      questions: Array.isArray(v.questions) ? v.questions : [],
      checklists: Array.isArray(v.checklists) ? v.checklists : [],
      brainSummary: v.brainSummary ?? null,
      contentType: v.contentType ?? null,
      mainClaim: v.mainClaim ?? null,
      speakerPosition: v.speakerPosition ?? null,
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

  const _applyParsedGems = (parsed) => {
    console.log('[GEMS Parse] parsed keys:', Object.keys(parsed || {}).join(', '));
    console.log('[GEMS Parse] has politicalSummary:', !!parsed?.politicalSummary);
    console.log('[GEMS Parse] has theologyAnalysis:', !!(parsed?.theologyAnalysis || parsed?.politicalSummary?.theologyAnalysis));
    console.log('[GEMS Parse] has opponentView:', !!(parsed?.opponentView || parsed?.politicalSummary?.opponentView));
    console.log('[GEMS Parse] has viralQuotes:', !!(parsed?.viralQuotes?.length || parsed?.politicalSummary?.viralQuotes?.length));
    const normalized = normalizeAiAnalysisResult(parsed);
    if (!normalized) { setGemsPasteError("לא זוהה פורמט ניתוח תקין"); return false; }
    console.log('[GEMS JSON] parse success');
    const gemsPatched = persistAnalysisState({ ...normalized, analysisProvider: 'gems', analysisStatus: 'analyzed', analyzedAt: new Date().toISOString() });
    console.log('[GEMS JSON] data mapped to app state');

    // If GEMS JSON contains politicalSummary, persist it immediately
    if (parsed.politicalSummary) {
      const videoId = video?.youtubeId || video?.id;
      if (videoId) {
        const savedKey = `political_summary_${videoId}`;
        localStorage.setItem(savedKey, JSON.stringify(parsed));
        setPoliticalSummary(parsed);
        console.log(`[PoliticalSummary] loaded from GEMS JSON for videoId=${videoId}`);
        console.log(`[PoliticalSummary] saved for videoId=${videoId}`);
      }
    }

    if (video?.id) {
      const nextVideo = { ...video, ...normalized, analysisProvider: 'gems', analysisStatus: 'analyzed', analyzedAt: new Date().toISOString() };
      const snapshot = buildAnalysisSnapshot(nextVideo);
      saveSavedAnalysis(video.id, snapshot);
      setSavedAnalysisMeta(extractSavedAnalysisMeta({ analysisProvider: 'gems', analysisSavedAt: snapshot.analysisSavedAt }));
      localStorage.setItem(`gems-applied-${video.id}`, 'true');
      console.log(`[GEMS JSON] saved for videoId=${video.id}`);
      console.log(`[AI Analysis] saved for videoId=${video.id}`);
    }
    setGemsJsonApplied(true);
    console.log('[GEMS JSON] status updated to valid');

    setGemsPasteError("");
    setGemsParsedErrorInfo(null);
    setGemsRepairApplied(false);
    setIsGemsPasteOpen(false);
    setActiveTab("summary");
    console.log('[Tabs] active tab after analysis: summary');
    toast.success("GEMS JSON נקלט בהצלחה ✓ הנתונים עודכנו");
    toast.success("הניתוח נשמר בהצלחה ✓");
    return true;
  };

  const handleApplyGemsJson = () => {
    const raw = gemsPasteInput.trim();
    if (!raw) { setGemsPasteError("הדבק JSON לפני לחיצה על החל"); return; }
    let parsed;
    let parseErr = null;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      parseErr = err;
    }
    if (parseErr) {
      // Auto-repair attempt
      const repaired = repairGemsJson(raw);
      let repairedParsed;
      try {
        repairedParsed = JSON.parse(repaired);
        console.log('[JSON Repair] parse success');
        setGemsPasteInput(repaired);
        setGemsRepairApplied(true);
        setGemsParsedErrorInfo(null);
        setGemsPasteError("");
        setGemsErrorContext(null);
        try { _applyParsedGems(repairedParsed); } catch (err) { setGemsPasteError(`שגיאה בעיבוד: ${err.message}`); }
        return;
      } catch {
        const loc = getJsonErrorLocation(raw, parseErr.message);
        const translation = translateJsonError(parseErr.message);
        console.log('[JSON Debug] parse failed at line:', loc?.line ?? '?', 'col:', loc?.col ?? '?');
        console.log('[JSON Debug] error message:', parseErr.message);
        const ctx = loc ? getJsonErrorContext(raw, loc.pos) : null;
        if (ctx) console.log('[JSON Debug] context:', ctx.find(l => l.isError)?.text ?? '');
        setGemsParsedErrorInfo(loc ? { ...loc, msg: parseErr.message, translation } : null);
        setGemsErrorContext(ctx);
        const locStr = loc ? ` — שורה ${loc.line}, עמודה ${loc.col}` : '';
        setGemsPasteError(`JSON לא תקין${locStr}`);
        return;
      }
    }
    setGemsParsedErrorInfo(null);
    setGemsErrorContext(null);
    try { _applyParsedGems(parsed); } catch (err) { setGemsPasteError(`שגיאה בעיבוד: ${err.message}`); }
  };

  const handleRepairGemsJson = () => {
    const raw = gemsPasteInput.trim();
    if (!raw) return;
    const repaired = repairGemsJson(raw);
    try {
      JSON.parse(repaired);
      console.log('[JSON Repair] parse success');
      setGemsPasteInput(repaired);
      setGemsRepairApplied(true);
      setGemsParsedErrorInfo(null);
      setGemsPasteError("");
      setGemsErrorContext(null);
      toast.success("JSON תוקן — לחץ 'החל ניתוח' להמשיך");
    } catch (err2) {
      console.log('[JSON Repair] parse failed:', err2.message);
      const loc = getJsonErrorLocation(repaired, err2.message);
      const ctx = loc ? getJsonErrorContext(repaired, loc.pos) : null;
      setGemsPasteInput(repaired);
      setGemsErrorContext(ctx);
      setGemsParsedErrorInfo(loc ? { ...loc, msg: err2.message, translation: translateJsonError(err2.message) } : null);
      setGemsPasteError(loc ? `התיקון האוטומטי נכשל — הבעיה נמצאת ליד שורה ${loc.line}` : "תיקון אוטומטי לא הצליח — ערוך ידנית");
    }
  };

  const handleClearGemsPaste = () => {
    setGemsPasteInput('');
    setGemsPasteError('');
    setGemsParsedErrorInfo(null);
    setGemsRepairApplied(false);
    setGemsErrorContext(null);
    if (video?.id) localStorage.removeItem(`gems-paste-${video.id}`);
  };

  const handleCopyGemsError = () => {
    if (!gemsParsedErrorInfo) return;
    const { line, col, char, msg, translation } = gemsParsedErrorInfo;
    const contextLines = gemsErrorContext
      ? gemsErrorContext.map(ln => `${String(ln.lineNum).padStart(4)}: ${ln.text}${ln.isError ? '  ◀' : ''}`).join('\n')
      : '';
    const report = [
      'JSON Error Report',
      '=================',
      `שגיאה: JSON לא תקין — שורה ${line}, עמודה ${col}`,
      `שורה: ${line} · עמודה: ${col} · תו: "${char}"`,
      translation ? `סיבה: ${translation.en} — ${translation.he}` : `סיבה: ${msg}`,
      '',
      'אזור בעייתי:',
      contextLines,
    ].filter(l => l !== undefined).join('\n');
    navigator.clipboard.writeText(report).then(() => toast.success("שגיאה הועתקה ללוח"));
  };

  const handleDeleteSavedAnalysis = () => {
    deleteSavedAnalysis(video.id);
    localStorage.removeItem(`gems-applied-${video.id}`);
    console.log(`[AI Analysis] deleted for videoId=${video.id}`);
    setSavedAnalysisMeta(null);
    setGemsJsonApplied(false);
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
      warnings: [],
      concepts: [],
      frameworks: [],
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
      console.log(`[AI Analysis] analysis completed`);
      console.log(`[AI Analysis] saved for videoId=${video.id}`);
      toast.success("הניתוח הושלם בהצלחה");
      toast.success("הניתוח נשמר בהצלחה ✓");
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
    const n = video.viewCount ??
              video.views ??
              video.statistics?.viewCount ??
              video.metadata?.viewCount ??
              video.stats?.viewCount;
    if (!n) return null;
    if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M צפיות`;
    if (n >= 1_000)     return `${+(n / 1_000).toFixed(1)}K צפיות`;
    return `${n} צפיות`;
  })();

  const videoDuration = (() => {
    const direct = formatVideoDuration(
      video.duration ??
      video.durationSeconds ??
      video.videoDuration ??
      video.metadata?.duration ??
      video.durationLabel ??
      video.stats?.duration ??
      video.contentDetails?.duration ??
      video.snippet?.duration ??
      video.analysis?.duration
    );
    if (direct) return direct;
    // Fallback: estimate from last aiChapter startSeconds
    const chapters = Array.isArray(video.aiChapters) ? video.aiChapters : [];
    if (chapters.length > 0) {
      const last = chapters[chapters.length - 1];
      const lastSec = typeof last?.startSeconds === 'number' ? last.startSeconds : null;
      if (lastSec !== null && lastSec > 60) return formatVideoDuration(lastSec);
    }
    return null;
  })();

  console.log('[VideoMetadata]', {
    duration: video.duration,
    durationSeconds: video.durationSeconds,
    durationLabel: video.durationLabel,
    'metadata.duration': video.metadata?.duration,
    'stats.duration': video.stats?.duration,
    'contentDetails.duration': video.contentDetails?.duration,
    videoDurationResolved: videoDuration,
    viewCount: video.viewCount,
    views: video.views,
    'statistics.viewCount': video.statistics?.viewCount,
    'metadata.viewCount': video.metadata?.viewCount,
    viewsResolved: viewCountFormatted,
    videoObject: video,
  });
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
    const ytId = video?.videoId || video?.youtubeId || getVideoIdFromUrl(getWatchUrl(video));
    let cleared = 0;

    // Clear per-videoId caches
    if (ytId) {
      if (clearTranscriptCache(ytId)) { cleared++; console.log(`[Transcript Delete] cleared transcript cache for ${ytId}`); }
      if (clearSegments(ytId)) { cleared++; console.log(`[Transcript Delete] cleared segments for ${ytId}`); }
    }
    if (video?.id) {
      try { deleteChunks(video.id); cleared++; console.log(`[Transcript Delete] cleared chunks for ${video.id}`); } catch { /* ok */ }
    }

    // Clear all transcript + analysis fields from video record
    persistAnalysisState({
      transcript: null,
      manualTranscript: null,
      whisperTranscript: null,
      transcriptSegments: null,
      transcriptSource: null,
      transcriptLanguage: null,
      transcriptStatus: "unavailable",
      transcriptError: null,
      transcriptQuality: null,
      transcriptLength: null,
      chapters: [],
      aiChapters: [],
      chapterSource: null,
      analysisStatus: "not_analyzed",
      analysisError: null,
    });

    console.log(`[Transcript Delete] נמחקו ${cleared} רשומות מהזיכרון עבור videoId: ${ytId}`);
    toast.success(`🧹 נמחקו ${cleared} רשומות מהזיכרון עבור: ${ytId || video?.id}`);
  };

  const handleGeminiContent = async () => {
    const ytId = getVideoIdFromUrl(getWatchUrl(video));
    const ytUrl = ytId ? `https://www.youtube.com/watch?v=${ytId}` : null;
    console.log("[Gemini] analysis clicked", { videoId: video.id, mode: geminiAnalysisMode, hasUrl: Boolean(ytUrl) });
    setGeminiStatus("loading");
    setGeminiMessage(null);
    setGeminiAnalysisSource(null);

    try {
      const chapterHints = resolveVideoChapters(video || {});
      const durationSec = getVideoDurationSeconds(video);
      const chaptersTarget = durationSec <= 8 * 60 ? 4 : durationSec <= 14 * 60 ? 5 : durationSec <= 22 * 60 ? 7 : 8;
      const txText = typeof video?.transcript === 'string' && video.transcript.trim().length > 40 ? video.transcript.trim() : null;
      const txSegments = Array.isArray(video?.transcriptSegments) && video.transcriptSegments.length > 0
        ? video.transcriptSegments
        : storedTranscriptSegments?.length > 0 ? storedTranscriptSegments : null;

      const result = await fetchGeminiVideoContent({
        videoId: video.id,
        title: video.title,
        channelName: mentorName || video.channelTitle || video.channelName || '',
        description: typeof video.description === "string" ? video.description : "",
        durationSeconds: durationSec,
        mentor: mentorName || null,
        category: video.category || null,
        chapterHints,
        chaptersTarget,
        analysisMode: geminiAnalysisMode,
        youtubeUrl: ytUrl,
        transcriptText: txText,
        transcriptSegments: txSegments,
      });

      const analysisSource = result?.analysisSource || 'unknown';
      setGeminiAnalysisSource(analysisSource);
      console.log("[Gemini] analysis done", { analysisSource, analysisMode: result?.analysisMode });

      const normalized = validateAiAnalysisQuality(result);
      const rawChapters = Array.isArray(normalized.chapters) ? normalized.chapters : [];
      const normalizedChapters = analysisSource === 'transcript' && txSegments?.length > 0
        ? normalizeTranscriptBackedChapters(rawChapters, txSegments)
        : rawChapters.map((c, i) => ({
            title: String(c?.title || `פרק ${i + 1}`).trim(),
            startSeconds: Number.isFinite(c?.startSeconds) ? c.startSeconds : i * 120,
            endSeconds: Number.isFinite(c?.endSeconds) ? c.endSeconds : null,
            summary: String(c?.summary || '').trim(),
            keyPoints: Array.isArray(c?.keyPoints) ? c.keyPoints : [],
            timeSource: analysisSource === 'youtube_url' ? 'estimated' : 'real',
          }));

      const chaptersValidation = validateChaptersForSave(normalizedChapters, {
        minChapters: 2,
        minSummaryChars: 5,
        requireKeyPoints: false,
        allowNullEndSecondsForLast: true,
        allowGenericTitles: true,
      });

      const chaptersToSave = chaptersValidation.ok ? chaptersValidation.chapters : normalizedChapters;
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
        keyInsights: normalized.keyInsights,
        actionItems: normalized.actionItems,
        mainLesson: normalized.mainLesson,
        strategyOrMethod: normalized.strategyOrMethod || null,
        rules: normalized.rules,
        analysisProvider: 'gemini',
        analysisSource,
        analysisMode: result?.analysisMode || 'transcript',
        analysisStatus: 'saved',
        analysisSavedAt,
        analysisError: null,
        chapterSource: analysisSource === 'youtube_url' ? 'gemini_url' : 'transcript',
        analyzedAt: new Date().toISOString(),
        analysisQuality: calculateAnalysisQuality({
          transcriptText: txText || '',
          transcriptSegments: txSegments || [],
          chapters: chaptersToSave,
          analysisProvider: 'gemini',
          analysisStatus: 'completed',
          transcriptStatus: video.transcriptStatus || null,
          fallbackUsed: false,
          claudeCompleted: false,
        }),
      };

      const saved = persistAnalysisState(patch);
      const nextVideo = { ...(saved || video), ...patch };
      setVideoState(nextVideo);
      const snapshot = { ...buildAnalysisSnapshot(nextVideo), analysisSavedAt };
      saveSavedAnalysis(video.id, snapshot);
      setSavedAnalysisMeta(extractSavedAnalysisMeta({ analysisProvider: 'gemini', analysisSavedAt }));
      console.log(`[AI Analysis] analysis completed`);
      console.log(`[AI Analysis] saved for videoId=${video.id}`);
      onVideoPatch?.(nextVideo);
      onAnalyzeDone?.(nextVideo);

      setAnalyzeError(null);
      setGeminiStatus("success");
      const sourceLabel = analysisSource === 'youtube_url' ? 'ניתוח מבוסס קישור YouTube' : 'ניתוח מבוסס תמלול מלא';
      setGeminiMessage(sourceLabel);
      toast.success(`ניתוח Gemini הושלם — ${sourceLabel}`);
      toast.success("הניתוח נשמר בהצלחה ✓");
    } catch (error) {
      const code = error?.code;
      const message =
        code === "GEMINI_API_KEY_MISSING" || code === "INVALID_KEY"
          ? "Gemini לא מוגדר — חסר או לא תקין API key"
          : code === "NO_TRANSCRIPT"
          ? "Gemini לא הצליח לנתח מה-URL ואין תמלול זמין לגיבוי"
          : error?.message || "Gemini לא הצליח לנתח את הסרטון";
      setGeminiStatus("failed");
      setGeminiMessage(message);
      console.error("[Gemini] analysis failed", message);
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
          : chapterSourceInfo.source === "ai_transcript"
            ? "AI מתמלול"
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

  const transcriptSearchMatches = (() => {
    const q = transcriptSearch.trim().toLowerCase();
    if (!q || !fullTranscriptText) return [];
    const lower = fullTranscriptText.toLowerCase();
    const results = [];
    let pos = 0;
    while (pos < lower.length) {
      const idx = lower.indexOf(q, pos);
      if (idx === -1) break;
      results.push(idx);
      pos = idx + 1;
    }
    return results;
  })();

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
          <div dir="rtl" className="flex flex-col max-w-[1400px] mx-auto bg-white text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">

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
            {/* ── Header Zone (metadata — thumbnail moved to sidebar) ── */}
            <div className="px-4 pt-3 pb-2 flex flex-col gap-1.5 border-b border-slate-100 dark:border-zinc-800" dir="rtl">
              {/* Title + Save button */}
              <div className="flex items-start gap-2 flex-row-reverse">
                <h2 className="flex-1 text-xl font-bold leading-snug text-slate-900 dark:text-zinc-100">
                  {(() => {
                    const watchUrl = getWatchUrl(video) || (video.youtubeId ? `https://www.youtube.com/watch?v=${video.youtubeId}` : null);
                    return watchUrl ? (
                      <a
                        href={watchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >{video.title}</a>
                    ) : video.title;
                  })()}
                </h2>
                <SaveButton isSaved={video.isSaved} onClick={() => onSaveToggle?.(video)} size="md" />
              </div>
              {/* Channel name */}
              {(() => {
                const channelMentorId = resolveChannelToMentor(video)?.mentor?.id ?? null;
                const label = mentorName || video.channelTitle || video.channelName || "";
                if (!label) return null;
                if (channelMentorId && navigateTo) {
                  return (
                    <button
                      type="button"
                      onClick={() => navigateTo("MentorPage", { mentorId: channelMentorId })}
                      className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline text-right w-fit"
                      dir="rtl"
                    >{label}</button>
                  );
                }
                const channelHref = video.channelUrl || (video.channelId ? `https://www.youtube.com/channel/${video.channelId}` : null);
                if (channelHref) {
                  return (
                    <a
                      href={channelHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-slate-700 dark:text-zinc-300 hover:underline w-fit"
                      dir="rtl"
                    >{label}</a>
                  );
                }
                return <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{label}</span>;
              })()}
              {/* Metadata chips — topic, sub-topic, gem, date, duration, views, transcript, obsidian */}
              {(() => {
                const transcriptStatusLabel = (() => {
                  const s = video.transcriptStatus;
                  if (s === "youtube") return "✅ YouTube";
                  if (s === "manual") return "✅ ידני";
                  if (["none", "found_empty_body", "no_caption_tracks", "unavailable"].includes(s)) return "❌ אין";
                  if (s === "missing_timestamps") return "⚠️ חסרות חותמות";
                  if (s === "too_short") return "⚠️ קצר מדי";
                  return null;
                })();
                const gemLabel = effectiveGemInfo ? `${effectiveGemInfo.gemIcon} ${effectiveGemInfo.gemLabel}` : null;
                const ytLogoSm = (
                  <svg viewBox="0 0 90 63" xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-5 rounded-[2px] shrink-0">
                    <rect width="90" height="63" rx="13" fill="#FF0000"/>
                    <path d="M37 16L63 31.5L37 47V16Z" fill="white"/>
                  </svg>
                );
                const chips = [
                  videoTopics[0]?.name ? { label: "נושא", value: videoTopics[0].name } : null,
                  (subCategoryOverride ?? video.subCategory) ? { label: "תת-נושא", value: subCategoryOverride ?? video.subCategory } : null,
                  gemLabel ? { label: "Gem", value: gemLabel } : null,
                  video.publishedAt ? { label: "תאריך", value: format(new Date(video.publishedAt), "dd/MM/yyyy", { locale: he }) } : null,
                  videoDuration ? { label: "אורך", value: videoDuration } : null,
                  viewCountFormatted ? { label: "צפיות", value: viewCountFormatted } : null,
                  transcriptStatusLabel ? { label: "תמלול", value: transcriptStatusLabel, logo: video.transcriptStatus === "youtube" ? ytLogoSm : null } : null,
                  hasObsidianSavedStatus(video) ? { label: "Obsidian", value: "✅ נשמר" } : null,
                ].filter(Boolean);
                if (chips.length === 0) return null;
                return (
                  <div className="flex flex-wrap gap-1.5 pt-0.5 items-center" dir="rtl">
                    {chips.map(({ label, value, logo }) => (
                      <span key={label} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] dark:border-zinc-700 dark:bg-zinc-800">
                        <span className="font-medium text-slate-400 dark:text-zinc-500">{label}:</span>
                        {logo ? (
                          <span className="inline-flex items-center gap-1">
                            {logo}
                            <span className="font-semibold text-slate-700 dark:text-zinc-200">YouTube</span>
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-700 dark:text-zinc-200">{value}</span>
                        )}
                      </span>
                    ))}
                    {hasStoredTranscript && (
                      <button
                        type="button"
                        onClick={handleDeleteTranscript}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] text-red-600 hover:bg-red-100 active:scale-95 transition-colors dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-400"
                      >
                        <span>🧹</span>
                        <span className="font-medium">מחק תמלול מהזיכרון</span>
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
            {/* ── Quick Actions ── */}
            <div className="px-4 py-2 border-b border-slate-100 dark:border-zinc-800">
              <div className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80" dir="rtl">
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="h-3 w-3 text-amber-500 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-400">⚡ פעולות מהירות</span>
                </div>
                {/* Primary actions — grid fills full width */}
                <div className="grid grid-cols-6 gap-2 mb-2">
                  {[
                    {
                      id: 'yt-transcript',
                      emoji: (
                        <svg viewBox="0 0 90 63" xmlns="http://www.w3.org/2000/svg" className="h-5 w-7 rounded-[3px]">
                          <rect width="90" height="63" rx="13" fill="#FF0000"/>
                          <path d="M37 16L63 31.5L37 47V16Z" fill="white"/>
                        </svg>
                      ),
                      label: 'נסה תמלול YouTube',
                      sub: 'תמלול אוטומטי',
                      cn: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300',
                      onClick: handleYtApiTranscript,
                      disabled: isCheckingTranscript,
                      status: { ok: hasStoredTranscript, okLabel: 'קיים', failLabel: 'אין תמלול' },
                    },
                    {
                      id: 'gem-recommended',
                      emoji: effectiveGemInfo?.gemIcon || '✨',
                      label: 'Gem מומלץ',
                      sub: effectiveGemInfo?.gemLabel || 'לא זוהה',
                      labelCn: 'text-[11px] font-bold leading-snug',
                      subCn: 'text-[10px] font-semibold leading-snug opacity-80',
                      cn: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300',
                      onClick: async () => {
                        if (!fullTranscriptText) {
                          toast.error("אין תמלול להעתקה — ייבא או הדבק תמלול קודם");
                          return;
                        }
                        const gemKey = effectiveGemInfo?.gemKey;
                        const gemUrl = gemKey ? getGemUrl(gemKey) : null;
                        if (!gemUrl) {
                          toast.error("לא הוגדר קישור ל-Gem הזה");
                          return;
                        }
                        try {
                          await navigator.clipboard.writeText(fullTranscriptText);
                          toast.success("התמלול הועתק — הדבק אותו ב-Gemini עם Ctrl+V");
                        } catch {
                          toast.error("לא ניתן להעתיק ללוח");
                          return;
                        }
                        openGeminiGemUrl(gemUrl);
                      },
                      status: { ok: !!(effectiveGemInfo && getGemUrl(effectiveGemInfo.gemKey)), okLabel: 'מוגדר', failLabel: 'לא מוגדר' },
                    },
                    {
                      id: 'gems',
                      emoji: '💎',
                      label: 'GEMS JSON',
                      sub: gemsJsonApplied ? 'JSON תקין' : 'הדבק JSON',
                      cn: 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-300',
                      onClick: () => { setIsGemsPasteOpen(true); setGemsPasteError(""); setGemsPasteInput(""); },
                      status: gemsJsonApplied
                        ? { ok: true,  okLabel: 'נטען', failLabel: '' }
                        : { ok: false, okLabel: '', failLabel: 'לא נטען' },
                    },
                    {
                      id: 'save-brain',
                      emoji: '✅',
                      label: 'שמור למוח',
                      sub: 'שמור ידע',
                      cn: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300',
                      onClick: handleSaveAllToBrain,
                      status: { ok: !!video?.savedToBrain, okLabel: 'נשמר', failLabel: 'לא נשמר' },
                    },
                    {
                      id: 'obsidian-primary',
                      emoji: (
                        <svg viewBox="0 0 80 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-[17px]">
                          <path d="M40 2L74 22V74L40 94L6 74V22L40 2Z" fill="#4C1D95"/>
                          <path d="M40 2L74 22L40 42L6 22L40 2Z" fill="#7C3AED"/>
                          <path d="M74 22L40 42V94L74 74V22Z" fill="#5B21B6"/>
                          <path d="M6 22L40 42V94L6 74V22Z" fill="#3B1382"/>
                          <path d="M40 12L60 22L40 36L20 22L40 12Z" fill="#C4B5FD" opacity="0.65"/>
                        </svg>
                      ),
                      label: 'Obsidian',
                      sub: 'פתח ב-Obsidian',
                      cn: 'border-purple-200 bg-white text-purple-700 hover:bg-purple-50 dark:border-purple-800/40 dark:bg-purple-950/20 dark:text-purple-300',
                      onClick: () => { try { openObsidianUrl(buildObsidianUrl(video)); } catch { toast.error("שגיאה בפתיחת Obsidian"); } },
                      status: { ok: hasObsidianSavedStatus(video), okLabel: 'נשמר', failLabel: 'לא נשמר' },
                    },
                    {
                      id: 'transcript-view',
                      emoji: '📋',
                      label: 'תמלול הסרט',
                      sub: hasStoredTranscript ? 'הצג תמלול' : 'הדבק תמלול',
                      cn: 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:border-teal-900/40 dark:bg-teal-950/20 dark:text-teal-300',
                      onClick: hasStoredTranscript ? () => setIsTranscriptViewerOpen(true) : () => setIsManualTranscriptOpen(true),
                      status: { ok: hasStoredTranscript, okLabel: 'תמלול קיים', failLabel: 'אין תמלול' },
                    },
                  ].map(({ id, emoji, label, sub, cn, onClick, disabled, status, labelCn, subCn }) => (
                    <button key={id} type="button" onClick={onClick} disabled={disabled}
                      className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2 w-full text-center transition-all hover:shadow-sm active:scale-95 disabled:opacity-40 ${cn}`}>
                      <span className="flex items-center justify-center h-5 leading-none">
                        {typeof emoji === 'string' ? <span className="text-lg">{emoji}</span> : emoji}
                      </span>
                      <span className={labelCn || "text-[10px] font-semibold leading-snug"}>{label}</span>
                      <span className={subCn || "text-[9px] opacity-55 leading-snug"}>{sub}</span>
                      {status && (
                        <span className={`mt-1 inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                          status.ok
                            ? 'border-emerald-400 bg-emerald-100 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300'
                            : 'border-red-400 bg-red-100 text-red-700 dark:border-red-600 dark:bg-red-900/50 dark:text-red-300'
                        }`}>
                          <span className="text-[9px]">{status.ok ? '✅' : '❌'}</span>
                          <span>{status.ok ? status.okLabel : status.failLabel}</span>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {/* Secondary actions */}
                <div className="flex flex-wrap gap-1.5 border-t border-slate-100 dark:border-zinc-800 pt-2">
                  {[
                    {
                      id: 'markdown',
                      emoji: '📄',
                      label: 'יצוא MD',
                      cn: 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
                      onClick: () => {
                        const note = buildVideoFullNote(video, mentorName, videoNotes);
                        downloadMarkdown(note, `${(video.title || 'video').replace(/[^\w\sא-ת]/g, '').trim().slice(0, 50)}.md`);
                      },
                    },
                  ].map(({ id, emoji, label, cn, onClick, disabled }) => (
                    <button key={id} type="button" onClick={onClick} disabled={disabled}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 transition-all hover:shadow-sm active:scale-95 disabled:opacity-40 text-[11px] font-medium ${cn}`}>
                      <span className="text-xs leading-none">{emoji}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Main Content: Sidebar + Tabs ── */}
            <div className="flex gap-4 items-start px-4 pt-2 pb-4" dir="rtl">

              {/* ── SIDEBAR ── */}
              <div className="w-[340px] shrink-0 flex flex-col gap-3 self-start sticky top-0">
              {/* ── Video Thumbnail Card ── */}
              <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 overflow-hidden">
                <div className="relative aspect-video bg-slate-100 dark:bg-zinc-900">
                  <PanelThumbnail video={video} />
                  <a
                    href={getWatchUrl(video) || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
                    onClick={(e) => { if (!getWatchUrl(video)) e.preventDefault(); }}
                  >
                    <div className="bg-white/90 rounded-full p-3 shadow-lg">
                      <ExternalLink className="h-5 w-5 text-slate-800" />
                    </div>
                  </a>
                </div>
              </div>
              {/* ── Manual Transcript Card ── */}
              <div className="rounded-2xl border border-teal-200 bg-white/90 shadow-sm dark:border-teal-900/40 dark:bg-zinc-900/80 text-right overflow-hidden" dir="rtl">
                <div className="px-4 pt-3 pb-2 text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span className="text-base">📋</span>
                  <span>תמלול ידני</span>
                </div>
                <div className={`px-4 py-2.5 text-sm font-semibold flex items-center gap-2 flex-row-reverse border-y ${
                  hasStoredTranscript
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-950/30 dark:text-emerald-400"
                    : "border-red-200 bg-red-50 text-red-600 dark:border-red-700/40 dark:bg-red-950/30 dark:text-red-400"
                }`}>
                  <span>{hasStoredTranscript ? "✅" : "❌"}</span>
                  <span>{hasStoredTranscript ? "תמלול קיים" : "אין תמלול"}</span>
                </div>
                <div className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setIsManualTranscriptOpen(true)}
                    className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 active:scale-95 transition-all shadow-sm flex-row-reverse"
                  >
                    📋 הדבק תמלול ידני
                  </button>
                </div>
              </div>

              {/* ── Start Analysis Card ── */}
              <div className="rounded-2xl border border-indigo-200 bg-white/90 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/80 text-right overflow-hidden" dir="rtl">
                <div className="px-4 pt-3 pb-2 text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span className="text-base">🧠</span>
                  <span>ניתוח AI</span>
                </div>
                <div className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 flex-row-reverse border-y ${
                  savedAnalysisMeta
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-950/30 dark:text-emerald-400"
                    : "border-slate-200 bg-slate-50 text-slate-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400"
                }`}>
                  <span>{savedAnalysisMeta ? "✅" : "⬜"}</span>
                  <span>{savedAnalysisMeta ? (savedAnalysisMeta.providerLabel || "ניתוח קיים") : "אין ניתוח"}</span>
                </div>
                <div className="px-4 py-3 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleGeminiContent}
                    disabled={geminiStatus === 'loading'}
                    className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-95 transition-all shadow-sm disabled:opacity-50 flex-row-reverse"
                  >
                    {geminiStatus === 'loading' ? (
                      <div className="h-3.5 w-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span>🧠</span>
                    )}
                    {geminiStatus === 'loading' ? 'מנתח...' : 'התחל ניתוח'}
                  </button>
                  {savedAnalysisMeta && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("ai-analysis")}
                      className="w-full h-8 inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 text-indigo-700 text-xs font-medium hover:bg-indigo-50 active:scale-95 transition-all dark:border-indigo-800/40 dark:text-indigo-300 flex-row-reverse"
                    >
                      <span>🔍</span>
                      הצג ניתוח
                    </button>
                  )}
                </div>
              </div>

              {/* ── Workspace Card ── */}
              <div className="rounded-2xl border border-violet-200 bg-white/90 px-4 py-3 shadow-sm dark:border-violet-900/40 dark:bg-zinc-900/80 text-right" dir="rtl">
                <div className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-2 flex items-center gap-1.5">
                  <BookMarked className="h-4 w-4 text-violet-600 shrink-0" />
                  <span>💼 Workspace</span>
                </div>
                <p className={`text-xs font-medium mb-3 ${isSavedInWorkspace ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-zinc-500"}`}>
                  {isSavedInWorkspace ? "✅ שמור ב-Workspace" : "לא שמור עדיין"}
                </p>
                <button
                  type="button"
                  onClick={handleOpenInWorkspace}
                  className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 active:scale-95 transition-all shadow-sm flex-row-reverse"
                >
                  <BookMarked className="h-4 w-4" />
                  פתח ב-Workspace
                </button>
              </div>
              </div>{/* closes sidebar */}

              {/* ── MAIN CONTENT ── */}
              <div className="flex-1 min-w-0">
            {/* Error */}
            {video.status === "error" && video.errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-right">
                <p className="text-sm text-red-700">{video.errorMessage}</p>
              </div>
            )}

            {/* ── טאבים ── */}
            <Tabs id="analysis-tabs" value={activeTab} onValueChange={setActiveTab} className="w-full" dir="rtl">
              <TabsList className="flex w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 gap-0.5 no-scrollbar">
                {[
                  { value: "summary",      label: "סיכום" },
                  { value: "keypoints",    label: "נקודות מפתח" },
                  { value: "chapters",     label: "פרקים" },
                  { value: "notes",        label: "הערות" },
                  { value: "transcript",   label: "📄 תמלול" },
                  { value: "ai-analysis",  label: "🧠 ניתוח AI" },
                  { value: "brain-select", label: "💾 שמור ידע למוח" },
                  ...(effectiveGemInfo?.gemKey === 'political' ? [
                    { value: "ideology",       label: "⚖️ אידיאולוגיה" },
                    { value: "theology",       label: "✡️ דת ותיאולוגיה" },
                    { value: "liberal-jewish", label: "🕊️ יהדות ליברלית" },
                    { value: "opponent",       label: "🗣️ צד שני" },
                    { value: "virals",         label: "🔥 ציטוטים" },
                    { value: "slogans",        label: "📢 סיסמאות" },
                    { value: "debates",        label: "⚔️ ויכוחים" },
                    { value: "comments",       label: "💬 תגובות" },
                    { value: "campaign",       label: "📦 קיט קמפיין" },
                    { value: "reusable",       label: "📚 ידע רב פעמי" },
                    { value: "brain-hi",       label: "🧠 תובנות" },
                  ] : []),
                ].map(({ value, label }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="whitespace-nowrap px-3 text-xs rounded-xl py-2 shrink-0
                      text-slate-500 dark:text-zinc-400
                      data-[state=active]:bg-indigo-600 data-[state=active]:text-white
                      data-[state=active]:font-semibold data-[state=active]:shadow-sm
                      hover:text-slate-700 dark:hover:text-zinc-200
                      transition-all"
                  >
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>

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

                </div>
                {(() => {
                  const isPoliticalVideo = effectiveGemInfo?.gemKey === 'political';

                  // ── Political summary branch ──────────────────────────────
                  if (isPoliticalVideo) {
                    const hasTranscript = fullTranscriptText && fullTranscriptText.trim().length >= 100;

                    if (!hasTranscript) {
                      return (
                        <div className="mt-3 flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-blue-200 bg-blue-50/60 py-8 text-center dark:border-blue-800/40 dark:bg-blue-950/20" dir="rtl">
                          <span className="text-2xl">📋</span>
                          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">אין תמלול — אי אפשר ליצור סיכום פוליטי</p>
                          <p className="text-xs text-blue-600/70 dark:text-blue-400/60">ייבא תמלול מ-YouTube או הדבק ידנית</p>
                        </div>
                      );
                    }

                    if (isPoliticalSummaryLoading) {
                      return (
                        <div className="mt-3 flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-xl border border-blue-200 bg-blue-50/60 py-8 dark:border-blue-800/40 dark:bg-blue-950/20">
                          <div className="h-6 w-6 rounded-full border-2 border-blue-300 border-t-blue-700 animate-spin dark:border-blue-600 dark:border-t-blue-200" />
                          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">מנתח את הסרטון הפוליטי...</p>
                          <p className="text-xs text-blue-600/70 dark:text-blue-400/60">זה יכול לקחת 20–40 שניות</p>
                        </div>
                      );
                    }

                    if (politicalSummaryError && !politicalSummary) {
                      return (
                        <div className="mt-3 space-y-3" dir="rtl">
                          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-300">{politicalSummaryError}</div>
                          <button type="button" onClick={handleGeneratePoliticalSummary} className="inline-flex items-center gap-1.5 flex-row-reverse rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 active:scale-95 transition-all">
                            🔄 נסה שוב
                          </button>
                        </div>
                      );
                    }

                    if (!politicalSummary) {
                      return (
                        <div className="mt-3 flex min-h-[160px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 py-8 text-center dark:border-blue-700/40 dark:bg-blue-950/20" dir="rtl">
                          <span className="text-3xl">🏛️</span>
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-blue-900 dark:text-blue-200">סרטון פוליטי זוהה</p>
                            <p className="text-xs text-blue-600/80 dark:text-blue-400/70">צור סיכום פוליטי מובנה מתוך התמלול</p>
                          </div>
                          <button type="button" onClick={handleGeneratePoliticalSummary} className="inline-flex items-center gap-2 flex-row-reverse rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-sm">
                            <span className="text-base">🏛️</span>
                            צור סיכום פוליטי
                          </button>
                        </div>
                      );
                    }

                    // ── Render 10-section political summary ──────────────
                    // Build display object: prefer nested politicalSummary, fallback from other fields, or old format
                    console.log('[GEMS Parse] rendering political summary — keys:', Object.keys(politicalSummary || {}).join(', '));
                    let _psDisplay = null;
                    if (politicalSummary?.politicalSummary) {
                      _psDisplay = politicalSummary.politicalSummary;
                    } else if (politicalSummary && (
                      politicalSummary.keyInsights?.length ||
                      politicalSummary.arguments?.length ||
                      politicalSummary.knowledgePoints?.length ||
                      politicalSummary.viralQuotes?.length
                    )) {
                      _psDisplay = {
                        shortSummary: politicalSummary.keyInsights?.[0] || '',
                        mainClaim: politicalSummary.arguments?.[0] || '',
                        keyPoints: politicalSummary.knowledgePoints?.slice(0, 8) || [],
                        actorsMap: { speakers: [], attackedGroups: [], defendedGroups: [], targetAudience: [] },
                        supportingArguments: politicalSummary.arguments || [],
                        weaknessesAndCounterpoints: politicalSummary.counterArguments || [],
                        usefulQuotes: politicalSummary.viralQuotes || [],
                        emotionalFraming: [],
                        practicalUse: politicalSummary.debateResponses || [],
                        bottomLine: politicalSummary.keyInsights?.at?.(-1) || '',
                      };
                    } else if (politicalSummary) {
                      const _pu = politicalSummary.practicalUse;
                      _psDisplay = {
                        shortSummary: politicalSummary.shortOverview || politicalSummary.shortSummary || '',
                        mainClaim: politicalSummary.mainClaim || '',
                        keyPoints: politicalSummary.keyPoints || [],
                        actorsMap: politicalSummary.actors ? {
                          speakers: [politicalSummary.actors.speakers].filter(Boolean),
                          attackedGroups: [politicalSummary.actors.attacked].filter(Boolean),
                          defendedGroups: [politicalSummary.actors.protected].filter(Boolean),
                          targetAudience: [politicalSummary.actors.targetAudience].filter(Boolean),
                        } : (politicalSummary.actorsMap || {}),
                        supportingArguments: politicalSummary.argumentsFor || politicalSummary.supportingArguments || [],
                        weaknessesAndCounterpoints: politicalSummary.weaknesses || politicalSummary.weaknessesAndCounterpoints || [],
                        usefulQuotes: politicalSummary.usefulQuotes || [],
                        emotionalFraming: politicalSummary.emotionalTone || politicalSummary.emotionalFraming || [],
                        practicalUse: _pu ? (Array.isArray(_pu) ? _pu : [_pu.replyToPost, _pu.debateArgument, _pu.slogan].filter(Boolean)) : [],
                        bottomLine: politicalSummary.bottomLine || '',
                      };
                    }
                    const ps = _psDisplay;
                    // Safely extract a display string from any value (guards against AI returning objects instead of strings)
                    const safeStr = (v) => {
                      if (v === null || v === undefined) return '';
                      if (typeof v === 'string') return v.trim();
                      if (typeof v === 'object') {
                        const pick = v.point || v.text || v.claim || v.insight || v.fact || v.summary ||
                          v.slogan || v.quote || v.response || v.argument || v.value || v.rule ||
                          v.title || v.content || v.emotion || v.framing;
                        if (pick) return String(pick).trim();
                        const first = Object.values(v).find(x => typeof x === 'string' && x.trim());
                        return first ? first.trim() : JSON.stringify(v);
                      }
                      return String(v);
                    };
                    const emotionColorMap = { כעס:'bg-red-100 text-red-700 border-red-200', פחד:'bg-orange-100 text-orange-700 border-orange-200', תקווה:'bg-emerald-100 text-emerald-700 border-emerald-200', דחיפות:'bg-yellow-100 text-yellow-800 border-yellow-200', בוז:'bg-purple-100 text-purple-700 border-purple-200', הזדהות:'bg-sky-100 text-sky-700 border-sky-200' };
                    const PCard = ({ title, icon, cn, saveKey, saveContent, children }) => {
                      const isSaved = saveKey ? !!savedPsSections[saveKey] : false;
                      return (
                        <div className={`rounded-xl border px-4 py-3 ${cn || 'border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'}`} dir="rtl">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-base leading-none">{icon}</span>
                              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 tracking-wide">{title}</span>
                            </div>
                            {saveKey && (isSaved
                              ? <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">✅ נשמר</span>
                              : <button type="button" onClick={() => handleSavePsSection(saveKey, title, saveContent)}
                                  className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 px-1.5 py-0.5 rounded border border-transparent hover:border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors">
                                  🧠 שמור
                                </button>
                            )}
                          </div>
                          {children}
                        </div>
                      );
                    };
                    return (
                      <PoliticalTabBoundary>
                      <div className="mt-3 space-y-3" dir="rtl">
                        {/* Actions row */}
                        <div className="flex items-center gap-2 flex-row-reverse flex-wrap">
                          <button type="button" onClick={handleGeneratePoliticalSummary} disabled={isPoliticalSummaryLoading} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-700/50 dark:bg-blue-950/30 dark:text-blue-300">🔄 רענן</button>
                          <button type="button" onClick={handleDeletePoliticalSummary} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-400">🗑️ מחק</button>
                          <button type="button" onClick={() => {
                            const sections = [
                              { k: 'shortSummary', l: 'תקציר קצר', c: ps.shortSummary },
                              { k: 'mainClaim', l: 'הטענה המרכזית', c: ps.mainClaim },
                              { k: 'keyPoints', l: 'נקודות מרכזיות', c: ps.keyPoints },
                              { k: 'supportingArguments', l: 'טיעונים בעד', c: ps.supportingArguments },
                              { k: 'weaknesses', l: 'נקודות חולשה', c: ps.weaknessesAndCounterpoints },
                              { k: 'usefulQuotes', l: 'ציטוטים חזקים', c: ps.usefulQuotes },
                              { k: 'bottomLine', l: 'שורה תחתונה', c: ps.bottomLine },
                            ].filter(s => s.c && (typeof s.c === 'string' ? s.c.trim() : s.c.length > 0));
                            sections.forEach(({ k, l, c }) => handleSavePsSection(k, l, c));
                            toast.success(`✅ כל הסיכום נשמר למוח (${sections.length} חלקים)`);
                          }} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700/50 dark:bg-indigo-950/30 dark:text-indigo-300">🧠 שמור הכל למוח</button>
                          <button type="button" onClick={() => {
                            const lines = [
                              ps.shortSummary && `## תקציר קצר\n${ps.shortSummary}`,
                              ps.mainClaim && `## הטענה המרכזית\n${ps.mainClaim}`,
                              ps.keyPoints?.length && `## נקודות מרכזיות\n${ps.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}`,
                              ps.supportingArguments?.length && `## טיעונים בעד\n${ps.supportingArguments.map(a => `- ${a}`).join('\n')}`,
                              ps.weaknessesAndCounterpoints?.length && `## נקודות חולשה\n${ps.weaknessesAndCounterpoints.map(w => `- ${w}`).join('\n')}`,
                              ps.usefulQuotes?.length && `## ציטוטים חזקים\n${ps.usefulQuotes.map(q => `> "${q}"`).join('\n')}`,
                              ps.bottomLine && `## שורה תחתונה\n${ps.bottomLine}`,
                            ].filter(Boolean).join('\n\n');
                            const md = `# ניתוח פוליטי — ${video?.title || ''}\n\n${lines}`;
                            downloadMarkdown(md, `political-${video?.youtubeId || video?.id || 'summary'}.md`);
                          }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">💾 Obsidian</button>
                        </div>

                        {/* 1. תקציר קצר */}
                        {ps.shortSummary && <PCard title="תקציר קצר" icon="📝" cn="border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900" saveKey="shortSummary" saveContent={ps.shortSummary}>
                          <p className="text-sm text-slate-800 dark:text-zinc-200 leading-7">{ps.shortSummary}</p>
                        </PCard>}

                        {/* 2. הטענה המרכזית */}
                        {ps.mainClaim && <PCard title="הטענה המרכזית" icon="🎯" cn="border-indigo-200 bg-indigo-50 dark:border-indigo-800/50 dark:bg-indigo-950/30" saveKey="mainClaim" saveContent={ps.mainClaim}>
                          <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 leading-relaxed">{ps.mainClaim}</p>
                        </PCard>}

                        {/* 3. נקודות מרכזיות */}
                        {ps.keyPoints?.length > 0 && <PCard title="נקודות מרכזיות" icon="📌" cn="border-blue-200 bg-blue-50/60 dark:border-blue-800/40 dark:bg-blue-950/20" saveKey="keyPoints" saveContent={ps.keyPoints}>
                          <ul className="space-y-1.5">
                            {ps.keyPoints.map((pt, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-blue-900 dark:text-blue-100">
                                <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                                <span className="leading-snug">{safeStr(pt)}</span>
                              </li>
                            ))}
                          </ul>
                        </PCard>}

                        {/* 4. מי נגד מי */}
                        {ps.actorsMap && <PCard title="מי נגד מי" icon="⚔️" cn="border-amber-200 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20">
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { label: 'הדובר/ים', value: ps.actorsMap.speakers, icon: '🎤' },
                              { label: 'מי מותקף', value: ps.actorsMap.attackedGroups, icon: '🎯' },
                              { label: 'מי מוגן', value: ps.actorsMap.defendedGroups, icon: '🛡️' },
                              { label: 'קהל יעד', value: ps.actorsMap.targetAudience, icon: '👥' },
                            ].map(({ label, value, icon: aIcon }) => {
                              const display = Array.isArray(value) ? value.join(', ') : value;
                              return display ? (
                                <div key={label} className="rounded-lg bg-amber-100/70 px-2.5 py-2 dark:bg-amber-900/20">
                                  <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mb-0.5">{aIcon} {label}</div>
                                  <div className="text-xs text-amber-900 dark:text-amber-200 leading-snug">{display}</div>
                                </div>
                              ) : null;
                            })}
                          </div>
                        </PCard>}

                        {/* 5 & 6 — טיעונים / חולשות side by side */}
                        <div className="grid grid-cols-2 gap-3">
                          {ps.supportingArguments?.length > 0 && <PCard title="טיעונים בעד" icon="✅" cn="border-emerald-200 bg-emerald-50/60 dark:border-emerald-800/40 dark:bg-emerald-950/20" saveKey="supportingArguments" saveContent={ps.supportingArguments}>
                            <ul className="space-y-1">
                              {ps.supportingArguments.map((a, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-emerald-800 dark:text-emerald-200 leading-snug">
                                  <span className="shrink-0 mt-0.5">•</span><span>{safeStr(a)}</span>
                                </li>
                              ))}
                            </ul>
                          </PCard>}
                          {ps.weaknessesAndCounterpoints?.length > 0 && <PCard title="נקודות חולשה" icon="⚠️" cn="border-orange-200 bg-orange-50/60 dark:border-orange-800/40 dark:bg-orange-950/20" saveKey="weaknesses" saveContent={ps.weaknessesAndCounterpoints}>
                            <ul className="space-y-1">
                              {ps.weaknessesAndCounterpoints.map((w, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-orange-800 dark:text-orange-200 leading-snug">
                                  <span className="shrink-0 mt-0.5">•</span><span>{safeStr(w)}</span>
                                </li>
                              ))}
                            </ul>
                          </PCard>}
                        </div>

                        {/* 7. ציטוטים חזקים */}
                        {ps.usefulQuotes?.length > 0 && <PCard title="ציטוטים חזקים לשימוש" icon="💬" cn="border-violet-200 bg-violet-50/60 dark:border-violet-800/40 dark:bg-violet-950/20" saveKey="usefulQuotes" saveContent={ps.usefulQuotes}>
                          <div className="space-y-2">
                            {ps.usefulQuotes.map((q, i) => {
                              const qStr = safeStr(q);
                              return (
                                <div key={i} className="flex items-start gap-2">
                                  <button type="button" onClick={() => { navigator.clipboard.writeText(qStr); toast.success('הציטוט הועתק'); }} className="shrink-0 h-7 w-7 rounded-lg border border-violet-300 bg-white flex items-center justify-center text-violet-600 hover:bg-violet-100 dark:border-violet-700 dark:bg-zinc-800 dark:hover:bg-violet-900/30">
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                  <div className="flex-1 rounded-lg bg-violet-100/80 px-3 py-2 text-sm text-violet-900 dark:bg-violet-900/20 dark:text-violet-100 leading-snug border-r-2 border-violet-400">&quot;{qStr}&quot;</div>
                                </div>
                              );
                            })}
                          </div>
                        </PCard>}

                        {/* 8. מסגור רגשי */}
                        {ps.emotionalFraming?.length > 0 && <PCard title="מסגור רגשי" icon="🎭" cn="border-pink-200 bg-pink-50/60 dark:border-pink-800/40 dark:bg-pink-950/20">
                          <div className="flex flex-wrap gap-1.5">
                            {ps.emotionalFraming.map((e, i) => {
                              const eStr = safeStr(e);
                              const matched = Object.entries(emotionColorMap).find(([k]) => eStr.includes(k));
                              return <span key={i} className={`rounded-full border px-3 py-1 text-xs font-semibold ${matched ? matched[1] : 'bg-slate-100 text-slate-700 border-slate-200'}`}>{eStr}</span>;
                            })}
                          </div>
                        </PCard>}

                        {/* 9. שימוש פרקטי */}
                        {ps.practicalUse?.length > 0 && <PCard title="שימוש פרקטי" icon="🛠️" cn="border-teal-200 bg-teal-50/60 dark:border-teal-800/40 dark:bg-teal-950/20">
                          <div className="space-y-2">
                            {ps.practicalUse.map((item, i) => {
                              const itemStr = safeStr(item);
                              return (
                                <div key={i} className="rounded-lg bg-teal-100/60 px-3 py-2 dark:bg-teal-900/20">
                                  <div className="flex items-start gap-2">
                                    <button type="button" onClick={() => { navigator.clipboard.writeText(itemStr); toast.success('הועתק'); }} className="shrink-0 h-5 w-5 rounded border border-teal-300 bg-white flex items-center justify-center text-teal-600 hover:bg-teal-100 dark:border-teal-700 dark:bg-zinc-800">
                                      <Copy className="h-3 w-3" />
                                    </button>
                                    <div className="flex-1 text-xs text-teal-900 dark:text-teal-100 leading-snug">{itemStr}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </PCard>}

                        {/* 10. שורה תחתונה */}
                        {ps.bottomLine && (
                          <div className="rounded-xl border-2 border-slate-800 bg-slate-900 px-4 py-3 dark:border-zinc-200 dark:bg-zinc-100" dir="rtl">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">⬇️ שורה תחתונה</div>
                              {savedPsSections['bottomLine']
                                ? <span className="text-[10px] font-semibold text-emerald-400 dark:text-emerald-600">✅ נשמר</span>
                                : <button type="button" onClick={() => handleSavePsSection('bottomLine', 'שורה תחתונה', ps.bottomLine)} className="text-[10px] font-semibold text-slate-400 hover:text-indigo-300 px-1.5 py-0.5 rounded border border-transparent hover:border-indigo-500/50 hover:bg-indigo-950/30 transition-colors">🧠 שמור</button>
                              }
                            </div>
                            <p className="text-sm font-bold text-white dark:text-slate-900 leading-relaxed">{ps.bottomLine}</p>
                          </div>
                        )}
                      </div>
                      </PoliticalTabBoundary>
                    );
                  }

                  // ── Non-political: existing summary logic ─────────────
                  const summaryShort = (video.shortSummary || enrichedVideo.aiSummaryShort)?.replace(/\[MOCK\]\s*/g, '');
                  if (summaryShort) {
                    return (
                      <div className="mt-3 space-y-3">
                        <p className="text-sm text-slate-800 dark:text-zinc-200 leading-7 text-right">{summaryShort}</p>
                        {(claudeMissingMessage || analyzeError) && (
                          <div className="w-full rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-700 text-right leading-relaxed dark:bg-red-950/30 dark:border-red-800/50 dark:text-red-300">
                            {claudeMissingMessage || analyzeError}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveTab("ai-analysis")}
                          className="inline-flex items-center gap-1.5 flex-row-reverse rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800/50 dark:bg-indigo-950/30 dark:text-indigo-300 transition-colors"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          🧠 עבור לניתוח AI מלא
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div className="mt-3 flex min-h-[180px] flex-col items-end gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-8 px-4 text-right dark:border-zinc-800 dark:bg-zinc-950/40" dir="rtl">
                      <div className="flex flex-col gap-2">
                        <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">אין עדיין סיכום לסרטון הזה</p>
                        <p className="text-xs text-slate-400 dark:text-zinc-500">התחל ניתוח AI כדי לקבל סיכום ותובנות</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab("ai-analysis")}
                        className="inline-flex items-center gap-1.5 flex-row-reverse rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800/50 dark:bg-indigo-950/30 dark:text-indigo-300 transition-colors"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        🧠 עבור לניתוח AI מלא
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

              {/* ── Chapters tab ── */}
                <TabsContent value="chapters" className="mt-4 min-h-[320px]" dir="rtl">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">

                    {/* header: title + badge + auto-detect button */}
                    <div className="mb-3 flex items-center justify-between gap-3 flex-row-reverse">
                      <div className="flex items-center gap-2 flex-row-reverse">
                        <h4 className="text-base font-bold text-slate-900 dark:text-zinc-100">פרקי הסרטון</h4>
                        {chapterSourceBadge && (
                          <span className={`text-[10px] border px-1.5 py-0.5 rounded-full ${chapterSourceBadgeClass}`}>
                            {chapterSourceBadge}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleAutoDetectChapters}
                        disabled={isYoutubeChaptersFetch}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-white hover:border-slate-300 disabled:opacity-60 transition-colors dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {isYoutubeChaptersFetch ? "⏳ בודק..." : "🔍 בדוק פרקים אוטומטית"}
                      </button>
                    </div>

                    {/* source message */}
                    {chapterSourceInfo.message && (
                      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 text-right leading-relaxed dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                        {chapterSourceInfo.message}
                      </div>
                    )}

                    {/* hint: no timestamps → offer AI generation */}
                    {youtubeChaptersHint === "no_timestamps" && (
                      <div className="mb-3 flex flex-col items-end gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-right dark:border-zinc-700 dark:bg-zinc-900">
                        <p className="text-xs text-slate-600 dark:text-zinc-400">לא נמצאו timestamps בתיאור הסרטון.</p>
                        {hasStoredTranscript && (
                          <button
                            type="button"
                            onClick={handleGenerateTranscriptChapters}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                          >
                            🤖 צור פרקים בעזרת AI
                          </button>
                        )}
                      </div>
                    )}

                    {/* hint: no API key */}
                    {youtubeChaptersHint === "no_api_key" && (
                      <div className="mb-3 flex flex-col items-end gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-right dark:border-amber-900/40 dark:bg-amber-950/20">
                        <p className="text-xs text-amber-700 dark:text-amber-300">לא הוגדר VITE_YOUTUBE_API_KEY.</p>
                        {hasStoredTranscript && (
                          <button
                            type="button"
                            onClick={handleGenerateTranscriptChapters}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                          >
                            🤖 צור פרקים מהתמלול
                          </button>
                        )}
                      </div>
                    )}

                    {/* hint: fetch error */}
                    {youtubeChaptersHint === "fetch_failed" && (
                      <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 text-right dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                        שגיאה בטעינת נתוני YouTube — נסה שוב.
                      </div>
                    )}

                    {/* chapters list or empty state */}
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
                      <div className="flex min-h-[140px] flex-col items-end justify-center gap-2 text-right" dir="rtl">
                        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">אין עדיין חלוקה לפרקים</p>
                        <p className="text-xs text-slate-400 dark:text-zinc-500">לחץ על 🔍 בדוק פרקים אוטומטית למעלה</p>
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

                {/* ── Transcript tab ── */}
                <TabsContent value="transcript" className="mt-4 min-h-[320px]" dir="rtl">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    {hasStoredTranscript ? (
                      <>
                        {/* Header row */}
                        <div className="flex items-center justify-between mb-3 flex-row-reverse">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">תמלול</h4>
                          <div className="flex items-center gap-2">
                            {transcriptWordCount > 0 && (
                              <span className="text-[11px] text-slate-400 dark:text-zinc-500">~{transcriptWordCount} מילים</span>
                            )}
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(fullTranscriptText).then(() => toast.success('התמלול הועתק')).catch(() => toast.error('לא ניתן להעתיק'))}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              העתק
                            </button>
                          </div>
                        </div>

                        {/* Search bar */}
                        <div className="mb-3 flex items-center gap-2 flex-row-reverse" dir="rtl">
                          <input
                            type="text"
                            value={transcriptSearch}
                            onChange={e => setTranscriptSearch(e.target.value)}
                            placeholder="חפש בתמלול..."
                            className="flex-1 h-8 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-right text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-500"
                            dir="rtl"
                          />
                          {transcriptSearch.trim() && (
                            <div className="flex items-center gap-1.5 flex-row-reverse shrink-0">
                              {transcriptSearchMatches.length > 0 ? (
                                <span className="text-[11px] text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                                  {transcriptSearchIndex + 1} / {transcriptSearchMatches.length} תוצאות
                                </span>
                              ) : (
                                <span className="text-[11px] text-red-400 whitespace-nowrap">לא נמצאו תוצאות בתמלול</span>
                              )}
                              <button
                                type="button"
                                disabled={transcriptSearchMatches.length === 0}
                                onClick={() => {
                                  const next = (transcriptSearchIndex + 1) % transcriptSearchMatches.length;
                                  setTranscriptSearchIndex(next);
                                  document.getElementById(`ts-match-${next}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                                }}
                                className="h-7 w-7 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                title="תוצאה הבאה"
                              >▼</button>
                              <button
                                type="button"
                                disabled={transcriptSearchMatches.length === 0}
                                onClick={() => {
                                  const prev = (transcriptSearchIndex - 1 + transcriptSearchMatches.length) % transcriptSearchMatches.length;
                                  setTranscriptSearchIndex(prev);
                                  document.getElementById(`ts-match-${prev}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                                }}
                                className="h-7 w-7 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                title="תוצאה קודמת"
                              >▲</button>
                            </div>
                          )}
                        </div>

                        {/* Transcript with optional search highlighting */}
                        <div className="max-h-[480px] overflow-auto rounded-xl bg-slate-50 border border-slate-100 px-3 py-3 dark:bg-zinc-950 dark:border-zinc-800">
                          <pre className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans" dir="auto">
                            {(() => {
                              const q = transcriptSearch.trim();
                              if (!q || transcriptSearchMatches.length === 0) return fullTranscriptText;
                              const qLen = q.length;
                              const parts = [];
                              let lastIdx = 0;
                              transcriptSearchMatches.forEach((matchIdx, i) => {
                                if (matchIdx > lastIdx) parts.push(fullTranscriptText.slice(lastIdx, matchIdx));
                                const isCurrent = i === transcriptSearchIndex;
                                parts.push(
                                  <mark
                                    key={`ts-m-${matchIdx}`}
                                    id={`ts-match-${i}`}
                                    style={{ background: isCurrent ? '#fb923c' : '#fef08a', color: '#1e293b', borderRadius: '2px' }}
                                  >
                                    {fullTranscriptText.slice(matchIdx, matchIdx + qLen)}
                                  </mark>
                                );
                                lastIdx = matchIdx + qLen;
                              });
                              if (lastIdx < fullTranscriptText.length) parts.push(fullTranscriptText.slice(lastIdx));
                              return parts;
                            })()}
                          </pre>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-end gap-3 py-8 text-right" dir="rtl">
                        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">אין תמלול זמין לסרטון הזה</p>
                        <div className="flex flex-col gap-2 w-full max-w-xs">
                          <button
                            type="button"
                            onClick={() => setIsManualTranscriptOpen(true)}
                            className="w-full h-9 text-xs font-medium rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1.5 flex-row-reverse dark:bg-indigo-950/30 dark:border-indigo-800/50 dark:text-indigo-300"
                          >
                            <ClipboardList className="h-3.5 w-3.5" />
                            הדבק תמלול ידני
                          </button>
                          <button
                            type="button"
                            onClick={handleYtApiTranscript}
                            disabled={isFetchingYtApiTranscript}
                            className="w-full h-9 text-xs font-medium rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5 dark:bg-emerald-950/30 dark:border-emerald-800/50 dark:text-emerald-300"
                          >
                            {isFetchingYtApiTranscript ? "מביא תמלול..." : "נסה תמלול YouTube"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* ── AI Analysis tab ── */}
                <TabsContent value="ai-analysis" className="mt-4 min-h-[320px]" dir="rtl">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                    {isClaudeAnalysisRunning && (
                      <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 flex items-center gap-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                        <div className="h-4 w-4 border-2 border-indigo-300 border-t-indigo-700 animate-spin rounded-full shrink-0" />
                        <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">ניתוח AI מתבצע...</span>
                      </div>
                    )}
                    {hasSavedAnalysis ? (() => {
                      const summaryShort = (video.shortSummary || enrichedVideo.aiSummaryShort)?.replace(/\[MOCK\]\s*/g, '');
                      const summaryLong  = (video.fullSummary  || enrichedVideo.aiSummaryLong)?.replace(/\[MOCK\]\s*/g, '');
                      return (
                        <>
                          <div className="flex items-center justify-between flex-row-reverse">
                            <span className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                              {savedAnalysisMeta?.providerLabel && `ניתוח: ${savedAnalysisMeta.providerLabel}`}
                              {savedAnalysisMeta?.savedAt && ` · ${format(new Date(savedAnalysisMeta.savedAt), "dd/MM/yyyy HH:mm", { locale: he })}`}
                              {gemsJsonApplied && (
                                <span className="inline-flex items-center gap-0.5 rounded-full border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:border-violet-700/50 dark:bg-violet-900/30 dark:text-violet-300">
                                  💎 מקור: GEMS JSON
                                </span>
                              )}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 border rounded-md px-2 py-0.5 text-[11px] ${analysisQualityUi.className}`}>
                              <span className={`h-2 w-2 rounded-full ${analysisQualityUi.dotClass}`} />
                              {analysisQualityUi.label}
                            </span>
                          </div>
                          {summaryShort && (
                            <div className="text-right">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-1.5">סיכום קצר</h4>
                              <p className="text-sm text-slate-800 dark:text-zinc-200 leading-7">{summaryShort}</p>
                            </div>
                          )}
                          {summaryLong && (
                            <div className="text-right">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-1.5">סיכום מלא</h4>
                              <p className="text-sm text-slate-700 dark:text-zinc-300 leading-7 whitespace-pre-line">{summaryLong}</p>
                            </div>
                          )}
                          {Array.isArray(video.keyInsights) && video.keyInsights.length > 0 && (
                            <div className="text-right">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-2">⚡ תובנות מרכזיות</h4>
                              <ul className="space-y-1.5" dir="rtl">
                                {video.keyInsights.map((insight, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-zinc-300">
                                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                    <span className="leading-relaxed flex-1">{insight}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {Array.isArray(video.actionItems) && video.actionItems.length > 0 && (
                            <div className="text-right">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-2">🔁 פעולות</h4>
                              <ul className="space-y-1.5" dir="rtl">
                                {video.actionItems.map((action, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-zinc-300">
                                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                    <span className="leading-relaxed flex-1">{action}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {Array.isArray(video.rules) && video.rules.length > 0 && (
                            <div className="text-right">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-2">✅ כללים</h4>
                              <ul className="space-y-1.5" dir="rtl">
                                {video.rules.map((rule, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-zinc-300">
                                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                    <span className="leading-relaxed flex-1">{rule}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {video.mainLesson && (
                            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-right dark:border-indigo-800/50 dark:bg-indigo-950/30">
                              <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-1">🎯 לקח מרכזי</h4>
                              <p className="text-sm text-indigo-900 dark:text-indigo-200 leading-relaxed">{video.mainLesson}</p>
                            </div>
                          )}
                        </>
                      );
                    })() : (
                      <div className="flex flex-col items-end gap-4 py-6 text-right" dir="rtl">
                        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">אין עדיין ניתוח AI לסרטון הזה</p>
                        <div className="flex flex-col gap-2 w-full max-w-xs">
                          <div className="flex items-center gap-1 justify-end" dir="rtl">
                            {[
                              { id: 'smart', label: 'חכם ✨' },
                              { id: 'url_only', label: 'URL' },
                              { id: 'transcript_only', label: 'תמלול' },
                            ].map(({ id, label }) => (
                              <button key={id} type="button" onClick={() => setGeminiAnalysisMode(id)}
                                className={`px-2 py-0.5 text-[10px] rounded-md border transition-colors ${geminiAnalysisMode === id ? 'bg-pink-100 border-pink-300 text-pink-800 font-semibold dark:bg-pink-950/40 dark:border-pink-700 dark:text-pink-300' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 dark:bg-zinc-950 dark:border-zinc-700 dark:text-zinc-400'}`}
                              >{label}</button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={handleGeminiContent}
                            disabled={geminiStatus === "loading"}
                            className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 active:scale-95 transition-all shadow-sm flex-row-reverse"
                          >
                            {geminiStatus === "loading" ? <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            נתח עם Gemini
                          </button>
                          <button
                            type="button"
                            onClick={runClaudeAnalysisFromCard}
                            disabled={isClaudeAnalysisRunning}
                            className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 active:scale-95 transition-all shadow-sm flex-row-reverse"
                          >
                            {isClaudeAnalysisRunning ? <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            נתח עם Claude
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* ── Brain select tab ── */}
                <TabsContent value="brain-select" className="mt-4 min-h-[320px]" dir="rtl">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    {selectableAtomicFields.length === 0 ? (
                      <div className="flex flex-col items-end gap-3 py-8 text-right" dir="rtl">
                        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">עדיין אין פריטי ידע — יש לבצע ניתוח AI תחילה</p>
                        <button
                          type="button"
                          onClick={() => setActiveTab("ai-analysis")}
                          className="inline-flex items-center gap-1.5 flex-row-reverse rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800/50 dark:bg-indigo-950/30 dark:text-indigo-300"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          עבור לניתוח AI
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-3 flex-row-reverse">
                          <div className="flex items-center gap-2 flex-row-reverse">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">💾 שמור ידע למוח</h4>
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
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium dark:text-indigo-400"
                            >
                              בחר הכל
                            </button>
                            <button
                              type="button"
                              onClick={() => persistSelectedItems({})}
                              className="text-xs text-slate-400 hover:text-slate-600"
                            >
                              נקה
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-zinc-500 text-right mb-3">
                          {totalSelectedKnowledgeItems > 0
                            ? `נבחרו ${totalSelectedKnowledgeItems} מתוך ${totalSelectableKnowledgeItems}`
                            : 'בחר פריטים כדי לשמור למוח'}
                        </p>
                        <div className="space-y-4 max-h-[420px] overflow-auto pr-1">
                          {selectableAtomicFields.map(({ key: fieldKey, emoji, label, items }) => {
                            const sectionSelected = items.filter((_, idx) => !!selectedItems[`${fieldKey}:${idx}`]).length;
                            return (
                              <div key={fieldKey}>
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{emoji} {label}</span>
                                  <span className="text-[10px] text-slate-400 dark:text-zinc-500">({sectionSelected}/{items.length})</span>
                                </div>
                                <div className="space-y-1.5">
                                  {items.map((item, idx) => {
                                    const itemKey = `${fieldKey}:${idx}`;
                                    const isSelected = !!selectedItems[itemKey];
                                    return (
                                      <button
                                        key={itemKey}
                                        type="button"
                                        onClick={() => persistSelectedItems({ ...selectedItems, [itemKey]: !isSelected })}
                                        className={`w-full flex items-start gap-2 rounded-xl border px-3 py-2.5 shadow-sm text-right transition-all ${isSelected ? 'border-indigo-300 bg-indigo-50/80 dark:border-indigo-700 dark:bg-indigo-950/40' : 'border-slate-200 bg-slate-50/70 dark:border-zinc-700 dark:bg-zinc-900 hover:border-indigo-200'}`}
                                        dir="rtl"
                                      >
                                        <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 text-[9px] font-bold ${isSelected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300 bg-white text-transparent dark:border-zinc-600 dark:bg-zinc-800'}`}>✓</span>
                                        <span className="min-w-0 flex-1 text-sm leading-relaxed text-slate-700 dark:text-zinc-300">{item}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {totalSelectedKnowledgeItems > 0 && (
                          <div className="mt-4 flex justify-end">
                            <button
                              type="button"
                              onClick={handleSaveAllToBrain}
                              className="inline-flex items-center gap-2 flex-row-reverse rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
                            >
                              💾 שמור {totalSelectedKnowledgeItems} פריטים למוח
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </TabsContent>

              {/* ── Political v2.1 Tabs ── */}
              {effectiveGemInfo?.gemKey === 'political' && (() => {
                console.log('[Tabs] available political tabs:', [
                  (politicalSummary?.viralQuotes || politicalSummary?.politicalSummary?.viralQuotes)?.length ? 'virals' : null,
                  (politicalSummary?.opponentView || politicalSummary?.politicalSummary?.opponentView) ? 'opponent' : null,
                  (politicalSummary?.theologyAnalysis || politicalSummary?.politicalSummary?.theologyAnalysis) ? 'theology' : null,
                  (politicalSummary?.ideologyAnalysis || politicalSummary?.politicalSummary?.ideologyAnalysis) ? 'ideology' : null,
                ].filter(Boolean).join(', ') || '(none yet)');
                const _psCopy = (text) => {
                  navigator.clipboard.writeText(String(text))
                    .then(() => toast.success('הועתק'))
                    .catch(() => toast.error('שגיאה בהעתקה'));
                };
                const _psSave = (key, label, val) => {
                  const sectionType =
                    (key.startsWith('viral')    || key === 'viralQuotes')              ? 'viralQuotes' :
                    (key.startsWith('opponent') || key === 'opponentView')             ? 'opponentView' :
                    (key.startsWith('theology'))                                        ? 'theologyAnalysis' :
                    (key.startsWith('liberal')  || key === 'liberalJewishPerspective') ? 'liberalJewishPerspective' :
                    (key.startsWith('slogan')   || key === 'politicalSlogans')          ? 'politicalSlogans' :
                    (key.startsWith('debate')   || key === 'debateResponses')           ? 'debateResponses' :
                    (key.startsWith('comment')  || key === 'commentBank')               ? 'commentBank' :
                    (key.startsWith('campaign') || key === 'campaignKit')               ? 'campaignKit' :
                    (key.startsWith('reusable') || key === 'reusableKnowledge')         ? 'reusableKnowledge' :
                    (key.startsWith('brain')    || key === 'brainHighlights')           ? 'brainHighlights' :
                    (key.startsWith('ideology') || key === 'ideologyAnalysis')          ? 'ideologyAnalysis' :
                    'politicalSummary';
                  handleSavePsSection(key, label, val, sectionType);
                };
                // Dual-structure support: flat (v2.1) with fallback to nested (legacy)
                const _vq  = politicalSummary?.viralQuotes           || politicalSummary?.politicalSummary?.viralQuotes           || [];
                const _ov  = politicalSummary?.opponentView          || politicalSummary?.politicalSummary?.opponentView          || null;
                const _ta  = politicalSummary?.theologyAnalysis      || politicalSummary?.politicalSummary?.theologyAnalysis      || null;
                const _ljp = politicalSummary?.liberalJewishPerspective
                  || politicalSummary?.politicalSummary?.liberalJewishPerspective
                  || politicalSummary?.theologyAnalysis?.liberalJewishPerspective
                  || politicalSummary?.politicalSummary?.theologyAnalysis?.liberalJewishPerspective
                  || _ta?.liberalJewishPerspective
                  || null;
                const _sl  = politicalSummary?.politicalSlogans   || politicalSummary?.politicalSummary?.politicalSlogans   || [];
                const _dr  = politicalSummary?.debateResponses    || politicalSummary?.politicalSummary?.debateResponses    || [];
                const _cb  = politicalSummary?.commentBank        || politicalSummary?.politicalSummary?.commentBank        || [];
                const _ck  = politicalSummary?.campaignKit        || politicalSummary?.politicalSummary?.campaignKit        || null;
                const _rk  = politicalSummary?.reusableKnowledge  || politicalSummary?.politicalSummary?.reusableKnowledge  || null;
                const _bh  = politicalSummary?.brainHighlights    || politicalSummary?.politicalSummary?.brainHighlights    || null;
                const _ia  = politicalSummary?.ideologyAnalysis   || politicalSummary?.politicalSummary?.ideologyAnalysis   || null;

                return (
                  <PoliticalTabBoundary>
                  <>
                    {/* ── 🔥 Viral Quotes Tab ── */}
                    <TabsContent value="virals" className="mt-4 min-h-[320px]" dir="rtl">
                      {!_vq?.length ? (
                        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center py-8 text-slate-400 dark:text-zinc-500">
                          <span className="text-3xl">🔥</span>
                          <p className="text-sm">אין ציטוטים ויראליים עדיין</p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="flex items-center justify-between mb-3 flex-row-reverse">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">🔥 ציטוטים ויראליים</h4>
                            <button
                              type="button"
                              onClick={() => _psSave('viralQuotes', 'ציטוטים ויראליים',
                                _vq.map(q => typeof q === 'string' ? q : (q.quote || String(q)))
                              )}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium dark:text-indigo-400"
                            >🧠 שמור הכל</button>
                          </div>
                          <div className="space-y-2">
                            {_vq.map((item, i) => {
                              const quote = typeof item === 'string' ? item : (item.quote || String(item));
                              const context = (typeof item === 'object' && item !== null) ? item.context : null;
                              return (
                                <div key={i} className="rounded-xl border border-orange-200 bg-orange-50/60 dark:border-orange-800 dark:bg-orange-900/20 px-4 py-3">
                                  <div className="flex items-start gap-2 justify-between">
                                    <div className="flex gap-1.5 items-center shrink-0">
                                      <button type="button" onClick={() => _psCopy(quote)} className="text-slate-400 hover:text-indigo-600">
                                        <Copy className="h-3.5 w-3.5" />
                                      </button>
                                      <button type="button" onClick={() => _psSave(`viral_${i}`, 'ציטוט ויראלי', quote)} className="text-[10px] text-slate-400 hover:text-indigo-600">🧠</button>
                                    </div>
                                    <blockquote className="flex-1 text-sm text-orange-900 dark:text-orange-100 text-right leading-relaxed italic">&quot;{quote}&quot;</blockquote>
                                  </div>
                                  {context && <p className="mt-1 text-[10px] text-orange-700/70 dark:text-orange-300/70 text-right">{context}</p>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    {/* ── 🗣️ Opponent View Tab ── */}
                    <TabsContent value="opponent" className="mt-4 min-h-[320px]" dir="rtl">
                      {!_ov ? (
                        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center py-8 text-slate-400 dark:text-zinc-500">
                          <span className="text-3xl">🗣️</span>
                          <p className="text-sm">אין ניתוח דעת הצד השני עדיין</p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
                          <div className="flex items-center justify-between flex-row-reverse mb-1">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">🗣️ דעת הצד השני</h4>
                            <button
                              type="button"
                              onClick={() => {
                                const ov = _ov;
                                const allContent = [ov.summary, ...(ov.strongestArguments || []), ...(ov.basicAssumptions || []), ...(ov.recommendedResponses || [])].filter(Boolean);
                                _psSave('opponentView', 'דעת הצד השני', allContent);
                              }}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium dark:text-indigo-400"
                            >🧠 שמור הכל</button>
                          </div>
                          {[
                            { key: 'summary',              label: 'סיכום הצד השני',       icon: '📋', color: 'border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800' },
                            { key: 'strongestArguments',   label: 'הטיעונים החזקים ביותר', icon: '💪', color: 'border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-900/20' },
                            { key: 'basicAssumptions',     label: 'הנחות יסוד',            icon: '🔍', color: 'border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-900/20' },
                            { key: 'recommendedResponses', label: 'תגובות מומלצות',         icon: '✍️', color: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-900/20' },
                          ].map(({ key, label, icon, color }) => {
                            const val = _ov[key];
                            if (!val || (Array.isArray(val) && val.length === 0)) return null;
                            return (
                              <div key={key} className={`rounded-xl border px-4 py-3 ${color}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-1.5">
                                    <span>{icon}</span>
                                    <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">{label}</span>
                                  </div>
                                  <button type="button" onClick={() => _psSave(`opponent_${key}`, label, val)} className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600">🧠 שמור</button>
                                </div>
                                {Array.isArray(val) ? (
                                  <ul className="space-y-1.5">
                                    {val.map((v, idx) => (
                                      <li key={idx} className="flex items-start gap-2">
                                        <button type="button" onClick={() => _psCopy(v)} className="mt-0.5 shrink-0 text-slate-400 hover:text-indigo-600">
                                          <Copy className="h-3 w-3" />
                                        </button>
                                        <span className="text-sm text-slate-700 dark:text-zinc-300 leading-snug">{v}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-slate-700 dark:text-zinc-300 leading-7">{String(val)}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </TabsContent>

                    {/* ── ✡️ Theology Tab ── */}
                    <TabsContent value="theology" className="mt-4 min-h-[320px]" dir="rtl">
                      {!_ta ? (
                        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center py-8 text-slate-400 dark:text-zinc-500">
                          <span className="text-3xl">✡️</span>
                          <p className="text-sm">אין ניתוח דתי/תיאולוגי עדיין</p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
                          {_ta.religiousContentDetected === false ? (
                            <p className="text-sm text-slate-500 dark:text-zinc-400 text-right py-6">לא זוהו רכיבים דתיים או תיאולוגיים משמעותיים בסרטון.</p>
                          ) : (
                            <>
                              {[
                                { key: 'religiousTopics',        label: 'נושאים דתיים',            icon: '📖', color: 'border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800' },
                                { key: 'jewishSources',          label: 'מקורות יהודיים',           icon: '📜', color: 'border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-900/20' },
                                { key: 'messianism',             label: 'משיחיות',                 icon: '✨', color: 'border-violet-200 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-900/20' },
                                { key: 'religiousZionism',       label: 'ציונות דתית',              icon: '🏛️', color: 'border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-900/20' },
                                { key: 'jewishValues',           label: 'ערכים יהודיים',             icon: '⭐', color: 'border-yellow-200 bg-yellow-50/60 dark:border-yellow-800 dark:bg-yellow-900/20' },
                                { key: 'conflictingValues',      label: 'ערכים בסתירה',             icon: '⚡', color: 'border-orange-200 bg-orange-50/60 dark:border-orange-800 dark:bg-orange-900/20' },
                                { key: 'universalVsParticular',  label: 'אוניברסלי מול פרטיקולרי', icon: '🌍', color: 'border-teal-200 bg-teal-50/60 dark:border-teal-800 dark:bg-teal-900/20' },
                                { key: 'theologicalAssumptions', label: 'הנחות תיאולוגיות',         icon: '🔮', color: 'border-purple-200 bg-purple-50/60 dark:border-purple-800 dark:bg-purple-900/20' },
                                { key: 'summary',                label: 'סיכום',                   icon: '📋', color: 'border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800' },
                              ].map(({ key, label, icon, color }) => {
                                const val = _ta[key];
                                if (!val || (Array.isArray(val) && val.length === 0)) return null;
                                return (
                                  <div key={key} className={`rounded-xl border px-4 py-3 ${color}`}>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-1.5">
                                        <span>{icon}</span>
                                        <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">{label}</span>
                                      </div>
                                      <button type="button" onClick={() => _psSave(`theology_${key}`, label, val)} className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600">🧠 שמור</button>
                                    </div>
                                    {Array.isArray(val) ? (
                                      <ul className="space-y-1">
                                        {val.map((v, idx) => (
                                          <li key={idx} className="text-sm text-slate-700 dark:text-zinc-300 leading-snug">• {v}</li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-sm text-slate-700 dark:text-zinc-300 leading-7">{String(val)}</p>
                                    )}
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      )}
                    </TabsContent>

                    {/* ── 🕊️ Liberal Jewish Perspective Tab ── */}
                    <TabsContent value="liberal-jewish" className="mt-4 min-h-[320px]" dir="rtl">
                      {!_ljp ? (
                        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center py-8 text-slate-400 dark:text-zinc-500">
                          <span className="text-3xl">🕊️</span>
                          <p className="text-sm">אין ניתוח יהדות ליברלית עדיין</p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-blue-200 bg-blue-50/60 px-4 py-4 shadow-sm dark:border-blue-800/50 dark:bg-blue-950/20 space-y-3">
                          <div className="flex items-center justify-between flex-row-reverse mb-1">
                            <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200">🕊️ יהדות ליברלית</h4>
                            <button type="button" onClick={() => _psSave('liberalJewishPerspective', 'יהדות ליברלית', Object.values(_ljp).flat().filter(Boolean))} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium dark:text-indigo-400">🧠 שמור הכל</button>
                          </div>
                          {[
                            { key: 'supportedValues',       label: 'ערכים נתמכים' },
                            { key: 'concerns',              label: 'חששות' },
                            { key: 'ethicalQuestions',      label: 'שאלות אתיות' },
                            { key: 'relevantJewishSources', label: 'מקורות יהודיים רלוונטיים' },
                            { key: 'bottomLine',            label: 'שורה תחתונה' },
                          ].map(({ key, label }) => {
                            const val = _ljp[key];
                            if (!val || (Array.isArray(val) && val.length === 0)) return null;
                            return (
                              <div key={key} className="rounded-xl border border-blue-200 bg-white/70 dark:border-blue-800 dark:bg-blue-900/30 px-3 py-2">
                                <div className="flex items-center justify-between mb-1">
                                  <button type="button" onClick={() => _psSave(`liberal_${key}`, label, val)} className="text-[10px] text-slate-400 hover:text-indigo-600">🧠</button>
                                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">{label}</span>
                                </div>
                                {Array.isArray(val) ? (
                                  <ul className="space-y-0.5">
                                    {val.map((v, idx) => <li key={idx} className="text-xs text-blue-900 dark:text-blue-200">• {v}</li>)}
                                  </ul>
                                ) : (
                                  <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">{String(val)}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </TabsContent>

                    {/* ── 📢 Slogans Tab ── */}
                    <TabsContent value="slogans" className="mt-4 min-h-[320px]" dir="rtl">
                      {!_sl?.length ? (
                        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center py-8 text-slate-400 dark:text-zinc-500">
                          <span className="text-3xl">📢</span>
                          <p className="text-sm">אין סיסמאות פוליטיות עדיין</p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="flex items-center justify-between mb-3 flex-row-reverse">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">📢 סיסמאות פוליטיות</h4>
                            <button type="button" onClick={() => _psSave('politicalSlogans', 'סיסמאות', _sl.map(s => typeof s === 'string' ? s : (s.slogan || String(s))))} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium dark:text-indigo-400">🧠 שמור הכל</button>
                          </div>
                          <div className="space-y-2">
                            {_sl.map((item, i) => {
                              const slogan     = typeof item === 'string' ? item : (item.slogan || String(item));
                              const tone       = (typeof item === 'object' && item !== null) ? item.tone       : null;
                              const confidence = (typeof item === 'object' && item !== null) ? item.confidence : null;
                              const sourceIdea = (typeof item === 'object' && item !== null) ? item.sourceIdea : null;
                              return (
                                <div key={i} className="rounded-xl border border-purple-200 bg-purple-50/60 dark:border-purple-800 dark:bg-purple-900/20 px-4 py-3">
                                  <div className="flex items-start gap-2 justify-between">
                                    <div className="flex gap-1.5 items-center shrink-0">
                                      <button type="button" onClick={() => _psCopy(slogan)} className="text-slate-400 hover:text-indigo-600"><Copy className="h-3.5 w-3.5" /></button>
                                      <button type="button" onClick={() => _psSave(`slogan_${i}`, 'סיסמה', slogan)} className="text-[10px] text-slate-400 hover:text-indigo-600">🧠</button>
                                    </div>
                                    <p className="flex-1 text-sm font-semibold text-purple-900 dark:text-purple-100 text-right leading-snug">{slogan}</p>
                                  </div>
                                  {(tone || confidence || sourceIdea) && (
                                    <div className="flex flex-wrap gap-1.5 mt-2 justify-end">
                                      {tone       && <span className="rounded-full border border-purple-300 bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-800 dark:text-purple-200">{tone}</span>}
                                      {confidence && <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">{Math.round(Number(confidence) * 100)}%</span>}
                                      {sourceIdea && <span className="text-[10px] text-slate-400 dark:text-zinc-500 italic">{sourceIdea}</span>}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    {/* ── ⚔️ Debate Responses Tab ── */}
                    <TabsContent value="debates" className="mt-4 min-h-[320px]" dir="rtl">
                      {!_dr?.length ? (
                        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center py-8 text-slate-400 dark:text-zinc-500">
                          <span className="text-3xl">⚔️</span>
                          <p className="text-sm">אין תגובות לוויכוחים עדיין</p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="flex items-center justify-between mb-3 flex-row-reverse">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">⚔️ תגובות לוויכוחים</h4>
                            <button type="button" onClick={() => _psSave('debateResponses', 'תגובות לוויכוחים', _dr.map(d => typeof d === 'string' ? d : (`${d.claim ? d.claim + ': ' : ''}${d.response || ''}`)).filter(Boolean))} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium dark:text-indigo-400">🧠 שמור הכל</button>
                          </div>
                          <div className="space-y-3">
                            {_dr.map((item, i) => {
                              const claim    = typeof item === 'string' ? '' : (item.claim    || '');
                              const response = typeof item === 'string' ? item : (item.response || String(item));
                              return (
                                <div key={i} className="rounded-xl border border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-900/20 px-4 py-3 space-y-2">
                                  {claim && (
                                    <div className="rounded-lg bg-red-100/80 dark:bg-red-900/40 px-3 py-2">
                                      <span className="text-[10px] font-bold text-red-600 dark:text-red-400">טענה: </span>
                                      <span className="text-xs text-red-900 dark:text-red-200 leading-snug">{claim}</span>
                                    </div>
                                  )}
                                  <div className="flex items-start gap-2 justify-between">
                                    <div className="flex gap-1.5 items-center shrink-0">
                                      <button type="button" onClick={() => _psCopy(response)} className="text-slate-400 hover:text-indigo-600"><Copy className="h-3.5 w-3.5" /></button>
                                      <button type="button" onClick={() => _psSave(`debate_${i}`, 'תגובה לוויכוח', response)} className="text-[10px] text-slate-400 hover:text-indigo-600">🧠</button>
                                    </div>
                                    <div className="flex-1 text-right">
                                      {claim && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">תגובה: </span>}
                                      <span className="text-sm text-slate-700 dark:text-zinc-300 leading-snug">{response}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    {/* ── 💬 Comment Bank Tab ── */}
                    {!_cb?.length ? (
                      <TabsContent value="comments" className="mt-4 min-h-[320px]" dir="rtl">
                        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center py-8 text-slate-400 dark:text-zinc-500">
                          <span className="text-3xl">💬</span>
                          <p className="text-sm">אין בנק תגובות עדיין</p>
                        </div>
                      </TabsContent>
                    ) : (() => {
                      const toneColors = {
                        analytical:  'border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-900/20',
                        emotional:   'border-pink-200 bg-pink-50/60 dark:border-pink-800 dark:bg-pink-900/20',
                        sarcastic:   'border-yellow-200 bg-yellow-50/60 dark:border-yellow-800 dark:bg-yellow-900/20',
                        factual:     'border-green-200 bg-green-50/60 dark:border-green-800 dark:bg-green-900/20',
                        ideological: 'border-purple-200 bg-purple-50/60 dark:border-purple-800 dark:bg-purple-900/20',
                      };
                      const toneLabels = { analytical: 'אנליטי', emotional: 'רגשי', sarcastic: 'סרקסטי', factual: 'עובדתי', ideological: 'אידיאולוגי' };
                      const grouped = {};
                      _cb.forEach((item, idx) => {
                        const tone    = (typeof item === 'object' && item !== null ? (item.tone || '') : '').toLowerCase();
                        const comment = typeof item === 'string' ? item : (item.comment || String(item));
                        if (!grouped[tone]) grouped[tone] = [];
                        grouped[tone].push({ comment, idx });
                      });
                      return (
                        <TabsContent value="comments" className="mt-4 min-h-[320px]" dir="rtl">
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="flex items-center justify-between mb-3 flex-row-reverse">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">💬 בנק תגובות</h4>
                              <button type="button" onClick={() => _psSave('commentBank', 'בנק תגובות', _cb.map(c => typeof c === 'string' ? c : (c.comment || String(c))))} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium dark:text-indigo-400">🧠 שמור הכל</button>
                            </div>
                            <div className="space-y-4">
                              {Object.entries(grouped).map(([tone, items]) => (
                                <div key={tone}>
                                  {tone && toneLabels[tone] && (
                                    <div className="flex items-center gap-2 mb-2 flex-row-reverse">
                                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${toneColors[tone] || 'border-slate-200 bg-slate-50'}`}>{toneLabels[tone]}</span>
                                    </div>
                                  )}
                                  <div className="space-y-2">
                                    {items.map(({ comment, idx }) => (
                                      <div key={idx} className={`rounded-xl border px-4 py-3 ${toneColors[tone] || 'border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800'}`}>
                                        <div className="flex items-start gap-2 justify-between">
                                          <div className="flex gap-1.5 items-center shrink-0">
                                            <button type="button" onClick={() => _psCopy(comment)} className="text-slate-400 hover:text-indigo-600"><Copy className="h-3.5 w-3.5" /></button>
                                            <button type="button" onClick={() => _psSave(`comment_${idx}`, 'תגובה', comment)} className="text-[10px] text-slate-400 hover:text-indigo-600">🧠</button>
                                          </div>
                                          <p className="flex-1 text-sm text-slate-700 dark:text-zinc-300 text-right leading-relaxed">{comment}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TabsContent>
                      );
                    })()}

                    {/* ── 📦 Campaign Kit Tab ── */}
                    <TabsContent value="campaign" className="mt-4 min-h-[320px]" dir="rtl">
                      {!_ck ? (
                        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center py-8 text-slate-400 dark:text-zinc-500">
                          <span className="text-3xl">📦</span>
                          <p className="text-sm">אין קיט קמפיין עדיין</p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
                          <div className="flex items-center justify-between flex-row-reverse mb-1">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">📦 קיט קמפיין</h4>
                            <button type="button" onClick={() => {
                              const allItems = Object.values(_ck).flat().filter(v => typeof v === 'string' && v.trim());
                              _psSave('campaignKit', 'קיט קמפיין', allItems);
                            }} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium dark:text-indigo-400">🧠 שמור הכל</button>
                          </div>
                          {[
                            { key: 'topSlogans',         label: '📢 סיסמאות מובילות' },
                            { key: 'topQuotes',          label: '💬 ציטוטים מובילים' },
                            { key: 'topComments',        label: '📝 תגובות מובילות' },
                            { key: 'topDebateResponses', label: '⚔️ תגובות ויכוח מובילות' },
                            { key: 'keyIdeas',           label: '💡 רעיונות מרכזיים' },
                          ].map(({ key, label }) => {
                            const val = _ck[key];
                            if (!val || (Array.isArray(val) && val.length === 0)) return null;
                            return (
                              <div key={key} className="rounded-xl border border-indigo-200 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-900/20 px-4 py-3">
                                <div className="flex items-center justify-between mb-2">
                                  <button type="button" onClick={() => _psSave(`campaign_${key}`, label, val)} className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600">🧠 שמור</button>
                                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{label}</span>
                                </div>
                                {Array.isArray(val) ? (
                                  <ul className="space-y-1.5">
                                    {val.map((v, vIdx) => (
                                      <li key={vIdx} className="flex items-start gap-2 justify-between">
                                        <button type="button" onClick={() => _psCopy(v)} className="mt-0.5 shrink-0 text-slate-400 hover:text-indigo-600"><Copy className="h-3 w-3" /></button>
                                        <span className="flex-1 text-sm text-indigo-900 dark:text-indigo-100 text-right leading-snug">{v}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-indigo-900 dark:text-indigo-100 text-right">{String(val)}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </TabsContent>

                    {/* ── 📚 Reusable Knowledge Tab ── */}
                    <TabsContent value="reusable" className="mt-4 min-h-[320px]" dir="rtl">
                      {!_rk ? (
                        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center py-8 text-slate-400 dark:text-zinc-500">
                          <span className="text-3xl">📚</span>
                          <p className="text-sm">אין ידע רב פעמי עדיין</p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
                          <div className="flex items-center justify-between flex-row-reverse mb-1">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">📚 ידע רב פעמי</h4>
                            <button type="button" onClick={() => {
                              const allItems = Object.values(_rk).flat().filter(v => typeof v === 'string' && v.trim());
                              _psSave('reusableKnowledge', 'ידע רב פעמי', allItems);
                            }} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium dark:text-indigo-400">🧠 שמור הכל</button>
                          </div>
                          {[
                            { key: 'principles',         label: '🧩 עקרונות' },
                            { key: 'mentalModels',       label: '🧠 מודלים מנטליים' },
                            { key: 'historicalPatterns', label: '📜 דפוסים היסטוריים' },
                            { key: 'strategicLessons',   label: '♟️ לקחים אסטרטגיים' },
                            { key: 'reusableArguments',  label: '🔄 טיעונים רב פעמיים' },
                          ].map(({ key, label }) => {
                            const val = _rk[key];
                            if (!val || (Array.isArray(val) && val.length === 0)) return null;
                            return (
                              <div key={key} className="rounded-xl border border-teal-200 bg-teal-50/60 dark:border-teal-800 dark:bg-teal-900/20 px-4 py-3">
                                <div className="flex items-center justify-between mb-2">
                                  <button type="button" onClick={() => _psSave(`reusable_${key}`, label, val)} className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600">🧠 שמור</button>
                                  <span className="text-xs font-bold text-teal-700 dark:text-teal-300">{label}</span>
                                </div>
                                {Array.isArray(val) ? (
                                  <ul className="space-y-1.5">
                                    {val.map((v, vIdx) => (
                                      <li key={vIdx} className="flex items-start gap-2 justify-between">
                                        <button type="button" onClick={() => _psCopy(v)} className="mt-0.5 shrink-0 text-slate-400 hover:text-teal-600"><Copy className="h-3 w-3" /></button>
                                        <span className="flex-1 text-sm text-teal-900 dark:text-teal-100 text-right leading-snug">{v}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-teal-900 dark:text-teal-100 text-right">{String(val)}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </TabsContent>

                    {/* ── 🧠 תובנות מרכזיות Tab ── */}
                    <TabsContent value="brain-hi" className="mt-4 min-h-[320px]" dir="rtl">
                      {!_bh ? (
                        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center py-8 text-slate-400 dark:text-zinc-500">
                          <span className="text-3xl">🧠</span>
                          <p className="text-sm">אין תובנות מרכזיות עדיין</p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
                          <div className="flex items-center justify-between flex-row-reverse mb-1">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">🧠 תובנות מרכזיות</h4>
                            <button type="button" onClick={() => {
                              const allItems = Object.values(_bh).flat().filter(v => typeof v === 'string' && v.trim());
                              _psSave('brainHighlights', 'תובנות מרכזיות', allItems);
                            }} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium dark:text-indigo-400">🧠 שמור הכל</button>
                          </div>
                          {[
                            { key: 'topInsights',  label: '⚡ תובנות מובילות' },
                            { key: 'topArguments', label: '💪 טיעונים מובילים' },
                            { key: 'topWarnings',  label: '⚠️ אזהרות' },
                            { key: 'topQuotes',    label: '💬 ציטוטים' },
                            { key: 'savePriority', label: '⭐ עדיפות שמירה' },
                          ].map(({ key, label }) => {
                            const val = _bh[key];
                            if (!val || (Array.isArray(val) && val.length === 0)) return null;
                            return (
                              <div key={key} className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-900/20 px-4 py-3">
                                <div className="flex items-center justify-between mb-2">
                                  <button type="button" onClick={() => _psSave(`brain_${key}`, label, val)} className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600">🧠 שמור</button>
                                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300">{label}</span>
                                </div>
                                {Array.isArray(val) ? (
                                  <ul className="space-y-1.5">
                                    {val.map((v, vIdx) => (
                                      <li key={vIdx} className="flex items-start gap-2 justify-between">
                                        <button type="button" onClick={() => _psCopy(v)} className="mt-0.5 shrink-0 text-slate-400 hover:text-amber-600"><Copy className="h-3 w-3" /></button>
                                        <span className="flex-1 text-sm text-amber-900 dark:text-amber-100 text-right leading-snug">{v}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-amber-900 dark:text-amber-100 text-right">{String(val)}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </TabsContent>

                    {/* ── ⚖️ Ideology Analysis Tab ── */}
                    <TabsContent value="ideology" className="mt-4 min-h-[320px]" dir="rtl">
                      {!_ia ? (
                        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center py-8 text-slate-400 dark:text-zinc-500">
                          <span className="text-3xl">⚖️</span>
                          <p className="text-sm">אין ניתוח אידיאולוגי עדיין</p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
                          <div className="flex items-center justify-between flex-row-reverse mb-1">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">⚖️ אידיאולוגיה וערכים</h4>
                            <button
                              type="button"
                              onClick={() => {
                                const parts = [
                                  _ia.politicalCamp     && `מחנה פוליטי: ${_ia.politicalCamp}`,
                                  ...(_ia.coreValues          || []),
                                  ...(_ia.persuasionTechniques || []),
                                  ...(_ia.hiddenAssumptions    || []),
                                  ...(_ia.logicalWeaknesses    || []),
                                  ...(_ia.emotionalTriggers    || []),
                                ].filter(Boolean);
                                _psSave('ideologyAnalysis', 'אידיאולוגיה וערכים', parts);
                              }}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium dark:text-indigo-400"
                            >🧠 שמור הכל</button>
                          </div>
                          {[
                            { key: 'politicalCamp',        label: 'מחנה פוליטי',        icon: '🏛️', color: 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-900/20', isString: true },
                            { key: 'coreValues',           label: 'ערכי ליבה',           icon: '⭐', color: 'border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-900/20' },
                            { key: 'targetAudience',       label: 'קהל יעד',             icon: '👥', color: 'border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-900/20' },
                            { key: 'emotionalTriggers',    label: 'טריגרים רגשיים',      icon: '💥', color: 'border-pink-200 bg-pink-50/60 dark:border-pink-800 dark:bg-pink-900/20' },
                            { key: 'persuasionTechniques', label: 'טכניקות שכנוע',       icon: '🎯', color: 'border-purple-200 bg-purple-50/60 dark:border-purple-800 dark:bg-purple-900/20' },
                            { key: 'hiddenAssumptions',    label: 'הנחות נסתרות',        icon: '🔍', color: 'border-orange-200 bg-orange-50/60 dark:border-orange-800 dark:bg-orange-900/20' },
                            { key: 'logicalWeaknesses',    label: 'חולשות לוגיות',       icon: '⚠️', color: 'border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-900/20' },
                          ].map(({ key, label, icon, color, isString }) => {
                            const raw = _ia[key];
                            if (!raw || (Array.isArray(raw) && raw.length === 0)) return null;
                            // Normalize: string → wrap in array; object with segments → flatten
                            const items = isString
                              ? (typeof raw === 'string' ? [raw] : (Array.isArray(raw) ? raw : [String(raw)]))
                              : (Array.isArray(raw) ? raw
                                : (raw?.segments ? raw.segments
                                : (typeof raw === 'string' ? [raw] : [String(raw)])));
                            const displayItems = items.filter(v => v && String(v).trim());
                            if (displayItems.length === 0) return null;
                            return (
                              <div key={key} className={`rounded-xl border px-4 py-3 ${color}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-1.5">
                                    <span>{icon}</span>
                                    <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">{label}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => _psSave(`ideology_${key}`, label, displayItems)}
                                    className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600"
                                  >🧠 שמור</button>
                                </div>
                                {displayItems.length === 1 && isString ? (
                                  <div className="flex items-start gap-2 justify-between">
                                    <button type="button" onClick={() => _psCopy(displayItems[0])} className="mt-0.5 shrink-0 text-slate-400 hover:text-indigo-600">
                                      <Copy className="h-3.5 w-3.5" />
                                    </button>
                                    <p className="flex-1 text-sm text-slate-700 dark:text-zinc-300 text-right leading-relaxed font-semibold">{displayItems[0]}</p>
                                  </div>
                                ) : (
                                  <ul className="space-y-1.5">
                                    {displayItems.map((v, idx) => (
                                      <li key={idx} className="flex items-start gap-2 justify-between">
                                        <button type="button" onClick={() => _psCopy(v)} className="mt-0.5 shrink-0 text-slate-400 hover:text-indigo-600">
                                          <Copy className="h-3 w-3" />
                                        </button>
                                        <span className="flex-1 text-sm text-slate-700 dark:text-zinc-300 text-right leading-snug">{String(v)}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </TabsContent>
                  </>
                  </PoliticalTabBoundary>
                );
              })()}
              </Tabs>
              </div>{/* closes main content */}
            </div>{/* closes main content row */}
          </div>{/* closes max-w-[1400px] wrapper */}
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
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-right text-base font-bold">
            תמלול הסרטון
          </DialogTitle>
        </DialogHeader>
        <div className="shrink-0">
          <GeminiActionsPanel
            video={video}
            fullTranscriptText={fullTranscriptText}
            transcriptWordCount={transcriptWordCount}
            storedTranscriptSegments={storedTranscriptSegments}
            transcriptSourceLabel={transcriptSourceLabel}
            handleQuickCopy={handleQuickCopy}
          />
        </div>
        <div className="flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/80 dark:bg-zinc-900/80 min-h-0 mt-2">
          <pre className="whitespace-pre-wrap break-words px-4 py-3 text-sm leading-7 text-slate-800 dark:text-zinc-100 text-right" dir="rtl">
            {fullTranscriptText || 'אין תמלול זמין'}
          </pre>
        </div>
        <div className="shrink-0 pt-3">
          <button
            type="button"
            onClick={() => setIsTranscriptViewerOpen(false)}
            className="w-full h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            סגור
          </button>
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
    <Dialog open={isGemsPasteOpen} onOpenChange={(open) => { setIsGemsPasteOpen(open); if (!open) { setGemsPasteError(""); setGemsParsedErrorInfo(null); setGemsRepairApplied(false); setGemsErrorContext(null); } }}>
      <DialogContent dir="rtl" className="max-w-3xl w-[90vw] z-[200]">
        <DialogHeader>
          <DialogTitle className="text-right text-base font-bold">📥 הדבק JSON מ-GEMS</DialogTitle>
          <DialogDescription className="text-right text-sm text-slate-500">
            הדבק JSON שקיבלת מ-Gemini Gem (תוצאת ניתוח).
          </DialogDescription>
        </DialogHeader>
        <textarea
          className={`w-full h-72 rounded-lg border p-3 text-xs text-slate-800 resize-y font-mono leading-relaxed focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100 ${
            gemsPasteError
              ? 'border-red-300 focus:ring-red-300 dark:border-red-700'
              : gemsRepairApplied
                ? 'border-emerald-300 focus:ring-emerald-300 dark:border-emerald-700'
                : 'border-slate-200 focus:ring-violet-300 dark:border-zinc-700'
          }`}
          placeholder='{ "allPoints": [...], "chapters": [...], ... }'
          value={gemsPasteInput}
          onChange={(e) => {
            const val = e.target.value;
            setGemsPasteInput(val);
            setGemsPasteError(""); setGemsParsedErrorInfo(null); setGemsRepairApplied(false); setGemsErrorContext(null);
            if (video?.id) localStorage.setItem(`gems-paste-${video.id}`, val);
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text');
            if (!pasted.trim()) return;
            try { JSON.parse(pasted.trim()); } catch {
              const repaired = repairGemsJson(pasted.trim());
              try {
                JSON.parse(repaired);
                e.preventDefault();
                setGemsPasteInput(repaired);
                setGemsRepairApplied(true);
                setGemsPasteError("");
                setGemsParsedErrorInfo(null);
                setGemsErrorContext(null);
                if (video?.id) localStorage.setItem(`gems-paste-${video.id}`, repaired);
              } catch { /* repair failed — let normal paste proceed */ }
            }
          }}
          dir="ltr"
        />
        {gemsRepairApplied && !gemsPasteError && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 text-right flex items-center gap-1 justify-end">
            <span>✅</span>
            <span>JSON תוקן אוטומטית — ניתן להחיל</span>
          </p>
        )}
        {gemsPasteError && (
          <div className="space-y-1.5 text-right">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={handleCopyGemsError}
                disabled={!gemsParsedErrorInfo}
                className="text-[11px] px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-40 shrink-0"
              >
                📋 העתק שגיאה
              </button>
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">{gemsPasteError}</p>
            </div>
            {gemsParsedErrorInfo && (
              <>
                <p className="text-[11px] text-red-400 dark:text-red-500 font-mono">
                  שורה {gemsParsedErrorInfo.line} · עמודה {gemsParsedErrorInfo.col} · תו: &quot;{gemsParsedErrorInfo.char}&quot;
                </p>
                {gemsParsedErrorInfo.translation && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    {gemsParsedErrorInfo.translation.en} — {gemsParsedErrorInfo.translation.he}
                  </p>
                )}
              </>
            )}
            {gemsErrorContext && gemsErrorContext.length > 0 && (
              <div className="mt-1 rounded border border-red-200 dark:border-red-800 overflow-hidden text-left" dir="ltr">
                {gemsErrorContext.map((ln) => (
                  <div
                    key={ln.lineNum}
                    className={`flex gap-2 px-2 py-0.5 font-mono text-[10px] leading-5 ${
                      ln.isError
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 font-bold'
                        : 'bg-zinc-50 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500'
                    }`}
                  >
                    <span className="w-8 text-right shrink-0 select-none opacity-60">{ln.lineNum}</span>
                    <span className="truncate">{ln.text || ' '}</span>
                    {ln.isError && <span className="ml-1 text-red-400 shrink-0">◀</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex gap-2 justify-start flex-row-reverse">
          <button
            onClick={() => { setIsGemsPasteOpen(false); setGemsPasteError(""); setGemsParsedErrorInfo(null); setGemsRepairApplied(false); setGemsErrorContext(null); }}
            className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200"
          >
            ביטול
          </button>
          <button
            onClick={handleClearGemsPaste}
            disabled={!gemsPasteInput.trim()}
            className="px-4 py-2 text-sm border border-rose-200 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 disabled:opacity-50 font-medium dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-400"
          >
            🗑️ מחק מלל
          </button>
          <button
            onClick={handleRepairGemsJson}
            disabled={!gemsPasteInput.trim()}
            className="px-4 py-2 text-sm border border-amber-300 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 disabled:opacity-50 font-medium dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
          >
            🔧 תקן JSON
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
