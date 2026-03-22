import { useMemo } from "react";
import { useTopics } from "@/hooks/useTopics";
import { useMentors } from "@/hooks/useMentors";
import { useVideos } from "@/hooks/useVideos";
import { cn } from "@/lib/utils";
import {
  Cpu, Brain, TrendingUp, Layers, Bot, Code,
  Globe, Lightbulb, BookOpen, Hash,
  ChevronRight, Home, Users, Play,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Icon / Color maps ────────────────────────────────────

const ICON_MAP = {
  Cpu, Brain, TrendingUp, Layers, Bot, Code, Globe, Lightbulb, BookOpen,
};

const COLOR_MAP = {
  violet:  { iconBg: "bg-violet-100",  icon: "text-violet-600",  badge: "bg-violet-50 text-violet-700",  avatar: "bg-violet-100 text-violet-700"  },
  cyan:    { iconBg: "bg-cyan-100",    icon: "text-cyan-600",    badge: "bg-cyan-50 text-cyan-700",      avatar: "bg-cyan-100 text-cyan-700"    },
  blue:    { iconBg: "bg-blue-100",    icon: "text-blue-600",    badge: "bg-blue-50 text-blue-700",      avatar: "bg-blue-100 text-blue-700"    },
  amber:   { iconBg: "bg-amber-100",   icon: "text-amber-600",   badge: "bg-amber-50 text-amber-700",    avatar: "bg-amber-100 text-amber-700"   },
  emerald: { iconBg: "bg-emerald-100", icon: "text-emerald-600", badge: "bg-emerald-50 text-emerald-700",avatar: "bg-emerald-100 text-emerald-700"},
  orange:  { iconBg: "bg-orange-100",  icon: "text-orange-600",  badge: "bg-orange-50 text-orange-700",  avatar: "bg-orange-100 text-orange-700"  },
};

// ─── Helper ──────────────────────────────────────────────

function extractYouTubeId(url) {
  const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return match?.[1] || null;
}

// ─── Main Component ───────────────────────────────────────

export default function TopicPage({ topicId, navigateTo }) {
  const { data: topics = [],  isLoading: topicsLoading  } = useTopics();
  const { data: mentors = [], isLoading: mentorsLoading } = useMentors();
  const { data: videos = [],  isLoading: videosLoading  } = useVideos();

  const isLoading = topicsLoading || mentorsLoading || videosLoading;

  const topic = useMemo(
    () => topics.find((t) => t.id === topicId),
    [topics, topicId]
  );

  // כל ה-IDs הרלוונטיים: הנושא הראשי + תתי-הנושאים שלו
  const relevantTopicIds = useMemo(() => {
    const subIds = topics.filter((t) => t.parentId === topicId).map((t) => t.id);
    return [topicId, ...subIds];
  }, [topics, topicId]);

  // מנטורים ששייכים לנושא זה (לפי topicIds שלהם)
  const topicMentors = useMemo(
    () => mentors.filter((m) => (m.topicIds || []).some((tid) => relevantTopicIds.includes(tid))),
    [mentors, relevantTopicIds]
  );

  // העשרה: הוספת כמות סרטונים ונלמדו לכל מנטור
  const enrichedMentors = useMemo(
    () =>
      topicMentors.map((mentor) => {
        const mentorVideos = videos.filter((v) => v.mentorId === mentor.id);

        // הסרטון האחרון לפי publishedAt (fallback: סדר המערך)
        const latestVideo = [...mentorVideos].sort(
          (a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)
        )[0] || null;

        // בניית thumbnail URL מ-YouTube ID
        const youtubeId    = extractYouTubeId(latestVideo?.url);
        const thumbnailUrl = youtubeId
          ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
          : latestVideo?.thumbnail || null;

        const learnedCount = mentorVideos.filter(
          (v) => v.learningStatus === "learned" || v.learningStatus === "completed"
        ).length;

        return {
          ...mentor,
          videoCount: mentorVideos.length,
          learnedCount,
          latestVideo,
          thumbnailUrl,
        };
      }),
    [topicMentors, videos]
  );

  // ─── Loading ──────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-8 space-y-5">
        <Skeleton className="h-16 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-sm text-gray-400">נושא לא נמצא</p>
      </div>
    );
  }

  const TopicIcon = ICON_MAP[topic.icon] || Hash;
  const colors = COLOR_MAP[topic.color] || COLOR_MAP.violet;

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
            <ChevronRight className="h-3 w-3" />
            <span className="text-gray-600 font-medium">{topic.name}</span>
          </div>

          {/* Topic identity */}
          <div className="flex items-center gap-3 flex-row-reverse">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", colors.iconBg)}>
              <TopicIcon className={cn("h-5 w-5", colors.icon)} />
            </div>
            <div className="text-right">
              <h1 className="text-lg font-bold text-gray-900">{topic.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {enrichedMentors.length} מנטורים
              </p>
            </div>
          </div>

        </div>
      </header>

      {/* ═══ MENTORS GRID ═══ */}
      <main className="px-6 py-6">

        {enrichedMentors.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-gray-200">
            <Users className="h-14 w-14 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">אין מנטורים בנושא זה</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {enrichedMentors.map((mentor) => (
              <div
                key={mentor.id}
                onClick={() => navigateTo?.("MentorPage", { mentorId: mentor.id, fromTopicId: topicId })}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group"
              >
                {/* ── Thumbnail area ── */}
                <div className="relative h-40 overflow-hidden bg-gray-100">
                  {mentor.thumbnailUrl ? (
                    <>
                      <img
                        src={mentor.thumbnailUrl}
                        alt={mentor.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                      {/* gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />

                      {/* כותרת הסרטון האחרון */}
                      {mentor.latestVideo?.title && (
                        <div className="absolute bottom-0 right-0 left-0 px-3 pb-2.5">
                          <p className="text-[11px] text-white/80 line-clamp-2 leading-snug">
                            {mentor.latestVideo.title}
                          </p>
                        </div>
                      )}

                      {/* Play overlay on hover */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
                          <Play className="h-4 w-4 text-white fill-white" />
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Placeholder צבעוני כשאין סרטון */
                    <div className={cn("w-full h-full flex items-center justify-center", colors.iconBg)}>
                      <TopicIcon className={cn("h-12 w-12 opacity-20", colors.icon)} />
                    </div>
                  )}
                </div>

                {/* ── Card content ── */}
                <div className="p-4">
                  {/* Avatar + שם */}
                  <div className="flex items-center gap-3 flex-row-reverse mb-3">
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                      colors.avatar
                    )}>
                      {mentor.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <h3 className="font-bold text-gray-900 truncate">{mentor.name}</h3>
                      {mentor.description && (
                        <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                          {mentor.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Play className="h-3 w-3" />
                      {mentor.videoCount} סרטונים
                    </span>
                    {mentor.learnedCount > 0 && (
                      <span className="text-xs text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5 font-medium">
                        {mentor.learnedCount} נלמדו
                      </span>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="pt-3 border-t border-gray-100">
                    <span className="text-sm font-semibold text-indigo-600 group-hover:text-indigo-700 transition-colors">
                      צפה בסרטונים ←
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
