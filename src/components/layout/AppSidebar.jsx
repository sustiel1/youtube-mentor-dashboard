import { useState, useRef, useEffect } from "react";
import {
  House, LayoutGrid, Bookmark, BookOpen,
  Settings, UserPlus, BookPlus, ChevronDown, GripVertical,
  Music4, Construction, Candy, HeartPulse, Landmark, ChefHat, Workflow, Bot, ChartCandlestick, Hash,
} from "lucide-react";
import { getTopicByName, TOPIC_CONFIG_BY_NAME } from "@/config/topicConfig";

// Map topic.icon string → Lucide component (fallback for topics using the icon field)
export const TOPIC_ICON_MAP = {
  Music4, Construction, Candy, HeartPulse, Landmark, ChefHat, Workflow, Bot, ChartCandlestick, Hash,
};

// Re-export for backward compat — Admin.jsx and others import getTopicConfig from here
export { TOPIC_CONFIG_BY_NAME as TOPIC_ICON_CONFIG };
export const getTopicConfig = getTopicByName;

import { cn } from "@/lib/utils";
import { AddMentorDialog } from "@/components/mentors/AddMentorDialog";
import { AddTopicDialog } from "@/components/topics/AddTopicDialog";
import { AddCategoryDialog } from "@/components/categories/AddCategoryDialog";

// ── localStorage helpers for topic order (shared with Admin.jsx) ──────────
const ORDER_KEY = "ym_topic_order";
function loadOrder()       { try { return JSON.parse(localStorage.getItem(ORDER_KEY)); } catch { return null; } }
function saveOrder(ids)    { localStorage.setItem(ORDER_KEY, JSON.stringify(ids)); }
function applyStoredOrder(topics) {
  const stored = loadOrder();
  if (!stored || !stored.length) return topics;
  const map     = Object.fromEntries(topics.map((t) => [t.id, t]));
  const sorted  = stored.map((id) => map[id]).filter(Boolean);
  const newOnes = topics.filter((t) => !stored.includes(t.id));
  return [...sorted, ...newOnes];
}

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

// Category → topic name aliases
const CATEGORY_ALIASES = {
  Markets: ["שוק ההון", "markets", "מסחר", "השקעות"],
  AI:      ["ai", "בינה מלאכותית", "machine learning"],
  Dev:     ["פיתוח", "dev", "programming"],
};

function categoryMatchesTopic(mentorCategory, topicName) {
  if (!mentorCategory || !topicName) return false;
  const cat = mentorCategory.toLowerCase();
  const name = topicName.toLowerCase();
  if (cat === name || name.includes(cat) || cat.includes(name)) return true;
  const aliases = CATEGORY_ALIASES[mentorCategory] || [];
  return aliases.some((a) => name.includes(a.toLowerCase()) || a.toLowerCase().includes(name));
}

// Returns mentors belonging to a main topic (via topicIds — including sub-topics)
// Fallback: match mentor.category against topic.name
function getMentorsForTopic(mainTopicId, allTopics, allMentors) {
  const mainTopic = allTopics.find((t) => t.id === mainTopicId);
  const relevantIds = new Set([mainTopicId]);
  allTopics.forEach((t) => {
    if (t.parentId === mainTopicId) relevantIds.add(t.id);
  });
  return allMentors.filter((m) => {
    if (!m.active) return false;
    if (m.topicIds?.some((tid) => relevantIds.has(tid))) return true;
    // Fallback: match by category
    return mainTopic && categoryMatchesTopic(m.category, mainTopic.name);
  });
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
  const [addMentorOpen, setAddMentorOpen]     = useState(false);
  const [addTopicOpen, setAddTopicOpen]       = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [draggingId, setDraggingId]           = useState(null);

  // Ordered list of main topics (persisted in localStorage)
  const [orderedTopics, setOrderedTopics] = useState(() =>
    applyStoredOrder(topics.filter((t) => t.isMainCategory || !t.parentId))
  );

  // Sync orderedTopics when topics prop changes (e.g. after a mutation)
  useEffect(() => {
    const main = topics.filter((t) => t.isMainCategory || !t.parentId);
    setOrderedTopics((prev) => {
      const map     = Object.fromEntries(main.map((t) => [t.id, t]));
      const updated = prev.map((t) => map[t.id]).filter(Boolean);
      const added   = main.filter((t) => !prev.some((p) => p.id === t.id));
      return [...updated, ...added];
    });
  }, [topics]);

  // Drag-and-drop refs
  const dragId     = useRef(null);
  const lastOverId = useRef(null);

  function handleDragStart(e, id) {
    dragId.current   = id;
    lastOverId.current = null;
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e, id) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (lastOverId.current === id) return; // skip if same target
    lastOverId.current = id;
    if (!dragId.current || dragId.current === id) return;
    // Live reorder preview
    setOrderedTopics((prev) => {
      const from = prev.findIndex((t) => t.id === dragId.current);
      const to   = prev.findIndex((t) => t.id === id);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function handleDrop(e, id) {
    e.preventDefault();
    // Save the final order to localStorage
    setOrderedTopics((prev) => {
      saveOrder(prev.map((t) => t.id));
      return prev;
    });
    setDraggingId(null);
    dragId.current     = null;
    lastOverId.current = null;
  }

  function handleDragEnd() {
    // Fired if drop happened outside a valid target — persist current order
    setOrderedTopics((prev) => {
      saveOrder(prev.map((t) => t.id));
      return prev;
    });
    setDraggingId(null);
    dragId.current     = null;
    lastOverId.current = null;
  }

  const activeMentor  = filters?.mentor || "all";
  const activeMentors = mentors.filter((m) => m.active);

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
            {orderedTopics.map((topic) => {
              const cfg          = getTopicConfig(topic.name);
              const TopicIcon    = cfg?.Icon || TOPIC_ICON_MAP[topic.icon] || null;
              const colors       = TOPIC_COLOR_CLASS[topic.color] || TOPIC_COLOR_CLASS.violet;
              const isExpanded   = expandedTopicId === topic.id;
              const topicMentors = getMentorsForTopic(topic.id, topics, activeMentors);
              const isTopicActive =
                (currentPage === "TopicPage" || currentPage === "TopicLearningPage") &&
                pageParams?.topicId === topic.id;
              const isDragging = draggingId === topic.id;

              return (
                <div
                  key={topic.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, topic.id)}
                  onDragOver={(e)  => handleDragOver(e, topic.id)}
                  onDrop={(e)      => handleDrop(e, topic.id)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "transition-opacity",
                    isDragging && "opacity-40"
                  )}
                >
                  {/* Topic row */}
                  <button
                    onClick={() => toggleTopic(topic.id)}
                    className={cn(
                      "w-full flex flex-row-reverse items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-grab active:cursor-grabbing",
                      isTopicActive
                        ? "bg-gray-100 text-gray-900 font-semibold"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <span className={cn(
                      "w-6 h-6 rounded-lg flex items-center justify-center shrink-0",
                      cfg ? `${cfg.bg} ${cfg.text}` : colors.chip
                    )}>
                      {TopicIcon
                        ? <TopicIcon className="h-3.5 w-3.5" />
                        : <Hash className="h-3.5 w-3.5" />
                      }
                    </span>
                    <span className="flex-1 text-right truncate text-sm">{topic.name}</span>
                    <ChevronDown className={cn(
                      "h-3.5 w-3.5 text-gray-400 transition-transform duration-200 shrink-0",
                      isExpanded && "rotate-180"
                    )} />
                    <GripVertical className="h-3.5 w-3.5 text-gray-300 shrink-0" />
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
                        const initial = mentor.name?.[0]?.toUpperCase() || "?";
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
      <div className="px-3 py-4 border-t border-gray-100 space-y-1">
        <button
          onClick={() => setAddMentorOpen(true)}
          className="w-full flex flex-row-reverse items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
          <UserPlus className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-right">מנטור חדש</span>
        </button>
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
