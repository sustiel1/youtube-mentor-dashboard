import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Link2, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Video } from "@/api/entities";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isBase44Enabled } from "@/config/base44Flags";
import { useCreateTopic } from "@/hooks/useTopics";
import {
  getDeletedVideoRestoreInfo,
  getLocalVideos,
  isVideoDeleted,
  restoreDeletedVideo,
  saveLocalVideo,
} from "@/lib/localVideoStore";
import { formatTopicLabel } from "@/lib/topicFilters";
import { buildFreshImportRecord, clearVideoGeneratedCaches, saveFreshImportRecordLocally, stripFreshImportFlags } from "@/lib/videoFreshImport";
import { mergeRestoredVideoWithFreshMetadata } from "@/lib/videoRestoreMerge";
import { isValidYouTubeUrl, parseYouTubeVideoId } from "@/lib/youtubeUrlParser";
import { buildExternalVideoObject } from "@/services/youtubeOEmbed";
import { loadTopics } from "@/services/topicStorage";

const STATE = {
  idle: "idle",
  valid: "valid",
  invalid: "invalid",
  loading: "loading",
  error: "error",
  restore_prompt: "restore_prompt",
  duplicate_prompt: "duplicate_prompt",
};

const TOPIC_CHOICE_NEW = "__new_topic__";

function mergedVideoListForDedup(queryClient) {
  const queryVideos = queryClient.getQueryData(["videos"]);
  const localVideos = getLocalVideos();
  const out = [];
  const seen = new Set();

  for (const list of [Array.isArray(queryVideos) ? queryVideos : [], localVideos]) {
    for (const video of list) {
      if (!video?.id || seen.has(video.id)) continue;
      if (video.url && isVideoDeleted(video.url)) continue;
      if (video.deleted === true || video.isDeleted === true) continue;
      seen.add(video.id);
      out.push(video);
    }
  }

  return out;
}

function findVideoByYoutubeId(videos, ytId) {
  if (!ytId || !Array.isArray(videos)) return null;
  return (
    videos.find((video) => {
      const fromUrl = video.url ? parseYouTubeVideoId(video.url) : null;
      const legacyId = video._videoId ? String(video._videoId).trim() : null;
      return (
        video.videoId === ytId ||
        video.youtubeId === ytId ||
        fromUrl === ytId ||
        legacyId === ytId
      );
    }) ?? null
  );
}

async function resolveTopicIds(topicChoice, newTopicName, createTopic) {
  if (topicChoice === "all") return [];
  if (topicChoice !== TOPIC_CHOICE_NEW) return [topicChoice];

  const trimmed = newTopicName.trim();
  if (!trimmed) {
    throw new Error("TOPIC_NAME_REQUIRED");
  }

  const allTopics = loadTopics();
  const existing = allTopics.find(
    (topic) => String(topic.name || "").trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (existing) return [existing.id];

  try {
    const created = await createTopic.mutateAsync({ name: trimmed, color: "violet" });
    return [created.id];
  } catch {
    const after = loadTopics();
    const fallback = after.find(
      (topic) => String(topic.name || "").trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (fallback) return [fallback.id];
    throw new Error("TOPIC_CREATE_FAILED");
  }
}

export function ExternalVideoModal({ open, onClose, onVideoAdded, mentors = [], topics = [] }) {
  const [url, setUrl] = useState("");
  const [optionalTitle, setOptionalTitle] = useState("");
  const [mentorChoice, setMentorChoice] = useState("all");
  const [topicChoice, setTopicChoice] = useState("all");
  const [newTopicName, setNewTopicName] = useState("");
  const [topicFieldError, setTopicFieldError] = useState("");
  const [phase, setPhase] = useState(STATE.idle);
  const [errorMsg, setErrorMsg] = useState("");
  const [restoreInfo, setRestoreInfo] = useState(null);
  const [duplicateVideo, setDuplicateVideo] = useState(null);
  const inputRef = useRef(null);
  const queryClient = useQueryClient();
  const createTopic = useCreateTopic();

  useEffect(() => {
    if (!open) return;
    setUrl("");
    setOptionalTitle("");
    setMentorChoice("all");
    setTopicChoice("all");
    setNewTopicName("");
    setTopicFieldError("");
    setPhase(STATE.idle);
    setErrorMsg("");
    setRestoreInfo(null);
    setDuplicateVideo(null);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  const buildAddOptions = async () => {
    const topicIds = await resolveTopicIds(topicChoice, newTopicName, createTopic);
    const mentorId = mentorChoice !== "all" ? mentorChoice : null;
    return { topicIds, mentorId };
  };

  const openExistingVideo = (existingVideo) => {
    if (!existingVideo) return;
    toast.message("הסרטון כבר קיים במערכת", {
      description: "נטענת הגרסה הקיימת של הסרטון",
    });
    queryClient.invalidateQueries({ queryKey: ["videos"] });
    onVideoAdded?.(existingVideo);
    onClose?.();
  };

  const handleUrlChange = (event) => {
    const value = event.target.value;
    setUrl(value);
    setErrorMsg("");
    setRestoreInfo(null);
    setDuplicateVideo(null);
    if (phase === STATE.restore_prompt || phase === STATE.duplicate_prompt) {
      setPhase(STATE.idle);
    }
    if (!value.trim()) {
      setPhase(STATE.idle);
      return;
    }
    setPhase(isValidYouTubeUrl(value) ? STATE.valid : STATE.invalid);
  };

  const handleRestore = async () => {
    const videoId = parseYouTubeVideoId(url);
    if (!videoId || !restoreInfo) return;

    setPhase(STATE.loading);
    setErrorMsg("");
    setTopicFieldError("");

    try {
      const { topicIds, mentorId } = await buildAddOptions();
      const fresh = await buildExternalVideoObject(videoId, {
        titleOverride: optionalTitle,
        mentorId,
        topicIds,
        source: "manual",
      });

      const merged = mergeRestoredVideoWithFreshMetadata(restoreInfo.archived, fresh);
      const restored = restoreDeletedVideo({
        ytId: videoId,
        url: restoreInfo.url || fresh.url,
        patch: merged,
      });

      if (!restored) {
        throw new Error("שחזור הסרטון נכשל");
      }

      queryClient.invalidateQueries({ queryKey: ["videos"] });
      queryClient.invalidateQueries({ queryKey: ["topics"] });
      toast.success("הסרטון שוחזר בהצלחה");
      onVideoAdded?.(restored);
      onClose?.();
    } catch (err) {
      if (err?.message === "TOPIC_NAME_REQUIRED") {
        setTopicFieldError("יש להזין שם לנושא החדש");
        setPhase(STATE.restore_prompt);
        return;
      }
      if (err?.message === "TOPIC_CREATE_FAILED") {
        toast.error("לא ניתן ליצור את הנושא — נסה שוב");
        setPhase(STATE.restore_prompt);
        return;
      }
      setPhase(STATE.error);
      setErrorMsg(err?.message || "שגיאה בשחזור הסרטון");
    }
  };

  const handleDuplicateReimport = async () => {
    const videoId = parseYouTubeVideoId(url);
    if (!videoId || !duplicateVideo) return;

    setPhase(STATE.loading);
    setErrorMsg("");
    setTopicFieldError("");

    try {
      const { topicIds, mentorId } = await buildAddOptions();
      const fresh = await buildExternalVideoObject(videoId, {
        titleOverride: optionalTitle,
        mentorId,
        topicIds,
        source: "manual",
      });

      clearVideoGeneratedCaches(duplicateVideo);
      const reimported = buildFreshImportRecord(duplicateVideo, fresh, {
        requestFreshAnalysis: true,
        requestedAt: new Date().toISOString(),
        requestSource: "duplicate_modal",
      });
      const localSaved = saveFreshImportRecordLocally(reimported) || reimported;

      if (isBase44Enabled()) {
        try {
          await Video.update(duplicateVideo.id, stripFreshImportFlags(localSaved));
        } catch (err) {
          console.warn("[FreshImport] Base44 sync failed (non-blocking):", err?.message);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["videos"] });
      queryClient.invalidateQueries({ queryKey: ["topics"] });
      toast.success("הסרטון אופס וייובא מחדש מאפס");
      onVideoAdded?.(localSaved);
      onClose?.();
    } catch (err) {
      if (err?.message === "TOPIC_NAME_REQUIRED") {
        setTopicFieldError("יש להזין שם לנושא החדש");
        setPhase(STATE.duplicate_prompt);
        return;
      }
      if (err?.message === "TOPIC_CREATE_FAILED") {
        toast.error("לא ניתן ליצור את הנושא — נסה שוב");
        setPhase(STATE.duplicate_prompt);
        return;
      }
      setPhase(STATE.error);
      setErrorMsg(err?.message || "שגיאה בייבוא מחדש של הסרטון");
    }
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    if (phase === STATE.restore_prompt) {
      await handleRestore();
      return;
    }
    if (phase === STATE.duplicate_prompt) {
      return;
    }
    if (phase !== STATE.valid) return;

    const videoId = parseYouTubeVideoId(url);
    if (!videoId) {
      setPhase(STATE.invalid);
      return;
    }

    const combined = mergedVideoListForDedup(queryClient);
    const activeDuplicate = findVideoByYoutubeId(combined, videoId);
    if (activeDuplicate) {
      setDuplicateVideo(activeDuplicate);
      setPhase(STATE.duplicate_prompt);
      return;
    }

    const deletedInfo = getDeletedVideoRestoreInfo(videoId, url.trim());
    if (deletedInfo) {
      setRestoreInfo(deletedInfo);
      setPhase(STATE.restore_prompt);
      return;
    }

    setPhase(STATE.loading);
    setErrorMsg("");
    setTopicFieldError("");

    try {
      const { topicIds, mentorId } = await buildAddOptions();
      const videoObj = await buildExternalVideoObject(videoId, {
        titleOverride: optionalTitle,
        mentorId,
        topicIds,
        source: "manual",
      });

      const added = saveLocalVideo(videoObj);
      if (!added) {
        const retryDeleted = getDeletedVideoRestoreInfo(videoId, url.trim());
        if (retryDeleted) {
          setRestoreInfo(retryDeleted);
          setPhase(STATE.restore_prompt);
          return;
        }

        const after = mergedVideoListForDedup(queryClient);
        const dup = findVideoByYoutubeId(after, videoId);
        if (dup) {
          setDuplicateVideo(dup);
          setPhase(STATE.duplicate_prompt);
          return;
        }

        setPhase(STATE.error);
        setErrorMsg("לא ניתן להוסיף את הסרטון — נסה שוב");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["videos"] });
      queryClient.invalidateQueries({ queryKey: ["topics"] });
      onVideoAdded?.(added);
    } catch (err) {
      if (err?.message === "TOPIC_NAME_REQUIRED") {
        setTopicFieldError("יש להזין שם לנושא החדש");
        setPhase(STATE.valid);
        return;
      }
      if (err?.message === "TOPIC_CREATE_FAILED") {
        toast.error("לא ניתן ליצור את הנושא — נסה שוב");
        setPhase(STATE.valid);
        return;
      }
      setPhase(STATE.error);
      setErrorMsg(err?.message || "שגיאה בעת טעינת המטא-דאטה");
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") handleSubmit();
    if (event.key === "Escape") onClose?.();
  };

  const videoId = url.trim() ? parseYouTubeVideoId(url) : null;
  const isLoading = phase === STATE.loading;
  const isBusy = isLoading || createTopic.isPending;
  const isRestorePrompt = phase === STATE.restore_prompt;
  const isDuplicatePrompt = phase === STATE.duplicate_prompt;
  const isReadyState = phase === STATE.valid || isRestorePrompt || isDuplicatePrompt;
  const canSubmit =
    (phase === STATE.valid || isRestorePrompt) &&
    !isBusy &&
    (topicChoice !== TOPIC_CHOICE_NEW || newTopicName.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !isBusy) onClose?.(); }}>
      <DialogContent
        dir="rtl"
        className="max-w-md w-full p-0 gap-0 overflow-hidden border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
              <Link2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <DialogTitle className="text-[15px] font-semibold text-slate-900 dark:text-zinc-100">
                {isRestorePrompt
                  ? "שחזור סרטון שנמחק"
                  : isDuplicatePrompt
                    ? "הסרטון כבר קיים"
                    : "הוסף סרטון לפי קישור"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                {isRestorePrompt
                  ? "הסרטון נמצא במערכת אך הוסר מהרשימה הפעילה — ניתן לשחזר אותו עם הנתונים השמורים"
                  : isDuplicatePrompt
                    ? "אפשר לטעון את הגרסה הקיימת, או לייבא מחדש מאפס עם ניקוי של הניתוחים והקאש"
                    : "הדבק קישור YouTube והסרטון יתווסף לדשבורד כווידאו רגיל עם כל יכולות הלמידה והמוח"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {isRestorePrompt && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-right dark:border-amber-800/50 dark:bg-amber-950/30">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                הסרטון נמצא במערכת אך נמחק בעבר. האם לשחזר אותו?
              </p>
              {restoreInfo?.archived?.title && (
                <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-300/90 line-clamp-2">
                  {restoreInfo.archived.title}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setRestoreInfo(null);
                    setPhase(STATE.valid);
                  }}
                  className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-800 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  בטל
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {isBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  שחזר סרטון
                </button>
              </div>
            </div>
          )}

          {isDuplicatePrompt && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-right dark:border-orange-800/50 dark:bg-orange-950/30">
              <p className="text-sm font-semibold text-orange-900 dark:text-orange-200">
                ⚠ הסרטון כבר קיים במערכת
              </p>
              {duplicateVideo?.title && (
                <p className="mt-1 text-xs text-orange-800/90 dark:text-orange-300/90 line-clamp-2">
                  {duplicateVideo.title}
                </p>
              )}
              <p className="mt-2 text-[11px] text-orange-700/90 dark:text-orange-300/80">
                ייבוא מחדש מאפס ינקה קטגוריה, המלצות, תמלול, ניתוח AI וקאש מקומי — בלי למחוק הערות ידניות או קבצי Obsidian.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => openExistingVideo(duplicateVideo)}
                  className="inline-flex items-center justify-center rounded-lg border border-orange-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-orange-50 disabled:opacity-50 dark:border-orange-800 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  טען גרסה קיימת
                </button>
                <button
                  type="button"
                  disabled={!videoId || isBusy}
                  onClick={handleDuplicateReimport}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {isBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  ייבא מחדש מאפס
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-zinc-400 block">
              קישור YouTube
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="url"
                value={url}
                onChange={handleUrlChange}
                onKeyDown={handleKeyDown}
                placeholder="https://youtube.com/watch?v=..."
                disabled={isBusy}
                dir="ltr"
                className={[
                  "w-full rounded-xl border px-4 py-2.5 text-sm text-left bg-white dark:bg-zinc-900",
                  "placeholder:text-slate-400 dark:placeholder:text-zinc-600",
                  "focus:outline-none focus:ring-2 transition-all",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  isReadyState
                    ? "border-emerald-300 focus:ring-emerald-200/60 dark:border-emerald-600/50 dark:focus:ring-emerald-500/20 text-slate-900 dark:text-zinc-100"
                    : phase === STATE.invalid || phase === STATE.error
                      ? "border-red-300 focus:ring-red-200/60 dark:border-red-600/50 dark:focus:ring-red-500/20 text-slate-900 dark:text-zinc-100"
                      : "border-slate-200 focus:ring-indigo-200/60 dark:border-zinc-700 dark:focus:ring-indigo-500/20 text-slate-900 dark:text-zinc-100",
                ].join(" ")}
              />

              {isReadyState && (
                <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500 dark:text-emerald-400 pointer-events-none" />
              )}
              {(phase === STATE.invalid || phase === STATE.error) && (
                <AlertCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500 pointer-events-none" />
              )}
              {isBusy && (
                <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500 animate-spin pointer-events-none" />
              )}
            </div>

            {phase === STATE.invalid && (
              <p className="text-[11px] text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                קישור YouTube לא תקין
              </p>
            )}
            {phase === STATE.error && errorMsg && (
              <p className="text-[11px] text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {errorMsg}
              </p>
            )}
            {isReadyState && videoId && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                זוהה ID: {videoId}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-zinc-400 block">
              כותרת ידנית (אופציונלי)
            </label>
            <input
              type="text"
              value={optionalTitle}
              onChange={(event) => setOptionalTitle(event.target.value)}
              disabled={isBusy}
              placeholder="אם ריק, הכותרת תיטען מ-YouTube"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-right text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200/60 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:ring-indigo-500/20"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-zinc-400 block">מנטור (אופציונלי)</span>
              <Select value={mentorChoice} onValueChange={setMentorChoice} disabled={isBusy}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 bg-white text-xs dark:border-zinc-700 dark:bg-zinc-900">
                  <SelectValue placeholder="ללא" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ללא מנטור</SelectItem>
                  {mentors.map((mentor) => (
                    <SelectItem key={mentor.id} value={mentor.id}>
                      {mentor.name || mentor.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-zinc-400 block">נושא (אופציונלי)</span>
              <Select
                value={topicChoice}
                onValueChange={(value) => {
                  setTopicChoice(value);
                  setTopicFieldError("");
                }}
                disabled={isBusy}
              >
                <SelectTrigger className="h-9 rounded-xl border-slate-200 bg-white text-xs dark:border-zinc-700 dark:bg-zinc-900">
                  <SelectValue placeholder="ללא" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ללא נושא</SelectItem>
                  <SelectItem value={TOPIC_CHOICE_NEW}>+ נושא חדש</SelectItem>
                  {topics.map((topic) => (
                    <SelectItem key={topic.id} value={topic.id}>
                      {formatTopicLabel(topic.id, topics) || topic.name || topic.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {topicChoice === TOPIC_CHOICE_NEW && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 block">
                שם נושא חדש
              </label>
              <input
                type="text"
                value={newTopicName}
                onChange={(event) => {
                  setNewTopicName(event.target.value);
                  if (topicFieldError) setTopicFieldError("");
                }}
                disabled={isBusy}
                placeholder="למשל: פסיכולוגיית מסחר"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-right text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200/60 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:ring-indigo-500/20"
              />
              {topicFieldError ? (
                <p className="text-[11px] text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {topicFieldError}
                </p>
              ) : null}
            </div>
          )}

          {isReadyState && videoId && !isRestorePrompt && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 p-2.5">
              <img
                src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                alt="תצוגה מקדימה"
                className="w-24 h-14 object-cover rounded-lg shrink-0 border border-slate-200 dark:border-zinc-700"
                onError={(event) => {
                  if (!event.target.dataset.triedHq) {
                    event.target.dataset.triedHq = "1";
                    event.target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                  } else {
                    event.target.style.display = "none";
                  }
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 dark:text-zinc-400 mb-1">youtube.com/watch?v={videoId}</p>
                <p className="text-[11px] text-indigo-500 dark:text-indigo-400">
                  אחרי ההוספה הסרטון יופיע בדשבורד ויתמוך בתמלול, ניתוח AI, תובנות מרכזיות וייצוא.
                </p>
              </div>
            </div>
          )}

          {!isRestorePrompt && !isDuplicatePrompt && (
            <button
              type="submit"
              disabled={!canSubmit}
              className={[
                "w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
                canSubmit
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200 dark:shadow-indigo-900/40 active:scale-[0.98]"
                  : "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed",
              ].join(" ")}
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {createTopic.isPending ? "יוצר נושא..." : "טוען מידע..."}
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4" />
                  הוסף לדשבורד
                </>
              )}
            </button>
          )}

          <p className="text-[11px] text-slate-400 dark:text-zinc-600 text-center">
            {isRestorePrompt
              ? "שחזור מחזיר את הסרטון לרשימה הפעילה ושומר ניתוח, תמלול ופרקים אם נשמרו."
              : isDuplicatePrompt
                ? "טען גרסה קיימת כדי להמשיך מהמקום האחרון, או ייבא מחדש מאפס כדי לנקות טעויות סיווג ישנות."
                : "סרטון ידני נשמר מקומית, מופיע בכרטיס רגיל בדשבורד, וייפוג אחרי 30 יום אלא אם נשמר לצמיתות."}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
