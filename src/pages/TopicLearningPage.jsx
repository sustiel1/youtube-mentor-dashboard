import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import {
  CheckCircle, Bookmark, BookmarkCheck, ExternalLink, ChevronRight, ChevronLeft,
  FolderOpen, Paperclip, FileText, Bot, Sparkles, Copy, Check,
  Play, Home, Trash2, Plus, X, Link, ZoomIn, Image as ImageIcon,
  Cpu, Brain, Soup, TrendingUp, Layers,
  UtensilsCrossed, Code, Music, Dumbbell,
  Globe, Lightbulb, BookOpen, Hash, Eye, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { LearningStatusBadge } from "@/components/dashboard/LearningStatusBadge";
import { NoteEditor } from "@/components/dashboard/NoteEditor";
import {
  useVideos, useSaveVideo, useUpdateLearningStatus, useUpdatePresentations, useUpdateSummary,
} from "@/hooks/useVideos";
import { analyzeVideoWithAI } from "@/api/functions";
import { getAiAnalysis, saveAiAnalysis, clearAiAnalysis } from "@/lib/aiAnalysisStore";
import { useTopics } from "@/hooks/useTopics";
import { useMentors } from "@/hooks/useMentors";
import { useAttachments, useUploadAttachment, useDeleteAttachment } from "@/hooks/useAttachments";

// ─── Icon / Color maps ───────────────────────────────────

const ICON_MAP = {
  Cpu, Brain, Soup, TrendingUp, Layers,
  UtensilsCrossed, Code, Music, Dumbbell, Globe, Lightbulb, BookOpen,
};

const COLOR_MAP = {
  violet:  { iconBg: "bg-violet-100",  icon: "text-violet-600",  progress: "bg-violet-500",  badge: "bg-violet-50 text-violet-700"  },
  orange:  { iconBg: "bg-orange-100",  icon: "text-orange-600",  progress: "bg-orange-500",  badge: "bg-orange-50 text-orange-700"  },
  cyan:    { iconBg: "bg-cyan-100",    icon: "text-cyan-600",    progress: "bg-cyan-500",    badge: "bg-cyan-50 text-cyan-700"    },
  emerald: { iconBg: "bg-emerald-100", icon: "text-emerald-600", progress: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
  rose:    { iconBg: "bg-rose-100",    icon: "text-rose-600",    progress: "bg-rose-500",    badge: "bg-rose-50 text-rose-700"    },
  amber:   { iconBg: "bg-amber-100",   icon: "text-amber-600",   progress: "bg-amber-500",   badge: "bg-amber-50 text-amber-700"   },
};

const PRES_TYPES = [
  { value: "pdf", label: "PDF" },
  { value: "slides", label: "מצגת" },
  { value: "image", label: "תמונה" },
  { value: "link", label: "קישור" },
  { value: "other", label: "אחר" },
];

// ─── Helpers ─────────────────────────────────────────────

function extractYouTubeId(url) {
  const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return match?.[1] || null;
}

// מנקה [MOCK] וטקסט פנימי שנשאר מנתוני בדיקה
function cleanText(text) {
  if (!text) return text;
  return text.replace(/\[MOCK\]/gi, "").replace(/\[mock\]/gi, "").trim();
}

// מנסה לחלץ timestamp מתחילת מחרוזת — "4:35 כותרת" → { seconds:275, label:"4:35", body:"כותרת" }
// אם אין timestamp — מחזיר seconds:null
function parseTimestampFromText(text) {
  if (!text) return { seconds: null, label: null, body: text };
  const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return { seconds: null, label: null, body: text };
  const hasHours = match[3] != null;
  const h = hasHours ? parseInt(match[1], 10) : 0;
  const m = hasHours ? parseInt(match[2], 10) : parseInt(match[1], 10);
  const s = hasHours ? parseInt(match[3], 10) : parseInt(match[2], 10);
  const seconds = h * 3600 + m * 60 + s;
  const label   = match[0];
  const body    = text.slice(match[0].length).replace(/^[\s\-–—]+/, "").trim();
  return { seconds, label, body };
}

function isLearnedStatus(status) {
  return status === "learned" || status === "completed";
}

function pickAutoVideo(videos) {
  return (
    videos.find((v) => v.learningStatus === "in_progress") ||
    videos.find((v) => v.learningStatus === "not_started") ||
    videos[0] ||
    null
  );
}

// Small circle overlaid on the video thumbnail to show learning status
function StatusCircle({ status }) {
  const learned = isLearnedStatus(status);
  const inProgress = status === "in_progress";
  return (
    <div className={cn(
      "absolute bottom-0.5 left-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center",
      learned    ? "bg-emerald-500 border-emerald-500" :
      inProgress ? "bg-amber-400  border-amber-400"   :
                   "bg-white/80   border-gray-300"
    )}>
      {learned && <Check className="h-2.5 w-2.5 text-white stroke-[3]" />}
    </div>
  );
}

function presTypeIcon(type) {
  if (type === "image")  return <ImageIcon className="h-4 w-4 text-rose-500" />;
  if (type === "slides") return <Paperclip className="h-4 w-4 text-indigo-600" />;
  if (type === "link")   return <Link className="h-4 w-4 text-cyan-600" />;
  return <FileText className="h-4 w-4 text-indigo-600" />;
}

// ─── NotebookLM Dialog ───────────────────────────────────

function NotebookDialog({ open, onClose, video, topic, mentorName }) {
  const [copied, setCopied] = useState(false);
  if (!video || !topic) return null;

  const exportText = [
    `כותרת: ${video.title}`,
    `נושא: ${topic.name}`,
    `תת-קטגוריה: ${video.subCategory || "—"}`,
    `מנטור: ${mentorName}`,
    `קישור לסרטון: ${video.url || "אין קישור זמין לסרטון"}`,
    ``,
    `סיכום קצר:`,
    video.shortSummary || "אין",
    ``,
    ...(video.keyPoints?.length
      ? [`נקודות מפתח:`, ...video.keyPoints.map((p) => `• ${p}`)]
      : []),
  ].join("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(exportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-violet-600" />
            ייצוא ל-NotebookLM
          </DialogTitle>
        </DialogHeader>
        <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-4 leading-relaxed max-h-64 overflow-y-auto border border-gray-200 space-y-1.5 font-sans">
          <p><span className="font-semibold text-gray-700">כותרת:</span> {video.title}</p>
          <p><span className="font-semibold text-gray-700">נושא:</span> {topic.name}</p>
          <p><span className="font-semibold text-gray-700">תת-קטגוריה:</span> {video.subCategory || "—"}</p>
          <p><span className="font-semibold text-gray-700">מנטור:</span> {mentorName}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-700">קישור לסרטון:</span>
            {video.url ? (
              <>
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline flex items-center gap-1"
                >
                  פתח ביוטיוב
                  <ExternalLink className="h-3 w-3" />
                </a>
                <button
                  onClick={() => navigator.clipboard.writeText(video.url).then(() => toast.success("הקישור הועתק ✓"))}
                  className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-md px-1.5 py-0.5 hover:border-indigo-200 hover:bg-indigo-50 transition-all"
                  title="העתק קישור"
                >
                  <Copy className="h-3 w-3" />
                  העתק
                </button>
              </>
            ) : (
              <span className="text-gray-400">אין קישור זמין לסרטון</span>
            )}
          </div>
          {video.shortSummary && (
            <>
              <div className="border-t border-gray-200 pt-1.5 mt-1.5">
                <p className="font-semibold text-gray-700 mb-1">סיכום קצר:</p>
                <p className="text-gray-600">{cleanText(video.shortSummary)}</p>
              </div>
            </>
          )}
          {video.keyPoints?.length > 0 && (
            <div className="border-t border-gray-200 pt-1.5 mt-1.5">
              <p className="font-semibold text-gray-700 mb-1">נקודות מפתח:</p>
              {video.keyPoints.map((point, i) => (
                <p key={i}>• {cleanText(point)}</p>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all",
                copied ? "bg-emerald-50 text-emerald-600" : "bg-indigo-600 text-white hover:bg-indigo-700"
              )}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "הועתק!" : "העתק"}
            </button>
            <a
              href="https://notebooklm.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50 transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              פתח ב-NotebookLM
            </a>
          </div>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            סגור
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Presentation Dialog ─────────────────────────────

function AddPresentationDialog({ open, onClose, onAdd }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("pdf");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    onAdd({ title: title.trim(), url: url.trim(), type, createdAt: new Date().toISOString() });
    setTitle("");
    setUrl("");
    setType("pdf");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Paperclip className="h-4 w-4 text-indigo-600" />
            הוסף חומר נלווה
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">כותרת</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="שם המצגת / הקובץ"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">
              {type === "image" ? "כתובת תמונה (URL)" : "קישור"}
            </label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={type === "image" ? "https://example.com/image.png" : "https://..."}
              dir="ltr"
            />
            {type === "image" && url && (
              <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 max-h-32 flex items-center justify-center">
                <img
                  src={url}
                  alt="תצוגה מקדימה"
                  className="max-h-32 object-contain"
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">סוג</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRES_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={!title.trim() || !url.trim()}
              className="flex-1 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              הוסף
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              ביטול
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Image Lightbox Dialog ───────────────────────────────

function ImageLightboxDialog({ image, onClose }) {
  if (!image) return null;
  return (
    <Dialog open={!!image} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-3" dir="rtl">
        <DialogHeader className="px-2 pb-2">
          <DialogTitle className="text-sm font-medium text-gray-700">{image.title}</DialogTitle>
        </DialogHeader>
        <img
          src={image.url}
          alt={image.title}
          className="w-full rounded-xl max-h-[70vh] object-contain bg-gray-50"
        />
      </DialogContent>
    </Dialog>
  );
}

// Format a raw view count number to a readable string (e.g. 45200 → "45.2K")
function formatViewCount(n) {
  if (!n || n === 0) return null;
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Analyze error messages ───────────────────────────────

const ANALYZE_ERRORS = {
  quota_zero: {
    msg:  "ה-Gemini API Key אין לו quota פעיל.",
    hint: "צור API key חדש ב-Google AI Studio עם Free Tier, או הפעל GEMINI_MOCK=true ב-.env לבדיקת UI.",
  },
  no_key: {
    msg:  "GEMINI_API_KEY חסר בקובץ .env.",
    hint: "הוסף את המפתח וצא/כנס שוב לשרת.",
  },
};

// ─── Main Component ──────────────────────────────────────

export default function TopicLearningPage({ topicId, navigateTo, pageParams }) {
  const fromMentorId = pageParams?.fromMentorId ?? null;
  const [selectedVideoId, setSelectedVideoId] = useState(pageParams?.videoId ?? null);
  const [activeSubCat, setActiveSubCat] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [addPresOpen, setAddPresOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [aiOverride, setAiOverride] = useState(null); // cached AI analysis for current video
  const [copiedLink, setCopiedLink] = useState(false);
  // YouTube IFrame API refs
  const playerRef        = useRef(null); // YT.Player instance
  const pendingSeekRef   = useRef(null); // seconds to seek once player is ready
  const playerDivRef     = useRef(null); // div mount-point for the player
  // file input ref for screenshots upload
  const screenshotInputRef = useRef(null);

  const { data: videos = [], isLoading: videosLoading } = useVideos();
  const { data: topics = [], isLoading: topicsLoading } = useTopics();
  const { data: mentors = [], isLoading: mentorsLoading } = useMentors();
  const updateLearningStatus = useUpdateLearningStatus();
  const saveVideo = useSaveVideo();
  const updatePresentations = useUpdatePresentations();
  const updateSummary = useUpdateSummary();

  const isLoading = videosLoading || topicsLoading || mentorsLoading;

  const topic = useMemo(() => topics.find((t) => t.id === topicId), [topics, topicId]);
  const fromMentor = useMemo(() => mentors.find((m) => m.id === fromMentorId), [mentors, fromMentorId]);
  const getMentorName = (mentorId) => mentors.find((m) => m.id === mentorId)?.name || "";

  const topicVideos = useMemo(() => {
    if (fromMentorId) return videos.filter((v) => v.mentorId === fromMentorId);
    return videos.filter((v) => (v.topicIds || []).includes(topicId));
  }, [videos, topicId, fromMentorId]);

  const filteredVideos = useMemo(
    () => (activeSubCat ? topicVideos.filter((v) => (v.subCategory || "כללי") === activeSubCat) : topicVideos),
    [topicVideos, activeSubCat]
  );

  const subCategories = useMemo(
    () => [...new Set(topicVideos.map((v) => v.subCategory || "כללי"))],
    [topicVideos]
  );

  const selectedVideo = useMemo(() => {
    const explicit = filteredVideos.find((v) => v.id === selectedVideoId);
    return explicit || pickAutoVideo(filteredVideos);
  }, [filteredVideos, selectedVideoId]);

  // Screenshots (IndexedDB) — must be declared after selectedVideo useMemo
  const selectedVideoIdForQuery = selectedVideo?.id ?? null;
  const { data: screenshots = [], isLoading: screenshotsLoading, isError: screenshotsError } = useAttachments(selectedVideoIdForQuery);
  const uploadAttachment = useUploadAttachment();
  const deleteScreenshot = useDeleteAttachment();

  // When video changes: clear stale UI state + load cached AI analysis
  useEffect(() => {
    setAnalyzeError(null);
    setCopiedLink(false);
    setAiOverride(selectedVideo?.id ? getAiAnalysis(selectedVideo.id) : null);
  }, [selectedVideo?.id]);

  const nextRecommended = useMemo(() => {
    if (!selectedVideo) return null;
    return (
      filteredVideos.find((v) => v.id !== selectedVideo.id && v.learningStatus === "not_started") ||
      filteredVideos.find((v) => v.id !== selectedVideo.id && v.learningStatus === "in_progress") ||
      null
    );
  }, [filteredVideos, selectedVideo]);

  const groups = useMemo(() => {
    const acc = {};
    filteredVideos.forEach((v) => {
      const key = v.subCategory || "כללי";
      if (!acc[key]) acc[key] = [];
      acc[key].push(v);
    });
    return acc;
  }, [filteredVideos]);

  const learnedCount = useMemo(
    () => topicVideos.filter((v) => isLearnedStatus(v.learningStatus)).length,
    [topicVideos]
  );
  const progress = topicVideos.length > 0 ? Math.round((learnedCount / topicVideos.length) * 100) : 0;

  const currentIndex = selectedVideo
    ? filteredVideos.findIndex((v) => v.id === selectedVideo.id)
    : -1;

  const isLearned = selectedVideo ? isLearnedStatus(selectedVideo.learningStatus) : false;
  const youtubeId = selectedVideo ? extractYouTubeId(selectedVideo.url) : null;
  const isComplete = progress === 100 && topicVideos.length > 0;
  const mentorName = selectedVideo ? getMentorName(selectedVideo.mentorId) : "";

  // Merge cached AI analysis (if any) on top of selectedVideo for display purposes
  const effectiveVideo = selectedVideo
    ? (aiOverride ? { ...selectedVideo, ...aiOverride } : selectedVideo)
    : null;
  const hasAiAnalysis = !!aiOverride;

  // ─── Handlers ──────────────────────────────────────────

  const handleMarkLearned = () => {
    if (!selectedVideo) return;
    updateLearningStatus.mutate({ id: selectedVideo.id, learningStatus: "learned" });
    toast.success("סומן כנלמד ✓");
    if (nextRecommended) {
      setTimeout(() => setSelectedVideoId(nextRecommended.id), 300);
    }
  };

  const handleSave = () => {
    if (!selectedVideo || selectedVideo.isSaved) return;
    saveVideo.mutate({ id: selectedVideo.id, isSaved: true });
    toast.success("נשמר להמשך");
  };

  const handleRemoveSaved = () => {
    if (!selectedVideo) return;
    saveVideo.mutate({ id: selectedVideo.id, isSaved: false });
    toast.success("הוסר מהשמורים");
  };

  const handlePrev = () => {
    if (currentIndex > 0) setSelectedVideoId(filteredVideos[currentIndex - 1].id);
  };

  const handleNext = () => {
    if (nextRecommended) {
      setSelectedVideoId(nextRecommended.id);
    } else if (currentIndex < filteredVideos.length - 1) {
      setSelectedVideoId(filteredVideos[currentIndex + 1].id);
    }
  };

  const handleSubCatFilter = (cat) => {
    setActiveSubCat(cat);
    setSelectedVideoId(null);
  };

  const handleAddPresentation = ({ title, url, type }) => {
    if (!selectedVideo) return;
    const current = selectedVideo.presentations || [];
    const updated = [...current, { title, url, type }];
    updatePresentations.mutate({ id: selectedVideo.id, presentations: updated });
    setAddPresOpen(false);
    toast.success("החומר הנלווה נוסף");
  };

  const handleRemovePresentation = (index) => {
    if (!selectedVideo) return;
    const updated = (selectedVideo.presentations || []).filter((_, i) => i !== index);
    updatePresentations.mutate({ id: selectedVideo.id, presentations: updated });
    toast.success("הוסר");
  };

  const handleScreenshotUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedVideo) return;
    // Reset the input so the same file can be re-uploaded if needed
    e.target.value = "";
    uploadAttachment.mutate(
      { videoId: selectedVideo.id, file },
      {
        onSuccess: () => toast.success("צילום המסך נשמר"),
        onError:   () => toast.error("שגיאה בשמירת הצילום — נסה שוב"),
      }
    );
  };

  const handleCopyLink = () => {
    if (!selectedVideo?.url) return;
    navigator.clipboard.writeText(selectedVideo.url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast.success("הקישור הועתק ✓");
    });
  };

  const handleAnalyzeVideo = async (forceReanalyze = false) => {
    if (!selectedVideo || isAnalyzing) return;

    // If cached and not forced — load from cache immediately (no API call)
    if (!forceReanalyze) {
      const cached = getAiAnalysis(selectedVideo.id);
      if (cached) { setAiOverride(cached); return; }
    } else {
      console.debug(`[AI] reanalyze requested for ${selectedVideo.id}`);
    }

    setIsAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await analyzeVideoWithAI({
        videoId:     selectedVideo.id,
        title:       selectedVideo.title,
        description: selectedVideo.fullSummary || selectedVideo.shortSummary || "",
        keyPoints:   selectedVideo.keyPoints || [],
      });
      // Save to localStorage — persists across refreshes for all video types
      saveAiAnalysis(selectedVideo.id, result);
      // Update UI immediately
      setAiOverride(result);
      // Best-effort: persist to backend/localStorage video store
      updateSummary.mutate({ id: selectedVideo.id, ...result });
      toast.success("הניתוח הושלם ✓");
    } catch (err) {
      const code = err?.code;
      console.debug(`[AI] analyze failed for ${selectedVideo.id}:`, code || err?.message);
      if (code === "QUOTA_ZERO") {
        setAnalyzeError("quota_zero");
      } else if (code === "GEMINI_API_KEY_MISSING") {
        setAnalyzeError("no_key");
        toast.error("מפתח ה-API חסר — הוסף GEMINI_API_KEY לקובץ .env");
      } else if (code === "RATE_LIMIT") {
        toast.error("הגעת למגבלת הבקשות — נסה שוב בעוד כמה שניות");
      } else if (code === "QUOTA_EXCEEDED" || code === "INVALID_KEY") {
        toast.error("מפתח ה-API אינו תקין — בדוק את GEMINI_API_KEY");
      } else {
        toast.error("הניתוח נכשל — נסה שוב");
      }
      // Do NOT clear existing aiOverride if re-analyze failed
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ─── YouTube IFrame API ───────────────────────────────────

  // Central seek: uses the player instance if ready, otherwise queues the seek
  const seekTo = useCallback((seconds) => {
    if (playerRef.current && typeof playerRef.current.seekTo === "function") {
      playerRef.current.seekTo(seconds, true);
      playerRef.current.playVideo?.();
    } else {
      pendingSeekRef.current = seconds;
    }
  }, []);

  // קפיצה לזמן — אם הסרטון כבר פעיל: seek ישיר. אחרת: בוחר סרטון + pending seek
  const handleJumpToTimestamp = useCallback((seconds, targetVideoId) => {
    if (!targetVideoId || targetVideoId === selectedVideoId) {
      seekTo(seconds);
    } else {
      pendingSeekRef.current = seconds;
      setSelectedVideoId(targetVideoId);
    }
  }, [selectedVideoId, seekTo]);

  // Load the YouTube IFrame API script once (idempotent)
  useEffect(() => {
    if (window.YT?.Player || document.querySelector('script[src*="youtube.com/iframe_api"]')) return;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }, []);

  // Create or update the YT.Player when the active video changes
  useEffect(() => {
    if (!youtubeId) {
      // Non-YouTube video: destroy any lingering player
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
      return;
    }

    // Track the timeout so we can cancel it if the video changes before it fires
    let pendingSeekTimeout = null;

    const init = () => {
      if (!playerDivRef.current) return;

      if (playerRef.current) {
        // Player already exists — load the new video (no full remount)
        playerRef.current.loadVideoById(youtubeId);
        if (pendingSeekRef.current != null) {
          const sec = pendingSeekRef.current;
          pendingSeekRef.current = null;
          // Seek after a short buffer window; cancelled in cleanup if video changes
          pendingSeekTimeout = setTimeout(() => {
            playerRef.current?.seekTo(sec, true);
          }, 400);
        }
      } else {
        // First time: create the player inside playerDivRef
        playerRef.current = new window.YT.Player(playerDivRef.current, {
          videoId: youtubeId,
          width: "100%",
          height: "100%",
          playerVars: { rel: 0, modestbranding: 1, enablejsapi: 1 },
          events: {
            onReady(e) {
              if (pendingSeekRef.current != null) {
                e.target.seekTo(pendingSeekRef.current, true);
                e.target.playVideo();
                pendingSeekRef.current = null;
              }
            },
          },
        });
      }
    };

    if (window.YT?.Player) {
      init();
    } else {
      // API not yet loaded — queue callback
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        init();
      };
    }

    return () => {
      // Cancel any delayed seek and clear pending state when video changes
      clearTimeout(pendingSeekTimeout);
      pendingSeekRef.current = null;
    };
  }, [youtubeId]);

  // Destroy player on component unmount
  useEffect(() => () => {
    try { playerRef.current?.destroy(); } catch {}
    playerRef.current = null;
  }, []);

  // ─── Loading / Not Found ─────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-20 rounded-xl" />
        <div className="flex gap-5">
          <Skeleton className="w-72 h-96 rounded-xl" />
          <Skeleton className="flex-1 h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!topic && !fromMentorId) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-sm text-gray-400">נושא לא נמצא</p>
      </div>
    );
  }

  const TopicIcon = topic ? (ICON_MAP[topic.icon] || Hash) : Hash;
  const colors = topic ? (COLOR_MAP[topic.color] || COLOR_MAP.violet) : COLOR_MAP.violet;
  const presCount = selectedVideo?.presentations?.length ?? 0;

  // ─── Render ──────────────────────────────────────────────

  return (
    <div className="min-h-screen" dir="rtl">

      {/* ═══ HEADER ═══ */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="px-6 py-4">

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3 flex-row-reverse justify-end">
            <button
              onClick={() => navigateTo?.("Dashboard")}
              className="hover:text-indigo-600 transition-colors flex items-center gap-1 flex-row-reverse"
            >
              <Home className="h-3 w-3" />
              בית
            </button>
            <ChevronRight className="h-3 w-3" />
            {fromMentorId ? (
              <>
                <button
                  onClick={() => navigateTo?.("MentorPage", { mentorId: fromMentorId })}
                  className="hover:text-indigo-600 transition-colors"
                >
                  {fromMentor?.name || "מנטור"}
                </button>
                <ChevronRight className="h-3 w-3" />
                <span className="text-gray-600 font-medium">
                  {selectedVideo?.title ? (selectedVideo.title.length > 40 ? selectedVideo.title.slice(0, 40) + "…" : selectedVideo.title) : "סרטון"}
                </span>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigateTo?.("LearningHub")}
                  className="hover:text-indigo-600 transition-colors"
                >
                  מרכז הלמידה
                </button>
                <ChevronRight className="h-3 w-3" />
                <span className="text-gray-600 font-medium">{topic?.name}</span>
              </>
            )}
          </div>

          {/* Topic / Mentor identity + progress */}
          <div className="flex items-center gap-4 flex-row-reverse">
            {fromMentorId ? (
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg font-bold shrink-0">
                {fromMentor?.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
            ) : (
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", colors.iconBg)}>
                <TopicIcon className={cn("h-5 w-5", colors.icon)} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap flex-row-reverse justify-end">
                <h1 className="text-lg font-bold text-gray-900 leading-tight">
                  {fromMentorId ? fromMentor?.name : topic?.name}
                </h1>
                <span className={cn("text-xs font-medium px-2.5 py-0.5 rounded-full", fromMentorId ? "bg-indigo-50 text-indigo-700" : colors.badge)}>
                  {topicVideos.length} סרטונים
                </span>
                {learnedCount > 0 && (
                  <span className="text-xs text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-0.5 font-medium">
                    {learnedCount} נלמדו
                  </span>
                )}
              </div>
              {topicVideos.length > 0 && (
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", isComplete ? "bg-emerald-500" : colors.progress)}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-500 shrink-0">{progress}%</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ═══ CONTENT ═══ */}
      <main className="px-6 py-6">

        {topicVideos.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-gray-200">
            <Bookmark className="h-14 w-14 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">אין עדיין סרטונים בנושא זה</p>
            <p className="text-sm text-gray-400 mt-1">משוך סרטונים מהדשבורד כדי שיופיעו כאן</p>
            {navigateTo && (
              <button
                onClick={() => navigateTo("TopicPage", { topicId })}
                className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
              >
                עבור לספרייה של הנושא
              </button>
            )}
          </div>
        ) : (
          <div className="flex gap-6">

            {/* ══ SIDEBAR ══ */}
            <div className="w-72 shrink-0 hidden lg:block">
              <div className="sticky top-44 space-y-3">

                {/* ── Selected video card (YouTube-style) ── */}
                {selectedVideo && (
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" dir="rtl">

                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-black">
                      <img
                        src={selectedVideo.thumbnail}
                        alt={selectedVideo.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                      {/* Category badge overlay */}
                      {(topic?.name || selectedVideo.subCategory) && (
                        <div className="absolute top-2 right-2 flex gap-1.5">
                          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm", colors.badge)}>
                            {topic?.name || selectedVideo.subCategory}
                          </span>
                        </div>
                      )}
                      {/* Play overlay */}
                      {selectedVideo.url && (
                        <a
                          href={selectedVideo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30"
                          title="פתח ב-YouTube"
                        >
                          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center">
                            <Play className="h-5 w-5 text-white fill-white" />
                          </div>
                        </a>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3 space-y-2.5">

                      {/* Sub-category + learning status */}
                      <div className="flex items-center gap-2 flex-row-reverse flex-wrap">
                        {selectedVideo.subCategory && (
                          <span className="text-xs text-gray-400 font-medium">{selectedVideo.subCategory}</span>
                        )}
                        <LearningStatusBadge status={selectedVideo.learningStatus} />
                      </div>

                      {/* Title */}
                      <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-3 text-right">
                        {selectedVideo.title}
                      </h3>

                      {/* Date + view count */}
                      {selectedVideo.publishedAt && (
                        <p className="text-xs text-gray-400 text-right">
                          {format(new Date(selectedVideo.publishedAt), "d MMM yyyy", { locale: he })}
                        </p>
                      )}
                      {selectedVideo.viewCount && (
                        <p className="text-xs text-gray-400 text-right flex items-center gap-1 flex-row-reverse">
                          <Eye className="h-3 w-3" />
                          <span>{formatViewCount(selectedVideo.viewCount)} צפיות</span>
                        </p>
                      )}

                      {/* Separator */}
                      <div className="border-t border-gray-100" />

                      {/* Mentor row */}
                      <div className="flex items-center gap-2.5 flex-row-reverse">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                          colors.iconBg, colors.icon
                        )}>
                          {mentorName.charAt(0) || "?"}
                        </div>
                        <div className="flex-1 min-w-0 text-right">
                          <p className="text-xs font-semibold text-gray-800 truncate">{mentorName}</p>
                          <p className="text-[10px] text-gray-400">מנטור</p>
                        </div>
                        {selectedVideo.url && (
                          <a
                            href={selectedVideo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0"
                            title="פתח ב-YouTube"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>

                      {/* Copy link button */}
                      <button
                        onClick={handleCopyLink}
                        className={cn(
                          "w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-all",
                          copiedLink
                            ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedLink ? "הקישור הועתק!" : "העתק קישור לסרטון"}
                      </button>

                    </div>
                  </div>
                )}

                {/* ── Playlist ── */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

                  {/* SubCategory filters */}
                  {subCategories.length > 1 && (
                    <div className="px-3 py-2.5 border-b border-gray-100 flex flex-wrap gap-1.5 flex-row-reverse">
                      <button
                        onClick={() => handleSubCatFilter(null)}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-full font-medium transition-colors",
                          activeSubCat === null ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        הכל
                      </button>
                      {subCategories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => handleSubCatFilter(cat)}
                          className={cn(
                            "text-xs px-2.5 py-1 rounded-full font-medium transition-colors",
                            activeSubCat === cat ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Video list */}
                  <div className="max-h-[40vh] overflow-y-auto">
                    {Object.entries(groups).map(([subCat, groupVideos]) => (
                      <div key={subCat}>
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100 flex-row-reverse">
                          <FolderOpen className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="text-xs font-semibold text-gray-500 truncate flex-1 text-right">{subCat}</span>
                          <span className="text-xs text-gray-400 bg-white rounded-full px-1.5 border border-gray-200 shrink-0">
                            {groupVideos.length}
                          </span>
                        </div>

                        {groupVideos.map((video) => {
                          const isSelected = video.id === selectedVideo?.id;
                          const isCompleted = isLearnedStatus(video.learningStatus);
                          const isNext = video.id === nextRecommended?.id;

                          return (
                            <button
                              key={video.id}
                              onClick={() => setSelectedVideoId(video.id)}
                              className={cn(
                                "w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors border-b border-gray-50 last:border-0 flex-row-reverse",
                                isSelected ? "bg-indigo-50 border-r-2 border-indigo-500" : "hover:bg-gray-50",
                                isCompleted && !isSelected && "opacity-55"
                              )}
                            >
                              <div className="relative w-10 h-7 rounded-md overflow-hidden shrink-0 bg-gray-100">
                                <img
                                  src={video.thumbnail}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  onError={(e) => { e.target.style.display = "none"; }}
                                />
                                <StatusCircle status={video.learningStatus} />
                              </div>
                              <div className="flex-1 min-w-0 text-right">
                                <p className={cn(
                                  "text-xs leading-tight line-clamp-2",
                                  isSelected ? "font-semibold text-indigo-700" : "text-gray-700"
                                )}>
                                  {video.title}
                                </p>
                                {(isNext || video.presentations?.length > 0) && (
                                  <div className="flex items-center gap-1 mt-0.5 flex-row-reverse">
                                    {isNext && (
                                      <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5">
                                        הבא
                                      </span>
                                    )}
                                    {video.presentations?.length > 0 && (
                                      <Paperclip className="h-3 w-3 text-gray-400" />
                                    )}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* ══ MAIN (learning area) ══ */}
            <div className="flex-1 min-w-0">
              {selectedVideo ? (
                <div className="space-y-4">

                  {/* ── Embed / Thumbnail ── */}
                  <div className="rounded-xl overflow-hidden bg-black aspect-video shadow-sm">
                    {youtubeId ? (
                      // YT.Player mounts an iframe inside this div via the IFrame API
                      <div ref={playerDivRef} className="w-full h-full" />
                    ) : (
                      <div className="relative w-full h-full">
                        <img
                          src={selectedVideo.thumbnail}
                          alt={selectedVideo.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <a
                            href={selectedVideo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center hover:bg-white/30 transition-colors"
                          >
                            <Play className="h-7 w-7 text-white fill-white" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Title + Meta ── */}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
                    <h2 className="text-base font-bold text-gray-900 leading-snug">
                      {selectedVideo.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-sm text-gray-500">{mentorName}</span>
                      {selectedVideo.subCategory && (
                        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", colors.badge)}>
                          {selectedVideo.subCategory}
                        </span>
                      )}
                      <LearningStatusBadge status={selectedVideo.learningStatus} />
                    </div>
                  </div>

                  {/* ── Actions Row ── */}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 space-y-3">

                    {/* Primary actions */}
                    <div className="flex items-center gap-2 flex-wrap">

                      {/* Mark learned */}
                      <button
                        onClick={handleMarkLearned}
                        disabled={isLearned}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all",
                          isLearned
                            ? "bg-emerald-50 text-emerald-600 cursor-default"
                            : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 shadow-sm"
                        )}
                      >
                        <CheckCircle className="h-4 w-4" />
                        {isLearned ? "נלמד ✓" : "סמן כנלמד"}
                      </button>

                      {/* Save / Saved state */}
                      {selectedVideo.isSaved ? (
                        <button
                          onClick={handleRemoveSaved}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all group"
                          title="הסר מהשמורים"
                        >
                          <BookmarkCheck className="h-4 w-4 group-hover:hidden" />
                          <Trash2 className="h-4 w-4 hidden group-hover:block" />
                          <span className="group-hover:hidden">שמור ✓</span>
                          <span className="hidden group-hover:inline">הסר מהשמורים</span>
                        </button>
                      ) : (
                        <button
                          onClick={handleSave}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all"
                        >
                          <Bookmark className="h-4 w-4" />
                          שמור להמשך
                        </button>
                      )}

                      {/* Open YouTube + Copy link */}
                      {selectedVideo.url && (
                        <>
                          <a
                            href={selectedVideo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-700 transition-colors"
                            title="פתח ב-YouTube"
                          >
                            <ExternalLink className="h-4 w-4 shrink-0" />
                            <span className="hidden sm:inline text-xs font-medium">YouTube</span>
                          </a>
                          <button
                            onClick={handleCopyLink}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-all",
                              copiedLink
                                ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                                : "border-gray-200 text-gray-500 hover:bg-gray-50"
                            )}
                            title="העתק קישור"
                          >
                            {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </>
                      )}

                      {/* NotebookLM */}
                      <button
                        onClick={() => setNotebookOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm text-violet-600 border border-violet-200 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors"
                        title="שלח ל-NotebookLM"
                      >
                        <Bot className="h-4 w-4" />
                      </button>

                      {/* Analyze video */}
                      <button
                        onClick={() => handleAnalyzeVideo(!hasAiAnalysis ? false : true)}
                        disabled={isAnalyzing}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-all",
                          isAnalyzing
                            ? "border border-gray-200 text-gray-400 cursor-wait bg-gray-50"
                            : hasAiAnalysis
                              ? "border border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                              : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                        )}
                        title={hasAiAnalysis ? "נתח מחדש עם AI" : "נתח סרטון עם AI"}
                      >
                        {isAnalyzing ? (
                          <div className="h-4 w-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {isAnalyzing ? "מנתח..." : hasAiAnalysis ? "נתח מחדש" : "נתח סרטון"}
                      </button>
                    </div>

                    {/* Prev / counter / next */}
                    <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                      <span className="text-xs text-gray-400">
                        {currentIndex + 1} / {filteredVideos.length} סרטונים
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handlePrev}
                          disabled={currentIndex <= 0}
                          className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                          title="הקודם"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        <button
                          onClick={handleNext}
                          disabled={currentIndex >= filteredVideos.length - 1 && !nextRecommended}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors",
                            nextRecommended
                              ? "border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 font-medium"
                              : "border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-25 disabled:cursor-not-allowed"
                          )}
                          title={nextRecommended ? `הבא בתור: ${nextRecommended.title}` : "הבא"}
                        >
                          {nextRecommended && <span className="text-xs">הבא בתור</span>}
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── Tabs ── */}
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                      <TabsTrigger value="summary" className="gap-1.5">
                        סיכום
                        {hasAiAnalysis && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="ניתוח AI שמור" />
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="notes">הערות</TabsTrigger>
                      <TabsTrigger value="presentations" className="gap-1.5">
                        מצגות
                        {presCount > 0 && (
                          <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-indigo-600 text-white rounded-full">
                            {presCount}
                          </span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="notebook">AI</TabsTrigger>
                    </TabsList>

                    {/* Summary — 4-card grid */}
                    <TabsContent value="summary" className="mt-4">
                      {effectiveVideo.shortSummary || effectiveVideo.fullSummary || effectiveVideo.keyPoints?.length > 0 || effectiveVideo.videoTopics?.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                          {/* Card 0: פרקים בסרטון — FIRST in grid */}
                          {effectiveVideo.videoTopics?.length > 0 && (
                            <div className="md:col-span-2 bg-white rounded-xl border border-cyan-100 shadow-sm p-4">
                              <div className="flex items-center gap-2 mb-3 flex-row-reverse">
                                <div className="p-1.5 bg-cyan-50 rounded-lg shrink-0">
                                  <Clock className="h-4 w-4 text-cyan-600" />
                                </div>
                                <h3 className="text-sm font-semibold text-gray-800 flex-1 text-right">פרקים בסרטון</h3>
                                <span className="text-xs text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full font-medium">
                                  {effectiveVideo.videoTopics.length} פרקים
                                </span>
                              </div>
                              <div className="space-y-1">
                                {effectiveVideo.videoTopics.map((vt, i) => (
                                  <div
                                    key={i}
                                    onClick={() => {
                                      if (vt.timestampSeconds == null) return;
                                      if (youtubeId) handleJumpToTimestamp(vt.timestampSeconds, selectedVideo.id);
                                      else window.open(`${selectedVideo.url}&t=${vt.timestampSeconds}`, "_blank");
                                    }}
                                    className={cn(
                                      "flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-cyan-50 transition-colors flex-row-reverse group",
                                      vt.timestampSeconds != null && "cursor-pointer"
                                    )}
                                  >
                                    {/* Timestamp button / label */}
                                    {vt.timestampSeconds != null && (
                                      youtubeId ? (
                                        <button
                                          onClick={() => seekTo(vt.timestampSeconds)}
                                          className="shrink-0 flex items-center gap-1.5 text-xs font-mono font-semibold text-cyan-600 bg-cyan-50 group-hover:bg-white hover:bg-cyan-100 border border-cyan-200 px-2.5 py-1.5 rounded-lg transition-colors min-w-[52px] justify-center"
                                          title={`קפוץ לפרק: ${vt.title} (${vt.timestampLabel})`}
                                        >
                                          <Play className="h-3 w-3 fill-cyan-600" />
                                          {vt.timestampLabel}
                                        </button>
                                      ) : (
                                        <a
                                          href={`${selectedVideo.url}&t=${vt.timestampSeconds}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="shrink-0 flex items-center gap-1.5 text-xs font-mono font-semibold text-cyan-600 bg-cyan-50 border border-cyan-200 px-2.5 py-1.5 rounded-lg transition-colors"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          {vt.timestampLabel}
                                        </a>
                                      )
                                    )}
                                    <div className="flex-1 min-w-0 text-right">
                                      <p className="text-sm font-medium text-gray-800">{vt.title}</p>
                                      {vt.summary && (
                                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{cleanText(vt.summary)}</p>
                                      )}
                                    </div>
                                    <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-bold shrink-0">
                                      {i + 1}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Card 1: מה לומדים כאן */}
                          {effectiveVideo.shortSummary && (
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col">
                              <div className="flex items-center gap-2 mb-3 flex-row-reverse">
                                <div className="p-1.5 bg-indigo-50 rounded-lg shrink-0">
                                  <BookOpen className="h-4 w-4 text-indigo-600" />
                                </div>
                                <h3 className="text-sm font-semibold text-gray-800 flex-1 text-right">מה לומדים כאן</h3>
                              </div>
                              <p className="text-sm text-gray-600 leading-relaxed flex-1 text-right">{cleanText(effectiveVideo.shortSummary)}</p>
                              {effectiveVideo.tags?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100 flex-row-reverse">
                                  {effectiveVideo.tags.map((tag, i) => (
                                    <span key={i} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-medium">{tag}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Card 2: נקודות חשובות */}
                          {effectiveVideo.keyPoints?.length > 0 && (
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                              <div className="flex items-center gap-2 mb-3 flex-row-reverse">
                                <div className="p-1.5 bg-amber-50 rounded-lg shrink-0">
                                  <Hash className="h-4 w-4 text-amber-600" />
                                </div>
                                <h3 className="text-sm font-semibold text-gray-800 flex-1 text-right">נקודות חשובות</h3>
                              </div>
                              <ul className="space-y-2.5">
                                {effectiveVideo.keyPoints.map((point, i) => {
                                  const parsed   = parseTimestampFromText(cleanText(point));
                                  const canSeek  = parsed.seconds != null && !!youtubeId;
                                  return (
                                    <li
                                      key={i}
                                      onClick={() => canSeek && handleJumpToTimestamp(parsed.seconds, selectedVideo.id)}
                                      className={cn(
                                        "flex items-center gap-2.5 text-sm text-gray-600 flex-row-reverse",
                                        canSeek && "cursor-pointer hover:bg-amber-50 rounded-lg px-1 -mx-1 py-0.5 transition-colors"
                                      )}
                                    >
                                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-50 text-amber-700 text-xs font-bold shrink-0">{i + 1}</span>
                                      <span className="leading-relaxed text-right flex-1">{parsed.body}</span>
                                      {canSeek && (
                                        <span className="shrink-0 font-mono text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                                          {parsed.label}
                                        </span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}

                          {/* Card 3: נקודות תובנה */}
                          {effectiveVideo.fullSummary && (
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                              <div className="flex items-center gap-2 mb-3 flex-row-reverse">
                                <div className="p-1.5 bg-emerald-50 rounded-lg shrink-0">
                                  <Lightbulb className="h-4 w-4 text-emerald-600" />
                                </div>
                                <h3 className="text-sm font-semibold text-gray-800 flex-1 text-right">נקודות תובנה</h3>
                              </div>
                              <p className="text-sm text-gray-500 leading-relaxed text-right">{cleanText(effectiveVideo.fullSummary)}</p>
                            </div>
                          )}

                          {/* Card 4: פעולות */}
                          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                            <div className="flex items-center gap-2 mb-3 flex-row-reverse">
                              <div className="p-1.5 bg-violet-50 rounded-lg shrink-0">
                                <Sparkles className="h-4 w-4 text-violet-600" />
                              </div>
                              <h3 className="text-sm font-semibold text-gray-800 flex-1 text-right">פעולות</h3>
                            </div>
                            <div className="space-y-2">
                              <button
                                onClick={() => { setAnalyzeError(null); handleAnalyzeVideo(true); }}
                                disabled={isAnalyzing}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 active:scale-95 transition-all"
                              >
                                {isAnalyzing
                                  ? <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                  : <Sparkles className="h-4 w-4" />
                                }
                                {isAnalyzing ? "מנתח..." : "נתח מחדש עם AI"}
                              </button>
                              <button
                                onClick={() => setActiveTab("notes")}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-all"
                              >
                                <BookOpen className="h-4 w-4 text-gray-500" />
                                הערות שלי
                              </button>
                              <button
                                onClick={() => setNotebookOpen(true)}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-violet-200 bg-violet-50 text-violet-700 text-sm font-medium rounded-lg hover:bg-violet-100 transition-all"
                              >
                                <Bot className="h-4 w-4" />
                                שלח ל-NotebookLM
                              </button>
                              <a
                                href="https://notebooklm.google.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-violet-500 hover:text-violet-700 border border-violet-100 rounded-lg hover:bg-violet-50 transition-all"
                              >
                                <ExternalLink className="h-3 w-3" />
                                פתח ב-NotebookLM
                              </a>
                              {isLearned ? (
                                <div className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-lg bg-emerald-500 text-white">
                                  <CheckCircle className="h-4 w-4" />
                                  למידה הושלמה!
                                </div>
                              ) : (
                                <button
                                  onClick={handleMarkLearned}
                                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-all"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  סמן כנלמד
                                </button>
                              )}
                            </div>
                            {analyzeError && (
                              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 space-y-1 text-right">
                                <p className="text-xs font-medium text-amber-800">{ANALYZE_ERRORS[analyzeError]?.msg}</p>
                                <p className="text-xs text-amber-600">{ANALYZE_ERRORS[analyzeError]?.hint}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Empty state — no analysis yet */
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className={cn(
                            "md:col-span-1 bg-white rounded-xl border border-dashed p-6 flex flex-col items-center justify-center text-center gap-3 transition-colors",
                            isAnalyzing ? "border-indigo-200 bg-indigo-50/30" : "border-gray-200"
                          )}>
                            <div className={cn("p-2.5 rounded-xl transition-colors", isAnalyzing ? "bg-indigo-100" : "bg-indigo-50")}>
                              {isAnalyzing
                                ? <div className="h-6 w-6 border-2 border-indigo-400 border-t-indigo-600 rounded-full animate-spin" />
                                : <Sparkles className="h-6 w-6 text-indigo-500" />
                              }
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-700">
                                {isAnalyzing ? "מנתח את הסרטון..." : "הסרטון טרם נותח"}
                              </p>
                              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                                {isAnalyzing
                                  ? "Gemini מנתח את הסרטון ומייצר סיכום ונקודות מפתח"
                                  : "נתח כדי לקבל סיכום, נקודות מפתח ותובנות"}
                              </p>
                            </div>
                            <button
                              onClick={() => { setAnalyzeError(null); handleAnalyzeVideo(false); }}
                              disabled={isAnalyzing}
                              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-wait active:scale-95 transition-all shadow-sm"
                            >
                              {isAnalyzing
                                ? <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                : <Sparkles className="h-4 w-4" />
                              }
                              {isAnalyzing ? "מנתח..." : "נתח סרטון עם AI"}
                            </button>
                            {analyzeError && (
                              <div className="w-full rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 space-y-1 text-right">
                                <p className="text-xs font-medium text-amber-800">{ANALYZE_ERRORS[analyzeError]?.msg}</p>
                                <p className="text-xs text-amber-600">{ANALYZE_ERRORS[analyzeError]?.hint}</p>
                              </div>
                            )}
                          </div>

                          {/* Actions card always visible */}
                          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                            <div className="flex items-center gap-2 mb-3 flex-row-reverse">
                              <div className="p-1.5 bg-violet-50 rounded-lg shrink-0">
                                <Sparkles className="h-4 w-4 text-violet-600" />
                              </div>
                              <h3 className="text-sm font-semibold text-gray-800 flex-1 text-right">פעולות</h3>
                            </div>
                            <div className="space-y-2">
                              <button
                                onClick={() => setActiveTab("notes")}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-all"
                              >
                                <BookOpen className="h-4 w-4 text-gray-500" />
                                הערות שלי
                              </button>
                              <button
                                onClick={() => setNotebookOpen(true)}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-violet-200 bg-violet-50 text-violet-700 text-sm font-medium rounded-lg hover:bg-violet-100 transition-all"
                              >
                                <Bot className="h-4 w-4" />
                                שלח ל-NotebookLM
                              </button>
                              <a
                                href="https://notebooklm.google.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-violet-500 hover:text-violet-700 border border-violet-100 rounded-lg hover:bg-violet-50 transition-all"
                              >
                                <ExternalLink className="h-3 w-3" />
                                פתח ב-NotebookLM
                              </a>
                              {isLearned ? (
                                <div className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-lg bg-emerald-500 text-white">
                                  <CheckCircle className="h-4 w-4" />
                                  למידה הושלמה!
                                </div>
                              ) : (
                                <button
                                  onClick={handleMarkLearned}
                                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-all"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  סמן כנלמד
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    {/* Notes */}
                    <TabsContent value="notes" className="mt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                        {/* Card: הערות שלי */}
                        <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                          <div className="flex items-center gap-2 mb-4 flex-row-reverse">
                            <div className="p-1.5 bg-amber-50 rounded-lg shrink-0">
                              <BookOpen className="h-4 w-4 text-amber-600" />
                            </div>
                            <h3 className="text-sm font-semibold text-gray-800 flex-1 text-right">הערות שלי</h3>
                          </div>
                          <NoteEditor
                            videoId={selectedVideo.id}
                            getPlayerTime={() => playerRef.current?.getCurrentTime?.() ?? null}
                            onSeek={seekTo}
                          />
                        </div>

                      </div>
                    </TabsContent>

                    {/* Presentations */}
                    <TabsContent value="presentations" className="mt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                        {/* Card: חומרים נלווים */}
                        <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                          <div className="flex items-center gap-2 mb-4 flex-row-reverse">
                            <div className="p-1.5 bg-indigo-50 rounded-lg shrink-0">
                              <Paperclip className="h-4 w-4 text-indigo-600" />
                            </div>
                            <h3 className="text-sm font-semibold text-gray-800 flex-1 text-right">חומרים נלווים</h3>
                            <button
                              onClick={() => setAddPresOpen(true)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              הוסף
                            </button>
                          </div>

                          {selectedVideo.presentations?.length > 0 ? (
                            <div className="space-y-4">
                              {/* Images grid */}
                              {selectedVideo.presentations.some((p) => p.type === "image") && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 mb-2 text-right">תמונות</p>
                                  <div className="grid grid-cols-3 gap-2">
                                    {selectedVideo.presentations
                                      .map((pres, origIdx) => ({ ...pres, origIdx }))
                                      .filter((pres) => pres.type === "image")
                                      .map((pres) => (
                                        <div
                                          key={pres.origIdx}
                                          className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-square bg-gray-50"
                                        >
                                          <button
                                            onClick={() => setLightboxImage(pres)}
                                            className="w-full h-full"
                                            title={pres.title}
                                          >
                                            <img
                                              src={pres.url}
                                              alt={pres.title}
                                              className="w-full h-full object-cover"
                                              onError={(e) => { e.target.style.display = "none"; }}
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                              <ZoomIn className="h-5 w-5 text-white" />
                                            </div>
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleRemovePresentation(pres.origIdx); }}
                                            className="absolute top-1 right-1 w-5 h-5 bg-black/50 hover:bg-red-500 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                                            title="הסר"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}

                              {/* Files / links list */}
                              {selectedVideo.presentations.some((p) => p.type !== "image") && (
                                <div>
                                  {selectedVideo.presentations.some((p) => p.type === "image") && (
                                    <p className="text-xs font-semibold text-gray-500 mb-2 text-right">קבצים וקישורים</p>
                                  )}
                                  <div className="space-y-2">
                                    {selectedVideo.presentations
                                      .map((pres, origIdx) => ({ ...pres, origIdx }))
                                      .filter((pres) => pres.type !== "image")
                                      .map((pres) => (
                                        <div
                                          key={pres.origIdx}
                                          className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors group flex-row-reverse"
                                        >
                                          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                            {presTypeIcon(pres.type)}
                                          </div>
                                          <div className="flex-1 min-w-0 text-right">
                                            <p className="text-sm font-medium text-gray-700 truncate">{pres.title}</p>
                                            <p className="text-xs text-gray-400 truncate" dir="ltr">{pres.url}</p>
                                          </div>
                                          <a
                                            href={pres.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                            title="פתח קישור"
                                          >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                          </a>
                                          <button
                                            onClick={() => handleRemovePresentation(pres.origIdx)}
                                            className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                            title="הסר"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="py-12 border border-dashed border-gray-200 rounded-xl flex flex-col items-center gap-3">
                              <div className="p-2.5 bg-gray-50 rounded-xl">
                                <Paperclip className="h-6 w-6 text-gray-300" />
                              </div>
                              <div className="text-center">
                                <p className="text-sm text-gray-500 font-medium">אין חומרים נלווים</p>
                                <p className="text-xs text-gray-400 mt-1">הוסף מצגות, PDFs וקישורים רלוונטיים</p>
                              </div>
                              <button
                                onClick={() => setAddPresOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
                              >
                                <Plus className="h-4 w-4" />
                                הוסף ראשון
                              </button>
                            </div>
                          )}
                        </div>

                        {/* ── Screenshots section (IndexedDB) ── */}
                        <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                          <div className="flex items-center gap-2 mb-4 flex-row-reverse">
                            <div className="p-1.5 bg-rose-50 rounded-lg shrink-0">
                              <ImageIcon className="h-4 w-4 text-rose-500" />
                            </div>
                            <h3 className="text-sm font-semibold text-gray-800 flex-1 text-right">צילומי מסך</h3>
                            {/* Hidden file input — triggered by the label button */}
                            <label className="cursor-pointer flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors shrink-0">
                              <Plus className="h-3.5 w-3.5" />
                              העלה תמונה
                              <input
                                ref={screenshotInputRef}
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={handleScreenshotUpload}
                              />
                            </label>
                          </div>

                          {screenshotsLoading ? (
                            <p className="text-xs text-gray-400 text-center py-6">טוען...</p>
                          ) : screenshotsError ? (
                            <p className="text-xs text-amber-600 text-center py-6">
                              אחסון תמונות אינו זמין בדפדפן זה (מצב פרטי?)
                            </p>
                          ) : screenshots.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                              {screenshots.map((att) => (
                                <div
                                  key={att.id}
                                  className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-square bg-gray-50"
                                >
                                  <button
                                    onClick={() => setLightboxImage({ title: att.name, url: att.dataUrl })}
                                    className="w-full h-full"
                                    title={att.name}
                                  >
                                    <img
                                      src={att.dataUrl}
                                      alt={att.name}
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <ZoomIn className="h-5 w-5 text-white" />
                                    </div>
                                  </button>
                                  <button
                                    onClick={() => {
                                      deleteScreenshot.mutate({ id: att.id, videoId: selectedVideo.id });
                                      toast.success("צילום המסך הוסר");
                                    }}
                                    className="absolute top-1 right-1 w-5 h-5 bg-black/50 hover:bg-red-500 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                                    title="הסר"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-10 border border-dashed border-gray-200 rounded-xl flex flex-col items-center gap-2.5">
                              <ImageIcon className="h-7 w-7 text-gray-200" />
                              <div className="text-center">
                                <p className="text-sm text-gray-400 font-medium">אין צילומי מסך עדיין</p>
                                <p className="text-xs text-gray-300 mt-0.5">לחץ "העלה תמונה" כדי להוסיף</p>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    </TabsContent>

                    {/* AI / Notebook */}
                    <TabsContent value="notebook" className="mt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                        {/* Card: NotebookLM */}
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                          <div className="flex items-center gap-2 mb-3 flex-row-reverse">
                            <div className="p-1.5 rounded-lg bg-violet-50 shrink-0">
                              <Bot className="h-4 w-4 text-violet-600" />
                            </div>
                            <h3 className="text-sm font-semibold text-gray-800 flex-1 text-right">NotebookLM</h3>
                          </div>
                          <p className="text-sm text-gray-500 mb-4 text-right leading-relaxed">
                            ייצא את תוכן הסרטון לפורמט מוכן לייבוא ב-NotebookLM של Google.
                          </p>
                          <button
                            onClick={() => setNotebookOpen(true)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 active:scale-95 transition-all shadow-sm"
                          >
                            <Bot className="h-4 w-4" />
                            שלח ל-NotebookLM
                          </button>
                          <a
                            href="https://notebooklm.google.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-1.5 mt-2 px-4 py-2 text-sm font-medium text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50 transition-all"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            פתח ב-NotebookLM
                          </a>
                        </div>

                        {/* Card: ניתוח AI */}
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                          <div className="flex items-center gap-2 mb-3 flex-row-reverse">
                            <div className="p-1.5 rounded-lg bg-indigo-50 shrink-0">
                              <Sparkles className="h-4 w-4 text-indigo-600" />
                            </div>
                            <h3 className="text-sm font-semibold text-gray-800 flex-1 text-right">ניתוח AI</h3>
                          </div>
                          <p className="text-sm text-gray-500 mb-4 text-right leading-relaxed">
                            נתח את הסרטון עם Gemini וקבל סיכום, נקודות מפתח ותגיות. התוצאות יופיעו בטאב סיכום.
                          </p>
                          <button
                            onClick={() => { setAnalyzeError(null); handleAnalyzeVideo(hasAiAnalysis); }}
                            disabled={isAnalyzing}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 active:scale-95 transition-all shadow-sm"
                          >
                            {isAnalyzing ? (
                              <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                            {isAnalyzing ? "מנתח..." : hasAiAnalysis ? "נתח מחדש" : "נתח עם AI"}
                          </button>
                          {(effectiveVideo.shortSummary || hasAiAnalysis) && !isAnalyzing && (
                            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg flex-row-reverse">
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <p className="text-xs text-emerald-700 text-right flex-1">
                                {hasAiAnalysis ? "ניתוח AI שמור — ניתן לנתח מחדש" : "סיכום קיים — ניתן לנתח מחדש לעדכון"}
                              </p>
                            </div>
                          )}
                          {analyzeError && (
                            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 space-y-1 text-right">
                              <p className="text-xs font-medium text-amber-800">{ANALYZE_ERRORS[analyzeError]?.msg}</p>
                              <p className="text-xs text-amber-600">{ANALYZE_ERRORS[analyzeError]?.hint}</p>
                            </div>
                          )}
                        </div>

                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Mobile: video selector */}
                  <div className="lg:hidden bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
                    <label className="text-xs font-semibold text-gray-500 mb-2 block">בחר סרטון</label>
                    <Select value={selectedVideo.id} onValueChange={(id) => setSelectedVideoId(id)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredVideos.map((v) => (
                          <SelectItem key={v.id} value={v.id}>{v.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                </div>
              ) : (
                <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
                  <p className="text-sm text-gray-400">בחר סרטון מהרשימה</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ═══ Dialogs ═══ */}
      <NotebookDialog
        open={notebookOpen}
        onClose={() => setNotebookOpen(false)}
        video={selectedVideo}
        topic={topic}
        mentorName={mentorName}
      />
      <AddPresentationDialog
        open={addPresOpen}
        onClose={() => setAddPresOpen(false)}
        onAdd={handleAddPresentation}
      />
      <ImageLightboxDialog
        image={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  );
}
