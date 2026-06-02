import { useState, useMemo, useEffect } from "react";
import { RefreshCw, X, GraduationCap, Play, Trash2, Moon, Sun, Plus, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { ExternalVideoModal } from "@/components/dashboard/ExternalVideoModal";
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
import { isDriveConnected } from "@/lib/gdriveAnalysisStore";

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
    totalNew: videos.filter((v) => v.status === "new").length,
    summarized: videos.filter((v) => v.status === "done").length,
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

function applyFilters(videos, filters, topics, mentors = []) {
  return videos.filter((video) => {
    if (filters.search && !video.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
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
}) {
  const stats = useMemo(() => getDashboardStats(videos, mentors), [videos, mentors]);
  if (!videos.length || !stats) return null;

  const Card = ({ children, onClick, isActive = false, title }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "bg-white border border-gray-100 rounded-xl px-4 py-3 text-right transition-all cursor-pointer hover:shadow-sm hover:-translate-y-0.5",
        "dark:bg-zinc-900/80 dark:border-zinc-800 dark:hover:shadow-black/20",
        isActive && "ring-2 ring-indigo-300 border-indigo-200 dark:ring-indigo-500/30 dark:border-indigo-500/30"
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="mt-4 mb-2 space-y-3" dir="rtl">
      {/* Stats row — 5 cards, single row on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isExternalVideoModalOpen, setIsExternalVideoModalOpen] = useState(false);
  const [activeDashboardFilter, setActiveDashboardFilter] = useState(null);
  const [learningStatusFilter, setLearningStatusFilter] = useState(null);
  const [isChannelScanning, setIsChannelScanning] = useState(false);
  const [channelScanInfo, setChannelScanInfo] = useState(() => getChannelScanState());
  const [channelScanProgress, setChannelScanProgress] = useState(null);
  const [storageMB, setStorageMB] = useState(() => getLocalStorageUsageMB());
  const [storageBreakdown, setStorageBreakdown] = useState(null);
  // Keep storageWarningMB for backward compat with the banner
  const storageWarningMB = storageMB > 4 ? storageMB.toFixed(1) : null;

  const refreshStorageMeter = () => {
    setStorageMB(getLocalStorageUsageMB());
    if (storageBreakdown !== null) setStorageBreakdown(getStorageBreakdown());
  };

  const handleCleanCaches = () => {
    const { removedKeys, freedMB } = cleanStorageCaches();
    setStorageMB(getLocalStorageUsageMB());
    setStorageBreakdown(getStorageBreakdown());
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

    const existing =
      videos.find((v) => v.videoId === targetId) ||
      videos.find((v) => v.id === targetId) ||
      null;

    const meta = pageParams?.openVideoMeta;
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
        return;
      }
      if (detail.state === "completed") {
        setIsChannelScanning(false);
        setChannelScanProgress(null);
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
      toast.error(error instanceof Error ? error.message : "שגיאה בסריקת הערוצים");
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
    const count = displayedVideos.length;
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

  return (
    <div data-testid="page-dashboard" className="min-h-screen text-slate-900 dark:text-white">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/90">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Active KPI filter indicator */}
              {activeDashboardFilter && (
                <button
                  onClick={() => setActiveDashboardFilter(null)}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 rounded-full px-3 py-1 hover:bg-indigo-100 transition-colors"
                >
                  <span>מסנן: {KPI_FILTER_LABELS[activeDashboardFilter]}</span>
                  <X className="h-3 w-3" />
                </button>
              )}
              {filters.topicId && filters.topicId !== "all" && (
                <button
                  onClick={() => setFilters((prev) => ({ ...prev, topicId: "all" }))}
                  className="flex items-center gap-1.5 text-xs text-violet-600 bg-violet-50 rounded-full px-3 py-1 hover:bg-violet-100 transition-colors"
                >
                  <span>נושא: {topics.find((t) => t.id === filters.topicId)?.name || "..."}</span>
                  <X className="h-3 w-3" />
                </button>
              )}
              {filters.obsidianSaved && filters.obsidianSaved !== "all" && (
                <button
                  onClick={() => setFilters((prev) => ({ ...prev, obsidianSaved: "all" }))}
                  className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-full px-3 py-1 hover:bg-emerald-100 transition-colors dark:text-emerald-300 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/40"
                >
                  <span>
                    {OBSIDIAN_SAVED_FILTER_OPTIONS.find((o) => o.value === filters.obsidianSaved)?.label || "מוח"}
                  </span>
                  <X className="h-3 w-3" />
                </button>
              )}
              {filteredVideos.length !== videos.length && !activeDashboardFilter && !filters.topicId?.length && (
                <span className="text-xs text-indigo-600 bg-indigo-50 rounded-full px-3 py-1">
                  {filteredVideos.length} לאחר סינון
                </span>
              )}
              {activeDashboardFilter && (
                <span className="text-xs text-gray-400 bg-gray-50 rounded-full px-3 py-1">
                  {displayedVideos.length} סרטונים
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden lg:flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-2 text-[11px] backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/70">
                <div className="flex items-center gap-3 text-right" dir="rtl">
                  <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                    <span className="text-slate-500 dark:text-zinc-400">סריקה אוטומטית</span>
                    <span className="font-semibold text-cyan-700 dark:text-cyan-300">כל 8 שעות</span>
                  </div>
                  <span className="h-4 w-px bg-slate-200 dark:bg-zinc-700" />
                  <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                    <span className="text-slate-500 dark:text-zinc-400">סריקה אחרונה</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                      {formatChannelScanDate(channelScanInfo.lastChannelScanAt)}
                    </span>
                  </div>
                  <span className="h-4 w-px bg-slate-200 dark:bg-zinc-700" />
                  <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                    <span className="text-slate-500 dark:text-zinc-400">סריקה הבאה</span>
                    <span className="font-semibold text-sky-700 dark:text-sky-300">
                      {formatChannelScanDate(channelScanInfo.nextChannelScanAt)}
                    </span>
                  </div>
                  <span className="h-4 w-px bg-slate-200 dark:bg-zinc-700" />
                  <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                    <span className="text-slate-500 dark:text-zinc-400">סטטיסטיקת סריקה</span>
                    <span
                      className={cn(
                        "max-w-[360px] truncate font-semibold",
                        isChannelScanning
                          ? "text-violet-700 dark:text-violet-300"
                          : "text-fuchsia-700 dark:text-fuchsia-300"
                      )}
                    >
                      {isChannelScanning
                        ? channelScanProgress || "סורק ערוצים..."
                        : channelScanSummaryText || "אין נתוני סריקה עדיין"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleManualChannelScan}
                disabled={isChannelScanning}
                className="flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:text-white"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isChannelScanning ? "animate-spin" : ""}`} />
                {isChannelScanning ? "סורק ערוצים..." : "סריקה ידנית"}
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                title={isDark ? "עבור למצב בהיר" : "עבור למצב כהה"}
              >
                {isDark ? (
                  <Sun className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                ) : (
                  <Moon className="h-3.5 w-3.5 shrink-0 text-slate-600 dark:text-zinc-300" />
                )}
                <span className="text-right">{isDark ? "מצב בהיר" : "מצב כהה"}</span>
              </button>
              <button
                onClick={() => setDeleteAllConfirm(true)}
                disabled={displayedVideos.length === 0 || isDeleting}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-30"
                title="מחק את כל הסרטונים המוצגים"
              >
                <Trash2 className="h-3.5 w-3.5" />
                מחק הכל
              </button>
              <DriveStatusBadge />
              {/* ── Memory meter ── */}
              <div className="relative flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1.5" dir="ltr">
                  <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden" title={`${storageMB} MB בשימוש מתוך ~5 MB`}>
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        storageMB >= 4.5 ? "bg-red-500" : storageMB >= 3.5 ? "bg-amber-400" : "bg-emerald-500"
                      )}
                      style={{ width: `${Math.min(100, (storageMB / 5) * 100)}%` }}
                    />
                  </div>
                  <span className={cn(
                    "text-[10px] tabular-nums font-medium",
                    storageMB >= 4.5 ? "text-red-500" : storageMB >= 3.5 ? "text-amber-500" : "text-slate-400 dark:text-zinc-500"
                  )}>
                    {storageMB}MB
                  </span>
                  <button
                    onClick={handleToggleBreakdown}
                    title="הצג פירוט לפי קטגוריה"
                    className="text-[10px] text-slate-400 hover:text-slate-700 dark:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    {storageBreakdown ? "▲" : "פירוט"}
                  </button>
                  <button
                    onClick={handleCleanCaches}
                    title="נקה caches ישנים (תמלולים, ניתוחים)"
                    className="text-[10px] text-slate-400 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-colors"
                  >
                    נקה
                  </button>
                </div>
                {/* ── Breakdown panel ── */}
                {storageBreakdown && (
                  <div className="absolute top-full right-0 mt-1 z-50 min-w-[220px] rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg px-3 py-2.5 text-[11px]" dir="rtl">
                    <div className="space-y-1.5">
                      {[
                        { label: "cache תמלולים", mb: storageBreakdown.transcriptsMB, color: "bg-blue-300" },
                        { label: "ניתוחים AI",    mb: storageBreakdown.analysesMB,   color: "bg-violet-400" },
                        { label: "מטא-דאטה סרטונים", mb: parseFloat(((storageBreakdown.videosMB || 0) - (storageBreakdown.embeddedTranscriptMB || 0)).toFixed(2)), color: "bg-emerald-400" },
                        { label: "תמלולים בסרטונים ⚠️", mb: storageBreakdown.embeddedTranscriptMB ?? 0, color: "bg-orange-400", isLarge: (storageBreakdown.embeddedTranscriptMB ?? 0) > 0.3 },
                        { label: "שאר",            mb: storageBreakdown.otherMB,      color: "bg-slate-400" },
                      ].map(({ label, mb, color, isLarge }) => (
                        <div key={label} className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
                          <span className={cn("flex-1", isLarge ? "text-orange-600 dark:text-orange-400 font-medium" : "text-slate-600 dark:text-slate-400")}>{label}</span>
                          <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">{mb} MB</span>
                        </div>
                      ))}
                      <div className="border-t border-slate-100 dark:border-zinc-800 pt-1.5 flex justify-between font-semibold text-slate-700 dark:text-slate-300">
                        <span>סה"כ</span>
                        <span>{storageMB} MB</span>
                      </div>
                      {(storageBreakdown.embeddedTranscriptMB ?? 0) > 0.1 && (
                        <div className="border-t border-slate-100 dark:border-zinc-800 pt-1.5">
                          <p className="text-slate-500 dark:text-slate-400 mb-1 leading-tight">
                            תמלולים נשמרים כפול — בתוך נתוני הסרטון ובcache נפרד.
                          </p>
                          <button
                            onClick={handleStripTranscripts}
                            className="w-full text-center rounded-md px-2 py-1 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 text-orange-700 dark:text-orange-400 font-medium transition-colors"
                          >
                            הסר תמלולים מהסרטונים ({storageBreakdown.embeddedTranscriptMB} MB)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => { handleRefresh(); refreshStorageMeter(); }}
                disabled={isLoading}
                className="flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-slate-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-white"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                רענון
              </button>
            </div>
          </div>
        </div>
      </header>

      {storageWarningMB && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2 dark:border-amber-500/30 dark:bg-amber-500/10" dir="rtl">
          <span className="text-xs text-amber-700 dark:text-amber-300">
            ⚠️ אחסון מקומי כמעט מלא ({storageWarningMB} MB מתוך ~5 MB) — שקול למחוק סרטונים ישנים
          </span>
          <button onClick={() => setStorageWarningMB(null)} className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 shrink-0">✕</button>
        </div>
      )}

      <main className="px-6 py-6">
        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <SmartDashboard
              mentors={mentors}
              videos={videos}
              totalNew={stats.totalNew}
              summarized={stats.summarized}
              permanentCount={stats.permanentCount}
              activeFilter={activeDashboardFilter}
              onFilterClick={handleKpiFilterClick}
              onClearFilter={clearKpiFilter}
            />

            {/* Unified compact control row (Learning Center + filters + search + selection mode) */}
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

              <FilterBar
                compact
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
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-4" dir="rtl">
                <p className="text-sm text-red-700 font-medium">
                  ⚠️ פעולה זו תמחק את כל {displayedVideos.length} הסרטונים המוצגים ולא ניתן לשחזר.
                </p>
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
        onVideoPatch={(patch) => setSelectedVideo((prev) => (prev ? { ...prev, ...patch } : null))}
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
