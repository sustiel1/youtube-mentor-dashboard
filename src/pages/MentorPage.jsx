import { useState, useMemo } from "react";
import { useVideos, useSaveVideo } from "@/hooks/useVideos";
import { useMentors } from "@/hooks/useMentors";
import { useTopics } from "@/hooks/useTopics";
import { getLocalNotes } from "@/lib/localNoteStore";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { VideoCard } from "@/components/dashboard/VideoCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, ChevronRight, Home, Play,
} from "lucide-react";

// ─── Main Component ───────────────────────────────────────

export default function MentorPage({ pageParams, navigateTo }) {
  const mentorId    = pageParams?.mentorId;
  const fromTopicId = pageParams?.fromTopicId; // לניווט חזרה לנושא

  const [search, setSearch] = useState("");

  const { data: videos = [],  isLoading: videosLoading  } = useVideos();
  const { data: mentors = [], isLoading: mentorsLoading } = useMentors();
  const { data: topics = [] }                             = useTopics();

  const saveVideo = useSaveVideo();

  const isLoading = videosLoading || mentorsLoading;

  const mentor = useMemo(
    () => mentors.find((m) => m.id === mentorId),
    [mentors, mentorId]
  );

  // כל סרטוני המנטור, עם חיפוש בכותרת / סיכום / תגיות
  const mentorVideos = useMemo(() => {
    const q = search.toLowerCase().trim();
    return videos
      .filter((v) => v.mentorId === mentorId)
      .filter((v) => {
        if (!q) return true;
        return (
          v.title?.toLowerCase().includes(q) ||
          v.shortSummary?.toLowerCase().includes(q) ||
          v.fullSummary?.toLowerCase().includes(q) ||
          v.tags?.some((t) => t.toLowerCase().includes(q))
        );
      });
  }, [videos, mentorId, search]);

  // מפה: videoId → { hasNotes, snippet }
  // קוראת מ-localStorage באופן סינכרוני — מחושב מחדש כשהסרטונים נטענים
  const notesMap = useMemo(() => {
    const localNotes = getLocalNotes();
    const map = {};
    localNotes.forEach((n) => {
      if (!n.videoId) return;
      if (!map[n.videoId]) {
        map[n.videoId] = {
          hasNotes: true,
          snippet: n.content?.trim().slice(0, 100) || null,
        };
      }
    });
    return map;
  }, [mentorVideos]); // מחושב מחדש כשרשימת הסרטונים מתעדכנת

  const handleVideoClick = (video) => {
    navigateTo?.("TopicLearningPage", { videoId: video.id, fromMentorId: mentorId });
  };

  // ─── Loading ──────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-8 space-y-5">
        <Skeleton className="h-16 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!mentor) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-sm text-gray-400">מנטור לא נמצא</p>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────

  return (
    <div className="min-h-screen" dir="rtl">

      {/* ═══ HEADER ═══ */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="px-6 py-4">

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3 flex-row-reverse justify-end">
            <button
              onClick={() => navigateTo?.("LearningHub")}
              className="hover:text-indigo-600 transition-colors flex items-center gap-1 flex-row-reverse"
            >
              <Home className="h-3 w-3" />
              מרכז הלמידה
            </button>
            {fromTopicId && (
              <>
                <ChevronRight className="h-3 w-3" />
                <button
                  onClick={() => navigateTo?.("TopicPage", { topicId: fromTopicId })}
                  className="hover:text-indigo-600 transition-colors"
                >
                  {topics.find((t) => t.id === fromTopicId)?.name || "נושא"}
                </button>
              </>
            )}
            <ChevronRight className="h-3 w-3" />
            <span className="text-gray-600 font-medium">{mentor.name}</span>
          </div>

          {/* Mentor identity */}
          <div className="flex items-center gap-3 flex-row-reverse">
            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xl font-bold shrink-0">
              {mentor.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div className="text-right">
              <h1 className="text-lg font-bold text-gray-900">{mentor.name}</h1>
              {mentor.description && (
                <p className="text-sm text-gray-500">{mentor.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">
                {mentorVideos.length} סרטונים
                {search && ` (מתוך ${videos.filter((v) => v.mentorId === mentorId).length})`}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לפי כותרת, סיכום, תגיות..."
              className="pr-9 bg-gray-50 border-gray-200 focus:bg-white"
              dir="rtl"
            />
          </div>

        </div>
      </header>

      {/* ═══ VIDEOS GRID ═══ */}
      <main className="px-6 py-6">

        {mentorVideos.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-gray-200">
            <Play className="h-14 w-14 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">
              {search ? "לא נמצאו סרטונים תואמים" : "אין עדיין סרטונים למנטור זה"}
            </p>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="mt-3 text-sm text-indigo-600 hover:underline"
              >
                נקה חיפוש
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {mentorVideos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                mentorName={mentor.name}
                hasNotes={!!notesMap[video.id]}
                noteSnippet={notesMap[video.id]?.snippet || null}
                topics={topics}
                onSaveToggle={(v) =>
                  saveVideo.mutate({ id: v.id, isSaved: !v.isSaved })
                }
                onClick={handleVideoClick}
              />
            ))}
          </div>
        )}

      </main>


    </div>
  );
}
