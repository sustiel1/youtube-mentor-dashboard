import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Database,
  ExternalLink,
  GraduationCap,
  HardDrive,
  LayoutGrid,
  Moon,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FilterBar, LibrarySearchInput } from "@/components/dashboard/FilterBar";
import { ExternalVideoModal } from "@/components/dashboard/ExternalVideoModal";
import { PdfUploader } from "@/components/upload/PdfUploader";
import { VideoDetailPanel } from "@/components/dashboard/VideoDetailPanel";
import { VideoCard } from "@/components/dashboard/VideoCard";
import { ErrorsBar } from "@/components/dashboard/ErrorsBar";
import { Skeleton } from "@/components/ui/skeleton";
import { useVideos, useSaveVideo, useUpdateLearningStatus, useAssignTopics, useDeleteVideo, useUpdateVideo } from "@/hooks/useVideos";
import { useMentors } from "@/hooks/useMentors";
import { useTopics } from "@/hooks/useTopics";
import { videoBelongsToTopicFamily, mentorBelongsToTopicFamily } from "@/lib/topicFilters";
import { getCategoryCodeForTopicName } from "@/config/topicConfig";
import { getDashboardStats, isVideoAddedOnLocalCalendarDay } from "@/services/videoAnalytics";
import { findVideoByIdOrUrl } from "@/utils/workspaceVideoGrouping";
import {
  matchesObsidianSavedFilter,
  OBSIDIAN_SAVED_FILTER_OPTIONS,
} from "@/lib/obsidianSavedStatus";
import {
  getChannelScanState,
  runChannelScan,
  subscribeToChannelScanUpdates,
} from "@/services/channelScanService";
import { getLocalStorageUsageMB, getStorageBreakdown, estimateEmbeddedTranscriptMB, stripEmbeddedTranscripts, cleanStorageCaches, clearLocalVideoData } from "@/services/videoStorage";
import { clearAllAttachments } from "@/lib/attachmentStore";
import { DriveStatusBadge } from "@/components/ui/DriveStatusBadge";
import { IndexedDbStorageWarning } from "@/components/ui/StorageStatusWidget";
import { useStorageMeter } from "@/hooks/useStorageMeter";
import { useWorkspaceItems } from "@/hooks/useWorkspaceLibrary";
import { isDriveConnected } from "@/lib/gdriveAnalysisStore";
import { saveLocalVideo } from "@/lib/localVideoStore";
import { formatStorageBytes, shortGenerationId } from "@/lib/persistence/storageMeter";
import { getObsidianVaultRequestFields, useObsidianSettingsState } from "@/lib/obsidianVaultConfig";
import { matchesVideoTitleSearch } from "@/lib/videoTitleSearch";
import { countAnalyzedVideos, filterAnalyzedVideos, isVideoAnalyzed } from "@/lib/gemsAnalyzedStatus";

function mergeSelectedVideoState(fresh, prev) {
  if (!fresh) return prev;
  if (!prev) return fresh;

  const keepIfMissing = (key, predicate = (value) => value != null && value !== "") =>
    predicate(prev[key]) && !predicate(fresh[key]) ? { [key]: prev[key] } : {};

  return {
    ...fresh,
    ...keepIfMissing("aiChapters", (value) => Array.isArray(value) && value.length > 0),
    ...keepIfMissing("chapters", (value) => Array.isArray(value) && value.length > 0),
    ...keepIfMissing("descriptionChapters", (value) => Array.isArray(value) && value.length > 0),
    ...keepIfMissing("description"),
    ...keepIfMissing("duration"),
    ...keepIfMissing("chapterSource"),
    ...keepIfMissing("analysisQuality"),
    ...keepIfMissing("shortSummary"),
    ...keepIfMissing("fullSummary"),
    ...keepIfMissing("keyPoints", (value) => Array.isArray(value) && value.length > 0),
    ...keepIfMissing("transcriptStatus"),
    ...keepIfMissing("transcriptError"),
    ...keepIfMissing("viewCount", (value) => Number.isFinite(value) && value > 0),
  };
}

// Map KPI filterKey → video status value
const KPI_STATUS_MAP = {
  new: "new",
  processing: "processing",
  summarized: "done",
  errors: "error",
};

const KPI_FILTER_LABELS = {
  today: "היום",
  permanent: "לצמיתות",
  new: "סרטונים חדשים",
  processing: "בתהליך עיבוד",
  summarized: "עברו סיכום",
  errors: "שגיאות",
};

const LEARNING_STATUS_FILTERS = [
  { value: "not_started", label: "טרם התחיל", active: "border-gray-400 bg-gray-100 text-gray-700 dark:text-white" },
  { value: "in_progress", label: "בלמידה", active: "border-amber-400 bg-amber-50 text-amber-700 dark:text-white" },
  { value: "to_review", label: "לחזרה", active: "border-purple-400 bg-purple-50 text-purple-700 dark:text-white" },
  { value: "learned", label: "נלמד", active: "border-emerald-400 bg-emerald-50 text-emerald-700 dark:text-white" },
  { value: "completed", label: "הושלם", active: "border-blue-400 bg-blue-50 text-blue-700 dark:text-white" },
];

function buildMentorYouTubeUrl(mentor) {
  if (!mentor) return null;
  const url = mentor.youtubeUrl || mentor.channelUrl || mentor.youtubePageUrl;
  if (url && url.startsWith("http")) return url;
  const handle = mentor.handle;
  if (handle) return `https://www.youtube.com/@${handle.replace(/^@/, "")}`;
  const channelId = mentor.youtubeChannelId || mentor.channelId;
  if (channelId && channelId.startsWith("UC")) return `https://www.youtube.com/channel/${channelId}`;
  return null;
}

function computeStats(videos) {
  return {
    totalNew: videos.filter((v) => v.status === "new" && !isVideoAnalyzed(v)).length,
    summarized: countAnalyzedVideos(videos),
    processing: videos.filter((v) => v.status === "processing").length,
    errors: videos.filter((v) => v.status === "error").length,
    permanentCount: videos.filter((v) => v.isPermanent).length,
  };
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 rounded-md w-full" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-10 rounded-xl" />
            {[...Array(2)].map((_, j) => (
              <Skeleton key={j} className="h-48 rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatChannelScanDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function useObsidianDashboardStatus() {
  const settings = useObsidianSettingsState();
  const [status, setStatus] = useState({ state: "checking", label: "בודק חיבור…" });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const checkConnection = async () => {
      setStatus({ state: "checking", label: "בודק חיבור…" });
      try {
        const requestFields = getObsidianVaultRequestFields();
        const response = await fetch("/api/vault/diagnostics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vaultName: settings.vaultName || requestFields.vaultName,
            vaultPath: settings.vaultPath || requestFields.vaultPath,
            filePath: "",
            createFolder: false,
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Obsidian diagnostics failed (${response.status})`);
        const diagnostics = await response.json();
        if (!active) return;
        setStatus(
          diagnostics?.vaultExists
            ? { state: "connected", label: "מחובר" }
            : { state: "disconnected", label: "לא מחובר" },
        );
      } catch (error) {
        if (!active || error?.name === "AbortError") return;
        setStatus({ state: "error", label: "שגיאת סנכרון" });
      }
    };

    void checkConnection();
    return () => {
      active = false;
      controller.abort();
    };
  }, [settings.vaultName, settings.vaultPath]);

  return status;
}

function DashboardStorageMeter({
  snapshot,
  fallbackUsageMB = 0,
  breakdown,
  onToggleBreakdown,
  onCleanCaches,
  onStripTranscripts,
  onRefresh,
  refreshing = false,
}) {
  const fallbackBytes = Math.max(0, Number(fallbackUsageMB) || 0) * 1024 * 1024;
  const usageBytes = Number.isFinite(snapshot?.usageBytes) ? snapshot.usageBytes : fallbackBytes;
  const quotaBytes = Number.isFinite(snapshot?.quotaBytes) ? snapshot.quotaBytes : null;
  const headroomBytes = Number.isFinite(snapshot?.headroomBytes) ? snapshot.headroomBytes : null;
  const actualPercent = quotaBytes > 0 ? Math.min(100, Math.max(0, (usageBytes / quotaBytes) * 100)) : null;
  const visiblePercent = usageBytes > 0 && actualPercent != null ? Math.max(1, actualPercent) : actualPercent || 0;
  const usageLabel = formatStorageBytes(usageBytes) || "לא זמין";
  const availableLabel = formatStorageBytes(headroomBytes);
  const progressText = availableLabel
    ? `${usageLabel} בשימוש, ${availableLabel} זמינים`
    : `${usageLabel} בשימוש, הקיבולת אינה זמינה`;

  return (
    <div className="relative flex w-full min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:w-auto sm:min-w-[210px] dark:border-zinc-700 dark:bg-zinc-900" data-testid="dashboard-storage-meter">
      <HardDrive className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-3 text-[11px]">
          <span className="font-semibold text-slate-800 dark:text-zinc-100">אחסון</span>
          <span className="truncate tabular-nums text-slate-500 dark:text-zinc-400">
            {snapshot?.loading ? "בודק אחסון…" : `${usageLabel} בשימוש`}
          </span>
        </div>
        <div
          role={actualPercent == null ? undefined : "progressbar"}
          aria-label="שימוש באחסון המקומי"
          aria-valuemin={actualPercent == null ? undefined : 0}
          aria-valuemax={actualPercent == null ? undefined : 100}
          aria-valuenow={actualPercent == null ? undefined : Number(actualPercent.toFixed(2))}
          aria-valuetext={progressText}
          className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700"
        >
          <div
            className="h-full rounded-full bg-gradient-to-l from-indigo-600 to-violet-500 transition-[width]"
            style={{ width: `${visiblePercent}%` }}
          />
        </div>
        <p className="mt-1 truncate text-[10px] tabular-nums text-slate-500 dark:text-zinc-400">
          {availableLabel ? `${availableLabel} זמינים` : "הקיבולת אינה זמינה"}
        </p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        aria-label="רענון נתוני האחסון"
        title="רענון נתוני האחסון"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden="true" />
      </button>
      <details
        className="group"
        onToggle={(event) => {
          if (event.currentTarget.open && !breakdown) onToggleBreakdown?.();
          if (!event.currentTarget.open && breakdown) onToggleBreakdown?.();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") event.currentTarget.open = false;
        }}
      >
        <summary className="cursor-pointer list-none rounded-lg px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
          פרטים
        </summary>
        <div className="fixed inset-x-3 top-24 z-[100] max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:min-w-[300px] dark:border-zinc-700 dark:bg-zinc-900" dir="rtl">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-slate-600 dark:text-zinc-300">
            <dt>מצב פעיל</dt><dd className="font-semibold">{snapshot?.mode === "indexedDB" ? "IndexedDB" : "localStorage"}</dd>
            <dt>שימוש משוער</dt><dd>{usageLabel}</dd>
            <dt>מכסה משוערת</dt><dd>{formatStorageBytes(quotaBytes) || "לא זמינה"}</dd>
            <dt>מקום זמין משוער</dt><dd>{availableLabel || "לא זמין"}</dd>
            <dt>התמדה</dt><dd>{snapshot?.persisted === true ? "מתמשך" : snapshot?.persisted === false ? "לא מובטח" : "לא זמין"}</dd>
            {snapshot?.mode === "indexedDB" && (
              <>
                <dt>מסד נתונים</dt><dd>{snapshot.database?.name || "לא זמין"} / v{snapshot.database?.version ?? "—"}</dd>
                <dt>דור פעיל</dt><dd className="font-mono text-[10px]" dir="ltr">{shortGenerationId(snapshot.database?.activeGenerationId) || "לא זמין"}</dd>
                <dt>רשומות Workspace</dt><dd>{snapshot.database?.workspaceRecordCount ?? "לא זמין"}</dd>
              </>
            )}
          </dl>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-zinc-800">
            <button type="button" onClick={onCleanCaches} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              נקה caches ישנים
            </button>
            {(breakdown?.embeddedTranscriptMB ?? 0) > 0.1 && (
              <button type="button" onClick={onStripTranscripts} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-amber-700 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                הסר תמלולים כפולים ({breakdown.embeddedTranscriptMB} MB)
              </button>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}

function applyFilters(videos, filters, topics, mentors = []) {
  return videos.filter((video) => {
    if (!matchesVideoTitleSearch(video.title, filters.search)) return false;
    if (filters.mentor !== "all" && video.mentorId !== filters.mentor) return false;
    if (filters.category !== "all") {
      const rootTopic = topics.find((t) => t.id === filters.category);
      // Derive the English category code from topic name (e.g. "שוק ההון" → "Markets")
      const catCode = getCategoryCodeForTopicName(rootTopic?.name);
      // 1. video.topicIds match
      const byTopicIds = videoBelongsToTopicFamily(video, filters.category, topics);
      // 2. video.category === English code (exact match, no Hebrew string comparison)
      const byVideoCategory = catCode && video.category === catCode;
      if (!byTopicIds && !byVideoCategory) {
        // 3. fallback: mentor's topicIds or category
        const mentor = mentors.find((m) => m.id === video.mentorId);
        const byMentor = mentor && (
          mentorBelongsToTopicFamily(mentor, filters.category, topics) ||
          (catCode && mentor.category === catCode)
        );
        if (!byMentor) return false;
      }
    }
    if (filters.topicId && filters.topicId !== "all") {
      const topicNode = topics.find((t) => t.id === filters.topicId);
      const catCode = getCategoryCodeForTopicName(topicNode?.name);
      const byVideoTopicIds = videoBelongsToTopicFamily(video, filters.topicId, topics);
      const byVideoCategory = catCode && video.category === catCode;
      if (!byVideoTopicIds && !byVideoCategory) {
        const mentor = mentors.find((m) => m.id === video.mentorId);
        const byMentor = mentor && (
          mentorBelongsToTopicFamily(mentor, filters.topicId, topics) ||
          (catCode && mentor.category === catCode)
        );
        if (!byMentor) return false;
      }
    }
    if (!matchesObsidianSavedFilter(video, filters.obsidianSaved)) return false;
    return true;
  });
}

// ── Smart Dashboard ───────────────────────────────────────────────────────────
// Shows KPI stats from the live video list (same source as the grid).
function SmartDashboard({
  mentors,
  videos,
  totalNew = 0,
  summarized = 0,
  permanentCount = 0,
  activeFilter,
  onFilterClick,
  onClearFilter,
  navigateTo,
  workspaceCount = 0,
  obsidianStatus,
}) {
  const stats = useMemo(() => getDashboardStats(videos, mentors), [videos, mentors]);
  if (!stats) return null;

  const Card = ({ children, onClick, isActive = false, title, testId, ariaLabel }) => {
    const Component = onClick ? "button" : "div";
    return (
      <Component
        type={onClick ? "button" : undefined}
        onClick={onClick}
        title={title}
        aria-label={ariaLabel}
        data-testid={testId}
        className={cn(
          "bg-white border border-gray-100 rounded-xl px-4 py-3 text-right transition-all",
          onClick && "cursor-pointer hover:shadow-sm hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
          "dark:bg-zinc-900/80 dark:border-zinc-800 dark:hover:shadow-black/20",
          isActive && "ring-2 ring-indigo-300 border-indigo-200 dark:ring-indigo-500/30 dark:border-indigo-500/30"
        )}
      >
        {children}
      </Component>
    );
  };

  return (
    <div className="mt-1 mb-2 space-y-3" dir="rtl">
      {/* Stats row — exact RTL order, seven live cards on desktop */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Card
          onClick={() => onFilterClick?.("today")}
          isActive={activeFilter === "today"}
          title="לחץ לסינון סרטונים שנוספו היום לדשבורד (לפי תאריך מקומי)"
        >
          <p className="text-xs text-gray-400 mb-1">היום</p>
          <p className="text-2xl font-bold text-indigo-600">{stats.newToday}</p>
          <p className="text-xs text-gray-500 mt-0.5">סרטונים חדשים</p>
        </Card>
        <Card
          onClick={() => onFilterClick?.("new")}
          isActive={activeFilter === "new"}
          title="לחץ לסינון סרטונים חדשים"
        >
          <p className="text-xs text-gray-400 mb-1">סרטונים חדשים</p>
          <p className="text-2xl font-bold text-emerald-600">{totalNew}</p>
          <p className="text-xs text-gray-500 mt-0.5">טרם נותחו</p>
        </Card>
        <Card
          onClick={() => onFilterClick?.("summarized")}
          isActive={activeFilter === "summarized"}
          title="לחץ לסינון סרטונים שעברו סיכום"
        >
          <p className="text-xs text-gray-400 mb-1">עברו סיכום</p>
          <p className="text-2xl font-bold text-blue-600">{summarized}</p>
          <p className="text-xs text-gray-500 mt-0.5">נותחו בהצלחה</p>
        </Card>
        <Card
          onClick={() => onClearFilter?.()}
          isActive={activeFilter == null}
          title="לחץ להצגת כל הסרטונים"
        >
          <p className="text-xs text-gray-400 mb-1">סה״כ שמורים</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.totalSaved}</p>
          <p className="text-xs text-gray-500 mt-0.5">ב-30 הימים האחרונים</p>
        </Card>
        <Card
          onClick={() => onFilterClick?.("permanent")}
          isActive={activeFilter === "permanent"}
          title="לחץ לסינון סרטונים שמורים לצמיתות"
        >
          <p className="text-xs text-amber-500 mb-1">📌 לצמיתות</p>
          <p className="text-2xl font-bold text-amber-600">{permanentCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">שמורים לצמיתות</p>
        </Card>
        <Card
          title={`מצב Obsidian: ${obsidianStatus?.label || "לא זמין"}`}
          ariaLabel={`Obsidian, ${obsidianStatus?.label || "לא זמין"}`}
          testId="dashboard-stat-obsidian"
        >
          <p className="mb-1 text-xs text-violet-500">Obsidian</p>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-lg text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" aria-hidden="true">◆</span>
            <p
              className={cn(
                "text-sm font-semibold",
                obsidianStatus?.state === "connected" && "text-emerald-600 dark:text-emerald-400",
                obsidianStatus?.state === "error" && "text-red-600 dark:text-red-400",
                !["connected", "error"].includes(obsidianStatus?.state) && "text-slate-600 dark:text-zinc-300",
              )}
              aria-live="polite"
            >
              {obsidianStatus?.label || "לא זמין"}
            </p>
          </div>
        </Card>
        <Card
          onClick={() => navigateTo?.("WorkspaceLibrary")}
          title="פתח את ספריית Workspace"
          ariaLabel={`פתיחת ספריית Workspace, ${workspaceCount} פריטים`}
          testId="dashboard-stat-workspace"
        >
          <p className="mb-1 text-xs text-indigo-500">Workspace</p>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{workspaceCount}</p>
              <p className="mt-0.5 text-xs text-gray-500">{workspaceCount} פריטים</p>
            </div>
            <LayoutGrid className="h-5 w-5 text-indigo-500" aria-hidden="true" />
          </div>
        </Card>
      </div>

    </div>
  );
}

export default function Dashboard({
  filters = { search: "", mentor: "all", category: "all", topicId: "all", obsidianSaved: "all" },
  setFilters,
  navigateTo,
  isDark,
  toggleTheme,
  pageParams,
}) {
  const queryClient = useQueryClient();
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isExternalVideoModalOpen, setIsExternalVideoModalOpen] = useState(false);
  const [activeDashboardFilter, setActiveDashboardFilter] = useState(null);
  const [learningStatusFilter, setLearningStatusFilter] = useState(null);
  const [isChannelScanning, setIsChannelScanning] = useState(false);
  const [channelScanInfo, setChannelScanInfo] = useState(() => getChannelScanState());
  const [channelScanProgress, setChannelScanProgress] = useState(null);
  const [channelScanError, setChannelScanError] = useState(null);
  const [storageMB, setStorageMB] = useState(() => getLocalStorageUsageMB());
  const [storageBreakdown, setStorageBreakdown] = useState(null);
  const storageMeter = useStorageMeter();
  const { items: workspaceItems } = useWorkspaceItems();
  const obsidianStatus = useObsidianDashboardStatus();
  // Keep storageWarningMB for backward compat with the banner
  const storageWarningMB = storageMeter.mode === "localStorage" && storageMB > 4
    ? storageMB.toFixed(1)
    : null;

  const refreshStorageMeter = () => {
    setStorageMB(getLocalStorageUsageMB());
    if (storageBreakdown !== null) setStorageBreakdown(getStorageBreakdown());
    void storageMeter.refresh();
  };

  // Called by PdfUploader after successful text extraction.
  // Saves the doc to the same localStorage store as YouTube videos, then opens VideoDetailPanel.
  const handlePdfDocumentCreated = (doc) => {
    const saved = saveLocalVideo(doc);
    // saveLocalVideo returns null if duplicate — fall back to the original doc object
    setSelectedVideo(saved || doc);
    setPanelOpen(true);
  };

  const handleCleanCaches = () => {
    const { removedKeys, freedMB } = cleanStorageCaches();
    setStorageMB(getLocalStorageUsageMB());
    setStorageBreakdown(getStorageBreakdown());
    void storageMeter.refresh();
    toast.success(`נוקה ${freedMB} MB (${removedKeys} מפתחות הוסרו)`);
  };

  const handleToggleBreakdown = () => {
    if (storageBreakdown) { setStorageBreakdown(null); return; }
    const bd = getStorageBreakdown();
    bd.embeddedTranscriptMB = estimateEmbeddedTranscriptMB();
    setStorageBreakdown(bd);
  };

  const handleStripTranscripts = () => {
    const { stripped, freedMB } = stripEmbeddedTranscripts();
    setStorageMB(getLocalStorageUsageMB());
    const bd = getStorageBreakdown();
    bd.embeddedTranscriptMB = estimateEmbeddedTranscriptMB();
    setStorageBreakdown(bd);
    void storageMeter.refresh();
    toast.success(`שוחרר ${freedMB} MB — תמלולים הוסרו מ-${stripped} סרטונים`);
  };

  // Close breakdown panel on Escape
  useEffect(() => {
    if (!storageBreakdown) return;
    const handler = (e) => { if (e.key === 'Escape') setStorageBreakdown(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [storageBreakdown]);

  // ── Bulk / delete-all state ──────────────────────────────
  const [selectedIds, setSelectedIds]             = useState(new Set());
  const [selectionMode, setSelectionMode]         = useState(false);
  const [deleteBulkConfirm, setDeleteBulkConfirm] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm]   = useState(false);
  const [isDeleting, setIsDeleting]               = useState(false);

  const {
    data: videos = [],
    isLoading: videosLoading,
    error: videosError,
    refetch: refetchVideos,
  } = useVideos();

  const { data: mentors = [], isLoading: mentorsLoading } = useMentors();
  const { data: topics = [] } = useTopics();

  const saveVideo = useSaveVideo();
  const updateLearningStatus = useUpdateLearningStatus();
  const assignTopics = useAssignTopics();
  const deleteVideo = useDeleteVideo();
  const updateVideo = useUpdateVideo();

  // Sync selectedVideo with list refetch — שומרים שדות שהורה עדכן בזמן אמת אם הרשימה המרוחזת עדיין חלשה/חלקית
  useEffect(() => {
    setSelectedVideo((prev) => {
      if (!prev || videos.length === 0) return prev;
      const fresh = videos.find((v) => v.id === prev.id);
      if (!fresh) return prev;
      return mergeSelectedVideoState(fresh, prev);
    });
  }, [videos]);

  // Release large video object from memory after panel close animation completes
  useEffect(() => {
    if (panelOpen) return;
    const timer = setTimeout(() => setSelectedVideo(null), 300);
    return () => clearTimeout(timer);
  }, [panelOpen]);

  // Deep-link: open a video detail from other pages (e.g. Workspace)
  useEffect(() => {
    const targetId = pageParams?.openVideoId;
    if (!targetId) return;

    const meta = pageParams?.openVideoMeta;

    // Same id-field precedence as WorkspaceLibrary's handleSourceVideoClick
    // (videoId / id / youtubeId), then a URL fallback for items saved before
    // real video records ever populated youtubeId/videoId — see
    // findVideoByIdOrUrl in utils/workspaceVideoGrouping.js.
    const existing = findVideoByIdOrUrl(videos, { targetId, targetUrl: meta?.url });
    const fallback = existing || (meta && typeof meta === "object" ? meta : null) || { id: targetId, videoId: targetId };

    setSelectedVideo((prev) => mergeSelectedVideoState(fallback, prev));
    setPanelOpen(true);
  }, [pageParams?.openVideoId, pageParams?.openVideoMeta, videos]);

  useEffect(() => {
    const unsubscribe = subscribeToChannelScanUpdates((detail) => {
      if (!detail) return;
      if (detail.state === "scanning") {
        setIsChannelScanning(true);
        setChannelScanProgress("סורק ערוצים...");
        setChannelScanError(null);
        return;
      }
      if (detail.state === "completed") {
        setIsChannelScanning(false);
        setChannelScanProgress(null);
        setChannelScanError(null);
        setChannelScanInfo({
          lastChannelScanAt: detail.lastChannelScanAt,
          nextChannelScanAt: detail.nextChannelScanAt,
          lastChannelScanSummary: detail.lastChannelScanSummary,
        });
        refetchVideos();
      }
    });
    return unsubscribe;
  }, [refetchVideos]);

  // Apply sidebar filters (search, mentor, category)
  const filteredVideos = useMemo(() => applyFilters(videos, filters, topics, mentors), [videos, filters, topics, mentors]);

  // Apply KPI status filter + learning status filter on top of sidebar filters
  const displayedVideos = useMemo(() => {
    let result = filteredVideos;
    if (activeDashboardFilter === "today") {
      result = result.filter((v) => isVideoAddedOnLocalCalendarDay(v));
    } else if (activeDashboardFilter === "permanent") {
      result = result.filter((v) => v.isPermanent);
    } else if (activeDashboardFilter === "summarized") {
      result = filterAnalyzedVideos(result);
    } else if (activeDashboardFilter === "new") {
      result = result.filter((v) => v.status === "new" && !isVideoAnalyzed(v));
    } else if (activeDashboardFilter) {
      const statusValue = KPI_STATUS_MAP[activeDashboardFilter];
      result = result.filter((v) => v.status === statusValue);
    }
    if (learningStatusFilter) {
      result = result.filter((v) => v.learningStatus === learningStatusFilter);
    }
    return result;
  }, [filteredVideos, activeDashboardFilter, learningStatusFilter]);

  const stats = useMemo(() => computeStats(videos), [videos]);
  const isLoading = videosLoading || mentorsLoading;

  // Live stats for the Learning Hub Hero
  const learningStats = useMemo(() => {
    const savedCount = videos.filter((v) => v.isSaved).length;
    const learnedCount = videos.filter((v) =>
      ["learned", "completed"].includes(v.learningStatus)
    ).length;
    const progress = savedCount > 0 ? Math.round((learnedCount / savedCount) * 100) : 0;

    const inProgressVideo = videos.find((v) => v.learningStatus === "in_progress");
    // Next step: in_progress first, else first saved not_started
    const nextVideo =
      inProgressVideo ||
      videos.find((v) => v.isSaved && v.learningStatus === "not_started") ||
      null;
    const nextTopic = nextVideo
      ? topics.find((t) => nextVideo.topicIds?.includes(t.id)) || null
      : null;

    return { savedCount, learnedCount, progress, nextVideo, nextTopic };
  }, [videos, topics]);

  const selectedMentorName = useMemo(() => {
    if (!selectedVideo) return "";
    const mentor = mentors.find((m) => m.id === selectedVideo.mentorId);
    return mentor?.name ?? "";
  }, [selectedVideo, mentors]);

  const getMentorName = (mentorId, video = null) => {
    const mentor = mentors.find((m) => m.id === mentorId);
    if (mentor?.name) return mentor.name;
    if (!video) return "";
    const handle = video.handle || video.channelHandle;
    return (
      video.mentorName ||
      video.channelName ||
      video.channelTitle ||
      video.youtubeChannelTitle ||
      video.author ||
      video.sourceTitle ||
      (handle ? `@${handle.replace(/^@/, "")}` : "") ||
      ""
    );
  };

  const getMentorChannelUrl = (mentorId, video = null) => {
    const mentor = mentors.find((m) => m.id === mentorId);
    if (mentor) {
      const url = mentor.channelUrl || mentor.youtubeUrl || mentor.youtubePageUrl;
      if (url && url.startsWith("http")) return url;
      const handle = mentor.handle;
      if (handle) return `https://www.youtube.com/@${handle.replace(/^@/, "")}`;
      const channelId = mentor.youtubeChannelId || mentor.channelId;
      if (channelId && channelId.startsWith("UC")) return `https://www.youtube.com/channel/${channelId}`;
    }
    // Fallback: use channel data stored directly on the video
    const videoUrl = video?.channelUrl || video?.youtubeUrl || video?.youtubePageUrl;
    if (videoUrl && videoUrl.startsWith("http")) return videoUrl;
    const handle = video?.handle || video?.channelHandle;
    if (handle) return `https://www.youtube.com/@${handle.replace(/^@/, "")}`;
    const channelId = video?.youtubeChannelId || video?.channelId;
    if (channelId && channelId.startsWith("UC")) return `https://www.youtube.com/channel/${channelId}`;
    return null;
  };

  const handleVideoClick = (video) => {
    setSelectedVideo(video);
    setPanelOpen(true);
  };

  const handleVideoPatch = (patch) => {
    const patchedVideoId = patch?.id || selectedVideo?.id;
    setSelectedVideo((prev) => {
      if (!prev) return null;
      // A patch naming a different video's id is a stale async result (transcript
      // fetch, AI analysis, fresh-import pipeline) from a video the user has since
      // navigated away from — applying it would silently swap the open panel to
      // that other video. See TRADINGBRAIN-ADDBYLINK-VIDEO-MISMATCH.
      if (patch?.id && prev.id && patch.id !== prev.id) return prev;
      return { ...prev, ...patch };
    });
    if (!patchedVideoId) return;
    queryClient.setQueryData(['videos'], (current) => (
      Array.isArray(current)
        ? current.map((item) => (item.id === patchedVideoId ? { ...item, ...patch } : item))
        : current
    ));
  };

  const handleSaveToggle = (video) => {
    saveVideo.mutate({ id: video.id, isSaved: !video.isSaved });
    if (selectedVideo?.id === video.id) {
      setSelectedVideo({ ...video, isSaved: !video.isSaved });
    }
  };

  const handlePermanentToggle = (video) => {
    const wasPinned = video.isPermanent;
    const patch = {
      id: video.id,
      isPermanent: !wasPinned,
      // Stamp unpinnedAt when removing pin so the 30-day grace period starts
      ...(wasPinned ? { unpinnedAt: new Date().toISOString() } : { unpinnedAt: null }),
    };
    updateVideo.mutate(patch);
    if (selectedVideo?.id === video.id) {
      setSelectedVideo({ ...video, ...patch });
    }
  };

  const handleLearningStatusChange = (video, status) => {
    updateLearningStatus.mutate({ id: video.id, learningStatus: status });
    if (selectedVideo?.id === video.id) {
      setSelectedVideo({ ...video, learningStatus: status });
    }
  };

  const handleDeleteVideo = (video) => {
    if (isDriveConnected() && video?.cloudBackupFileId) {
      const title = String(video.title || '').trim().slice(0, 60);
      const confirmed = window.confirm(
        `מחק את "${title}"?\n\nהסרטון וגיבוי ה-Drive שלו יימחקו לצמיתות.`
      );
      if (!confirmed) return;
    }
    deleteVideo.mutate(video.id);
    if (selectedVideo?.id === video.id) setPanelOpen(false);
  };

  const handleRemoveTopic = (video, topicId) => {
    const newTopicIds = (video.topicIds || []).filter((id) => id !== topicId);
    assignTopics.mutate({ id: video.id, topicIds: newTopicIds });
    if (selectedVideo?.id === video.id) {
      setSelectedVideo({ ...video, topicIds: newTopicIds });
    }
  };

  const handleRefresh = async () => {
    await refetchVideos();
    toast.success("הנתונים עודכנו");
  };

  const handleManualChannelScan = async () => {
    if (isChannelScanning) return;
    setIsChannelScanning(true);
    setChannelScanProgress("סורק ערוצים...");
    setChannelScanError(null);
    try {
      const result = await runChannelScan(mentors, {
        reason: "manual",
        force: true,
      });
      await refetchVideos();
      setChannelScanInfo({
        lastChannelScanAt: result.lastChannelScanAt,
        nextChannelScanAt: result.nextChannelScanAt,
        lastChannelScanSummary: result.lastChannelScanSummary,
      });

      const summary = result.lastChannelScanSummary;
      if (summary) {
        toast.success(
          `נסרקו ${summary.scannedChannels} ערוצים · נוספו ${summary.addedCount} סרטונים חדשים · ${summary.existingCount} סרטונים כבר קיימים · נכשלו ${summary.failedCount} ערוצים`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "שגיאה בסריקת הערוצים";
      setChannelScanError(message);
      toast.error(message);
    } finally {
      setIsChannelScanning(false);
      setChannelScanProgress(null);
    }
  };

  // ── Selection helpers ────────────────────────────────────
  const toggleSelectVideo = (videoId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId); else next.add(videoId);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(
      selectedIds.size === displayedVideos.length
        ? new Set()
        : new Set(displayedVideos.map((v) => v.id))
    );
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setDeleteBulkConfirm(false);
    setDeleteAllConfirm(false);
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    setIsDeleting(true);
    try {
      for (const id of selectedIds) {
        await deleteVideo.mutateAsync(id);
      }
      toast.success(`נמחקו ${count} סרטונים בהצלחה`);
      exitSelectionMode();
    } catch {
      toast.error("שגיאה במחיקה — נסה שוב");
    } finally {
      setIsDeleting(false);
      setDeleteBulkConfirm(false);
    }
  };

  const handleDeleteAll = async () => {
    const count = videos.length;
    setIsDeleting(true);
    try {
      // 1. Remove all video records + per-video analysis keys from localStorage
      for (const v of displayedVideos) {
        try { localStorage.removeItem(`ai_analysis_${v.id}`); } catch {}
        try { localStorage.removeItem(`analysis:${v.id}`); } catch {}
      }
      // Use bulk clear instead of one-by-one mutation (much faster, same result)
      clearLocalVideoData();

      // 2. Clear all IndexedDB attachments
      await clearAllAttachments();

      // 3. Refresh UI
      await refetchVideos();
      refreshStorageMeter();
      toast.success(`נמחקו ${count} סרטונים + כל הנתונים הקשורים`);
      exitSelectionMode();
    } catch (err) {
      toast.error("שגיאה במחיקה — נסה שוב");
      console.error("[deleteAll]", err);
    } finally {
      setIsDeleting(false);
      setDeleteAllConfirm(false);
    }
  };

  // Toggle KPI filter — click same → clear, click different → switch
  const handleKpiFilterClick = (filterKey) => {
    setActiveDashboardFilter((prev) => (prev === filterKey ? null : filterKey));
  };
  const clearKpiFilter = () => setActiveDashboardFilter(null);

  if (videosError && !isLoading) {
    toast.error("שגיאה בטעינת הנתונים");
  }

  const lastChannelScanSummary = channelScanInfo.lastChannelScanSummary;
  const channelScanSummaryText = lastChannelScanSummary
    ? `נסרקו ${lastChannelScanSummary.scannedChannels} ערוצים · נוספו ${lastChannelScanSummary.addedCount} סרטונים חדשים · ${lastChannelScanSummary.existingCount} סרטונים כבר קיימים · נכשלו ${lastChannelScanSummary.failedCount} ערוצים`
    : null;
  const failedScanCount = Number(lastChannelScanSummary?.failedCount || 0);
  const existingScanCount = Number(lastChannelScanSummary?.existingCount || 0);
  const channelScanStatus = channelScanError
    ? { label: "שגיאת סריקה", tone: "error", detail: channelScanError }
    : isChannelScanning
      ? { label: channelScanProgress || "סורק ערוצים…", tone: "running", detail: "הסריקה הידנית פעילה" }
      : !lastChannelScanSummary
        ? { label: "טרם בוצעה סריקה", tone: "idle", detail: "אין נתוני סריקה עדיין" }
        : failedScanCount > 0
          ? { label: "הושלם עם שגיאות", tone: "warning", detail: channelScanSummaryText }
          : { label: "הכול מעודכן", tone: "success", detail: channelScanSummaryText };

  return (
    <div data-testid="page-dashboard" className="min-h-screen text-slate-900 dark:text-white">
      <header className="sticky top-0 z-40 bg-slate-50/95 px-3 py-3 backdrop-blur-xl sm:px-6 dark:bg-zinc-950/95">
        <div
          className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          dir="rtl"
          data-testid="dashboard-control-panel"
        >
          <div className="flex flex-wrap items-stretch gap-2 border-b border-slate-200 p-3 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => navigateTo?.("Admin")}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-indigo-300 bg-white px-3 py-2 text-xs font-semibold text-indigo-800 transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-indigo-500/60 dark:bg-zinc-900 dark:text-indigo-200 dark:hover:bg-indigo-500/10"
              aria-label="פתיחת הגדרות וניהול המערכת"
              title="פתיחת הגדרות וניהול המערכת"
              data-testid="dashboard-management-shortcut"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <Settings className="h-4 w-4" aria-hidden="true" />
              <span>מרכז הבקרה</span>
            </button>

            <div
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold",
                storageMeter.mode === "indexedDB"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
              )}
              data-testid="dashboard-storage-mode"
            >
              <Database className="h-4 w-4" aria-hidden="true" />
              <span>{storageMeter.mode === "indexedDB" ? "IndexedDB פעיל" : "localStorage פעיל"}</span>
            </div>

            <div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
              <DriveStatusBadge />
            </div>

            <button
              type="button"
              onClick={handleManualChannelScan}
              disabled={isChannelScanning}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-indigo-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label={isChannelScanning ? "סריקת ערוצים מתבצעת" : "סרוק עכשיו"}
              data-testid="dashboard-scan-now"
            >
              <RefreshCw className={cn("h-4 w-4", isChannelScanning && "animate-spin")} aria-hidden="true" />
              <span>{isChannelScanning ? "סורק עכשיו…" : "סרוק עכשיו"}</span>
            </button>

            <DashboardStorageMeter
              snapshot={storageMeter.snapshot}
              fallbackUsageMB={storageMB}
              breakdown={storageBreakdown}
              onToggleBreakdown={handleToggleBreakdown}
              onCleanCaches={handleCleanCaches}
              onStripTranscripts={handleStripTranscripts}
              onRefresh={() => { handleRefresh(); refreshStorageMeter(); }}
              refreshing={isLoading}
            />

            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              title={isDark ? "עבור למצב בהיר" : "עבור למצב כהה"}
              aria-label={isDark ? "עבור למצב בהיר" : "עבור למצב כהה"}
              data-testid="dashboard-theme-toggle"
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
              <span>{isDark ? "מצב בהיר" : "מצב כהה"}</span>
            </button>

            <button
              type="button"
              onClick={() => setDeleteAllConfirm(true)}
              disabled={videos.length === 0 || isDeleting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 xl:mr-auto dark:border-red-500/50 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-500/10"
              title="מחיקת כל נתוני הסרטונים המקומיים"
              data-testid="dashboard-delete-all"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>מחק הכול</span>
            </button>
          </div>

          <div className="hidden grid-cols-2 divide-x divide-x-reverse divide-slate-200 px-2 py-2 md:grid lg:grid-cols-3 xl:grid-cols-6 dark:divide-zinc-800">
            <div className="flex min-w-0 items-center gap-2 px-3 py-1.5">
              <Clock className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500 dark:text-zinc-400">סריקה אחרונה</p>
                <p className="truncate text-xs font-semibold tabular-nums text-slate-800 dark:text-zinc-100" dir="ltr">{formatChannelScanDate(channelScanInfo.lastChannelScanAt)}</p>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2 px-3 py-1.5">
              <CalendarClock className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500 dark:text-zinc-400">סריקה הבאה</p>
                <p className="truncate text-xs font-semibold tabular-nums text-slate-800 dark:text-zinc-100" dir="ltr">{formatChannelScanDate(channelScanInfo.nextChannelScanAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5">
              <AlertTriangle className={cn("h-4 w-4 shrink-0", failedScanCount > 0 ? "text-red-500" : "text-slate-400")} aria-hidden="true" />
              <div>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400">נכשלו</p>
                <p className={cn("text-xs font-semibold tabular-nums", failedScanCount > 0 ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-zinc-100")}>{failedScanCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden="true" />
              <div>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400">פריטים כבר קיימים</p>
                <p className="text-xs font-semibold tabular-nums text-slate-800 dark:text-zinc-100">{existingScanCount}</p>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2 px-3 py-1.5" role="status" aria-live="polite" title={channelScanStatus.detail || undefined}>
              {channelScanStatus.tone === "error" || channelScanStatus.tone === "warning"
                ? <AlertTriangle className={cn("h-4 w-4 shrink-0", channelScanStatus.tone === "error" ? "text-red-500" : "text-amber-500")} aria-hidden="true" />
                : <CheckCircle2 className={cn("h-4 w-4 shrink-0", channelScanStatus.tone === "success" ? "text-emerald-500" : "text-indigo-500")} aria-hidden="true" />}
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500 dark:text-zinc-400">מצב</p>
                <p className={cn(
                  "truncate text-xs font-semibold",
                  channelScanStatus.tone === "success" && "text-emerald-600 dark:text-emerald-400",
                  channelScanStatus.tone === "error" && "text-red-600 dark:text-red-400",
                  channelScanStatus.tone === "warning" && "text-amber-600 dark:text-amber-400",
                  ["idle", "running"].includes(channelScanStatus.tone) && "text-indigo-600 dark:text-indigo-300",
                )}>{channelScanStatus.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5">
              <RefreshCw className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden="true" />
              <div>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400">סריקה אוטומטית</p>
                <p className="text-xs font-semibold text-slate-800 dark:text-zinc-100">כל 8 שעות</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-3 py-2 md:hidden">
            <div className="min-w-0" role="status" aria-live="polite">
              <p className="truncate text-xs font-semibold text-slate-800 dark:text-zinc-100">{channelScanStatus.label}</p>
              <p className="truncate text-[10px] tabular-nums text-slate-500 dark:text-zinc-400">
                אחרונה: {formatChannelScanDate(channelScanInfo.lastChannelScanAt)}
              </p>
            </div>
            <details className="relative shrink-0">
              <summary className="cursor-pointer list-none rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:text-zinc-200">
                פרטים
              </summary>
              <div className="absolute left-0 top-full z-50 mt-2 w-[min(310px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-slate-600 dark:text-zinc-300">
                  <dt>סריקה אחרונה</dt><dd className="text-left tabular-nums" dir="ltr">{formatChannelScanDate(channelScanInfo.lastChannelScanAt)}</dd>
                  <dt>סריקה הבאה</dt><dd className="text-left tabular-nums" dir="ltr">{formatChannelScanDate(channelScanInfo.nextChannelScanAt)}</dd>
                  <dt>נכשלו</dt><dd>{failedScanCount}</dd>
                  <dt>פריטים קיימים</dt><dd>{existingScanCount}</dd>
                  <dt>מצב</dt><dd>{channelScanStatus.label}</dd>
                  <dt>תזמון</dt><dd>כל 8 שעות</dd>
                </dl>
                {channelScanSummaryText && <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] leading-relaxed text-slate-500 dark:border-zinc-800 dark:text-zinc-400">{channelScanSummaryText}</p>}
              </div>
            </details>
          </div>
        </div>
      </header>

      <IndexedDbStorageWarning snapshot={storageMeter.snapshot} />
      {storageMeter.mode === "localStorage" && storageWarningMB && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2 dark:border-amber-500/30 dark:bg-amber-500/10" dir="rtl">
          <span className="text-xs text-amber-700 dark:text-amber-300">
            ⚠️ אחסון מקומי כמעט מלא ({storageWarningMB} MB מתוך ~5 MB) — שקול למחוק סרטונים ישנים
          </span>
          <button onClick={() => setStorageWarningMB(null)} className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 shrink-0">✕</button>
        </div>
      )}

      <main className="px-6 pb-6 pt-1">
        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <LibrarySearchInput
              filters={filters}
              onFiltersChange={setFilters}
              className="relative w-full"
              inputClassName="h-10 rounded-xl shadow-sm"
            />

            <SmartDashboard
              mentors={mentors}
              videos={videos}
              totalNew={stats.totalNew}
              summarized={stats.summarized}
              permanentCount={stats.permanentCount}
              activeFilter={activeDashboardFilter}
              onFilterClick={handleKpiFilterClick}
              onClearFilter={clearKpiFilter}
              navigateTo={navigateTo}
              workspaceCount={workspaceItems.length}
              obsidianStatus={obsidianStatus}
            />

            {(activeDashboardFilter
              || (filters.topicId && filters.topicId !== "all")
              || (filters.obsidianSaved && filters.obsidianSaved !== "all")
              || filteredVideos.length !== videos.length) && (
              <div className="mt-3 flex flex-wrap items-center gap-2" dir="rtl" data-testid="dashboard-active-filters">
                {activeDashboardFilter && (
                  <button
                    type="button"
                    onClick={() => setActiveDashboardFilter(null)}
                    className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-300"
                  >
                    <span>מסנן: {KPI_FILTER_LABELS[activeDashboardFilter]}</span>
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
                {filters.topicId && filters.topicId !== "all" && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, topicId: "all" }))}
                    className="flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs text-violet-700 transition-colors hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-violet-500/10 dark:text-violet-300"
                  >
                    <span>נושא: {topics.find((topic) => topic.id === filters.topicId)?.name || "…"}</span>
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
                {filters.obsidianSaved && filters.obsidianSaved !== "all" && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, obsidianSaved: "all" }))}
                    className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-300"
                  >
                    <span>{OBSIDIAN_SAVED_FILTER_OPTIONS.find((option) => option.value === filters.obsidianSaved)?.label || "מסנן Obsidian"}</span>
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
                {filteredVideos.length !== videos.length && !activeDashboardFilter && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {filteredVideos.length} לאחר סינון
                  </span>
                )}
                {activeDashboardFilter && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {displayedVideos.length} סרטונים
                  </span>
                )}
              </div>
            )}

            {/* Unified compact control row (Learning Center + filters + selection mode) */}
            <div
              dir="rtl"
              className="mt-4 mb-3 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-sm backdrop-blur flex flex-row items-center gap-3 flex-nowrap overflow-x-auto dark:border-zinc-800/80 dark:bg-zinc-950/70 dark:shadow-2xl"
            >
              {/* Manual add by URL — same toolbar row as filters */}
              <button
                type="button"
                title="הוסף סרטון לפי קישור YouTube (גם אם לא נמצא בסריקת הערוץ)"
                onClick={() => setIsExternalVideoModalOpen(true)}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
              >
                <Plus className="h-4 w-4 shrink-0 stroke-[2.5]" />
                <span className="whitespace-nowrap">הוסף סרטון</span>
              </button>

              {/* PDF upload — extracts text client-side and opens in VideoDetailPanel */}
              <PdfUploader onDocumentCreated={handlePdfDocumentCreated} />

              <FilterBar
                compact
                showSearch={false}
                filters={filters}
                onFiltersChange={setFilters}
                mentors={mentors.filter((m) => m.active)}
                topics={topics}
              />

              {/* YouTube channel link — shown only when a specific mentor is selected */}
              {filters.mentor !== "all" && (() => {
                const selectedMentor = mentors.find((m) => m.id === filters.mentor);
                const ytUrl = buildMentorYouTubeUrl(selectedMentor);
                if (!ytUrl) return null;
                return (
                  <a
                    href={ytUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-red-200/80 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                    title={`פתח ערוץ יוטיוב של ${selectedMentor?.name}`}
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="whitespace-nowrap">ערוץ המנטור</span>
                  </a>
                );
              })()}

              <button
                type="button"
                onClick={() => navigateTo?.("LearningHub")}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 transition-colors dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
              >
                <span className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                  <GraduationCap className="h-4 w-4 text-red-500" />
                </span>
                <span className="whitespace-nowrap">מרכז הלמידה</span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-300 whitespace-nowrap">
                  {learningStats.progress}% · {learningStats.savedCount}
                </span>
                <span className="inline-flex items-center gap-1 text-red-500 dark:text-red-300 whitespace-nowrap">
                  <Play className="h-3.5 w-3.5 fill-current" />
                  {learningStats.nextVideo?.learningStatus === "in_progress" ? "המשך" : "התחל"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => window.open("https://www.youtube.com/", "_blank", "noopener,noreferrer")}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 transition-colors dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
              >
                <span className="w-5 h-5 rounded-md bg-red-600 flex items-center justify-center shrink-0">
                  <Play className="h-3 w-3 text-white fill-white" />
                </span>
                <span className="whitespace-nowrap">הערוץ שלי ביוטיוב</span>
              </button>

              <button
                onClick={() => { setSelectionMode((p) => !p); if (selectionMode) exitSelectionMode(); }}
                className={cn(
                  "shrink-0 text-xs px-3 py-2 rounded-xl border transition-colors whitespace-nowrap",
                  selectionMode
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-200"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
                )}
              >
                {selectionMode ? "בטל בחירה" : "בחר סרטונים"}
              </button>
            </div>

            {/* ── Selection toolbar (only when selectionMode) ── */}
            {selectionMode && (
              <div className="flex items-center gap-2 mb-3 flex-row-reverse" dir="rtl">
                <button
                  onClick={handleSelectAll}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {selectedIds.size === displayedVideos.length ? "בטל הכל" : "בחר הכל"}
                </button>
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => setDeleteBulkConfirm(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                  >
                    <Trash2 className="h-3 w-3" />
                    מחק נבחרים ({selectedIds.size})
                  </button>
                )}
              </div>
            )}

            {/* ── Confirm: bulk delete ── */}
            {deleteBulkConfirm && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-4" dir="rtl">
                <p className="text-sm text-red-700 font-medium">
                  האם למחוק {selectedIds.size} סרטונים? פעולה זו אינה הפיכה.
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {isDeleting ? "מוחק..." : "כן, מחק"}
                  </button>
                  <button
                    onClick={() => setDeleteBulkConfirm(false)}
                    className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}

            {/* ── Confirm: delete all ── */}
            {deleteAllConfirm && (
              <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3" dir="rtl" role="alertdialog" aria-modal="true" aria-labelledby="delete-all-confirmation-title" aria-describedby="delete-all-confirmation-description">
                <div>
                  <p id="delete-all-confirmation-title" className="text-sm font-semibold text-red-800">
                    מחיקת כל נתוני הסרטונים המקומיים
                  </p>
                  <p id="delete-all-confirmation-description" className="mt-1 text-xs leading-relaxed text-red-700">
                    הפעולה תמחק {videos.length} רשומות סרטון מקומיות, מטמוני ניתוח AI, תמלולים ופרקים, ואת כל קבצי ה־attachment ב־IndexedDB. נושאים, מנטורים, קטגוריות, הגדרות ופריטי Workspace לא יימחקו. לא ניתן לשחזר פעולה זו.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleDeleteAll}
                    disabled={isDeleting}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {isDeleting ? "מוחק..." : "כן, מחק הכל"}
                  </button>
                  <button
                    onClick={() => setDeleteAllConfirm(false)}
                    className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}

            {/* Errors view — only when "שגיאות" KPI is active */}
            {activeDashboardFilter === "errors" ? (
              <ErrorsBar
                errorVideos={displayedVideos}
                mentors={mentors}
                onVideoClick={handleVideoClick}
                forceExpanded
              />
            ) : displayedVideos.length === 0 ? (
              <div className="text-center py-16 text-sm text-zinc-500">
                אין סרטונים להציג
              </div>
            ) : (
              /* Unified grid — all videos, filtered by active KPI / learning status */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 [&>*]:h-full [&>*]:min-h-0">
                {displayedVideos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    mentorName={getMentorName(video.mentorId, video)}
                    mentorChannelUrl={getMentorChannelUrl(video.mentorId, video)}
                    topics={topics}
                    onClick={selectionMode ? () => toggleSelectVideo(video.id) : handleVideoClick}
                    onSaveToggle={selectionMode ? undefined : handleSaveToggle}
                    onPermanentToggle={selectionMode ? undefined : handlePermanentToggle}
                    onDelete={selectionMode ? undefined : handleDeleteVideo}
                    isSelected={selectedIds.has(video.id)}
                    onSelect={selectionMode ? toggleSelectVideo : undefined}
                    isOpponentView={mentors.find((m) => m.id === video.mentorId)?.isOpponentView === true}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <VideoDetailPanel
        video={selectedVideo}
        mentorName={selectedMentorName}
        mentors={mentors.filter((m) => m.active !== false)}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        topics={topics}
        onSaveToggle={handleSaveToggle}
        onLearningStatusChange={handleLearningStatusChange}
        onRemoveTopic={handleRemoveTopic}
        onAnalyzeDone={(result) => setSelectedVideo((prev) => ({ ...prev, ...result }))}
        onVideoPatch={handleVideoPatch}
        isDark={isDark}
        toggleTheme={toggleTheme}
        navigateTo={navigateTo}
      />

      <ExternalVideoModal
        open={isExternalVideoModalOpen}
        onClose={() => setIsExternalVideoModalOpen(false)}
        mentors={mentors.filter((m) => m.active)}
        topics={topics}
        onVideoAdded={(video) => {
          setIsExternalVideoModalOpen(false);
          setSelectedVideo(video);
          setPanelOpen(true);
        }}
      />
    </div>
  );
}
