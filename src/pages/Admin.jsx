import { useState, useCallback, useEffect } from "react";
import { Bot, TrendingUp, Pencil, Trash2, Globe, Youtube, Rss, Hash, RefreshCw, CheckCircle2, XCircle, Loader2, AlertTriangle, Code, GripVertical, ChevronsUp } from "lucide-react";
import { useMentors, useDeleteMentor, useUpdateMentor } from "@/hooks/useMentors";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSources } from "@/hooks/useSources";
import { useTopics, useUpdateTopic, useDeleteTopic } from "@/hooks/useTopics";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useVideos, useCreateVideo } from "@/hooks/useVideos";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAllChannels, CHANNEL_CONFIG } from "@/config/channelConfig";
import { fetchChannelRSS, filterNewVideos } from "@/services/rssIngestion";
import { base44 } from "@/api/base44Client";
import { Video } from "@/api/entities";

const CATEGORY_CONFIG = {
  AI: { label: "בינה מלאכותית", icon: Bot, color: "text-violet-600 bg-violet-50" },
  Markets: { label: "שוק ההון", icon: TrendingUp, color: "text-cyan-600 bg-cyan-50" },
  Dev: { label: "פיתוח", icon: Code, color: "text-blue-600 bg-blue-50" },
};

const CATEGORIES = [
  { id: "AI", name: "בינה מלאכותית ואוטומציה", description: "AI, אוטומציה, כלים טכנולוגיים", icon: Bot, color: "text-violet-600 bg-violet-50" },
  { id: "Markets", name: "שוק ההון", description: "מסחר, השקעות, ניתוח טכני", icon: TrendingUp, color: "text-cyan-600 bg-cyan-50" },
  { id: "Dev", name: "פיתוח תוכנה", description: "פיתוח, בניית אפליקציות", icon: Code, color: "text-blue-600 bg-blue-50" },
];

const SOURCE_TYPE_ICON = {
  youtube: Youtube,
  rss: Rss,
  site: Globe,
};

// ────────────────────────────────────────────
// ניהול מנטורים — מחולק לפי נושאים
// ────────────────────────────────────────────

// Returns the main topic (parentId === null) for a mentor, or null if none
function getMainTopicForMentor(mentor, topics) {
  const mainTopics = topics.filter((t) => !t.parentId);
  for (const tid of (mentor.topicIds || [])) {
    const t = topics.find((x) => x.id === tid);
    if (!t) continue;
    if (!t.parentId) return t; // it's already a main topic
    const parent = mainTopics.find((x) => x.id === t.parentId);
    if (parent) return parent;
  }
  return null;
}

const SECTION_COLORS = {
  violet: { header: "bg-violet-50 border-violet-100", badge: "bg-violet-100 text-violet-700" },
  cyan:   { header: "bg-cyan-50 border-cyan-100",     badge: "bg-cyan-100 text-cyan-700"   },
  blue:   { header: "bg-blue-50 border-blue-100",     badge: "bg-blue-100 text-blue-700"   },
  amber:  { header: "bg-amber-50 border-amber-100",   badge: "bg-amber-100 text-amber-700" },
  gray:   { header: "bg-gray-50 border-gray-100",     badge: "bg-gray-100 text-gray-500"   },
};

function MentorsTab({ mentors, topics }) {
  const [editingMentor, setEditingMentor] = useState(null);
  const [deletingId, setDeletingId]       = useState(null);
  const deleteMentor = useDeleteMentor();

  const mainTopics = topics.filter((t) => !t.parentId);

  // Group mentors by their resolved main topic
  const assigned = new Set();
  const groups = mainTopics
    .map((topic) => {
      const ms = mentors.filter((m) => getMainTopicForMentor(m, topics)?.id === topic.id);
      ms.forEach((m) => assigned.add(m.id));
      return { topic, mentors: ms };
    })
    .filter((g) => g.mentors.length > 0);

  const unassigned = mentors.filter((m) => !assigned.has(m.id));

  // First click → show confirm; second click → delete
  function handleDelete(id) {
    if (deletingId === id) {
      deleteMentor.mutate(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">מנטורים ({mentors.length})</h2>
      </div>

      <div className="space-y-4">
        {groups.map(({ topic, mentors: gMentors }) => (
          <MentorSection
            key={topic.id}
            title={topic.name}
            color={topic.color}
            mentors={gMentors}
            deletingId={deletingId}
            onEdit={setEditingMentor}
            onDelete={handleDelete}
            onCancelDelete={() => setDeletingId(null)}
          />
        ))}

        {unassigned.length > 0 && (
          <MentorSection
            key="unassigned"
            title="לא משויך"
            color="gray"
            mentors={unassigned}
            deletingId={deletingId}
            onEdit={setEditingMentor}
            onDelete={handleDelete}
            onCancelDelete={() => setDeletingId(null)}
          />
        )}
      </div>

      {editingMentor && (
        <EditMentorDialog
          mentor={editingMentor}
          mainTopics={mainTopics}
          onClose={() => setEditingMentor(null)}
        />
      )}
    </div>
  );
}

function MentorSection({ title, color, mentors, deletingId, onEdit, onDelete, onCancelDelete }) {
  const colors = SECTION_COLORS[color] || SECTION_COLORS.gray;
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${colors.header}`}>
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>
          {mentors.length}
        </span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {mentors.map((mentor, i) => (
            <tr
              key={mentor.id}
              className={`border-b border-gray-50 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
            >
              {/* Name + description */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold shrink-0">
                    {mentor.name?.[0]?.toUpperCase()}
                  </span>
                  <div>
                    <p className="font-medium text-gray-800">{mentor.name}</p>
                    {mentor.description && (
                      <p className="text-xs text-gray-400 truncate max-w-[220px]">{mentor.description}</p>
                    )}
                  </div>
                </div>
              </td>
              {/* Active status */}
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  mentor.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {mentor.active ? "פעיל" : "מושבת"}
                </span>
              </td>
              {/* Actions */}
              <td className="px-4 py-3">
                {deletingId === mentor.id ? (
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-xs text-red-600">למחוק?</span>
                    <button
                      onClick={() => onDelete(mentor.id)}
                      className="text-xs px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                    >
                      מחק
                    </button>
                    <button
                      onClick={onCancelDelete}
                      className="text-xs px-2 py-1 border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      בטל
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onEdit(mentor)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(mentor.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Dialog לעריכת מנטור קיים
function EditMentorDialog({ mentor, mainTopics, onClose }) {
  const updateMentor = useUpdateMentor();
  const [form, setForm] = useState({
    name:     mentor.name || "",
    active:   mentor.active ?? true,
    topicIds: mentor.topicIds || [],
  });

  function toggleTopic(tid) {
    setForm((prev) => ({
      ...prev,
      topicIds: prev.topicIds.includes(tid)
        ? prev.topicIds.filter((id) => id !== tid)
        : [...prev.topicIds, tid],
    }));
  }

  function handleSave() {
    updateMentor.mutate({ id: mentor.id, ...form }, { onSuccess: onClose });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>עריכת מנטור</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">שם</label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm text-gray-700">מנטור פעיל</span>
          </label>

          {/* Topic assignment */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">שיוך לנושאים</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {mainTopics.map((topic) => (
                <label key={topic.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.topicIds.includes(topic.id)}
                    onChange={() => toggleTopic(topic.id)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">{topic.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              בטל
            </button>
            <button
              onClick={handleSave}
              disabled={updateMentor.isPending}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {updateMentor.isPending ? "שומר..." : "שמור"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────
// ניהול קטגוריות
// ────────────────────────────────────────────
function CategoriesTab({ mentors }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">קטגוריות</h2>
        <button className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">
          + הוסף קטגוריה
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const count = mentors.filter((m) => m.category === cat.id).length;
          return (
            <div key={cat.id} className="border border-gray-100 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className={`p-2 rounded-lg ${cat.color}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex items-center gap-1">
                  <button className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-800 mb-1">{cat.name}</h3>
              <p className="text-xs text-gray-400 mb-3">{cat.description}</p>
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">{count}</span> מנטורים
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// ניהול מקורות
// ────────────────────────────────────────────
function SourcesTab({ sources, mentors }) {
  const getMentorName = (mentorId) => mentors.find((m) => m.id === mentorId)?.name || "לא ידוע";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">מקורות ({sources.length})</h2>
        <button className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">
          + הוסף מקור
        </button>
      </div>

      {sources.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-xl p-10 text-center">
          <p className="text-sm text-gray-400">אין מקורות מוגדרים</p>
          <p className="text-xs text-gray-300 mt-1">הוסף ערוץ YouTube או RSS כדי להתחיל</p>
        </div>
      ) : (
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-right px-4 py-3 text-gray-500 font-medium">סוג</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">URL</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">מנטור</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">סטטוס</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sources.map((source, i) => {
                const Icon = SOURCE_TYPE_ICON[source.sourceType] || Globe;
                return (
                  <tr key={source.id} className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Icon className="h-4 w-4" />
                        <span className="capitalize">{source.sourceType}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[260px]">
                      <span className="text-xs text-gray-500 truncate block">{source.sourceUrl}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-700">{getMentorName(source.mentorId)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        source.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {source.active ? "פעיל" : "מושבת"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
// ניהול נושאים
// ────────────────────────────────────────────
const TOPIC_COLOR_MAP = {
  violet: "bg-violet-100 text-violet-700",
  orange: "bg-orange-100 text-orange-700",
  cyan: "bg-cyan-100 text-cyan-700",
  emerald: "bg-emerald-100 text-emerald-700",
  rose: "bg-rose-100 text-rose-700",
  amber: "bg-amber-100 text-amber-700",
};

// Emoji map by topic name
const TOPIC_EMOJI = {
  "מוזיקה":              "🎶",
  "מנופים":              "🏗️",
  "סוכר":                "🍬",
  "בריאות":              "🏥",
  "פוליטיקה":            "🏛️",
  "פוליטיקה ותוכן ישר":  "🏛️",
  "אוכל ובישול":         "🍳",
  "אוכל":                "🍳",
  "אוטומציה":            "⚙️",
  "בינה מלאכותית":       "🤖",
  "שוק ההון":            "📈",
  "פיתוח תוכנה":         "💻",
  "מסחר":                "📊",
  "השקעות":              "💰",
  "ניתוח טכני":          "📉",
  "ניתוח פונדמנטלי":     "🔍",
  "מניות":               "📋",
  "כלים וטכנולוגיות":    "🔧",
  "בניית אפליקציות":     "📱",
  "שיווק דיגיטלי":       "📣",
  "פודקאסטים":           "🎙️",
};

// LocalStorage helpers for topic order (client-side persistence)
const ORDER_KEY = "ym_topic_order";
function loadOrder() { try { return JSON.parse(localStorage.getItem(ORDER_KEY)); } catch { return null; } }
function saveOrder(ids) { localStorage.setItem(ORDER_KEY, JSON.stringify(ids)); }
function applyStoredOrder(topics) {
  const stored = loadOrder();
  if (!stored || !stored.length) return topics;
  const map = Object.fromEntries(topics.map((t) => [t.id, t]));
  const sorted = stored.map((id) => map[id]).filter(Boolean);
  const newOnes = topics.filter((t) => !stored.includes(t.id));
  return [...sorted, ...newOnes];
}

// Sortable row for DnD
function SortableTopicRow({ topic, videoCount, deletingId, onEdit, onDelete, onCancelDelete, onMoveToTop }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: topic.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const colorClass = TOPIC_COLOR_MAP[topic.color] || TOPIC_COLOR_MAP.violet;
  const emoji = TOPIC_EMOJI[topic.name];

  return (
    <tr ref={setNodeRef} style={style} className="border-b border-gray-50 last:border-0 bg-white">
      {/* Drag handle */}
      <td className="pl-3 pr-1 py-3 w-8">
        <button
          {...attributes} {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-0.5 rounded touch-none"
          title="גרור לשינוי סדר"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      {/* Name + emoji */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded flex items-center justify-center text-sm leading-none shrink-0 ${colorClass}`}>
            {emoji || <Hash className="h-3.5 w-3.5" />}
          </span>
          <div>
            <span className="font-medium text-gray-800">{topic.name}</span>
            {!topic.parentId && (
              <span className="mr-1.5 text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full">ראשי</span>
            )}
          </div>
        </div>
      </td>
      {/* Description */}
      <td className="px-3 py-3 max-w-[200px]">
        <span className="text-xs text-gray-500 line-clamp-2">{topic.description}</span>
      </td>
      {/* Videos count */}
      <td className="px-3 py-3">
        <span className="text-sm font-medium text-gray-700">{videoCount}</span>
      </td>
      {/* Actions */}
      <td className="px-3 py-3">
        {deletingId === topic.id ? (
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-xs text-red-600">למחוק?</span>
            <button onClick={() => onDelete(topic.id)} className="text-xs px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">מחק</button>
            <button onClick={onCancelDelete} className="text-xs px-2 py-1 border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 transition-colors">בטל</button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-0.5">
            <button onClick={() => onMoveToTop(topic.id)} title="העבר לראש הרשימה" className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">
              <ChevronsUp className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onEdit(topic)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onDelete(topic.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// Dialog לעריכת נושא
function EditTopicDialog({ topic, onClose }) {
  const updateTopic = useUpdateTopic();
  const [form, setForm] = useState({
    name:           topic.name || "",
    description:    topic.description || "",
    color:          topic.color || "violet",
    isMainCategory: topic.isMainCategory ?? false,
  });

  const colorOptions = ["violet", "cyan", "blue", "emerald", "rose", "amber", "orange"];

  function handleSave() {
    updateTopic.mutate({ id: topic.id, ...form }, { onSuccess: onClose });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>עריכת נושא</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">שם</label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">תיאור</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">צבע</label>
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm((p) => ({ ...p, color: c }))}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border-2 ${
                    form.color === c ? "border-indigo-500" : "border-transparent"
                  } ${TOPIC_COLOR_MAP[c] || TOPIC_COLOR_MAP.violet}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isMainCategory}
              onChange={(e) => setForm((p) => ({ ...p, isMainCategory: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm text-gray-700">קטגוריה ראשית</span>
          </label>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">בטל</button>
            <button onClick={handleSave} disabled={updateTopic.isPending} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {updateTopic.isPending ? "שומר..." : "שמור"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TopicsTab({ topics, videos }) {
  const [orderedTopics, setOrderedTopics] = useState(() => applyStoredOrder(topics));
  const [editingTopic, setEditingTopic]   = useState(null);
  const [deletingId, setDeletingId]       = useState(null);
  const deleteTopic = useDeleteTopic();

  // Sync when topics change from server (new topic added, etc.)
  useEffect(() => {
    setOrderedTopics((prev) => {
      const prevIds = prev.map((t) => t.id);
      const newMap = Object.fromEntries(topics.map((t) => [t.id, t]));
      const updated = prev.map((t) => newMap[t.id] || t);
      const added = topics.filter((t) => !prevIds.includes(t.id));
      return [...updated, ...added];
    });
  }, [topics]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    setOrderedTopics((prev) => {
      const oldIndex = prev.findIndex((t) => t.id === active.id);
      const newIndex = prev.findIndex((t) => t.id === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      saveOrder(next.map((t) => t.id));
      return next;
    });
  }

  function handleMoveToTop(id) {
    setOrderedTopics((prev) => {
      const i = prev.findIndex((t) => t.id === id);
      if (i <= 0) return prev;
      const next = [prev[i], ...prev.slice(0, i), ...prev.slice(i + 1)];
      saveOrder(next.map((t) => t.id));
      return next;
    });
  }

  function handleDelete(id) {
    if (deletingId === id) {
      deleteTopic.mutate(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
    }
  }

  const getVideoCount = (topicId) =>
    videos.filter((v) => (v.topicIds || []).includes(topicId)).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">נושאים ({orderedTopics.length})</h2>
          <p className="text-xs text-gray-400 mt-0.5">גרור את ⠿ לשינוי סדר — הסדר נשמר בדפדפן</p>
        </div>
      </div>

      {orderedTopics.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-xl p-10 text-center">
          <p className="text-sm text-gray-400">אין נושאים מוגדרים</p>
          <p className="text-xs text-gray-300 mt-1">הוסף נושא כדי לארגן סרטונים</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedTopics.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-right">
                    <th className="w-8 px-2 py-3" />
                    <th className="px-3 py-3 text-gray-500 font-medium">נושא</th>
                    <th className="px-3 py-3 text-gray-500 font-medium">תיאור</th>
                    <th className="px-3 py-3 text-gray-500 font-medium">סרטונים</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {orderedTopics.map((topic) => (
                    <SortableTopicRow
                      key={topic.id}
                      topic={topic}
                      videoCount={getVideoCount(topic.id)}
                      deletingId={deletingId}
                      onEdit={setEditingTopic}
                      onDelete={handleDelete}
                      onCancelDelete={() => setDeletingId(null)}
                      onMoveToTop={handleMoveToTop}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </SortableContext>
        </DndContext>
      )}

      {editingTopic && (
        <EditTopicDialog topic={editingTopic} onClose={() => setEditingTopic(null)} />
      )}
    </div>
  );
}

// ────────────────────────────────────────────
// RSS Ingestion Tab
// ────────────────────────────────────────────

// Status badge per channel
function ChannelStatus({ status, channelId }) {
  if (!status) return null;

  if (status.state === "loading")
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        מושך 5 סרטונים...
      </span>
    );

  if (status.state === "success")
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {status.saved} חדשים | {status.skipped} קיימים
      </span>
    );

  if (status.state === "error") {
    // Extract URL from error message if present
    const urlMatch = status.error?.match(/URL: (https?:\/\/\S+)/);
    const rssUrl = urlMatch?.[1] ?? (channelId ? `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}` : null);
    return (
      <div className="space-y-0.5">
        <span className="flex items-center gap-1 text-xs text-red-600">
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2">{status.error?.split('\nURL:')[0]}</span>
        </span>
        {rssUrl && (
          <a
            href={rssUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline block truncate"
            title={rssUrl}
          >
            בדוק URL ידנית ↗
          </a>
        )}
      </div>
    );
  }

  return null;
}

function RssTab({ videos }) {
  const [channels, setChannels] = useState(getAllChannels);
  const configuredCount = channels.filter((c) => c.isConfigured).length;
  const createVideo = useCreateVideo();

  // { [mentorId]: { state, saved, skipped, error, preview } }
  const [statuses, setStatuses] = useState({});
  const [globalLoading, setGlobalLoading] = useState(false);
  const [resolving, setResolving] = useState({}); // { [mentorId]: true/false }

  const setChannelStatus = useCallback((mentorId, update) => {
    setStatuses((prev) => ({ ...prev, [mentorId]: { ...prev[mentorId], ...update } }));
  }, []);

  // ── Resolve a single channel handle → channelId via Vite dev server ──────
  async function handleResolve(mentorId) {
    const ch = CHANNEL_CONFIG[mentorId];
    const handle = ch.handle || ch.name;
    setResolving((prev) => ({ ...prev, [mentorId]: "loading" }));
    try {
      const res = await fetch(`/api/resolve-channel?handle=${encodeURIComponent('@' + handle.replace(/^@/, ''))}`);
      const data = await res.json();
      if (data.channelId) {
        // Update the live config object (runtime only — persists in channelConfig.js manually)
        CHANNEL_CONFIG[mentorId].channelId = data.channelId;
        setChannels(getAllChannels());
        setResolving((prev) => ({ ...prev, [mentorId]: "success" }));
      } else {
        setResolving((prev) => ({ ...prev, [mentorId]: "notfound" }));
      }
    } catch {
      setResolving((prev) => ({ ...prev, [mentorId]: "error" }));
    }
  }

  // ── Resolve all unconfigured channels ─────────────────────────────────────
  async function handleResolveAll() {
    const unconfigured = channels.filter((c) => !c.isConfigured);
    for (const ch of unconfigured) {
      await handleResolve(ch.mentorId);
    }
  }

  // Fetch preview only (no save)
  async function handlePreview(mentorId) {
    setChannelStatus(mentorId, { state: "loading", preview: null });
    try {
      const incoming = await fetchChannelRSS(mentorId);
      const toSave = filterNewVideos(incoming, videos);
      setChannelStatus(mentorId, { state: "success", saved: 0, skipped: incoming.length - toSave.length, preview: toSave });
    } catch (err) {
      setChannelStatus(mentorId, { state: "error", error: err.message });
    }
  }

  // Save previewed videos to Base44, then enrich with duration + viewCount
  async function handleImport(mentorId) {
    const preview = statuses[mentorId]?.preview;
    if (!preview?.length) return;
    setChannelStatus(mentorId, { state: "loading" });
    try {
      let saved = 0;
      const savedMap = []; // [{ base44Id, youtubeId }]

      for (const record of preview) {
        const { _videoId, _channelName, ...videoData } = record;
        const created = await createVideo.mutateAsync(videoData);
        if (created?.id && _videoId) {
          savedMap.push({ base44Id: created.id, youtubeId: _videoId });
        }
        saved++;
      }

      // Enrich with duration + viewCount from YouTube API
      if (savedMap.length > 0) {
        try {
          const youtubeIds = savedMap.map((v) => v.youtubeId);
          const stats = await base44.functions.fetchVideoStats({ videoIds: youtubeIds });
          for (const { base44Id, youtubeId } of savedMap) {
            const s = stats?.[youtubeId];
            if (s?.duration || s?.viewCount) {
              await Video.update(base44Id, {
                ...(s.duration   && { duration: s.duration }),
                ...(s.viewCount  && { viewCount: s.viewCount }),
              });
            }
          }
        } catch (e) {
          console.warn('[FetchVideoStats] failed:', e.message);
        }
      }

      setChannelStatus(mentorId, { state: "success", saved, skipped: statuses[mentorId]?.skipped ?? 0, preview: null });
    } catch (err) {
      setChannelStatus(mentorId, { state: "error", error: "שגיאה בשמירה — " + err.message });
    }
  }

  // Fetch all configured channels
  async function handleFetchAll() {
    const configured = channels.filter((c) => c.isConfigured);
    if (!configured.length) return;
    setGlobalLoading(true);
    for (const ch of configured) {
      await handlePreview(ch.mentorId);
    }
    setGlobalLoading(false);
  }

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-gray-800">משיכת RSS מיוטיוב</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {configuredCount} מתוך {channels.length} ערוצים מוגדרים עם Channel ID
          </p>
        </div>
        <div className="flex items-center gap-2">
          {configuredCount < channels.length && (
            <button
              onClick={handleResolveAll}
              className="flex items-center gap-1.5 text-sm border border-indigo-300 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              <Hash className="h-3.5 w-3.5" />
              זהה Channel IDs
            </button>
          )}
          <button
            onClick={handleFetchAll}
            disabled={globalLoading || configuredCount === 0}
            className="flex items-center gap-1.5 text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${globalLoading ? "animate-spin" : ""}`} />
            משוך את כולם
          </button>
        </div>
      </div>

      {/* Missing channel IDs notice */}
      {configuredCount < channels.length && (
        <div className="mb-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-700">
            <p className="font-medium mb-0.5">{channels.length - configuredCount} ערוצים ממתינים ל-Channel ID</p>
            <p>ערוך <code className="bg-amber-100 px-1 rounded">src/config/channelConfig.js</code> והוסף את ה-Channel ID של כל ערוץ כדי לאפשר משיכת סרטונים.</p>
            <p className="mt-1 text-amber-600">כיצד למצוא Channel ID: כנס לדף הערוץ ← View Page Source ← חפש "channelId"</p>
          </div>
        </div>
      )}

      {/* Channel list */}
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-right">
              <th className="px-4 py-3 text-gray-500 font-medium">ערוץ</th>
              <th className="px-4 py-3 text-gray-500 font-medium">קטגוריה</th>
              <th className="px-4 py-3 text-gray-500 font-medium">Channel ID</th>
              <th className="px-4 py-3 text-gray-500 font-medium">זיהוי</th>
              <th className="px-4 py-3 text-gray-500 font-medium">סטטוס RSS</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {channels.map((ch, i) => {
              const catCfg = CATEGORY_CONFIG[ch.category];
              const CatIcon = catCfg?.icon;
              const status = statuses[ch.mentorId];
              const hasPreview = status?.preview?.length > 0;

              return (
                <tr key={ch.mentorId} className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                  {/* Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {ch.name?.[0]?.toUpperCase()}
                      </span>
                      <span className="font-medium text-gray-800 text-right">{ch.name}</span>
                    </div>
                  </td>
                  {/* Category */}
                  <td className="px-4 py-3">
                    {catCfg && (
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${catCfg.color}`}>
                        {CatIcon && <CatIcon className="h-3 w-3" />}
                        {catCfg.label}
                      </span>
                    )}
                  </td>
                  {/* Channel ID status */}
                  <td className="px-4 py-3">
                    {ch.isConfigured ? (
                      <span className="font-mono text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        {CHANNEL_CONFIG[ch.mentorId].channelId?.slice(0, 12)}…
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  {/* Resolve button */}
                  <td className="px-4 py-3">
                    {ch.isConfigured ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        נמצא
                      </span>
                    ) : resolving[ch.mentorId] === "loading" ? (
                      <span className="flex items-center gap-1 text-xs text-amber-600">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        מזהה...
                      </span>
                    ) : resolving[ch.mentorId] === "notfound" ? (
                      <span className="flex items-center gap-1 text-xs text-red-500">
                        <XCircle className="h-3.5 w-3.5" />
                        לא נמצא
                      </span>
                    ) : resolving[ch.mentorId] === "error" ? (
                      <span className="flex items-center gap-1 text-xs text-red-500">
                        <XCircle className="h-3.5 w-3.5" />
                        שגיאה
                      </span>
                    ) : (
                      <button
                        onClick={() => handleResolve(ch.mentorId)}
                        className="text-xs px-2 py-0.5 border border-gray-200 text-gray-500 rounded hover:bg-gray-50 transition-colors"
                      >
                        זהה
                      </button>
                    )}
                  </td>
                  {/* Ingestion status */}
                  <td className="px-4 py-3">
                    <ChannelStatus status={status} channelId={CHANNEL_CONFIG[ch.mentorId]?.channelId} />
                    {hasPreview && (
                      <p className="text-xs text-indigo-600 mt-0.5">{status.preview.length} סרטונים חדשים מוכנים לייבוא</p>
                    )}
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {hasPreview && (
                        <button
                          onClick={() => handleImport(ch.mentorId)}
                          disabled={status?.state === "loading"}
                          className="text-xs px-2.5 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                          שמור ({status.preview.length})
                        </button>
                      )}
                      <button
                        onClick={() => handlePreview(ch.mentorId)}
                        disabled={!ch.isConfigured || status?.state === "loading"}
                        className="text-xs px-2.5 py-1 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {status?.state === "loading" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : "בדוק"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Preview panel */}
      {Object.values(statuses).some((s) => s?.preview?.length) && (
        <div className="mt-4 border border-indigo-100 rounded-xl overflow-hidden">
          <div className="bg-indigo-50 px-4 py-2.5 border-b border-indigo-100">
            <p className="text-xs font-semibold text-indigo-700">תצוגה מקדימה — סרטונים חדשים שימשכו</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {Object.entries(statuses)
              .filter(([, s]) => s?.preview?.length)
              .flatMap(([, s]) => s.preview)
              .map((video) => (
                <div key={video._videoId} className="flex items-center gap-3 px-4 py-2.5 flex-row-reverse">
                  <img
                    src={video.thumbnail}
                    alt=""
                    className="w-16 h-10 object-cover rounded-md bg-gray-100 shrink-0"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div className="flex-1 text-right min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{video.title}</p>
                    <p className="text-xs text-gray-400">{video._channelName} · {video.publishedAt?.slice(0, 10)}</p>
                  </div>
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                  >
                    <Youtube className="h-4 w-4 text-gray-300 hover:text-red-500 transition-colors" />
                  </a>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
// Admin Page
// ────────────────────────────────────────────
export default function Admin() {
  const { data: mentors = [] } = useMentors();
  const { data: sources = [] } = useSources();
  const { data: topics = [] } = useTopics();
  const { data: videos = [] } = useVideos();

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">ניהול</h1>
          <p className="text-sm text-gray-500 mt-0.5">ניהול מנטורים, קטגוריות, נושאים ומקורות</p>
        </div>

        <Tabs defaultValue="rss" dir="rtl">
          <TabsList className="mb-6 bg-white border border-gray-100 p-1 rounded-lg">
            <TabsTrigger value="rss" className="text-sm flex items-center gap-1.5">
              <Rss className="h-3.5 w-3.5" />
              משיכת RSS
            </TabsTrigger>
            <TabsTrigger value="mentors" className="text-sm">ערוצים</TabsTrigger>
            <TabsTrigger value="topics" className="text-sm">נושאים</TabsTrigger>
            <TabsTrigger value="categories" className="text-sm">קטגוריות</TabsTrigger>
            <TabsTrigger value="sources" className="text-sm">מקורות</TabsTrigger>
          </TabsList>

          <TabsContent value="rss">
            <RssTab videos={videos} />
          </TabsContent>
          <TabsContent value="mentors">
            <MentorsTab mentors={mentors} topics={topics} />
          </TabsContent>
          <TabsContent value="topics">
            <TopicsTab topics={topics} videos={videos} />
          </TabsContent>
          <TabsContent value="categories">
            <CategoriesTab mentors={mentors} />
          </TabsContent>
          <TabsContent value="sources">
            <SourcesTab sources={sources} mentors={mentors} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
