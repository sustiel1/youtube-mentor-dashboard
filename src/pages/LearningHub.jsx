import { useMemo } from "react";
import { useTopics } from "@/hooks/useTopics";
import { useVideos } from "@/hooks/useVideos";
import { cn } from "@/lib/utils";
import {
  Cpu, Brain, TrendingUp, Layers,
  Bot, Code, Globe, Lightbulb, BookOpen,
  Hash, GraduationCap, Users,
} from "lucide-react";

const ICON_MAP = {
  Cpu, Brain, TrendingUp, Layers, Bot, Code, Globe, Lightbulb, BookOpen,
};

const ICON_BG = {
  violet:  { bg: "bg-violet-100", text: "text-violet-600" },
  orange:  { bg: "bg-orange-100", text: "text-orange-600" },
  cyan:    { bg: "bg-cyan-100",   text: "text-cyan-600"   },
  emerald: { bg: "bg-emerald-100",text: "text-emerald-600"},
  rose:    { bg: "bg-rose-100",   text: "text-rose-600"   },
  amber:   { bg: "bg-amber-100",  text: "text-amber-600"  },
  blue:    { bg: "bg-blue-100",   text: "text-blue-600"   },
};

export default function LearningHub({ navigateTo }) {
  const { data: topics = [], isLoading: topicsLoading } = useTopics();
  const { data: videos = [], isLoading: videosLoading } = useVideos();

  const isLoading = topicsLoading || videosLoading;

  // רק קטגוריות ראשיות
  const mainCategories = useMemo(
    () => topics.filter((t) => t.isMainCategory === true),
    [topics]
  );

  // כמות סרטונים לכל קטגוריה (כולל תת-נושאים)
  const enriched = useMemo(() => {
    return mainCategories.map((topic) => {
      const subIds = topics
        .filter((t) => t.parentId === topic.id)
        .map((t) => t.id);
      const allIds = [topic.id, ...subIds];

      const topicVideos = videos.filter((v) =>
        (v.topicIds || []).some((tid) => allIds.includes(tid))
      );
      const learnedCount = topicVideos.filter(
        (v) => v.learningStatus === "learned" || v.learningStatus === "completed"
      ).length;
      const progress =
        topicVideos.length > 0
          ? Math.round((learnedCount / topicVideos.length) * 100)
          : 0;

      return { ...topic, videoCount: topicVideos.length, learnedCount, progress };
    });
  }, [mainCategories, topics, videos]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">טוען...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto" dir="rtl">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">מרכז הלמידה</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1 mr-12">
          בחר נושא כדי לראות את המנטורים שלו
        </p>
      </div>

      {/* Empty state */}
      {mainCategories.length === 0 && (
        <div className="text-center py-24 bg-white rounded-2xl border border-gray-200">
          <GraduationCap className="h-14 w-14 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">אין נושאים עדיין</p>
        </div>
      )}

      {/* Categories grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {enriched.map((topic) => {
          const Icon = ICON_MAP[topic.icon] || Hash;
          const iconColors = ICON_BG[topic.color] || ICON_BG.violet;

          return (
            <div
              key={topic.id}
              onClick={() => navigateTo("TopicPage", { topicId: topic.id })}
              className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer group"
            >
              {/* Icon + name */}
              <div className="flex items-center gap-3 mb-4 flex-row-reverse">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", iconColors.bg)}>
                  <Icon className={cn("h-6 w-6", iconColors.text)} />
                </div>
                <div className="flex-1 text-right">
                  <h3 className="text-lg font-bold text-gray-900">{topic.name}</h3>
                  {topic.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{topic.description}</p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <span className="flex items-center gap-1 text-xs">
                  <Users className="h-3.5 w-3.5" />
                  מנטורים
                </span>
                <span className="text-xs">{topic.videoCount} סרטונים</span>
              </div>

              {/* Progress bar */}
              {topic.videoCount > 0 && (
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      topic.progress === 100 ? "bg-emerald-500" : iconColors.text.replace("text-", "bg-")
                    )}
                    style={{ width: `${topic.progress}%` }}
                  />
                </div>
              )}

              {/* CTA */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateTo("TopicPage", { topicId: topic.id });
                }}
                className="w-full py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
              >
                הצג מנטורים
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
