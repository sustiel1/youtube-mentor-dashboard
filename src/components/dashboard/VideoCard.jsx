import { useMemo } from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { StickyNote, Trash2, Sparkles, Check, Pin, Link2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useThumbnailFallback } from "@/hooks/useThumbnailFallback";
import { useNotesByVideo } from "@/hooks/useNotes";
import { StatusBadge } from "./StatusBadge";
import { CategoryBadge } from "./CategoryBadge";
import { LearningStatusBadge } from "./LearningStatusBadge";
import { SaveButton } from "./SaveButton";
import { cn } from "@/lib/utils";
import { formatVideoDuration } from "@/lib/videoDuration";
import { formatViewCount } from "@/lib/videoViewCount";
import { resolveVideoCardTopics } from "@/lib/videoTopicDisplay";
import { ObsidianSavedOnCard } from "./ObsidianSavedOnCard";
import { hasObsidianSavedStatus } from "@/lib/obsidianSavedStatus";
import { loadSavedAnalysis } from "@/lib/localAnalysisStore";

function buildVideoUrl(video) {
  if (video.url && video.url.startsWith("http")) return video.url;
  if (video.youtubeUrl && video.youtubeUrl.startsWith("http")) return video.youtubeUrl;
  if (video.youtubeId) return `https://www.youtube.com/watch?v=${video.youtubeId}`;
  return null;
}

// ── VideoThumbnail — isolated so the hook runs at component level ────────────
function VideoThumbnail({ video, className }) {
  const { src, status, onError, onLoad } = useThumbnailFallback({
    youtubeId: video.youtubeId,
    storedUrl: video.thumbnail || video.thumbnailUrl,
  });

  if (status === 'failed') {
    return (
      <div className={cn("flex items-center justify-center bg-slate-100 dark:bg-zinc-800", className)}>
        <span className="text-center text-slate-400 dark:text-zinc-500 text-sm select-none">
          📺<br />אין תמונה זמינה
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={video.title}
      className={cn("w-full h-full object-cover group-hover:scale-105 transition-transform duration-300", className)}
      onError={onError}
      onLoad={onLoad}
    />
  );
}

const STATUS_BORDER = {
  learned: "border-r-emerald-400",
  completed: "border-r-emerald-500",
  in_progress: "border-r-amber-400",
  to_review: "border-r-purple-400",
  not_started: "border-r-gray-200",
};

function estimateDurationFromTopics(videoTopics) {
  if (!videoTopics?.length) return null;
  const lastSec = videoTopics[videoTopics.length - 1]?.timestampSeconds;
  if (!lastSec) return null;
  return formatVideoDuration(lastSec + 180);
}

export function VideoCard({
  video,
  mentorName,
  mentorChannelUrl,
  topics = [],
  onSaveToggle,
  onPermanentToggle,
  onClick,
  onDelete,
  isSelected = false,
  onSelect,
  isOpponentView = false,
}) {
  const { data: cardNotes = [] } = useNotesByVideo(video.id);
  const firstNote = cardNotes[0]?.content ?? null;
  const hasNoteData = cardNotes.length > 0;
  const savedAnalysis = useMemo(() => loadSavedAnalysis(video?.id), [video?.id]);
  const hasSavedAnalysis = Boolean(savedAnalysis);
  const hasAnyUsefulKnowledge = Array.isArray(video?.keyPoints) && video.keyPoints.length > 0;
  const hasAnyAiContent =
    video?.status === "done" ||
    video?.analysisStatus === "completed" ||
    video?.analysisStatus === "analyzed" ||
    Boolean(video?.analyzedAt) ||
    Boolean(video?.aiSummaryShort) ||
    Boolean(video?.aiSummaryLong) ||
    Boolean(video?.shortSummary) ||
    Boolean(video?.fullSummary);

  const publishDate = video.publishedAt
    ? format(new Date(video.publishedAt), "d MMM yyyy", { locale: he })
    : "";

  const { mainLabel, subLabel } = useMemo(
    () => resolveVideoCardTopics(video, topics),
    [video, topics]
  );

  const viewCountStr = formatViewCount(video.viewCount);
  const exactDuration = formatVideoDuration(video.duration);
  const estimatedDuration = !exactDuration ? estimateDurationFromTopics(video.videoTopics) : null;
  const durationStr = exactDuration || estimatedDuration;
  const isDurationEstimated = !exactDuration && !!estimatedDuration;
  const metadataItems = [
    publishDate || null,
    viewCountStr,
  ].filter(Boolean);
  const showObsidianSaved = hasObsidianSavedStatus(video);
  const showBrainSavedPill = showObsidianSaved;

  return (
    <div
      onClick={() => onClick?.(video)}
      className={cn(
        "group flex h-full min-h-0 cursor-pointer flex-col overflow-hidden rounded-2xl border border-r-4 border-slate-200 bg-white shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900/90 dark:shadow-2xl dark:hover:shadow-black/40",
        STATUS_BORDER[video.learningStatus] ?? "border-r-gray-200",
        isSelected && "ring-2 ring-red-500 ring-offset-1 ring-offset-slate-50 dark:ring-offset-zinc-950"
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video shrink-0 overflow-hidden">
        <VideoThumbnail video={video} />

        {/* Checkbox (selection mode) — top left */}
        {onSelect ? (
          <div
            onClick={(e) => { e.stopPropagation(); onSelect(video.id); }}
            className={cn(
              "absolute top-2 left-2 z-20 w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all shadow-sm",
              isSelected
                ? "bg-red-600 border-red-600"
                : "border-slate-300/80 bg-white/80 hover:border-red-400 dark:border-zinc-300/70 dark:bg-black/60"
            )}
          >
            {isSelected && <Check className="h-3 w-3 text-white" />}
          </div>
        ) : (
          /* Save + Pin + Delete + CopyLink — top left (normal mode) */
          <div className="absolute top-2 left-2 flex items-center gap-1">
            <SaveButton isSaved={video.isSaved} onClick={() => onSaveToggle?.(video)} />
            {onPermanentToggle && (
              <button
                onClick={(e) => { e.stopPropagation(); onPermanentToggle(video); }}
                className={cn(
                  "p-1 rounded-full transition-colors",
                  video.isPermanent
                    ? "bg-amber-500 text-white"
                    : "bg-black/60 text-white hover:bg-amber-500"
                )}
                title={video.isPermanent ? "מוצמד לצמיתות — לחץ לביטול" : "שמור לצמיתות"}
              >
                <Pin className="h-3 w-3" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(video); }}
                className="p-1 rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors"
                title="מחק סרטון"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
            {(() => {
              const url = buildVideoUrl(video);
              if (!url) return null;
              return (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(url).then(() => {
                      toast.success("קישור הסרטון הועתק");
                    }).catch(() => {
                      toast.error("לא ניתן להעתיק קישור");
                    });
                  }}
                  className="p-1 rounded-full bg-black/60 text-white hover:bg-blue-600 transition-colors"
                  title="העתק קישור"
                >
                  <Link2 className="h-3 w-3" />
                </button>
              );
            })()}
          </div>
        )}

        {/* badges — top right */}
        {(hasAnyAiContent || hasSavedAnalysis || hasAnyUsefulKnowledge || hasNoteData || isOpponentView || showBrainSavedPill) && (
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            {isOpponentView && (
              <span className="flex items-center gap-1 text-[10px] font-bold bg-rose-600 text-white rounded-full px-2 py-0.5 shadow">
                דעת האויב
              </span>
            )}
            {hasAnyAiContent && (
              <span className="flex items-center gap-1 text-[10px] font-bold bg-red-600 text-white rounded-full px-2 py-0.5 shadow">
                <Sparkles className="h-2.5 w-2.5" />
                {video.analyzedAt
                  ? `נותח · ${format(new Date(video.analyzedAt), "dd/MM", { locale: he })}`
                  : "נותח"}
              </span>
            )}
            {hasSavedAnalysis && (
              <span className="flex items-center gap-1 text-[10px] font-bold bg-slate-900/80 text-white rounded-full px-2 py-0.5 shadow">
                ✓ ניתוח שמור
              </span>
            )}
            {showBrainSavedPill && (
              <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-600 text-white rounded-full px-2 py-0.5 shadow">
                ✓ נשמר למוח
              </span>
            )}
            {hasAnyUsefulKnowledge && (
              <span className="flex items-center gap-1 text-[10px] font-bold bg-indigo-600 text-white rounded-full px-2 py-0.5 shadow">
                ידע ✓
              </span>
            )}
            {hasNoteData && firstNote && (
              <span className="flex items-center gap-1 text-[10px] font-bold bg-red-500 text-white rounded-full px-2 py-0.5 shadow max-w-[120px]">
                <StickyNote className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{firstNote}</span>
              </span>
            )}
          </div>
        )}

        {/* Duration overlay — bottom left */}
        {durationStr && (
          <div className="absolute bottom-1.5 left-1.5">
            <span
              className="text-[10px] font-bold text-white bg-black/75 rounded-lg px-1.5 py-0.5 tabular-nums"
              title={isDurationEstimated ? "אורך משוער" : undefined}
            >
              {isDurationEstimated ? `~${durationStr}` : durationStr}
            </span>
          </div>
        )}
      </div>

      {/* Content — flex column so topic + footer stay aligned across cards */}
      <div
        dir="rtl"
        className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-transparent to-slate-50 p-4 dark:to-zinc-950/95"
      >
        <div className="shrink-0">
          <h3 className="line-clamp-2 min-h-[2.75rem] text-right text-sm font-semibold leading-snug text-slate-900 dark:text-white">
            {video.title}
          </h3>
        </div>

        <div className="mb-2 mt-1.5 shrink-0">
          <LearningStatusBadge status={video.learningStatus} />
        </div>

        {showObsidianSaved && (
          <div className="mb-2 shrink-0">
            <ObsidianSavedOnCard video={video} />
          </div>
        )}

        <div className="mb-2 flex shrink-0 items-center justify-between">
          {(() => {
            const displayName = mentorName || "ערוץ לא ידוע";
            const isUnknown = !mentorName;
            const avatarCls = isUnknown
              ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-400 dark:bg-zinc-800 dark:text-zinc-500"
              : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-700 dark:bg-zinc-800 dark:text-white";
            const nameCls = isUnknown
              ? "truncate text-right text-xs text-slate-400 dark:text-zinc-500"
              : "truncate text-right text-xs text-slate-500 dark:text-zinc-300";
            if (mentorChannelUrl) {
              return (
                <a
                  href={mentorChannelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex min-w-0 flex-1 items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <div className={avatarCls}>{displayName.charAt(0)}</div>
                  <span className={cn(nameCls, "hover:underline")}>{displayName}</span>
                  <ExternalLink className="h-2.5 w-2.5 shrink-0 text-slate-400 dark:text-zinc-500" />
                </a>
              );
            }
            return (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className={avatarCls}>{displayName.charAt(0)}</div>
                <span className={nameCls}>{displayName}</span>
              </div>
            );
          })()}
        </div>

        {metadataItems.length > 0 && (
          <div className="mb-2 flex shrink-0 flex-wrap items-center justify-end gap-2 text-xs text-slate-600 dark:text-zinc-300">
            {metadataItems.map((item, index) => (
              <span key={`${item}-${index}`} className="inline-flex items-center gap-2">
                {index > 0 && <span className="text-slate-400 dark:text-zinc-500">·</span>}
                <span className="tabular-nums">{item}</span>
              </span>
            ))}
          </div>
        )}

        {/* Fills space so topic block + footer sit at bottom when title/metadata are short */}
        <div className="min-h-0 flex-1" aria-hidden />

        {/* Fixed two-line topic block — same typography on both lines */}
        <div className="mb-2 flex min-h-[2.5rem] shrink-0 flex-col justify-center gap-1 text-right">
          <p className="line-clamp-1 text-xs font-normal leading-tight text-slate-700 dark:text-zinc-300">
            נושא: {mainLabel}
          </p>
          <p className="line-clamp-1 text-xs font-normal leading-tight text-slate-700 dark:text-zinc-300">
            תת נושא: {subLabel}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 pt-2.5 dark:border-zinc-800">
          <CategoryBadge category={video.category} />
          <StatusBadge status={video.status} />
        </div>
      </div>
    </div>
  );
}
