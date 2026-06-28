import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { ExternalLink, Sparkles, Eye, X, Clock, StickyNote, Calendar, Link2, Moon, Sun, ClipboardList, Info, Trash2, Pin, Copy, CheckCircle2, AlertCircle, BookMarked, Zap, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Video } from "@/api/entities";
import { analyzeVideoWithAI } from "@/api/functions";
import { analyzeVideoWithProvider } from "@/services/aiVideoAnalyzer";
import { computeTargetChapters } from "@/lib/chapterCountUtils";
import {
  buildTranscriptChunkTitle,
  isAiAnalysisChapterSource,
  isObviousTranscriptFragmentTitle,
  isTranscriptChunkChapterSource,
  sanitizeChaptersForDisplay,
  stripTranscriptNoiseMarkers,
} from "@/lib/chapterTitleUtils";
import { getClaudeAnalyzerStatus } from "@/services/claudeVideoAnalyzer";
import { fetchGeminiVideoContent, fetchHebrewChapterTitles } from "@/services/geminiVideoContent";
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
  matchChaptersToTranscript,
  normalizeAiAnalysisResult,
  parseDurationToSeconds,
  resolveVideoChapters,
  resolveStructuredChapters,
  validateAiAnalysisQuality,
  validateChaptersForSave,
  validateChapterTimelineCoverage,
} from "@/services/videoAnalytics";
import { fetchTranscript, fetchTranscriptPayload, getBestTranscript, parseTranscript, validateTranscriptUsable, clearTranscriptCache } from "@/services/youtubeTranscript";
import { buildExternalVideoObject } from "@/services/youtubeOEmbed";
import { clearSegments } from "@/lib/localSegmentStore";
import { getVideoTranscriptText, resolveTranscriptForChapters } from "@/lib/videoTranscriptUtils";
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
import { ObsidianSettingsDialog } from "./ObsidianSettingsDialog";
import { buildVideoFullNote, openObsidianUrl, downloadMarkdown, getSelectedAtomicKnowledge, resolvePrimaryTopic } from "@/lib/obsidianExport";
import { buildObsidianOpenUrl, getObsidianVaultRequestFields, hasUsableObsidianVaultName, resolveObsidianVaultName, useObsidianSettingsState } from "@/lib/obsidianVaultConfig";
import { buildObsidianRoutingDebugInfo, resolveVideoObsidianRoute } from "@/lib/obsidianRouting";
import { getManualNotesByTopic } from "@/lib/localManualNoteStore";
import { createKnowledgeItemFromVideo, getKnowledgeItems, hasKnowledgeItem, upsertKnowledgeItem, updateKnowledgeItemsForVideo } from "@/lib/localKnowledgeItemStore";
import { getOpponentSentences, toggleOpponentSentence, setOpponentSentenceResponse } from "@/lib/opponentSentenceStore";
import { CategoryBadge } from "./CategoryBadge";
import { LearningStatusBadge, LEARNING_STATUSES } from "./LearningStatusBadge";
import { SaveButton } from "./SaveButton";
import { NoteEditor } from "./NoteEditor";
import ChapterItem from "./ChapterItem";
import { BrainDestinationPicker } from "./BrainDestinationPicker";
import { GemSelectionModal } from "./GemSelectionModal";
import { GemRecommendationCard } from "./GemRecommendationCard";
import { GemsSettingsModal } from "./GemsSettingsModal";
import { AiMappingModal } from "./AiMappingModal";
import { BrainSelectableItem } from "./BrainSelectableItem";
import {
  UniversalTabCheckbox,
  UniversalTabSelectRow,
} from '@/components/shared/UniversalTabSelectRow';
import { mergeBulkSelection } from '@/lib/universalTabBulkItems';
import {
  resolveBrainSaveStatus,
  resolveObsidianSaveStatus,
  resolveWorkspaceSaveStatus,
} from '@/lib/saveStatusResolver';
import {
  buildObsidianItemIdentityKey,
  isObsidianItemSaved,
  recordObsidianItemSave,
} from '@/lib/obsidianItemSaveStore';
import { mergeItemsIntoObsidianNote } from '@/lib/obsidianNoteMerge';
import { readObsidianVaultMarkdown, writeObsidianWithItemMerge } from '@/lib/obsidianVaultMergeWrite';
import { collectVideoObsidianMergeItems } from '@/lib/obsidianVideoMergeItems';
import { getAppBuilderDraft, mapUniversalAppBuilderToSections, saveAppBuilderDraft } from '@/lib/appBuilderStore';
import { UniversalTabQuickSaveFromBulk } from '@/components/shared/UniversalTabQuickSaveActions';
import { MarketBriefView } from "./MarketBriefView";
import { LearningTabContent, UsefulKnowledgeSourceLine } from "./LearningTabContent";
import { MarketIndicesTable } from "./MarketIndicesTable";
import { SpecializedContentRenderer } from "./SpecializedContentRenderer";
import { detectVideoType, extractVideoTabItems, getTabBadge, normalizeSubCategory, getMorningBriefFieldMapping, UNIVERSAL_TABS, LEARNING_SUB_TAB_VALUES } from "@/config/videoTabsConfig";
import { QUICK_COPY_ACTIONS, QUICK_COPY_GROUPS } from "@/ai/quickCopyPrompts";
import { classifyVideoForGem, recommendTjsGemFromTranscript, GEM_ALT_OPTIONS, GEM_CATEGORY_MAP, getGemSubCategoryFallback, normalizeCategoryName } from "@/lib/gemRecommender";
import { isTemporaryMarketFact } from "@/lib/knowledgeTypes";
import { getGemConfigSnapshot, getGemUrl, openGeminiGemUrl, saveGemConfigSnapshot } from "@/lib/gemsConfig";
import { resolveChannelToMentor, resolveMentorByName } from "@/lib/channelMentorResolver";
import { resolveMentorChannelUrl } from "@/lib/mentorSourceUrl";
import { hasObsidianSavedStatus, getBrainSaveButtonLabel, buildObsidianSavedStatusFromPath, logObsidianVaultP0Diagnostics } from "@/lib/obsidianSavedStatus";
import { getTopicRule } from "@/lib/topicRules";
import { isBase44Enabled } from "@/config/base44Flags";
import {
  buildMarketBriefWithSectionOverride,
  persistMarketBriefData,
  preserveManualOverridesOnReanalysis,
} from "@/lib/manualBriefOverrides";
import { useThumbnailFallback } from "@/hooks/useThumbnailFallback";
import { saveFreshImportRecordLocally, buildFreshImportRecord, clearVideoGeneratedCaches, consumeFreshImportFlag, stripFreshImportFlags } from "@/lib/videoFreshImport";
import { updateLocalVideo } from "@/lib/localVideoStore";
import { PdfUploader } from "@/components/upload/PdfUploader";
import { SaveToWorkspaceDialog } from "@/components/workspace/SaveToWorkspaceDialog";
import { getWorkspaceItemByVideoId, updateWorkspaceItemByVideoId } from "@/lib/workspaceLibraryStore";
import { SubTopicPillDropdown } from "@/components/dashboard/SubTopicPillDropdown";
import { SummaryTextSaveMenu } from "@/components/dashboard/SummaryTextSaveMenu";
import { AppBuilderTab } from "@/components/dashboard/AppBuilderTab";
import { UniversalTabSectionBlocks } from "@/components/dashboard/UniversalTabSectionBlocks";
import { ObsidianMappingTab } from "@/components/dashboard/ObsidianMappingTab";
import { InsightsStructuredView } from "@/components/dashboard/InsightsStructuredView";
import { hasAppBuilderDraft } from "@/lib/appBuilderStore";
import {
  extractUniversalTabContent,
  extractUniversalTabFlatItems,
  logUniversalTabExtractShape,
} from "@/lib/universalTabSections";
import { GemRawModal } from "@/components/dashboard/GemRawModal";
import { UniversalTabSelectionBar } from "@/components/shared/UniversalTabSelectionBar";
import { UniversalTabSectionLabelRow } from "@/components/shared/UniversalTabSectionLabelRow";
import { ObsidianSaveLabel } from "@/components/shared/ObsidianIcon";
import { UniversalTabBulkProvider } from "@/context/UniversalTabBulkContext";
import { UniversalTabBulkToolbar } from "@/components/dashboard/UniversalTabBulkToolbar";
import { TabBulkItemsRegistrar } from "@/components/dashboard/TabBulkItemsRegistrar";
import { useTabBulkSelection } from "@/hooks/useTabBulkSelection";
import {
  buildBulkItemsFromSections,
  buildCardBulkItemsFromSections,
  buildSummaryBriefingBulkItems,
  buildSummaryBriefingCardBulkItems,
  buildPoliticalSummaryBulkItems,
  buildChaptersBulkItems,
} from "@/lib/universalTabBulkItems";
import { SummaryBriefingView } from "@/components/dashboard/SummaryBriefingView";
import { SUMMARY_CARD_CLASS, SUMMARY_CARD_TITLE_CLASS, SUMMARY_LEAD_CLASS } from "@/lib/summaryCardStyles";
import { buildDailyBriefingView } from "@/lib/summaryBriefingDisplay";
import { collectVideoKnowledgePackage } from "@/lib/videoKnowledgePackage";
import { appendMarketAppBrainItems } from "@/lib/appIdeasBrainObsidian";

// §26 — APP Builder tab is shown only for these educational topic categories
const APP_BUILDER_TOPICS = new Set([
  "שוק ההון",
  "פוליטיקה",
  "טכנולוגיה ו-AI",
  "בריאות ותזונה",
]);

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

// ── PdfDocumentCard ──────────────────────────────────────────────────────────
// Shown in the sidebar when contentType === "pdf".
// Replaces PanelThumbnail — shows icon, filename, page count, and a collapsible
// transcript preview. YouTube player/thumbnail is never rendered for PDFs.
function PdfDocumentCard({ video }) {
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const filename  = video?.originalFileName || `${video?.title || "מסמך"}.pdf`;
  const pages     = video?.pdfPages;
  const transcript = video?.transcript || video?.manualTranscript || "";

  return (
    <div
      className="rounded-2xl border border-orange-200 bg-orange-50/60 shadow-sm overflow-hidden dark:border-orange-900/40 dark:bg-zinc-900/80"
      dir="rtl"
    >
      {/* Icon + filename + page count */}
      <div className="px-4 pt-4 pb-3 flex flex-col items-center gap-2 text-center">
        <span className="text-5xl select-none leading-none">📄</span>
        <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 break-all leading-snug">
          {filename}
        </p>
        {pages && (
          <p className="text-xs text-slate-500 dark:text-zinc-400">{pages} עמודים</p>
        )}
        {/* Status badge */}
        <span className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-100 px-2.5 py-0.5 text-[11px] font-semibold text-orange-700 dark:border-orange-700/50 dark:bg-orange-950/30 dark:text-orange-300">
          📄 PDF נטען
        </span>
      </div>

      {/* Transcript toggle */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => setTranscriptOpen((p) => !p)}
          className="w-full h-8 inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 active:scale-95 transition-all shadow-sm"
        >
          {transcriptOpen ? "▲ הסתר טקסט" : "📖 הצג תמלול / טקסט שחולץ"}
        </button>
      </div>

      {/* Collapsible transcript preview — first 2000 chars */}
      {transcriptOpen && (
        <div className="border-t border-orange-200 dark:border-orange-900/40 px-3 pb-3 pt-2 max-h-[200px] overflow-auto">
          {transcript ? (
            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-zinc-300 whitespace-pre-wrap text-right">
              {transcript.slice(0, 2000)}
              {transcript.length > 2000 ? "…" : ""}
            </p>
          ) : (
            <p className="text-xs text-slate-500 dark:text-zinc-400 text-center py-2">אין טקסט חולץ</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── ErrorBoundary for the entire panel — prevents white screen on any render crash ──
class PanelErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error('[PanelError] VideoDetailPanel render crash:', error.message, '\nStack:', error.stack?.split('\n').slice(0,4).join('\n'));
  }
  render() {
    if (this.state.error) {
      return (
        <div dir="rtl" className="flex flex-col items-center gap-4 py-16 text-center px-6">
          <span className="text-4xl">&#9888;&#65039;</span>
          <p className="text-base font-bold text-red-700 dark:text-red-300">שגיאת תצוגה — לא ניתן להציג את תוכן הסרטון</p>
          <p className="text-xs text-red-500 dark:text-red-400 font-mono max-w-sm break-all">{this.state.error.message}</p>
          <button type="button" onClick={() => this.setState({ error: null })} className="mt-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">נסה שוב</button>
        </div>
      );
    }
    return this.props.children;
  }
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

/** Parses GEM chapter time values: numeric seconds, numeric strings, or "MM:SS" / "HH:MM:SS". */
function gemTimeToSeconds(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.floor(value);
  if (typeof value === 'string' && value.trim() !== '') {
    const str = value.trim();
    if (str.includes(':')) {
      const parts = str.split(':').map(Number);
      if (!parts.some((p) => !Number.isFinite(p) || p < 0)) {
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      return null;
    }
    const n = Number(str);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return null;
}

/** MM:SS, or HH:MM:SS when hours exist. */
function formatChapterTimestamp(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * Detects when all GEM chapter timestamps look proportionally distributed (AI estimate
 * rather than real transcript transitions). Threshold: ≥4 valid timestamps, all gaps
 * within 8% of the average gap. Marks affected chapters with isEstimated + timestampSource.
 */
function markEstimatedIfEvenlySpaced(chapters) {
  const seconds = chapters
    .map((ch) => ch?.startSeconds)
    .filter((v) => Number.isFinite(v));

  if (seconds.length < 4) return chapters;

  const gaps = seconds.slice(1).map((s, i) => s - seconds[i]);
  const avg = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;

  if (!Number.isFinite(avg) || avg <= 0) return chapters;

  const evenlySpaced = gaps.every((g) => Math.abs(g - avg) / avg < 0.08);
  if (!evenlySpaced) return chapters;

  return chapters.map((ch) => ({
    ...ch,
    isEstimated: true,
    timestampSource: 'estimated_proportional',
  }));
}

/** Normalizes universalTabs.chapters (GEM) into ChapterItem-compatible rows. */
function normalizeGemChapters(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const normalized = raw.map((ch, i) => {
    if (typeof ch === 'string') {
      const title = ch.trim();
      return title ? { title, timestamp: '', chapterSource: 'gem', isEstimated: true, timestampSource: 'missing' } : null;
    }
    if (!ch || typeof ch !== 'object') return null;
    const title = String(ch.title || ch.name || ch.label || `פרק ${i + 1}`).trim();
    if (!title) return null;

    const rawStamp = String(ch.timestamp || ch.time || ch.startTime || ch.timeLabel || '').trim();
    const startSeconds =
      gemTimeToSeconds(ch.startSeconds) ??
      gemTimeToSeconds(ch.start) ??
      gemTimeToSeconds(rawStamp);
    const endSeconds = gemTimeToSeconds(ch.endSeconds) ?? gemTimeToSeconds(ch.end);

    const timestamp = startSeconds != null ? formatChapterTimestamp(startSeconds) : rawStamp;
    const summary = String(ch.summary || ch.description || '').trim();
    const hasTimestamp = startSeconds != null;
    return {
      title,
      timestamp,
      summary,
      chapterSource: 'gem',
      isEstimated: !hasTimestamp,
      timestampSource: hasTimestamp ? 'gem' : 'missing',
      ...(startSeconds != null ? { startSeconds } : {}),
      ...(endSeconds != null && (startSeconds == null || endSeconds >= startSeconds) ? { endSeconds } : {}),
    };
  }).filter(Boolean);

  return markEstimatedIfEvenlySpaced(normalized);
}

/** Local transcript-chunk chapters (legacy + heuristic). Never Claude/Gemini. */
function resolveTranscriptChunkDisplayChapters(video, overrideChapters = null) {
  if (!video || !isTranscriptChunkChapterSource(video.chapterSource)) return [];
  const raw =
    overrideChapters ??
    (Array.isArray(video.aiChapters) && video.aiChapters.length > 0
      ? video.aiChapters
      : Array.isArray(video.chapters)
        ? video.chapters
        : []);
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return sanitizeChaptersForDisplay(resolveVideoChapters(video, raw));
}

/** Claude / Gemini / manual AI chapters saved on the video record. */
function resolveAiAnalysisDisplayChapters(video) {
  if (!video || !video.chapterSource || isTranscriptChunkChapterSource(video.chapterSource)) return [];
  if (!isAiAnalysisChapterSource(video.chapterSource)) return [];
  const raw = Array.isArray(video.aiChapters) && video.aiChapters.length > 0
    ? video.aiChapters
    : Array.isArray(video.chapters)
      ? video.chapters
      : [];
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return resolveVideoChapters(video, raw);
}

/**
 * Quality gate for locally-generated transcript chapters.
 * Module-level so it can be used in both useMemos (display-time) and generation handlers.
 */
function validateTranscriptChapterQuality(chapters) {
  if (!Array.isArray(chapters) || chapters.length < 2) return { valid: false, reason: 'too_few' };
  const titles = chapters.map(c => String(c.title || '').trim());
  if (titles.some(t => !t)) return { valid: false, reason: 'empty_title' };
  if (titles.some(t => /\[(music|applause|laughter|silence|שירה|מוזיקה)\]/i.test(t)))
    return { valid: false, reason: 'noise_in_title' };
  if (titles.some(t => /^פרק\s+\d+\s+בנושא/i.test(t)))
    return { valid: false, reason: 'generic_fallback_title' };
  if (titles.some(t => /^[a-z]/.test(t) && t.length > 25))
    return { valid: false, reason: 'transcript_fragment_title' };
  // Any repeated title → reject (was: >50% threshold; stricter: any duplicate)
  const titleSet = new Set(titles);
  if (titleSet.size < titles.length) {
    const dupes = titles.filter((t, i) => titles.indexOf(t) !== i);
    return { valid: false, reason: 'duplicate_title', detail: dupes };
  }
  return { valid: true };
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
    const cleanedChunk = stripTranscriptNoiseMarkers(chunk);
    const keywordTitle = makeTitleFromText(cleanedChunk);
    const title = isObviousTranscriptFragmentTitle(keywordTitle)
      ? buildTranscriptChunkTitle(cleanedChunk, i, null)
      : keywordTitle;
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
const MARKET_GEM_KEYS = new Set(["fundamental", "technical", "news", "macro"]);
const POLITICS_CATEGORY = "פוליטיקה";
const MARKET_CATEGORY = "שוק ההון";
const BRAIN_CUSTOM_DESTS_KEY = "brain_custom_dests_v1";
const NEW_SUBTOPIC_SENTINEL = "__NEW_SUBTOPIC__";
const FORBIDDEN_MARKET_SUBTOPICS = new Set([
  "פוליטי",
  "פוליטיקה",
  "הכיבוש",
  "משיחיות",
  "מערכת המשפט",
  "ערבים ויהודים",
]);

const CANONICAL_MARKET_SUBTOPICS = [
  { id: 'can:technical',    name: 'ניתוח טכני' },
  { id: 'can:fundamental',  name: 'פונדמנטלי' },
  { id: 'can:macro',        name: 'מאקרו' },
  { id: 'can:morning',      name: 'מבזק בוקר' },
  { id: 'can:evening',      name: 'מבזק ערב' },
  { id: 'can:weekly',       name: 'מבזק שבועי' },
  { id: 'can:earnings',     name: 'מבזק דוחות' },
  { id: 'can:watchlist',    name: 'רשימת מעקב' },
  { id: 'can:reports',      name: 'דוחות ורווחים' },
  { id: 'can:longterm',     name: 'השקעות לטווח ארוך' },
  { id: 'can:options',      name: 'אופציות' },
  { id: 'can:swing',        name: 'מסחר סווינג' },
  { id: 'can:risk',         name: 'ניהול סיכונים' },
].map((c) => ({ ...c, isCustom: false, isCanonical: true }));

function normalizeLooseName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function loadCustomBrainDests() {
  try {
    const raw = localStorage.getItem(BRAIN_CUSTOM_DESTS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed.mains) && typeof parsed.subs === "object" && parsed.subs) {
      return parsed;
    }
  } catch {}
  return { mains: [], subs: {} };
}

function persistCustomBrainSub(parentId, name) {
  const store = loadCustomBrainDests();
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;
  if (!store.subs[parentId]) store.subs[parentId] = [];
  const existing = store.subs[parentId].find((item) => normalizeLooseName(item?.name) === normalizeLooseName(trimmed));
  if (existing) return existing.id;
  const id = `custom_sub_${Date.now()}`;
  store.subs[parentId].push({ id, name: trimmed });
  try {
    localStorage.setItem(BRAIN_CUSTOM_DESTS_KEY, JSON.stringify(store));
  } catch {}
  return id;
}

function findExistingSubTopic(candidates, subtopics) {
  const normalizedCandidates = Array.isArray(candidates)
    ? candidates.map((candidate) => normalizeLooseName(candidate)).filter(Boolean)
    : [];
  const list = Array.isArray(subtopics) ? subtopics : [];
  if (!normalizedCandidates.length || !list.length) return null;

  for (const candidate of normalizedCandidates) {
    const exactMatch = list.find((topic) => normalizeLooseName(topic?.name) === candidate);
    if (exactMatch) return exactMatch;
  }

  for (const candidate of normalizedCandidates) {
    const partialMatch = list.find((topic) => {
      const normalizedName = normalizeLooseName(topic?.name);
      return normalizedName.includes(candidate) || candidate.includes(normalizedName);
    });
    if (partialMatch) return partialMatch;
  }

  return null;
}

function getMarketSubTopicCandidates(gemKey, gemLabel, fallbackSubCategory) {
  const normalizedGemLabel = normalizeLooseName(gemLabel);
  const candidateMap = {
    technical: ["ניתוח טכני", "טכני", "מסחר טכני", "אינדיקטורים"],
    fundamental: ["ניתוח פונדמנטלי", "פונדמנטלי", "דוחות ורווחים", "דוחות כספיים"],
    news: ["מבט בוקר", "סקירת שוק", "רשימות מעקב", "דוחות ורווחים"],
    macro: ["מאקרו", "סקירת שוק"],
  };

  if (gemKey === "technical" || normalizedGemLabel.includes("טכני")) {
    return candidateMap.technical;
  }
  if (gemKey === "fundamental" || normalizedGemLabel.includes("פונדמנטלי")) {
    return candidateMap.fundamental;
  }
  if (gemKey === "news" || normalizedGemLabel.includes("מבט בוקר")) {
    return candidateMap.news;
  }
  if (gemKey === "macro" || normalizedGemLabel.includes("מאקרו")) {
    return candidateMap.macro;
  }

  return [fallbackSubCategory, gemLabel].filter(Boolean);
}

const SUBCATEGORY_GEM_META = {
  technical: { label: "טכני", icon: "📈" },
  fundamental: { label: "פונדמנטלי", icon: "📊" },
  macro: { label: "מאקרו", icon: "🌍" },
  news: { label: "מבזק שוק", icon: "📰" },
  political: { label: "פוליטי", icon: "🏛️" },
};

const DYNAMIC_TAB_EMPTY_LABELS = {
  // useful-knowledge removed — handled by standalone universal TabsContent (Phase 2)
  definitions: "אין עדיין מושגים — נתח את הסרטון כדי להפיק",
  indicators: "אין עדיין אינדיקטורים — נתח את הסרטון כדי להפיק",
  setups: "אין עדיין סטאפים — נתח את הסרטון כדי להפיק",
  patterns: "אין עדיין פטרנים — נתח את הסרטון כדי להפיק",
  checklists: "אין עדיין צ'קליסטים — נתח את הסרטון כדי להפיק",
  mistakes: "אין עדיין טעויות — נתח את הסרטון כדי להפיק",
  "trading-brain": "אין עדיין ידע למוח המסחר — נתח את הסרטון כדי להפיק",
  "financial-metrics": "אין עדיין מדדים פיננסיים",
  valuation: "אין עדיין הערכת שווי",
  "analysis-frameworks": "אין עדיין מסגרות ניתוח",
  "investment-checklist": "אין עדיין צ'קליסט השקעה",
  "cause-effect": "אין עדיין קשרי סיבה ותוצאה",
  "market-impact": "אין עדיין השפעה על השוק",
  "market-news": "אין עדיין חדשות שוק",
  indices: "אין עדיין נתוני מדדים",
  "stocks-mentioned": "אין עדיין מניות מוזכרות",
  "brief-risks": "אין עדיין סיכונים",
  "brief-opportunities": "אין עדיין הזדמנויות",
  "brief-conclusions": "אין עדיין מסקנות למסחר",
  "brief-macro": "אין עדיין אירועי מאקרו",
  "brief-sentiment": "אין עדיין סנטימנט שוק",
  "brief-calendar": "אין עדיין אירועים בלוח הכלכלי",
  "brief-sectors": "אין עדיין ביצועי סקטורים",
  "brief-changes": "אין עדיין שינויים בולטים",
  "brief-tomorrow": "אין עדיין אירועי מחר",
  "brief-highlights": "אין עדיין כותרות שבועיות",
  "brief-winners": "אין עדיין מנצחים",
  "brief-losers": "אין עדיין מפסידים",
  "brief-outlook": "אין עדיין תחזית לשבוע הבא",
  "earnings-guidance": "אין עדיין תחזיות",
  "earnings-commentary": "אין עדיין פרשנות הנהלה",
};

const SUPPLEMENTARY_ALLOWED_TABS = new Set(["notes", "transcript", "brain-select"]);

function resolveGemKeyFromSubCategory(subCategory) {
  switch (normalizeSubCategory(subCategory)) {
    case "technical-analysis":
      return "technical";
    case "fundamental-analysis":
      return "fundamental";
    case "macro":
      return "macro";
    case "morning-brief":
    case "evening-brief":
    case "weekly-brief":
    case "earnings-brief":
      return "news";
    case "political":
      return "political";
    default:
      return null;
  }
}


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

const TRANSCRIPT_GEM_SETTINGS_FIELDS = [
  { key: "general", label: "כללי" },
  { key: "political", label: "פוליטי" },
  { key: "market", label: "שוק ההון" },
  { key: "technical", label: "טכני" },
  { key: "fundamental", label: "פונדמנטלי" },
  { key: "appBuilder", label: "App Builder" },
];

const TRANSCRIPT_GEM_BUTTONS = [
  { key: "general",    label: "כללי",        icon: "✨" },
  { key: "political",  label: "פוליטי",      icon: "🏛️" },
  { key: "fundamental",label: "פונדמנטלי",   icon: "📊" },
  { key: "technical",  label: "טכני",        icon: "📉" },
  { key: "macro",      label: "מאקרו",       icon: "🌐" },
  { key: "news",       label: "מבזק בוקר",  icon: "📰" },
  { key: "appBuilder", label: "App Builder", icon: "🏗️" },
];

function resolveTranscriptGemRecommendation(video, recommendedGemInfo) {
  const category = normalizeCategoryName(video?.category || "");
  const gemKey = String(recommendedGemInfo?.gemKey || video?.recommendedGem || "").trim();
  const gemLabel = String(recommendedGemInfo?.gemLabel || video?.recommendedGem || "").trim();

  if (category === MARKET_CATEGORY) {
    if (gemKey === "technical" || gemLabel.includes("טכני")) return "technical";
    if (gemKey === "fundamental" || gemLabel.includes("פונדמנטלי")) return "fundamental";
    return "market";
  }

  if (category === POLITICS_CATEGORY) {
    return "political";
  }

  if (gemKey === "appBuilder" || /app/i.test(gemLabel)) {
    return "appBuilder";
  }

  if (gemKey === "technical") return "technical";
  if (gemKey === "fundamental") return "fundamental";
  if (gemKey === "political") return "political";
  return "general";
}

function buildTranscriptGemPayload({ video, fullTranscriptText, durationLabel }) {
  const lines = [
    `Title: ${String(video?.title || "").trim()}`,
    `Channel: ${String(video?.channelTitle || video?.channelName || video?.channel || "").trim()}`,
    `URL: ${String(getWatchUrl(video) || "").trim()}`,
    `Duration: ${String(durationLabel || "").trim()}`,
    `Category: ${String(video?.category || "").trim()}`,
    `SubCategory: ${String(video?.subCategory || "").trim()}`,
    "",
    "Transcript:",
    fullTranscriptText,
  ];

  return lines.join("\n");
}

function GeminiActionsPanel({
  video,
  fullTranscriptText,
  transcriptWordCount,
  storedTranscriptSegments,
  transcriptSourceLabel,
  handleQuickCopy,
  recommendedGemInfo,
  selectedGemKey = null,
  onGemSelect = null,
}) {
  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false);
  const [isGemSettingsOpen, setIsGemSettingsOpen] = useState(false);
  const [gemSettingsDraft, setGemSettingsDraft] = useState(() => getGemConfigSnapshot());
  const marketRef = useRef(null);

  useEffect(() => {
    if (!marketDropdownOpen) return;
    function onMouseDown(e) {
      if (marketRef.current && !marketRef.current.contains(e.target)) setMarketDropdownOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [marketDropdownOpen]);

  useEffect(() => {
    if (!isGemSettingsOpen) return;
    setGemSettingsDraft(getGemConfigSnapshot());
  }, [isGemSettingsOpen]);

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
  const recommendedGemKey = resolveTranscriptGemRecommendation(video, recommendedGemInfo);
  const recommendedGemButton = TRANSCRIPT_GEM_BUTTONS.find((button) => button.key === recommendedGemKey) || null;

  // Local selection state — starts from saved override or AI recommendation
  const [localGem, setLocalGem] = useState(() => selectedGemKey || recommendedGemKey || 'general');
  useEffect(() => {
    setLocalGem(selectedGemKey || recommendedGemKey || 'general');
  }, [selectedGemKey, recommendedGemKey]);
  const hasUnsavedChange = onGemSelect && localGem !== (selectedGemKey || recommendedGemKey || 'general');

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

  const handleGemButtonClick = async (gemKey) => {
    if (!fullTranscriptText) {
      toast.error("אין תמלול זמין לשליחה");
      return;
    }

    const clipboardPayload = buildTranscriptGemPayload({
      video,
      fullTranscriptText,
      durationLabel: durationDisplay,
    });

    try {
      await navigator.clipboard.writeText(clipboardPayload);
    } catch {
      toast.error("לא ניתן לגשת ללוח");
      return;
    }

    toast.success("✓ התמלול הועתק ללוח");

    const gemUrl = getGemUrl(gemKey);
    if (!gemUrl) {
      setIsGemSettingsOpen(true);
      toast.info("יש להגדיר כתובת Gem בהגדרות");
      return;
    }

    openGeminiGemUrl(gemUrl);
  };

  const handleSaveGemSettings = () => {
    saveGemConfigSnapshot(gemSettingsDraft);
    setIsGemSettingsOpen(false);
    toast.success("הגדרות GEMS נשמרו");
  };

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

      <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 dark:border-indigo-900/40 dark:bg-indigo-950/20 px-3 py-3 space-y-2.5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-bold text-indigo-800 dark:text-indigo-200">בחירת GEM לתמלול</div>
          <button
            type="button"
            onClick={() => setIsGemSettingsOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2 py-1 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-300"
          >
            ⚙ הגדרות
          </button>
        </div>

        {/* Live status line */}
        <div className="flex items-center gap-3 text-[11px] leading-none" dir="rtl">
          <span className="flex items-center gap-1 text-slate-500 dark:text-zinc-400">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span>AI מומלץ:</span>
            <span className="font-semibold text-slate-700 dark:text-zinc-200">
              {TRANSCRIPT_GEM_BUTTONS.find(b => b.key === recommendedGemKey)?.label || recommendedGemKey || 'כללי'}
            </span>
          </span>
          <span className="text-slate-300 dark:text-zinc-600 select-none">|</span>
          <span className="flex items-center gap-1 text-slate-500 dark:text-zinc-400">
            <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
            <span>נבחר:</span>
            <span className="font-semibold text-slate-700 dark:text-zinc-200">
              {TRANSCRIPT_GEM_BUTTONS.find(b => b.key === localGem)?.label || localGem || 'כללי'}
            </span>
          </span>
          {hasUnsavedChange && (
            <span className="text-amber-600 dark:text-amber-400 text-[10px] font-medium">• לא נשמר</span>
          )}
        </div>

        {/* GEM cards */}
        <div className="flex flex-wrap gap-1.5">
          {TRANSCRIPT_GEM_BUTTONS.map((button) => {
            const isRecommended = button.key === recommendedGemKey;
            const isSelected    = button.key === localGem;
            const isBoth        = isSelected && isRecommended;
            const hasUrl        = Boolean(getGemUrl(button.key));
            return (
              <button
                key={button.key}
                type="button"
                onClick={() => setLocalGem(button.key)}
                title={hasUrl ? `בחר: ${button.label}` : `אין כתובת Gem — ${button.label}`}
                className={`relative inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold transition-all ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-indigo-900/40"
                    : isRecommended
                      ? "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-200"
                      : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-700"
                }`}
              >
                <span className="text-sm leading-none">{button.icon}</span>
                <span>{button.label}</span>
                {isBoth && (
                  <span className="absolute -top-1.5 -left-1.5 inline-block rounded-full bg-amber-400 text-[8px] font-bold text-white leading-none px-1 py-0.5">AI</span>
                )}
                {isRecommended && !isSelected && (
                  <span className="text-[9px] bg-amber-200 dark:bg-amber-800/60 text-amber-700 dark:text-amber-300 px-1 rounded leading-4">AI</span>
                )}
                {!hasUrl && (
                  <span className="text-[10px] opacity-60" title="אין URL מוגדר">⚠</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Missing URL warning for the currently selected GEM */}
        {!getGemUrl(localGem) && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-[11px]" dir="rtl">
            <span className="text-amber-600 dark:text-amber-400 shrink-0">⚠</span>
            <span className="text-amber-700 dark:text-amber-300 flex-1">
              ל-GEM הנבחר אין כתובת URL מוגדרת.
            </span>
            <button
              type="button"
              onClick={() => setIsGemSettingsOpen(true)}
              className="text-amber-600 dark:text-amber-400 underline text-[10px] font-semibold shrink-0"
            >
              הגדר עכשיו
            </button>
          </div>
        )}

        {/* Action row */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleGemButtonClick(localGem)}
            disabled={!fullTranscriptText || !getGemUrl(localGem)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 text-white px-3 py-2.5 text-xs font-semibold transition-colors"
          >
            ✦ פתח Gem נבחר
          </button>
          {onGemSelect && (
            <button
              type="button"
              onClick={() => onGemSelect(localGem)}
              disabled={!hasUnsavedChange}
              className={`inline-flex items-center justify-center gap-1 rounded-lg border px-4 py-2.5 text-xs font-semibold transition-colors ${
                hasUnsavedChange
                  ? "border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-slate-200 bg-white text-slate-400 cursor-default dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500"
              }`}
              title={hasUnsavedChange ? "שמור בחירת Gem לסרטון" : "הבחירה נשמרה"}
            >
              {hasUnsavedChange ? "💾 שמור" : "✓ נשמר"}
            </button>
          )}
        </div>
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

      <Dialog open={isGemSettingsOpen} onOpenChange={setIsGemSettingsOpen}>
        <DialogContent dir="rtl" className="max-w-lg z-[220]">
          <DialogHeader>
            <DialogTitle className="text-right text-base font-bold">⚙ הגדרות GEMS</DialogTitle>
            <DialogDescription className="text-right text-sm text-slate-500">
              אפשר לערוך ולשמור כתובות Gem לשימוש מהיר מתוך מודאל התמלול.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {TRANSCRIPT_GEM_SETTINGS_FIELDS.map((field) => (
              <label key={field.key} className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">{field.label}</span>
                <input
                  type="url"
                  dir="ltr"
                  value={gemSettingsDraft[field.key] || ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setGemSettingsDraft((prev) => ({ ...prev, [field.key]: value }));
                  }}
                  placeholder="https://gemini.google.com/gem/..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-left text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-indigo-500/20"
                />
              </label>
            ))}
          </div>
          <div className="flex justify-start gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsGemSettingsOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={handleSaveGemSettings}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              שמור
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// GEMS JSON repair helpers

function repairGemsJsonDetailed(raw) {
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

  // ── Strip embedded root JSON injected inside string values ────────────
  // Handles: "note": "Hebrew text{\n"contentType": "marketBrief",...
  // AI sometimes copies the full output JSON into a single string field.
  // Detection: inside a string value, find { followed within 100 chars by a root-level key.
  {
    const ROOT_FIELD_CHECK = /^\s*"?(contentType|videoType|briefDate|videoUrl|chapters|marketOverview|channelName|videoTitle|marketSession)["\\]?\s*:/;
    let out0 = '', inS0 = false, esc0 = false;
    let embeddedCount = 0;

    for (let i0 = 0; i0 < s.length; i0++) {
      const c = s[i0];
      if (esc0) { out0 += c; esc0 = false; continue; }
      if (c === '\\' && inS0) { out0 += c; esc0 = true; continue; }
      if (c === '"') { inS0 = !inS0; out0 += c; continue; }

      if (inS0 && c === '{') {
        // Normalize lookahead: collapse escape sequences + whitespace for key detection
        const ahead = s.slice(i0 + 1, i0 + 100)
          .replace(/\\[nrt]/g, ' ')
          .replace(/\\/g, '');
        if (ROOT_FIELD_CHECK.test(ahead)) {
          // Close the string value before the injection
          const fieldCtx = out0.slice(Math.max(0, out0.length - 60)).replace(/\s+/g, ' ');
          out0 += '"';
          inS0 = false;
          // Skip the injected {…} block by counting brace depth
          let depth = 1, j = i0 + 1, jInS = false, jEsc = false;
          while (j < s.length && depth > 0) {
            const jc = s[j];
            if (jEsc) { jEsc = false; j++; continue; }
            if (jc === '\\' && jInS) { jEsc = true; j++; continue; }
            if (jc === '"') { jInS = !jInS; j++; continue; }
            if (!jInS && jc === '{') { depth++; j++; continue; }
            if (!jInS && jc === '}') { depth--; j++; continue; }
            j++;
          }
          console.log(`[JSON Repair] Embedded root JSON detected — field context: ...${fieldCtx}`);
          console.log(`[JSON Repair] Skipped ${j - i0 - 1} injected characters (depth resolved at pos ${j})`);
          const previewAfter = s.slice(j, j + 60).replace(/\s+/g, ' ');
          console.log(`[JSON Repair] Repaired preview after injection: ${previewAfter}`);
          embeddedCount++;
          i0 = j - 1; // -1 because loop does i0++
          continue;
        }
      }
      out0 += c;
    }
    if (embeddedCount > 0) {
      s = out0;
      fixes.push(`Stripped ${embeddedCount} embedded root JSON injection(s) from string value(s)`);
    }
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

  // Unescape structural \n / \" sequences from double-stringified JSON.
  // Gemini sometimes returns JSON where structural separators are literal \n (two chars)
  // and property-name delimiters are literal \" — this appears when the model wraps its
  // output in a JSON string before returning it.
  // GUARD: only apply when the whole payload is wrapped in a string (starts with ").
  // For structured JSON starting with { or [, any outside-string \n/" is caused by a
  // broken string boundary (e.g. unescaped quote inside a value) — NOT double-stringification.
  // Applying the unescape in that case makes things worse: it converts \" inside legitimate
  // string values to raw " and destroys the structure before Pass C can fix it.
  {
    if (s.startsWith('"')) {
      const before = s;
      // Detect \n or \" as literal two-char sequences OUTSIDE any string context
      let _hasEsc = false;
      let _inS = false, _esc = false;
      for (let i = 0; i < s.length - 1; i++) {
        if (_esc)             { _esc = false; continue; }
        if (s[i] === '\\' && _inS) { _esc = true; continue; }
        if (s[i] === '"')           { _inS = !_inS; continue; }
        if (!_inS && s[i] === '\\' && (s[i + 1] === 'n' || s[i + 1] === '"')) {
          _hasEsc = true; break;
        }
      }
      if (_hasEsc) {
        let out = '';
        for (let i = 0; i < s.length; i++) {
          if (s[i] === '\\' && i + 1 < s.length) {
            const nx = s[i + 1];
            if (nx === '"')  { out += '"';  i++; continue; }
            if (nx === 'n')  { out += '\n'; i++; continue; }
            if (nx === 'r')  { out += '\r'; i++; continue; }
            if (nx === 't')  { out += '\t'; i++; continue; }
            if (nx === '\\') { out += '\\'; i++; continue; }
          }
          out += s[i];
        }
        s = out;
        if (s !== before) fixes.push('Unescaped structural \\n/\\" (double-stringified JSON)');
      }
    }
  }

  // Restore a missing `startSeconds` property in chapter objects.
  // Handles broken AI output like:
  //   "title": "...",
  //   210,
  //   "endSeconds": 330
  // or:
  //   "210,
  //   "endSeconds": 330
  {
    const beforeStartSeconds = s;
    s = s
      .replace(
        /("title"\s*:\s*"[^"]*"\s*,\s*)"(\d+)\s*,\s*"endSeconds"\s*:/g,
        '$1"startSeconds": $2,\n"endSeconds":'
      )
      .replace(
        /("title"\s*:\s*"[^"]*"\s*,\s*)(\d+)\s*,\s*"endSeconds"\s*:/g,
        '$1"startSeconds": $2,\n"endSeconds":'
      )
      .replace(
        /([,{]\s*)"(\d+)\s*,\s*"endSeconds"\s*:/g,
        '$1"startSeconds": $2,\n"endSeconds":'
      )
      .replace(
        /([,{]\s*)(\d+)\s*,\s*"endSeconds"\s*:/g,
        '$1"startSeconds": $2,\n"endSeconds":'
      );
    if (s !== beforeStartSeconds) fixes.push('Restored missing startSeconds field before endSeconds');
  }

  // Pass 1 (regex): Hebrew gershayim כ"ט / abbreviations (word-char " word-char).
  // Must run BEFORE the newline-escape pass so the inS state machine below sees
  // correctly-escaped \" and does not confuse gershayim with string delimiters.
  {
    const beforeGershayim = s;
    s = s.replace(/([ְ-׿\w])"([ְ-׿\w])/g, '$1\\"$2');
    if (s !== beforeGershayim) fixes.push('Escaped Hebrew gershayim / in-word quote(s)');
  }

  // Pass C: Fix structural tail leaked into a string value.
  // Pattern: "field": "\n}..." — Gemini captured closing brackets + sibling fields as a string.
  // Action: escape every internal unescaped " except the last (the true string closer).
  // The surrounding {{ }} from line 356 already close the outer objects correctly.
  {
    const leakRe = /:\s*"\\n}/;
    const leakMatch = leakRe.exec(s);
    if (leakMatch) {
      // Find the opening " of the string value (the " right before \n})
      let valueOpen = -1;
      for (let i = leakMatch.index; i < leakMatch.index + leakMatch[0].length; i++) {
        if (s[i] === '"') { valueOpen = i; }
      }
      if (valueOpen >= 0) {
        // Collect all unescaped " positions after valueOpen (escape-aware forward scan)
        const unescapedPositions = [];
        let esc = false;
        for (let i = valueOpen + 1; i < s.length; i++) {
          if (esc) { esc = false; continue; }
          if (s[i] === '\\') { esc = true; continue; }
          if (s[i] === '"') unescapedPositions.push(i);
        }
        // Escape all internal " — all except the last (which is the true string closer)
        const toEscape = unescapedPositions.slice(0, -1);
        if (toEscape.length > 0) {
          let result = s;
          // Apply in reverse so earlier insertions don't shift later positions
          for (let k = toEscape.length - 1; k >= 0; k--) {
            const pos = toEscape[k];
            result = result.slice(0, pos) + '\\"' + result.slice(pos + 1);
          }
          s = result;
          fixes.push(`Fixed structural tail leaked into string — escaped ${toEscape.length} internal quote(s)`);
        }
      }
    }
  }

  // ── Pass D: Detect string values containing serialized / escaped JSON blocks ──
  // GEM sometimes serializes an entire JSON section as a string value, e.g.:
  //   "specialized": "\n},\n\"brainKnowledge\": {...}"
  // This makes the field un-parseable as structured data and signals a GEM prompt issue.
  // We do not auto-fix the semantics here (Pass C already escapes the stray quotes so the
  // outer JSON can parse), but we add a clear entry to the fixes report.
  {
    // Match: "fieldName": "\n}, — string value that starts with literal \n} (two chars)
    const leakedFieldRe = /"(\w+)"\s*:\s*"\\n}[,{]/;
    const lm = leakedFieldRe.exec(s);
    if (lm) {
      fixes.push(
        `⚠️ Field "${lm[1]}" contains serialized JSON — GEM returned a nested JSON block as a string ` +
        `(value starts with "\\n},"). The outer JSON has been repaired for parsing, ` +
        `but the content of "${lm[1]}" will be a raw string, not a structured object. ` +
        `Fix: in your GEM prompt, instruct: "Return \\"${lm[1]}\\" as a proper JSON object, ` +
        `not as a string value. Do not embed closing braces or sibling fields inside a string."`
      );
    } else {
      // Secondary check: known root-level keys embedded inside a string value (\\n\\"key\\":)
      for (const key of ['brainKnowledge', 'mappingHints', 'briefDate', 'sourceChannel']) {
        // In the raw JSON source, this appears as \n\"key\": (five chars before the key)
        if (s.includes(`\\n\\"${key}\\":`)) {
          fixes.push(
            `⚠️ Key "${key}" found inside a string value — GEM serialized JSON objects as a string. ` +
            `Review the field containing "${key}" and update your GEM prompt to return it as an object.`
          );
          break;
        }
      }
    }
  }

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

  // Pass A: Insert missing commas between consecutive array/object elements.
  // Handles "Expected ',' or ']' after array element" errors (Gemini sometimes omits commas).
  // Only inserts when the char at the error position is a valid JSON value start character.
  {
    let commaFixes = 0;
    for (let attempt = 0; attempt < 30; attempt++) {
      try { JSON.parse(s); break; } catch (err) {
        if (!/after array element|after property value/i.test(err.message)) break;
        const loc = getJsonErrorLocation(s, err.message);
        if (!loc || loc.pos <= 0) break;
        const ch = s[loc.pos];
        // Only insert comma when the char at the error position can start a JSON value
        const isValueStart = ch === '"' || ch === '{' || ch === '[' || ch === 't' || ch === 'f' || ch === 'n' || /\d|-/.test(ch);
        if (!isValueStart) break;
        s = s.slice(0, loc.pos) + ',' + s.slice(loc.pos);
        commaFixes++;
      }
    }
    if (commaFixes > 0) fixes.push(`Inserted ${commaFixes} missing comma(s) between array/object elements`);
  }

  // Pass 2 (position-based): remaining unescaped quotes caught by parse error position.
  //   Runs up to 25 iterations; handles Chrome "position N", Firefox "line N column M",
  //   and Node.js bare "at N" error formats.
  let quoteFixes = 0;
  for (let attempt = 0; attempt < 25; attempt++) {
    try { JSON.parse(s); break; } catch (err) {
      const loc = getJsonErrorLocation(s, err.message);
      if (!loc || loc.pos <= 0) break;
      // The premature " is usually one character before the error, but sometimes
      // a comma or escape sequence sits between them (e.g. .",\n" → error at '\').
      // Scan backwards up to 10 chars to find the nearest unescaped ".
      let fixPos = -1;
      if (s[loc.pos - 1] === '"') {
        fixPos = loc.pos - 1;
      } else {
        for (let k = loc.pos - 2; k >= Math.max(0, loc.pos - 10); k--) {
          if (s[k] === '"') {
            let bs = 0;
            for (let b = k - 1; b >= 0 && s[b] === '\\'; b--) bs++;
            if (bs % 2 === 0) { fixPos = k; break; }
          }
        }
      }
      if (fixPos < 0) break;
      s = s.slice(0, fixPos) + '\\"' + s.slice(fixPos + 1);
      quoteFixes++;
    }
  }
  if (quoteFixes > 0) fixes.push(`Escaped ${quoteFixes} additional unescaped quote(s)`);

  fixes.forEach(fix => console.log(`[JSON Repair] ${fix}`));
  if (fixes.length === 0) console.log('[JSON Repair] No automatic fixes needed');
  return { repairedJson: s, fixes };
}

function repairGemsJson(raw) {
  return repairGemsJsonDetailed(raw).repairedJson;
}

function buildGemsJsonRepairReport({
  source = 'fallback',
  raw,
  repairedJson,
  fixes = [],
  errInfo = null,
  errorContext = null,
  reason = '',
  prevention = [],
  promptCorrection = '',
}) {
  const brokenSnippet = errorContext?.find?.(ln => ln.isError)?.text || '';
  const lines = [
    '# GEMS JSON Repair Report',
    '',
    `Source: ${source === 'ai' ? 'AI' : 'Deterministic Fallback'}`,
    '',
    '## Issue',
    errInfo
      ? `Invalid JSON due to ${errInfo.translation?.he || errInfo.msg || 'syntax error'}.`
      : 'Invalid JSON detected.',
    '',
    '## Location',
    errInfo
      ? `Line ${errInfo.line}, column ${errInfo.col}`
      : 'Location could not be resolved exactly.',
    '',
    '## Broken Snippet',
    brokenSnippet || '(not available)',
    '',
    '## What Was Fixed',
    ...(fixes.length > 0 ? fixes.map((fix) => `- ${fix}`) : ['- No deterministic fix list available']),
    '',
    '## Why It Happened',
    reason || 'The GEM output included invalid JSON syntax such as raw control characters, broken property names, or malformed escaped content.',
    '',
    '## How To Prevent It',
    ...(prevention.length > 0 ? prevention.map((item) => `- ${item}`) : [
      '- Return strict JSON only.',
      '- Escape newline characters as \\n inside strings.',
      '- Do not output raw markdown or extra wrapper text.',
      '- Keep every property name double-quoted.',
    ]),
    '',
    '## Suggested Prompt/Schema Correction',
    promptCorrection || 'Return strict JSON only. Do not include raw newlines inside string values. Escape all newline characters as \\\\n. Do not include markdown links or extra prose unless properly escaped.',
  ];

  if (raw) {
    lines.push('', '## Original Error Context', '```text');
    if (errorContext?.length) {
      lines.push(...errorContext.map((ln) => `${String(ln.lineNum).padStart(4)}: ${ln.text}${ln.isError ? '  ◀' : ''}`));
    } else {
      lines.push(raw.slice(0, 1200));
    }
    lines.push('```');
  }

  if (repairedJson) {
    lines.push('', '## Repaired JSON Preview', '```json', repairedJson.slice(0, 2000), '```');
  }

  return lines.join('\n');
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
  const [activeTab, setActiveTab] = useState("summary");
  const prevTabRef = useRef("summary");
  const appBuilderBulkRef = useRef(null);
  const learningSubTabRef = useRef("chapters"); // tracks last selected learning sub-tab (Phase 5: remove)
  const [activePoliticalTab, setActivePoliticalTab] = useState("brain-hi");
  const [showMorePoliticalTabs, setShowMorePoliticalTabs] = useState(false);
  const {
    multiSelected,
    toggleMultiSelect,
    multiSelectAll,
    multiSelectClear,
    count: tabBulkCount,
    entriesForActiveTab,
  } = useTabBulkSelection(activeTab);

  const [highlightedChapterIndex, setHighlightedChapterIndex] = useState(null);
  const [isManualTranscriptOpen, setIsManualTranscriptOpen] = useState(false);
  const [manualTranscriptInput, setManualTranscriptInput] = useState("");
  const [isSavingManualTranscript, setIsSavingManualTranscript] = useState(false);
  const [isFetchingYtApiTranscript, setIsFetchingYtApiTranscript] = useState(false);
  const [isFreshImportRunning, setIsFreshImportRunning] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState("idle");
  const [geminiMessage, setGeminiMessage] = useState(null);
  const [geminiAnalysisMode, setGeminiAnalysisMode] = useState("smart");
  const [chapterDensityMode, setChapterDensityMode] = useState("normal");
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
  const [chapterTranscriptSource, setChapterTranscriptSource] = useState(null);
  const [isYoutubeChaptersFetch, setIsYoutubeChaptersFetch] = useState(false);
  const [isImportingDescChapters, setIsImportingDescChapters] = useState(false);
  const [hebrewTitlesMap, setHebrewTitlesMap] = useState(() => {
    try {
      const saved = localStorage.getItem('hebrew_chapter_titles_' + (video?.id || ''));
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [isGeneratingHebrewTitles, setIsGeneratingHebrewTitles] = useState(false);
  const [hebrewTitlesError, setHebrewTitlesError] = useState(null);
  const [savedAnalysisMeta, setSavedAnalysisMeta] = useState(null);
  const [isSubtitleEditing, setIsSubtitleEditing] = useState(false);
  const [subtitleDraft, setSubtitleDraft] = useState("");
  const [isSubtitleSaving, setIsSubtitleSaving] = useState(false);
  const [subTopicRec, setSubTopicRec] = useState(null);
  const [subTopicRecDismissed, setSubTopicRecDismissed] = useState(false);
  const [isSubTopicEditing, setIsSubTopicEditing] = useState(false);
  const [subTopicDraft, setSubTopicDraft] = useState("");
  const [isCreatingSubTopic, setIsCreatingSubTopic] = useState(false);
  const [isRepairingDate, setIsRepairingDate] = useState(false);
  const [newSubTopicDraft, setNewSubTopicDraft] = useState("");
  const [isSubTopicPillEditing, setIsSubTopicPillEditing] = useState(false);
  const restoredAnalysisRef = useRef(null);
  const freshImportAutoRunRef = useRef(null);
  const ollamaStatusRequestRef = useRef(false);
  const updateSummary = useUpdateSummary();
  const { video: persistedVideo, patch: patchVideo, setVideo: setVideoState } = usePersistedVideo(videoProp?.id, videoProp);
  // Use videoProp as fallback while the persisted-state hook initializes on first select
  const video = persistedVideo ?? videoProp;
  const [selectedItems, setSelectedItems] = useState(() => video?.selectedKnowledgeItems ?? {});
  const [isKnowledgePickerOpen, setIsKnowledgePickerOpen] = useState(false);
  const [isTranscriptViewerOpen, setIsTranscriptViewerOpen] = useState(false);
  const [isGemsPasteOpen, setIsGemsPasteOpen] = useState(false);
  const [isGemRawOpen, setIsGemRawOpen] = useState(false);
  const [gemsPasteInput, setGemsPasteInput] = useState("");
  const [gemsCopyStatus, setGemsCopyStatus] = useState(null);
  const [gemsPasteError, setGemsPasteError] = useState("");
  const [gemsParsedErrorInfo, setGemsParsedErrorInfo] = useState(null);
  const [gemsRepairApplied, setGemsRepairApplied] = useState(false);
  const [gemsErrorContext, setGemsErrorContext] = useState(null);
  const [isAiRepairingGemsJson, setIsAiRepairingGemsJson] = useState(false);
  const [gemsAiRepairResult, setGemsAiRepairResult] = useState(null);
  const [gemsJsonApplied, setGemsJsonApplied] = useState(false);
  const [marketBriefData, setMarketBriefData] = useState(null);
  const [politicalSummary, setPoliticalSummary] = useState(null);
  const [isPoliticalSummaryLoading, setIsPoliticalSummaryLoading] = useState(false);
  const [politicalSummaryError, setPoliticalSummaryError] = useState(null);
  const [savedPsSections, setSavedPsSections] = useState({});
  const [textSaveMenu, setTextSaveMenu] = useState(null); // { text, sectionLabel, coords: { x, y } }
  const [psCardDropOpen, setPsCardDropOpen] = useState(null); // saveKey of open card dropdown
  const [brainPickerOpen, setBrainPickerOpen] = useState(false);
  const [workspaceSaveOpen, setWorkspaceSaveOpen] = useState(false);
  const [obsidianSettingsOpen, setObsidianSettingsOpen] = useState(false);
  const [obsidianSettingsTargetPath, setObsidianSettingsTargetPath] = useState("");
  const [obsidianSettingsAutoOpenTarget, setObsidianSettingsAutoOpenTarget] = useState(false);
  const [pendingBrainSave, setPendingBrainSave] = useState(null);
  const [pendingObsidianRowSave, setPendingObsidianRowSave] = useState(null);
  const [obsidianItemSaveRevision, setObsidianItemSaveRevision] = useState(0);
  const [multiObsidianPickerMode, setMultiObsidianPickerMode] = useState(false);
  const [obsidianSaveIntent, setObsidianSaveIntent] = useState(null);
  const [saveEntireVideoPackage, setSaveEntireVideoPackage] = useState(true);
  const [saveAllConfirmOpen, setSaveAllConfirmOpen] = useState(false);
  const [newsGemOpened, setNewsGemOpened] = useState(false);
  const [gemPasteOpen, setGemPasteOpen] = useState(false);
  const [gemPasteText, setGemPasteText] = useState("");
  const [saveAllContent, setSaveAllContent] = useState(null);
  const [categoryOverride, setCategoryOverride] = useState(null);
  const [subCategoryOverride, setSubCategoryOverride] = useState(null);
  const [recApplied, setRecApplied] = useState(false);
  const [vaultSubtopics, setVaultSubtopics] = useState([]);
  const [gemOverride, setGemOverride] = useState(null);
  const [showGemModal, setShowGemModal] = useState(false);
  const [gemRecommendationVisible, setGemRecommendationVisible] = useState(false);
  const [gemRecommendationOpening, setGemRecommendationOpening] = useState(false);
  const [showGemsSettings, setShowGemsSettings] = useState(false);
  const [showAiMapping, setShowAiMapping] = useState(false);
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [transcriptSearchIndex, setTranscriptSearchIndex] = useState(0);
  const [transcriptSearchMode, setTranscriptSearchMode] = useState("highlight"); // "highlight" | "filter"
  const [transcriptViewMode, setTranscriptViewMode] = useState("raw"); // "raw" | "reading"
  const [brainSelections, setBrainSelections] = useState({});
  const hasSavedAnalysis = !!savedAnalysisMeta;
  const [attachedDocuments, setAttachedDocuments] = useState(() => Array.isArray(video?.attachedDocuments) ? video.attachedDocuments : []);
  const [includeDocsInAnalysis, setIncludeDocsInAnalysis] = useState(false);
  const [attachedDocsExpanded, setAttachedDocsExpanded] = useState(false);
  const [attachedDocumentsInsights, setAttachedDocumentsInsights] = useState(() => video?.attachedDocumentsInsights ?? null);
  const [savedItemKeys, setSavedItemKeys] = useState(() => new Set());
  const [opponentSentences, setOpponentSentences] = useState([]);
  const [keyPointsFilter, setKeyPointsFilter] = useState("all"); // "all" | "mine" | "opponent"
  const queryClient = useQueryClient();

  useEffect(() => { setShowLowQualityWarning(false); }, [video?.id]);
  useEffect(() => {
    setGemRecommendationVisible(false);
    setGemRecommendationOpening(false);
  }, [video?.id]);
  useEffect(() => {
    const videoId = video?.id || video?.videoId;
    setOpponentSentences(videoId ? getOpponentSentences(videoId) : []);
    setKeyPointsFilter("all");
  }, [video?.id, video?.videoId]);
  useEffect(() => {
    setAttachedDocuments(Array.isArray(video?.attachedDocuments) ? video.attachedDocuments : []);
    setIncludeDocsInAnalysis(false);
    setAttachedDocsExpanded(false);
    setAttachedDocumentsInsights(video?.attachedDocumentsInsights ?? null);
  }, [video?.id]);
  useEffect(() => {
    const videoId = video?.youtubeId || video?.id;
    if (!videoId) {
      setSavedItemKeys(new Set());
      return;
    }
    const prefix = `brain-item:${videoId}:`;
    const ids = getKnowledgeItems()
      .filter((i) => String(i.id || '').startsWith(prefix))
      .map((i) => i.id);
    setSavedItemKeys(new Set(ids));
  }, [video?.youtubeId, video?.id]);
  useEffect(() => {
    const syncSavedKeysFromStore = () => {
      const videoId = video?.youtubeId || video?.id;
      if (!videoId) return;
      const prefix = `brain-item:${videoId}:`;
      const ids = getKnowledgeItems()
        .filter((i) => String(i.id || '').startsWith(prefix))
        .map((i) => i.id);
      setSavedItemKeys(new Set(ids));
    };
    window.addEventListener('knowledge-items-updated', syncSavedKeysFromStore);
    return () => window.removeEventListener('knowledge-items-updated', syncSavedKeysFromStore);
  }, [video?.youtubeId, video?.id]);
  useEffect(() => {
    const loadedSubtitle = typeof video?.customSubtitle === "string" ? video.customSubtitle.trim() : "";
    setSubtitleDraft(loadedSubtitle);
    setIsSubtitleEditing(false);
    console.log("[VideoHeader] Subtitle loaded:", loadedSubtitle || null);
  }, [video?.id, video?.customSubtitle]);
  // Reset subtopic recommendation state when switching videos
  useEffect(() => {
    setSubTopicRec(null);
    setSubTopicRecDismissed(false);
    setIsSubTopicEditing(false);
    setIsCreatingSubTopic(false);
    setNewSubTopicDraft("");
    setSubTopicDraft(typeof video?.subCategory === "string" ? video.subCategory.trim() : "");
  }, [video?.id]);
  useEffect(() => { setSelectedItems(video?.selectedKnowledgeItems ?? {}); }, [video?.id]);
  useEffect(() => {
    if (!video?.id && !video?.youtubeId) { setMarketBriefData(null); return; }
    const ids = [...new Set([video.id, video.youtubeId].filter(Boolean))];
    let loaded = null;
    let loadedFromKey = null;
    for (const id of ids) {
      const key = `market_brief_${id}`;
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          loaded = JSON.parse(stored);
          loadedFromKey = key;
          break;
        }
      } catch {
        loaded = null;
      }
    }
    if (!loaded) loaded = video?.marketBriefData ?? null;
    setMarketBriefData(loaded);
    if (import.meta.env.DEV) {
      console.log('[MarketBriefLoad]', {
        videoId: video.id ?? null,
        youtubeId: video.youtubeId ?? null,
        keysTried: ids.map((id) => `market_brief_${id}`),
        loadedFromKey,
        exists: !!loaded,
        contentType: loaded?.contentType ?? null,
        hasRawData: !!loaded?.rawData,
        hasUtSummary: !!loaded?.universalTabs?.summary,
        hasUtSpecialized: !!loaded?.universalTabs?.specialized,
      });
    }
  }, [video?.id, video?.youtubeId, video?.marketBriefData]);
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
    setGemsPasteError('');
    setGemsParsedErrorInfo(null);
    setGemsRepairApplied(false);
    setGemsErrorContext(null);
    if (!video?.id) { setGemsPasteInput(''); return; }
    // If user deliberately cleared, don't restore
    if (localStorage.getItem(`gems-paste-cleared-${video.id}`) === '1') {
      setGemsPasteInput('');
      return;
    }
    setGemsPasteInput(localStorage.getItem(`gems-paste-${video.id}`) || '');
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
  const mentorResolution = useMemo(() => {
    const mentorResolved = resolveChannelToMentor(video);
    const mentorByName = !mentorResolved && mentorName ? resolveMentorByName(mentorName) : null;
    return mentorResolved ?? mentorByName ?? null;
  }, [mentorName, video]);

  const mentorChannelUrl = useMemo(() => {
    const fromMentor = resolveMentorChannelUrl(mentorResolution?.mentor);
    if (fromMentor) return fromMentor;
    const videoUrl = String(video?.channelUrl || "").trim();
    if (videoUrl.startsWith("http")) return videoUrl;
    const channelId = String(video?.channelId || "").trim();
    if (channelId.startsWith("UC") && channelId.length === 24) {
      return `https://www.youtube.com/channel/${channelId}`;
    }
    return null;
  }, [mentorResolution, video?.channelUrl, video?.channelId]);

  const effectiveCategory = useMemo(() => {
    const normalizedCategoryCandidates = [
      categoryOverride,
      video?.category,
      videoProp?.category,
      mentorResolution?.categoryLabel,
      video?.obsidianTopic,
      videoProp?.obsidianTopic,
    ]
      .map((value) => normalizeCategoryName(value))
      .filter((value) => typeof value === "string" && value.trim().length > 0);

    return normalizedCategoryCandidates[0] || null;
  }, [
    categoryOverride,
    mentorResolution?.categoryLabel,
    video?.category,
    video?.obsidianTopic,
    videoProp?.category,
    videoProp?.obsidianTopic,
  ]);

  const effectiveSubCategory = useMemo(() => {
    // Priority: user-confirmed > local state override > stored subCategory > prop
    const confirmedVal = (video?.userConfirmedSubCategory && video?.confirmedSubCategory)
      ? String(video.confirmedSubCategory).trim()
      : null;
    const rawValue = confirmedVal ?? subCategoryOverride ?? video?.subCategory ?? videoProp?.subCategory;
    return typeof rawValue === "string" ? String(rawValue).trim() : "";
  }, [subCategoryOverride, video?.confirmedSubCategory, video?.userConfirmedSubCategory, video?.subCategory, videoProp?.subCategory]);

  const effectiveVideo = useMemo(() => {
    if (!video) return video;
    return {
      ...video,
      category: effectiveCategory ?? video?.category ?? videoProp?.category ?? undefined,
      subCategory: effectiveSubCategory,
    };
  }, [effectiveCategory, effectiveSubCategory, video, videoProp?.category]);

  const obsidianSettings = useObsidianSettingsState();

  const normalizedSubCategory = useMemo(
    () => normalizeSubCategory(effectiveSubCategory),
    [effectiveSubCategory]
  );

  /** Brief render slug: confirmed subcategory, or infer from pasted GEM marketBrief JSON. */
  const effectiveBriefSlug = useMemo(() => {
    if (normalizedSubCategory) return normalizedSubCategory;
    if (marketBriefData?.contentType === 'marketBrief') return 'morning-brief';
    return null;
  }, [normalizedSubCategory, marketBriefData?.contentType]);

  const handleSaveMarketBriefSection = useCallback(async (sectionId, payload) => {
    if (!marketBriefData) return;
    const videoId = video?.id || video?.youtubeId;
    const next = buildMarketBriefWithSectionOverride(marketBriefData, sectionId, payload);
    persistMarketBriefData(videoId, next, patchVideo);
    setMarketBriefData(next);
    toast.success('השינויים נשמרו');
  }, [marketBriefData, video?.id, video?.youtubeId, patchVideo]);

  const obsidianRoute = useMemo(
    () => resolveVideoObsidianRoute(effectiveVideo || {}, {
      vaultName: obsidianSettings.vaultName,
      vaultPath: obsidianSettings.vaultPath,
    }),
    [effectiveVideo, obsidianSettings.vaultName, obsidianSettings.vaultPath]
  );

  const obsidianRoutingDebug = useMemo(
    () => buildObsidianRoutingDebugInfo(effectiveVideo || {}, {
      vaultName: obsidianSettings.vaultName,
      vaultPath: obsidianSettings.vaultPath,
    }),
    [effectiveVideo, obsidianSettings.vaultName, obsidianSettings.vaultPath]
  );

  const selectedSubTopicName = effectiveSubCategory;
  // Visible header labels should follow the effective video mapping first, then optional AI suggestion.
  const effectiveSubTopicDisplay = effectiveSubCategory || subTopicRec?.recommended || "";
  const isSubTopicAiRec = !effectiveSubCategory && Boolean(subTopicRec?.recommended) && effectiveSubTopicDisplay === subTopicRec?.recommended;
  const marketRootTopic = useMemo(
    () => topics.find((topic) => (!topic.parentId || topic.isMainCategory) && normalizeCategoryName(topic?.name) === MARKET_CATEGORY) || null,
    [topics]
  );
  const politicsRootTopic = useMemo(
    () => topics.find((topic) => (!topic.parentId || topic.isMainCategory) && normalizeCategoryName(topic?.name) === POLITICS_CATEGORY) || null,
    [topics]
  );

  // Resolve the active Brain topic from effectiveCategory (not topicIds[0])
  const activeBrainTopicId = useMemo(() => {
    const norm = normalizeCategoryName(effectiveCategory || '');
    if (!norm) return video?.topicIds?.[0] || null;
    const matched = topics.find(
      (t) => (t.isMainCategory || !t.parentId) && normalizeCategoryName(t.name) === norm
    );
    return matched?.id || video?.topicIds?.[0] || null;
  }, [topics, effectiveCategory, video?.topicIds]);

  const activeBrainTopicName = useMemo(() => {
    const topic = topics.find(t => t.id === activeBrainTopicId);
    return topic?.name || effectiveCategory || 'ידע';
  }, [topics, activeBrainTopicId, effectiveCategory]);

  const [pillAnchorEl, setPillAnchorEl] = useState(null);
  const [categoryPillAnchorEl, setCategoryPillAnchorEl] = useState(null);
  const [isCategoryPillEditing, setIsCategoryPillEditing] = useState(false);

  const resolvedVideoMode = useMemo(() => {
    const lockedCategory = effectiveCategory || null;
    const lockedSubCategory = effectiveSubCategory || null;

    if (lockedCategory === MARKET_CATEGORY) {
      return {
        mode: "market",
        category: MARKET_CATEGORY,
        subCategory: lockedSubCategory,
        analysisType: "market",
        gemType: "fundamental",
        tabsPreset: "market",
      };
    }

    if (lockedCategory === POLITICS_CATEGORY) {
      return {
        mode: "politics",
        category: POLITICS_CATEGORY,
        subCategory: lockedSubCategory,
        analysisType: "political",
        gemType: "political",
        tabsPreset: "politics",
      };
    }

    return {
      mode: "general",
      category: lockedCategory,
      subCategory: lockedSubCategory,
      analysisType: null,
      gemType: null,
      tabsPreset: null,
    };
  }, [effectiveCategory, effectiveSubCategory]);

  const gemRec = useMemo(() => {
    if (!effectiveVideo) return null;
    const transcriptText = String(effectiveVideo?.transcript || effectiveVideo?.manualTranscript || '').trim();
    // Priority: mentor channel → mentor name prop → stored video.category → AI
    const forcedCategoryLabel = mentorResolution?.categoryLabel ?? (effectiveVideo?.category || null);
    const firstTopicId = Array.isArray(effectiveVideo.topicIds) ? effectiveVideo.topicIds[0] : null;
    const forcedTopicName = firstTopicId ? (topics.find(t => t.id === firstTopicId)?.name ?? null) : null;
    const result = classifyVideoForGem(effectiveVideo, transcriptText, { forcedCategoryLabel, forcedTopicName });
    const subCategoryGemKey = resolveGemKeyFromSubCategory(effectiveSubCategory);
    if (subCategoryGemKey) {
      const fallbackMeta = SUBCATEGORY_GEM_META[subCategoryGemKey] || SUBCATEGORY_GEM_META.fundamental;
      const mappedCategory = GEM_CATEGORY_MAP[subCategoryGemKey];
      const gemLabel = subCategoryGemKey === "news" && effectiveSubCategory
        ? effectiveSubCategory
        : fallbackMeta.label;
      return {
        ...result,
        gemKey: subCategoryGemKey,
        gemLabel,
        gemIcon: fallbackMeta.icon,
        recommendedCategoryCode: mappedCategory?.categoryCode ?? result.recommendedCategoryCode,
        recommendedCategoryLabel: effectiveCategory || mappedCategory?.categoryLabel || result.recommendedCategoryLabel,
        recommendedSubCategory: effectiveSubCategory || result.recommendedSubCategory,
        confidence: "high",
        confidenceLabel: "ביטחון גבוה",
        confidencePct: Math.max(result.confidencePct || 0, 95),
        reason: `תת-הנושא "${effectiveSubCategory}" הוא מקור האמת הנוכחי, ולכן המלצת ה-Gem מחושבת ממנו מחדש.`,
      };
    }
    if (resolvedVideoMode.mode === "market" && !MARKET_GEM_KEYS.has(result.gemKey)) {
      const fallbackGemKey = "fundamental";
      const fallbackCategory = GEM_CATEGORY_MAP[fallbackGemKey];
      console.log("[TranscriptGuard] forcing market gem", {
        videoId: effectiveVideo?.id,
        previousGem: result.gemKey,
        nextGem: fallbackGemKey,
        category: resolvedVideoMode.category,
      });
      return {
        ...result,
        gemKey: fallbackGemKey,
        gemLabel: "פונדמנטלי",
        gemIcon: "📊",
        recommendedCategoryCode: fallbackCategory?.categoryCode ?? result.recommendedCategoryCode,
        recommendedCategoryLabel: MARKET_CATEGORY,
        recommendedSubCategory: result.recommendedSubCategory || "ניתוח שוק",
        reason: "מצב שוק ההון נעול לפי קטגוריית הסרטון הקיימת, לכן לא מבוצע מעבר למסלול פוליטי אחרי יבוא תמלול.",
      };
    }
    if (resolvedVideoMode.mode === "politics" && result.gemKey !== "political") {
      const fallbackCategory = GEM_CATEGORY_MAP.political;
      return {
        ...result,
        gemKey: "political",
        gemLabel: "פוליטי",
        gemIcon: "🏛️",
        recommendedCategoryCode: fallbackCategory?.categoryCode ?? result.recommendedCategoryCode,
        recommendedCategoryLabel: POLITICS_CATEGORY,
        recommendedSubCategory: result.recommendedSubCategory || "פוליטיקה פנימית",
        reason: "מצב פוליטיקה נעול לפי קטגוריית הסרטון הקיימת.",
      };
    }
    console.log('[GemDecision]', {
      channel: effectiveVideo?.channelTitle || effectiveVideo?.channelName || effectiveVideo?.channel || '',
      mentorCategory: forcedCategoryLabel ?? 'none',
      topic: forcedTopicName ?? 'none',
      subTopic: result.recommendedSubCategory,
      aiCategory: result.recommendedCategoryLabel,
      selectedGem: result.gemKey,
      decisionSource: mentorResolution ? 'channel_hard_rule'
        : forcedTopicName ? 'topic_hard_rule'
        : forcedCategoryLabel ? 'stored_category_hard_rule'
        : 'ai_classification',
    });
    return result;
  }, [
    effectiveCategory,
    effectiveSubCategory,
    effectiveVideo,
    mentorResolution,
    resolvedVideoMode.category,
    resolvedVideoMode.mode,
    topics,
  ]);

  const videoType = useMemo(
    () => detectVideoType(effectiveVideo),
    [
      effectiveVideo?.category,
      effectiveVideo?.channelName,
      effectiveVideo?.channelTitle,
      effectiveVideo?.contentType,
      effectiveVideo?.mentorName,
      effectiveVideo?.subCategory,
      effectiveVideo?.tags,
      effectiveVideo?.title,
    ]
  );

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


  const hasPoliticalTabSet = effectiveGemInfo?.gemKey === "political" || !!politicalSummary;
  const hasMarketBriefTabSet = !!marketBriefData;
  const hasAppBuilderTabSet = APP_BUILDER_TOPICS.has(resolvedVideoMode.category) || hasAppBuilderDraft(effectiveVideo?.videoId || effectiveVideo?.id);

  const visibleTabDefinitions = UNIVERSAL_TABS;

  const selectedTabsConfigKey = normalizedSubCategory || videoType;
  const isLegacyLearningLayout = !normalizedSubCategory && videoType === "learning";
  const firstAvailableDerivedTab = visibleTabDefinitions[0]?.value || "summary";
  const activeTabItems = useMemo(
    () => extractVideoTabItems(effectiveVideo, activeTab, marketBriefData),
    [activeTab, effectiveVideo, marketBriefData, normalizedSubCategory]
  );

  const prevNormalizedSubCategoryRef = useRef(undefined);
  useEffect(() => {
    if (prevNormalizedSubCategoryRef.current === undefined) {
      prevNormalizedSubCategoryRef.current = normalizedSubCategory;
      return;
    }
    if (prevNormalizedSubCategoryRef.current !== normalizedSubCategory) {
      prevNormalizedSubCategoryRef.current = normalizedSubCategory;
      setActiveTab('summary');
    }
  }, [normalizedSubCategory]);

  useEffect(() => {
    const allowedTabValues = new Set([
      ...visibleTabDefinitions.map((tab) => tab.value),
      ...SUPPLEMENTARY_ALLOWED_TABS,
      ...(resolvedVideoMode.mode === "politics" ? ["political", ...POLITICAL_TAB_VALUES] : []),
    ]);

    if (!activeTab || allowedTabValues.has(activeTab)) return;

    const nextTab = firstAvailableDerivedTab;
    if (!nextTab || nextTab === activeTab) return;

    if (LEARNING_SUB_TAB_VALUES.has(nextTab)) {
      learningSubTabRef.current = nextTab;
    }

    setActiveTab(nextTab);
  }, [activeTab, firstAvailableDerivedTab, resolvedVideoMode.mode, visibleTabDefinitions]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log("[VideoDetailPanel] derived subcategory state", {
      category: effectiveCategory ?? null,
      subCategory: effectiveSubCategory || null,
      normalizedSubCategory: normalizedSubCategory ?? null,
      detectedVideoType: videoType,
      selectedTabsConfigKey,
      activeTab,
    });
  }, [activeTab, effectiveCategory, effectiveSubCategory, normalizedSubCategory, selectedTabsConfigKey, videoType]);

  // ── Diagnostic log: morning-brief + analysis state ────────────────────
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const isBriefType = ['morning-brief','evening-brief','weekly-brief','earnings-brief'].includes(normalizedSubCategory);
    if (!isBriefType) return;
    const summaryFields = [
      video?.shortSummary, video?.fullSummary, video?.summary, video?.gemSummary,
    ].filter(Boolean).length;
    const specializedFields = marketBriefData
      ? Object.values(marketBriefData).filter(v => Array.isArray(v) ? v.length > 0 : !!v).length
      : 0;
    console.log('[BriefDiagnostic]', {
      category: effectiveCategory ?? null,
      subCategory: effectiveSubCategory || null,
      normalizedSubCategory,
      tabsKey: selectedTabsConfigKey,
      contentType: video?.contentType || null,
      userConfirmedSubCategory: video?.userConfirmedSubCategory ?? false,
      confirmedSubCategory: video?.confirmedSubCategory ?? null,
      'marketBriefData.exists': !!marketBriefData,
      'marketBriefData.contentType': marketBriefData?.contentType ?? null,
      'analysis.exists': !!(video?.shortSummary || video?.fullSummary),
      'summaryFieldsCount': summaryFields,
      'specializedFieldsCount': specializedFields,
      'transcript.length': (video?.transcript || '').length || 0,
      'gemRec.gemKey': gemRec?.gemKey ?? null,
      'gemRec.confidence': Math.round(gemRec?.confidencePct || 0),
    });
  }, [effectiveCategory, effectiveSubCategory, normalizedSubCategory, selectedTabsConfigKey,
      video?.contentType, video?.shortSummary, video?.fullSummary, video?.userConfirmedSubCategory,
      video?.confirmedSubCategory, video?.transcript, marketBriefData, gemRec]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log("[ObsidianRouting][VideoDetail]", {
      activeVault: obsidianRoutingDebug.activeVault,
      sourceOfActiveVault: obsidianRoutingDebug.sourceOfActiveVault,
      category: obsidianRoutingDebug.category,
      subCategory: obsidianRoutingDebug.subCategory,
      normalizedSubCategory: obsidianRoutingDebug.normalizedSubCategory,
      resolvedFolder: obsidianRoutingDebug.resolvedFolder,
      finalFilePath: obsidianRoutingDebug.finalFilePath,
      obsidianUrl: obsidianRoutingDebug.obsidianUrl,
    });
  }, [obsidianRoutingDebug]);

  useEffect(() => {
    if (!video?.id || resolvedVideoMode.mode !== "market" || !marketRootTopic?.id) {
      setVaultSubtopics([]);
      setSubTopicRec(null);
      return;
    }

    const systemSubtopics = topics
      .filter((topic) => topic.parentId === marketRootTopic.id)
      .map((topic) => ({ id: topic.id, name: String(topic.name || "").trim(), isCustom: false }))
      .filter((topic) => topic.name && !FORBIDDEN_MARKET_SUBTOPICS.has(topic.name));

    const customSubtopics = ((loadCustomBrainDests().subs?.[marketRootTopic.id]) || [])
      .map((topic) => ({ id: topic.id, name: String(topic?.name || "").trim(), isCustom: true }))
      .filter((topic) => topic.name && !FORBIDDEN_MARKET_SUBTOPICS.has(topic.name));

    const mergedSubtopics = [...systemSubtopics, ...customSubtopics].filter((topic, index, list) => {
      const normalized = normalizeLooseName(topic.name);
      return normalized && list.findIndex((candidate) => normalizeLooseName(candidate.name) === normalized) === index;
    });

    const existingNames = new Set(mergedSubtopics.map((s) => normalizeLooseName(s.name)));
    const canonicalToAdd = CANONICAL_MARKET_SUBTOPICS.filter(
      (c) => !existingNames.has(normalizeLooseName(c.name))
    );

    setVaultSubtopics([...mergedSubtopics, ...canonicalToAdd]);

    const candidateNames = getMarketSubTopicCandidates(
      effectiveGemInfo?.gemKey,
      effectiveGemInfo?.gemLabel,
      gemRec?.recommendedSubCategory
    );
    const matchedSubTopic = findExistingSubTopic(candidateNames, mergedSubtopics);
    const dismissedRecommendation = normalizeLooseName(video?.dismissedSubTopicRec);
    const selectedNormalized = normalizeLooseName(selectedSubTopicName);

    if (!matchedSubTopic) {
      setSubTopicRec(null);
      return;
    }

    const recommendedNormalized = normalizeLooseName(matchedSubTopic.name);
    if (!subTopicDraft) {
      setSubTopicDraft(selectedSubTopicName || matchedSubTopic.name);
    }

    if (dismissedRecommendation && dismissedRecommendation === recommendedNormalized) {
      setSubTopicRecDismissed(true);
    }

    if (selectedNormalized && selectedNormalized === recommendedNormalized) {
      setSubTopicRec(null);
      return;
    }

    setSubTopicRec({
      recommended: matchedSubTopic.name,
      confidence: effectiveGemInfo?.gemKey === "technical" || effectiveGemInfo?.gemKey === "fundamental" ? 0.94 : 0.88,
      reason: `Gem מומלץ: ${effectiveGemInfo?.gemLabel || gemRec?.gemLabel || "שוק ההון"} — לכן מומלץ תת-נושא תואם מתוך רשימת Obsidian הקיימת.`,
      source: effectiveGemInfo?.gemKey || gemRec?.gemKey || null,
    });
  }, [
    effectiveGemInfo?.gemKey,
    effectiveGemInfo?.gemLabel,
    gemRec?.gemKey,
    gemRec?.recommendedSubCategory,
    marketRootTopic?.id,
    resolvedVideoMode.mode,
    selectedSubTopicName,
    subTopicDraft,
    topics,
    video?.dismissedSubTopicRec,
    video?.id,
  ]);

  // Sub-topics list for the pill dropdown — includes video count per sub-topic
  const pillSubtopicsWithCounts = useMemo(() => {
    const allVideos = loadVideos();
    let rawSubs = [];

    if (resolvedVideoMode.mode === "market") {
      rawSubs = vaultSubtopics;
      // Fallback: collect unique subCategory values from all market videos + canonical list
      if (!rawSubs.length) {
        const seen = new Set();
        allVideos
          .filter(v => normalizeCategoryName(v.category) === MARKET_CATEGORY)
          .forEach(v => {
            const sub = String(v.subCategory || "").trim();
            if (sub && !seen.has(sub.toLowerCase())) {
              seen.add(sub.toLowerCase());
              rawSubs.push({ id: `meta:${sub}`, name: sub, isCustom: true });
            }
          });
        CANONICAL_MARKET_SUBTOPICS.forEach((c) => {
          if (!seen.has(normalizeLooseName(c.name))) {
            seen.add(normalizeLooseName(c.name));
            rawSubs.push(c);
          }
        });
      }
    } else if (resolvedVideoMode.mode === "politics" && politicsRootTopic) {
      // BFS: collect ALL descendants of the politics root
      const rootId = politicsRootTopic.id;
      const queue = [rootId];
      while (queue.length) {
        const parentId = queue.shift();
        topics.filter((t) => t.parentId === parentId).forEach((t) => {
          const name = String(t.name || "").trim();
          if (name) {
            rawSubs.push({ id: t.id, name, isCustom: false });
            queue.push(t.id);
          }
        });
      }
    }

    if (!rawSubs.length) return rawSubs;
    return rawSubs.map((s) => ({
      ...s,
      count: allVideos.filter(
        (v) => String(v.subCategory || "").trim().toLowerCase() === s.name.trim().toLowerCase()
      ).length,
    }));
  }, [resolvedVideoMode.mode, vaultSubtopics, politicsRootTopic, topics]);

  // Main categories for the category pill dropdown — loaded from app topics config
  const pillCategoriesOptions = useMemo(() => {
    const mainTopics = topics.filter((t) => (t.isMainCategory || !t.parentId) && t.name);
    const allVideos = loadVideos();
    return mainTopics.map((t) => ({
      id: t.id,
      name: String(t.name || "").trim(),
      isCustom: false,
      count: allVideos.filter(
        (v) => normalizeCategoryName(v.category) === normalizeCategoryName(t.name)
      ).length,
    }));
  }, [topics]);

  useEffect(() => {
    if (!open || initialChapterIndex == null) {
      setHighlightedChapterIndex(null);
      return;
    }
    setHighlightedChapterIndex(initialChapterIndex);
    setActiveTab("chapters");
  }, [open, initialChapterIndex]);

  useEffect(() => {
    if (resolvedVideoMode.mode === "politics" || activeTab !== "political") return;
    console.log("[TranscriptGuard] leaving political tab because resolved mode is", resolvedVideoMode.mode);
    setActiveTab("summary");
  }, [activeTab, resolvedVideoMode.mode]);

  // Close PCard save dropdown when clicking outside of it (safer than a full-screen backdrop)
  useEffect(() => {
    if (!psCardDropOpen) return;
    function handleDown(e) {
      if (!e.target.closest('[data-pcard-drop]')) {
        setPsCardDropOpen(null);
      }
    }
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, [psCardDropOpen]);

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
      // Learning tab fields (technical GEM)
      definitions: Array.isArray(savedAnalysis.definitions) ? savedAnalysis.definitions : undefined,
      indicators: Array.isArray(savedAnalysis.indicators) ? savedAnalysis.indicators : undefined,
      setups: Array.isArray(savedAnalysis.setups) ? savedAnalysis.setups : undefined,
      patterns: Array.isArray(savedAnalysis.patterns) ? savedAnalysis.patterns : undefined,
      tradingPrinciples: Array.isArray(savedAnalysis.tradingPrinciples) ? savedAnalysis.tradingPrinciples : undefined,
      mentalModels: Array.isArray(savedAnalysis.mentalModels) ? savedAnalysis.mentalModels : undefined,
      brainHighlights: Array.isArray(savedAnalysis.brainHighlights) ? savedAnalysis.brainHighlights : undefined,
      usefulKnowledge: Array.isArray(savedAnalysis.usefulKnowledge) ? savedAnalysis.usefulKnowledge : undefined,
      keyTakeaways: Array.isArray(savedAnalysis.keyTakeaways) ? savedAnalysis.keyTakeaways : undefined,
      brainSummary: savedAnalysis.brainSummary ?? undefined,
      contentType: savedAnalysis.contentType ?? undefined,
      mainClaim: savedAnalysis.mainClaim ?? undefined,
      speakerPosition: savedAnalysis.speakerPosition ?? undefined,
      duration: savedAnalysis.duration ?? undefined,
      viewCount: savedAnalysis.viewCount ?? undefined,
      customSubtitle: savedAnalysis.customSubtitle ?? undefined,
      attachedDocumentsInsights: savedAnalysis.attachedDocumentsInsights ?? undefined,
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

  useEffect(() => {
    // Load persisted "waiting for GEM summary" state from localStorage
    const vid = video?.id;
    const waiting = vid ? localStorage.getItem(`gem-summary-waiting-${vid}`) === 'true' : false;
    // Only show waiting if no summary exists yet (DB wins over localStorage flag)
    setNewsGemOpened(waiting && !video?.gemSummary);
    setGemPasteOpen(false);
    setGemPasteText("");
  }, [video?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-assign main topic from mentor configuration when video has no topicIds
  useEffect(() => {
    if (!video?.id) return;
    if ((video.topicIds?.length ?? 0) > 0) return;
    const rootTopic =
      resolvedVideoMode.mode === "market" ? marketRootTopic
      : resolvedVideoMode.mode === "politics" ? politicsRootTopic
      : null;
    if (!rootTopic?.id) return;
    saveVideoFields({
      topicIds: [rootTopic.id],
      category: resolvedVideoMode.category,
    });
  }, [video?.id, resolvedVideoMode.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveGemPaste = useCallback(async () => {
    const text = gemPasteText.trim();
    if (!text) {
      toast.error("⚠ אין תוכן — הדבק את הסיכום מה-GEM לפני השמירה");
      return;
    }
    await saveVideoFields({ gemSummary: text });
    if (video?.id) localStorage.removeItem(`gem-summary-waiting-${video.id}`);
    setNewsGemOpened(false);
    setGemPasteOpen(false);
    setGemPasteText("");
    toast.success("🟢 סיכום ה-GEM נשמר");
  }, [gemPasteText, saveVideoFields]);

  const currentCustomSubtitle = typeof video?.customSubtitle === "string" ? video.customSubtitle.trim() : "";
  const subtitleDisplayValue = currentCustomSubtitle || "הוסף תת-כותרת";

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
        video?.chapterSource ||
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

  const descriptionChapters = useMemo(() => {
    const structured = resolveStructuredChapters(video || {});
    if (structured.length > 0) return structured;

    // localStorage strips video.description — but videoProp (from Base44 / React Query)
    // may still carry the original field. Try it as a second source.
    if (videoProp && videoProp !== video) {
      const fromProp = resolveStructuredChapters(videoProp);
      if (fromProp.length > 0) return fromProp;
    }

    // When video.description was stripped from the entity, check the youtubeChapterCache
    // for chapters fetched in a prior session without requiring an API call.
    const watchUrl = getWatchUrl(video);
    const ytId = getVideoIdFromUrl(watchUrl);
    if (!ytId) return [];
    const cached = getCachedVideoMetadata(ytId);
    const cachedChapters = Array.isArray(cached?.chapters) ? cached.chapters : [];
    if (!cachedChapters.length) return [];
    return cachedChapters.map((c) => ({
      ...c,
      timeSource: c.timeSource || 'real',
      chapterSource: c.chapterSource || 'description_timestamp',
      source: c.source || 'description_timestamp',
    }));
  }, [video, videoProp]);

  const gemChapters = useMemo(() => {
    const normalized = normalizeGemChapters(extractVideoTabItems(effectiveVideo, 'chapters', marketBriefData));
    if (!normalized.length) return [];

    // Refine chapters that are missing timestamps using transcript segments when available.
    // Chapters with valid timestamps are kept unchanged by matchChaptersToTranscript.
    const hasMissingTimestamps = normalized.some((ch) => ch.timestampSource === 'missing');
    if (!hasMissingTimestamps) return normalized;

    const rawSegs = Array.isArray(effectiveVideo?.transcriptSegments) && effectiveVideo.transcriptSegments.length > 0
      ? effectiveVideo.transcriptSegments
      : null;
    if (!rawSegs) return normalized;

    const lines = rawSegs
      .map((s) => ({ text: String(s?.text || '').trim(), start: Number(s?.startSeconds ?? s?.start ?? 0) }))
      .filter((l) => l.text);
    if (!lines.length) return normalized;

    const refined = matchChaptersToTranscript(normalized, { lines });
    return refined ?? normalized;
  }, [effectiveVideo, marketBriefData]);
  const transcriptChaptersRaw = useMemo(() => {
    const sourceVideo = isTranscriptChunkChapterSource(effectiveVideo?.chapterSource)
      ? effectiveVideo
      : isTranscriptChunkChapterSource(video?.chapterSource)
        ? video
        : null;
    return sourceVideo ? resolveTranscriptChunkDisplayChapters(sourceVideo) : [];
  }, [effectiveVideo, video]);

  const transcriptQualityResult = useMemo(
    () => transcriptChaptersRaw.length > 0 ? validateTranscriptChapterQuality(transcriptChaptersRaw) : null,
    [transcriptChaptersRaw],
  );

  const transcriptChunkChapters = useMemo(() => {
    if (transcriptChaptersRaw.length === 0) return [];
    if (!transcriptQualityResult?.valid) {
      console.warn(
        '[Chapters] Stored transcript chapters failed display quality check:',
        transcriptQualityResult?.reason,
        transcriptQualityResult?.detail ?? transcriptChaptersRaw.map(c => c.title),
      );
      return [];
    }
    return transcriptChaptersRaw;
  }, [transcriptChaptersRaw, transcriptQualityResult]);

  const aiAnalysisChapters = useMemo(() => {
    const sourceVideo = isAiAnalysisChapterSource(effectiveVideo?.chapterSource)
      ? effectiveVideo
      : isAiAnalysisChapterSource(video?.chapterSource)
        ? video
        : null;
    return sourceVideo ? resolveAiAnalysisDisplayChapters(sourceVideo) : [];
  }, [effectiveVideo, video]);

  // When the user explicitly ran transcript chapter generation, those take priority over GEM
  // (which may have stale estimated timestamps). Description timestamps always win.
  const hasExplicitTranscriptChapters =
    transcriptChunkChapters.length > 0 &&
    (isTranscriptChunkChapterSource(video?.chapterSource) ||
      isTranscriptChunkChapterSource(effectiveVideo?.chapterSource));

  const displayChapters =
    descriptionChapters.length > 0
      ? descriptionChapters
      : hasExplicitTranscriptChapters
        ? transcriptChunkChapters
        : gemChapters.length > 0
          ? gemChapters
          : aiAnalysisChapters.length > 0
            ? aiAnalysisChapters
            : transcriptChunkChapters.length > 0
              ? transcriptChunkChapters
              : baseChapters;
  const chaptersFromGem =
    descriptionChapters.length === 0 &&
    aiAnalysisChapters.length === 0 &&
    transcriptChunkChapters.length === 0 &&
    gemChapters.length > 0;

  const savedAnalysisTranscript = useMemo(
    () => (video?.id ? loadSavedAnalysis(video.id) : null),
    [video?.id],
  );
  const videoDurationForChapters = useMemo(() => {
    const rawDurationSec = getVideoDurationSeconds(video);
    const labelDurationSec = parseDurationToSeconds(video?.durationLabel);
    if (labelDurationSec > 0 && rawDurationSec > 0) {
      const ratio = Math.max(rawDurationSec, labelDurationSec) / Math.min(rawDurationSec, labelDurationSec);
      return ratio > 3 ? labelDurationSec : rawDurationSec;
    }
    return labelDurationSec > 0 ? labelDurationSec : rawDurationSec;
  }, [video]);
  const transcriptForChapters = useMemo(
    () => resolveTranscriptForChapters(video, savedAnalysisTranscript, videoDurationForChapters),
    [video, savedAnalysisTranscript, videoDurationForChapters],
  );

  const handleDismissChaptersHint = () => setYoutubeChaptersHint(null);

  useEffect(() => {
    setYoutubeChaptersHint(null);
    setTranscriptDiagnostics(null);
    setChapterTranscriptSource(null);
  }, [video?.id]);

  // Auto-extract description timestamps on video load — runs once per video,
  // only when the description field is still available (before stripping) and
  // no descriptionChapters have been saved yet.
  useEffect(() => {
    if (!video?.id) return;
    if (Array.isArray(video.descriptionChapters) && video.descriptionChapters.length > 0) return;
    // videoProp retains the description field from Base44 even after localStorage strips it
    const existingDesc =
      (typeof video?.description === 'string' ? video.description.trim() : '') ||
      (typeof videoProp?.description === 'string' ? videoProp.description.trim() : '');
    if (!existingDesc) return;
    const descChapters = extractTimestampsFromDescription(existingDesc);
    if (descChapters.length < 2) return;
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
      Video.update(video.id, updates)
        .then(() => { patchVideo(updates); onVideoPatch?.({ ...video, ...updates }); })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handlePullDescriptionChapters = async () => {
    setIsImportingDescChapters(true);
    try {
      const watchUrl = getWatchUrl(video);
      const ytId = getVideoIdFromUrl(watchUrl);

      // ── Step 1: collect description text from all local sources ──────────────
      // localStorage strips video.description; check videoProp (Base44) too.
      let descText =
        (typeof video?.description === 'string' ? video.description.trim() : '') ||
        (typeof videoProp?.description === 'string' ? videoProp.description.trim() : '');

      // Also try the youtubeChapterCache description text.
      if (!descText && ytId) {
        const cached = getCachedVideoMetadata(ytId);
        if (typeof cached?.description === 'string' && cached.description.trim()) {
          descText = cached.description.trim();
        }
      }

      // ── Step 2: if no local description, fetch from YouTube (no API key needed) ──
      if (!descText && ytId) {
        try {
          const fetched = await fetchVideoDescription(ytId);
          if (fetched) {
            descText = fetched;
            // Cache for future use.
            const parsedForCache = extractTimestampsFromDescription(fetched);
            setCachedVideoMetadata(ytId, { description: fetched, chapters: parsedForCache });
          }
        } catch {
          // Network/proxy failure — continue with empty description.
        }
      }

      console.log('[pullDescChapters] descText length:', descText.length, '/ first 200:', descText.slice(0, 200));

      // ── Step 3: parse timestamps ──────────────────────────────────────────────
      let chaptersResult = descText ? extractTimestampsFromDescription(descText) : [];

      // If full description parse found nothing, try pre-parsed chapters from cache.
      if (!chaptersResult.length && ytId) {
        const cached = getCachedVideoMetadata(ytId);
        if (Array.isArray(cached?.chapters) && cached.chapters.length) {
          chaptersResult = cached.chapters;
        }
      }

      // ── Error messages ────────────────────────────────────────────────────────
      if (!descText) {
        toast.error('לא נמצא תיאור מלא לסרטון — נסה להשתמש בכפתור "Fetch YouTube Chapters"');
        return;
      }

      if (!chaptersResult.length) {
        toast.error('נמצא תיאור, אבל לא נמצאו פרקי זמן תקינים');
        return;
      }

      const aiChapters = chaptersResult.map((c) => {
        const sec = typeof c.startSeconds === 'number' ? c.startSeconds : null;
        return {
          ...c,
          ...(sec != null ? { startSeconds: sec } : {}),
          timeSource: 'real',
          chapterSource: 'description_timestamp',
          source: 'description_timestamp',
          isEstimated: false,
        };
      });

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
          return;
        }
      }
      toast.success(`הפרקים מהתיאור נטענו בהצלחה (${aiChapters.length} פרקים)`);
    } finally {
      setIsImportingDescChapters(false);
    }
  };

  const handleAutoDetectChapters = async () => {
    setYoutubeChaptersHint(null);

    // Debug: log current state before detection
    const _apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    const _segs = transcriptForChapters.segments;
    console.log(`[Chapters] transcriptExists=${Boolean(_segs?.length > 0)} source=${transcriptForChapters.source ?? 'none'} apiKeyExists=${Boolean(_apiKey?.trim())} chapterSource=${chapterSourceInfo?.source ?? 'none'}`);

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

    // Step 3: no description timestamps, no local transcript — generate via Gemini (no YouTube API key needed)
    const watchUrl = getWatchUrl(video);
    const videoId = getVideoIdFromUrl(watchUrl);
    if (!watchUrl || !videoId) {
      setYoutubeChaptersHint("no_api_key");
      return;
    }
    setIsYoutubeChaptersFetch(true);
    try {
      const rawDurationSec = getVideoDurationSeconds(video);
      const labelDurationSec = parseDurationToSeconds(video?.durationLabel);
      // If both exist and conflict by more than 3×, prefer durationLabel (raw may be stored in wrong unit)
      const durationSec = (() => {
        if (labelDurationSec > 0 && rawDurationSec > 0) {
          const ratio = Math.max(rawDurationSec, labelDurationSec) / Math.min(rawDurationSec, labelDurationSec);
          return ratio > 3 ? labelDurationSec : rawDurationSec;
        }
        return labelDurationSec > 0 ? labelDurationSec : rawDurationSec;
      })();
      const chaptersTarget = computeTargetChapters(durationSec, chapterDensityMode);
      const result = await fetchGeminiVideoContent({
        videoId,
        title: video?.title || '',
        youtubeUrl: watchUrl,
        durationSeconds: durationSec || null,
        chaptersTarget,
        analysisMode: 'url_only',
      });
      const rawChapters = Array.isArray(result?.chapters) ? result.chapters : [];
      const normalized = normalizeGemChapters(rawChapters);
      if (!normalized.length) {
        setYoutubeChaptersHint("no_timestamps");
        return;
      }
      const aiChapters = normalized.map(c => ({ ...c, source: 'gem' }));
      const coverage = validateChapterTimelineCoverage(aiChapters, durationSec);
      if (!coverage.ok) {
        console.warn('[Gemini chapters fallback] incomplete timeline coverage', coverage);
        setYoutubeChaptersHint("partial_coverage");
        toast.warning(coverage.reason || 'הפרקים לא מכסים את כל הסרטון — לא נשמרו');
        return;
      }
      const updates = { aiChapters, chapters: aiChapters, chapterSource: 'gem' };
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
          return;
        }
      }
      toast.success(`נוצרו ${aiChapters.length} פרקים בעזרת Gemini`);
      setYoutubeChaptersHint(null);
    } catch (err) {
      console.error('[Gemini chapters fallback]', err);
      setYoutubeChaptersHint("fetch_failed");
    } finally {
      setIsYoutubeChaptersFetch(false);
    }
  };

  const handleGenerateHebrewTitles = async () => {
    const chapters = displayChapters.length > 0 ? displayChapters : baseChapters;
    if (!chapters || chapters.length === 0) {
      toast.error('אין פרקים לעיבוד');
      return;
    }
    setIsGeneratingHebrewTitles(true);
    setHebrewTitlesError(null);
    try {
      const chapterPayload = chapters.map(ch => ({
        title: ch.title || '',
        startSeconds: ch.startSeconds ?? null,
        endSeconds: ch.endSeconds ?? null,
        transcriptText: typeof ch.transcriptText === 'string' ? ch.transcriptText.slice(0, 400) : '',
      }));
      const { hebrewTitles } = await fetchHebrewChapterTitles({
        videoTitle: video?.title || '',
        category: effectiveCategory || '',
        subCategory: effectiveSubCategory || '',
        chapters: chapterPayload,
      });
      const generatedAt = new Date().toISOString();
      const newMap = {};
      hebrewTitles.forEach((hebrewTitle, i) => {
        if (hebrewTitle && chapters[i]) {
          newMap[i] = {
            hebrewTitle,
            originalTitle: chapters[i].title || '',
            startSeconds: chapters[i].startSeconds ?? null,
            source: 'ai-hebrew-title',
            generatedAt,
          };
        }
      });
      setHebrewTitlesMap(newMap);
      try {
        localStorage.setItem('hebrew_chapter_titles_' + (video?.id || ''), JSON.stringify(newMap));
      } catch {}
      toast.success('כותרות עבריות נוצרו בהצלחה');
    } catch (err) {
      console.error('[HebrewTitles] generation failed', { code: err.code, message: err.message, status: err.status });
      const msg = err.code === 'GEMINI_API_KEY_MISSING'
        ? 'נדרש חיבור AI כדי ליצור כותרות עבריות.'
        : 'שגיאה ביצירת כותרות עבריות';
      setHebrewTitlesError(msg);
      toast.error(msg);
    } finally {
      setIsGeneratingHebrewTitles(false);
    }
  };

  const handleGenerateTranscriptChapters = () => {
    const resolution = transcriptForChapters;
    if (!resolution.hasUsableText || !resolution.lines.length) {
      setYoutubeChaptersHint("no_transcript");
      toast.error("לא נמצא תמלול שמור. הדבק או הורד תמלול ואז נסה שוב.");
      return;
    }

    console.log(`[Chapters] generating from transcript source=${resolution.source ?? "unknown"} lines=${resolution.lines.length}`);

    const generated = generateChaptersFromTranscript({ lines: resolution.lines }, video);
    let chapters = generated?.chapters ?? null;
    let chapterSource = generated?.chapterSource || "transcript_heuristic";
    let analysisQuality = generated?.analysisQuality || "low";
    const boundaryMethod = generated?.boundaryMethod || "chunk";

    if (!chapters?.length) {
      const plainText =
        getVideoTranscriptText(video) ||
        resolution.lines.map((line) => line.text).join(" ");
      chapters = splitPlainTranscriptToChapters(plainText, videoDurationForChapters);
      chapterSource = "transcript_heuristic";
      analysisQuality = "low";
    }

    if (!chapters?.length) {
      setYoutubeChaptersHint("transcript_gen_failed");
      toast.error("לא ניתן ליצור פרקים מהתמלול. נסה לקצר את התמלול או להדביק תמלול נקי יותר.");
      return;
    }

    console.log(`[Chapters] boundaryMethod=${boundaryMethod} source=${chapterSource} count=${chapters.length}`);

    const aiChapters = chapters.map((c) => ({
      ...c,
      chapterSource: c.chapterSource || chapterSource,
      source: chapterSource,
      timeSource: c.timeSource || "transcript",
      analysisQuality: c.analysisQuality || analysisQuality,
    }));

    const coverage = validateChapterTimelineCoverage(aiChapters, videoDurationForChapters);
    if (!coverage.ok && !coverage.skipped) {
      console.warn("[Chapters] transcript chapters incomplete coverage", coverage);
      setYoutubeChaptersHint("transcript_gen_failed");
      toast.warning(coverage.reason || "הפרקים לא מכסים את כל הסרטון — לא נשמרו");
      return;
    }

    const titleQuality = validateTranscriptChapterQuality(aiChapters);
    if (!titleQuality.valid) {
      console.warn(`[Chapters] Title quality gate failed: ${titleQuality.reason}`, aiChapters.map(c => c.title));
      toast.error('לא עודכנו פרקים — איכות הכותרות נמוכה');
      return;
    }

    const updates = {
      aiChapters,
      chapters: aiChapters,
      chapterSource,
      analysisQuality,
    };
    const localSaved = patchVideo(updates);
    const savedVideo = localSaved ?? { ...video, ...updates };
    if (localSaved) {
      onVideoPatch?.(localSaved);
    } else {
      Video.update(video.id, updates)
        .then(() => {
          patchVideo(updates);
          queryClient.invalidateQueries({ queryKey: ["videos"] });
          onVideoPatch?.({ ...video, ...updates });
        })
        .catch(() => toast.error("לא ניתן לשמור את הפרקים"));
    }
    setChapterTranscriptSource(resolution.source);
    setYoutubeChaptersHint(null);
    const renderedCount = resolveTranscriptChunkDisplayChapters(savedVideo, aiChapters).length;
    const methodLabel = boundaryMethod === "topic" ? "לפי נושאים" : "חלוקה שווה (איכות נמוכה)";
    toast.success(`נוצרו ${renderedCount} פרקים מהתמלול — ${methodLabel}`);
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
    if (!fullTranscriptText || fullTranscriptText.trim().length < 100) {
      toast.error("אין תמלול זמין — ייבא תמלול מ-YouTube או הדבק ידנית כדי לנתח");
      return;
    }
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
    const isPolitical = resolvedVideoMode.mode === "politics" && effectiveGemInfo?.gemKey === 'political';
    const videoId = video?.id || video?.youtubeId;
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
  }, [video?.id, video?.youtubeId, effectiveGemInfo?.gemKey, resolvedVideoMode.mode]);

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

  // Save a summary section to a specific destination (Obsidian download or Workspace)
  const handleSavePsSectionTo = useCallback((sectionKey, sectionLabel, content, destination) => {
    const videoId = video?.youtubeId || video?.id;
    if (!videoId || !content) return;
    const markdownContent = Array.isArray(content)
      ? content.map((s, i) => `${i + 1}. ${s}`).join('\n')
      : String(content);

    if (destination === 'brain') {
      handleSavePsSection(sectionKey, sectionLabel, content);
      return;
    }
    if (destination === 'obsidian') {
      const md = `## ${sectionLabel}\n\n${markdownContent}\n\n---\nמקור: [${video?.title || ''}](https://youtube.com/watch?v=${videoId})\nתאריך: ${new Date().toLocaleDateString('he-IL')}`;
      downloadMarkdown(md, `${sectionLabel}-${videoId}.md`);
      toast.success('💾 קובץ Markdown הורד לייבוא ל-Obsidian');
      return;
    }
    const now = new Date().toISOString();
    const isOpponent = destination === 'opponent';
    const item = {
      id: `ps_${isOpponent ? 'opp' : 'ws'}:${videoId}:${sectionKey}`,
      title: `${sectionLabel} — ${video?.title || 'סרטון'}`,
      content: `## ${sectionLabel}\n\n${markdownContent}\n\n---\nמקור: [${video?.title || ''}](https://youtube.com/watch?v=${videoId})`,
      topicId: video?.topicIds?.[0] || null,
      videoId,
      videoTitle: video?.title || '',
      channelTitle: video?.channelTitle || video?.channelName || '',
      sourceType: 'youtube',
      sectionName: sectionKey,
      workspacePath: isOpponent
        ? `פוליטיקה/דעת הצד השני/${(video?.title || videoId).slice(0, 40)}/${sectionLabel}.md`
        : `Workspace/סיכומים/${(video?.title || videoId).slice(0, 40)}/${sectionLabel}.md`,
      createdAt: now,
      updatedAt: now,
      metadata: {
        perspective: isOpponent ? 'opponent' : 'self',
        contentRole: isOpponent ? 'opponent_view' : 'my_position',
        userPosition: isOpponent ? 'opposed' : 'endorsed',
        sectionName: sectionKey,
        videoId,
        videoTitle: video?.title || '',
        topic: video?.category || null,
        subTopic: video?.subCategory || null,
        createdAt: now,
      },
    };
    upsertKnowledgeItem(item);
    setSavedPsSections(prev => ({ ...prev, [sectionKey]: true }));
    toast.success(isOpponent ? `⚔️ ${sectionLabel} נשמר כדעת האויב` : `⭐ ${sectionLabel} נשמר ל-Workspace`);
  }, [video, handleSavePsSection]);

  // Mouse-up handler for text selection inside summary cards
  const handleSummaryMouseUp = useCallback((e) => {
    // Ignore clicks on buttons
    if (e.target.closest('button')) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (text.length < 5) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const card = e.target.closest('[data-section]');
    const sectionLabel = card?.dataset.section || 'סיכום';
    setTextSaveMenu({ text, sectionLabel, coords: { x: rect.left, y: rect.top } });
  }, []);

  // Save a selected text snippet to a specific destination
  const handleSummaryTextSave = useCallback((text, sectionLabel, destination) => {
    const videoId = video?.youtubeId || video?.id;
    if (!videoId || !text) return;
    const now = new Date().toISOString();
    const isOpponent = destination === 'opponent';

    if (destination === 'obsidian') {
      const md = `## ${sectionLabel} — קטע נבחר\n\n${text}\n\n---\nמקור: [${video?.title || ''}](https://youtube.com/watch?v=${videoId})\nתאריך: ${new Date().toLocaleDateString('he-IL')}`;
      downloadMarkdown(md, `${sectionLabel}-snippet-${videoId}.md`);
      toast.success('💾 קטע הורד ל-Obsidian');
      window.getSelection()?.removeAllRanges();
      setTextSaveMenu(null);
      return;
    }
    const item = {
      id: `sel:${videoId}:${Date.now()}`,
      title: `${sectionLabel} — ${video?.title || 'סרטון'}`,
      content: `${text}\n\n---\nמקור: [${video?.title || ''}](https://youtube.com/watch?v=${videoId})\nקטע נבחר מ: ${sectionLabel}`,
      topicId: video?.topicIds?.[0] || null,
      videoId,
      videoTitle: video?.title || '',
      channelTitle: video?.channelTitle || video?.channelName || '',
      sourceType: 'youtube',
      sectionName: sectionLabel,
      workspacePath: isOpponent
        ? `פוליטיקה/דעת הצד השני/${(video?.title || videoId).slice(0, 40)}/${sectionLabel}-קטע.md`
        : destination === 'workspace'
          ? `Workspace/קטעים/${(video?.title || videoId).slice(0, 40)}/${sectionLabel}.md`
          : `פוליטיקה/סיכום פוליטי/${(video?.title || videoId).slice(0, 40)}/${sectionLabel}-קטע.md`,
      createdAt: now,
      updatedAt: now,
      metadata: {
        perspective: isOpponent ? 'opponent' : 'self',
        contentRole: isOpponent ? 'opponent_view' : 'my_position',
        userPosition: isOpponent ? 'opposed' : 'endorsed',
        selectedText: true,
        sectionName: sectionLabel,
        videoId,
        videoTitle: video?.title || '',
        topic: video?.category || null,
        subTopic: video?.subCategory || null,
        createdAt: now,
      },
    };
    upsertKnowledgeItem(item);
    toast.success(
      isOpponent ? '⚔️ קטע נשמר כדעת האויב' :
      destination === 'workspace' ? '⭐ קטע נשמר ל-Workspace' :
      '✅ קטע נשמר למוח'
    );
    window.getSelection()?.removeAllRanges();
    setTextSaveMenu(null);
  }, [video]);

  const openObsidianSettingsForPath = useCallback((filePath = "", options = {}) => {
    const { autoOpenAfterSave = true, toastMessage = "יש להשלים את הגדרות Obsidian לפני פתיחת הקובץ" } = options || {};
    setObsidianSettingsTargetPath(String(filePath || "").trim());
    setObsidianSettingsAutoOpenTarget(Boolean(autoOpenAfterSave));
    setObsidianSettingsOpen(true);
    if (toastMessage) {
      toast.warning(toastMessage);
    }
  }, []);

  const handleSaveAllToBrain = useCallback(() => {
    setBrainPickerOpen(true);
  }, []);

  const persistVerifiedVaultWriteStatus = useCallback(async (data, { savePath, apiRoute }) => {
    const { vaultName, vaultPath } = getObsidianVaultRequestFields();
    const savedPath = data?.savedPath || savePath;
    const verified = data?.verified === true;
    logObsidianVaultP0Diagnostics({
      apiRoute,
      vaultName,
      vaultPath,
      finalFilePath: savedPath,
      verified,
      obsidianSavedStatusUpdated: false,
    });
    if (!data?.ok || !verified) return false;
    const baseStatus = buildObsidianSavedStatusFromPath(savedPath, vaultName);
    if (!baseStatus) return false;
    const obsidianStatus = {
      ...baseStatus,
      mappingCategory: effectiveCategory || video?.category || null,
      mappingSubCategory: effectiveSubCategory || video?.subCategory || null,
    };
    await saveVideoFields({ obsidianSavedStatus: obsidianStatus });
    logObsidianVaultP0Diagnostics({
      apiRoute,
      vaultName,
      vaultPath,
      finalFilePath: savedPath,
      verified: true,
      obsidianSavedStatusUpdated: true,
    });
    return true;
  }, [effectiveCategory, effectiveSubCategory, saveVideoFields, video?.category, video?.subCategory]);

  const handleSaveAllConfirmed = useCallback(async () => {
    if (!saveAllContent) return;
    const { vaultName, vaultPath } = getObsidianVaultRequestFields();
    const apiRoute = "/api/vault/write";
    try {
      const res = await fetch(apiRoute, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: saveAllContent.path,
          content: saveAllContent.markdown,
          vaultPath,
          vaultName,
          videoTitle: video?.title,
          videoUrl: getWatchUrl(video),
          channelTitle: video?.channelTitle,
          duration: video?.duration,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok && data.verified === true) {
        const statusUpdated = await persistVerifiedVaultWriteStatus(data, {
          savePath: saveAllContent.path,
          apiRoute,
        });
        if (statusUpdated) {
          toast.success(`✅ נשמרו ${saveAllContent.totalItems} פריטים למוח`, {
            description: `נתיב: ${data.savedPath || saveAllContent.path}`,
            duration: 6000,
          });
          setSaveAllConfirmOpen(false);
          setSaveAllContent(null);
        } else {
          toast.error("הקובץ נשמר אך לא עודכן סטטוס השמירה");
        }
      } else if (data.error === "NO_VAULT_PATH") {
        openObsidianSettingsForPath(saveAllContent.path, {
          autoOpenAfterSave: false,
          toastMessage: "יש להגדיר קודם את נתיב ה-vault של Obsidian",
        });
      } else {
        toast.error(`שגיאה בשמירה: ${data.message || data.error || 'לא ידוע'}`);
      }
    } catch (err) {
      toast.error(`שגיאה: ${err.message}`);
    }
  }, [openObsidianSettingsForPath, persistVerifiedVaultWriteStatus, saveAllContent, video]);

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

  const workspaceLibraryItem = useMemo(() => {
    const vid = video?.id || video?.videoId;
    if (!vid) return null;
    try { return getWorkspaceItemByVideoId(vid); } catch { return null; }
  // workspaceSaveOpen: recompute when dialog closes so card updates immediately after save
  }, [video?.id, video?.videoId, workspaceSaveOpen]);

  const isInWorkspaceLib = Boolean(workspaceLibraryItem);
  const isWorkspaceMappingCurrent = useMemo(() => {
    if (!workspaceLibraryItem) return false;
    const savedCategory = normalizeCategoryName(workspaceLibraryItem?.topicName || workspaceLibraryItem?.category || "");
    const savedSubCategory = String(workspaceLibraryItem?.subTopicName || workspaceLibraryItem?.subCategory || "").trim().toLowerCase();
    const currentCategory = normalizeCategoryName(effectiveCategory || resolvedVideoMode.category || "");
    const currentSubCategory = String(effectiveSubCategory || resolvedVideoMode.subCategory || "").trim().toLowerCase();

    return savedCategory === currentCategory && savedSubCategory === currentSubCategory;
  }, [
    effectiveCategory,
    effectiveSubCategory,
    resolvedVideoMode.category,
    resolvedVideoMode.subCategory,
    workspaceLibraryItem,
  ]);

  const expectedObsidianFolder = obsidianRoute.resolvedFolder;

  const currentTopicPathLabel = useMemo(() => {
    const parts = [effectiveCategory, effectiveSubCategory].filter(
      (value) => typeof value === "string" && value.trim().length > 0
    );
    return parts.join(" / ") || effectiveCategory || "ללא מיפוי";
  }, [effectiveCategory, effectiveSubCategory, normalizedSubCategory, selectedTabsConfigKey]);

  const currentObsidianDestinationLabel = useMemo(() => {
    if (currentTopicPathLabel) return currentTopicPathLabel;
    return expectedObsidianFolder ? expectedObsidianFolder.replace(/\//g, " / ") : "ללא יעד";
  }, [currentTopicPathLabel, expectedObsidianFolder, normalizedSubCategory, selectedTabsConfigKey]);

  const currentWorkspaceDestinationLabel = useMemo(
    () => currentTopicPathLabel || "ללא יעד",
    [currentTopicPathLabel, normalizedSubCategory, selectedTabsConfigKey]
  );

  const currentBrainDestinationLabel = useMemo(
    () => currentTopicPathLabel || "ללא יעד",
    [currentTopicPathLabel, normalizedSubCategory, selectedTabsConfigKey]
  );

  const resolvedObsidianSavedPath = useMemo(() => {
    const savedPath = String(video?.obsidianSavedStatus?.savedPath || "").trim().replace(/\\/g, "/");
    if (savedPath) return savedPath;

    const savedFolder = String(video?.obsidianSavedStatus?.folder || "").trim().replace(/\\/g, "/");
    const savedFile = String(video?.obsidianSavedStatus?.fileName || "").trim().replace(/\\/g, "/");
    if (savedFolder && savedFile) return `${savedFolder}/${savedFile}`.replace(/\/+/g, "/");
    return "";
  }, [video?.obsidianSavedStatus?.fileName, video?.obsidianSavedStatus?.folder, video?.obsidianSavedStatus?.savedPath]);

  const resolvedObsidianVaultName = obsidianRoute.vaultName || resolveObsidianVaultName();
  const hasResolvedObsidianVaultName = hasUsableObsidianVaultName(obsidianRoute.vaultName);

  const isObsidianMappingCurrent = useMemo(() => {
    if (!hasObsidianSavedStatus(video)) return false;
    const status = video?.obsidianSavedStatus;
    const savedFolder = String(status?.folder || "").trim().replace(/\\/g, "/");
    const targetFolder = String(expectedObsidianFolder || "").trim().replace(/\\/g, "/");
    const savedVault = String(status?.vaultName || "").trim();
    const currentVault = String(resolvedObsidianVaultName || "").trim();
    const vaultMatches = !savedVault || !currentVault || savedVault === currentVault;
    if (!vaultMatches) return false;
    if (savedFolder && targetFolder && savedFolder === targetFolder) return true;
    const savedCat = String(status?.mappingCategory || "").trim();
    const savedSub = String(status?.mappingSubCategory || "").trim();
    if (savedCat || savedSub) {
      const curCat = String(effectiveCategory || "").trim();
      const curSub = String(effectiveSubCategory || "").trim();
      return savedCat === curCat && savedSub === curSub;
    }
    return Boolean(savedFolder) && savedFolder === targetFolder;
  }, [
    effectiveCategory,
    effectiveSubCategory,
    expectedObsidianFolder,
    resolvedObsidianVaultName,
    video?.obsidianSavedStatus,
    video?.obsidianSavedStatus?.folder,
    video?.obsidianSavedStatus?.mappingCategory,
    video?.obsidianSavedStatus?.mappingSubCategory,
    video?.obsidianSavedStatus?.vaultName,
  ]);

  const isCurrentBrainSave = useMemo(
    () => hasObsidianSavedStatus(video) && isObsidianMappingCurrent,
    [isObsidianMappingCurrent, video]
  );

  const recommendedGemCardLabel = useMemo(() => {
    if (effectiveGemInfo?.gemLabel) return effectiveGemInfo.gemLabel;
    const fallbackGemKey = resolveGemKeyFromSubCategory(effectiveSubCategory);
    const fallbackGem = fallbackGemKey ? GEM_ALT_OPTIONS.find((gem) => gem.key === fallbackGemKey) : null;
    return fallbackGem?.label || "לא זוהה";
  }, [effectiveGemInfo?.gemLabel, effectiveSubCategory, normalizedSubCategory, selectedTabsConfigKey]);

  const openResolvedObsidianPath = useCallback((filePath) => {
    const normalizedPath = String(filePath || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
    console.debug("[ObsidianOpen][VideoDetail]", {
      category: effectiveCategory,
      subCategory: effectiveSubCategory,
      targetPath: normalizedPath,
      resolvedVaultName: resolvedObsidianVaultName,
      hasResolvedObsidianVaultName,
    });

    if (!normalizedPath) {
      toast.error("לא נמצא נתיב קובץ לפתיחה ב-Obsidian");
      return false;
    }

    if (!hasResolvedObsidianVaultName) {
      openObsidianSettingsForPath(normalizedPath);
      return false;
    }

    const url = buildObsidianOpenUrl(normalizedPath, resolvedObsidianVaultName);
    if (!url) {
      openObsidianSettingsForPath(normalizedPath);
      return false;
    }

    try {
      openObsidianUrl(url, { bypassDedupe: true });
      return true;
    } catch {
      toast.error("שגיאה בפתיחת Obsidian");
      return false;
    }
  }, [
    effectiveCategory,
    effectiveSubCategory,
    hasResolvedObsidianVaultName,
    openObsidianSettingsForPath,
    resolvedObsidianVaultName,
  ]);

  const buildObsidianMergeFooter = useCallback(() => {
    const watchUrl = getWatchUrl(video);
    if (!watchUrl) return [];
    return [`מקור: [${video?.title || ''}](${watchUrl})`];
  }, [video]);

  const toObsidianMergeItem = useCallback((item) => ({
    text: item.text,
    sectionLabel: item.sectionLabel || 'כללי',
    identityKey: buildObsidianItemIdentityKey({
      videoId: video?.youtubeId || video?.id,
      tabKey: item.type || item.tabScope || 'multi',
      sectionKey: item.sectionLabel || '',
      text: item.text,
    }),
    timestamp: item.timestamp || '',
  }), [video?.id, video?.youtubeId]);

  const bumpObsidianItemSaveUi = useCallback(() => {
    setObsidianItemSaveRevision((n) => n + 1);
  }, []);

  const markObsidianRowSaved = useCallback((params) => {
    const entry = recordObsidianItemSave(params);
    if (entry) bumpObsidianItemSaveUi();
    return entry;
  }, [bumpObsidianItemSaveUi]);

  const executeObsidianVaultWrite = useCallback(async ({
    savePath,
    content,
    mode = 'overwrite',
    mergeItems,
    footerLines,
    subtitle = '',
    successMessage,
    allowDownloadFallback = true,
  }) => {
    const { vaultPath: _vaultPath, vaultName: _vaultName } = getObsidianVaultRequestFields();
    const _hasUsableVaultName = hasUsableObsidianVaultName(_vaultName);
    const apiRoute = "/api/vault/write";
    const safeFilename = String(savePath || '').split('/').pop() || 'note.md';
    const videoMeta = {
      videoTitle: video?.title,
      videoUrl: getWatchUrl(video),
      channelTitle: video?.channelTitle,
      duration: video?.duration,
      subtitle,
    };

    try {
      let data = null;
      let savedPath = savePath;

      if (mode === 'merge' && Array.isArray(mergeItems) && mergeItems.length > 0) {
        const mergeResult = await writeObsidianWithItemMerge({
          savePath,
          mergeItems,
          footerLines: footerLines || [],
          videoTitle: video?.title || '',
          vaultPath: _vaultPath,
          vaultName: _vaultName,
          videoMeta,
        });
        data = mergeResult.data || {};
        savedPath = data.savedPath || savePath;
        if (!mergeResult.ok) {
          if (mergeResult.error === 'NO_VAULT_PATH') {
            openObsidianSettingsForPath(savePath, {
              autoOpenAfterSave: false,
              toastMessage: 'יש להגדיר קודם את נתיב ה-vault של Obsidian',
            });
            return { ok: false, error: 'NO_VAULT_PATH' };
          }
          if (allowDownloadFallback) {
            const read = await readObsidianVaultMarkdown({ path: savePath, vaultPath: _vaultPath, vaultName: _vaultName });
            const fallbackContent = mergeItemsIntoObsidianNote({
              existingContent: read.content || '',
              videoTitle: video?.title || '',
              items: mergeItems,
              footerLines: footerLines || [],
            }).content;
            downloadMarkdown(fallbackContent, safeFilename);
            toast.info(`הורדה מקומית — ${successMessage} (${safeFilename})`);
            return { ok: false, fallback: 'download' };
          }
          toast.error(`שגיאה בשמירה: ${data.message || mergeResult.error || 'לא ידוע'}`);
          return { ok: false, error: mergeResult.error || data.error };
        }
      } else {
        const res = await fetch(apiRoute, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: savePath,
            mode,
            content,
            vaultPath: _vaultPath,
            vaultName: _vaultName,
            ...videoMeta,
          }),
        });
        data = await res.json().catch(() => ({}));
        savedPath = data.savedPath || savePath;
      }

      if (data.ok && data.verified === true) {
        const statusUpdated = await persistVerifiedVaultWriteStatus(data, { savePath, apiRoute });
        const savedPath = data.savedPath || savePath;
        const folderPath = savedPath.includes('/')
          ? savedPath.substring(0, savedPath.lastIndexOf('/'))
          : '';

        if (!statusUpdated) {
          toast.error("הקובץ נשמר אך לא עודכן סטטוס השמירה");
          return { ok: false };
        }

        if (_hasUsableVaultName) {
          openResolvedObsidianPath(savedPath);
        } else {
          openObsidianSettingsForPath(savedPath);
        }

        toast.success(successMessage, {
          description: savedPath,
          duration: 10000,
          action: savedPath ? {
            label: '📂 פתח ב-Obsidian',
            onClick: () => { openResolvedObsidianPath(savedPath); },
          } : undefined,
          cancel: folderPath ? {
            label: '📁 פתח תיקייה',
            onClick: () => { openResolvedObsidianPath(folderPath); },
          } : undefined,
        });
        return { ok: true, savedPath, data };
      }

      if (data.error === 'NO_VAULT_PATH') {
        openObsidianSettingsForPath(savePath, {
          autoOpenAfterSave: false,
          toastMessage: 'יש להגדיר קודם את נתיב ה-vault של Obsidian',
        });
        return { ok: false, error: 'NO_VAULT_PATH' };
      }

      if (data.error) {
        toast.error(`שגיאה בשמירה: ${data.message || data.error}`);
        return { ok: false, error: data.error };
      }

      if (allowDownloadFallback) {
        const read = await readObsidianVaultMarkdown({ path: savePath, vaultPath: _vaultPath, vaultName: _vaultName });
        const fallbackContent = mode === 'merge'
          ? mergeItemsIntoObsidianNote({
            existingContent: read.content || '',
            videoTitle: video?.title || '',
            items: mergeItems || [],
            footerLines: footerLines || [],
          }).content
          : content;
        downloadMarkdown(fallbackContent, safeFilename);
        toast.info(`הורדה מקומית — ${successMessage} (${safeFilename})`);
        return { ok: false, fallback: 'download' };
      }

      toast.error('שגיאה בשמירה ל-Obsidian');
      return { ok: false, error: 'WRITE_FAILED' };
    } catch (err) {
      console.error("OBSIDIAN SAVE ERROR", err);
      toast.error(`שגיאה בשמירה: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }, [
    openObsidianSettingsForPath,
    openResolvedObsidianPath,
    persistVerifiedVaultWriteStatus,
    video,
  ]);

  const handleObsidianSettingsSaved = useCallback((savedSettings) => {
    const pendingPath = String(obsidianSettingsTargetPath || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
    const nextVaultName = resolveObsidianVaultName(savedSettings?.vaultName);
    const hasNextVaultName = hasUsableObsidianVaultName(savedSettings?.vaultName);
    const shouldAutoOpen = obsidianSettingsAutoOpenTarget;

    setObsidianSettingsOpen(false);
    setObsidianSettingsTargetPath("");
    setObsidianSettingsAutoOpenTarget(false);

    if (!pendingPath || !shouldAutoOpen) return;
    if (!hasNextVaultName) {
      toast.warning("יש להגדיר שם vault תקין לפני פתיחת Obsidian");
      return;
    }

    const url = buildObsidianOpenUrl(pendingPath, nextVaultName);
    if (!url) {
      toast.error("לא הצלחתי לבנות קישור לפתיחת הקובץ ב-Obsidian");
      return;
    }

    openObsidianUrl(url, { bypassDedupe: true });
  }, [obsidianSettingsAutoOpenTarget, obsidianSettingsTargetPath]);

  const isOpponentView = video?.opponentView === true;

  // Must be before 'if (!video) return null' — hooks cannot be called after a conditional return
  const handleSubtitleSave = useCallback(async () => {
    if (!video?.id || isSubtitleSaving) return;
    const normalizedSubtitle = subtitleDraft.trim();
    const nextSubtitle = normalizedSubtitle || null;
    const currentSubtitle = typeof video?.customSubtitle === "string" ? video.customSubtitle.trim() : "";
    if ((currentSubtitle || null) === nextSubtitle) { setIsSubtitleEditing(false); return; }
    setIsSubtitleSaving(true);
    try {
      const updates = { customSubtitle: nextSubtitle };
      await saveVideoFields(updates);
      const nextVideo = { ...video, ...updates };
      saveSavedAnalysis(video.id, { ...buildAnalysisSnapshot(nextVideo), savedAt: new Date().toISOString() });
      console.log("[VideoHeader] Subtitle saved:", nextSubtitle);
      setIsSubtitleEditing(false);
    } catch (error) {
      console.warn("[VideoHeader] Subtitle save failed:", error?.message || error);
      toast.error("שמירת תת-הכותרת נכשלה");
    } finally {
      setIsSubtitleSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubtitleSaving, saveVideoFields, subtitleDraft, video]);

  const handleToggleSentenceOpponent = useCallback((sentenceData) => {
    const videoId = video?.id || video?.videoId;
    if (!videoId) return;
    const next = toggleOpponentSentence(videoId, sentenceData);
    setOpponentSentences(next);
    const isNowOpponent = next.some(s => s.id === sentenceData.id);
    if (isNowOpponent) {
      const item = {
        id: `opponent:${videoId}:${sentenceData.id}`,
        sourceType: 'youtube',
        sourceId: String(videoId),
        title: sentenceData.text.slice(0, 60) + (sentenceData.text.length > 60 ? '...' : ''),
        kind: 'learning',
        markdown: `# ⚔️ דעת האויב\n\n${sentenceData.text}`,
        workspacePath: `פוליטיקה/דעת הצד השני/${(video?.title || videoId).slice(0, 40)}.md`,
        topicId: video?.topicIds?.[0] || null,
        subBrainId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          videoId: String(videoId),
          title: video?.title || null,
          channel: video?.channelTitle || video?.channelName || null,
          contentRole: 'opponent_view',
          perspective: 'external',
          userPosition: 'not_endorsed',
          sourceTab: sentenceData.sourceTab,
          sentenceId: sentenceData.id,
        },
      };
      upsertKnowledgeItem(item);
      toast('⚔️ המשפט נשמר כדעת האויב');
    } else {
      toast('✅ הסימון הוסר');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video]);

  const handleSaveOpponentResponse = useCallback((sentenceId, responseText) => {
    const videoId = video?.id || video?.videoId;
    if (!videoId) return;
    setOpponentSentenceResponse(videoId, sentenceId, responseText);
    setOpponentSentences(getOpponentSentences(videoId));
    toast.success('התשובה נשמרה');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video]);

  const handleToggleOpponentView = useCallback(async () => {
    const videoId = video?.id || video?.videoId;
    if (!videoId) return;
    const next = !isOpponentView;
    const positionMeta = next
      ? { contentRole: 'opponent_view', perspective: 'external', userPosition: 'not_endorsed' }
      : { contentRole: 'my_position', perspective: 'self', userPosition: 'endorsed' };
    try { updateLocalVideo(videoId, { opponentView: next }); } catch {}
    try { updateKnowledgeItemsForVideo(videoId, positionMeta); } catch {}
    try { updateWorkspaceItemByVideoId(videoId, { opponentView: next }); } catch {}
    await saveVideoFields({ opponentView: next });
    toast(next ? '⚔️ הסרטון סומן כדעת האויב' : '✅ הסימון הוסר');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpponentView, video, saveVideoFields]);

  const handleApproveSubTopicRec = useCallback(async () => {
    if (!subTopicRec?.recommended || !video?.id) return;
    const newSubCat = subTopicRec.recommended;
    setSubCategoryOverride(newSubCat);
    setSubTopicDraft(newSubCat);
    setSubTopicRecDismissed(true);
    setIsSubTopicEditing(false);
    console.log('[SubTopicRecommendation] accepted:', newSubCat);
    try {
      await saveVideoFields({
        subCategory: newSubCat,
        dismissedSubTopicRec: null,
        userConfirmedSubCategory: true,
        confirmedSubCategory: newSubCat,
        confirmedAt: new Date().toISOString(),
      });
      toast.success(`תת-נושא נשמר: ${newSubCat}`);
    } catch (err) {
      console.warn("[SubTopicRec] save failed:", err?.message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTopicRec, video?.id, saveVideoFields]);

  const handleDismissSubTopicRec = useCallback(async () => {
    if (!subTopicRec?.recommended || !video?.id) return;
    const dismissed = subTopicRec.recommended;
    setSubTopicRecDismissed(true);
    console.log('[SubTopicRecommendation] dismissed:', dismissed);
    try {
      await saveVideoFields({ dismissedSubTopicRec: dismissed });
    } catch (err) {
      console.warn("[SubTopicRec] dismiss save failed:", err?.message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTopicRec, video?.id, saveVideoFields]);

  const summaryShortForPackage = useMemo(
    () => (video?.shortSummary || enrichedVideo?.aiSummaryShort || '').replace(/\[MOCK\]\s*/g, '').trim(),
    [video?.shortSummary, enrichedVideo?.aiSummaryShort],
  );

  const videoKnowledgePackage = useMemo(() => {
    const topicsShaped = extractUniversalTabContent(effectiveVideo, 'topics-subtopics', marketBriefData);
    const gemTopicsSections = topicsShaped?.mode === 'sections' ? topicsShaped.sections : [];
    const gemTopicsFlat = topicsShaped?.mode === 'flat' && topicsShaped.items.length > 0
      ? topicsShaped.items
      : (gemTopicsSections.length === 0
        ? extractUniversalTabFlatItems(effectiveVideo, 'topics-subtopics', marketBriefData)
        : []);
    return collectVideoKnowledgePackage({
      effectiveVideo,
      marketBriefData,
      summaryShort: summaryShortForPackage,
      fullSummary: video?.fullSummary || enrichedVideo?.aiSummaryLong || '',
      displayChapters,
      gemTopicsSections,
      gemTopicsFlat,
    });
  }, [
    effectiveVideo,
    marketBriefData,
    summaryShortForPackage,
    video?.fullSummary,
    enrichedVideo?.aiSummaryLong,
    displayChapters,
  ]);

  const handleRequestObsidianMappingSave = useCallback((recommendedSubCategory) => {
    const sub = String(recommendedSubCategory || '').trim();
    if (!sub) return;

    if (hasObsidianSavedStatus(video) && isObsidianMappingCurrent && resolvedObsidianSavedPath) {
      openResolvedObsidianPath(resolvedObsidianSavedPath);
      return;
    }

    setSubCategoryOverride(sub);
    setObsidianSaveIntent({ mode: 'mapping', pendingSubCategory: sub });
    setSaveEntireVideoPackage(true);
    setPendingObsidianRowSave(null);
    setMultiObsidianPickerMode(true);
    setBrainPickerOpen(true);
  }, [
    isObsidianMappingCurrent,
    openResolvedObsidianPath,
    resolvedObsidianSavedPath,
    video,
  ]);

  const obsidianPackagePreview = useMemo(() => {
    if (!multiObsidianPickerMode || obsidianSaveIntent?.mode !== 'mapping') return null;
    return {
      sections: videoKnowledgePackage.sections,
      totalItems: videoKnowledgePackage.totalItems,
      saveEntireVideo: saveEntireVideoPackage,
      onToggleSaveEntireVideo: setSaveEntireVideoPackage,
      selectedCount: multiSelected.size,
    };
  }, [
    multiObsidianPickerMode,
    obsidianSaveIntent,
    videoKnowledgePackage,
    saveEntireVideoPackage,
    multiSelected.size,
  ]);

  const handleSaveSubTopicSelection = useCallback(async () => {
    if (!video?.id) return;
    const normalizedSubTopic = subTopicDraft === NEW_SUBTOPIC_SENTINEL ? "" : subTopicDraft.trim();
    if (!normalizedSubTopic) {
      toast.error("בחר תת-נושא מהרשימה או צור חדש");
      return;
    }

    setSubCategoryOverride(normalizedSubTopic);
    setSubTopicRecDismissed(false);
    setIsSubTopicEditing(false);
    setIsCreatingSubTopic(false);
    setNewSubTopicDraft("");
    console.log("[SubTopicRecommendation] manual selection:", normalizedSubTopic);
    try {
      await saveVideoFields({
        subCategory: normalizedSubTopic,
        dismissedSubTopicRec: null,
        userConfirmedSubCategory: true,
        confirmedSubCategory: normalizedSubTopic,
        confirmedAt: new Date().toISOString(),
      });
      toast.success(`תת-נושא עודכן: ${normalizedSubTopic}`);
    } catch (err) {
      console.warn("[SubTopicManual] save failed:", err?.message);
      toast.error("לא ניתן היה לעדכן תת-נושא");
    }
  }, [saveVideoFields, subTopicDraft, video?.id]);

  const handleCreateCustomSubTopic = useCallback(async () => {
    if (!video?.id || !marketRootTopic?.id) return;
    const trimmedName = newSubTopicDraft.trim();
    if (!trimmedName) {
      toast.error("יש להזין שם לתת-נושא חדש");
      return;
    }
    if (FORBIDDEN_MARKET_SUBTOPICS.has(trimmedName)) {
      toast.error("תת-הנושא הזה לא תקין עבור שוק ההון");
      return;
    }

    persistCustomBrainSub(marketRootTopic.id, trimmedName);
    setVaultSubtopics((prev) => {
      const exists = prev.some((topic) => normalizeLooseName(topic?.name) === normalizeLooseName(trimmedName));
      if (exists) return prev;
      return [...prev, { id: `custom_sub_runtime_${Date.now()}`, name: trimmedName, isCustom: true }];
    });
    setSubTopicDraft(trimmedName);
    setSubCategoryOverride(trimmedName);
    setIsCreatingSubTopic(false);
    setNewSubTopicDraft("");
    setIsSubTopicEditing(false);
    setSubTopicRecDismissed(false);

    try {
      await saveVideoFields({ subCategory: trimmedName, dismissedSubTopicRec: null });
      toast.success(`תת-נושא חדש נשמר: ${trimmedName}`);
    } catch (err) {
      console.warn("[SubTopicManual] custom create save failed:", err?.message);
      toast.error("לא ניתן היה לשמור תת-נושא חדש");
    }
  }, [marketRootTopic?.id, newSubTopicDraft, saveVideoFields, video?.id]);

  // Debug log for PDF items (helps verify contentType is propagated correctly)
  if (video?.contentType === "pdf") {
    console.log("[VideoDetailPanel] Rendering PDF content item:", {
      id: video.id,
      title: video.title,
      pages: video.pdfPages,
      originalFileName: video.originalFileName,
      transcriptLength: (video.transcript || video.manualTranscript || "").length,
    });
  }

  const toggleBrainItem = (id, text, sourceTab, tabLabel) => {
    setBrainSelections(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = { text, sourceTab, tabLabel };
      return next;
    });
  };
  const clearBrainSelections = () => setBrainSelections({});
  const brainSelectionCount = Object.keys(brainSelections).length;

  const multiSelectClearWithBrain = () => {
    multiSelectClear();
    clearBrainSelections();
  };
  const handleSaveSelectedToObsidian = () => {
    if (multiSelected.size === 0) return;
    setPendingObsidianRowSave(null);
    setMultiObsidianPickerMode(true);
    setBrainPickerOpen(true);
  };

  const buildMultiSelectMarkdown = ({ folder, subFolder, items } = {}) => {
    const selectedItems = items || [...multiSelected.values()];
    const lines = [`# פריטים נבחרים — ${video?.title || ''}`, ''];
    const bySection = new Map();
    selectedItems.forEach((item) => {
      const sec = item.sectionLabel || 'כללי';
      if (!bySection.has(sec)) bySection.set(sec, []);
      bySection.get(sec).push(item);
    });
    bySection.forEach((items, section) => {
      lines.push(`## ${section}`);
      items.forEach(item => {
        const ts = item.timestamp ? ` (${item.timestamp})` : '';
        lines.push(`- ${item.text}${ts}`);
      });
      lines.push('');
    });
    lines.push('---');
    const watchUrl = getWatchUrl(video);
    if (watchUrl) lines.push(`מקור: [${video?.title || ''}](${watchUrl})`);
    if (folder) lines.push(`נתיב: ${subFolder ? `${folder}/${subFolder}/` : `${folder}/`}`);
    return lines.join('\n');
  };

  const buildVideoObsidianMergeItems = useCallback(() => {
    const videoId = video?.youtubeId || video?.id;
    const topicsShaped = extractUniversalTabContent(effectiveVideo, 'topics-subtopics', marketBriefData);
    const gemTopicsSections = topicsShaped?.mode === 'sections' ? topicsShaped.sections : [];
    const gemTopicsFlat = topicsShaped?.mode === 'flat' && topicsShaped.items?.length
      ? topicsShaped.items
      : (gemTopicsSections.length === 0
        ? extractUniversalTabFlatItems(effectiveVideo, 'topics-subtopics', marketBriefData)
        : []);
    return collectVideoObsidianMergeItems({
      effectiveVideo,
      marketBriefData,
      summaryShort: summaryShortForPackage,
      fullSummary: video?.fullSummary || enrichedVideo?.aiSummaryLong || '',
      displayChapters,
      gemTopicsSections,
      gemTopicsFlat,
      videoNotes,
      appBuilderSections: videoId ? getAppBuilderDraft(videoId) : null,
    });
  }, [
    displayChapters,
    effectiveVideo,
    enrichedVideo?.aiSummaryLong,
    marketBriefData,
    summaryShortForPackage,
    video?.fullSummary,
    video?.id,
    video?.youtubeId,
    videoNotes,
  ]);

  const executeMappingObsidianSave = useCallback(async ({
    sub,
    savePath,
    subtitle = '',
    saveEntireVideo = true,
    replaceExisting = false,
  }) => {
    const normalizedSub = String(sub || '').trim();
    if (!normalizedSub || !video?.id) throw new Error('אין המלצה לשמירה');

    setSubCategoryOverride(normalizedSub);
    setSubTopicDraft(normalizedSub);
    setSubTopicRecDismissed(true);
    await saveVideoFields({
      subCategory: normalizedSub,
      dismissedSubTopicRec: null,
      userConfirmedSubCategory: true,
      confirmedSubCategory: normalizedSub,
      confirmedAt: new Date().toISOString(),
    });

    const videoForNote = { ...(effectiveVideo || video), subCategory: normalizedSub };
    const note = buildVideoFullNote(videoForNote, mentorName, null, videoNotes, [], {});
    const finalPath = savePath || note.path;

    if (replaceExisting) {
      const result = await executeObsidianVaultWrite({
        savePath: finalPath,
        content: note.content,
        mode: 'overwrite',
        subtitle,
        successMessage: `✅ נשמר ל-Obsidian${videoKnowledgePackage.totalItems ? ` — ${videoKnowledgePackage.totalItems} פריטים` : ''}`,
        allowDownloadFallback: false,
      });
      if (!result.ok) throw new Error(result.error || 'הכתיבה ל-vault נכשלה');
      return { savedPath: result.savedPath || finalPath };
    }

    if (!saveEntireVideo && multiSelected.size > 0) {
      const mergeItems = [...multiSelected.values()].map(toObsidianMergeItem);
      const result = await executeObsidianVaultWrite({
        savePath: finalPath,
        mode: 'merge',
        mergeItems,
        footerLines: buildObsidianMergeFooter(),
        subtitle,
        successMessage: `✅ נשמר ל-Obsidian — ${mergeItems.length} פריטים`,
        allowDownloadFallback: false,
      });
      if (!result.ok) throw new Error(result.error || 'הכתיבה ל-vault נכשלה');
      mergeItems.forEach((item) => {
        const source = [...multiSelected.values()].find((row) => row.text === item.text) || item;
        markObsidianRowSaved({
          videoId: video?.youtubeId || video?.id,
          tabKey: source.type || source.tabScope || 'multi',
          sectionKey: source.sectionLabel || item.sectionLabel || '',
          text: item.text,
          destinationPath: result.savedPath || finalPath,
        });
      });
      return { savedPath: result.savedPath || finalPath };
    }

    const mergeItems = buildVideoObsidianMergeItems();
    const result = await executeObsidianVaultWrite({
      savePath: finalPath,
      mode: 'merge',
      mergeItems,
      footerLines: buildObsidianMergeFooter(),
      subtitle,
      successMessage: `✅ נשמר ל-Obsidian${mergeItems.length ? ` — ${mergeItems.length} פריטים` : ''}`,
      allowDownloadFallback: false,
    });
    if (!result.ok) throw new Error(result.error || 'הכתיבה ל-vault נכשלה');
    mergeItems.forEach((item) => {
      markObsidianRowSaved({
        videoId: video?.youtubeId || video?.id,
        tabKey: 'package',
        sectionKey: item.sectionLabel || '',
        text: item.text,
        destinationPath: result.savedPath || finalPath,
      });
    });
    return { savedPath: result.savedPath || finalPath };
  }, [
    buildObsidianMergeFooter,
    buildVideoObsidianMergeItems,
    effectiveVideo,
    executeObsidianVaultWrite,
    markObsidianRowSaved,
    mentorName,
    multiSelected,
    saveVideoFields,
    toObsidianMergeItem,
    video,
    videoKnowledgePackage.totalItems,
    videoNotes,
  ]);

  const buildSingleObsidianItemMarkdown = ({ text, sectionLabel, timestamp } = {}) => {
    const body = String(text || '').trim();
    const watchUrl = getWatchUrl(video) || '';
    const tsLine = timestamp ? `\nזמן: ${timestamp}` : '';
    return [
      `# ${body.slice(0, 80)}`,
      '',
      body,
      '',
      '---',
      watchUrl ? `מקור: [${video?.title || ''}](${watchUrl})` : null,
      sectionLabel ? `קטע: ${sectionLabel}` : null,
      `תאריך: ${new Date().toLocaleDateString('he-IL')}${tsLine}`,
    ].filter(Boolean).join('\n');
  };

  const TAB_LABEL_MAP = {
    insights: 'תובנות', chapters: 'פרקים', notes: 'הערות', summary: 'סיכום',
    'useful-knowledge': 'ידע שימושי', topics: 'נושאים', political: 'פוליטי',
    'app-builder': 'בונה אפליקציות', 'morning-brief': 'מבזק בוקר',
    'market-brief': 'מבזק שוק', 'tech-brief': 'ניתוח טכני', 'brain-select': 'מוח',
  };

  const formatSelectedItemsForClipboard = (entries, context = {}) => {
    const { videoTitle = '', tabKey = '' } = context;
    const tabLabel = TAB_LABEL_MAP[tabKey] || tabKey || '';
    const lines = ['# פריטים נבחרים', ''];
    if (videoTitle) lines.push(`מקור: ${videoTitle}`);
    if (tabLabel) lines.push(`לשונית: ${tabLabel}`);
    lines.push(`כמות: ${entries.length}`, '');
    entries.forEach((entry, idx) => {
      const text = typeof entry.text === 'string' ? entry.text : (entry.rawItem?.text || entry.rawItem?.content || '');
      if (!text) return;
      lines.push(`## ${idx + 1}. ${entry.sectionLabel || tabLabel || 'פריט'}`);
      lines.push('', text, '', '---', '');
    });
    return lines.join('\n');
  };

  const handleCopySelectedItems = async () => {
    if (entriesForActiveTab.length === 0) return;
    const text = formatSelectedItemsForClipboard(entriesForActiveTab, {
      videoTitle: video?.title || '',
      tabKey: activeTab,
    });
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      toast.success(`📋 הועתקו ${entriesForActiveTab.length} פריטים`);
    } catch {
      toast.error('לא הצלחתי להעתיק את הפריטים');
    }
  };

  const handleSaveSelectedToBrain = () => {
    if (multiSelected.size === 0) return;
    const hasAppBuilderSections = entriesForActiveTab.some((e) => e.sectionKey);
    if (activeTab === 'app-builder' && hasAppBuilderSections && appBuilderBulkRef.current?.saveBrain) {
      appBuilderBulkRef.current.saveBrain();
      multiSelectClearWithBrain();
      return;
    }
    let count = 0;
    multiSelected.forEach((item) => {
      if (item.sectionKey) return;
      saveSingleItemToBrain(item.text, item.type || 'multi', item.sectionLabel || 'נבחרים', '');
      count++;
    });
    if (count > 0) toast.success(`🧠 ${count} פריטים נשמרו למוח`);
    multiSelectClearWithBrain();
  };

  const handleSaveSelectedToWorkspace = () => {
    if (multiSelected.size === 0) return;
    const videoId = video?.youtubeId || video?.id || 'unknown';
    const now = new Date().toISOString();
    let count = 0;
    multiSelected.forEach((item, id) => {
      const title = (video?.title || '').slice(0, 40);
      upsertKnowledgeItem({
        id: `ws-sel:${videoId}:${id.replace(/[^a-z0-9]/gi, '_')}:${Date.now() + count}`,
        title: `${item.sectionLabel || 'נבחר'} — ${title || videoId}`.slice(0, 80),
        content: `${item.text}\n\n---\nמקור: ${video?.title || ''}\nקטע: ${item.sectionLabel || ''}`,
        topicId: video?.topicIds?.[0] || null,
        videoId,
        videoTitle: video?.title || '',
        sourceType: 'youtube',
        sectionName: item.sectionLabel || 'נבחרים',
        workspacePath: `Workspace/קטעים/${title || videoId}/${item.sectionLabel || 'נבחרים'}.md`,
        createdAt: now,
        updatedAt: now,
        metadata: { perspective: 'self', contentRole: 'saved_item', selectedText: true, videoId, videoTitle: video?.title || '' },
      });
      count++;
    });
    if (count > 0) toast.success(`⭐ ${count} פריטים נשמרו ל-Workspace`);
    multiSelectClearWithBrain();
  };

  const handleBulkObsidianForTab = async () => {
    if (multiSelected.size === 0) return;
    const hasAppBuilderSections = entriesForActiveTab.some((e) => e.sectionKey);
    if (activeTab === 'app-builder' && hasAppBuilderSections && appBuilderBulkRef.current?.saveObsidian) {
      await appBuilderBulkRef.current.saveObsidian();
      multiSelectClearWithBrain();
      return;
    }
    const appIdeasRaw = entriesForActiveTab.filter((e) => e.type === 'app-ideas-brain' && e.rawItem);
    if (activeTab === 'app-builder' && appIdeasRaw.length > 0) {
      try {
        const result = await appendMarketAppBrainItems(
          appIdeasRaw.map((e) => e.rawItem),
          video,
          resolvedVideoMode.category || '',
        );
        if (result.ok) {
          toast.success('נשמר למוח רעיונות השוק', {
            description: `${result.saved} פריטים → ${result.paths.join(', ')}`,
            duration: 6000,
          });
          multiSelectClearWithBrain();
        } else {
          toast.error('שגיאה בשמירה ל-Obsidian', { description: result.errors?.[0] || 'בדוק חיבור Vault' });
        }
      } catch (err) {
        toast.error('שגיאה בשמירה', { description: err?.message });
      }
      return;
    }
    handleSaveSelectedToObsidian();
  };

  // Deterministic dedup key — same text+tab always produces the same ID
  const itemDedupeKey = (vid, tab, text) => {
    const textKey = String(text || '').slice(0, 60).toLowerCase()
      .replace(/\s+/g, '-').replace(/[^a-z0-9א-ת-]/g, '') || 'item';
    return `brain-item:${vid}:${tab}:${textKey}`;
  };

  const isBrainItemSaved = useCallback((text, tabKey) => {
    const videoId = video?.youtubeId || video?.id;
    const itemId = itemDedupeKey(videoId, tabKey, text);
    return savedItemKeys.has(itemId) || hasKnowledgeItem(itemId);
  }, [video?.youtubeId, video?.id, savedItemKeys]);

  const saveSingleItemToBrain = (text, sourceTab, tabLabel, note = '') => {
    const videoId = video?.youtubeId || video?.id;
    const videoUrl = getWatchUrl(video) || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);
    const now = new Date().toISOString();
    const slug = String(text || '').slice(0, 60).replace(/[^a-zA-Zא-ת\d\s]/g, '').trim().replace(/\s+/g, '-') || 'item';
    const itemId = itemDedupeKey(videoId, sourceTab, text);
    const topicName = activeBrainTopicName;
    const videoSlug = String(video?.title || videoId || 'פריט').slice(0, 40);
    upsertKnowledgeItem({
      id: itemId,
      title: String(text || '').slice(0, 80),
      topicId: activeBrainTopicId,
      videoId,
      videoTitle: video?.title || '',
      sourceType: 'youtube',
      sourceId: videoId,
      kind: 'learning',
      markdown: [
        `# ${String(text || '').slice(0, 80)}`,
        '',
        String(text || ''),
        note ? `\n---\nהערה: ${note}` : null,
        videoUrl ? `\n---\nמקור: [${video?.title || ''}](${videoUrl})` : null,
      ].filter(v => v !== null).join('\n'),
      workspacePath: `${topicName}/${sourceTab}/${videoSlug}/${slug}.md`,
      createdAt: now,
      updatedAt: now,
      metadata: {
        videoId: videoId || null,
        videoTitle: video?.title || null,
        videoUrl: videoUrl || null,
        sourceTab,
        tabLabel,
        category: video?.category || null,
        subCategory: video?.subCategory || null,
        note: note || null,
        savedAt: now,
        contentRole: 'my_position',
        perspective: 'self',
        userPosition: 'endorsed',
      },
    });
    setSavedItemKeys(prev => { const next = new Set(prev); next.add(itemId); return next; });
    toast.success(`✅ נשמר למוח`);
  };

  const saveSingleItemToObsidian = useCallback((meta) => {
    const body = String(meta?.text || '').trim();
    if (!body) return;
    setPendingObsidianRowSave(meta);
    setMultiObsidianPickerMode(true);
    setBrainPickerOpen(true);
  }, []);

  const saveSingleItemToWorkspace = useCallback(({ text, sectionLabel, type, tabScope, timestamp }) => {
    const videoId = video?.youtubeId || video?.id || 'unknown';
    const body = String(text || '').trim();
    if (!body) return;
    const sourceTab = type || tabScope || 'multi';
    const wsId = itemDedupeKey(videoId, sourceTab, body).replace(/^brain-item:/, 'ws-item:');
    if (hasKnowledgeItem(wsId)) {
      toast.info('כבר נשמר ל-Workspace');
      return;
    }
    const now = new Date().toISOString();
    const title = (video?.title || '').slice(0, 40);
    const tsLine = timestamp ? `\nזמן: ${timestamp}` : '';
    upsertKnowledgeItem({
      id: wsId,
      title: `${sectionLabel || 'פריט'} — ${title || videoId}`.slice(0, 80),
      content: `${body}${tsLine}\n\n---\nמקור: ${video?.title || ''}\nקטע: ${sectionLabel || ''}`,
      topicId: video?.topicIds?.[0] || null,
      videoId,
      videoTitle: video?.title || '',
      sourceType: 'youtube',
      sectionName: sectionLabel || '',
      workspacePath: `Workspace/קטעים/${title || videoId}/${sectionLabel || 'פריט'}.md`,
      createdAt: now,
      updatedAt: now,
      metadata: {
        perspective: 'self',
        contentRole: 'saved_item',
        selectedText: true,
        videoId,
        videoTitle: video?.title || '',
        sourceTab,
      },
    });
    toast.success('⭐ נשמר ל-Workspace');
  }, [video]);

  const navigateFromPanel = useCallback((page, params = {}) => {
    if (!navigateTo) {
      toast.error('לא ניתן לפתוח את הפריט השמור');
      return false;
    }
    onOpenChange(false);
    setTimeout(() => navigateTo(page, params), 80);
    return true;
  }, [navigateTo, onOpenChange]);

  const openSavedBrainItem = useCallback((text, tabKey) => {
    const videoId = video?.youtubeId || video?.id;
    const status = resolveBrainSaveStatus(videoId, tabKey, text);
    if (!status.saved || !status.topicId) {
      toast.error('לא ניתן לפתוח את הפריט השמור');
      return false;
    }
    return navigateFromPanel('TopicKnowledgePage', { topicId: status.topicId });
  }, [navigateFromPanel, video?.id, video?.youtubeId]);

  const openSavedWorkspaceItem = useCallback((text, tabKey) => {
    const videoId = video?.youtubeId || video?.id;
    const status = resolveWorkspaceSaveStatus(videoId, tabKey, text);
    if (!status.saved) {
      toast.error('לא ניתן לפתוח את הפריט השמור');
      return false;
    }
    if (status.topicId) {
      return navigateFromPanel('TopicKnowledgePage', { topicId: status.topicId });
    }
    return navigateFromPanel('Workspace', {});
  }, [navigateFromPanel, video?.id, video?.youtubeId]);

  const videoIdForQuickSave = video?.youtubeId || video?.id;

  const resolveObsidianStatusForItem = useCallback((meta, destinationPath) => {
    const tabKey = meta?.type || meta?.tabScope || 'multi';
    return resolveObsidianSaveStatus({
      videoId: videoIdForQuickSave,
      tabKey,
      sectionKey: meta?.sectionLabel || '',
      text: meta?.text || '',
      destinationPath,
    });
  }, [videoIdForQuickSave]);

  const openSavedObsidianItem = useCallback((text, tabKey, sectionKey) => {
    const status = resolveObsidianSaveStatus({
      videoId: videoIdForQuickSave,
      tabKey: tabKey || 'multi',
      sectionKey: sectionKey || '',
      text,
    });
    if (!status.saved || !status.openPath) {
      toast.error('לא ניתן לפתוח את הפריט השמור');
      return false;
    }
    return openResolvedObsidianPath(status.openPath);
  }, [openResolvedObsidianPath, videoIdForQuickSave]);

  const obsidianPickerSaveContext = useMemo(() => {
    if (!videoIdForQuickSave) return null;
    if (pendingObsidianRowSave) {
      return {
        videoId: videoIdForQuickSave,
        items: [{
          text: pendingObsidianRowSave.text,
          tabKey: pendingObsidianRowSave.type || pendingObsidianRowSave.tabScope || 'multi',
          sectionKey: pendingObsidianRowSave.sectionLabel || '',
          sectionLabel: pendingObsidianRowSave.sectionLabel || '',
        }],
      };
    }
    if (multiObsidianPickerMode && multiSelected.size > 0) {
      return {
        videoId: videoIdForQuickSave,
        items: [...multiSelected.values()].map((item) => ({
          text: item.text,
          tabKey: item.type || item.tabScope || 'multi',
          sectionKey: item.sectionLabel || '',
          sectionLabel: item.sectionLabel || '',
        })),
      };
    }
    return null;
  }, [videoIdForQuickSave, pendingObsidianRowSave, multiObsidianPickerMode, multiSelected]);

  const bulkSelectionShare = useMemo(() => ({
    multiSelected,
    onToggle: toggleMultiSelect,
    onSelectAll: multiSelectAll,
    onClear: multiSelectClear,
    videoId: videoIdForQuickSave,
    obsidianItemSaveRevision,
    onQuickSaveBrain: (meta) => {
      const tabKey = meta.type || meta.tabScope || 'multi';
      if (isBrainItemSaved(meta.text, tabKey)) {
        openSavedBrainItem(meta.text, tabKey);
      } else {
        saveSingleItemToBrain(meta.text, tabKey, meta.sectionLabel || '', '');
      }
    },
    onQuickSaveObsidian: (meta) => {
      if (resolveObsidianStatusForItem(meta).saved) {
        openSavedObsidianItem(meta.text, meta.type || meta.tabScope || 'multi', meta.sectionLabel || '');
      } else {
        saveSingleItemToObsidian(meta);
      }
    },
    onQuickSaveWorkspace: (meta) => {
      const tabKey = meta.type || meta.tabScope || 'multi';
      if (resolveWorkspaceSaveStatus(videoIdForQuickSave, tabKey, meta.text).saved) {
        openSavedWorkspaceItem(meta.text, tabKey);
      } else {
        saveSingleItemToWorkspace(meta);
      }
    },
    isBrainSaved: (text, tabKey) => isBrainItemSaved(text, tabKey),
    isObsidianSaved: (text, tabKey, sectionKey) => isObsidianItemSaved({
      videoId: videoIdForQuickSave,
      tabKey: tabKey || 'multi',
      sectionKey: sectionKey || '',
      text,
    }),
    isWorkspaceSaved: (text, tabKey) => resolveWorkspaceSaveStatus(videoIdForQuickSave, tabKey, text).saved,
  }), [
    multiSelected,
    toggleMultiSelect,
    multiSelectAll,
    multiSelectClear,
    videoIdForQuickSave,
    obsidianItemSaveRevision,
    isBrainItemSaved,
    openSavedBrainItem,
    saveSingleItemToBrain,
    resolveObsidianStatusForItem,
    openSavedObsidianItem,
    saveSingleItemToObsidian,
    saveSingleItemToWorkspace,
    openSavedWorkspaceItem,
  ]);

  const handleSaveBrainSelections = () => {
    const videoId = video?.youtubeId || video?.id;
    const videoUrl = getWatchUrl(video) || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);
    const now = new Date().toISOString();
    let count = 0;
    const topicName = activeBrainTopicName;
    const videoSlug = String(video?.title || videoId || 'פריט').slice(0, 40);
    const newKeys = new Set(savedItemKeys);
    Object.entries(brainSelections).forEach(([id, { text, sourceTab, tabLabel, note }]) => {
      const slug = String(text || '').slice(0, 60).replace(/[^a-zA-Zא-ת\d\s]/g, '').trim().replace(/\s+/g, '-') || 'item';
      const itemId = `brain-item:${videoId}:${id}`;
      upsertKnowledgeItem({
        id: itemId,
        title: String(text || '').slice(0, 80),
        topicId: activeBrainTopicId,
        videoId,
        videoTitle: video?.title || '',
        sourceType: 'youtube',
        sourceId: videoId,
        kind: 'learning',
        markdown: [
          `# ${String(text || '').slice(0, 80)}`,
          '',
          String(text || ''),
          note ? `\n---\nהערה: ${note}` : null,
          videoUrl ? `\n---\nמקור: [${video?.title || ''}](${videoUrl})` : null,
        ].filter(v => v !== null).join('\n'),
        workspacePath: `${topicName}/${sourceTab}/${videoSlug}/${slug}.md`,
        createdAt: now,
        updatedAt: now,
        metadata: {
          videoId: videoId || null,
          videoTitle: video?.title || null,
          videoUrl: videoUrl || null,
          sourceTab,
          tabLabel,
          category: video?.category || null,
          subCategory: video?.subCategory || null,
          note: note || null,
          savedAt: now,
          contentRole: 'my_position',
          perspective: 'self',
          userPosition: 'endorsed',
        },
      });
      newKeys.add(itemId);
      count++;
    });
    setSavedItemKeys(newKeys);
    toast.success(`✅ ${count} פריטים נשמרו למוח`);
    clearBrainSelections();
  };

  const persistAnalysisState = (updates) => {
    const saved = patchVideo(updates);
    onVideoPatch?.(saved ?? { ...video, ...updates });
    return saved;
  };

  const buildDefinedPatch = (patch) =>
    Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined)
    );

  const persistFreshImportRecord = useCallback(async (record, { syncRemote = true } = {}) => {
    if (!record?.id) return record ?? null;

    const localSaved = saveFreshImportRecordLocally(record) || record;
    setVideoState(localSaved);
    onVideoPatch?.(localSaved);
    queryClient.invalidateQueries({ queryKey: ["videos"] });

    if (syncRemote && isBase44Enabled()) {
      try {
        await Video.update(localSaved.id, stripFreshImportFlags(localSaved));
        queryClient.invalidateQueries({ queryKey: ["videos"] });
      } catch (err) {
        console.warn("[FreshImport] Base44 sync failed (non-blocking):", err?.message);
      }
    }

    return localSaved;
  }, [onVideoPatch, queryClient, setVideoState]);

  const resetFreshImportUiState = useCallback(() => {
    restoredAnalysisRef.current = null;
    setSavedAnalysisMeta(null);
    setAnalyzeError(null);
    setAnalysisStage(null);
    setShowLowQualityWarning(false);
    setCategoryOverride(null);
    setSubCategoryOverride(null);
    setGemOverride(null);
    setSubTopicRec(null);
    setSubTopicRecDismissed(false);
    setIsSubTopicEditing(false);
    setSubTopicDraft("");
    setIsCreatingSubTopic(false);
    setNewSubTopicDraft("");
    setSelectedItems({});
    setMultiSelected(new Map());
    setPoliticalSummary(null);
    setPoliticalSummaryError(null);
    setActivePoliticalTab("brain-hi");
    setShowMorePoliticalTabs(false);
    setGemsJsonApplied(false);
    setGemsPasteInput("");
    setGemsPasteError("");
    setGemsParsedErrorInfo(null);
    setGemsRepairApplied(false);
    setGemsErrorContext(null);
    setTranscriptSearch("");
    setTranscriptSearchIndex(0);
    setGeminiStatus("idle");
    setGeminiMessage(null);
    setGeminiAnalysisSource(null);
    setLlamaStatus("idle");
    setLlamaMessage(null);
    setAttachedDocumentsInsights(null);
  }, []);

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
      // Learning tab fields (technical GEM)
      definitions: Array.isArray(v.definitions) ? v.definitions : [],
      indicators: Array.isArray(v.indicators) ? v.indicators : [],
      setups: Array.isArray(v.setups) ? v.setups : [],
      patterns: Array.isArray(v.patterns) ? v.patterns : [],
      tradingPrinciples: Array.isArray(v.tradingPrinciples) ? v.tradingPrinciples : [],
      mentalModels: Array.isArray(v.mentalModels) ? v.mentalModels : [],
      brainHighlights: Array.isArray(v.brainHighlights) ? v.brainHighlights : [],
      usefulKnowledge: Array.isArray(v.usefulKnowledge) ? v.usefulKnowledge : [],
      keyTakeaways: Array.isArray(v.keyTakeaways) ? v.keyTakeaways : [],
      brainSummary: v.brainSummary ?? null,
      contentType: v.contentType ?? null,
      mainClaim: v.mainClaim ?? null,
      speakerPosition: v.speakerPosition ?? null,
      duration: v.duration ?? null,
      viewCount: v.viewCount ?? null,
      customSubtitle: v.customSubtitle ?? null,
      attachedDocumentsInsights: v.attachedDocumentsInsights ?? null,
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
    if (import.meta.env.DEV) {
      console.debug('[GEMS JSON] apply started');
      console.debug('[GEMS Parse] raw keys:', Object.keys(parsed || {}).join(', '));
      console.debug('[GEMS Parse] contentType:', parsed?.contentType);
    }

    // ── Market Brief — handle separately before generic pipeline ──────────
    if (parsed?.contentType === 'marketBrief') {
      const parsedWithOverrides = preserveManualOverridesOnReanalysis(marketBriefData, parsed);
      const videoId = video?.id || video?.youtubeId;
      if (videoId) {
        localStorage.setItem(`market_brief_${videoId}`, JSON.stringify(parsedWithOverrides));
        localStorage.setItem(`gems-applied-${video.id}`, 'true');
      }
      // Persist into video entity so tabs refresh and data survives navigation
      patchVideo({
        marketBriefData: parsedWithOverrides,
        analysisProvider: 'gems',
        analysisStatus: 'analyzed',
        analyzedAt: new Date().toISOString(),
      });
      setMarketBriefData(parsedWithOverrides);
      setGemsJsonApplied(true);
      setGemsPasteError('');
      setGemsParsedErrorInfo(null);
      setGemsRepairApplied(false);
      setIsGemsPasteOpen(false);
      setTimeout(() => setActiveTab('specialized'), 50);
      toast.success('📈 מבזק שוק נקלט בהצלחה ✓');
      return true;
    }

    // ── App Builder — standalone universalTabs.appBuilder paste ──────────
    // Triggered when quick-copy result contains universalTabs.appBuilder
    // but NOT contentType: 'marketBrief' (which is handled above).
    if (parsed?.universalTabs?.appBuilder && parsed?.contentType !== 'marketBrief') {
      const videoId = video?.id || video?.youtubeId;
      const sections = mapUniversalAppBuilderToSections(parsed.universalTabs.appBuilder);
      if (videoId) {
        saveAppBuilderDraft(videoId, sections);
        localStorage.setItem(`gems-applied-${video.id}`, 'true');
      }
      setGemsJsonApplied(true);
      setGemsPasteError('');
      setGemsParsedErrorInfo(null);
      setGemsRepairApplied(false);
      setIsGemsPasteOpen(false);
      setTimeout(() => setActiveTab('app-builder'), 50);
      toast.success('🏗️ App Builder נקלט בהצלחה — עוברים לטאב App Builder');
      return true;
    }

    // ── Macro / Universal Market GEM — contentType: 'market' with universalTabs ──────────
    // Routes through marketBriefData so all universalTabs.* tabs render correctly.
    if (parsed?.contentType === 'market' && parsed?.universalTabs && typeof parsed.universalTabs === 'object') {
      const parsedWithOverrides = preserveManualOverridesOnReanalysis(marketBriefData, parsed);
      const videoId = video?.id || video?.youtubeId;
      if (videoId) {
        localStorage.setItem(`market_brief_${videoId}`, JSON.stringify(parsedWithOverrides));
        localStorage.setItem(`gems-applied-${video.id}`, 'true');
      }
      patchVideo({
        marketBriefData: parsedWithOverrides,
        analysisProvider: 'gems',
        analysisStatus: 'analyzed',
        analyzedAt: new Date().toISOString(),
      });
      setMarketBriefData(parsedWithOverrides);
      setGemsJsonApplied(true);
      setGemsPasteError('');
      setGemsParsedErrorInfo(null);
      setGemsRepairApplied(false);
      setIsGemsPasteOpen(false);
      setTimeout(() => setActiveTab('summary'), 50);
      toast.success('📊 מאקרו GEM נקלט בהצלחה ✓');
      return true;
    }

    if (import.meta.env.DEV) {
      console.debug('[GEMS Parse] has politicalSummary:', !!parsed?.politicalSummary);
      console.debug('[GEMS Parse] has opponentView:', !!(parsed?.opponentView || parsed?.politicalSummary?.opponentView));
    }
    const normalized = normalizeAiAnalysisResult(parsed);
    if (!normalized) { setGemsPasteError("לא זוהה פורמט ניתוח תקין"); return false; }
    if (import.meta.env.DEV) {
      const learningFields = ['definitions','indicators','setups','patterns','checklists','mistakesToAvoid','tradingPrinciples','mentalModels','brainHighlights','usefulKnowledge'];
      const filled = learningFields.filter(k => Array.isArray(normalized[k]) && normalized[k].length > 0);
      console.debug('[GEMS JSON] normalized learning fields populated:', filled.join(', ') || '(none)');
      console.debug('[GEMS JSON] normalized keys:', Object.keys(normalized).join(', '));
    }
    const gemsPatched = persistAnalysisState({ ...normalized, analysisProvider: 'gems', analysisStatus: 'analyzed', analyzedAt: new Date().toISOString() });
    if (import.meta.env.DEV) console.debug('[GEMS JSON] data mapped to app state, patched:', !!gemsPatched);

    // Persist political summary — triggered by political data fields OR by the gem key
    // NOTE: brainHighlights is intentionally excluded — it appears in technical GEMs too
    {
      const isPoliticalGems =
        parsed.contentType === 'political' ||
        effectiveGemInfo?.gemKey === 'political' ||
        !!(parsed.politicalSummary) ||
        !!(parsed.ideologyAnalysis) ||
        !!(parsed.opponentView) ||
        !!(parsed.theologyAnalysis) ||
        (Array.isArray(parsed.viralQuotes) && parsed.viralQuotes.length > 0) ||
        (Array.isArray(parsed.debateResponses) && parsed.debateResponses.length > 0) ||
        (Array.isArray(parsed.politicalSlogans) && parsed.politicalSlogans.length > 0);
      if (isPoliticalGems) {
        const videoId = video?.id || video?.youtubeId;
        if (videoId) {
          const savedKey = `political_summary_${videoId}`;
          localStorage.setItem(savedKey, JSON.stringify(parsed));
          setPoliticalSummary(parsed);
          if (import.meta.env.DEV) console.debug(`[PoliticalSummary] saved from GEMS JSON for videoId=${videoId}`);
        }
      }
    }

    if (video?.id) {
      const nextVideo = { ...video, ...normalized, analysisProvider: 'gems', analysisStatus: 'analyzed', analyzedAt: new Date().toISOString() };
      const snapshot = buildAnalysisSnapshot(nextVideo);
      saveSavedAnalysis(video.id, snapshot);
      setSavedAnalysisMeta(extractSavedAnalysisMeta({ analysisProvider: 'gems', analysisSavedAt: snapshot.analysisSavedAt }));
      localStorage.setItem(`gems-applied-${video.id}`, 'true');
      if (import.meta.env.DEV) console.debug(`[GEMS JSON] snapshot saved for videoId=${video.id}`);
    }
    setGemsJsonApplied(true);
    setGemsPasteError("");
    setGemsParsedErrorInfo(null);
    setGemsRepairApplied(false);
    // Close modal first, then switch to the most relevant tab based on contentType
    setIsGemsPasteOpen(false);
    setTimeout(() => {
      const ct = parsed.contentType;
      if (ct === 'technical' || ct === 'market' || ct === 'learning') {
        setActiveTab("definitions");
        if (import.meta.env.DEV) console.debug('[Tabs] switched to definitions tab after technical GEM import');
      } else {
        setActiveTab("political");
        setActivePoliticalTab("brain-hi");
        if (import.meta.env.DEV) console.debug('[Tabs] switched to political tab after GEM import');
      }
    }, 50);
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
      const { repairedJson: repaired, fixes } = repairGemsJsonDetailed(raw);
      try {
        JSON.parse(repaired);
        const loc = getJsonErrorLocation(raw, parseErr.message);
        const ctx = loc ? getJsonErrorContext(raw, loc.pos) : null;
        const translation = translateJsonError(parseErr.message);
        setGemsParsedErrorInfo(loc ? { ...loc, msg: parseErr.message, translation } : null);
        setGemsErrorContext(ctx);
        setGemsPasteError(loc ? `JSON לא תקין — שורה ${loc.line}, עמודה ${loc.col}` : 'JSON לא תקין');
        setGemsAiRepairResult({
          source: 'fallback',
          repairedJson: repaired,
          changes: fixes,
          report: buildGemsJsonRepairReport({
            source: 'fallback',
            raw,
            repairedJson: repaired,
            fixes,
            errInfo: loc ? { ...loc, msg: parseErr.message, translation } : { msg: parseErr.message, translation },
            errorContext: ctx,
            reason: 'The pasted JSON was invalid, but the app found a valid deterministic repair candidate.',
            prevention: [
              'Return strict JSON only.',
              'Escape all newline characters as \\n.',
              'Keep all property names double-quoted.',
              'Do not embed broken escaped blocks such as \\n\\"field\\" inside raw object structure.',
            ],
          }),
        });
        toast.info('נמצא תיקון JSON — אשר כדי להחיל אותו');
        return;
      } catch (repairErr) {
        // Show error based on the repaired string (more accurate position after gershayim fixes)
        const errMsg = repairErr.message || parseErr.message;
        const loc = getJsonErrorLocation(repaired, errMsg);
        const translation = translateJsonError(errMsg);
        console.log('[JSON Debug] auto-repair failed');
        console.log('[JSON Debug] parse error after repair:', errMsg);
        console.log('[JSON Debug] error location:', loc?.line ?? '?', ':', loc?.col ?? '?');
        const ctx = loc ? getJsonErrorContext(repaired, loc.pos) : null;
        if (ctx) console.log('[JSON Debug] context:', ctx.find(l => l.isError)?.text ?? '');
        setGemsParsedErrorInfo(loc ? { ...loc, msg: errMsg, translation } : null);
        setGemsErrorContext(ctx);
        const locStr = loc ? ` — שורה ${loc.line}, עמודה ${loc.col}` : '';
        setGemsPasteError(`JSON לא תקין${locStr} — תיקון אוטומטי לא הצליח`);
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
    console.log(`[JSON Repair] before input length: ${raw.length}`);
    const { repairedJson: repaired, fixes } = repairGemsJsonDetailed(raw);
    console.log(`[JSON Repair] repaired output length: ${repaired.length}`);
    let repairParseOk = false;
    try { JSON.parse(repaired); repairParseOk = true; } catch {}
    console.log(`[JSON Repair] repair success: ${repairParseOk}`);
    try {
      JSON.parse(repaired);
      const originalErr = (() => {
        try { JSON.parse(raw); return null; } catch (err) { return err; }
      })();
      const loc = originalErr ? getJsonErrorLocation(raw, originalErr.message) : null;
      const ctx = loc ? getJsonErrorContext(raw, loc.pos) : null;
      const translation = originalErr ? translateJsonError(originalErr.message) : null;
      console.log('[JSON Repair] parse success — applying repaired JSON');

      // Apply the repaired JSON immediately so "התחל ניתוח" becomes enabled
      console.log('[JSON Repair] calling setGemsPasteInput with repaired JSON');
      setGemsPasteInput(repaired);
      setGemsRepairApplied(true);
      setGemsPasteError("");
      setGemsParsedErrorInfo(null);
      setGemsErrorContext(null);
      if (video?.id) localStorage.setItem(`gems-paste-${video.id}`, repaired);

      // Keep repair report available for review
      setGemsAiRepairResult({
        source: 'fallback',
        repairedJson: repaired,
        changes: fixes,
        report: buildGemsJsonRepairReport({
          source: 'fallback',
          raw,
          repairedJson: repaired,
          fixes,
          errInfo: loc ? { ...loc, msg: originalErr?.message || '', translation } : (originalErr ? { msg: originalErr.message, translation } : null),
          errorContext: ctx,
          reason: 'The JSON contained malformed escaped content or syntax that could be repaired deterministically inside the app.',
          prevention: [
            'Return strict JSON only.',
            'Do not include raw line breaks inside string values.',
            'Escape newlines as \\n.',
            'Keep all property names double-quoted.',
          ],
        }),
      });
      toast.success(originalErr ? '✅ JSON תוקן — ניתן להתחיל ניתוח' : '✅ JSON תקין');
    } catch (err2) {
      console.log('[JSON Repair] parse failed after repair:', err2.message);
      console.log(`[JSON Repair] setGemsPasteInput NOT called — textarea unchanged`);
      const loc = getJsonErrorLocation(repaired, err2.message);
      const ctx = loc ? getJsonErrorContext(repaired, loc.pos) : null;
      setGemsErrorContext(ctx);
      setGemsParsedErrorInfo(loc ? { ...loc, msg: err2.message, translation: translateJsonError(err2.message) } : null);
      setGemsPasteError(loc ? `התיקון האוטומטי נכשל — הבעיה נמצאת ליד שורה ${loc.line}` : "תיקון אוטומטי לא הצליח — ערוך ידנית");
    }
  };

  const handleAiRepairGemsJson = async () => {
    const raw = gemsPasteInput.trim();
    if (!raw) return;

    const deterministic = repairGemsJsonDetailed(raw);
    const parseMessage = gemsParsedErrorInfo?.msg || gemsPasteError || "Invalid JSON";
    const line = gemsParsedErrorInfo?.line ?? null;
    const col = gemsParsedErrorInfo?.col ?? null;
    const contextLines = gemsErrorContext
      ? gemsErrorContext.map((ln) => `${String(ln.lineNum).padStart(4)}: ${ln.text}${ln.isError ? '  ◀' : ''}`).join('\n')
      : '';

    setIsAiRepairingGemsJson(true);
    try {
      const res = await fetch('/api/gemini-repair-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawJson: raw,
          parserError: parseMessage,
          line,
          col,
          contextLines,
        }),
      });

      if (!res.ok) {
        throw new Error(`AI repair failed (${res.status})`);
      }

      const data = await res.json();
      const repairedJson = typeof data?.repairedJson === 'string' ? data.repairedJson.trim() : '';
      if (!repairedJson) {
        throw new Error('AI repair returned empty JSON');
      }
      JSON.parse(repairedJson);

      setGemsAiRepairResult({
        source: 'ai',
        repairedJson,
        changes: Array.isArray(data?.changes) ? data.changes : deterministic.fixes,
        report: data?.report || buildGemsJsonRepairReport({
          source: 'ai',
          raw,
          repairedJson,
          fixes: Array.isArray(data?.changes) ? data.changes : deterministic.fixes,
          errInfo: gemsParsedErrorInfo,
          errorContext: gemsErrorContext,
          reason: data?.why || 'The AI repaired malformed JSON structure and escaping issues.',
          prevention: Array.isArray(data?.prevention) ? data.prevention : [],
          promptCorrection: data?.promptCorrection || '',
        }),
      });
      toast.success('תיקון AI מוכן — אשר כדי להחיל');
    } catch (err) {
      const fallbackReport = buildGemsJsonRepairReport({
        source: 'fallback',
        raw,
        repairedJson: deterministic.repairedJson,
        fixes: deterministic.fixes,
        errInfo: gemsParsedErrorInfo,
        errorContext: gemsErrorContext,
        reason: 'AI repair was unavailable, so the app generated a deterministic repair report from the parser diagnostics.',
        prevention: [
          'Return strict JSON only.',
          'Escape all newline characters as \\n.',
          'Do not include markdown or wrapper prose around the JSON.',
          'Do not leave numeric values without a property name.',
        ],
      });

      let fallbackJson = deterministic.repairedJson;
      try {
        JSON.parse(fallbackJson);
      } catch {
        fallbackJson = '';
      }

      setGemsAiRepairResult({
        source: 'fallback',
        repairedJson: fallbackJson,
        changes: deterministic.fixes,
        report: fallbackReport,
      });
      toast.info('תיקון AI לא זמין — הופק דוח תיקון בסיסי');
    } finally {
      setIsAiRepairingGemsJson(false);
    }
  };

  const handleApplyAiRepairedJson = () => {
    if (!gemsAiRepairResult?.repairedJson) return;
    try {
      JSON.parse(gemsAiRepairResult.repairedJson);
      setGemsPasteInput(gemsAiRepairResult.repairedJson);
      setGemsRepairApplied(true);
      setGemsPasteError("");
      setGemsParsedErrorInfo(null);
      setGemsErrorContext(null);
      if (video?.id) localStorage.setItem(`gems-paste-${video.id}`, gemsAiRepairResult.repairedJson);
      toast.success('JSON תקין — אפשר להמשיך ל"התחל ניתוח"');
    } catch (err) {
      const loc = getJsonErrorLocation(gemsAiRepairResult.repairedJson, err.message);
      const ctx = loc ? getJsonErrorContext(gemsAiRepairResult.repairedJson, loc.pos) : null;
      setGemsParsedErrorInfo(loc ? { ...loc, msg: err.message, translation: translateJsonError(err.message) } : null);
      setGemsErrorContext(ctx);
      setGemsPasteError(loc ? `JSON מתוקן עדיין לא תקין — שורה ${loc.line}, עמודה ${loc.col}` : 'JSON מתוקן עדיין לא תקין');
      toast.error('התיקון לא עבר אימות JSON');
    }
  };

  const handleCopyAiRepairReport = () => {
    if (!gemsAiRepairResult?.report) return;
    navigator.clipboard.writeText(gemsAiRepairResult.report).then(() => toast.success('דוח התיקון הועתק'));
  };

  const handleCopyAiRepairedJson = () => {
    if (!gemsAiRepairResult?.repairedJson) return;
    navigator.clipboard.writeText(gemsAiRepairResult.repairedJson).then(() => toast.success('JSON מתוקן הועתק'));
  };

  const currentGemsJsonValidation = useMemo(() => {
    const raw = gemsPasteInput.trim();
    if (!raw) return { hasValue: false, isValid: false, error: null };
    try {
      JSON.parse(raw);
      return { hasValue: true, isValid: true, error: null };
    } catch (error) {
      return { hasValue: true, isValid: false, error };
    }
  }, [gemsPasteInput]);

  const handleCopyGemsJson = async () => {
    if (!gemsPasteInput) return;
    try {
      await navigator.clipboard.writeText(gemsPasteInput);
      setGemsCopyStatus('copied');
    } catch {
      setGemsCopyStatus('error');
    }
    setTimeout(() => setGemsCopyStatus(null), 2000);
  };

  const handleClearGemsPaste = () => {
    setGemsPasteInput('');
    setGemsPasteError('');
    setGemsParsedErrorInfo(null);
    setGemsRepairApplied(false);
    setGemsErrorContext(null);
    setGemsAiRepairResult(null);
    setIsAiRepairingGemsJson(false);
    if (video?.id) {
      localStorage.removeItem(`gems-paste-${video.id}`);
      sessionStorage.removeItem(`gems-paste-${video.id}`);
      localStorage.setItem(`gems-paste-cleared-${video.id}`, '1');
    }
    toast.success('המלל נמחק ולא ישוחזר אוטומטית');
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
      setGemRecommendationVisible(true);
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

    // Repair publishedAt only when YouTube returned a real publish date AND the stored
    // value is either missing or equal to the import timestamp (suspect fallback).
    const pubRepairPatch = (() => {
      if (!metadata.publishedAt) return {};
      const existingMs = video.publishedAt ? new Date(video.publishedAt).getTime() : null;
      const importRef = video.fetchedAt || video.addedAt;
      const importMs = importRef ? new Date(importRef).getTime() : null;
      const isSuspect = existingMs && importMs && Math.abs(existingMs - importMs) < 10 * 60_000;
      return (!existingMs || isSuspect) ? { publishedAt: metadata.publishedAt } : {};
    })();
    const merged = {
      ...video,
      ...(metadata.description ? { description: metadata.description } : {}),
      ...(metadata.duration ? { duration: metadata.duration } : {}),
      ...(Number.isFinite(metadata.viewCount) ? { viewCount: metadata.viewCount } : {}),
      ...pubRepairPatch,
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
      const fromTranscriptChapters = fromTranscript?.chapters ?? null;

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
        ...(fromTranscriptChapters?.length
          ? {
              aiChapters: fromTranscriptChapters,
              chapterSource: fromTranscript?.chapterSource || "transcript_heuristic",
              analysisQuality: fromTranscript?.analysisQuality || "low",
              ...(transcriptToStore ? { transcript: transcriptToStore } : {}),
            }
          : {}),
      };
      const saved = await updateSummary.mutateAsync(patch);

      onVideoPatch?.(saved || { ...video, ...patch });
      onAnalyzeDone?.({
        ...result,
        status: "done",
        ...(fromTranscriptChapters?.length ? { aiChapters: fromTranscriptChapters } : {}),
      });

      const triedTranscript =
        (typeof video.transcript === "string" && video.transcript.trim().length > 40) || !!ytId;
      if (triedTranscript && !fromTranscriptChapters?.length) {
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
  const runAiAnalysis = async ({
    force = false,
    manualTranscriptOverride = null,
    videoOverride = null,
    transcriptPayloadOverride = null,
  } = {}) => {
    if (isAnalyzing || isReanalyzing) return;

    const workingVideo = videoOverride ?? video;
    if (!workingVideo?.id) return;

    if (force) setIsReanalyzing(true);
    else setIsAnalyzing(true);

    setAnalyzeError(null);
    console.log("[analyze-button] handler", force ? "reanalyze" : "analyze", workingVideo.id);
    console.log("[ai-reanalyze] start", workingVideo.id);
    console.log("[analysis] videoId", workingVideo.id);
    console.log("[analysis] transcriptStatus", workingVideo.transcriptStatus);

    persistAnalysisState({
      analysisStatus: "analyzing",
      analysisError: null,
    });

    try {
      const watchUrl = getWatchUrl(workingVideo);
      const ytId = getVideoIdFromUrl(watchUrl);

      const manualTranscriptText =
        typeof manualTranscriptOverride === 'string' && manualTranscriptOverride.trim().length > 40
          ? manualTranscriptOverride.trim()
          : typeof workingVideo.manualTranscript === 'string' && workingVideo.manualTranscript.trim().length > 40
            ? workingVideo.manualTranscript.trim()
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
      } else if (transcriptPayloadOverride?.ok) {
        transcriptRaw =
          typeof transcriptPayloadOverride.body === "string" && transcriptPayloadOverride.body.trim().length > 0
            ? transcriptPayloadOverride.body
            : null;
        transcriptPayload = {
          ...transcriptPayloadOverride,
          source: transcriptPayloadOverride.source || "youtube",
          language: transcriptPayloadOverride.language ?? transcriptPayloadOverride.lang ?? null,
          transcriptStatus: transcriptPayloadOverride.transcriptStatus || "youtube",
          transcriptQuality: transcriptPayloadOverride.transcriptQuality || null,
          segments: Array.isArray(transcriptPayloadOverride.segments) ? transcriptPayloadOverride.segments : [],
        };
      } else {
        transcriptRaw =
          typeof workingVideo.transcript === "string" && workingVideo.transcript.trim().length > 40
            ? workingVideo.transcript.trim()
            : null;
        const storedSegments =
          Array.isArray(workingVideo.transcriptSegments) && workingVideo.transcriptSegments.length > 0
            ? workingVideo.transcriptSegments
            : null;
        transcriptPayload = transcriptRaw
          ? {
              ok: true,
              body: transcriptRaw,
              source: workingVideo.transcriptSource || "stored",
              language: workingVideo.transcriptLanguage || null,
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

        const descText = typeof workingVideo.description === "string" ? workingVideo.description : "";
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
            id: workingVideo.id,
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
            _fullVideo: workingVideo,
          };

          console.log("[analysis] fallback source", "description_timestamps");
          console.log("[analysis] transcript length", 0);
          console.log("[analysis] chapters count", descChapters.length);

          const saved = await updateSummary.mutateAsync(patch);
          const nextVideo = saved || { ...workingVideo, ...patch };
          onVideoPatch?.(nextVideo);
          onAnalyzeDone?.(nextVideo);
          toast.success("נוצרו פרקים מתוך תיאור הסרטון (ללא תמלול)");
          return;
        }

        // Fallback 2: native chapters already stored on video (only if seekable)
        const native = Array.isArray(workingVideo.chapters) ? workingVideo.chapters : Array.isArray(workingVideo.aiChapters) ? workingVideo.aiChapters : [];
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
            id: workingVideo.id,
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
            _fullVideo: workingVideo,
          };

          console.log("[analysis] fallback source", "native_chapters");
          console.log("[analysis] transcript length", 0);
          console.log("[analysis] chapters count", nativeSeekable.length);

          const saved = await updateSummary.mutateAsync(patch);
          const nextVideo = saved || { ...workingVideo, ...patch };
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
        videoId: workingVideo.id,
        title: workingVideo.title,
        transcript: transcriptText,
        durationSeconds: getVideoDurationSeconds(workingVideo),
        mentor: mentorName || null,
        category: null,
        chaptersTarget: computeTargetChapters(getVideoDurationSeconds(workingVideo), chapterDensityMode),
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

      const videoDurationSeconds = getVideoDurationSeconds(workingVideo);
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

      const analysisVersion = Number(workingVideo.analysisVersion || 0) + 1;
      const patch = {
        id: workingVideo.id,
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
        _fullVideo: workingVideo,
      };

      const saved = await updateSummary.mutateAsync(patch);
      const nextVideo = saved || { ...workingVideo, ...patch };

      setVideoState(nextVideo);

      // Auto-save analysis on every successful completion
      const snapshot = buildAnalysisSnapshot(nextVideo);
      saveSavedAnalysis(workingVideo.id, snapshot);
      setSavedAnalysisMeta(extractSavedAnalysisMeta({
        analysisProvider: nextVideo.analysisProvider || null,
        analysisSavedAt: snapshot.analysisSavedAt,
      }));

      onVideoPatch?.(nextVideo);
      onAnalyzeDone?.(nextVideo);
      console.log("[ai-reanalyze] saved", workingVideo.id);
      console.log(`[AI Analysis] analysis completed`);
      console.log(`[AI Analysis] saved for videoId=${workingVideo.id}`);
      toast.success("הניתוח הושלם בהצלחה");
      toast.success("הניתוח נשמר בהצלחה ✓");
      return nextVideo;
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

  const runFreshImportPipeline = useCallback(async ({
    resetBeforeAnalysis = false,
    consumePending = false,
    triggerSource = "panel",
  } = {}) => {
    if (isFreshImportRunning) return;

    const baseVideo = video;
    if (!baseVideo?.id) return;

    const ytId = baseVideo.videoId || baseVideo.youtubeId || getVideoIdFromUrl(getWatchUrl(baseVideo));
    if (!ytId) {
      toast.error("לא ניתן לזהות את מזהה הסרטון לייבוא מחדש");
      return;
    }

    setIsFreshImportRunning(true);
    setActiveTab("summary");
    resetFreshImportUiState();

    try {
      let workingVideo = baseVideo;

      if (consumePending && baseVideo.pendingFreshImport) {
        workingVideo = await persistFreshImportRecord(consumeFreshImportFlag(baseVideo), { syncRemote: false });
      }

      if (resetBeforeAnalysis) {
        const freshMetadata = await buildExternalVideoObject(ytId, {
          mentorId: baseVideo.mentorId ?? null,
          topicIds: Array.isArray(baseVideo.topicIds) ? baseVideo.topicIds : [],
          source: baseVideo.source || "manual",
        });
        clearVideoGeneratedCaches(baseVideo);
        const rebuilt = buildFreshImportRecord(baseVideo, freshMetadata, {
          requestFreshAnalysis: false,
          requestSource: triggerSource,
        });
        workingVideo = await persistFreshImportRecord(rebuilt);
      }

      let transcriptPayload = null;
      try {
        const payload = await fetchTranscriptPayload(ytId);
        const segments = Array.isArray(payload?.segments) ? payload.segments : [];
        const body = typeof payload?.body === "string" ? payload.body : "";

        if (segments.length > 0 || body.trim().length >= 40) {
          const qualityResult = (() => {
            try {
              return validateTranscriptUsable({ segments });
            } catch {
              return {};
            }
          })();

          transcriptPayload = {
            ok: true,
            body,
            source: "youtube-timedtext",
            language: payload?.lang || null,
            lang: payload?.lang || null,
            segments,
            transcriptStatus: "youtube",
            transcriptQuality: qualityResult.transcriptQuality || "low",
          };

          const transcriptPatch = buildDefinedPatch({
            transcript: body,
            transcriptSegments: segments,
            transcriptSource: "youtube-timedtext",
            transcriptLanguage: payload?.lang || null,
            transcriptStatus: "youtube",
            transcriptQuality: qualityResult.transcriptQuality || "low",
            transcriptError: null,
            transcriptImportedAt: new Date().toISOString(),
            pendingFreshImport: false,
          });

          workingVideo = await persistFreshImportRecord({
            ...workingVideo,
            ...transcriptPatch,
          });
          toast.success("התמלול יובא מחדש");
        }
      } catch (err) {
        console.warn("[FreshImport] transcript prefetch failed:", err?.message);
      }

      if (workingVideo?.pendingFreshImport) {
        workingVideo = await persistFreshImportRecord(consumeFreshImportFlag(workingVideo), { syncRemote: false });
      }

      const analysisResult = await runAiAnalysis({
        force: true,
        videoOverride: workingVideo,
        transcriptPayloadOverride: transcriptPayload,
      });

      if (analysisResult) {
        toast.success("הסרטון נותח מחדש מאפס");
      }
    } finally {
      setIsFreshImportRunning(false);
    }
  }, [
    buildDefinedPatch,
    isFreshImportRunning,
    persistFreshImportRecord,
    resetFreshImportUiState,
    runAiAnalysis,
    video,
  ]);

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

  useEffect(() => {
    if (!open || !video?.id || !video?.pendingFreshImport) return;
    const token = `${video.id}:${video.freshImportRequestedAt || "pending"}`;
    if (freshImportAutoRunRef.current === token) return;
    freshImportAutoRunRef.current = token;
    runFreshImportPipeline({
      resetBeforeAnalysis: false,
      consumePending: true,
      triggerSource: video.freshImportSource || "duplicate_modal",
    }).catch((err) => {
      console.error("[FreshImport] auto run failed:", err?.message);
      toast.error(err?.message || "ייבוא מחדש מאפס נכשל");
    });
  }, [
    open,
    runFreshImportPipeline,
    video?.freshImportRequestedAt,
    video?.freshImportSource,
    video?.id,
    video?.pendingFreshImport,
  ]);

  if (!video) return null;

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
  const videoPublishDisplay = (() => {
    const rawDate = video.publishedAt || null;

    // Detect when publishedAt was silently set to the import timestamp instead of the YouTube
    // publish date. This happened when metadata fetch returned no publishedAt and the ingestion
    // code fell back to new Date(). Heuristic: if publishedAt and fetchedAt/addedAt are within
    // 10 minutes of each other, treat publishedAt as an import-date artifact.
    const importRef = video.fetchedAt || video.addedAt || null;
    const isSuspectImportDate = rawDate && importRef &&
      Math.abs(new Date(rawDate).getTime() - new Date(importRef).getTime()) < 10 * 60_000;

    const usePublishDate = rawDate && !isSuspectImportDate ? rawDate : null;
    const fallbackDate = !usePublishDate ? (video.analyzedAt || video.addedAt || null) : null;
    const dateStr = usePublishDate || fallbackDate;

    if (import.meta.env.DEV) {
      console.log('[VideoDate]', {
        field: usePublishDate ? 'publishedAt' : (fallbackDate ? (video.analyzedAt ? 'analyzedAt' : 'addedAt') : 'none'),
        value: dateStr,
        isSuspectImportDate,
        publishedAt: rawDate,
        fetchedAt: video.fetchedAt,
        addedAt: video.addedAt,
        analyzedAt: video.analyzedAt,
      });
    }

    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const exactDate = format(d, "dd/MM/yyyy");
    const exactTime = format(d, "HH:mm");

    if (!usePublishDate) {
      return { icon: '🔬', label: `נותח ב־${exactDate}`, title: `תאריך ניתוח: ${exactDate} ${exactTime}`, canRepair: true };
    }

    const diffH = (Date.now() - d.getTime()) / 3_600_000;
    let relative = null;
    if (diffH < 1) relative = 'לפני פחות משעה';
    else if (diffH < 24) relative = `לפני ${Math.floor(diffH)} שעות`;
    else if (diffH < 48) relative = 'אתמול';
    const label = relative ? `${relative} · ${exactDate} · ${exactTime}` : exactDate;
    return { icon: '📅', label, title: `עלה ב־${exactDate} בשעה ${exactTime}`, canRepair: false };
  })();
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

  // Repairs a polluted publishedAt (import timestamp) with the real YouTube publish date.
  // Safe: only overwrites when the stored value is null or matches the import timestamp heuristic.
  const handleRepairPublishDate = async () => {
    if (!videoYtId || isRepairingDate) return;
    setIsRepairingDate(true);
    try {
      const metadata = await fetchVideoMetadata(videoYtId);
      const ytPublishedAt = metadata?.publishedAt || null;
      const existingMs = video.publishedAt ? new Date(video.publishedAt).getTime() : null;
      const importRef = video.fetchedAt || video.addedAt;
      const importMs = importRef ? new Date(importRef).getTime() : null;
      const isSuspect = existingMs && importMs && Math.abs(existingMs - importMs) < 10 * 60_000;
      const shouldRepair = !existingMs || isSuspect;

      if (import.meta.env.DEV) {
        console.debug('[publishedAt repair]', {
          oldPublishedAt: video.publishedAt,
          newPublishedAt: ytPublishedAt,
          fetchedAt: video.fetchedAt,
          addedAt: video.addedAt,
          isSuspect,
          shouldRepair,
          repairHappened: shouldRepair && !!ytPublishedAt,
        });
      }

      if (!ytPublishedAt) {
        toast.error('YouTube לא החזיר תאריך פרסום — נסה שוב מאוחר יותר');
        return;
      }
      if (!shouldRepair) {
        toast.info('התאריך השמור נראה תקין — לא נדרש תיקון');
        return;
      }
      patchVideo({ publishedAt: ytPublishedAt });
      toast.success('תאריך הפרסום עודכן מ-YouTube ✓');
    } catch (err) {
      console.error('[publishedAt repair] error:', err);
      toast.error('שגיאה בשליפת מטא-דאטה מ-YouTube');
    } finally {
      setIsRepairingDate(false);
    }
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

      const patch = buildDefinedPatch({
        transcript: body,
        transcriptSegments: segments,
        transcriptSource: "youtube-timedtext",
        transcriptLanguage: payload?.lang || null,
        transcriptStatus: "youtube",
        transcriptQuality: qualityResult.transcriptQuality || "low",
        transcriptError: null,
        transcriptImportedAt: new Date().toISOString(),
        category: effectiveCategory ?? resolvedVideoMode.category ?? undefined,
        subCategory: effectiveSubCategory || resolvedVideoMode.subCategory || undefined,
        uiMode: video?.uiMode ?? videoProp?.uiMode ?? resolvedVideoMode.mode ?? undefined,
        tabsPreset: video?.tabsPreset ?? videoProp?.tabsPreset ?? resolvedVideoMode.tabsPreset ?? undefined,
        gemType: video?.gemType ?? videoProp?.gemType ?? resolvedVideoMode.gemType ?? undefined,
        recommendedGem: video?.recommendedGem ?? videoProp?.recommendedGem ?? undefined,
        analysisType: video?.analysisType ?? videoProp?.analysisType ?? resolvedVideoMode.analysisType ?? undefined,
      });

      console.log("[transcript-handler] preserving mode", {
        videoId: video?.id,
        category: patch.category ?? null,
        subCategory: patch.subCategory ?? null,
        uiMode: patch.uiMode ?? null,
        tabsPreset: patch.tabsPreset ?? null,
        gemType: patch.gemType ?? null,
        analysisType: patch.analysisType ?? null,
      });
      persistAnalysisState(patch);
      setGemRecommendationVisible(true);
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

  const handleFreshImportReset = async () => {
    try {
      toast.message("מוחק היסטוריה ומנתח מחדש...", {
        description: "ההערות הידניות וקבצי Obsidian נשארים ללא שינוי",
      });
      await runFreshImportPipeline({
        resetBeforeAnalysis: true,
        consumePending: true,
        triggerSource: "panel_reset",
      });
    } catch (err) {
      console.error("[FreshImport] manual reset failed:", err?.message);
      toast.error(err?.message || "מחק היסטוריה ונתח מחדש נכשל");
    }
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
      const chaptersTarget = computeTargetChapters(durationSec, chapterDensityMode);
      let txText = typeof video?.transcript === 'string' && video.transcript.trim().length > 40 ? video.transcript.trim() : null;
      const txSegments = Array.isArray(video?.transcriptSegments) && video.transcriptSegments.length > 0
        ? video.transcriptSegments
        : storedTranscriptSegments?.length > 0 ? storedTranscriptSegments : null;

      // Merge attached PDF transcripts when user opted in
      let attachedDocumentsMetadata = null;
      if (includeDocsInAnalysis && attachedDocuments.length > 0) {
        const pdfParts = attachedDocuments
          .filter(d => d.transcript?.length > 50)
          .map(d => `\n\n--- מסמך מצורף: ${d.name} ---\n${d.transcript}`);
        if (pdfParts.length > 0) {
          txText = (txText || '') + pdfParts.join('');
          attachedDocumentsMetadata = attachedDocuments.map(d => ({
            name: d.name,
            pages: d.pages,
            transcriptLength: d.transcript?.length || 0,
          }));
          console.log('[VideoPDF] Included in AI analysis:', attachedDocumentsMetadata);
        }
      }

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
        attachedDocumentsMetadata,
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
      const rawAttachedInsights = result?.attachedDocumentsInsights || null;
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
        attachedDocumentsInsights: rawAttachedInsights,
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
      setAttachedDocumentsInsights(rawAttachedInsights);
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
  const chapterSourceBadge = (() => {
    const s = chapterSourceInfo.source;
    if (!s) return null;
    if (s === 'description_timestamp' || s === 'youtube_description' || s === 'description_timestamps') return '🟢 זמן מדויק';
    if (s === 'gem' || s === 'gem_chapters' || s === 'gemini' || s === 'gemini_url' || s === 'gems_analysis' || s === 'ai_generated' || s === 'transcript' || s === 'saved') return '🔵 AI';
    if (s === 'transcript_topic_heuristic' || isTranscriptChunkChapterSource(s) || s === 'manual_transcript') return '🟠 משוער מתמלול';
    if (s === 'outline' || s === 'duration_fallback' || s === 'estimated' || s === 'native_chapters') return '⚪ תבנית';
    return '⚪ מקור לא ידוע';
  })();
  const chapterSourceBadgeClass = (() => {
    const s = chapterSourceInfo.source;
    if (s === 'description_timestamp' || s === 'youtube_description' || s === 'description_timestamps')
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-800/40';
    if (s === 'gem' || s === 'gem_chapters' || s === 'gemini' || s === 'gemini_url' || s === 'gems_analysis' || s === 'ai_generated' || s === 'transcript' || s === 'saved')
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-800/40';
    if (s === 'transcript_topic_heuristic' || isTranscriptChunkChapterSource(s) || s === 'manual_transcript')
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-800/40';
    return 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700';
  })();
  const storedTranscriptSegments = transcriptForChapters.segments;
  const hasStoredTranscript = transcriptForChapters.hasUsableText;
  const transcriptSourceLabel =
    video.transcriptSource === "youtube-transcript-api" ? "youtube-transcript-api"
    : video.transcriptSource === "youtube-timedtext" ? "YouTube"
    : video.transcriptStatus === "manual" ? "ידני"
    : video.transcriptStatus === "gemini" ? "Gemini"
    : video.transcriptStatus === "youtube" ? "YouTube"
    : null;
  const fullTranscriptText =
    getVideoTranscriptText(video) ||
    (storedTranscriptSegments.length > 0
      ? storedTranscriptSegments.map((s) => s.text || "").join(" ")
      : "");
  const transcriptWordCount = fullTranscriptText ? fullTranscriptText.split(/\s+/).filter(Boolean).length : 0;

  const tjsRec = recommendTjsGemFromTranscript(fullTranscriptText);

  const displayGemInfo = (tjsRec?.recommendedGemKey && tjsRec.confidencePct >= 60)
    ? { gemKey: tjsRec.gemKey, gemLabel: tjsRec.gemLabel, gemIcon: tjsRec.gemIcon, confidencePct: tjsRec.confidencePct, confidence: tjsRec.confidence, reason: tjsRec.reason, detectedKeywords: tjsRec.detectedKeywords, phase: 'accurate', isManual: false }
    : effectiveGemInfo ? { ...effectiveGemInfo, detectedKeywords: [] } : null;

  const handleOpenRecommendedGem = async () => {
    const gemKey = effectiveGemInfo?.gemKey;
    if (!fullTranscriptText) {
      toast.error("אין תמלול זמין לשליחה");
      return;
    }
    if (!gemKey) return;
    setGemRecommendationOpening(true);
    try {
      const clipboardPayload = buildTranscriptGemPayload({
        video,
        fullTranscriptText,
        durationLabel: videoDuration,
      });
      await navigator.clipboard.writeText(clipboardPayload);
      toast.success("✓ התמלול הועתק ללוח");
      const gemUrl = getGemUrl(gemKey);
      if (!gemUrl) {
        setShowGemsSettings(true);
        toast.info("יש להגדיר כתובת Gem בהגדרות");
        return;
      }
      openGeminiGemUrl(gemUrl);
    } catch {
      toast.error("לא ניתן לגשת ללוח");
    } finally {
      setGemRecommendationOpening(false);
    }
  };

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

  // Filter mode: split transcript into sentences and keep only those containing the query
  const filteredSentences = (() => {
    const q = transcriptSearch.trim();
    if (!q || !fullTranscriptText) return [];
    const qLower = q.toLowerCase();
    // Split on sentence-ending punctuation or newlines, keeping delimiter attached
    const sentences = fullTranscriptText.split(/(?<=[.!?\n])\s*/);
    const results = [];
    let charOffset = 0;
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(qLower)) {
        results.push({ text: sentence.trim(), offset: charOffset });
      }
      charOffset += sentence.length;
    }
    return results;
  })();

  // Paragraphs for Reading Mode — split text into readable chunks
  const transcriptParagraphs = (() => {
    if (!fullTranscriptText) return [];
    // 1. Try double newlines (real paragraph breaks)
    const byDouble = fullTranscriptText.split(/\n{2,}/).map(s => s.replace(/\n/g, ' ').trim()).filter(s => s.length > 15);
    if (byDouble.length >= 2) return byDouble;
    // 2. Try single newlines, group 3 lines per paragraph
    const bySingle = fullTranscriptText.split(/\n/).map(s => s.trim()).filter(s => s.length > 10);
    if (bySingle.length >= 3) {
      const grouped = [];
      for (let i = 0; i < bySingle.length; i += 3) {
        const chunk = bySingle.slice(i, i + 3).join(' ').trim();
        if (chunk) grouped.push(chunk);
      }
      return grouped;
    }
    // 3. Fallback: group by sentence endings (~4 sentences per paragraph)
    const raw = fullTranscriptText;
    const chunks = [];
    let start = 0;
    let sentCount = 0;
    for (let i = 0; i < raw.length; i++) {
      if ('.!?'.includes(raw[i])) {
        const next = raw[i + 1];
        if (!next || next === ' ' || next === '\n') {
          sentCount++;
          if (sentCount >= 4) {
            chunks.push(raw.slice(start, i + 1).trim());
            start = i + 2;
            sentCount = 0;
          }
        }
      }
    }
    if (start < raw.length) {
      const tail = raw.slice(start).trim();
      if (tail) chunks.push(tail);
    }
    return chunks.length >= 2 ? chunks : [raw];
  })();

  // Highlight helper for Reading Mode — returns array of strings and {h: true, text} objects
  const highlightInParagraph = (text, query) => {
    if (!query) return [text];
    const parts = [];
    const lower = text.toLowerCase();
    const qLower = query.toLowerCase();
    const qLen = query.length;
    let pos = 0;
    while (pos < text.length) {
      const found = lower.indexOf(qLower, pos);
      if (found === -1) { parts.push(text.slice(pos)); break; }
      if (found > pos) parts.push(text.slice(pos, found));
      parts.push({ h: true, text: text.slice(found, found + qLen) });
      pos = found + qLen;
    }
    return parts;
  };

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
      topicIds: effectiveVideo?.topicIds,
      obsidianTopic: effectiveVideo?.obsidianTopic,
      topicsLoaded: topics.length,
      category: effectiveCategory ?? null,
      subCategory: effectiveSubCategory || null,
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
    if (effectiveVideo?.topicIds?.length) {
      console.log("[Workspace CTA] → topicId:", effectiveVideo.topicIds[0]);
      try { upsertKnowledgeItem(createKnowledgeItemFromVideo(effectiveVideo, effectiveVideo.topicIds[0])); } catch {}
      closeAndNavigate("TopicKnowledgePage", { topicId: effectiveVideo.topicIds[0] });
      return;
    }

    // Priority 2: obsidianTopic name → match against topics list
    if (effectiveVideo?.obsidianTopic) {
      const match = topics.find((t) => t.name?.toLowerCase() === effectiveVideo.obsidianTopic.toLowerCase());
      if (match) {
        console.log("[Workspace CTA] → obsidianTopic match:", match.id);
        try { upsertKnowledgeItem(createKnowledgeItemFromVideo(effectiveVideo, match.id)); } catch {}
        closeAndNavigate("TopicKnowledgePage", { topicId: match.id });
        return;
      }
    }

    // Priority 3: auto-resolved topic name → match against topics list
    const primaryTopicName = resolvePrimaryTopic(effectiveVideo);
    if (primaryTopicName) {
      const match = topics.find((t) => t.name?.toLowerCase() === primaryTopicName.toLowerCase());
      if (match) {
        console.log("[Workspace CTA] → primaryTopic match:", match.id);
        try { upsertKnowledgeItem(createKnowledgeItemFromVideo(effectiveVideo, match.id)); } catch {}
        closeAndNavigate("TopicKnowledgePage", { topicId: match.id });
        return;
      }
    }

    // No topic found → land on Workspace with a hint
    console.log("[Workspace CTA] → no topic match, going to Workspace root");
    try { upsertKnowledgeItem(createKnowledgeItemFromVideo(effectiveVideo, null)); } catch {}
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

  const handleAttachPdf = (doc) => {
    if (!video?.id) {
      console.warn('[VideoPDF] Cannot persist attached document: missing video.id');
      toast.error('לא ניתן לצרף — חסר מזהה סרטון');
      return;
    }
    const newDoc = {
      id: doc.id,
      name: doc.title || doc.originalFileName || 'מסמך PDF',
      contentType: 'pdf',
      pages: doc.pdfPages,
      transcript: doc.transcript || '',
      importedAt: new Date().toISOString(),
    };
    const updated = [...attachedDocuments, newDoc];
    setAttachedDocuments(updated);
    updateLocalVideo(video.id, { attachedDocuments: updated });
    setAttachedDocsExpanded(true);
    console.log('[VideoPDF] Document attached:', { id: newDoc.id, name: newDoc.name, pages: newDoc.pages, transcriptLength: newDoc.transcript.length });
    console.log('[VideoPDF] Total attached documents:', updated.length);
    toast.success(`📎 ${newDoc.name} צורף לסרטון`);
  };

  const handleRemoveAttachedDoc = (docId) => {
    const updated = attachedDocuments.filter(d => d.id !== docId);
    setAttachedDocuments(updated);
    const storageUpdate = { attachedDocuments: updated };
    if (updated.length === 0 && attachedDocumentsInsights) {
      setAttachedDocumentsInsights(null);
      storageUpdate.attachedDocumentsInsights = null;
    }
    updateLocalVideo(video.id, storageUpdate);
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
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
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

        <ScrollArea className="flex-1 max-lg:overflow-x-hidden">
          <div className="w-0 min-w-full max-w-full overflow-x-clip box-border">
          <div dir="rtl" className="flex flex-col max-w-[1400px] mx-auto bg-white text-slate-900 dark:bg-zinc-950 dark:text-zinc-100 w-full max-w-full min-w-0 box-border overflow-x-clip">

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
                <button
                  type="button"
                  onClick={() => setWorkspaceSaveOpen(true)}
                  title={isInWorkspaceLib ? (isWorkspaceMappingCurrent ? 'עדכן ב-Workspace Library' : 'עדכן מיפוי ב-Workspace Library') : 'שמור ל-Workspace Library'}
                  className={cn(
                    'shrink-0 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap',
                    isInWorkspaceLib
                      ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-300'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-amber-700/60 dark:hover:bg-amber-950/20 dark:hover:text-amber-300'
                  )}
                >
                  {!isInWorkspaceLib ? '⭐ Workspace' : isWorkspaceMappingCurrent ? '⭐ נשמר' : '⭐ עדכן'}
                </button>
                {/* ⚔️ Opponent view toggle — politics only */}
                {resolvedVideoMode.mode === "politics" && (
                  <button
                    type="button"
                    onClick={handleToggleOpponentView}
                    title="דעת האויב – תוכן שנשמר לצורך הבנת טענות הצד השני ואינו מייצג את עמדתי."
                    className={cn(
                      'shrink-0 rounded-xl border p-1.5 text-sm leading-none transition-all active:scale-95',
                      isOpponentView
                        ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800/60 dark:bg-rose-950/30 dark:text-rose-300'
                        : 'border-slate-200 bg-white text-slate-400 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500 dark:hover:border-rose-800/60 dark:hover:bg-rose-950/20 dark:hover:text-rose-300'
                    )}
                  >
                    ⚔️
                  </button>
                )}
              </div>
              {/* Opponent view banner — politics only */}
              {isOpponentView && resolvedVideoMode.mode === "politics" && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-800/60 w-fit">
                  <span className="text-base leading-none">⚔️</span>
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-300">דעת האויב — לא מייצג את עמדתי</span>
                </div>
              )}
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
              {/* Metadata chips — redesigned: pill style, consistent height, RTL order */}
              {(() => {
                const transcriptChip = (() => {
                  const s = video.transcriptStatus;
                  if (!s) return null;
                  if (s === 'youtube') return { isYt: true, label: 'תמלול', ok: true };
                  if (s === 'manual') return { icon: '✅', label: 'תמלול ידני', ok: true };
                  if (['none', 'found_empty_body', 'no_caption_tracks', 'unavailable'].includes(s)) return { icon: '❌', label: 'אין תמלול', ok: false };
                  if (s === 'missing_timestamps') return { icon: '⚠️', label: 'תמלול חלקי', ok: null };
                  if (s === 'too_short') return { icon: '⚠️', label: 'תמלול קצר', ok: null };
                  return null;
                })();
                const ytLogo = (
                  <svg viewBox="0 0 90 63" xmlns="http://www.w3.org/2000/svg" className="h-3 w-[17px] rounded-[2px] shrink-0">
                    <rect width="90" height="63" rx="13" fill="#FF0000"/>
                    <path d="M37 16L63 31.5L37 47V16Z" fill="white"/>
                  </svg>
                );
                const viewCountShort = viewCountFormatted
                  ? viewCountFormatted.replace(/\s*צפיות\s*/g, '').replace(/\s*views\s*/gi, '').trim()
                  : null;
                const BASE = "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium leading-none whitespace-nowrap transition-all duration-150 shadow-sm";
                const DEF  = "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";
                const MUTED = "border-slate-200 bg-slate-50/80 text-slate-600 hover:bg-white dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300";
                // Hide gem chip when main category already conveys the same information
                const gemHiddenByCategory = (() => {
                  const cat = videoTopics[0]?.name || '';
                  if (!cat || !effectiveGemInfo?.gemKey) return false;
                  const kmap = {
                    political:   ['פוליטי', 'פוליטיקה'],
                    fundamental: ['שוק', 'פיננסי', 'FinTech'],
                    technical:   ['שוק', 'טכני'],
                    macro:       ['שוק', 'מאקרו'],
                    appBuilder:  ['AI', 'טכנולוגיה', 'פיתוח'],
                    news:        ['חדשות', 'מבזק'],
                  };
                  return (kmap[effectiveGemInfo.gemKey] || []).some(kw => cat.includes(kw));
                })();
                const hasAnyChip = !!(effectiveGemInfo || video.publishedAt || currentCustomSubtitle || videoDuration || viewCountShort || videoYtId || transcriptChip || videoTopics[0]?.name || resolvedVideoMode.category);
                if (!hasAnyChip && !hasStoredTranscript) return null;
                return (
                  <div className="flex flex-wrap gap-2 pt-1.5 items-center" dir="rtl">
                    {/* ── Field 1: נושא (editable category picker) ── */}
                    <button
                      type="button"
                      onClick={(e) => {
                        setCategoryPillAnchorEl(e.currentTarget);
                        setIsCategoryPillEditing(true);
                      }}
                      className={cn(
                        `${BASE} ${MUTED}`,
                        isCategoryPillEditing && "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700/60 dark:bg-indigo-950/30 dark:text-indigo-300"
                      )}
                      title="ערוך נושא ראשי"
                    >
                      <span className="text-[9px] font-semibold text-slate-400 dark:text-zinc-500 leading-none">נושא</span>
                      <span className="w-px h-3.5 bg-slate-200 dark:bg-zinc-700 shrink-0" />
                      <span className="text-[10px] leading-none">📂</span>
                      <span className={cn(!videoTopics[0]?.name && !resolvedVideoMode.category && "italic text-slate-400 dark:text-zinc-500",
                                        !videoTopics[0]?.name && resolvedVideoMode.category && "text-slate-400 dark:text-zinc-500")}>
                        {videoTopics[0]?.name || resolvedVideoMode.category || "בחר נושא..."}
                      </span>
                    </button>
                    {isCategoryPillEditing && (
                      <SubTopicPillDropdown
                        anchorEl={categoryPillAnchorEl}
                        options={pillCategoriesOptions}
                        value={videoTopics[0]?.name || ""}
                        vaultPath={obsidianSettings.vaultPath || ""}
                        onSelect={(name) => {
                          const topicRule = getTopicRule(name);
                          const obsidianTopic = topicRule?.obsidianPrimary ?? null;
                          saveVideoFields({
                            category: name,
                            subCategory: "",
                            ...(obsidianTopic ? { obsidianTopic } : {}),
                          });
                          setSubCategoryOverride("");
                          toast.success(`נושא עודכן: ${name}`);
                          setIsCategoryPillEditing(false);
                          setCategoryPillAnchorEl(null);
                        }}
                        onCancel={() => {
                          setIsCategoryPillEditing(false);
                          setCategoryPillAnchorEl(null);
                        }}
                      />
                    )}
                    {/* ── Field 2: תת-נושא (searchable dropdown picker) ── */}
                    <button
                      type="button"
                      onClick={(e) => {
                        setPillAnchorEl(e.currentTarget);
                        setSubTopicDraft(effectiveSubTopicDisplay || subTopicRec?.recommended || "");
                        setIsSubTopicPillEditing(true);
                      }}
                      className={cn(
                        `${BASE} ${MUTED}`,
                        isSubTopicPillEditing && "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700/60 dark:bg-indigo-950/30 dark:text-indigo-300"
                      )}
                      title="ערוך תת-נושא"
                    >
                      <span className="text-[9px] font-semibold text-slate-400 dark:text-zinc-500 leading-none">תת-נושא</span>
                      <span className="w-px h-3.5 bg-slate-200 dark:bg-zinc-700 shrink-0" />
                      <span className="text-[10px] leading-none">🏷️</span>
                      <span className={cn(!effectiveSubTopicDisplay && "text-slate-400 italic dark:text-zinc-500")}>
                        {effectiveSubTopicDisplay || "הוסף תת-נושא..."}
                      </span>
                      {isSubTopicAiRec && (
                        <span className="text-[8px] font-bold text-amber-500 leading-none shrink-0">AI</span>
                      )}
                    </button>
                    {isSubTopicPillEditing && (
                      <SubTopicPillDropdown
                        anchorEl={pillAnchorEl}
                        options={pillSubtopicsWithCounts}
                        value={subTopicDraft}
                        topicName={effectiveCategory || resolvedVideoMode.category || ""}
                        vaultPath={obsidianSettings.vaultPath || ""}
                        onSelect={(name) => {
                          setSubTopicDraft(name);
                          setSubCategoryOverride(name);
                          saveVideoFields({ subCategory: name });
                          toast.success(`תת-נושא נשמר: ${name}`);
                          setIsSubTopicPillEditing(false);
                          setPillAnchorEl(null);
                        }}
                        onCancel={() => {
                          setIsSubTopicPillEditing(false);
                          setSubTopicDraft(effectiveSubTopicDisplay);
                          setPillAnchorEl(null);
                        }}
                      />
                    )}
                    {/* ── Field 3: כותרת (optional) ─────────────────── */}
                    {isSubtitleEditing ? (
                      <span
                        className={`${BASE} ${DEF} max-w-full sm:max-w-[320px]`}
                        title="כותרת / תת-תת-נושא (אופציונלי)"
                      >
                        <span className="text-[9px] font-semibold text-slate-400 dark:text-zinc-500 leading-none">כותרת</span>
                        <span className="w-px h-3.5 bg-slate-200 dark:bg-zinc-700 shrink-0" />
                        <span className="text-xs leading-none">✏️</span>
                        <input
                          type="text"
                          value={subtitleDraft}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setSubtitleDraft(nextValue);
                            console.log("[VideoHeader] Subtitle updated:", nextValue);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleSubtitleSave();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setSubtitleDraft(currentCustomSubtitle);
                              setIsSubtitleEditing(false);
                            }
                          }}
                          placeholder="הוסף תת-כותרת"
                          autoFocus
                          className="min-w-[120px] max-w-[180px] bg-transparent text-sm font-medium outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                        />
                        <button
                          type="button"
                          onClick={handleSubtitleSave}
                          disabled={isSubtitleSaving}
                          className="inline-flex items-center justify-center rounded-md text-emerald-600 transition hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-400"
                          title="שמור תת-כותרת"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSubtitleDraft(currentCustomSubtitle);
                            setIsSubtitleEditing(false);
                          }}
                          className="inline-flex items-center justify-center rounded-md text-slate-400 transition hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                          title="בטל עריכה"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsSubtitleEditing(true)}
                        className={`${BASE} ${DEF} max-w-full sm:max-w-[320px]`}
                        title="כותרת / תת-תת-נושא (אופציונלי)"
                      >
                        <span className="text-[9px] font-semibold text-slate-400 dark:text-zinc-500 leading-none">כותרת</span>
                        <span className="w-px h-3.5 bg-slate-200 dark:bg-zinc-700 shrink-0" />
                        <span className="text-xs leading-none">📝</span>
                        <span className={cn("truncate", !currentCustomSubtitle && "text-slate-500 dark:text-zinc-400")}>
                          {subtitleDisplayValue}
                        </span>
                      </button>
                    )}
                    {/* Date — YouTube publish date, relative if recent; falls back to analysis date */}
                    {videoPublishDisplay && (
                      <span className={`${BASE} ${DEF} gap-x-1`} title={videoPublishDisplay.title}>
                        <span className="text-xs leading-none">{videoPublishDisplay.icon}</span>
                        <span>{videoPublishDisplay.label}</span>
                        {videoPublishDisplay.canRepair && videoYtId && (
                          <button
                            type="button"
                            onClick={handleRepairPublishDate}
                            disabled={isRepairingDate}
                            title="רענן תאריך פרסום מ-YouTube"
                            className="text-[11px] text-indigo-400 hover:text-indigo-600 dark:text-indigo-500 dark:hover:text-indigo-400 leading-none disabled:opacity-40 transition-colors"
                          >
                            {isRepairingDate ? '…' : '↻'}
                          </button>
                        )}
                      </span>
                    )}
                    {/* Duration */}
                    {videoDuration && (
                      <span className={`${BASE} ${DEF}`}>
                        <span className="text-xs leading-none">⏱️</span>
                        <span>{videoDuration}</span>
                      </span>
                    )}
                    {/* Views */}
                    {viewCountShort && (
                      <span className={`${BASE} ${DEF}`}>
                        <span className="text-xs leading-none">👁️</span>
                        <span>{viewCountShort}</span>
                      </span>
                    )}
                    {/* YouTube link */}
                    {videoYtId && (
                      <a
                        href={`https://www.youtube.com/watch?v=${videoYtId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${BASE} border-red-200/60 bg-white text-slate-600 hover:border-red-300 hover:bg-red-50/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-red-700/50`}
                      >
                        {ytLogo}
                        <span>YouTube</span>
                      </a>
                    )}
                    {/* Mentor channel link */}
                    {mentorChannelUrl && (
                      <a
                        href={mentorChannelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${BASE} border-indigo-200/60 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-700/50`}
                        title="פתח את ערוץ המנטור ביוטיוב"
                      >
                        <span className="text-xs leading-none">📺</span>
                        <span>ערוץ המנטור</span>
                      </a>
                    )}
                    {/* Transcript status */}
                    {transcriptChip && (
                      <span className={`${BASE} ${
                        transcriptChip.ok === true
                          ? 'border-emerald-200/80 bg-emerald-50/50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300'
                          : transcriptChip.ok === false
                            ? 'border-red-200/70 bg-red-50/40 text-red-600 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-400'
                            : 'border-amber-200/80 bg-amber-50/50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300'
                      }`}>
                        {transcriptChip.isYt ? <>{ytLogo}<span>{transcriptChip.label}</span></> : <><span className="text-xs leading-none">{transcriptChip.icon}</span><span>{transcriptChip.label}</span></>}
                      </span>
                    )}
                    {/* Obsidian saved */}
                    {isObsidianMappingCurrent && (
                      <span className={`${BASE} border-emerald-200/80 bg-emerald-50/50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300`}>
                        <span className="text-xs leading-none">✅</span>
                        <span>Obsidian</span>
                      </span>
                    )}
                    {/* Attached Documents badge */}
                    {attachedDocuments.length > 0 && video.contentType !== "pdf" && (
                      <button
                        type="button"
                        onClick={() => setAttachedDocsExpanded(v => !v)}
                        className={`${BASE} border-orange-200/80 bg-orange-50/50 text-orange-700 dark:border-orange-800/40 dark:bg-orange-950/30 dark:text-orange-300`}
                      >
                        <span className="text-xs leading-none">📎</span>
                        <span className="font-semibold">{attachedDocuments.length} {attachedDocuments.length === 1 ? 'מסמך מצורף' : 'מסמכים מצורפים'}</span>
                        <span className="text-[10px] opacity-60">{attachedDocsExpanded ? '▲' : '▼'}</span>
                      </button>
                    )}
                    {/* Delete transcript — soft red, always last */}
                    {hasStoredTranscript && (
                      <button
                        type="button"
                        onClick={handleDeleteTranscript}
                        className={`${BASE} border-rose-200/60 bg-white text-rose-500 hover:bg-rose-50/80 hover:border-rose-300 active:scale-95 dark:border-rose-800/30 dark:bg-zinc-900 dark:text-rose-400`}
                      >
                        <span className="text-xs leading-none">🧹</span>
                        <span>מחק תמלול</span>
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
            {(resolvedVideoMode.mode === "market" && (vaultSubtopics.length > 0 || isSubTopicEditing)) && (
              <div className="px-4 pb-2" dir="rtl">
                {isSubTopicEditing ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900/70">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">תת-נושא Obsidian</span>
                      <select
                        value={subTopicDraft || ""}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setSubTopicDraft(nextValue);
                          setIsCreatingSubTopic(nextValue === NEW_SUBTOPIC_SENTINEL);
                        }}
                        className="min-w-[180px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                      >
                        <option value="">בחר תת-נושא...</option>
                        {vaultSubtopics.map((topic) => (
                          <option key={topic.id} value={topic.name}>
                            {topic.name}{topic.isCustom ? " ✦" : ""}
                          </option>
                        ))}
                        <option value={NEW_SUBTOPIC_SENTINEL}>+ צור תת-נושא חדש</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleSaveSubTopicSelection}
                        className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                      >
                        שמור
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSubTopicEditing(false);
                          setIsCreatingSubTopic(false);
                          setNewSubTopicDraft("");
                          setSubTopicDraft(selectedSubTopicName || "");
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                      >
                        בטל
                      </button>
                    </div>
                    {isCreatingSubTopic && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={newSubTopicDraft}
                          onChange={(event) => setNewSubTopicDraft(event.target.value)}
                          placeholder="הקלד תת-נושא חדש..."
                          className="min-w-[180px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                        />
                        <button
                          type="button"
                          onClick={handleCreateCustomSubTopic}
                          className="rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-600"
                        >
                          צור ושמור
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                    <span>יעד שמירה ב-Obsidian:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSubTopicDraft(selectedSubTopicName || subTopicRec?.recommended || vaultSubtopics[0]?.name || "");
                        setIsSubTopicEditing(true);
                      }}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                    >
                      {currentObsidianDestinationLabel || "בחר תת-נושא"}
                    </button>
                  </div>
                )}
                <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/60 px-3 py-2.5 text-[11px] text-right dark:border-violet-800/40 dark:bg-violet-950/20" dir="rtl">
                  <div className="font-semibold text-violet-800 dark:text-violet-200">אבחון ניתוב Obsidian</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-violet-700 dark:text-violet-300">
                    <span><strong>קטגוריה:</strong> {obsidianRoutingDebug.category || "לא זוהתה"}</span>
                    <span><strong>תת-נושא:</strong> {obsidianRoutingDebug.subCategory || "לא זוהה"}</span>
                    <span><strong>תיקייה:</strong> {obsidianRoutingDebug.resolvedFolder || "לא נפתרה"}</span>
                    <span><strong>קובץ:</strong> {obsidianRoutingDebug.finalFilePath || "לא תקין"}</span>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[10px] font-semibold text-violet-600 dark:text-violet-300">
                      Obsidian Routing Debug
                    </summary>
                    <div className="mt-2 grid gap-1 text-[10px] text-violet-700 dark:text-violet-300">
                      <span><strong>normalizedSubCategory:</strong> {obsidianRoutingDebug.normalizedSubCategory || "—"}</span>
                      <span><strong>tabsKey:</strong> {selectedTabsConfigKey || "—"}</span>
                      <span><strong>activeTab:</strong> {activeTab || "—"}</span>
                      <span><strong>activeVault:</strong> {obsidianRoutingDebug.activeVault || "—"} ({obsidianRoutingDebug.sourceOfActiveVault || "—"})</span>
                      <span><strong>vaultName:</strong> {obsidianRoutingDebug.vaultName || "—"}</span>
                      <span><strong>finalFilePath:</strong> {obsidianRoutingDebug.finalFilePath || "—"}</span>
                      <span className="break-all"><strong>obsidian:// URL:</strong> {obsidianRoutingDebug.obsidianUrl || "—"}</span>
                    </div>
                  </details>
                </div>
              </div>
            )}
            {/* ── Attached Documents Panel (expandable, YouTube-only) ── */}
            {attachedDocsExpanded && video.contentType !== "pdf" && (
              <div className="px-4 py-3 border-b border-orange-100 dark:border-orange-900/30 bg-orange-50/50 dark:bg-orange-950/10" dir="rtl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
                    <span>📎</span>
                    <span>מסמכים מצורפים ({attachedDocuments.length})</span>
                  </span>
                  <PdfUploader onDocumentCreated={handleAttachPdf} />
                </div>
                {attachedDocuments.length === 0 ? (
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">אין מסמכים מצורפים עדיין</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {attachedDocuments.map(doc => (
                      <div key={doc.id} className="flex items-center gap-2 rounded-xl border border-orange-200 bg-white/80 px-2.5 py-1.5 dark:border-orange-800/30 dark:bg-zinc-900/60">
                        <span className="text-sm shrink-0">📄</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-semibold text-slate-800 dark:text-zinc-100 truncate">{doc.name}</div>
                          <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                            {doc.pages ? `${doc.pages} עמ׳` : ''}{doc.pages && doc.transcript ? ' · ' : ''}{doc.transcript ? `${Math.round(doc.transcript.length / 1000)}K תווים` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachedDoc(doc.id)}
                          className="shrink-0 text-slate-400 hover:text-red-500 transition-colors"
                          title="הסר מסמך"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Quick Actions ── */}
            <div className="px-4 py-2 border-b border-slate-100 dark:border-zinc-800">
              <div className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80" dir="rtl">
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="h-3 w-3 text-amber-500 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-400">⚡ פעולות מהירות</span>
                </div>
                {/* Primary actions — grid fills full width */}
                <div className="grid grid-cols-7 gap-2 mb-2">
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
                      cn: 'text-red-700 dark:text-red-300',
                      onClick: handleYtApiTranscript,
                      disabled: isCheckingTranscript,
                      status: { ok: hasStoredTranscript, okLabel: 'קיים', failLabel: 'אין תמלול' },
                    },
                    {
                      id: 'gem-recommended',
                      emoji: effectiveGemInfo?.gemIcon || '✨',
                      label: 'Gem מומלץ',
                      sub: recommendedGemCardLabel,
                      labelCn: 'text-[11px] font-bold leading-snug',
                      subCn: 'text-[10px] font-semibold leading-snug opacity-80',
                      cn: 'text-amber-700 dark:text-amber-300',
                      onClick: () => setShowGemModal(true),
                      status: { ok: !!(effectiveGemInfo && getGemUrl(effectiveGemInfo.gemKey)), okLabel: 'מוגדר', failLabel: 'לא מוגדר' },
                    },
                    {
                      id: 'gems',
                      emoji: '💎',
                      label: 'GEMS JSON',
                      sub: gemsJsonApplied ? 'JSON תקין' : 'הדבק JSON',
                      cn: 'text-violet-700 dark:text-violet-300',
                      onClick: () => { setIsGemsPasteOpen(true); setGemsPasteError(""); setGemsPasteInput(""); },
                      status: gemsJsonApplied
                        ? { ok: true,  okLabel: 'נטען', failLabel: '' }
                        : { ok: false, okLabel: '', failLabel: 'לא נטען' },
                    },
                    {
                      id: 'save-brain',
                      emoji: '💾',
                      label: 'שמור למוח',
                      sub: currentBrainDestinationLabel,
                      cn: 'text-emerald-700 dark:text-emerald-300',
                      onClick: handleSaveAllToBrain,
                      status: { ok: isCurrentBrainSave, okLabel: 'נשמר', failLabel: 'לא נשמר' },
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
                      sub: currentObsidianDestinationLabel,
                      cn: 'text-purple-700 dark:text-purple-300',
                      onClick: () => {
                        const isSaved = isObsidianMappingCurrent;
                        if (!isSaved) { toast.warning('קודם יש לשמור ל-Obsidian לפני פתיחת הקובץ'); return; }
                        const targetPath = resolvedObsidianSavedPath;
                        openResolvedObsidianPath(targetPath);
                      },
                      status: { ok: isObsidianMappingCurrent, okLabel: 'נשמר', failLabel: 'לא נשמר' },
                    },
                    {
                      id: 'transcript-view',
                      emoji: '📋',
                      label: 'תמלול הסרט',
                      sub: hasStoredTranscript ? 'הצג תמלול' : 'הדבק תמלול',
                      cn: 'text-teal-700 dark:text-teal-300',
                      onClick: () => setActiveTab("transcript"),
                      status: { ok: hasStoredTranscript, okLabel: 'תמלול קיים', failLabel: 'אין תמלול' },
                    },
                    {
                      id: 'workspace',
                      emoji: '💼',
                      label: 'Workspace',
                      sub: currentWorkspaceDestinationLabel,
                      cn: 'text-indigo-700 dark:text-indigo-300',
                      onClick: isInWorkspaceLib && isWorkspaceMappingCurrent ? handleOpenInWorkspace : () => setWorkspaceSaveOpen(true),
                      status: { ok: isWorkspaceMappingCurrent, okLabel: 'נשמר', failLabel: 'לא נשמר' },
                    },
                  ].map(({ id, emoji, label, sub, cn, onClick, disabled, status, labelCn, subCn }) => (
                    <button key={id} type="button" onClick={onClick} disabled={disabled}
                      className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2 w-full text-center transition-all hover:shadow-sm active:scale-95 disabled:opacity-40 ${
                        status?.ok
                          ? 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-700/50 dark:hover:bg-emerald-900/40'
                          : 'bg-white border-slate-200 hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800'
                      } ${cn}`}>
                      <span className="flex items-center justify-center h-5 leading-none">
                        {typeof emoji === 'string' ? <span className="text-lg">{emoji}</span> : emoji}
                      </span>
                      <span className={labelCn || "text-[10px] font-semibold leading-snug"}>{label}</span>
                      <span className={subCn || "text-[9px] opacity-55 leading-snug"}>{sub}</span>
                      {status && (
                        <span className={`mt-1 inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                          status.ok
                            ? 'border-emerald-400 bg-emerald-100 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300'
                            : 'border-slate-300 bg-slate-100 text-slate-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}>
                          <span className="text-[9px]">{status.ok ? '✅' : '○'}</span>
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
                      id: 'fresh-reimport',
                      emoji: '🧹',
                      label: isFreshImportRunning ? 'מייבא מחדש...' : 'מחק היסטוריה ונתח מחדש',
                      cn: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300',
                      onClick: handleFreshImportReset,
                      disabled: isFreshImportRunning || isAnalyzing || isReanalyzing,
                    },
                    {
                      id: 'markdown',
                      emoji: '📄',
                      label: 'יצוא MD',
                      cn: 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
                      onClick: () => {
                        const note = buildVideoFullNote(video, mentorName, null, videoNotes, [], { opponentSentences });
                        downloadMarkdown(note.content, `${(video.title || 'video').replace(/[^\w\sא-ת]/g, '').trim().slice(0, 50)}.md`);
                      },
                    },
                  ].map(({ id, emoji, label, cn, onClick, disabled }) => (
                    <button key={id} type="button" onClick={onClick} disabled={disabled}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 transition-all hover:shadow-sm active:scale-95 disabled:opacity-40 text-[11px] font-medium ${cn}`}>
                      <span className="text-xs leading-none">{emoji}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                  {/* Attach PDF button — for YouTube videos only */}
                  {video.contentType !== "pdf" && (
                    <PdfUploader onDocumentCreated={handleAttachPdf} />
                  )}
                  {/* DEV: AI Mapping tool */}
                  {import.meta.env.DEV && (
                    <button
                      type="button"
                      onClick={() => setShowAiMapping(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 transition-all hover:bg-violet-100 hover:shadow-sm active:scale-95 dark:border-violet-800/40 dark:bg-violet-950/20 dark:text-violet-300"
                    >
                      <span className="text-xs leading-none">🗺️</span>
                      <span>AI Mapping</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Main Content: Sidebar + Tabs ── */}
            <PanelErrorBoundary>
            <div className="flex gap-4 items-start px-4 pt-2 pb-4 max-lg:flex-col max-lg:w-full max-lg:max-w-full max-lg:min-w-0 max-lg:overflow-x-hidden" dir="rtl">

              {/* ── SIDEBAR ── */}
              <div className="w-[340px] shrink-0 flex flex-col gap-3 self-start sticky top-0 max-lg:w-full max-lg:max-w-full max-lg:static max-lg:overflow-x-hidden">
              {/* ── Video Thumbnail Card / PDF Document Card ── */}
              {video.contentType === "pdf" ? (
                <PdfDocumentCard video={video} />
              ) : (
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
              )}
              {/* ── Notes Card ── */}
              <div className="rounded-2xl border border-amber-200 bg-white/90 shadow-sm dark:border-amber-900/40 dark:bg-zinc-900/80 text-right overflow-hidden" dir="rtl">
                <div className="px-4 pt-3 pb-1 text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span className="text-base">📝</span>
                  <span>הערות</span>
                  {videoNotes.length > 0 && (
                    <span className="mr-auto text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/40 rounded-full px-2 py-0.5">
                      {videoNotes.length} הערות
                    </span>
                  )}
                </div>
                <div className="px-4 pb-2 pt-1 text-xs text-slate-500 dark:text-zinc-400">
                  {videoNotes.length === 0 ? "אין הערות עדיין" : `${videoNotes.length} הערות שמורות`}
                </div>
                <div className="px-4 pb-3">
                  <button
                    type="button"
                    onClick={() => { prevTabRef.current = activeTab !== "notes" ? activeTab : prevTabRef.current; setActiveTab("notes"); }}
                    className="w-full h-8 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 active:scale-95 transition-all shadow-sm flex-row-reverse"
                  >
                    📝 פתח הערות
                  </button>
                </div>
              </div>

              {/* ── NotebookLM Card ── */}
              {(() => {
                const nlmUrl = getWatchUrl(video);
                const hasUrl = !!nlmUrl;
                const buildMarkdown = () => [
                  `# ${video.title}`,
                  video.channelTitle ? `מנטור: ${video.channelTitle}` : null,
                  nlmUrl ? `קישור: ${nlmUrl}` : null,
                  video.shortSummary ? `\n## סיכום\n${video.shortSummary}` : null,
                  Array.isArray(video.keyPoints) && video.keyPoints.length
                    ? `\n## נקודות מפתח\n${video.keyPoints.map(p => `• ${p}`).join('\n')}`
                    : null,
                ].filter(Boolean).join('\n');
                const handleOpen = () => {
                  if (!hasUrl) return;
                  navigator.clipboard.writeText(nlmUrl)
                    .then(() => toast.success("קישור הסרטון הועתק ✓"))
                    .catch(() => {});
                  window.open("https://notebooklm.google.com/", "_blank", "noopener,noreferrer");
                  toast.success("NotebookLM נפתח 🚀");
                };
                return (
                  <div className="rounded-2xl border border-violet-200 bg-white/90 shadow-sm dark:border-violet-900/40 dark:bg-zinc-900/80 text-right overflow-hidden" dir="rtl">
                    <div className="px-4 pt-3 pb-1 text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <span className="text-base">📓</span>
                      <span>NotebookLM</span>
                      <span className={`mr-auto text-[11px] font-medium rounded-full px-2 py-0.5 border ${
                        hasUrl
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-700/40"
                          : "text-slate-500 bg-slate-50 border-slate-200 dark:text-zinc-400 dark:bg-zinc-800/50 dark:border-zinc-700"
                      }`}>
                        {hasUrl ? "✅ URL זמין" : "❌ אין URL"}
                      </span>
                    </div>
                    <div className="px-4 py-3 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={handleOpen}
                        disabled={!hasUrl}
                        className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 active:scale-95 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex-row-reverse"
                      >
                        <span>🚀</span>
                        פתח ב-NotebookLM
                      </button>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={!hasUrl}
                          onClick={() => {
                            if (!hasUrl) return;
                            navigator.clipboard.writeText(nlmUrl).then(() => toast.success("URL הועתק ✓")).catch(() => {});
                          }}
                          className="flex-1 h-7 inline-flex items-center justify-center gap-1 rounded-lg border border-violet-200 text-violet-700 text-[11px] font-medium hover:bg-violet-50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed dark:border-violet-800/40 dark:text-violet-300"
                        >
                          📋 URL
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(buildMarkdown()).then(() => toast.success("Markdown הועתק ✓")).catch(() => {});
                          }}
                          className="flex-1 h-7 inline-flex items-center justify-center gap-1 rounded-lg border border-violet-200 text-violet-700 text-[11px] font-medium hover:bg-violet-50 active:scale-95 transition-all dark:border-violet-800/40 dark:text-violet-300"
                        >
                          📄 Markdown
                        </button>
                        <button
                          type="button"
                          disabled={!fullTranscriptText}
                          onClick={() => {
                            if (!fullTranscriptText) return;
                            navigator.clipboard.writeText(fullTranscriptText).then(() => toast.success("תמלול הועתק ✓")).catch(() => {});
                          }}
                          className="flex-1 h-7 inline-flex items-center justify-center gap-1 rounded-lg border border-violet-200 text-violet-700 text-[11px] font-medium hover:bg-violet-50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed dark:border-violet-800/40 dark:text-violet-300"
                        >
                          📚 תמלול
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── Manual Transcript Card ── */}
              <div className="rounded-2xl border border-teal-200 bg-white/90 shadow-sm dark:border-teal-900/40 dark:bg-zinc-900/80 text-right overflow-hidden" dir="rtl">
                <div className="px-4 pt-3 pb-2 text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span className="text-base">📋</span>
                  <span>תמלול ידני</span>
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
                  {/* Include attached PDFs checkbox */}
                  {attachedDocuments.length > 0 && video.contentType !== "pdf" && (
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-zinc-300 select-none flex-row-reverse" dir="rtl">
                      <input
                        type="checkbox"
                        checked={includeDocsInAnalysis}
                        onChange={e => setIncludeDocsInAnalysis(e.target.checked)}
                        className="accent-indigo-600 h-3.5 w-3.5"
                      />
                      <span>הכלל {attachedDocuments.length} {attachedDocuments.length === 1 ? 'מסמך מצורף' : 'מסמכים מצורפים'} בניתוח AI</span>
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => { setActiveTab("ai-analysis"); handleGeminiContent(); }}
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

              </div>{/* closes sidebar */}

              {/* ── MAIN CONTENT ── */}
              <div className="flex-1 min-w-0 w-full max-w-full overflow-hidden max-lg:w-full max-lg:max-w-full max-lg:min-w-0">
            {/* Error */}
            {video.status === "error" && video.errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-right">
                <p className="text-sm text-red-700">{video.errorMessage}</p>
              </div>
            )}

            {/* ── טאבים ── */}
            <UniversalTabBulkProvider
              activeTab={activeTab}
              multiSelected={multiSelected}
              toggleMultiSelect={toggleMultiSelect}
              multiSelectAll={multiSelectAll}
              multiSelectClear={multiSelectClear}
              bulkSelectionShare={bulkSelectionShare}
            >
            <Tabs id="analysis-tabs" value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0 max-w-full" dir="rtl">
              {/* ── Universal 7-tab bar — same for every video (Phase 1) ── */}
              <div className="w-full max-w-full min-w-0 overflow-hidden">
              <TabsList
                className="flex flex-nowrap justify-start rounded-2xl bg-slate-100/80 border border-slate-200 dark:bg-zinc-800/60 dark:border-zinc-700 p-1.5 gap-1 w-full max-w-full min-w-0 min-h-[52px] overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
                dir="rtl"
              >
                {UNIVERSAL_TABS.map(({ value, label, emoji }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="shrink-0 min-w-max lg:min-w-0 lg:flex-1 inline-flex h-11 min-h-[44px] items-center justify-center gap-1.5 rounded-[14px] px-5 sm:px-6 lg:px-5 xl:px-6 text-sm lg:text-[15px] leading-none font-medium transition-all duration-150
                      text-slate-600 dark:text-zinc-300
                      data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md data-[state=active]:font-semibold data-[state=active]:ring-1 data-[state=active]:ring-slate-200/90
                      dark:data-[state=active]:bg-zinc-700 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-[0_2px_10px_rgba(0,0,0,0.35)] dark:data-[state=active]:ring-zinc-600/60
                      hover:text-slate-800 hover:bg-white/60 dark:hover:text-zinc-100 dark:hover:bg-zinc-700/50"
                  >
                    <span>{emoji}</span>
                    <span>{label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              </div>

              <UniversalTabBulkToolbar />

              {/* ── Summary tab ── */}
              <TabsContent value="summary" className="mt-0 min-h-[320px]" dir="rtl">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-3 space-y-3 text-right">
                  {/* GEM RAW debug button */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsGemRawOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 dark:border-violet-700/50 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-900/40 transition-colors"
                      title="הצג את כל נתוני GEM שחולצו"
                    >
                      🔬 GEM RAW
                    </button>
                  </div>
                  {/* GEM summary card */}
                  {video?.gemSummary && (
                    <div className={SUMMARY_CARD_CLASS}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={SUMMARY_CARD_TITLE_CLASS}>📄 סיכום מ-GEM · {effectiveGemInfo?.gemLabel || 'GEM'}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(video.gemSummary).then(() => toast.success('הועתק'))}
                            className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                            title="העתק"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setGemPasteOpen(true); setGemPasteText(video.gemSummary || ""); }}
                            className="text-[10px] text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                            title="ערוך"
                          >
                            ✏
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-800 dark:text-zinc-200 leading-7 whitespace-pre-wrap text-right">{video.gemSummary}</p>
                    </div>
                  )}
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
                  console.log('[SummaryTab] active video id:', video?.id || video?.youtubeId);
                  console.log('[SummaryTab] political summary exists:', !!politicalSummary);
                  console.log('[SummaryTab] summary candidates:', JSON.stringify({ shortSummary: !!video?.shortSummary, summary: !!video?.summary, aiSummary: !!video?.aiSummary, aiSummaryShort: !!enrichedVideo?.aiSummaryShort }));

                  // ── Political summary branch ──────────────────────────────
                  if (isPoliticalVideo) {
                    const hasTranscript = fullTranscriptText && fullTranscriptText.trim().length >= 100;

                    if (!hasTranscript && !politicalSummary) {
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
                      const _genSummary = (
                        video?.shortSummary ||
                        video?.summary ||
                        video?.aiSummary ||
                        video?.brainSummary ||
                        video?.analysisSummary ||
                        enrichedVideo?.aiSummaryShort
                      )?.replace(/\[MOCK\]\s*/g, '');
                      console.log('[SummaryTab] selected summary source:', _genSummary ? 'general' : 'none');
                      console.log('[SummaryTab] selected summary content length:', _genSummary?.length ?? 0);
                      console.log('[SummaryTab] rendering empty state:', !_genSummary);
                      return (
                        <div className="mt-3 space-y-3" dir="rtl">
                          {_genSummary && (
                            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                              <p className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 mb-2 text-right">סיכום כללי</p>
                              <p className="text-sm text-slate-800 dark:text-zinc-200 leading-7 text-right">{_genSummary}</p>
                            </div>
                          )}
                          <div className="flex min-h-[140px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 py-6 text-center dark:border-blue-700/40 dark:bg-blue-950/20">
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
                        </div>
                      );
                    }

                    // ── Render 10-section political summary ──────────────
                    // Build display object: prefer nested politicalSummary, fallback from other fields, or old format
                    console.log('[GEMS Parse] rendering political summary — keys:', Object.keys(politicalSummary || {}).join(', '));
                    let _psDisplay = null;
                    try {
                    if (politicalSummary?.politicalSummary) {
                      // Branch 1: nested { politicalSummary: { ... } }
                      _psDisplay = politicalSummary.politicalSummary;
                    } else if (politicalSummary && (
                      politicalSummary.keyInsights?.length ||
                      politicalSummary.arguments?.length ||
                      politicalSummary.knowledgePoints?.length ||
                      politicalSummary.viralQuotes?.length
                    )) {
                      // Branch 2: old flat format with keyInsights / arguments
                      _psDisplay = {
                        shortSummary: politicalSummary.keyInsights?.[0] || '',
                        mainClaim: politicalSummary.arguments?.[0] || politicalSummary.mainClaim || politicalSummary.mainArgument || '',
                        keyPoints: politicalSummary.knowledgePoints?.slice(0, 8) || [],
                        actorsMap: { speakers: [], attackedGroups: [], defendedGroups: [], targetAudience: [] },
                        supportingArguments: politicalSummary.arguments || [],
                        weaknessesAndCounterpoints: politicalSummary.counterArguments || [],
                        usefulQuotes: politicalSummary.viralQuotes || [],
                        emotionalFraming: [],
                        practicalUse: politicalSummary.debateResponses || [],
                        bottomLine: politicalSummary.keyInsights?.at?.(-1) || '',
                        context: politicalSummary.context || '',
                        conclusion: politicalSummary.conclusion || '',
                        implications: Array.isArray(politicalSummary.implications) ? politicalSummary.implications : [],
                      };
                    } else if (politicalSummary) {
                      // Branch 3: any politicalSummary object (including direct GEMS JSON)
                      const _pu = politicalSummary.practicalUse;
                      _psDisplay = {
                        shortSummary: politicalSummary.shortOverview || politicalSummary.shortSummary || politicalSummary.summary || '',
                        mainClaim: politicalSummary.mainClaim || politicalSummary.mainArgument || '',
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
                        context: politicalSummary.context || '',
                        conclusion: politicalSummary.conclusion || '',
                        implications: Array.isArray(politicalSummary.implications) ? politicalSummary.implications : [],
                      };
                    }
                    } catch (_psErr) {
                      console.error('[psDisplay] computation error:', _psErr.message);
                      _psDisplay = null;
                    }
                    // Normalize: merge alternate field names from any branch
                    // _toArr ensures any field that should be an array actually is one (AI sometimes returns strings)
                    const _toArr = (v) => Array.isArray(v) ? v : (v ? (typeof v === 'string' ? v.split(/[,،\n]+/).map(s => s.trim()).filter(Boolean) : [v]) : []);
                    const ps = _psDisplay ? {
                      ..._psDisplay,
                      mainClaim: _psDisplay.mainClaim || _psDisplay.mainArgument || '',
                      context: _psDisplay.context || '',
                      conclusion: _psDisplay.conclusion || '',
                      keyPoints: _toArr(_psDisplay.keyPoints),
                      supportingArguments: _toArr(_psDisplay.supportingArguments),
                      weaknessesAndCounterpoints: _toArr(_psDisplay.weaknessesAndCounterpoints),
                      usefulQuotes: _toArr(_psDisplay.usefulQuotes),
                      emotionalFraming: _toArr(_psDisplay.emotionalFraming),
                      practicalUse: _toArr(_psDisplay.practicalUse),
                      implications: _toArr(_psDisplay.implications),
                    } : null;
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
                    const PCard = ({ title, icon, saveKey, saveContent, children }) => {
                      const isSaved = saveKey ? !!savedPsSections[saveKey] : false;
                      const dropIsOpen = psCardDropOpen === saveKey;
                      return (
                        <div data-section={title} className={SUMMARY_CARD_CLASS} dir="rtl">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-base leading-none">{icon}</span>
                              <span className={SUMMARY_CARD_TITLE_CLASS}>{title}</span>
                            </div>
                            {saveKey && (isSaved
                              ? <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">✅ נשמר</span>
                              : <div className="relative" data-pcard-drop>
                                  <button
                                    type="button"
                                    onClick={() => setPsCardDropOpen(dropIsOpen ? null : saveKey)}
                                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border transition-colors ${dropIsOpen ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300' : 'border-transparent text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 dark:hover:text-indigo-300 dark:hover:bg-indigo-950/30'}`}
                                  >
                                    🧠 שמור ▾
                                  </button>
                                  {dropIsOpen && (
                                    <div data-pcard-drop className="absolute left-0 top-full mt-1 z-50 min-w-[150px] rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-950 overflow-hidden">
                                      {[
                                        { dest: 'brain', label: '🧠 שמור למוח' },
                                        { dest: 'obsidian' },
                                        { dest: 'workspace', label: '⭐ שמור ל-Workspace' },
                                        ...(isPoliticalVideo ? [{ dest: 'opponent', label: '⚔️ דעת האויב', red: true }] : []),
                                      ].map(({ dest, label, red }) => (
                                        <button
                                          key={dest}
                                          type="button"
                                          onClick={() => { handleSavePsSectionTo(saveKey, title, saveContent, dest); setPsCardDropOpen(null); }}
                                          className={`flex w-full items-center gap-2 px-3 py-2 text-xs text-right transition-colors ${red ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20' : 'text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-900'}`}
                                        >
                                          {dest === 'obsidian' ? <ObsidianSaveLabel /> : label}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                            )}
                          </div>
                          {children}
                        </div>
                      );
                    };
                    return (
                      <PoliticalTabBoundary>
                      {/* Text selection save menu */}
                      {textSaveMenu && (
                        <SummaryTextSaveMenu
                          coords={textSaveMenu.coords}
                          text={textSaveMenu.text}
                          sectionLabel={textSaveMenu.sectionLabel}
                          isPolitical={isPoliticalVideo}
                          onSave={(dest) => handleSummaryTextSave(textSaveMenu.text, textSaveMenu.sectionLabel, dest)}
                          onClose={() => setTextSaveMenu(null)}
                        />
                      )}
                      <TabBulkItemsRegistrar tab="summary" items={buildPoliticalSummaryBulkItems(ps)} />
                      <div className="mt-3 space-y-3" dir="rtl" onMouseUp={handleSummaryMouseUp}>
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
                              { k: 'context', l: 'הקשר', c: ps.context },
                              { k: 'conclusion', l: 'מסקנה', c: ps.conclusion },
                              { k: 'implications', l: 'השלכות', c: ps.implications },
                            ].filter(s => s.c && (typeof s.c === 'string' ? s.c.trim() : (Array.isArray(s.c) ? s.c.length > 0 : false)));
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
                              ps.context && `## הקשר\n${ps.context}`,
                              ps.conclusion && `## מסקנה\n${ps.conclusion}`,
                              ps.implications?.length && `## השלכות\n${ps.implications.map((imp, i) => `${i + 1}. ${safeStr(imp)}`).join('\n')}`,
                            ].filter(Boolean).join('\n\n');
                            const md = `# ניתוח פוליטי — ${video?.title || ''}\n\n${lines}`;
                            downloadMarkdown(md, `political-${video?.youtubeId || video?.id || 'summary'}.md`);
                          }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">💾 Obsidian</button>
                        </div>

                        {/* 1. תקציר קצר */}
                        {ps.shortSummary && <PCard title="תקציר קצר" icon="📝" saveKey="shortSummary" saveContent={ps.shortSummary}>
                          <p className="text-sm text-slate-800 dark:text-zinc-200 leading-7">{ps.shortSummary}</p>
                        </PCard>}

                        {/* 2. הטענה המרכזית */}
                        {ps.mainClaim && <PCard title="הטענה המרכזית" icon="🎯" saveKey="mainClaim" saveContent={ps.mainClaim}>
                          <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 leading-relaxed">{ps.mainClaim}</p>
                        </PCard>}

                        {/* 3. נקודות מרכזיות */}
                        {ps.keyPoints?.length > 0 && <PCard title="נקודות מרכזיות" icon="📌" saveKey="keyPoints" saveContent={ps.keyPoints}>
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
                        {ps.actorsMap && <PCard title="מי נגד מי" icon="⚔️">
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { label: 'הדובר/ים', value: ps.actorsMap.speakers, icon: '🎤' },
                              { label: 'מי מותקף', value: ps.actorsMap.attackedGroups, icon: '🎯' },
                              { label: 'מי מוגן', value: ps.actorsMap.defendedGroups, icon: '🛡️' },
                              { label: 'קהל יעד', value: ps.actorsMap.targetAudience, icon: '👥' },
                            ].map(({ label, value, icon: aIcon }) => {
                              const _arrToStr = (v) => Array.isArray(v) ? v.map(x => typeof x === 'string' ? x : String(x?.text || x?.name || x || '')).filter(Boolean).join(', ') : null;
                              const display = Array.isArray(value) ? _arrToStr(value) : (typeof value === 'string' ? value : null);
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
                          {ps.supportingArguments?.length > 0 && <PCard title="טיעונים בעד" icon="✅" saveKey="supportingArguments" saveContent={ps.supportingArguments}>
                            <ul className="space-y-1">
                              {ps.supportingArguments.map((a, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-emerald-800 dark:text-emerald-200 leading-snug">
                                  <span className="shrink-0 mt-0.5">•</span><span>{safeStr(a)}</span>
                                </li>
                              ))}
                            </ul>
                          </PCard>}
                          {ps.weaknessesAndCounterpoints?.length > 0 && <PCard title="נקודות חולשה" icon="⚠️" saveKey="weaknesses" saveContent={ps.weaknessesAndCounterpoints}>
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
                        {ps.usefulQuotes?.length > 0 && <PCard title="ציטוטים חזקים לשימוש" icon="💬" saveKey="usefulQuotes" saveContent={ps.usefulQuotes}>
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
                        {ps.emotionalFraming?.length > 0 && <PCard title="מסגור רגשי" icon="🎭">
                          <div className="flex flex-wrap gap-1.5">
                            {ps.emotionalFraming.map((e, i) => {
                              const eStr = safeStr(e);
                              const matched = Object.entries(emotionColorMap).find(([k]) => eStr.includes(k));
                              return <span key={i} className={`rounded-full border px-3 py-1 text-xs font-semibold ${matched ? matched[1] : 'bg-slate-100 text-slate-700 border-slate-200'}`}>{eStr}</span>;
                            })}
                          </div>
                        </PCard>}

                        {/* 9. שימוש פרקטי */}
                        {ps.practicalUse?.length > 0 && <PCard title="שימוש פרקטי" icon="🛠️">
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
                          <div data-section="שורה תחתונה" className={SUMMARY_CARD_CLASS} dir="rtl">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className={SUMMARY_CARD_TITLE_CLASS}>⬇️ שורה תחתונה</div>
                              {savedPsSections['bottomLine']
                                ? <span className="text-[10px] font-semibold text-emerald-400 dark:text-emerald-600">✅ נשמר</span>
                                : <div className="relative" data-pcard-drop>
                                    <button type="button" onClick={() => setPsCardDropOpen(psCardDropOpen === 'bottomLine' ? null : 'bottomLine')} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border transition-colors ${psCardDropOpen === 'bottomLine' ? 'border-indigo-500/50 bg-indigo-950/30 text-indigo-300' : 'border-transparent text-slate-400 hover:text-indigo-300 hover:border-indigo-500/50 hover:bg-indigo-950/30'}`}>🧠 שמור ▾</button>
                                    {psCardDropOpen === 'bottomLine' && (
                                      <div data-pcard-drop className="absolute left-0 top-full mt-1 z-50 min-w-[150px] rounded-xl border border-zinc-700 bg-zinc-950 shadow-xl overflow-hidden">
                                        {[
                                          { dest: 'brain', label: '🧠 שמור למוח' },
                                          { dest: 'obsidian' },
                                          { dest: 'workspace', label: '⭐ שמור ל-Workspace' },
                                          { dest: 'opponent', label: '⚔️ דעת האויב', red: true },
                                        ].map(({ dest, label, red }) => (
                                          <button key={dest} type="button" onClick={() => { handleSavePsSectionTo('bottomLine', 'שורה תחתונה', ps.bottomLine, dest); setPsCardDropOpen(null); }}
                                            className={`flex w-full items-center gap-2 px-3 py-2 text-xs text-right transition-colors ${red ? 'text-red-400 hover:bg-red-950/20' : 'text-zinc-200 hover:bg-zinc-900'}`}>
                                            {dest === 'obsidian' ? <ObsidianSaveLabel /> : label}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                              }
                            </div>
                            <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 leading-relaxed">{safeStr(ps.bottomLine)}</p>
                          </div>
                        )}

                        {/* 11. הקשר */}
                        {ps.context && <PCard title="הקשר" icon="🔍" saveKey="context" saveContent={ps.context}>
                          <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">{safeStr(ps.context)}</p>
                        </PCard>}

                        {/* 12. מסקנה */}
                        {ps.conclusion && <PCard title="מסקנה" icon="✅" saveKey="conclusion" saveContent={ps.conclusion}>
                          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100 leading-relaxed">{safeStr(ps.conclusion)}</p>
                        </PCard>}

                        {/* 13. השלכות */}
                        {ps.implications?.length > 0 && <PCard title="השלכות" icon="🔮" saveKey="implications" saveContent={ps.implications}>
                          <ul className="space-y-1.5">
                            {ps.implications.map((imp, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-violet-900 dark:text-violet-100">
                                <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-violet-500 text-white text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                                <span className="leading-snug">{safeStr(imp)}</span>
                              </li>
                            ))}
                          </ul>
                        </PCard>}

                      </div>
                      </PoliticalTabBoundary>
                    );
                  }

                  // ── Non-political: existing summary logic ─────────────
                  const isBriefVideo = ['morning-brief','evening-brief','weekly-brief','earnings-brief'].includes(effectiveBriefSlug);
                  const summaryShort = (video.shortSummary || enrichedVideo.aiSummaryShort)?.replace(/\[MOCK\]\s*/g, '');

                  // Brief video without any analysis — show actionable CTA
                  if (isBriefVideo && !summaryShort && !marketBriefData) {
                    const briefHasTranscript = !!(video?.transcript || '').trim();
                    return (
                      <div className="mt-3 space-y-3" dir="rtl">
                        <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-5 dark:border-sky-800/40 dark:bg-sky-950/20">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">📰</span>
                            <p className="text-sm font-bold text-sky-800 dark:text-sky-200">
                              הסרטון מסווג כ{effectiveSubCategory || 'מבזק'} אך עדיין לא בוצע ניתוח מבזק
                            </p>
                          </div>
                          <p className="text-xs text-sky-700 dark:text-sky-300 mb-4">
                            הרץ ניתוח מבזק בוקר כדי לאכלס את הטאבים בנתוני שוק, פרקים, ותובנות.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {briefHasTranscript && (
                              <button
                                type="button"
                                onClick={() => { setActiveTab("ai-analysis"); handleGeminiContent(); }}
                                className="inline-flex items-center gap-1.5 flex-row-reverse rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-all"
                              >
                                🚀 הרץ ניתוח מבזק בוקר
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setIsGemsPasteOpen(true)}
                              className="inline-flex items-center gap-1.5 flex-row-reverse rounded-xl border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 dark:bg-zinc-900 dark:border-sky-700 dark:text-sky-300 transition-all"
                            >
                              📋 הדבק GEM JSON
                            </button>
                          </div>
                          {!briefHasTranscript && (
                            <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-400">
                              ⚠️ אין תמלול — ייבא תמלול כדי להפעיל ניתוח AI.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if ((isBriefVideo || !!marketBriefData?.universalTabs) && !summaryShort && marketBriefData) {
                    const summaryShaped = extractUniversalTabContent(effectiveVideo, 'summary', marketBriefData);
                    logUniversalTabExtractShape('summary', summaryShaped, marketBriefData);

                    if (summaryShaped?.mode === 'sections') {
                      const dailyBriefingForSections = buildDailyBriefingView({
                        effectiveVideo,
                        marketBriefData,
                        summaryShort,
                        fullSummary: video.fullSummary || enrichedVideo.aiSummaryLong,
                        summaryShaped,
                      });
                      const sectionsPopulated = (summaryShaped.sections || []).filter(
                        (s) => Array.isArray(s.items) && s.items.length > 0,
                      );
                      const summarySectionsBulkItems = [
                        ...buildSummaryBriefingCardBulkItems(dailyBriefingForSections),
                        ...buildSummaryBriefingBulkItems(dailyBriefingForSections),
                      ];

                      return (
                        <div className="mt-3 space-y-3" dir="rtl">
                          <TabBulkItemsRegistrar tab="summary" items={summarySectionsBulkItems} />
                          <SummaryBriefingView
                            briefing={dailyBriefingForSections}
                            effectiveVideo={effectiveVideo}
                            marketBriefData={marketBriefData}
                            summaryShort={summaryShort}
                            fullSummary={video.fullSummary || enrichedVideo.aiSummaryLong}
                            summaryShaped={summaryShaped}
                            fullSummaryStorageKey={`summary-full-expanded:${video?.youtubeId || video?.id || 'unknown'}`}
                            onSaveToBrain={saveSingleItemToBrain}
                            isSaved={(text, tabKey) => savedItemKeys.has(itemDedupeKey(video?.youtubeId || video?.id, tabKey, text))}
                            bulkSelection={bulkSelectionShare}
                          />
                          <p className="text-xs text-slate-400 dark:text-zinc-500 text-right">לסיכום AI מלא — לחץ "הרץ ניתוח" בטאב ניתוח AI.</p>
                        </div>
                      );
                    }

                    const gemInsights = summaryShaped?.mode === 'flat' && summaryShaped.items.length > 0
                      ? summaryShaped.items
                      : (() => {
                        const flat = extractUniversalTabFlatItems(effectiveVideo, 'summary', marketBriefData);
                        if (flat.length > 0) return flat;
                        return [
                          ...(Array.isArray(marketBriefData.top5Insights) ? marketBriefData.top5Insights : []),
                          ...(Array.isArray(marketBriefData.reusableKnowledge) ? marketBriefData.reusableKnowledge : []),
                          ...(Array.isArray(marketBriefData.conclusions) ? marketBriefData.conclusions : []),
                        ].filter(Boolean);
                      })();

                    const dailyBriefingForGem = buildDailyBriefingView({
                      effectiveVideo,
                      marketBriefData,
                      summaryShort,
                      fullSummary: video.fullSummary || enrichedVideo.aiSummaryLong,
                      summaryShaped,
                    });
                    const summaryBulkItems = [
                      ...buildSummaryBriefingCardBulkItems(dailyBriefingForGem),
                      ...buildSummaryBriefingBulkItems(dailyBriefingForGem),
                    ];

                    return (
                      <div className="mt-3 space-y-3" dir="rtl">
                        <TabBulkItemsRegistrar tab="summary" items={summaryBulkItems} />
                        <SummaryBriefingView
                          briefing={dailyBriefingForGem}
                          effectiveVideo={effectiveVideo}
                          marketBriefData={marketBriefData}
                          summaryShort={summaryShort}
                          fullSummary={video.fullSummary || enrichedVideo.aiSummaryLong}
                          summaryShaped={summaryShaped}
                          fullSummaryStorageKey={`summary-full-expanded:${video?.youtubeId || video?.id || 'unknown'}`}
                          onSaveToBrain={saveSingleItemToBrain}
                          isSaved={(text, tabKey) => savedItemKeys.has(itemDedupeKey(video?.youtubeId || video?.id, tabKey, text))}
                          bulkSelection={bulkSelectionShare}
                        />
                        <p className="text-xs text-slate-400 dark:text-zinc-500 text-right">לסיכום AI מלא — לחץ "הרץ ניתוח" בטאב ניתוח AI.</p>
                      </div>
                    );
                  }

                  if (summaryShort) {
                    const summaryShapedForBriefing = marketBriefData
                      ? extractUniversalTabContent(effectiveVideo, 'summary', marketBriefData)
                      : null;
                    const showDailyBriefing = isBriefVideo || !!marketBriefData;
                    const summaryVideoId = video?.youtubeId || video?.id || 'unknown';
                    const fullSummaryStorageKey = `summary-full-expanded:${summaryVideoId}`;
                    const dailyBriefing = showDailyBriefing
                      ? buildDailyBriefingView({
                          effectiveVideo,
                          marketBriefData,
                          summaryShort,
                          fullSummary: video.fullSummary || enrichedVideo.aiSummaryLong,
                          summaryShaped: summaryShapedForBriefing,
                        })
                      : null;
                    const hideStandaloneSummaryCard = Boolean(dailyBriefing?.coversSummaryShort);
                    const summaryTabBulkItems = [
                      ...buildSummaryBriefingCardBulkItems(dailyBriefing),
                      ...buildSummaryBriefingBulkItems(dailyBriefing),
                      ...(Array.isArray(video.keyPoints)
                        ? video.keyPoints.map((point, i) => ({
                          id: `keypoints:${i}`,
                          text: String(point),
                          sectionLabel: 'נקודות מפתח',
                          type: 'keypoints',
                          tabScope: 'summary',
                        }))
                        : []),
                    ];

                    return (
                      <div className="mt-3 space-y-3" onMouseUp={handleSummaryMouseUp}>
                        <TabBulkItemsRegistrar tab="summary" items={summaryTabBulkItems} />
                        {textSaveMenu && (
                          <SummaryTextSaveMenu
                            coords={textSaveMenu.coords}
                            text={textSaveMenu.text}
                            sectionLabel={textSaveMenu.sectionLabel}
                            isPolitical={false}
                            onSave={(dest) => handleSummaryTextSave(textSaveMenu.text, textSaveMenu.sectionLabel, dest)}
                            onClose={() => setTextSaveMenu(null)}
                          />
                        )}
                        {showDailyBriefing && (
                          <SummaryBriefingView
                            briefing={dailyBriefing}
                            fullSummaryStorageKey={fullSummaryStorageKey}
                            onSaveToBrain={saveSingleItemToBrain}
                            isSaved={(text, tabKey) => savedItemKeys.has(itemDedupeKey(video?.youtubeId || video?.id, tabKey, text))}
                            bulkSelection={bulkSelectionShare}
                          />
                        )}
                        {!hideStandaloneSummaryCard && (
                        <div data-section="סיכום" className={SUMMARY_CARD_CLASS}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={SUMMARY_CARD_TITLE_CLASS}>📝 סיכום</span>
                            <div className="relative" data-pcard-drop>
                              <button type="button" onClick={() => setPsCardDropOpen(psCardDropOpen === 'nonPoliticalSummary' ? null : 'nonPoliticalSummary')} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border transition-colors ${psCardDropOpen === 'nonPoliticalSummary' ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/50 dark:bg-indigo-950/30 dark:text-indigo-300' : 'border-transparent text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 dark:hover:text-indigo-300 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-950/30'}`}>🧠 שמור ▾</button>
                              {psCardDropOpen === 'nonPoliticalSummary' && (
                                <div data-pcard-drop className="absolute left-0 top-full mt-1 z-50 min-w-[150px] rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-950 overflow-hidden">
                                  {[
                                    { dest: 'brain', label: '🧠 שמור למוח' },
                                    { dest: 'obsidian' },
                                    { dest: 'workspace', label: '⭐ שמור ל-Workspace' },
                                  ].map(({ dest, label }) => (
                                    <button key={dest} type="button" onClick={() => { handleSavePsSectionTo('nonPoliticalSummary', 'סיכום', summaryShort, dest); setPsCardDropOpen(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-right text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-900 transition-colors">
                                      {dest === 'obsidian' ? <ObsidianSaveLabel /> : label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <p className={SUMMARY_LEAD_CLASS} data-section-content="סיכום">{summaryShort}</p>
                        </div>
                        )}
                        {Array.isArray(video.keyPoints) && video.keyPoints.length > 0 ? (
                          <>
                            <ul className="space-y-3 text-right" dir="rtl">
                      {video.keyPoints.map((point, i) => {
                        const itemId = `keypoints:${i}`;
                        const sentenceIsOpponent = opponentSentences.some(s => s.id === itemId);
                        const sentenceObj = opponentSentences.find(s => s.id === itemId);
                        if (keyPointsFilter === 'mine' && sentenceIsOpponent) return null;
                        if (keyPointsFilter === 'opponent' && !sentenceIsOpponent) return null;
                        return (
                          <li key={i} className="flex items-start gap-2">
                            <span className={`mt-2.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              sentenceIsOpponent
                                ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                                : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'
                            }`}>
                              {i + 1}
                            </span>
                            <BrainSelectableItem
                              id={itemId}
                              text={point}
                              isSelected={multiSelected.has(itemId)}
                              isSaved={isBrainItemSaved(point, 'keypoints')}
                              onToggle={() => toggleMultiSelect(itemId, { text: point, sectionLabel: 'נקודות מפתח', type: 'keypoints' })}
                              onSaveSingle={(note) => saveSingleItemToBrain(point, 'keypoints', 'נקודות מפתח', note)}
                              onCopy={() => navigator.clipboard.writeText(point).then(() => toast.success('הועתק'))}
                              isPolitical={effectiveGemInfo?.gemKey === 'political'}
                              isOpponent={sentenceIsOpponent}
                              onToggleOpponent={() => handleToggleSentenceOpponent({ id: itemId, text: point, sourceTab: 'keypoints', sourceIndex: i })}
                              opponentResponse={sentenceObj?.response || null}
                              onSaveResponse={handleSaveOpponentResponse}
                            />
                          </li>
                        );
                      })}
                    </ul>
                    {keyPointsFilter === 'opponent' && opponentSentences.filter(s => s.sourceTab === 'keypoints').length === 0 && (
                      <div className="flex min-h-[100px] items-center justify-center rounded-xl border border-dashed border-rose-200 bg-rose-50/50 px-4 text-sm text-rose-400 dark:border-rose-900/40 dark:bg-rose-950/10">
                        לא סומנו משפטים כדעת האויב
                      </div>
                    )}
                  </>
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
                      </div>
                    );
                  }

                  return null;
                })()}
              </TabsContent>

              {/* ── Chapters tab ── */}
                <TabsContent value="chapters" className="mt-0 min-h-[320px]" dir="rtl">
                  <TabBulkItemsRegistrar tab="chapters" items={buildChaptersBulkItems(displayChapters)} />
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">

                    {/* header: title + badge (right) + auto-detect button (left) */}
                    <div className="mb-3 flex items-center justify-between gap-3" dir="rtl">
                      <div className="flex items-center gap-2">
                        <h4 className={SUMMARY_CARD_TITLE_CLASS}>פרקי הסרטון</h4>
                        {chapterSourceBadge && (
                          <span className={`text-[10px] border px-1.5 py-0.5 rounded-full ${chapterSourceBadgeClass}`}>
                            {chapterSourceBadge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {chaptersFromGem && (
                          <span className="text-[10px] border px-1.5 py-0.5 rounded-full border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/40 dark:bg-sky-950/20 dark:text-sky-300">
                            GEM
                          </span>
                        )}
                        {displayChapters?.length > 0 && !chaptersFromGem && (
                          <button
                            type="button"
                            onClick={handleGenerateHebrewTitles}
                            disabled={isGeneratingHebrewTitles}
                            className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11px] font-medium text-violet-700 shadow-sm hover:bg-violet-100 disabled:opacity-60 transition-colors dark:border-violet-800/40 dark:bg-violet-950/20 dark:text-violet-300"
                          >
                            {isGeneratingHebrewTitles ? "⏳ מייצר..." : "🤖 צור כותרות AI בעברית"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handlePullDescriptionChapters}
                          disabled={isImportingDescChapters}
                          title="ייבוא פרקים מובנים מתיאור הסרטון"
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 shadow-sm hover:bg-emerald-100 disabled:opacity-60 transition-colors dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                        >
                          {isImportingDescChapters ? "⏳ טוען..." : "📋 פרקי YouTube"}
                        </button>
                        <button
                          type="button"
                          onClick={handleAutoDetectChapters}
                          disabled={isYoutubeChaptersFetch}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-white hover:border-slate-300 disabled:opacity-60 transition-colors dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          {isYoutubeChaptersFetch ? "⏳ מייצר..." : "🔍 בדוק פרקים אוטומטית"}
                        </button>
                      </div>
                    </div>

                    {/* source message */}
                    {chapterSourceInfo.message && (
                      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 text-right leading-relaxed dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                        {chapterSourceInfo.message}
                      </div>
                    )}
                    {hebrewTitlesError && (
                      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 text-right dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                        {hebrewTitlesError}
                      </div>
                    )}
                    {transcriptQualityResult && !transcriptQualityResult.valid && (
                      <div className="mb-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700 text-right dark:border-orange-800/40 dark:bg-orange-950/20 dark:text-orange-300" dir="rtl">
                        ⚠ פרקי תמלול שמורים נדחו ({transcriptQualityResult.reason}) — מוצג מקור חלופי
                      </div>
                    )}

                    {/* hint: no timestamps → offer AI generation */}
                    {youtubeChaptersHint === "no_timestamps" && (
                      <div className="relative mb-3 flex flex-col items-end gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 pe-10 text-right dark:border-zinc-700 dark:bg-zinc-900">
                        <button
                          type="button"
                          onClick={handleDismissChaptersHint}
                          title="סגור הודעה"
                          aria-label="סגור הודעה"
                          className="absolute left-2 top-2 rounded-md p-1 text-slate-400 hover:bg-white/80 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <p className="text-xs text-slate-600 dark:text-zinc-400">לא נמצאו timestamps בתיאור הסרטון.</p>
                        {hasStoredTranscript ? (
                          <button
                            type="button"
                            onClick={handleGenerateTranscriptChapters}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                          >
                            📑 צור פרקים מהתמלול
                          </button>
                        ) : (
                          <p className="text-xs text-slate-500 dark:text-zinc-400">לא נמצא תמלול שמור. הדבק או הורד תמלול ואז נסה שוב.</p>
                        )}
                      </div>
                    )}

                    {/* hint: no video URL (Gemini fallback also unavailable) */}
                    {youtubeChaptersHint === "no_api_key" && (
                      <div className="relative mb-3 flex flex-col items-end gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 pe-10 text-right dark:border-amber-900/40 dark:bg-amber-950/20">
                        <button
                          type="button"
                          onClick={handleDismissChaptersHint}
                          title="סגור הודעה"
                          aria-label="סגור הודעה"
                          className="absolute left-2 top-2 rounded-md p-1 text-amber-500 hover:bg-amber-100/80 hover:text-amber-700 dark:hover:bg-amber-900/30 dark:hover:text-amber-300"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <p className="text-xs text-amber-700 dark:text-amber-300">לא ניתן לזהות כתובת YouTube לסרטון זה.</p>
                        {hasStoredTranscript ? (
                          <button
                            type="button"
                            onClick={handleGenerateTranscriptChapters}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                          >
                            🤖 צור פרקים מהתמלול
                          </button>
                        ) : (
                          <p className="text-xs text-amber-700 dark:text-amber-300">לא נמצא תמלול שמור. הדבק או הורד תמלול ואז נסה שוב.</p>
                        )}
                      </div>
                    )}

                    {/* hint: Gemini returned partial timeline — not saved */}
                    {youtubeChaptersHint === "partial_coverage" && (
                      <div className="relative mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 pe-10 text-right dark:border-amber-900/40 dark:bg-amber-950/20">
                        <button
                          type="button"
                          onClick={handleDismissChaptersHint}
                          title="סגור הודעה"
                          aria-label="סגור הודעה"
                          className="absolute left-2 top-2 rounded-md p-1 text-amber-500 hover:bg-amber-100/80 hover:text-amber-700 dark:hover:bg-amber-900/30 dark:hover:text-amber-300"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          הפרקים שנוצרו לא מכסים את כל אורך הסרטון — לא נשמרו. נסה שוב או צור פרקים מהתמלול.
                        </p>
                        {hasStoredTranscript && (
                          <button
                            type="button"
                            onClick={handleGenerateTranscriptChapters}
                            className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                          >
                            🤖 צור פרקים מהתמלול
                          </button>
                        )}
                      </div>
                    )}

                    {/* hint: fetch/gemini error */}
                    {youtubeChaptersHint === "fetch_failed" && (
                      <div className="relative mb-3 flex flex-col items-end gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 pe-10 text-right dark:border-red-900/40 dark:bg-red-950/20">
                        <button
                          type="button"
                          onClick={handleDismissChaptersHint}
                          title="סגור הודעה"
                          aria-label="סגור הודעה"
                          className="absolute left-2 top-2 rounded-md p-1 text-red-400 hover:bg-red-100/80 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-300"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <p className="text-xs text-red-700 dark:text-red-300">
                          Gemini לא הצליח לנתח את הסרטון — ייתכן שהסרטון חדש מדי. ייבא תמלול כדי ליצור פרקים.
                        </p>
                        {hasStoredTranscript ? (
                          <button
                            type="button"
                            onClick={handleGenerateTranscriptChapters}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                          >
                            🤖 צור פרקים מהתמלול
                          </button>
                        ) : (
                          <p className="text-xs text-red-600 dark:text-red-300">
                            לא נמצא תמלול שמור. הדבק או הורד תמלול ואז נסה שוב.
                          </p>
                        )}
                      </div>
                    )}

                    {/* hint: transcript generation failed */}
                    {youtubeChaptersHint === "transcript_gen_failed" && (
                      <div className="relative mb-3 flex flex-col items-end gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 pe-10 text-right dark:border-red-900/40 dark:bg-red-950/20">
                        <button
                          type="button"
                          onClick={handleDismissChaptersHint}
                          title="סגור הודעה"
                          aria-label="סגור הודעה"
                          className="absolute left-2 top-2 rounded-md p-1 text-red-400 hover:bg-red-100/80 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-300"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <p className="text-xs text-red-700 dark:text-red-300">
                          Gemini לא הצליח ליצור פרקים מהתמלול. נסה לקצר את התמלול או להדביק תמלול נקי יותר.
                        </p>
                      </div>
                    )}

                    {/* hint: no saved transcript when user tried transcript chapters */}
                    {youtubeChaptersHint === "no_transcript" && (
                      <div className="relative mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 pe-10 text-right dark:border-amber-900/40 dark:bg-amber-950/20">
                        <button
                          type="button"
                          onClick={handleDismissChaptersHint}
                          title="סגור הודעה"
                          aria-label="סגור הודעה"
                          className="absolute left-2 top-2 rounded-md p-1 text-amber-500 hover:bg-amber-100/80 hover:text-amber-700 dark:hover:bg-amber-900/30 dark:hover:text-amber-300"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          לא נמצא תמלול שמור. הדבק או הורד תמלול ואז נסה שוב.
                        </p>
                      </div>
                    )}

                    {/* transcript exists but no chapters yet → offer AI generation */}
                    {displayChapters?.length === 0 && chapterSourceInfo.source === 'transcript' && !youtubeChaptersHint && (
                      <div className="mb-3 flex flex-col items-end gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-right dark:border-zinc-700 dark:bg-zinc-900">
                        <p className="text-sm font-medium text-slate-700 dark:text-zinc-200">קיים תמלול — ניתן לחלק לפרקים לפי התמלול.</p>
                        <button
                          type="button"
                          onClick={handleGenerateTranscriptChapters}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                        >
                          📑 צור פרקים מהתמלול
                        </button>
                      </div>
                    )}

                    {/* no chapters and no transcript → clear empty state */}
                    {displayChapters?.length === 0 && chapterSourceInfo.source === 'none' && (
                      <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-right text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                        לא נמצאו פרקים או תמלול. יש לייבא תמלול כדי ליצור פרקים.
                      </div>
                    )}

                    {/* debug info — dev only */}
                    {import.meta.env.DEV && (
                      <details className="mb-3 rounded-lg border border-slate-100 bg-slate-50/50 dark:border-zinc-800 dark:bg-zinc-900/50 text-[10px]">
                        <summary className="cursor-pointer select-none px-2 py-1 text-slate-400 dark:text-zinc-500">🔍 chapter debug</summary>
                        <div className="px-2 pb-2 pt-0.5 space-y-0.5 font-mono text-slate-500 dark:text-zinc-400" dir="ltr">
                          <div>hasTranscript: {String(hasStoredTranscript)}</div>
                          <div>transcriptSource: {transcriptForChapters.source ?? "—"}</div>
                          <div>lastChapterSource: {chapterTranscriptSource ?? "—"}</div>
                          <div>transcriptLen: {fullTranscriptText?.length ?? 0}</div>
                          <div>descriptionChapters: {descriptionChapters?.length ?? 0}</div>
                          <div>aiAnalysisChapters: {aiAnalysisChapters?.length ?? 0}</div>
                          <div>transcriptChunkRaw: {transcriptChaptersRaw?.length ?? 0}</div>
                          <div>transcriptQuality: {transcriptQualityResult ? (transcriptQualityResult.valid ? '✓ valid' : `✗ ${transcriptQualityResult.reason}`) : '—'}</div>
                          <div>transcriptChunkPassed: {transcriptChunkChapters?.length ?? 0}</div>
                          <div>nativeChapters: {baseChapters?.length ?? 0}</div>
                          <div>gemChapters: {gemChapters?.length ?? 0}</div>
                          <div>chapterSourceBadge: {chapterSourceBadge ?? '—'}</div>
                          <div>displayWinner: {descriptionChapters.length > 0 ? 'description' : transcriptChunkChapters.length > 0 ? 'transcriptChunk' : chaptersFromGem ? 'gem' : aiAnalysisChapters.length > 0 ? 'aiAnalysis' : 'base'}</div>
                          <div>fallbackSource: {transcriptChunkChapters.length === 0 && (transcriptChaptersRaw?.length ?? 0) > 0 ? (gemChapters.length > 0 ? 'gem' : aiAnalysisChapters.length > 0 ? 'aiAnalysis' : 'base') : '—'}</div>
                          <div>finalChapters: {displayChapters?.length ?? 0}</div>
                          <div>segments: {storedTranscriptSegments?.length ?? 0}</div>
                          <div>video.desc: {typeof video?.description === 'string' ? video.description.length : '—'}</div>
                          <div>prop.desc: {typeof videoProp?.description === 'string' ? videoProp.description.length : '—'}</div>
                          <div>ytId: {getVideoIdFromUrl(getWatchUrl(video)) ?? '—'}</div>
                        </div>
                      </details>
                    )}

                    {/* chapters list or empty state */}
                    {displayChapters?.length > 0 ? (
                      <>
                        <div className="space-y-0.5">
                          {displayChapters.map((chapter, index) => {
                            const chId = `chapters:${index}`;
                            return (
                              <UniversalTabSelectRow
                                key={`chapters-tab-${index}`}
                                id={`chap-hl-${index}`}
                                className={`group flex items-start gap-2 rounded-lg px-2 py-2 hover:bg-white/80 dark:hover:bg-zinc-800/60 transition-colors${index === highlightedChapterIndex ? " bg-violet-50/50 dark:bg-violet-950/20" : ""}`}
                                checkbox={(
                                  <UniversalTabCheckbox
                                    checked={multiSelected.has(chId)}
                                    onChange={() => toggleMultiSelect(chId, { text: chapter.title || `פרק ${index + 1}`, sectionLabel: 'פרקים', type: 'chapters', timestamp: chapter.timestamp || '' })}
                                  />
                                )}
                                actions={(
                                  <UniversalTabQuickSaveFromBulk
                                    bulkSelection={bulkSelectionShare}
                                    text={chapter.title || `פרק ${index + 1}`}
                                    sectionLabel="פרקים"
                                    type="chapters"
                                    tabScope="chapters"
                                    timestamp={chapter.timestamp || ''}
                                  />
                                )}
                              >
                                  <ChapterItem
                                    variant="row"
                                    section={hebrewTitlesMap[index]
                                      ? { ...chapter, hebrewTitle: hebrewTitlesMap[index].hebrewTitle, originalTitle: hebrewTitlesMap[index].originalTitle || chapter.title }
                                      : chapter}
                                    playerRef={undefined}
                                    videoUrl={getWatchUrl(video)}
                                    isHighlighted={index === highlightedChapterIndex}
                                  />
                              </UniversalTabSelectRow>
                            );
                          })}
                        </div>
                      </>
                    ) : null}
                  </div>
              </TabsContent>

                <TabsContent value="notes" className="mt-5 min-h-[320px]" dir="rtl">
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-100 dark:border-zinc-800" dir="rtl">
                      <span className="text-sm font-bold text-slate-800 dark:text-zinc-100">📝 הערות</span>
                      <button
                        type="button"
                        title="סגור הערות"
                        onClick={() => setActiveTab(prevTabRef.current || "summary")}
                        className="flex items-center justify-center h-7 w-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition-all dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div id="learning-notes" className="px-4 py-3 max-h-[400px] overflow-auto">
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
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">תמלול</h4>
                            {/* View mode toggle */}
                            <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 dark:border-zinc-700 text-[10px] font-semibold">
                              <button
                                type="button"
                                onClick={() => setTranscriptViewMode("raw")}
                                className={`px-2.5 py-1 transition-colors ${
                                  transcriptViewMode === "raw"
                                    ? "bg-slate-700 text-white dark:bg-zinc-600"
                                    : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                                }`}
                              >
                                גולמי
                              </button>
                              <button
                                type="button"
                                onClick={() => setTranscriptViewMode("reading")}
                                className={`px-2.5 py-1 border-r border-slate-200 dark:border-zinc-700 transition-colors ${
                                  transcriptViewMode === "reading"
                                    ? "bg-indigo-600 text-white"
                                    : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                                }`}
                              >
                                📖 קריאה
                              </button>
                            </div>
                          </div>
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

                        {/* GEM bar — current GEM + open GEM modal */}
                        <div className="flex items-center justify-between gap-2 mb-3 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-950/20 px-3 py-2" dir="rtl">
                          <div className="flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300 min-w-0">
                            <span className="text-base leading-none shrink-0">{effectiveGemInfo?.gemIcon || '✨'}</span>
                            <span className="font-semibold truncate">{effectiveGemInfo?.gemLabel || 'כללי'}</span>
                            {gemOverride && (
                              <span className="text-[10px] text-indigo-400 dark:text-indigo-500 shrink-0">(ידני)</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowGemModal(true)}
                            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                          >
                            💎 ניהול GEMS
                          </button>
                        </div>

                        {gemRecommendationVisible && displayGemInfo && hasStoredTranscript && (
                          <div className="mb-3">
                            <GemRecommendationCard
                              recommendation={displayGemInfo}
                              onOpenRecommended={handleOpenRecommendedGem}
                              onChooseAnother={() => setShowGemModal(true)}
                              onDismiss={() => setGemRecommendationVisible(false)}
                              opening={gemRecommendationOpening}
                            />
                          </div>
                        )}

                        {/* Search bar + mode toggle */}
                        <div className="mb-2 flex flex-col gap-2" dir="rtl">
                          <div className="flex items-center gap-2 flex-row-reverse">
                            <input
                              type="text"
                              value={transcriptSearch}
                              onChange={e => setTranscriptSearch(e.target.value)}
                              placeholder="חפש בתמלול..."
                              className="flex-1 h-8 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-right text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-500"
                              dir="rtl"
                            />
                            {transcriptSearch.trim() && transcriptSearchMode === "highlight" && (
                              <div className="flex items-center gap-1.5 flex-row-reverse shrink-0">
                                {transcriptSearchMatches.length > 0 ? (
                                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                                    {transcriptSearchIndex + 1} / {transcriptSearchMatches.length} תוצאות
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-red-400 whitespace-nowrap">לא נמצאו תוצאות</span>
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
                            {transcriptSearch.trim() && transcriptSearchMode === "filter" && (
                              <span className="text-[11px] text-slate-500 dark:text-zinc-400 whitespace-nowrap shrink-0">
                                {filteredSentences.length > 0
                                  ? `נמצאו ${filteredSentences.length} משפטים`
                                  : "לא נמצאו תוצאות"}
                              </span>
                            )}
                          </div>

                          {/* Mode toggle */}
                          <div className="flex items-center gap-0 self-end rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setTranscriptSearchMode("highlight")}
                              className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                transcriptSearchMode === "highlight"
                                  ? "bg-indigo-600 text-white"
                                  : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                              }`}
                            >
                              סימון בתמלול
                            </button>
                            <button
                              type="button"
                              onClick={() => setTranscriptSearchMode("filter")}
                              className={`px-2.5 py-1 text-[11px] font-medium transition-colors border-r border-slate-200 dark:border-zinc-700 ${
                                transcriptSearchMode === "filter"
                                  ? "bg-indigo-600 text-white"
                                  : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                              }`}
                            >
                              רק משפטים תואמים
                            </button>
                          </div>
                        </div>

                        {/* Transcript display: raw highlight mode */}
                        {transcriptViewMode === "raw" && (transcriptSearchMode === "highlight" || !transcriptSearch.trim()) && (
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
                        )}

                        {/* Transcript display: reading mode */}
                        {transcriptViewMode === "reading" && (() => {
                          const q = transcriptSearch.trim();
                          const qLower = q.toLowerCase();
                          const visibleParagraphs = (transcriptSearchMode === "filter" && q)
                            ? transcriptParagraphs.filter(p => p.toLowerCase().includes(qLower))
                            : transcriptParagraphs;

                          return (
                            <div className="max-h-[540px] overflow-auto rounded-xl bg-white border border-slate-100 dark:bg-zinc-950 dark:border-zinc-800">
                              {visibleParagraphs.length === 0 ? (
                                <div className="px-6 py-8 text-center text-sm text-slate-400 dark:text-zinc-500">
                                  {q ? "לא נמצאו פסקאות תואמות" : "אין תמלול להצגה"}
                                </div>
                              ) : (
                                <div className="px-6 py-5 space-y-5" dir="rtl">
                                  {visibleParagraphs.map((para, idx) => {
                                    const parts = highlightInParagraph(para, q);
                                    return (
                                      <div key={idx} className="group relative">
                                        <span className="absolute -right-4 top-0 text-[10px] font-bold text-slate-300 dark:text-zinc-600 select-none tabular-nums">
                                          {idx + 1}
                                        </span>
                                        <p
                                          className="text-sm leading-8 text-slate-800 dark:text-zinc-200 font-sans max-w-[680px]"
                                          dir="rtl"
                                        >
                                          {parts.map((part, pi) =>
                                            typeof part === "string" ? (
                                              <span key={pi}>{part}</span>
                                            ) : (
                                              <mark
                                                key={pi}
                                                style={{ background: '#fef08a', color: '#1e293b', borderRadius: '2px', padding: '0 1px' }}
                                              >
                                                {part.text}
                                              </mark>
                                            )
                                          )}
                                        </p>
                                        <button
                                          type="button"
                                          onClick={() => navigator.clipboard.writeText(para).then(() => toast.success('פסקה הועתקה')).catch(() => {})}
                                          className="absolute -left-1 top-0 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 px-1.5 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800"
                                          title="העתק פסקה"
                                        >
                                          <Copy className="h-3 w-3" />
                                        </button>
                                        <div className="border-b border-slate-100 dark:border-zinc-800/60 mt-1" />
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Transcript display: raw filter mode */}
                        {transcriptViewMode === "raw" && transcriptSearchMode === "filter" && transcriptSearch.trim() && (
                          <div className="flex flex-col gap-2">
                            {filteredSentences.length === 0 ? (
                              <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-6 text-center text-sm text-slate-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-500">
                                לא נמצאו משפטים תואמים
                              </div>
                            ) : (
                              filteredSentences.map((item, idx) => {
                                const q = transcriptSearch.trim();
                                const qLower = q.toLowerCase();
                                const sentLower = item.text.toLowerCase();
                                const parts = [];
                                let pos = 0;
                                while (pos < item.text.length) {
                                  const found = sentLower.indexOf(qLower, pos);
                                  if (found === -1) { parts.push(item.text.slice(pos)); break; }
                                  if (found > pos) parts.push(item.text.slice(pos, found));
                                  parts.push(
                                    <mark
                                      key={`fs-${idx}-${found}`}
                                      style={{ background: '#fef08a', color: '#1e293b', borderRadius: '2px' }}
                                    >
                                      {item.text.slice(found, found + q.length)}
                                    </mark>
                                  );
                                  pos = found + q.length;
                                }
                                return (
                                  <div
                                    key={idx}
                                    className="group rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 dark:bg-zinc-950 dark:border-zinc-800"
                                    dir="rtl"
                                  >
                                    <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed font-sans" dir="auto">
                                      {parts}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        type="button"
                                        onClick={() => navigator.clipboard.writeText(item.text)}
                                        className="text-[10px] text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                                        title="העתק משפט"
                                      >
                                        העתק משפט
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                            <button
                              type="button"
                              onClick={() => setTranscriptSearchMode("highlight")}
                              className="self-center mt-1 text-[11px] text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-200 transition-colors"
                            >
                              ← חזור לתמלול מלא
                            </button>
                          </div>
                        )}
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
                              <ul className="space-y-1" dir="rtl">
                                {video.keyInsights.map((insight, i) => {
                                  const itemId = `ai-insight:${i}`;
                                  return (
                                    <li key={i}>
                                      <BrainSelectableItem
                                        id={itemId}
                                        text={insight}
                                        isSelected={multiSelected.has(itemId)}
                                        isSaved={isBrainItemSaved(insight, 'ai-insights')}
                                        onToggle={() => toggleMultiSelect(itemId, { text: insight, sectionLabel: 'תובנות מרכזיות', type: 'ai-insights' })}
                                        onSaveSingle={(note) => saveSingleItemToBrain(insight, 'ai-insights', 'תובנות מרכזיות', note)}
                                        onCopy={() => navigator.clipboard.writeText(insight).then(() => toast.success('הועתק'))}
                                      />
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                          {Array.isArray(video.actionItems) && video.actionItems.length > 0 && (
                            <div className="text-right">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-2">🔁 פעולות</h4>
                              <ul className="space-y-1" dir="rtl">
                                {video.actionItems.map((action, i) => {
                                  const itemId = `ai-action:${i}`;
                                  return (
                                    <li key={i}>
                                      <BrainSelectableItem
                                        id={itemId}
                                        text={action}
                                        isSelected={multiSelected.has(itemId)}
                                        isSaved={isBrainItemSaved(action, 'ai-actions')}
                                        onToggle={() => toggleMultiSelect(itemId, { text: action, sectionLabel: 'פעולות', type: 'ai-actions' })}
                                        onSaveSingle={(note) => saveSingleItemToBrain(action, 'ai-actions', 'פעולות', note)}
                                        onCopy={() => navigator.clipboard.writeText(action).then(() => toast.success('הועתק'))}
                                      />
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                          {Array.isArray(video.rules) && video.rules.length > 0 && (
                            <div className="text-right">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-2">✅ כללים</h4>
                              <ul className="space-y-1" dir="rtl">
                                {video.rules.map((rule, i) => {
                                  const itemId = `ai-rule:${i}`;
                                  return (
                                    <li key={i}>
                                      <BrainSelectableItem
                                        id={itemId}
                                        text={rule}
                                        isSelected={multiSelected.has(itemId)}
                                        isSaved={isBrainItemSaved(rule, 'ai-rules')}
                                        onToggle={() => toggleMultiSelect(itemId, { text: rule, sectionLabel: 'כללים', type: 'ai-rules' })}
                                        onSaveSingle={(note) => saveSingleItemToBrain(rule, 'ai-rules', 'כללים', note)}
                                        onCopy={() => navigator.clipboard.writeText(rule).then(() => toast.success('הועתק'))}
                                      />
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                          {video.mainLesson && (
                            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-right dark:border-indigo-800/50 dark:bg-indigo-950/30">
                              <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-1">🎯 לקח מרכזי</h4>
                              <p className="text-sm text-indigo-900 dark:text-indigo-200 leading-relaxed">{video.mainLesson}</p>
                            </div>
                          )}
                          {attachedDocumentsInsights && (
                            <div className="rounded-xl border border-orange-200 bg-orange-50/60 px-4 py-3 text-right dark:border-orange-800/40 dark:bg-orange-950/20 space-y-3" dir="rtl">
                              <h4 className="text-sm font-bold text-orange-800 dark:text-orange-300 flex items-center gap-1.5">
                                <span>📚</span>
                                <span>תובנות ממסמכים מצורפים</span>
                              </h4>
                              {attachedDocumentsInsights.overallSummary && (
                                <p className="text-sm text-orange-900 dark:text-orange-200 leading-relaxed">{attachedDocumentsInsights.overallSummary}</p>
                              )}
                              {Array.isArray(attachedDocumentsInsights.keyFindings) && attachedDocumentsInsights.keyFindings.length > 0 && (
                                <div>
                                  <div className="text-xs font-bold text-orange-700 dark:text-orange-400 mb-1">🔍 ממצאים מרכזיים</div>
                                  <ul className="space-y-1" dir="rtl">
                                    {attachedDocumentsInsights.keyFindings.map((f, i) => (
                                      <li key={i} className="flex items-start gap-2 text-sm text-orange-800 dark:text-orange-200">
                                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                                        <span className="leading-relaxed flex-1">{f}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {Array.isArray(attachedDocumentsInsights.supportingEvidence) && attachedDocumentsInsights.supportingEvidence.length > 0 && (
                                <div>
                                  <div className="text-xs font-bold text-orange-700 dark:text-orange-400 mb-1">✅ ראיות תומכות</div>
                                  <ul className="space-y-1" dir="rtl">
                                    {attachedDocumentsInsights.supportingEvidence.map((e, i) => (
                                      <li key={i} className="flex items-start gap-2 text-sm text-orange-800 dark:text-orange-200">
                                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                        <span className="leading-relaxed flex-1">{e}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {Array.isArray(attachedDocumentsInsights.contradictions) && attachedDocumentsInsights.contradictions.length > 0 && (
                                <div>
                                  <div className="text-xs font-bold text-orange-700 dark:text-orange-400 mb-1">⚠️ סתירות עם הסרטון</div>
                                  <ul className="space-y-1" dir="rtl">
                                    {attachedDocumentsInsights.contradictions.map((c, i) => (
                                      <li key={i} className="flex items-start gap-2 text-sm text-orange-800 dark:text-orange-200">
                                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                                        <span className="leading-relaxed flex-1">{c}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {Array.isArray(attachedDocumentsInsights.additionalConcepts) && attachedDocumentsInsights.additionalConcepts.length > 0 && (
                                <div>
                                  <div className="text-xs font-bold text-orange-700 dark:text-orange-400 mb-1">💡 מושגים נוספים</div>
                                  <ul className="space-y-1" dir="rtl">
                                    {attachedDocumentsInsights.additionalConcepts.map((c, i) => (
                                      <li key={i} className="flex items-start gap-2 text-sm text-orange-800 dark:text-orange-200">
                                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                        <span className="leading-relaxed flex-1">{c}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })() : (
                      <div className="flex flex-col items-end gap-4 py-6 text-right" dir="rtl">
                        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">אין עדיין ניתוח AI לסרטון הזה</p>
                        <div className="flex flex-col gap-2 w-full max-w-xs">
                          <div className="flex items-center gap-1 justify-end" dir="rtl">
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 ml-1">פרקים:</span>
                            {[
                              { id: 'normal', label: 'רגיל' },
                              { id: 'detailed', label: 'מפורט' },
                              { id: 'maximum', label: 'מקסימום' },
                            ].map(({ id, label }) => (
                              <button key={id} type="button" onClick={() => setChapterDensityMode(id)}
                                className={`px-2 py-0.5 text-[10px] rounded-md border transition-colors ${chapterDensityMode === id ? 'bg-emerald-100 border-emerald-300 text-emerald-800 font-semibold dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-300' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 dark:bg-zinc-950 dark:border-zinc-700 dark:text-zinc-400'}`}
                              >{label}</button>
                            ))}
                          </div>
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
                    {/* ── Brief video: no GEM data yet — guidance banner ── */}
                    {['morning-brief','evening-brief','weekly-brief','earnings-brief'].includes(normalizedSubCategory) && !marketBriefData && (
                      <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-right dark:border-sky-800/40 dark:bg-sky-950/20" dir="rtl">
                        <p className="text-sm font-semibold text-sky-800 dark:text-sky-200 mb-1">
                          📰 {effectiveSubCategory || 'מבזק'} — נדרש ניתוח GEM
                        </p>
                        <p className="text-xs text-sky-700 dark:text-sky-300 mb-2.5">
                          פתח את GEM <strong>מבזק בוקר</strong> ב-Gemini, הדבק את ה-JSON שהוא מחזיר כאן
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsGemsPasteOpen(true)}
                          className="inline-flex items-center gap-1.5 flex-row-reverse rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 active:scale-95 transition-all"
                        >
                          📋 הדבק GEM JSON
                        </button>
                      </div>
                    )}
                    {/* ── AI Field Mapping (Morning Brief only) ── */}
                    {marketBriefData && effectiveBriefSlug === 'morning-brief' && (() => {
                      const mapping = getMorningBriefFieldMapping(marketBriefData);
                      if (!mapping.length) return null;
                      return (
                        <details className="rounded-xl border border-slate-200 bg-slate-50/70 dark:border-zinc-800 dark:bg-zinc-900/70">
                          <summary className="cursor-pointer select-none px-3 py-2 text-xs text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors">
                            🗺️ מיפוי שדות JSON לטאבים ▾
                          </summary>
                          <div className="px-3 pb-3 pt-1 space-y-1.5" dir="rtl">
                            {mapping.map(({ tab, emoji, fields }) => (
                              <div key={tab} className="flex items-baseline gap-2 text-xs">
                                <span className="font-semibold text-slate-700 dark:text-zinc-200 min-w-[100px] shrink-0">{emoji} {tab}</span>
                                <span className="text-slate-500 dark:text-zinc-400">{fields.join(' · ')}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      );
                    })()}
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

              {/* ── APP Builder tab — universal, appears for every video ── */}
              <TabsContent value="app-builder" className="mt-0" dir="rtl">
                <AppBuilderTab
                  video={video}
                  topicName={resolvedVideoMode.category || ''}
                  marketBriefData={marketBriefData}
                />
              </TabsContent>

              {/* ── Insights tab — keyInsights, brainHighlights, tradingPrinciples, mentalModels, keyPoints ── */}
              <TabsContent value="insights" className="mt-0 min-h-[320px]" dir="rtl">
                {(() => {
                  const mainLesson   = effectiveVideo?.mainLesson ? [effectiveVideo.mainLesson] : [];
                  const insightsShaped = extractUniversalTabContent(effectiveVideo, 'insights', marketBriefData);
                  logUniversalTabExtractShape('insights', insightsShaped, marketBriefData);
                  const universalInsightSections = insightsShaped?.mode === 'sections' ? insightsShaped.sections : [];
                  const legacyKeyInsights = [
                    ...(Array.isArray(effectiveVideo?.keyInsights)             ? effectiveVideo.keyInsights             : []),
                    ...(Array.isArray(effectiveVideo?.analysis?.keyInsights)   ? effectiveVideo.analysis.keyInsights    : []),
                    ...(marketBriefData ? [...(Array.isArray(marketBriefData?.top5Insights) ? marketBriefData.top5Insights : []), ...(Array.isArray(marketBriefData?.reusableKnowledge) ? marketBriefData.reusableKnowledge : [])] : [
                      ...(Array.isArray(effectiveVideo?.top5Insights)          ? effectiveVideo.top5Insights            : []),
                      ...(Array.isArray(effectiveVideo?.reusableKnowledge)     ? effectiveVideo.reusableKnowledge       : []),
                    ]),
                  ].filter(Boolean);
                  const keyInsights = insightsShaped?.mode === 'flat' && insightsShaped.items.length > 0
                    ? insightsShaped.items
                    : (universalInsightSections.length > 0
                      ? []
                      : (extractUniversalTabFlatItems(effectiveVideo, 'insights', marketBriefData).length > 0
                        ? extractUniversalTabFlatItems(effectiveVideo, 'insights', marketBriefData)
                        : legacyKeyInsights));
                  const principles = [
                    ...(Array.isArray(effectiveVideo?.tradingPrinciples)       ? effectiveVideo.tradingPrinciples       : []),
                    ...(Array.isArray(effectiveVideo?.mentalModels)            ? effectiveVideo.mentalModels            : []),
                    ...(Array.isArray(effectiveVideo?.brainHighlights)         ? effectiveVideo.brainHighlights         : []),
                    ...(Array.isArray(effectiveVideo?.analysis?.brainHighlights) ? effectiveVideo.analysis.brainHighlights : []),
                  ].filter(Boolean);
                  const thesis = [
                    ...(Array.isArray(effectiveVideo?.thesis)          ? effectiveVideo.thesis          : []),
                    ...(Array.isArray(effectiveVideo?.analysis?.thesis) ? effectiveVideo.analysis.thesis : []),
                  ].filter(Boolean);

                  const sections = [
                    mainLesson.length > 0    && { key: 'lesson',     label: '🎯 לקח מרכזי',       items: mainLesson,  highlight: true,  tabKey: 'insights' },
                    keyInsights.length > 0   && { key: 'insights',   label: '💡 תובנות מרכזיות',   items: keyInsights, highlight: false, tabKey: 'insights' },
                    principles.length > 0    && { key: 'principles', label: '🧠 עקרונות מסחר',     items: principles,  highlight: false, tabKey: 'trading-brain' },
                    thesis.length > 0        && { key: 'thesis',     label: '📐 טזה / טיעון מרכזי', items: thesis,      highlight: false, tabKey: 'insights' },
                  ].filter(Boolean);

                  if (sections.length === 0 && universalInsightSections.length === 0) return (
                    <>
                      <TabBulkItemsRegistrar tab="insights" items={[]} />
                      <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-zinc-500">
                        <span className="text-3xl mb-2 opacity-30">💡</span>
                        <p className="text-sm">אין עדיין תובנות — נתח את הסרטון כדי להפיק</p>
                      </div>
                    </>
                  );
                  const brainSaveInsights = (text) => saveSingleItemToBrain(text, 'insights', '', '');
                  const isInsightSaved = (text) => savedItemKeys.has(itemDedupeKey(video?.youtubeId || video?.id, 'insights', text));

                  const insightsBulkSections = [
                    ...universalInsightSections.map((s) => ({ key: s.key, label: s.label, items: s.items, tabKey: 'insights' })),
                    ...sections.map(({ key, label, items, tabKey }) => ({ key, label, items, tabKey: tabKey || 'insights' })),
                  ];
                  const insightsBulkItems = buildBulkItemsFromSections(insightsBulkSections, 'insights');

                  return (
                    <div className="space-y-3">
                      <TabBulkItemsRegistrar tab="insights" items={insightsBulkItems} />
                      {universalInsightSections.length > 0 && (
                        <InsightsStructuredView
                          sections={universalInsightSections}
                          onSaveToBrain={brainSaveInsights}
                          isSaved={isInsightSaved}
                          bulkSelection={bulkSelectionShare}
                          tabScope="insights"
                        />
                      )}
                      {sections.map(({ key, label, items, highlight, tabKey }) => {
                        if (key === 'insights') {
                          return (
                            <InsightsStructuredView
                              key={key}
                              sections={[{ key, label, items }]}
                              cardClassName={highlight ? 'rounded-xl border border-indigo-200 bg-indigo-50/60 dark:border-indigo-800/50 dark:bg-indigo-950/20 px-4 py-3' : SUMMARY_CARD_CLASS}
                              onSaveToBrain={(text) => saveSingleItemToBrain(text, tabKey, label, '')}
                              isSaved={(text) => savedItemKeys.has(itemDedupeKey(video?.youtubeId || video?.id, tabKey, text))}
                              bulkSelection={bulkSelectionShare}
                              tabScope="insights"
                            />
                          );
                        }
                        return (
                          <div key={key} className={highlight ? 'rounded-xl border border-indigo-200 bg-indigo-50/60 dark:border-indigo-800/50 dark:bg-indigo-950/20 px-4 py-3' : SUMMARY_CARD_CLASS}>
                            <UniversalTabSectionLabelRow
                              label={label}
                              items={items}
                              bulkSelection={bulkSelectionShare}
                              tabScope="insights"
                              type={tabKey}
                              sectionKey={key}
                            />
                            <LearningTabContent
                              items={items}
                              emptyLabel=""
                              onSaveToBrain={(text) => saveSingleItemToBrain(text, tabKey, label, '')}
                              isSaved={(text) => savedItemKeys.has(itemDedupeKey(video?.youtubeId || video?.id, tabKey, text))}
                              bulkSelection={mergeBulkSelection(bulkSelectionShare, {
                                idPrefix: `insights:${key}`,
                                sectionLabel: label,
                                type: tabKey,
                                tabScope: 'insights',
                              })}
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </TabsContent>

              {/* ── Useful Knowledge tab — actionItems, definitions, rules, checklists, mistakes (universal) ── */}
              <TabsContent value="useful-knowledge" className="mt-0 min-h-[320px]" dir="rtl">
                {(() => {
                  const ukShaped = extractUniversalTabContent(effectiveVideo, 'useful-knowledge', marketBriefData);
                  logUniversalTabExtractShape('useful-knowledge', ukShaped, marketBriefData);
                  const rawRules = [
                    ...(Array.isArray(effectiveVideo?.rules)          ? effectiveVideo.rules          : []),
                    ...(Array.isArray(effectiveVideo?.analysis?.rules) ? effectiveVideo.analysis.rules : []),
                  ].filter(Boolean);
                  const practicalItems = ukShaped?.mode === 'flat' && ukShaped.items.length > 0
                    ? ukShaped.items
                    : (ukShaped?.mode === 'sections' ? [] : extractUniversalTabFlatItems(effectiveVideo, 'useful-knowledge', marketBriefData));
                  const hasStructuredSections = ukShaped?.mode === 'sections' && ukShaped.sections.length > 0;

                  // Split practical items: evergreen principles vs time-sensitive market facts
                  const evergreenItems = practicalItems.filter(item => {
                    const t = typeof item === 'string' ? item : String(item?.text || item?.title || item?.content || '');
                    return !isTemporaryMarketFact(t);
                  });
                  const temporaryItems = practicalItems.filter(item => {
                    const t = typeof item === 'string' ? item : String(item?.text || item?.title || item?.content || '');
                    return isTemporaryMarketFact(t);
                  });

                  // Mental models: dedicated fields + tradingPrinciples
                  const rawMentalModels = [
                    ...(Array.isArray(effectiveVideo?.mentalModels) ? effectiveVideo.mentalModels : []),
                    ...(Array.isArray(effectiveVideo?.tradingPrinciples) ? effectiveVideo.tradingPrinciples : []),
                    ...(Array.isArray(effectiveVideo?.analysis?.mentalModels) ? effectiveVideo.analysis.mentalModels : []),
                    ...(Array.isArray(effectiveVideo?.analysis?.tradingPrinciples) ? effectiveVideo.analysis.tradingPrinciples : []),
                    ...(Array.isArray(marketBriefData?.universalTabs?.usefulKnowledge?.mentalModels)
                      ? marketBriefData.universalTabs.usefulKnowledge.mentalModels : []),
                  ].filter(Boolean);

                  // Risk management: dedicated field
                  const rawRiskMgmt = [
                    ...(Array.isArray(effectiveVideo?.riskManagement) ? effectiveVideo.riskManagement : []),
                    ...(Array.isArray(effectiveVideo?.analysis?.riskManagement) ? effectiveVideo.analysis.riskManagement : []),
                    ...(Array.isArray(marketBriefData?.universalTabs?.usefulKnowledge?.riskManagement)
                      ? marketBriefData.universalTabs.usefulKnowledge.riskManagement : []),
                  ].filter(Boolean);

                  const sections = hasStructuredSections
                    ? ukShaped.sections.map((s) => ({
                        key: `uk-${s.key}`,
                        label: s.label,
                        items: s.items,
                        tabKey: 'useful-knowledge',
                      }))
                    : [
                        {
                          key: 'reusable',
                          label: '📚 ידע לשימוש חוזר',
                          items: evergreenItems,
                          tabKey: 'useful-knowledge',
                        },
                        {
                          key: 'mental-models',
                          label: '🧩 מודלים מנטליים',
                          items: rawMentalModels,
                          tabKey: 'useful-knowledge',
                        },
                        {
                          key: 'checklists',
                          label: '✅ צ\'קליסטים',
                          items: extractVideoTabItems(effectiveVideo, 'checklists', marketBriefData),
                          tabKey: 'checklists',
                        },
                        {
                          key: 'risk',
                          label: '⚠️ ניהול סיכונים',
                          items: rawRiskMgmt,
                          tabKey: 'useful-knowledge',
                        },
                        {
                          key: 'mistakes',
                          label: '❌ טעויות נפוצות',
                          items: extractVideoTabItems(effectiveVideo, 'mistakes', marketBriefData),
                          tabKey: 'mistakes',
                        },
                        {
                          key: 'rules',
                          label: '📏 כללי מסחר',
                          items: rawRules,
                          tabKey: 'useful-knowledge',
                        },
                        {
                          key: 'temporary',
                          label: '⏳ עובדות שוק זמניות',
                          items: temporaryItems,
                          tabKey: 'useful-knowledge',
                          isTemporary: true,
                        },
                      ];
                  const populated = sections.filter(s => s.items.length > 0);
                  if (populated.length === 0) {
                    return (
                      <>
                        <TabBulkItemsRegistrar tab="useful-knowledge" items={[]} />
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-zinc-500">
                          <span className="text-3xl mb-2 opacity-30">📭</span>
                          <p className="text-sm">אין עדיין ידע שימושי — נתח את הסרטון כדי להפיק</p>
                        </div>
                      </>
                    );
                  }
                  const ukBulkItems = buildBulkItemsFromSections(populated, 'useful-knowledge');

                  return (
                    <div className="space-y-3">
                      <TabBulkItemsRegistrar tab="useful-knowledge" items={ukBulkItems} />
                      <UsefulKnowledgeSourceLine video={effectiveVideo} mentorName={mentorName} />
                      {populated.map(({ key, label, items, tabKey, isTemporary }) => (
                        <div key={key} className={`rounded-xl border px-3 py-2 ${isTemporary ? 'border-amber-200 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20' : 'border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-900'}`}>
                          <UniversalTabSectionLabelRow
                            label={label}
                            items={items}
                            bulkSelection={bulkSelectionShare}
                            tabScope="useful-knowledge"
                            type={tabKey}
                            sectionKey={key}
                          />
                          {isTemporary && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-2 text-right leading-snug px-1">
                              עובדות אלה קשורות למצב השוק הנוכחי ועשויות לאבד ערך תוך 6–12 חודשים
                            </p>
                          )}
                          <LearningTabContent
                            items={items}
                            emptyLabel=""
                            onSaveToBrain={(text) => saveSingleItemToBrain(text, tabKey, label, '')}
                            isSaved={(text) => isBrainItemSaved(text, tabKey)}
                            bulkSelection={mergeBulkSelection(bulkSelectionShare, {
                              idPrefix: `useful-knowledge:${key}`,
                              sectionLabel: label,
                              type: tabKey,
                              tabScope: 'useful-knowledge',
                            })}
                          />
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </TabsContent>

              {/* ── Obsidian mapping tab (classification metadata for brain save) ── */}
              <TabsContent value="topics-subtopics" className="mt-0 min-h-[320px]" dir="rtl">
                {(() => {
                  const topicsShaped = extractUniversalTabContent(effectiveVideo, 'topics-subtopics', marketBriefData);
                  logUniversalTabExtractShape('topics-subtopics', topicsShaped, marketBriefData);
                  const gemTopicsSections = topicsShaped?.mode === 'sections' ? topicsShaped.sections : [];
                  const gemTopicsFlat = topicsShaped?.mode === 'flat' && topicsShaped.items.length > 0
                    ? topicsShaped.items
                    : (gemTopicsSections.length === 0
                      ? extractUniversalTabFlatItems(effectiveVideo, 'topics-subtopics', marketBriefData)
                      : []);

                  const topicsBulkSections = [
                    ...gemTopicsSections.map((s) => ({ key: s.key, label: s.label, items: s.items, tabKey: 'topics-subtopics' })),
                    ...(gemTopicsFlat.length > 0 ? [{ key: 'flat', label: 'נושאים קשורים', items: gemTopicsFlat, tabKey: 'topics-subtopics' }] : []),
                  ];
                  const topicsBulkItems = buildBulkItemsFromSections(topicsBulkSections, 'topics-subtopics');

                  return (
                    <div className="space-y-3" dir="rtl">
                      <TabBulkItemsRegistrar tab="topics-subtopics" items={topicsBulkItems} />
                      {gemTopicsFlat.length > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-2">
                          <UniversalTabSectionLabelRow
                            label="נושאים קשורים"
                            items={gemTopicsFlat}
                            bulkSelection={bulkSelectionShare}
                            tabScope="topics-subtopics"
                            type="topics-subtopics"
                            sectionKey="flat"
                          />
                          <LearningTabContent
                            items={gemTopicsFlat}
                            emptyLabel=""
                            onSaveToBrain={(text) => saveSingleItemToBrain(text, 'topics-subtopics', 'נושאים קשורים', '')}
                            isSaved={(text) => isBrainItemSaved(text, 'topics-subtopics')}
                            bulkSelection={mergeBulkSelection(bulkSelectionShare, {
                              idPrefix: 'topics-subtopics:flat',
                              sectionLabel: 'נושאים קשורים',
                              type: 'topics-subtopics',
                              tabScope: 'topics-subtopics',
                            })}
                          />
                        </div>
                      )}
                    <ObsidianMappingTab
                      videoId={effectiveVideo?.id || effectiveVideo?.youtubeId || ''}
                      videoTitle={effectiveVideo?.title || ''}
                      category={effectiveVideo?.category || ''}
                      subCategory={effectiveSubCategory || effectiveVideo?.subCategory || ''}
                      tags={Array.isArray(effectiveVideo?.tags) ? effectiveVideo.tags : []}
                      obsidianTopics={Array.isArray(effectiveVideo?.obsidianTopics) ? effectiveVideo.obsidianTopics : []}
                      obsidianPath={effectiveVideo?.obsidianTopic || ''}
                      suggestedSubTopics={[
                        ...(Array.isArray(effectiveVideo?.suggestedSubTopics) ? effectiveVideo.suggestedSubTopics : []),
                        ...(Array.isArray(effectiveVideo?.analysis?.suggestedSubTopics) ? effectiveVideo.analysis.suggestedSubTopics : []),
                        ...(Array.isArray(effectiveVideo?.subTopicSuggestions) ? effectiveVideo.subTopicSuggestions : []),
                      ]}
                      relatedTopicIds={Array.isArray(effectiveVideo?.topicIds) ? effectiveVideo.topicIds : []}
                      topics={topics}
                      gemSections={gemTopicsSections}
                      gemFlat={gemTopicsFlat}
                      aiSubCategoryRec={subTopicRec}
                      gemConfidencePct={gemRec?.confidencePct ?? (subTopicRec?.confidence != null ? Math.round(subTopicRec.confidence * 100) : null)}
                      onDraftChange={(mappingDraft) => {
                        if (mappingDraft?.subCategory) {
                          setSubCategoryOverride(mappingDraft.subCategory);
                        }
                      }}
                      onConfirmRecommendation={async (recommendedSubCategory) => {
                        const sub = String(recommendedSubCategory || '').trim();
                        if (!sub) throw new Error('אין המלצה לשמירה');
                        setSubCategoryOverride(sub);
                        setSubTopicDraft(sub);
                        setSubTopicRecDismissed(true);
                        await saveVideoFields({
                          subCategory: sub,
                          dismissedSubTopicRec: null,
                          userConfirmedSubCategory: true,
                          confirmedSubCategory: sub,
                          confirmedAt: new Date().toISOString(),
                        });
                      }}
                      onRequestObsidianSave={handleRequestObsidianMappingSave}
                      obsidianAlreadySaved={hasObsidianSavedStatus(video) && isObsidianMappingCurrent}
                      savedObsidianPath={resolvedObsidianSavedPath}
                      onOpenSavedObsidian={() => openResolvedObsidianPath(resolvedObsidianSavedPath)}
                    />
                    </div>
                  );
                })()}
              </TabsContent>

              {/* ── Specialized Content tab — Phase 4: SpecializedContentRenderer ── */}
              <TabsContent value="specialized" className="mt-0 min-h-[320px]" dir="rtl">
                <SpecializedContentRenderer
                  effectiveVideo={effectiveVideo}
                  normalizedSubCategory={effectiveBriefSlug ?? normalizedSubCategory}
                  marketBriefData={marketBriefData}
                  politicalSummary={politicalSummary}
                  hasPoliticalTabSet={hasPoliticalTabSet}
                  onSaveToBrain={(text, tabKey, label) => saveSingleItemToBrain(text, tabKey, label, '')}
                  onSaveMarketBriefSection={handleSaveMarketBriefSection}
                  checkSaved={(text, tabKey) => savedItemKeys.has(itemDedupeKey(video?.youtubeId || video?.id, tabKey, text))}
                  bulkSelection={bulkSelectionShare}
                />
              </TabsContent>

              </Tabs>
            </UniversalTabBulkProvider>
              </div>{/* closes main content */}
            </div>{/* closes main content row */}
            </PanelErrorBoundary>
          </div>{/* closes max-w-[1400px] wrapper */}
          </div>{/* closes scroll width clip wrapper */}
        </ScrollArea>

        {/* ── Brain Selection Floating Bar ─────────────────────────────── */}
        {brainSelectionCount > 0 && (
          <div
            className="flex-shrink-0 flex items-center justify-between gap-3 border-t border-indigo-200 bg-indigo-50/95 dark:border-indigo-800/50 dark:bg-indigo-950/80 px-6 py-3"
            dir="rtl"
          >
            <button
              type="button"
              onClick={clearBrainSelections}
              className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
            >
              ✕ בטל בחירה
            </button>
            <div className="flex items-center gap-3">
              <span className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">
                {brainSelectionCount} פריטים נבחרו
              </span>
              <button
                type="button"
                onClick={handleSaveBrainSelections}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
              >
                🧠 שמור {brainSelectionCount} למוח
              </button>
            </div>
          </div>
        )}

        <UniversalTabSelectionBar
          count={tabBulkCount}
          onClear={multiSelectClearWithBrain}
          onBrain={handleSaveSelectedToBrain}
          onObsidian={handleBulkObsidianForTab}
          onWorkspace={handleSaveSelectedToWorkspace}
          onCopy={handleCopySelectedItems}
        />

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
                    const item = createKnowledgeItemFromVideo({ ...effectiveVideo, selectedKnowledgeItems: selectedItems }, effectiveVideo?.topicIds?.[0] ?? null);
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
                    const item = createKnowledgeItemFromVideo({ ...effectiveVideo, selectedKnowledgeItems: selectedItems }, effectiveVideo?.topicIds?.[0] ?? null);
                    if (!item) { toast.error("אין פריטים נבחרים לייצוא"); return; }
                    downloadMarkdown(item.markdown, `${(effectiveVideo?.title || 'knowledge').replace(/[^\w֐-׿\s]/g, '').trim().slice(0, 50)}-selected.md`);
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
    <Dialog
      open={isTranscriptViewerOpen}
      onOpenChange={(v) => {
        if (import.meta.env.DEV && v) {
          const recKey = resolveTranscriptGemRecommendation(effectiveVideo, effectiveGemInfo);
          console.group('%c[TranscriptModal] opened', 'color:#6366f1;font-weight:bold');
          console.log('video.id:', video?.id);
          console.log('gemOverride (savedGem):', gemOverride ?? '—');
          console.log('recommendedGemKey:', recKey ?? '—');
          console.log('effectiveGemInfo.gemKey:', effectiveGemInfo?.gemKey ?? '—');
          console.log('TRANSCRIPT_GEM_BUTTONS count:', TRANSCRIPT_GEM_BUTTONS.length);
          const gemSelectorPresent = typeof GeminiActionsPanel === 'function';
          console.log('GeminiActionsPanel rendered:', gemSelectorPresent);
          if (!gemSelectorPresent) {
            console.warn('[TranscriptModal] ⚠ Transcript GEM selector is not rendered — possible stale UI or conditional render issue.');
          }
          console.groupEnd();
        }
        setIsTranscriptViewerOpen(v);
      }}
    >
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-right text-base font-bold">
            תמלול הסרטון
          </DialogTitle>
          {import.meta.env.DEV && (
            <div className="flex items-center justify-end gap-2 mt-1">
              <span className="rounded px-1.5 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-mono font-bold">
                DEV · gem-selector · {TRANSCRIPT_GEM_BUTTONS.length} gems
              </span>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-mono hover:bg-slate-200"
                title="Force reload (clear stale UI)"
              >
                ↺ refresh
              </button>
            </div>
          )}
        </DialogHeader>
        {/* GEM indicator + link to GEM modal */}
        <div className="shrink-0 flex items-center justify-between gap-3 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-950/20 px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300">
            <span className="text-sm leading-none">{effectiveGemInfo?.gemIcon || '✨'}</span>
            <span className="font-semibold">{effectiveGemInfo?.gemLabel || 'כללי'}</span>
            {gemOverride && (
              <span className="text-[10px] text-indigo-500 dark:text-indigo-400">(בחירה ידנית)</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setIsTranscriptViewerOpen(false); setShowGemModal(true); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
          >
            🔀 שנה GEM
          </button>
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

    {/* ── GEM RAW Modal ────────────────────────────────────── */}
    <GemRawModal
      open={isGemRawOpen}
      onClose={() => setIsGemRawOpen(false)}
      video={effectiveVideo}
      marketBriefData={marketBriefData}
    />

    {/* ── GEM Selection Modal ──────────────────────────────── */}
    <GemSelectionModal
      open={showGemModal}
      onOpenChange={setShowGemModal}
      video={effectiveVideo}
      topics={videoTopics}
      recommendedGemKey={tjsRec?.recommendedGemKey || effectiveGemInfo?.gemKey || null}
      savedGemKey={gemOverride || null}
      tjsRecommendation={tjsRec}
      fullTranscriptText={fullTranscriptText}
      onSave={async (key) => {
        setGemOverride(key);
        try { await saveVideoFields({ gemOverride: key }); } catch {}
        toast.success(`Gem נשמר: ${GEM_ALT_OPTIONS.find(g => g.key === key)?.label || key}`);
      }}
      onGemOpened={(key) => {
        console.log("[GEM] opened:", key);
        if (!video?.gemSummary) {
          setNewsGemOpened(true);
          if (video?.id) localStorage.setItem(`gem-summary-waiting-${video.id}`, 'true');
        }
        setShowGemModal(false);
      }}
      onGemSummaryPaste={async (text) => {
        await saveVideoFields({ gemSummary: text });
        if (video?.id) localStorage.removeItem(`gem-summary-waiting-${video.id}`);
        setNewsGemOpened(false);
        toast.success("🟢 סיכום ה-GEM נשמר");
      }}
    />

    <ObsidianSettingsDialog
      open={obsidianSettingsOpen}
      onOpenChange={(open) => {
        setObsidianSettingsOpen(open);
        if (!open) {
          setObsidianSettingsTargetPath("");
          setObsidianSettingsAutoOpenTarget(false);
        }
      }}
      filePath={obsidianSettingsTargetPath || resolvedObsidianSavedPath || ""}
      onSaved={handleObsidianSettingsSaved}
    />

    {/* ── GEMS Settings Modal (global URL management) ──────── */}
    <GemsSettingsModal
      open={showGemsSettings}
      onOpenChange={setShowGemsSettings}
    />

    {/* ── DEV: AI Mapping Modal ────────────────────────────── */}
    {import.meta.env.DEV && (
      <AiMappingModal
        open={showAiMapping}
        onOpenChange={setShowAiMapping}
        video={effectiveVideo}
        videoType={videoType}
        visibleTabDefinitions={visibleTabDefinitions}
        category={effectiveCategory}
        subCategory={effectiveSubCategory}
        normalizedSubCategory={normalizedSubCategory}
        selectedTabsConfigKey={selectedTabsConfigKey}
        gemRec={gemRec}
        marketBriefData={marketBriefData}
        userConfirmedSubCategory={!!video?.userConfirmedSubCategory}
        confirmedSubCategory={video?.confirmedSubCategory ?? null}
        analysisExists={!!(video?.shortSummary || video?.fullSummary || marketBriefData)}
        hasTranscript={!!(video?.transcript || '').trim()}
        confirmedAt={video?.confirmedAt ?? null}
        onSaveVideoFields={saveVideoFields}
      />
    )}

    {/* ── GEM Paste Summary Dialog ─────────────────────────── */}
    <Dialog open={gemPasteOpen} onOpenChange={(v) => { if (!v) { setGemPasteOpen(false); setGemPasteText(""); } }}>
      <DialogContent dir="rtl" className="max-w-lg z-[220]">
        <DialogHeader>
          <DialogTitle className="text-right text-base font-bold">📰 הדבק סיכום מה-GEM</DialogTitle>
          <DialogDescription className="text-right text-sm text-slate-500">
            לאחר שה-GEM הפיק סיכום — העתק את הטקסט והדבק כאן כדי לשמור אותו בסרטון.
          </DialogDescription>
        </DialogHeader>
        <textarea
          dir="rtl"
          value={gemPasteText}
          onChange={(e) => setGemPasteText(e.target.value)}
          placeholder="הדבק כאן את הסיכום שה-GEM הפיק..."
          rows={9}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-right leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        {gemPasteText && !gemPasteText.trim() && (
          <p className="text-xs text-red-500">⚠ הטקסט ריק — הדבק תוכן לפני השמירה</p>
        )}
        <div className="flex justify-start gap-2 pt-1">
          <button
            type="button"
            onClick={() => { setGemPasteOpen(false); setGemPasteText(""); }}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSaveGemPaste}
            disabled={!gemPasteText.trim()}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            שמור סיכום
          </button>
        </div>
      </DialogContent>
    </Dialog>

    {/* ── Brain Destination Picker ─────────────────────────── */}
    <BrainDestinationPicker
      open={brainPickerOpen}
      variant={multiObsidianPickerMode ? "obsidian" : "brain"}
      obsidianSaveContext={obsidianPickerSaveContext}
      obsidianPackagePreview={obsidianPackagePreview}
      onOpenSaved={(path) => openResolvedObsidianPath(path)}
      onOpenChange={(open) => {
        setBrainPickerOpen(open);
        if (!open) {
          setPendingBrainSave(null);
          setMultiObsidianPickerMode(false);
          setPendingObsidianRowSave(null);
          setObsidianSaveIntent(null);
        }
      }}
      video={effectiveVideo}
      onConfirm={async ({ brainId, subBrainId, customBrainName, customSubName, subtitle, filename, path: pickerPath }) => {
        setBrainPickerOpen(false);
        if (multiObsidianPickerMode) {
          if (obsidianSaveIntent?.mode === 'mapping') {
            const mappingSub = obsidianSaveIntent.pendingSubCategory;
            setObsidianSaveIntent(null);
            setMultiObsidianPickerMode(false);
            try {
              await executeMappingObsidianSave({
                sub: mappingSub,
                savePath: pickerPath,
                subtitle: subtitle || '',
                saveEntireVideo: saveEntireVideoPackage,
              });
            } catch (err) {
              toast.error('שמירת ההמלצה ל-Obsidian נכשלה — נסה שוב', {
                description: err?.message,
              });
            }
            return;
          }

          const rowItem = pendingObsidianRowSave;
          const isRowSave = Boolean(rowItem);
          setMultiObsidianPickerMode(false);
          const folder = customBrainName || brainId || 'כללי';
          const subFolder = customSubName || subBrainId || '';
          const safeFilename = `${(filename || (video?.title || 'selected').replace(/[^\wא-ת\s]/g, '').trim().slice(0, 40))}.md`;
          const savePath = pickerPath || [folder, subFolder, safeFilename].filter(Boolean).join('/');

          const unsavedBulkItems = isRowSave
            ? []
            : [...multiSelected.values()].filter((item) => !isObsidianItemSaved({
              videoId: videoIdForQuickSave,
              tabKey: item.type || item.tabScope || 'multi',
              sectionKey: item.sectionLabel || '',
              text: item.text,
            }, { destinationPath: savePath }));

          const mergeItems = isRowSave
            ? [toObsidianMergeItem(rowItem)]
            : unsavedBulkItems.map(toObsidianMergeItem);

          if (!isRowSave && mergeItems.length === 0) {
            openResolvedObsidianPath(savePath);
            multiSelectClearWithBrain();
            return;
          }

          if (isRowSave && isObsidianItemSaved({
            videoId: videoIdForQuickSave,
            tabKey: rowItem.type || rowItem.tabScope || 'multi',
            sectionKey: rowItem.sectionLabel || '',
            text: rowItem.text,
          }, { destinationPath: savePath })) {
            openResolvedObsidianPath(savePath);
            setPendingObsidianRowSave(null);
            return;
          }

          const successMessage = isRowSave
            ? 'נשמר ל-Obsidian'
            : `${mergeItems.length} פריטים נשמרו ל-Obsidian`;

          const result = await executeObsidianVaultWrite({
            savePath,
            mode: 'merge',
            mergeItems,
            footerLines: buildObsidianMergeFooter(),
            subtitle: subtitle || '',
            successMessage,
            allowDownloadFallback: !isRowSave,
          });

          if (result.ok) {
            const savedPath = result.savedPath || savePath;
            if (isRowSave && rowItem) {
              markObsidianRowSaved({
                videoId: videoIdForQuickSave,
                tabKey: rowItem.type || rowItem.tabScope || 'multi',
                sectionKey: rowItem.sectionLabel || '',
                text: rowItem.text,
                destinationPath: savedPath,
              });
              setPendingObsidianRowSave(null);
            } else {
              mergeItems.forEach((item) => {
                const source = unsavedBulkItems.find((row) => row.text === item.text) || item;
                markObsidianRowSaved({
                  videoId: videoIdForQuickSave,
                  tabKey: source.type || source.tabScope || 'multi',
                  sectionKey: source.sectionLabel || item.sectionLabel || '',
                  text: item.text,
                  destinationPath: savedPath,
                });
              });
              multiSelectClearWithBrain();
            }
          } else if (result.fallback === 'download') {
            multiSelectClearWithBrain();
          } else if (isRowSave) {
            setPendingObsidianRowSave(null);
          }
        } else {
          // ── Save all content to brain using picker's chosen path ──
          setPendingBrainSave(null);
          const content = buildSaveAllContent();
          const savePath = pickerPath || `ידע/${filename || 'סרטון'}.md`;
          const { vaultPath: _vaultPath, vaultName: _vaultName } = getObsidianVaultRequestFields();
          const _hasUsableVaultName = hasUsableObsidianVaultName(_vaultName);
          const apiRoute = "/api/vault/write";
          try {
            const res = await fetch(apiRoute, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                path: savePath,
                content: content.markdown,
                vaultPath: _vaultPath,
                vaultName: _vaultName,
                videoTitle: video?.title,
                videoUrl: getWatchUrl(video),
                channelTitle: video?.channelTitle,
                duration: video?.duration,
                subtitle: subtitle || '',
              }),
            });
            const data = await res.json().catch(() => ({}));
            if (data.ok && data.verified === true) {
              const statusUpdated = await persistVerifiedVaultWriteStatus(data, { savePath, apiRoute });
              const savedPath = data.savedPath || savePath;
              const folderPath = savedPath.includes('/')
                ? savedPath.substring(0, savedPath.lastIndexOf('/'))
                : '';

              if (!statusUpdated) {
                toast.error("הקובץ נשמר אך לא עודכן סטטוס השמירה");
                return;
              }

              if (_hasUsableVaultName) {
                openResolvedObsidianPath(savedPath);
              } else {
                openObsidianSettingsForPath(savedPath);
              }

              toast.success(`✅ נשמר למוח — ${content.totalItems} פריטים`, {
                description: savedPath,
                duration: 10000,
                action: savedPath ? {
                  label: '📂 פתח ב-Obsidian',
                  onClick: () => { openResolvedObsidianPath(savedPath); }
                } : undefined,
                cancel: folderPath ? {
                  label: '📁 פתח תיקייה',
                  onClick: () => { openResolvedObsidianPath(folderPath); }
                } : undefined,
              });
            } else if (data.error === 'NO_VAULT_PATH') {
              openObsidianSettingsForPath(savePath, {
                autoOpenAfterSave: false,
                toastMessage: 'יש להגדיר קודם את נתיב ה-vault של Obsidian',
              });
            } else if (data.error) {
              toast.error(`שגיאה בשמירה: ${data.message || data.error}`);
            } else {
              // Vault API not available — fallback: download markdown
              const safeFilename = `${filename || 'ידע'}.md`;
              downloadMarkdown(content.markdown, safeFilename);
              toast.info(`הורדה מקומית — ${content.totalItems} פריטים (${safeFilename})`);
            }
          } catch (err) {
            console.error("OBSIDIAN SAVE ERROR", err);
            toast.error(`שגיאה בשמירה: ${err.message}`);
          }
        }
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

    {/* ── Save to Workspace Library Dialog ─────────────────── */}
    <SaveToWorkspaceDialog
      open={workspaceSaveOpen}
      onOpenChange={setWorkspaceSaveOpen}
      video={effectiveVideo}
      onSaved={({ topicName, subTopicName } = {}) => {
        setWorkspaceSaveOpen(false);
        // Propagate topic change through React Query so video cards + header refresh
        if (topicName) {
          try { saveVideoFields({ category: topicName, subCategory: subTopicName || '' }); } catch {}
        }
        toast.success('✅ הסרטון נשמר ל-Workspace Library');
      }}
    />

    {/* ── GEMS JSON Paste Dialog ────────────────────────────── */}
    <Dialog open={isGemsPasteOpen} onOpenChange={(open) => { setIsGemsPasteOpen(open); if (!open) { setGemsPasteError(""); setGemsParsedErrorInfo(null); setGemsRepairApplied(false); setGemsErrorContext(null); setGemsAiRepairResult(null); setIsAiRepairingGemsJson(false); } }}>
      <DialogContent dir="rtl" className="max-w-3xl w-[90vw] z-[200]">
        <DialogHeader>
          <DialogTitle className="text-right text-base font-bold">📥 הדבק JSON מ-GEMS</DialogTitle>
          <DialogDescription className="text-right text-sm text-slate-500">
            הדבק JSON שקיבלת מ-Gemini Gem (תוצאת ניתוח).
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-start">
          <button
            type="button"
            onClick={handleCopyGemsJson}
            disabled={!gemsPasteInput}
            className="px-3 py-1 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            {gemsCopyStatus === 'copied' ? 'הועתק ✅' : gemsCopyStatus === 'error' ? 'העתקה נכשלה' : '📋 העתק JSON'}
          </button>
        </div>
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
            setGemsPasteError(""); setGemsParsedErrorInfo(null); setGemsRepairApplied(false); setGemsErrorContext(null); setGemsAiRepairResult(null);
            if (video?.id) {
              if (val.trim()) {
                localStorage.removeItem(`gems-paste-cleared-${video.id}`);
                localStorage.setItem(`gems-paste-${video.id}`, val);
              } else {
                localStorage.removeItem(`gems-paste-${video.id}`);
              }
            }
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text');
            if (!pasted.trim()) return;
            if (video?.id) localStorage.removeItem(`gems-paste-cleared-${video.id}`);
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
        {currentGemsJsonValidation.hasValue && currentGemsJsonValidation.isValid && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 text-right flex items-center gap-1 justify-end">
            <span>✅</span>
            <span>JSON תקין</span>
          </p>
        )}
        {gemsPasteError && (
          <div className="space-y-1.5 text-right" dir="rtl">
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
              <div className="mt-1 rounded border border-red-200 dark:border-red-800 overflow-hidden" dir="ltr">
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
                    <span className="flex-1 text-right truncate" dir="rtl">{ln.text || ' '}</span>
                    {ln.isError && <span className="mr-1 text-red-400 shrink-0">◀</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {gemsAiRepairResult && (
          <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-3 text-right dark:border-sky-800/40 dark:bg-sky-950/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-sky-800 dark:text-sky-200">🤖 דוח תיקון JSON</p>
                <p className="text-[11px] text-sky-700 dark:text-sky-300">
                  מקור: {gemsAiRepairResult.source === 'ai' ? 'AI' : 'תיקון פנימי'} · {Array.isArray(gemsAiRepairResult.changes) ? gemsAiRepairResult.changes.length : 0} שינויים
                </p>
              </div>
              {gemsAiRepairResult.repairedJson && (
                <span className="text-[11px] rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  מוכן להחלה
                </span>
              )}
            </div>
            {Array.isArray(gemsAiRepairResult.changes) && gemsAiRepairResult.changes.length > 0 && (
              <ul className="space-y-1 text-[11px] text-slate-700 dark:text-zinc-300">
                {gemsAiRepairResult.changes.map((change, idx) => (
                  <li key={`${idx}:${change}`} className="leading-5">- {change}</li>
                ))}
              </ul>
            )}
            <pre className="max-h-56 overflow-auto rounded-lg border border-sky-200 bg-white/80 px-3 py-2 text-[11px] leading-5 text-slate-700 dark:border-sky-800 dark:bg-zinc-950 dark:text-zinc-200 whitespace-pre-wrap">
              {gemsAiRepairResult.report}
            </pre>
            <div className="flex flex-wrap gap-2 justify-start flex-row-reverse">
              <button
                type="button"
                onClick={handleCopyAiRepairReport}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200"
              >
                📋 העתק דוח לקודקס
              </button>
              <button
                type="button"
                onClick={handleCopyAiRepairedJson}
                disabled={!gemsAiRepairResult.repairedJson}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
              >
                📄 העתק JSON מתוקן
              </button>
              <button
                type="button"
                onClick={handleApplyAiRepairedJson}
                disabled={!gemsAiRepairResult.repairedJson}
                className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                ✅ החל תיקון ל-JSON
              </button>
              <button
                type="button"
                onClick={() => setGemsAiRepairResult(null)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300"
              >
                ביטול
              </button>
            </div>
          </div>
        )}
        {import.meta.env.DEV && (
          <div dir="ltr" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-mono text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 flex flex-wrap gap-x-4 gap-y-0.5">
            <span>parseValid: <b className={currentGemsJsonValidation.isValid ? 'text-emerald-600' : 'text-red-500'}>{String(currentGemsJsonValidation.isValid)}</b></span>
            <span>parseError: <b>{currentGemsJsonValidation.error ? currentGemsJsonValidation.error.message.slice(0, 50) : 'none'}</b></span>
            <span>parsedJson: <b>{currentGemsJsonValidation.isValid ? 'exists' : 'missing'}</b></span>
            <span>repairCandidate: <b>{gemsAiRepairResult ? 'exists' : 'missing'}</b></span>
            <span>canStart: <b className={currentGemsJsonValidation.isValid ? 'text-emerald-600' : 'text-red-500'}>{String(currentGemsJsonValidation.isValid)}</b></span>
          </div>
        )}
        <div className="flex gap-2 justify-start flex-row-reverse">
          <button
            onClick={() => { setIsGemsPasteOpen(false); setGemsPasteError(""); setGemsParsedErrorInfo(null); setGemsRepairApplied(false); setGemsErrorContext(null); setGemsAiRepairResult(null); setIsAiRepairingGemsJson(false); }}
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
            onClick={handleAiRepairGemsJson}
            disabled={!gemsPasteInput.trim() || (!gemsPasteError && !gemsParsedErrorInfo) || isAiRepairingGemsJson}
            className="px-4 py-2 text-sm border border-sky-300 bg-sky-50 text-sky-700 rounded-lg hover:bg-sky-100 disabled:opacity-50 font-medium dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-300"
          >
            {isAiRepairingGemsJson ? '🤖 מתקן ומפיק דוח...' : '🤖 תקן JSON עם AI + הפק דוח'}
          </button>
          <button
            onClick={handleApplyGemsJson}
            disabled={!currentGemsJsonValidation.isValid}
            className="px-5 py-2 text-sm bg-violet-600 text-white rounded-lg disabled:opacity-50 hover:bg-violet-700 font-semibold"
          >
            התחל ניתוח
          </button>
        </div>
      </DialogContent>
    </Dialog>

    </>
  );
}
