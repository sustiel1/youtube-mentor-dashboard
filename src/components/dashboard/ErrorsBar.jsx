import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

export function ErrorsBar({ errorVideos, mentors, onVideoClick }) {
  const [expanded, setExpanded] = useState(false);

  if (!errorVideos || errorVideos.length === 0) return null;

  const getMentorName = (mentorId) =>
    mentors.find((m) => m.id === mentorId)?.name || "";

  // Show max 3 when collapsed
  const visible = expanded ? errorVideos : errorVideos.slice(0, 3);

  return (
    <div className="mb-6 rounded-xl border border-red-100 bg-red-50/60 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-right"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm font-semibold text-red-700">שגיאות עיבוד</span>
          <span className="text-xs font-medium text-red-500 bg-red-100 rounded-full px-2 py-0.5">
            {errorVideos.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-red-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-red-400" />
        )}
      </button>

      {/* Error list */}
      <div className="px-4 pb-3 space-y-2">
        {visible.map((video) => (
          <button
            key={video.id}
            onClick={() => onVideoClick?.(video)}
            className="w-full flex items-center gap-3 bg-white rounded-lg border border-red-100 px-3 py-2.5 hover:border-red-200 hover:shadow-sm transition-all text-right"
          >
            <img
              src={video.thumbnail}
              alt=""
              className="w-12 h-8 rounded object-cover shrink-0"
              onError={(e) => { e.target.style.display = "none"; }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{video.title}</p>
              <p className="text-xs text-red-600 truncate mt-0.5">
                {video.errorMessage || "שגיאה לא ידועה"}
              </p>
            </div>
            <span className="text-xs text-gray-400 shrink-0">{getMentorName(video.mentorId)}</span>
          </button>
        ))}

        {!expanded && errorVideos.length > 3 && (
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-red-500 hover:text-red-700 px-1"
          >
            + עוד {errorVideos.length - 3} שגיאות
          </button>
        )}
      </div>
    </div>
  );
}
