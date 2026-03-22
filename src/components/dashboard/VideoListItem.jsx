import { format } from "date-fns";
import { he } from "date-fns/locale";
import { LearningStatusBadge, LEARNING_STATUSES } from "./LearningStatusBadge";
import { CategoryBadge } from "./CategoryBadge";
import { SaveButton } from "./SaveButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function VideoListItem({ video, mentorName, onVideoClick, onSaveToggle, onLearningStatusChange }) {
  const publishDate = video.publishedAt
    ? format(new Date(video.publishedAt), "d MMM yyyy", { locale: he })
    : "";

  return (
    <div
      onClick={() => onVideoClick?.(video)}
      className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-3 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
    >
      {/* Thumbnail */}
      <div className="w-28 h-16 rounded-lg overflow-hidden shrink-0">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='112' height='64' fill='%23f3f4f6'%3E%3Crect width='112' height='64'/%3E%3C/svg%3E";
          }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-gray-900 truncate mb-1">
          {video.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{mentorName}</span>
          <span>·</span>
          <span>{publishDate}</span>
          <CategoryBadge category={video.category} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        <Select
          value={video.learningStatus || "not_started"}
          onValueChange={(val) => onLearningStatusChange?.(video, val)}
        >
          <SelectTrigger className="w-[120px] h-7 text-xs bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEARNING_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <SaveButton
          isSaved={video.isSaved}
          onClick={() => onSaveToggle?.(video)}
        />
      </div>
    </div>
  );
}
