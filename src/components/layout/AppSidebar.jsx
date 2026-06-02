import { useState, useRef, useEffect } from "react";
import {
  House, LayoutGrid, Bookmark, BookOpen, Library, Search,
  Settings, UserPlus, BookPlus, ChevronDown, GripVertical,
  Pencil, Trash2, Check, X, BookMarked,
  Music4, Construction, Candy, HeartPulse, Landmark, ChefHat, Workflow, Bot, ChartCandlestick, Hash, Moon, Sun,
  Layers, Cloud,
} from "lucide-react";
import { getTopicByName, TOPIC_CONFIG_BY_NAME } from "@/config/topicConfig";
import { useUpdateTopic, useDeleteTopic } from "@/hooks/useTopics";
import { useDeleteMentor } from "@/hooks/useMentors";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// Map topic.icon string → Lucide component (fallback for topics using the icon field)
export const TOPIC_ICON_MAP = {
  Music4, Construction, Candy, HeartPulse, Landmark, ChefHat, Workflow, Bot, ChartCandlestick, Hash,
};

// Re-export for backward compat — Admin.jsx and others import getTopicConfig from here
export { TOPIC_CONFIG_BY_NAME as TOPIC_ICON_CONFIG };
export const getTopicConfig = getTopicByName;

import { cn } from "@/lib/utils";
import { AddMentorDialog } from "@/components/mentors/AddMentorDialog";
import { AddChannelCollectionDialog } from "@/components/collections/AddChannelCollectionDialog";
import { AddTopicDialog } from "@/components/topics/AddTopicDialog";
import { AddCategoryDialog } from "@/components/categories/AddCategoryDialog";
import { filterMentorsByTopicFamily, formatTopicLabel, getOrderedMainTopics, videoBelongsToTopicFamily } from "@/lib/topicFilters";

// ── localStorage helpers for topic order (shared with Admin.jsx) ──────────
const ORDER_KEY = "ym_topic_order";
function saveOrder(ids)    { localStorage.setItem(ORDER_KEY, JSON.stringify(ids)); }
function applyStoredOrder(topics) {
  return getOrderedMainTopics(topics);
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
  videos = [],
  savedCount,
  learningCount,
  isDark,
  toggleTheme,
  onSaveToBrain,
}) {
  const [expandedTopicId, setExpandedTopicId] = useState(null);
  const [addMentorOpen, setAddMentorOpen]     = useState(false);
  const [addChannelCollectionOpen, setAddChannelCollectionOpen] = useState(false);
  const [addTopicOpen, setAddTopicOpen]       = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [draggingId, setDraggingId]           = useState(null);
  const [editingTopic, setEditingTopic]       = useState(null); // topic object being edited
  const [deletingId, setDeletingId]           = useState(null); // topic id awaiting confirm

  const deleteTopic  = useDeleteTopic();
  const deleteMentor = useDeleteMentor();
  const [deletingMentorId, setDeletingMentorId] = useState(null);

  function handleDeleteMentor(id) {
    deleteMentor.mutate(id, {
      onSuccess: () => setDeletingMentorId(null),
    });
  }

  function handleDelete(id) {
    deleteTopic.mutate(id, {
      onSuccess: () => {
        setDeletingId(null);
        setOrderedTopics((prev) => prev.filter((t) => t.id !== id));
      },
    });
  }

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
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-l border-slate-200 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/95">

      {/* Logo + Home button */}
      <div className="border-b border-slate-200 px-4 py-5 dark:border-zinc-800/80">
        <button
          onClick={() => navigateTo("Dashboard")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all text-right border border-transparent",
            isHome
              ? "bg-gradient-to-l from-red-600 to-red-500 text-white shadow-2xl border-red-400/20"
              : "border-slate-200 text-slate-900 hover:bg-slate-100 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900"
          )}
        >
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-xl shrink-0",
            isHome ? "bg-white/10" : "bg-slate-100 dark:bg-zinc-900"
          )}>
            <House className={cn("h-4 w-4", isHome ? "text-white" : "text-red-400")} />
          </div>
          <div className="text-right leading-tight">
            <p className={cn("text-sm font-bold", isHome ? "text-white" : "text-slate-900 dark:text-white")}>
              YouTube Mentor
            </p>
            <p className={cn("text-xs", isHome ? "text-white/70" : "text-slate-500 dark:text-zinc-500")}>
              {isHome ? "מסך ראשי" : "Learning Hub"}
            </p>
          </div>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">

        {/* ── ניהול תוכן ── */}
        <div className="space-y-1">
          <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">ניהול תוכן</p>
          <NavButton
            icon={LayoutGrid}
            label="כל הסרטונים"
            isActive={currentPage === "Dashboard" && (filters?.category || "all") === "all" && activeMentor === "all"}
            onClick={() => navigateTo("Dashboard")}
            testId="nav-dashboard"
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
          <NavButton
            icon={Cloud}
            label="גיבויי ענן"
            isActive={currentPage === "CloudBackups"}
            onClick={() => navigateTo("CloudBackups")}
          />
        </div>

        {/* ── מרחב הידע ── */}
        <div className="space-y-1">
          <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">מרחב הידע</p>
          <NavButton
            icon={Library}
            label="ספריית ידע"
            isActive={currentPage === "KnowledgeLibrary"}
            onClick={() => navigateTo("KnowledgeLibrary")}
          />
          <NavButton
            icon={Search}
            label="חיפוש ידע"
            isActive={currentPage === "KnowledgeSearch"}
            onClick={() => navigateTo("KnowledgeSearch")}
          />
          <NavButton
            icon={BookMarked}
            label="Workspace"
            isActive={currentPage === "Workspace" || currentPage === "TopicKnowledgePage"}
            onClick={() => navigateTo("Workspace")}
          />
        </div>

        {/* ── הברינים שלי (ראשיים בלבד, עם מנטורים כנסתיים) ── */}
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
              הברינים שלי
            </button>
            <button
              onClick={() => setAddTopicOpen(true)}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md px-1.5 py-1 transition-colors"
            >
              <BookPlus className="h-3.5 w-3.5" />
              נושא חדש
            </button>
          </div>

          <div className="space-y-0.5">
            {orderedTopics.map((topic) => {
              const cfg          = getTopicConfig(topic.name);
              const TopicIcon    = cfg?.Icon || TOPIC_ICON_MAP[topic.icon] || null;
              const colors       = TOPIC_COLOR_CLASS[topic.color] || TOPIC_COLOR_CLASS.violet;
              const isExpanded   = expandedTopicId === topic.id;
              const topicMentors = filterMentorsByTopicFamily(activeMentors, topic.id, topics);
              const topicVideos = videos.filter((video) => videoBelongsToTopicFamily(video, topic.id, topics));
              const isTopicActive =
                (currentPage === "TopicPage" || currentPage === "TopicLearningPage" || currentPage === "TopicKnowledgePage") &&
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
                  {/* Topic row — plain flex in RTL flows right→left naturally */}
                  <div className={cn(
                    "group flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm transition-colors",
                    isTopicActive
                      ? "bg-gray-100 text-gray-900 font-semibold dark:bg-zinc-900 dark:text-zinc-100"
                      : "text-gray-600 hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-zinc-900/60 dark:hover:text-white"
                  )}>
                    {/* 1. Topic icon — click → BrainPage for this topic */}
                    <button
                      onClick={() => navigateTo("TopicKnowledgePage", { topicId: topic.id })}
                      title={`פתח ידע: ${topic.name}`}
                      className={cn(
                        "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-opacity hover:opacity-75",
                        cfg ? `${cfg.bg} ${cfg.text}` : colors.chip
                      )}
                    >
                      {TopicIcon
                        ? <TopicIcon className="h-3.5 w-3.5" />
                        : <Hash className="h-3.5 w-3.5" />
                      }
                    </button>

                    {/* 2. Edit/Delete buttons (between icon and name, visible on hover) */}
                    {deletingId === topic.id ? (
                      /* Inline delete confirm */
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => handleDelete(topic.id)}
                          title="אישור מחיקה"
                          className="p-1 rounded text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          title="ביטול"
                          className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      /* Edit / Delete — visible on hover */
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => setEditingTopic(topic)}
                          title="ערוך נושא"
                          className="p-1 rounded text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setDeletingId(topic.id)}
                          title="מחק נושא"
                          className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}

                    {/* 3. Topic name — fills remaining space, click to toggle */}
                    <button
                      onClick={() => toggleTopic(topic.id)}
                      className="flex-1 text-right truncate text-sm min-w-0 cursor-grab active:cursor-grabbing"
                    >
                      {topic.name}
                    </button>

                    {/* 4. Chevron + grip — leftmost */}
                    <button onClick={() => toggleTopic(topic.id)}>
                      <ChevronDown className={cn(
                        "h-3.5 w-3.5 text-gray-400 transition-transform duration-200 shrink-0",
                        isExpanded && "rotate-180"
                      )} />
                    </button>
                    <GripVertical className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                  </div>

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

                      {topicMentors.length > 0 ? (() => {
                        const topicsById = Object.fromEntries(topics.map((t) => [t.id, t]));
                        const subTopics = topics
                          .filter((t) => t.parentId === topic.id)
                          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "he"));

                        const grouped = new Map(); // key: subTopicId | "__none__" → mentors[]
                        for (const m of topicMentors) {
                          const leaf = m.topicIds?.[0] ? String(m.topicIds[0]) : "";
                          const leafTopic = leaf ? topicsById[leaf] : null;
                          const isUnderThisMain = leafTopic?.parentId === topic.id;
                          const key = isUnderThisMain ? leafTopic.id : "__none__";
                          if (!grouped.has(key)) grouped.set(key, []);
                          grouped.get(key).push(m);
                        }

                        const renderMentorRow = (mentor) => {
                          const initial = mentor.name?.[0]?.toUpperCase() || "?";
                          const isMentorActive =
                            currentPage === "Dashboard" && activeMentor === mentor.id;
                          const isConfirming = deletingMentorId === mentor.id;
                          return (
                            <div
                              key={mentor.id}
                              className={cn(
                                "group flex flex-row-reverse items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors",
                                isMentorActive
                                  ? "bg-gray-100 text-gray-900 font-semibold dark:bg-zinc-900 dark:text-white"
                                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-zinc-200 dark:hover:bg-zinc-900/60 dark:hover:text-white"
                              )}
                            >
                              <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                                {initial}
                              </span>
                              <button
                                onClick={() => navigateTo("MentorPage", { mentorId: mentor.id })}
                                className="flex-1 text-right truncate"
                                title={mentor.name}
                              >
                                {mentor.name}
                              </button>
                              {isConfirming ? (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    onClick={() => handleDeleteMentor(mentor.id)}
                                    title="אישור מחיקה"
                                    className="p-0.5 rounded text-red-500 hover:bg-red-50 transition-colors"
                                  >
                                    <Check className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => setDeletingMentorId(null)}
                                    title="ביטול"
                                    className="p-0.5 rounded text-gray-400 hover:bg-gray-100 transition-colors"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeletingMentorId(mentor.id)}
                                  title="מחק מנטור"
                                  className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          );
                        };

                        const blocks = [];
                        for (const st of subTopics) {
                          const list = grouped.get(st.id) || [];
                          if (list.length === 0) continue;
                          blocks.push(
                            <div key={st.id} className="pt-1">
                              <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                                {formatTopicLabel(st.id, topics)}
                              </div>
                              <div className="space-y-0.5">
                                {list.map(renderMentorRow)}
                              </div>
                            </div>
                          );
                        }

                        const noSub = grouped.get("__none__") || [];
                        if (noSub.length > 0) {
                          blocks.push(
                            <div key="__none__" className="pt-1">
                              <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                                ללא תת-נושא
                              </div>
                              <div className="space-y-0.5">
                                {noSub.map(renderMentorRow)}
                              </div>
                            </div>
                          );
                        }

                        return <>{blocks}</>;
                      })() : (
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
      <div className="space-y-2 border-t border-slate-200 px-3 py-4 dark:border-zinc-800">
        {onSaveToBrain && (
          <button
            onClick={() => onSaveToBrain("")}
            className="w-full flex flex-row-reverse items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-medium bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-900/40"
          >
            <BookPlus className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-right">🧠 שמור למוח</span>
          </button>
        )}
        <button
          onClick={() => setAddMentorOpen(true)}
          className="w-full flex flex-row-reverse items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          <UserPlus className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-right">מנטור חדש</span>
        </button>
        <button
          onClick={() => setAddChannelCollectionOpen(true)}
          className="w-full flex flex-row-reverse items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          <Layers className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-right">אוסף ערוצים חדש</span>
        </button>
        <NavButton
          icon={Settings}
          label="ניהול"
          isActive={currentPage === "Admin"}
          onClick={() => navigateTo("Admin")}
          testId="nav-admin"
        />
      </div>

      <AddMentorDialog open={addMentorOpen} onOpenChange={setAddMentorOpen} />
      <AddChannelCollectionDialog
        open={addChannelCollectionOpen}
        onOpenChange={setAddChannelCollectionOpen}
      />
      <AddTopicDialog    open={addTopicOpen}    onOpenChange={setAddTopicOpen}    />
      <AddCategoryDialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen} />

      {/* Edit topic dialog */}
      <EditTopicDialog
        topic={editingTopic}
        onClose={() => setEditingTopic(null)}
      />
    </aside>
  );
}

// ── Edit Topic Dialog ─────────────────────────────────────────────────────
function EditTopicDialog({ topic, onClose }) {
  const [name, setName]   = useState("");
  const updateTopic       = useUpdateTopic();

  // Sync name when topic changes
  useEffect(() => { setName(topic?.name || ""); }, [topic]);

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      await updateTopic.mutateAsync({ id: topic.id, name: name.trim() });
      onClose();
    } catch (err) {
      console.error("[EditTopicDialog]", err);
    }
  };

  return (
    <Dialog open={!!topic} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-sm border-zinc-800 bg-zinc-950 text-white" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-white">
            עריכת נושא
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">שם הנושא</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              autoFocus
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition"
            />
          </div>
          <div className="flex gap-2 justify-start pt-1">
            <button
              onClick={handleSave}
              disabled={updateTopic.isPending || !name.trim()}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-500 disabled:opacity-50 transition-colors"
            >
              {updateTopic.isPending ? "שומר..." : "שמור"}
            </button>
            <button
              onClick={onClose}
              disabled={updateTopic.isPending}
              className="px-4 py-2 text-sm text-zinc-300 rounded-xl hover:bg-zinc-800 transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NavButton({ icon: Icon, label, badge, isActive, onClick, iconFilled, testId }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "w-full flex flex-row-reverse items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-medium transition-colors",
        isActive
          ? "border border-slate-200 bg-slate-100 text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", iconFilled && "fill-current")} />
      <span className="flex-1 text-right">{label}</span>
      {badge != null && (
        <span className="min-w-[20px] rounded-full bg-slate-200 px-1.5 py-0.5 text-center text-xs text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
          {badge}
        </span>
      )}
    </button>
  );
}
