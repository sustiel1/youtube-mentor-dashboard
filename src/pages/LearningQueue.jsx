import { useState, useMemo } from "react";
import { BookOpen, RotateCcw, Play, CheckCircle } from "lucide-react";
import { VideoListItem } from "@/components/dashboard/VideoListItem";
import { VideoDetailPanel } from "@/components/dashboard/VideoDetailPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { useVideos, useSaveVideo, useUpdateLearningStatus, useAssignTopics } from "@/hooks/useVideos";
import { useMentors } from "@/hooks/useMentors";
import { useTopics } from "@/hooks/useTopics";

const SECTIONS = [
  {
    key: "to_review",
    title: "לחזרה",
    icon: RotateCcw,
    dotColor: "bg-purple-500",
    headerBg: "bg-purple-50",
    filter: (v) => v.learningStatus === "to_review",
  },
  {
    key: "in_progress",
    title: "בתהליך למידה",
    icon: Play,
    dotColor: "bg-amber-500",
    headerBg: "bg-amber-50",
    filter: (v) => v.learningStatus === "in_progress",
  },
  {
    key: "not_started",
    title: "טרם התחיל",
    icon: BookOpen,
    dotColor: "bg-gray-400",
    headerBg: "bg-gray-50",
    filter: (v) => v.isSaved && v.learningStatus === "not_started",
  },
  {
    key: "completed",
    title: "הושלמו",
    icon: CheckCircle,
    dotColor: "bg-emerald-500",
    headerBg: "bg-emerald-50",
    filter: (v) => v.learningStatus === "completed" || v.learningStatus === "learned",
  },
];

export default function LearningQueue() {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({ completed: true });

  const { data: videos = [], isLoading: videosLoading } = useVideos();
  const { data: mentors = [], isLoading: mentorsLoading } = useMentors();
  const { data: topics = [] } = useTopics();

  const saveVideo = useSaveVideo();
  const updateLearningStatus = useUpdateLearningStatus();
  const assignTopics = useAssignTopics();

  const isLoading = videosLoading || mentorsLoading;

  const getMentorName = (mentorId) => mentors.find((m) => m.id === mentorId)?.name || "";

  const selectedMentorName = useMemo(() => {
    if (!selectedVideo) return "";
    return getMentorName(selectedVideo.mentorId);
  }, [selectedVideo, mentors]);

  // KPI counts
  const kpi = useMemo(() => ({
    inProgress: videos.filter((v) => v.learningStatus === "in_progress").length,
    toReview: videos.filter((v) => v.learningStatus === "to_review").length,
    completed: videos.filter((v) => v.learningStatus === "completed" || v.learningStatus === "learned").length,
    saved: videos.filter((v) => v.isSaved).length,
  }), [videos]);

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

  const toggleSection = (key) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const KPI_ITEMS = [
    { label: "בתהליך", value: kpi.inProgress, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "לחזרה", value: kpi.toReview, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "הושלמו", value: kpi.completed, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "שמורים", value: kpi.saved, color: "text-indigo-600", bg: "bg-indigo-50" },
  ];

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-indigo-600" />
            <h1 className="text-lg font-bold text-gray-900">תור למידה</h1>
          </div>
        </div>
      </header>

      <main className="px-6 py-6">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {KPI_ITEMS.map((item) => (
                <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <span className="text-xs text-gray-500">{item.label}</span>
                  <div className={`text-2xl font-bold mt-1 ${item.color}`}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Sections */}
            <div className="space-y-4">
              {SECTIONS.map((section) => {
                const sectionVideos = videos.filter(section.filter);
                const isCollapsed = collapsedSections[section.key];
                const Icon = section.icon;

                if (sectionVideos.length === 0) return null;

                return (
                  <div key={section.key} className="rounded-xl border border-gray-100 overflow-hidden">
                    <button
                      onClick={() => toggleSection(section.key)}
                      className={`w-full flex items-center justify-between px-4 py-3 ${section.headerBg} text-right`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${section.dotColor}`} />
                        <Icon className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-semibold text-gray-700">{section.title}</span>
                        <span className="text-xs text-gray-400 bg-white rounded-full px-2 py-0.5">
                          {sectionVideos.length}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {isCollapsed ? "▸" : "▾"}
                      </span>
                    </button>

                    {!isCollapsed && (
                      <div className="p-3 space-y-2 bg-gray-50/30">
                        {sectionVideos.map((video) => (
                          <VideoListItem
                            key={video.id}
                            video={video}
                            mentorName={getMentorName(video.mentorId)}
                            onVideoClick={handleVideoClick}
                            onSaveToggle={handleSaveToggle}
                            onLearningStatusChange={handleLearningStatusChange}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Empty state */}
              {SECTIONS.every((s) => videos.filter(s.filter).length === 0) && (
                <div className="text-center py-16">
                  <BookOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">תור הלמידה ריק</p>
                  <p className="text-xs text-gray-400 mt-1">
                    שמור סרטונים ושנה את סטטוס הלמידה כדי להוסיף אותם לתור
                  </p>
                </div>
              )}
            </div>
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
