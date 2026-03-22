import { VideoColumn } from "./VideoColumn";

export function VideoKanban({ videos, mentors, topics, onVideoClick, onSaveToggle }) {
  // Only content statuses — errors are handled separately above the kanban
  const newVideos = videos.filter((v) => v.status === "new");
  const processingVideos = videos.filter((v) => v.status === "processing");
  const doneVideos = videos.filter((v) => v.status === "done");

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <VideoColumn
        status="new"
        videos={newVideos}
        mentors={mentors}
        topics={topics}
        onVideoClick={onVideoClick}
        onSaveToggle={onSaveToggle}
      />
      <VideoColumn
        status="processing"
        videos={processingVideos}
        mentors={mentors}
        topics={topics}
        onVideoClick={onVideoClick}
        onSaveToggle={onSaveToggle}
      />
      <VideoColumn
        status="done"
        videos={doneVideos}
        mentors={mentors}
        topics={topics}
        onVideoClick={onVideoClick}
        onSaveToggle={onSaveToggle}
      />
    </div>
  );
}
