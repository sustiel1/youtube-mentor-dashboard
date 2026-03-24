import { useState, useMemo, useEffect } from "react";
import { RefreshCw, X, GraduationCap, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { VideoDetailPanel } from "@/components/dashboard/VideoDetailPanel";
import { VideoCard } from "@/components/dashboard/VideoCard";
import { ErrorsBar } from "@/components/dashboard/ErrorsBar";
import { Skeleton } from "@/components/ui/skeleton";
import { useVideos, useSaveVideo, useUpdateLearningStatus, useAssignTopics, useDeleteVideo } from "@/hooks/useVideos";
import { useMentors } from "@/hooks/useMentors";
import { useTopics } from "@/hooks/useTopics";

// Map KPI filterKey → video status value
const KPI_STATUS_MAP = {
  new: "new",
  processing: "processing",
  summarized: "done",
  errors: "error",
};

const KPI_FILTER_LABELS = {
  new: "סרטונים חדשים",
  processing: "בתהליך עיבוד",
  summarized: "עברו סיכום",
  errors: "שגיאות",
};

const LEARNING_STATUS_FILTERS = [
  { value: "not_started", label: "טרם התחיל", active: "border-gray-400 bg-gray-100 text-gray-700" },
  { value: "in_progress", label: "בלמידה", active: "border-amber-400 bg-amber-50 text-amber-700" },
  { value: "to_review", label: "לחזרה", active: "border-purple-400 bg-purple-50 text-purple-700" },
  { value: "learned", label: "נלמד", active: "border-emerald-400 bg-emerald-50 text-emerald-700" },
  { value: "completed", label: "הושלם", active: "border-blue-400 bg-blue-50 text-blue-700" },
];

function computeStats(videos) {
  return {
    totalNew: videos.filter((v) => v.status === "new").length,
    summarized: videos.filter((v) => v.status === "done").length,
    processing: videos.filter((v) => v.status === "processing").length,
    errors: videos.filter((v) => v.status === "error").length,
  };
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 rounded-md w-full" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-10 rounded-xl" />
            {[...Array(2)].map((_, j) => (
              <Skeleton key={j} className="h-48 rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function applyFilters(videos, filters) {
  return videos.filter((video) => {
    if (filters.search && !video.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.mentor !== "all" && video.mentorId !== filters.mentor) return false;
    if (filters.category !== "all" && video.category !== filters.category) return false;
    return true;
  });
}

export default function Dashboard({ filters = { search: "", mentor: "all", category: "all" }, setFilters, navigateTo }) {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeDashboardFilter, setActiveDashboardFilter] = useState(null);
  const [learningStatusFilter, setLearningStatusFilter] = useState(null);

  const {
    data: videos = [],
    isLoading: videosLoading,
    error: videosError,
    refetch: refetchVideos,
  } = useVideos();

  const { data: mentors = [], isLoading: mentorsLoading } = useMentors();
  const { data: topics = [] } = useTopics();

  const saveVideo = useSaveVideo();
  const updateLearningStatus = useUpdateLearningStatus();
  const assignTopics = useAssignTopics();
  const deleteVideo = useDeleteVideo();

  // Sync selectedVideo with fresh data after AI analysis / any mutation
  useEffect(() => {
    if (!selectedVideo || videos.length === 0) return;
    const fresh = videos.find((v) => v.id === selectedVideo.id);
    if (fresh) setSelectedVideo(fresh);
  }, [videos]);

  // Apply sidebar filters (search, mentor, category)
  const filteredVideos = useMemo(() => applyFilters(videos, filters), [videos, filters]);

  // Apply KPI status filter + learning status filter on top of sidebar filters
  const displayedVideos = useMemo(() => {
    let result = filteredVideos;
    if (activeDashboardFilter) {
      const statusValue = KPI_STATUS_MAP[activeDashboardFilter];
      result = result.filter((v) => v.status === statusValue);
    }
    if (learningStatusFilter) {
      result = result.filter((v) => v.learningStatus === learningStatusFilter);
    }
    return result;
  }, [filteredVideos, activeDashboardFilter, learningStatusFilter]);

  const stats = useMemo(() => computeStats(videos), [videos]);
  const isLoading = videosLoading || mentorsLoading;

  // Live stats for the Learning Hub Hero
  const learningStats = useMemo(() => {
    const savedCount = videos.filter((v) => v.isSaved).length;
    const learnedCount = videos.filter((v) =>
      ["learned", "completed"].includes(v.learningStatus)
    ).length;
    const progress = savedCount > 0 ? Math.round((learnedCount / savedCount) * 100) : 0;

    const inProgressVideo = videos.find((v) => v.learningStatus === "in_progress");
    // Next step: in_progress first, else first saved not_started
    const nextVideo =
      inProgressVideo ||
      videos.find((v) => v.isSaved && v.learningStatus === "not_started") ||
      null;
    const nextTopic = nextVideo
      ? topics.find((t) => nextVideo.topicIds?.includes(t.id)) || null
      : null;

    return { savedCount, learnedCount, progress, nextVideo, nextTopic };
  }, [videos, topics]);

  const selectedMentorName = useMemo(() => {
    if (!selectedVideo) return "";
    const mentor = mentors.find((m) => m.id === selectedVideo.mentorId);
    return mentor?.name ?? "";
  }, [selectedVideo, mentors]);

  const getMentorName = (mentorId) =>
    mentors.find((m) => m.id === mentorId)?.name || "";

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

  const handleDeleteVideo = (video) => {
    deleteVideo.mutate(video.id);
    if (selectedVideo?.id === video.id) setPanelOpen(false);
  };

  const handleRemoveTopic = (video, topicId) => {
    const newTopicIds = (video.topicIds || []).filter((id) => id !== topicId);
    assignTopics.mutate({ id: video.id, topicIds: newTopicIds });
    if (selectedVideo?.id === video.id) {
      setSelectedVideo({ ...video, topicIds: newTopicIds });
    }
  };

  const handleRefresh = async () => {
    await refetchVideos();
    toast.success("הנתונים עודכנו");
  };

  // Toggle KPI filter — click same → clear, click different → switch
  const handleKpiFilterClick = (filterKey) => {
    setActiveDashboardFilter((prev) => (prev === filterKey ? null : filterKey));
  };

  if (videosError && !isLoading) {
    toast.error("שגיאה בטעינת הנתונים");
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-3 py-1">
                {videos.length} סרטונים
              </span>
              {/* Active KPI filter indicator */}
              {activeDashboardFilter && (
                <button
                  onClick={() => setActiveDashboardFilter(null)}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 rounded-full px-3 py-1 hover:bg-indigo-100 transition-colors"
                >
                  <span>מסנן: {KPI_FILTER_LABELS[activeDashboardFilter]}</span>
                  <X className="h-3 w-3" />
                </button>
              )}
              {filteredVideos.length !== videos.length && !activeDashboardFilter && (
                <span className="text-xs text-indigo-600 bg-indigo-50 rounded-full px-3 py-1">
                  {filteredVideos.length} לאחר סינון
                </span>
              )}
              {activeDashboardFilter && (
                <span className="text-xs text-gray-400 bg-gray-50 rounded-full px-3 py-1">
                  {displayedVideos.length} סרטונים
                </span>
              )}
            </div>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              רענון
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 py-6">
        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <KpiCards
              stats={stats}
              activeFilter={activeDashboardFilter}
              onFilterClick={handleKpiFilterClick}
            />

            {/* Learning Hub Hero — full bar clickable */}
            <div
              onClick={() => navigateTo?.("LearningHub")}
              role="button"
              dir="rtl"
              className="w-full mt-4 mb-1 rounded-2xl overflow-hidden bg-gradient-to-l from-indigo-600 to-violet-600 shadow-md cursor-pointer hover:shadow-xl hover:scale-[1.005] transition-all duration-200 group"
            >
              <div className="px-6 py-5">
                <div className="flex items-center justify-between gap-4">

                  {/* Right: icon + title + subtitle */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                      <GraduationCap className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-white leading-tight">
                        מרכז הלמידה
                      </p>
                      <p className="text-sm text-white/65 mt-0.5">
                        המשך מהנקודה האחרונה
                      </p>
                    </div>
                  </div>

                  {/* Left: CTA button */}
                  <div className="flex items-center gap-2 bg-white text-indigo-600 text-sm font-bold px-5 py-2.5 rounded-xl shrink-0 group-hover:bg-indigo-50 transition-colors">
                    <Play className="h-4 w-4 fill-indigo-600" />
                    {learningStats.nextVideo?.learningStatus === "in_progress"
                      ? "המשך ללמוד"
                      : "התחל ללמוד"}
                  </div>
                </div>
              </div>

              {/* Progress bar — stays, visual only */}
              <div className="h-1.5 bg-white/20">
                <div
                  className="h-full bg-white/70 transition-all duration-700"
                  style={{ width: `${learningStats.progress}%` }}
                />
              </div>
            </div>

            <FilterBar
              filters={filters}
              onFiltersChange={setFilters}
              mentors={mentors.filter((m) => m.active)}
            />

            {/* Learning status filter chips */}
            <div className="flex items-center gap-2 mb-5 flex-row-reverse justify-end" dir="rtl">
              <span className="text-xs text-gray-500 font-medium shrink-0">סטטוס למידה:</span>
              {LEARNING_STATUS_FILTERS.map((item) => (
                <button
                  key={item.value}
                  onClick={() =>
                    setLearningStatusFilter((prev) =>
                      prev === item.value ? null : item.value
                    )
                  }
                  className={cn(
                    "text-xs px-3 py-1 rounded-full border transition-all",
                    learningStatusFilter === item.value
                      ? item.active
                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  )}
                >
                  {item.label}
                </button>
              ))}
              {learningStatusFilter && (
                <button
                  onClick={() => setLearningStatusFilter(null)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  title="נקה סינון"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Errors view — only when "שגיאות" KPI is active */}
            {activeDashboardFilter === "errors" ? (
              <ErrorsBar
                errorVideos={displayedVideos}
                mentors={mentors}
                onVideoClick={handleVideoClick}
                forceExpanded
              />
            ) : displayedVideos.length === 0 ? (
              <div className="text-center py-16 text-sm text-gray-400">
                אין סרטונים להציג
              </div>
            ) : (
              /* Unified grid — all videos, filtered by active KPI / learning status */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedVideos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    mentorName={getMentorName(video.mentorId)}
                    topics={topics}
                    onClick={handleVideoClick}
                    onSaveToggle={handleSaveToggle}
                    onDelete={handleDeleteVideo}
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
