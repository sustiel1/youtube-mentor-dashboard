import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Eye, StickyNote, Trash2, Sparkles, Check } from "lucide-react";
import { useNotesByVideo } from "@/hooks/useNotes";
import { StatusBadge } from "./StatusBadge";
import { CategoryBadge } from "./CategoryBadge";
import { LearningStatusBadge } from "./LearningStatusBadge";
import { SaveButton } from "./SaveButton";
import { cn } from "@/lib/utils";

const STATUS_BORDER = {
  learned: "border-r-emerald-400",
  completed: "border-r-emerald-500",
  in_progress: "border-r-amber-400",
  to_review: "border-r-purple-400",
  not_started: "border-r-gray-200",
};

function formatViewCount(n) {
  if (!n) return null;
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(dur) {
  if (!dur) return null;
  if (typeof dur === "string") return dur;
  const s = Math.round(dur);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${sec}`;
  return `${m}:${sec}`;
}

function estimateDurationFromTopics(videoTopics) {
  if (!videoTopics?.length) return null;
  const lastSec = videoTopics[videoTopics.length - 1]?.timestampSeconds;
  if (!lastSec) return null;
  return formatDuration(lastSec + 180);
}

export function VideoCard({
  video,
  mentorName,
  topics = [],
  onSaveToggle,
  onClick,
  onDelete,
  isSelected = false,
  onSelect,
}) {
  const { data: cardNotes = [] } = useNotesByVideo(video.id);
  const firstNote = cardNotes[0]?.content ?? null;
  const hasNoteData = cardNotes.length > 0;

  const publishDate = video.publishedAt
    ? format(new Date(video.publishedAt), "d MMM yyyy", { locale: he })
    : "";

  const videoTopics = (video.topicIds || [])
    .map((id) => topics.find((t) => t.id === id))
    .filter(Boolean);

  const viewCountStr = formatViewCount(video.viewCount);
  const exactDuration = formatDuration(video.duration);
  const estimatedDuration = !exactDuration ? estimateDurationFromTopics(video.videoTopics) : null;
  const durationStr = exactDuration || estimatedDuration;
  const isDurationEstimated = !exactDuration && !!estimatedDuration;

  return (
    <div
      onClick={() => onClick?.(video)}
      className={cn(
        "bg-white rounded-xl border border-gray-100 border-r-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden group",
        STATUS_BORDER[video.learningStatus] ?? "border-r-gray-200",
        isSelected && "ring-2 ring-indigo-500 ring-offset-1"
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.target.src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180' fill='%23f3f4f6'%3E%3Crect width='320' height='180'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='14'%3ENo Thumbnail%3C/text%3E%3C/svg%3E";
          }}
        />

        {/* Checkbox (selection mode) — top left */}
        {onSelect ? (
          <div
            onClick={(e) => { e.stopPropagation(); onSelect(video.id); }}
            className={cn(
              "absolute top-2 left-2 z-20 w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all shadow-sm",
              isSelected
                ? "bg-indigo-600 border-indigo-600"
                : "bg-white/80 border-white hover:border-indigo-400"
            )}
          >
            {isSelected && <Check className="h-3 w-3 text-white" />}
          </div>
        ) : (
          /* Save + Delete — top left (normal mode) */
          <div className="absolute top-2 left-2 flex items-center gap-1">
            <SaveButton isSaved={video.isSaved} onClick={() => onSaveToggle?.(video)} />
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(video); }}
                className="p-1 rounded-full bg-black/50 text-white hover:bg-red-600 transition-colors"
                title="מחק סרטון"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* badges — top right: "נותח" ו-"יש הערות" יכולים להופיע יחד */}
        {(video.status === "done" || hasNoteData) && (
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            {video.status === "done" && (
              <span className="flex items-center gap-1 text-[10px] font-bold bg-indigo-600 text-white rounded-full px-2 py-0.5 shadow">
                <Sparkles className="h-2.5 w-2.5" />
                נותח
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
              className="text-[10px] font-bold text-white bg-black/75 rounded px-1.5 py-0.5 tabular-nums"
              title={isDurationEstimated ? "אורך משוער" : undefined}
            >
              {isDurationEstimated ? `~${durationStr}` : durationStr}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1.5 leading-snug">
          {video.title}
        </h3>

        <div className="mb-2">
          <LearningStatusBadge status={video.learningStatus} />
        </div>

        {/* מנטור + צפיות */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            {mentorName && (
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                {mentorName.charAt(0)}
              </div>
            )}
            {mentorName && <span className="text-xs text-gray-500 truncate">{mentorName}</span>}
          </div>
          {viewCountStr && (
            <span className="text-xs text-gray-400 flex items-center gap-0.5 shrink-0">
              <Eye className="h-3 w-3" />
              {viewCountStr}
            </span>
          )}
        </div>

        {/* סיכום AI / נושאים — ללא block הערה בגוף הכרטיס */}
        {video.shortSummary ? (
          <p className="text-xs text-gray-600 font-medium line-clamp-2 mb-3 leading-relaxed">
            {video.shortSummary.replace(/\[MOCK\]/gi, "").replace(/^הסרטון\s*/u, "").trim()}
          </p>
        ) : videoTopics.length > 0 ? (
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {videoTopics.slice(0, 3).map((t) => (
              <span key={t.id} className="text-[10px] text-gray-400">
                #{t.name}
              </span>
            ))}
          </div>
        ) : null}

        {/* שורת מטא-דאטה תחתונה */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-wrap">
            <CategoryBadge category={video.category} />
            <StatusBadge status={video.status} />
          </div>
          <span className="text-xs text-gray-400">{publishDate}</span>
        </div>

      </div>
    </div>
  );
}
