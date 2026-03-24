import { VideoCard } from "./VideoCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const COLUMN_CONFIG = {
  new: {
    title: "חדש לצפייה",
    dotColor: "bg-emerald-500",
    headerBg: "bg-emerald-50",
  },
  processing: {
    title: "מעבד סיכום",
    dotColor: "bg-amber-500",
    headerBg: "bg-amber-50",
  },
  done: {
    title: "מוכן",
    dotColor: "bg-blue-500",
    headerBg: "bg-blue-50",
  },
};

export function VideoColumn({ status, videos, mentors, topics, onVideoClick, onSaveToggle }) {
  const config = COLUMN_CONFIG[status] || COLUMN_CONFIG.new;

  const getMentorName = (mentorId) => {
    const mentor = mentors.find((m) => m.id === mentorId);
    return mentor?.name || "";
  };

  return (
    <div className="flex flex-col rounded-xl border border-gray-100 bg-gray-50/50 overflow-hidden">
      {/* Column Header */}
      <div className={cn("px-4 py-3 border-b border-gray-100", config.headerBg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("w-2.5 h-2.5 rounded-full", config.dotColor)} />
            <h2 className="text-sm font-semibold text-gray-700">
              {config.title}
            </h2>
          </div>
          <span className="text-xs font-medium text-gray-400 bg-white rounded-full px-2 py-0.5">
            {videos.length}
          </span>
        </div>
      </div>

      {/* Cards List */}
      <ScrollArea className="flex-1 max-h-[calc(100vh-320px)]">
        <div className="p-3 space-y-3">
          {videos.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">
              אין סרטונים
            </div>
          ) : (
            videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                mentorName={getMentorName(video.mentorId)}
                topics={topics}
                onClick={onVideoClick}
                onSaveToggle={onSaveToggle}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
