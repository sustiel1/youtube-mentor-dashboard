import { useState, useMemo } from "react";
import { Bookmark } from "lucide-react";
import { VideoCard } from "@/components/dashboard/VideoCard";
import { VideoDetailPanel } from "@/components/dashboard/VideoDetailPanel";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { Skeleton } from "@/components/ui/skeleton";
import { useVideos, useSaveVideo, useUpdateLearningStatus, useAssignTopics } from "@/hooks/useVideos";
import { useMentors } from "@/hooks/useMentors";
import { useTopics } from "@/hooks/useTopics";

export default function SavedVideos({ filters = { search: "", mentor: "all", category: "all" }, setFilters }) {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const { data: videos = [], isLoading: videosLoading } = useVideos();
  const { data: mentors = [], isLoading: mentorsLoading } = useMentors();
  const { data: topics = [] } = useTopics();

  const saveVideo = useSaveVideo();
  const updateLearningStatus = useUpdateLearningStatus();
  const assignTopics = useAssignTopics();

  const isLoading = videosLoading || mentorsLoading;

  const savedVideos = useMemo(() => {
    return videos
      .filter((v) => v.isSaved)
      .filter((v) => {
        if (filters.search && !v.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
        if (filters.mentor !== "all" && v.mentorId !== filters.mentor) return false;
        if (filters.category !== "all" && v.category !== filters.category) return false;
        return true;
      });
  }, [videos, filters]);

  const getMentorName = (mentorId) => mentors.find((m) => m.id === mentorId)?.name || "";

  const selectedMentorName = useMemo(() => {
    if (!selectedVideo) return "";
    return getMentorName(selectedVideo.mentorId);
  }, [selectedVideo, mentors]);

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

  const handleLearningStatusChange = (video, status) => {
    updateLearningStatus.mutate({ id: video.id, learningStatus: status });
    if (selectedVideo?.id === video.id) {
      setSelectedVideo({ ...video, learningStatus: status });
    }
  };

  const handleRemoveTopic = (video, topicId) => {
    const newTopicIds = (video.topicIds || []).filter((id) => id !== topicId);
    assignTopics.mutate({ id: video.id, topicIds: newTopicIds });
    if (selectedVideo?.id === video.id) {
      setSelectedVideo({ ...video, topicIds: newTopicIds });
    }
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <Bookmark className="h-5 w-5 text-indigo-600 fill-current" />
            <h1 className="text-lg font-bold text-gray-900">שמורים</h1>
            <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-3 py-1">
              {savedVideos.length} סרטונים
            </span>
          </div>
        </div>
      </header>

      <main className="px-6 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <FilterBar
              filters={filters}
              onFiltersChange={setFilters}
              mentors={mentors.filter((m) => m.active)}
            />

            {savedVideos.length === 0 ? (
              <div className="text-center py-16">
                <Bookmark className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">אין סרטונים שמורים</p>
                <p className="text-xs text-gray-400 mt-1">
                  לחץ על סמל ה-bookmark כדי לשמור סרטונים
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedVideos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    mentorName={getMentorName(video.mentorId)}
                    topics={topics}
                    onClick={handleVideoClick}
                    onSaveToggle={handleSaveToggle}
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
        open={panelOpen}
        onOpenChange={setPanelOpen}
        topics={topics}
        onSaveToggle={handleSaveToggle}
        onLearningStatusChange={handleLearningStatusChange}
        onRemoveTopic={handleRemoveTopic}
      />
    </div>
  );
}
