import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { ExternalLink, Sparkles, Eye, X, Clock, StickyNote, Calendar, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Video } from "@/api/entities";
import { analyzeVideoWithAI } from "@/api/functions";
import { analyzeVideo, generateChaptersFromTranscript } from "@/services/videoAnalytics";
import { fetchTranscript, parseTranscript } from "@/services/youtubeTranscript";
import { extractTimestampsFromDescription, getVideoIdFromUrl } from "@/services/youtubeMetadata";
import { fetchVideoDescription } from "@/services/youtubeApi";
import {
  getCachedVideoMetadata,
  setCachedVideoMetadata,
  shouldFetchVideoMetadata,
} from "@/services/youtubeChapterCache";
import { updateStoredVideo } from "@/services/videoStorage";
import { useUpdateSummary } from "@/hooks/useVideos";
import { useNotesByVideo } from "@/hooks/useNotes";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "./StatusBadge";
import { CategoryBadge } from "./CategoryBadge";
import { LearningStatusBadge, LEARNING_STATUSES } from "./LearningStatusBadge";
import { SaveButton } from "./SaveButton";
import { NoteEditor } from "./NoteEditor";
import ChapterItem from "./ChapterItem";

function getWatchUrl(video) {
  if (!video) return "";
  const raw = video.url || video.link || video.videoUrl;
  return typeof raw === "string" ? raw.trim() : "";
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

export function VideoDetailPanel({
  video,
  mentorName,
  open,
  onOpenChange,
  topics = [],
  onSaveToggle,
  onLearningStatusChange,
  onRemoveTopic,
  onAnalyzeDone,
  onVideoPatch,
}) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");
  const [youtubeChaptersHint, setYoutubeChaptersHint] = useState(null);
  const [isYoutubeChaptersFetch, setIsYoutubeChaptersFetch] = useState(false);
  const updateSummary = useUpdateSummary();
  const queryClient = useQueryClient();

  // Enrich video with local AI analysis (instant, no API call) if not already done
  const enrichedVideo = useMemo(
    () => (video?.aiSummaryShort ? video : analyzeVideo(video || {})),
    [video]
  );

  const baseChapters = useMemo(() => {
    const v = video || {};
    const enriched = v?.aiSummaryShort ? v : analyzeVideo(v);
    const descForChapters = typeof v.description === "string" ? v.description : "";
    const chaptersFromDesc = extractTimestampsFromDescription(descForChapters);
    if (chaptersFromDesc.length > 0) return chaptersFromDesc;
    return v.aiChapters || enriched.aiChapters;
  }, [video]);

  useEffect(() => {
    setYoutubeChaptersHint(null);
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
        };
      });
      const mergedDesc =
        descText ||
        (typeof video.description === "string" ? video.description : "") ||
        "";
      const updates = { aiChapters, ...(mergedDesc ? { description: mergedDesc } : {}) };

      const localSaved = updateStoredVideo(video.id, updates);
      if (localSaved) {
        onVideoPatch?.(localSaved);
        toast.success("פרקים עם timestamps אמיתיים נשמרו");
        return;
      }

      try {
        await Video.update(video.id, updates);
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

  if (!video) return null;

  const handleAnalyze = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalyzeError(null);
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
      });

      const transcriptToStore =
        transcriptRaw && transcriptRaw.length > 0
          ? transcriptRaw.slice(0, 80_000)
          : undefined;

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

  // Re-analyze locally using new estimatedChapters logic — no AI/API call required
  const handleReanalyzeLocal = async () => {
    setIsReanalyzing(true);
    try {
      const reanalyzed = analyzeVideo(video, { force: true });
      const updates = {
        aiChapters:     reanalyzed.aiChapters,
        aiSummaryShort: reanalyzed.aiSummaryShort,
        aiSummaryLong:  reanalyzed.aiSummaryLong,
        aiTags:         reanalyzed.aiTags,
        analyzedAt:     reanalyzed.analyzedAt,
      };

      const localSaved = updateStoredVideo(video.id, updates);
      if (localSaved) {
        onVideoPatch?.(localSaved);
        const hasClickable = reanalyzed.aiChapters?.some((c) => Number.isFinite(c.startSeconds));
        toast.success(hasClickable ? "פרקים עודכנו — ניווט משוער זמין" : "ניתוח עודכן — חסר משך סרטון לחישוב זמנים");
        return;
      }

      try {
        await Video.update(video.id, updates);
        queryClient.invalidateQueries({ queryKey: ["videos"] });
        onVideoPatch?.({ ...video, ...updates });
        const hasClickable = reanalyzed.aiChapters?.some((c) => Number.isFinite(c.startSeconds));
        toast.success(hasClickable ? "פרקים עודכנו — ניווט משוער זמין" : "ניתוח עודכן — חסר משך סרטון לחישוב זמנים");
      } catch {
        toast.error("לא ניתן לשמור — נסה שוב");
      }
    } finally {
      setIsReanalyzing(false);
    }
  };

  // תאריך יחסי — "לפני X שעות/ימים", ועבור ישנים: תאריך מלא
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
    const n = video.viewCount;
    if (!n) return null;
    if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M צפיות`;
    if (n >= 1_000)     return `${+(n / 1_000).toFixed(1)}K צפיות`;
    return `${n} צפיות`;
  })();

  const videoTopics = (video.topicIds || [])
    .map((id) => topics.find((t) => t.id === id))
    .filter(Boolean);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-[96vw] w-[96vw] h-[94vh] p-0 overflow-hidden flex flex-col gap-0"
      >
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3 left-3 z-50 p-1.5 rounded-full bg-white/80 hover:bg-gray-100 shadow-sm transition-colors"
        >
          <X className="h-4 w-4 text-gray-600" />
        </button>

        <ScrollArea className="flex-1">
          <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">

            {/* ── Thumbnail ── */}
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-gray-100 shadow-md">
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full h-full object-cover"
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
                  <ExternalLink className="h-5 w-5 text-gray-800" />
                </div>
              </a>
            </div>

            {/* ── 3. כותרת — hierarchy חזקה יותר ── */}
            <div className="space-y-3">
              <div className="flex items-start gap-2 flex-row-reverse">
                <h2 className="flex-1 text-right text-2xl font-bold leading-snug text-gray-900 tracking-tight">
                  {video.title}
                </h2>
                <SaveButton isSaved={video.isSaved} onClick={() => onSaveToggle?.(video)} size="md" />
              </div>

              {/* Metadata chips — white cards with border */}
              <div className="flex flex-wrap items-center gap-2" dir="rtl">
                {video.duration && (
                  <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    {video.duration}
                  </span>
                )}
                {viewCountFormatted && (
                  <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm">
                    <Eye className="h-3.5 w-3.5 text-gray-400" />
                    {viewCountFormatted}
                  </span>
                )}
                {relativeDate && (
                  <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    {relativeDate}
                  </span>
                )}
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm hover:bg-gray-50 transition-colors"
                >
                  <Link2 className="h-3.5 w-3.5 text-gray-400" />
                  העתק קישור
                </button>
                {mentorName && mentorName !== "לא ידוע" && (
                  <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-medium px-2.5 py-1.5 rounded-xl">
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
                  className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm hover:bg-gray-50 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                  NotebookLM
                </a>
                <CategoryBadge category={video.category} />
                <StatusBadge status={video.status} />
              </div>
            </div>

            {/* Note preview */}
            {notePreview && (
              <button
                onClick={() => setActiveTab("notes")}
                className="flex items-start gap-1.5 flex-row-reverse text-right hover:opacity-70 transition-opacity w-full"
              >
                <StickyNote className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-500 line-clamp-2 leading-relaxed">{notePreview}</p>
              </button>
            )}

            {/* ── 4. תקציר — white card with shadow ── */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-4 py-4 text-right">
              {(video.shortSummary || enrichedVideo.aiSummaryShort) ? (
                <>
                  <p className="text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest">מה תלמד כאן</p>
                  <p className="text-sm text-gray-800 leading-7 line-clamp-3">{(video.shortSummary || enrichedVideo.aiSummaryShort).replace(/\[MOCK\]\s*/g, '')}</p>
                </>
              ) : (
                <p className="text-xs text-gray-500 text-center py-1">הסרטון טרם נותח — פתח את טאב הסיכום כדי לנתח עם AI</p>
              )}
            </div>

            {/* ── Progress bar + סטטוס למידה ── */}
            {(() => {
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
                      <SelectTrigger className="h-7 text-xs bg-white border-gray-200 w-[145px]" dir="rtl">
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
                  <div className="relative h-2.5 bg-gray-200 rounded-full overflow-visible" dir="ltr">
                    {/* Filled track */}
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: "linear-gradient(90deg, #6366f1 0%, #818cf8 100%)",
                      }}
                    />
                    {/* Dot indicator */}
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
            {videoTopics.length > 0 && (
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

            {/* ── 2. טאבים — segmented control pills ── */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" dir="rtl">
              <TabsList className="w-full bg-gray-100 rounded-2xl p-1 h-auto grid grid-cols-3 gap-0.5">
                <TabsTrigger
                  value="summary"
                  className="text-xs rounded-xl py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=active]:text-gray-900 text-gray-500 transition-all"
                >
                  סיכום
                </TabsTrigger>
                <TabsTrigger
                  value="keypoints"
                  className="text-xs rounded-xl py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=active]:text-gray-900 text-gray-500 transition-all"
                >
                  נקודות מפתח
                </TabsTrigger>
                <TabsTrigger
                  value="notes"
                  className="text-xs rounded-xl py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=active]:text-gray-900 text-gray-500 transition-all"
                >
                  הערות
                </TabsTrigger>
              </TabsList>

              {/* ── Summary tab ── */}
              <TabsContent value="summary" className="mt-5 space-y-5 min-h-[220px]">
                <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-3 space-y-2 text-right">
                  <button
                    type="button"
                    onClick={handleFetchYoutubeChapters}
                    disabled={isYoutubeChaptersFetch}
                    className="w-full sm:w-auto text-xs font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {isYoutubeChaptersFetch ? "טוען מתיאור יוטיוב…" : "נסה להביא פרקים מיוטיוב"}
                  </button>
                  {youtubeChaptersHint === "no_api_key" && (
                    <p className="text-xs text-amber-700 leading-relaxed">
                      צריך להגדיר YouTube API Key כדי להביא timestamps אמיתיים (בקובץ .env.local — לא ב-git)
                    </p>
                  )}
                  {youtubeChaptersHint === "no_timestamps" && (
                    <p className="text-xs text-gray-600 leading-relaxed">
                      לא נמצאו timestamps בתיאור הסרטון
                    </p>
                  )}
                  {youtubeChaptersHint === "fetch_failed" && (
                    <p className="text-xs text-gray-600 leading-relaxed">
                      לא ניתן להביא את התיאור כרגע — נסה שוב מאוחר יותר
                    </p>
                  )}
                </div>
                {(() => {
                  const summaryShort = (video.shortSummary || enrichedVideo.aiSummaryShort)?.replace(/\[MOCK\]\s*/g, '');
                  const summaryLong  = (video.fullSummary  || enrichedVideo.aiSummaryLong)?.replace(/\[MOCK\]\s*/g, '');
                  const chapters = baseChapters;
                  const watchUrl = getWatchUrl(video);
                  const hasData = summaryShort || summaryLong || video.keyPoints?.length > 0 || chapters?.length > 0;
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
                        {!summaryShort && !summaryLong && video.keyPoints?.length > 0 && (
                          <div className="text-right">
                            <h4 className="text-sm font-semibold text-gray-800 mb-3">נקודות מפתח</h4>
                            <ul className="space-y-2.5">
                              {video.keyPoints.map((point, i) => (
                                <li key={i} className="flex items-start gap-2.5 flex-row-reverse text-sm text-gray-800">
                                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                                  <span className="leading-relaxed">{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

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
                                  {allClickable && (
                                    <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                                      ניווט זמין
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-gray-400 leading-snug text-left max-w-[200px]">
                                  כחול = אמיתי · כתום = משוער · אפור = חסר משך
                                </span>
                              </div>

                              {/* Old chapters banner */}
                              {hasOldChapters && !isReanalyzing && (
                                <div className="flex items-center justify-between gap-2 px-3 py-2 mb-3 rounded-lg bg-amber-50 border border-amber-200" dir="rtl">
                                  <span className="text-xs text-amber-700">פרקים ישנים — ניווט לא זמין</span>
                                  <button
                                    onClick={handleReanalyzeLocal}
                                    className="text-xs px-2.5 py-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors font-medium shrink-0"
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
                                      key={
                                        chapter.startSeconds != null
                                          ? `${String(chapter.startSeconds)}-${chapter.title || index}`
                                          : `ch-${index}-${chapter.title || ""}`
                                      }
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

                        {/* Action buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={handleReanalyzeLocal}
                            disabled={isReanalyzing || isAnalyzing}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 border border-amber-200 text-amber-700 text-xs font-medium rounded-xl hover:bg-amber-50 disabled:opacity-50 transition-all"
                            title="עדכן פרקים עם לוגיקת הניווט החדשה — ללא קריאת AI"
                          >
                            {isReanalyzing ? <div className="h-3.5 w-3.5 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" /> : "⟳"}
                            {isReanalyzing ? "מעדכן..." : "עדכן ניווט"}
                          </button>
                          <button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || isReanalyzing}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-all"
                          >
                            {isAnalyzing ? <div className="h-3.5 w-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                            {isAnalyzing ? "מנתח..." : "נתח מחדש עם AI"}
                          </button>
                        </div>
                        {analyzeError && (
                          <div className="w-full rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700 text-right leading-relaxed">{analyzeError}</div>
                        )}
                      </>
                    );
                  }
                  return (
                    <div className="flex flex-col items-center gap-4 py-10 text-center">
                      <div className="p-3 bg-indigo-50 rounded-2xl">
                        <Sparkles className="h-6 w-6 text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">הסרטון טרם נותח</p>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">ניתוח AI יפיק סיכום, נקודות מפתח ותגיות</p>
                      </div>
                      <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 active:scale-95 transition-all shadow-sm"
                      >
                        {isAnalyzing ? <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {isAnalyzing ? "מנתח..." : "נתח עם AI"}
                      </button>
                      {analyzeError && (
                        <div className="w-full rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700 text-right leading-relaxed">{analyzeError}</div>
                      )}
                    </div>
                  );
                })()}
              </TabsContent>

              {/* ── Key Points tab ── */}
              <TabsContent value="keypoints" className="mt-5 space-y-4 min-h-[220px]" dir="rtl">
                {video.keyPoints && video.keyPoints.length > 0 ? (
                  <ul className="space-y-3 text-right">
                    {video.keyPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-3 flex-row-reverse">
                        {/* numbered chip */}
                        <span className="mt-0.5 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm text-gray-800 leading-7">{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 text-right py-6">אין נקודות מפתח זמינות</p>
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
              <TabsContent value="notes" className="mt-5 min-h-[220px]">
                <NoteEditor videoId={video.id} />
              </TabsContent>
            </Tabs>

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
