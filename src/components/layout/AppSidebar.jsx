import { useState } from "react";
import {
  House, LayoutGrid, Bookmark, BookOpen,
  Bot, UtensilsCrossed, TrendingUp, BookOpen as BookOpenIcon,
  Code, Music, Dumbbell, Globe, Lightbulb, Layers,
  Settings, UserPlus, BookPlus, ChevronDown, Hash, Brain, Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AddMentorDialog } from "@/components/mentors/AddMentorDialog";
import { AddTopicDialog } from "@/components/topics/AddTopicDialog";
import { AddCategoryDialog } from "@/components/categories/AddCategoryDialog";

// Map icon string → Lucide component
const ICON_MAP = {
  Bot, Brain, Cpu,
  UtensilsCrossed,
  TrendingUp,
  BookOpen: BookOpenIcon,
  Code,
  Music,
  Dumbbell,
  Globe,
  Lightbulb,
  Layers,
  Hash,
};

// Map color string → Tailwind classes
const TOPIC_COLOR_CLASS = {
  violet:  { chip: "bg-violet-100 text-violet-700", accent: "text-violet-600" },
  orange:  { chip: "bg-orange-100 text-orange-700", accent: "text-orange-600" },
  cyan:    { chip: "bg-cyan-100 text-cyan-700",     accent: "text-cyan-600"   },
  blue:    { chip: "bg-blue-100 text-blue-700",     accent: "text-blue-600"   },
  emerald: { chip: "bg-emerald-100 text-emerald-700", accent: "text-emerald-600" },
  rose:    { chip: "bg-rose-100 text-rose-700",     accent: "text-rose-600"   },
  amber:   { chip: "bg-amber-100 text-amber-700",   accent: "text-amber-600"  },
};

// Returns mentors belonging to a main topic (via topicIds — including sub-topics)
function getMentorsForTopic(mainTopicId, allTopics, allMentors) {
  const relevantIds = new Set([mainTopicId]);
  allTopics.forEach((t) => {
    if (t.parentId === mainTopicId) relevantIds.add(t.id);
  });
  return allMentors.filter(
    (m) => m.active && m.topicIds?.some((tid) => relevantIds.has(tid))
  );
}

export function AppSidebar({
  currentPage,
  pageParams,
  navigateTo,
  navigateWithFilter,
  filters,
  mentors,
  topics,
  savedCount,
  learningCount,
}) {
  const [expandedTopicId, setExpandedTopicId] = useState(null);
  const [addMentorOpen, setAddMentorOpen]   = useState(false);
  const [addTopicOpen, setAddTopicOpen]     = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);

  const activeMentor  = filters?.mentor   || "all";
  const activeMentors = mentors.filter((m) => m.active);
  const mainTopics    = topics.filter((t) => t.isMainCategory || !t.parentId);

  const isHome =
    currentPage === "Dashboard" &&
    (filters?.category || "all") === "all" &&
    activeMentor === "all";

  const toggleTopic = (id) =>
    setExpandedTopicId((prev) => (prev === id ? null : id));

  return (
    <aside className="w-60 shrink-0 border-l border-gray-100 bg-white flex flex-col h-screen sticky top-0">

      {/* Logo + Home button */}
      <div className="px-4 py-4 border-b border-gray-100">
        <button
          onClick={() => navigateTo("Dashboard")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-right",
            isHome
              ? "bg-indigo-600 text-white shadow-sm"
              : "hover:bg-gray-50 text-gray-800"
          )}
        >
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
            isHome ? "bg-white/20" : "bg-indigo-50"
          )}>
            <House className={cn("h-4 w-4", isHome ? "text-white" : "text-indigo-600")} />
          </div>
          <div className="text-right leading-tight">
            <p className={cn("text-sm font-bold", isHome ? "text-white" : "text-gray-900")}>
              YouTube Mentor
            </p>
            <p className={cn("text-xs", isHome ? "text-white/70" : "text-gray-400")}>
              {isHome ? "מסך ראשי" : "Learning Hub"}
            </p>
          </div>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">

        {/* ── Main nav ── */}
        <div className="space-y-1">
          <NavButton
            icon={LayoutGrid}
            label="כל הסרטונים"
            isActive={currentPage === "Dashboard" && (filters?.category || "all") === "all" && activeMentor === "all"}
            onClick={() => navigateTo("Dashboard")}
          />
          <NavButton
            icon={Bookmark}
            label="שמורים"
            badge={savedCount || null}
            isActive={currentPage === "SavedVideos"}
            onClick={() => navigateTo("SavedVideos")}
            iconFilled={currentPage === "SavedVideos"}
          />
          <NavButton
            icon={BookOpen}
            label="תור למידה"
            badge={learningCount || null}
            isActive={currentPage === "LearningQueue"}
            onClick={() => navigateTo("LearningQueue")}
          />
        </div>

        {/* ── נושאים (ראשיים בלבד, עם מנטורים כנסתיים) ── */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <button
              onClick={() => navigateTo("TopicsPage")}
              className={cn(
                "text-sm font-semibold transition-colors",
                currentPage === "TopicsPage"
                  ? "text-indigo-600"
                  : "text-gray-700 hover:text-indigo-600"
              )}
            >
              נושאים
            </button>
            <button
              onClick={() => setAddTopicOpen(true)}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md px-1.5 py-1 transition-colors"
            >
              <BookPlus className="h-3.5 w-3.5" />
              הוסף
            </button>
          </div>

          <div className="space-y-0.5">
            {mainTopics.map((topic) => {
              const TopicIcon   = ICON_MAP[topic.icon] || Hash;
              const colors      = TOPIC_COLOR_CLASS[topic.color] || TOPIC_COLOR_CLASS.violet;
              const isExpanded  = expandedTopicId === topic.id;
              const topicMentors = getMentorsForTopic(topic.id, topics, activeMentors);
              const isTopicActive =
                (currentPage === "TopicPage" || currentPage === "TopicLearningPage") &&
                pageParams?.topicId === topic.id;

              return (
                <div key={topic.id}>
                  {/* Topic row */}
                  <button
                    onClick={() => toggleTopic(topic.id)}
                    className={cn(
                      "w-full flex flex-row-reverse items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                      isTopicActive
                        ? "bg-gray-100 text-gray-900 font-semibold"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <span className={cn(
                      "w-5 h-5 rounded flex items-center justify-center shrink-0",
                      colors.chip
                    )}>
                      <TopicIcon className="h-3 w-3" />
                    </span>
                    <span className="flex-1 text-right truncate text-sm">{topic.name}</span>
                    <ChevronDown className={cn(
                      "h-3.5 w-3.5 text-gray-400 transition-transform duration-200 shrink-0",
                      isExpanded && "rotate-180"
                    )} />
                  </button>

                  {/* Mentors list (collapsed by default) */}
                  {isExpanded && (
                    <div className="pr-8 pb-1 pt-0.5 space-y-0.5">
                      {/* Link to topic page */}
                      <button
                        onClick={() => navigateTo("TopicPage", { topicId: topic.id })}
                        className={cn(
                          "w-full text-right text-xs px-2 py-1.5 rounded-md transition-colors",
                          colors.accent,
                          "hover:bg-gray-50 font-medium"
                        )}
                      >
                        כל הסרטונים ←
                      </button>

                      {topicMentors.length > 0 ? topicMentors.map((mentor) => {
                        const initial     = mentor.name?.[0]?.toUpperCase() || "?";
                        const isMentorActive =
                          currentPage === "Dashboard" && activeMentor === mentor.id;
                        return (
                          <button
                            key={mentor.id}
                            onClick={() => navigateWithFilter("mentor", mentor.id)}
                            className={cn(
                              "w-full flex flex-row-reverse items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors",
                              isMentorActive
                                ? "bg-gray-100 text-gray-900 font-semibold"
                                : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                            )}
                          >
                            <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {initial}
                            </span>
                            <span className="flex-1 text-right truncate">{mentor.name}</span>
                          </button>
                        );
                      }) : (
                        <p className="text-xs text-gray-400 px-2 py-1 text-right">אין מנטורים</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-gray-100">
        <NavButton
          icon={Settings}
          label="ניהול"
          isActive={currentPage === "Admin"}
          onClick={() => navigateTo("Admin")}
        />
      </div>

      <AddMentorDialog   open={addMentorOpen}   onOpenChange={setAddMentorOpen}   />
      <AddTopicDialog    open={addTopicOpen}    onOpenChange={setAddTopicOpen}    />
      <AddCategoryDialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen} />
    </aside>
  );
}

function NavButton({ icon: Icon, label, badge, isActive, onClick, iconFilled }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex flex-row-reverse items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        isActive
          ? "bg-gray-100 text-gray-900"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", iconFilled && "fill-current")} />
      <span className="flex-1 text-right">{label}</span>
      {badge != null && (
        <span className="text-xs text-gray-400 bg-gray-200/60 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
          {badge}
        </span>
      )}
    </button>
  );
}
