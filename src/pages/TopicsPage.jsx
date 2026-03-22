import { useTopics } from "@/hooks/useTopics";
import { useVideos } from "@/hooks/useVideos";
import { cn } from "@/lib/utils";
import {
  Cpu, Brain, Soup, TrendingUp, Layers,
  Bot, UtensilsCrossed, Code, Music, Dumbbell,
  Globe, Lightbulb, BookOpen, Hash, ArrowLeft,
  LayoutGrid,
} from "lucide-react";

const ICON_MAP = {
  Cpu, Brain, Soup, TrendingUp, Layers,
  Bot, UtensilsCrossed, Code, Music, Dumbbell,
  Globe, Lightbulb, BookOpen,
};

const COLOR_MAP = {
  violet:  { iconBg: "bg-violet-100",  icon: "text-violet-600",  progress: "bg-violet-500",  topBorder: "border-t-violet-400",  badge: "bg-violet-50 text-violet-700"  },
  orange:  { iconBg: "bg-orange-100",  icon: "text-orange-600",  progress: "bg-orange-500",  topBorder: "border-t-orange-400",  badge: "bg-orange-50 text-orange-700"  },
  cyan:    { iconBg: "bg-cyan-100",    icon: "text-cyan-600",    progress: "bg-cyan-500",    topBorder: "border-t-cyan-400",    badge: "bg-cyan-50 text-cyan-700"    },
  emerald: { iconBg: "bg-emerald-100", icon: "text-emerald-600", progress: "bg-emerald-500", topBorder: "border-t-emerald-400", badge: "bg-emerald-50 text-emerald-700" },
  rose:    { iconBg: "bg-rose-100",    icon: "text-rose-600",    progress: "bg-rose-500",    topBorder: "border-t-rose-400",    badge: "bg-rose-50 text-rose-700"    },
  amber:   { iconBg: "bg-amber-100",   icon: "text-amber-600",   progress: "bg-amber-500",   topBorder: "border-t-amber-400",   badge: "bg-amber-50 text-amber-700"   },
};

export default function TopicsPage({ navigateTo }) {
  const { data: topics = [], isLoading } = useTopics();
  const { data: videos = [] } = useVideos();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">טוען נושאים...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* Page header */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-gray-900">הנושאים שלי</h1>
        <p className="text-sm text-gray-500 mt-1.5">
          {topics.length} נושאים · בחר נושא כדי להיכנס לסביבת הלמידה
        </p>
      </div>

      {/* Empty state */}
      {topics.length === 0 && (
        <div className="text-center py-24 bg-white rounded-2xl border border-gray-200">
          <LayoutGrid className="h-14 w-14 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">אין נושאים עדיין</p>
          <p className="text-sm text-gray-400 mt-1">הוסף נושא מהסיידבר להתחיל</p>
        </div>
      )}

      {/* Topic cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {topics.map((topic) => {
          const topicVideos = videos.filter((v) => v.topicIds?.includes(topic.id));
          const learnedCount = topicVideos.filter(
            (v) => v.learningStatus === "learned" || v.learningStatus === "completed"
          ).length;
          const progress =
            topicVideos.length > 0
              ? Math.round((learnedCount / topicVideos.length) * 100)
              : 0;
          const isComplete = progress === 100 && topicVideos.length > 0;

          const Icon = ICON_MAP[topic.icon] || Hash;
          const colors = COLOR_MAP[topic.color] || COLOR_MAP.violet;

          return (
            <button
              key={topic.id}
              onClick={() => navigateTo("TopicPage", { topicId: topic.id })}
              className={cn(
                // Base card style — thick colored top border acts as a color accent
                "w-full text-right bg-white rounded-2xl border border-t-4 border-gray-200 p-6",
                // Hover: lift + shadow + smooth
                "hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer group",
                colors.topBorder
              )}
            >
              {/* ── Icon + Title ── */}
              <div className="flex items-start gap-4 mb-5">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                  colors.iconBg
                )}>
                  <Icon className={cn("h-6 w-6", colors.icon)} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <h3 className="text-lg font-bold text-gray-900 leading-snug truncate">
                    {topic.name}
                  </h3>
                  {topic.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                      {topic.description}
                    </p>
                  )}
                </div>
              </div>

              {/* ── Progress section ── */}
              {topicVideos.length > 0 ? (
                <div className="space-y-2">
                  {/* Count badge + percentage */}
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-xs px-2.5 py-1 rounded-full font-medium",
                      colors.badge
                    )}>
                      {topicVideos.length} סרטונים
                    </span>
                    <span className={cn(
                      "text-sm font-bold",
                      isComplete ? "text-emerald-600" : "text-gray-700"
                    )}>
                      {progress}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isComplete ? "bg-emerald-500" : colors.progress
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {/* Footer: learned count + arrow */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-gray-400">
                      {learnedCount} מתוך {topicVideos.length} נלמדו
                    </span>
                    <ArrowLeft className="h-4 w-4 text-gray-300 group-hover:text-indigo-400 group-hover:-translate-x-0.5 transition-all" />
                  </div>
                </div>
              ) : (
                /* No videos yet */
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm text-gray-400">אין סרטונים עדיין</span>
                  <ArrowLeft className="h-4 w-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
