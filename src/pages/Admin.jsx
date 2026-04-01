import { useState, useCallback } from "react";
import { Bot, TrendingUp, Pencil, Trash2, Globe, Youtube, Rss, Hash, RefreshCw, CheckCircle2, XCircle, Loader2, AlertTriangle, Code, ChevronsUp } from "lucide-react";
import { TOPIC_ICON_MAP, getTopicConfig, CATEGORY_CONFIG, getCategoryCodeForTopicName } from "@/config/topicConfig";
import { useMentors, useUpdateMentor, useDeleteMentor } from "@/hooks/useMentors";
import { useTopics, useUpdateTopic, useDeleteTopic } from "@/hooks/useTopics";
import { useSources, useUpdateSource, useCreateSource } from "@/hooks/useSources";
import { useVideos, useCreateVideo } from "@/hooks/useVideos";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchChannelRSSFromSource,
  extractChannelIdFromUrl,
  extractHandleFromUrl,
  filterNewVideos,
} from "@/services/rssIngestion";
import { base44 } from "@/api/base44Client";
import { Video } from "@/api/entities";


const SOURCE_TYPE_ICON = {
  youtube: Youtube,
  rss: Rss,
  site: Globe,
};

// ────────────────────────────────────────────
// ניהול מנטורים
// ────────────────────────────────────────────
function EditMentorDialog({ mentor, topics, onClose }) {
  const [form, setForm] = useState({ name: mentor.name, active: mentor.active ?? true, topicIds: mentor.topicIds || [] });
  const updateMentor = useUpdateMentor();
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const toggleTopic = (id) => set("topicIds", form.topicIds.includes(id) ? form.topicIds.filter((t) => t !== id) : [...form.topicIds, id]);

  const handleSave = async () => {
    await updateMentor.mutateAsync({ id: mentor.id, name: form.name, active: form.active, topicIds: form.topicIds });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-80 space-y-4" onClick={(e) => e.stopPropagation()} dir="rtl">
        <h3 className="text-base font-semibold text-gray-900">עריכת מנטור</h3>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">שם</label>
          <input value={form.name} onChange={(e) => set("name", e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
          <span className="text-sm text-gray-700">פעיל</span>
        </label>
        {topics.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">נושאים</label>
            <div className="flex flex-wrap gap-1.5">
              {topics.map((t) => (
                <button key={t.id} onClick={() => toggleTopic(t.id)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    form.topicIds.includes(t.id) ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={updateMentor.isPending}
            className="flex-1 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {updateMentor.isPending ? "שומר..." : "שמור"}
          </button>
          <button onClick={onClose} className="flex-1 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">ביטול</button>
        </div>
      </div>
    </div>
  );
}

function MentorRow({ mentor, topics }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteMentor = useDeleteMentor();
  const cat = CATEGORY_CONFIG[mentor.category];
  const Icon = cat?.icon;

  return (
    <>
      <tr className="border-b border-gray-50 hover:bg-gray-50/50">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold shrink-0">
              {mentor.name?.[0]?.toUpperCase()}
            </span>
            <span className="font-medium text-gray-800 text-sm">{mentor.name}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          {cat ? (
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cat.color}`}>
              {Icon && <Icon className="h-3 w-3" />}{cat.label}
            </span>
          ) : mentor.category ? (
            <span className="text-xs text-gray-500">{mentor.category}</span>
          ) : null}
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${
            mentor.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
          }`}>
            {mentor.active ? "פעיל" : "מושבת"}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            {confirmDelete ? (
              <>
                <span className="text-xs text-red-600 ml-1">למחוק?</span>
                <button onClick={() => deleteMentor.mutate(mentor.id)}
                  className="text-xs px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700">כן</button>
                <button onClick={() => setConfirmDelete(false)}
                  className="text-xs px-2 py-0.5 border border-gray-200 text-gray-500 rounded hover:bg-gray-50">לא</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setConfirmDelete(true)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {editing && <EditMentorDialog mentor={mentor} topics={topics} onClose={() => setEditing(false)} />}
    </>
  );
}

function MentorGroup({ label, mentors, topics }) {
  if (!mentors.length) return null;
  return (
    <div className="mb-5">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1.5">{label} ({mentors.length})</h3>
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {mentors.map((m) => <MentorRow key={m.id} mentor={m} topics={topics} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MentorsTab({ mentors, topics }) {
  const mainTopics = topics.filter((t) => !t.parentId);

  // Group mentors by topic
  const groups = mainTopics.map((topic) => ({
    label: topic.name,
    mentors: mentors.filter((m) => m.topicIds?.includes(topic.id) || (
      // fallback: category match
      !m.topicIds?.length && m.category &&
      (topic.name.includes(m.category) || m.category.toLowerCase() === topic.name.toLowerCase())
    )),
  }));

  const assignedIds = new Set(groups.flatMap((g) => g.mentors.map((m) => m.id)));
  const unassigned = mentors.filter((m) => !assignedIds.has(m.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">מנטורים ({mentors.length})</h2>
      </div>
      {groups.map((g) => <MentorGroup key={g.label} label={g.label} mentors={g.mentors} topics={mainTopics} />)}
      <MentorGroup label="לא משויך" mentors={unassigned} topics={mainTopics} />
    </div>
  );
}

// ────────────────────────────────────────────
// ניהול קטגוריות
// ────────────────────────────────────────────
function CategoriesTab({ mentors }) {
  const CATEGORIES = Object.entries(CATEGORY_CONFIG).map(([id, cfg]) => ({ id, ...cfg }));
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
  blue: "bg-blue-100 text-blue-700",
};

const TOPIC_ICONS = Object.keys(TOPIC_ICON_MAP);

function EditTopicDialog({ topic, onClose }) {
  const [form, setForm] = useState({ name: topic.name, description: topic.description || "", icon: topic.icon || "", color: topic.color || "violet" });
  const updateTopic = useUpdateTopic();
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    await updateTopic.mutateAsync({ id: topic.id, ...form });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-80 space-y-4" onClick={(e) => e.stopPropagation()} dir="rtl">
        <h3 className="text-base font-semibold text-gray-900">עריכת נושא</h3>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">שם</label>
          <input value={form.name} onChange={(e) => set("name", e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">תיאור</label>
          <input value={form.description} onChange={(e) => set("description", e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">איקון</label>
          <div className="flex flex-wrap gap-1.5">
            {TOPIC_ICONS.map((name) => {
              const Icon = TOPIC_ICON_MAP[name];
              return (
                <button key={name} onClick={() => set("icon", name)} title={name}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    form.icon === name ? "bg-indigo-100 ring-2 ring-indigo-400" : "hover:bg-gray-100"
                  }`}>
                  <Icon className="h-4 w-4 text-gray-600" />
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={updateTopic.isPending}
            className="flex-1 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {updateTopic.isPending ? "שומר..." : "שמור"}
          </button>
          <button onClick={onClose} className="flex-1 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">ביטול</button>
        </div>
      </div>
    </div>
  );
}

function TopicsTab({ topics, videos }) {
  const [orderedTopics, setOrderedTopics] = useState(topics);
  const [editingTopic, setEditingTopic] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const updateTopic = useUpdateTopic();
  const deleteTopic = useDeleteTopic();

  // Sync when topics prop changes (initial load)
  if (orderedTopics.length === 0 && topics.length > 0) setOrderedTopics(topics);

  const getVideoCount = (topicId) => videos.filter((v) => (v.topicIds || []).includes(topicId)).length;

  const handleMoveToTop = (topic) => {
    const items = [topic, ...orderedTopics.filter((t) => t.id !== topic.id)];
    setOrderedTopics(items);
    items.forEach((t, i) => updateTopic.mutate({ id: t.id, sortOrder: i }));
  };

  const displayTopics = orderedTopics.length ? orderedTopics : topics;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">נושאים ({displayTopics.length})</h2>
        <p className="text-xs text-gray-400">גרור לשינוי סדר</p>
      </div>

      {displayTopics.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-xl p-10 text-center">
          <p className="text-sm text-gray-400">אין נושאים מוגדרים</p>
        </div>
      ) : (
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-right px-4 py-3 text-gray-500 font-medium">נושא</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium">תיאור</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium">סרטונים</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
          <tbody>
              {displayTopics.map((topic, i) => {
                 const colorClass = TOPIC_COLOR_MAP[topic.color] || TOPIC_COLOR_MAP.violet;
                 const topicCfg = getTopicConfig(topic.name);
                 const isConfirmDelete = confirmDeleteId === topic.id;
                return (
                  <tr key={topic.id} className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`p-1 rounded ${colorClass}`}>
                          {(() => { const I = TOPIC_ICON_MAP[topic.icon]; return I ? <I className="h-3.5 w-3.5" /> : <Hash className="h-3.5 w-3.5" />; })()}
                        </span>
                        <span className="font-medium text-gray-800">{topic.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">{topic.description}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-700">{getVideoCount(topic.id)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isConfirmDelete ? (
                          <>
                            <span className="text-xs text-red-600">למחוק?</span>
                            <button onClick={() => { deleteTopic.mutate(topic.id); setConfirmDeleteId(null); }}
                              className="text-xs px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700">כן</button>
                            <button onClick={() => setConfirmDeleteId(null)}
                              className="text-xs px-2 py-0.5 border border-gray-200 text-gray-500 rounded hover:bg-gray-50">לא</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleMoveToTop(topic)} title="העבר לראש"
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">
                              <ChevronsUp className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setEditingTopic(topic)}
                              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setConfirmDeleteId(topic.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editingTopic && <EditTopicDialog topic={editingTopic} onClose={() => setEditingTopic(null)} />}
    </div>
  );
}

// ────────────────────────────────────────────
// RSS Ingestion Tab
// ────────────────────────────────────────────

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
    const urlMatch = status.error?.match(/URL: (https?:\/\/\S+)/);
    const rssUrl = urlMatch?.[1] ?? (channelId ? `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}` : null);
    return (
      <div className="space-y-0.5">
        <span className="flex items-center gap-1 text-xs text-red-600">
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2">{status.error?.split('\nURL:')[0]}</span>
        </span>
        {rssUrl && (
          <a href={rssUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline block truncate" title={rssUrl}>
            בדוק URL ידנית ↗
          </a>
        )}
      </div>
    );
  }

  return null;
}

function RssTab({ videos, mentors = [], sources = [], topics = [] }) {
  // Build channel list from real DB data (Mentor + Source entities)
  const channels = mentors.map((mentor) => {
    const source = sources.find((s) => s.mentorId === mentor.id && s.sourceType === "youtube");
    const channelId = extractChannelIdFromUrl(source?.sourceUrl);
    return {
      mentorId:     mentor.id,
      name:         mentor.name,
      category:     mentor.category,
      channelId:    channelId ?? null,
      isConfigured: !!channelId,
      sourceId:     source?.id ?? null,
      sourceUrl:    source?.sourceUrl ?? null,
    };
  });

  const [statuses, setStatuses] = useState({});
  const [globalLoading, setGlobalLoading] = useState(false);
  const [resolving, setResolving] = useState({});
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [refreshResult, setRefreshResult] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const configuredCount = channels.filter((c) => c.isConfigured).length;
  const createVideo = useCreateVideo();
  const updateSource = useUpdateSource();
  const createSource = useCreateSource();
  const deleteMentor = useDeleteMentor();
  const updateMentor = useUpdateMentor();
  const mainTopics = topics.filter((t) => !t.parentId);
  const [editingTopicFor, setEditingTopicFor] = useState(null);

  const setChannelStatus = useCallback((mentorId, update) => {
    setStatuses((prev) => ({ ...prev, [mentorId]: { ...prev[mentorId], ...update } }));
  }, []);

  function extractVideoId(url) {
    if (!url) return null;
    const match = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
    return match?.[1] ?? null;
  }

  async function handleRefreshStats() {
    const missing = videos.filter((v) => !v.viewCount || !v.duration);
    if (!missing.length) {
      setRefreshResult({ updated: 0, total: 0 });
      return;
    }
    setRefreshingStats(true);
    setRefreshResult(null);
    try {
      const mapped = missing
        .map((v) => ({ base44Id: v.id, youtubeId: extractVideoId(v.url) }))
        .filter((v) => v.youtubeId);

      const youtubeIds = mapped.map((v) => v.youtubeId);
      const res = await base44.functions.invoke('fetchVideoStats', { videoIds: youtubeIds });
      const statsData = res?.data ?? res;

      let updated = 0;
      for (const { base44Id, youtubeId } of mapped) {
        const s = statsData?.[youtubeId];
        if (s?.duration || s?.viewCount) {
          await Video.update(base44Id, {
            ...(s.duration  && { duration: s.duration }),
            ...(s.viewCount && { viewCount: s.viewCount }),
          });
          updated++;
        }
      }
      setRefreshResult({ updated, total: missing.length });
    } catch (e) {
      setRefreshResult({ error: e.message });
    } finally {
      setRefreshingStats(false);
    }
  }

  // ── Resolve a single channel handle → channelId, then persist to Source entity ──
  async function handleResolve(mentorId) {
    const ch = channels.find((c) => c.mentorId === mentorId);
    // Derive handle: from @handle in sourceUrl, or fall back to mentor name
    const handle = extractHandleFromUrl(ch?.sourceUrl) ?? ch?.name ?? mentorId;
    setResolving((prev) => ({ ...prev, [mentorId]: "loading" }));
    try {
      const res = await fetch(`/api/resolve-channel?handle=${encodeURIComponent('@' + handle.replace(/^@/, ''))}`);
      const data = await res.json();
      if (data.channelId) {
        const channelUrl = `https://www.youtube.com/channel/${data.channelId}`;
        if (ch?.sourceId) {
          await updateSource.mutateAsync({ id: ch.sourceId, sourceUrl: channelUrl });
        } else {
          await createSource.mutateAsync({
            mentorId,
            sourceType: "youtube",
            sourceUrl: channelUrl,
            active: true,
          });
        }
        setResolving((prev) => ({ ...prev, [mentorId]: "success" }));
      } else {
        setResolving((prev) => ({ ...prev, [mentorId]: "notfound" }));
      }
    } catch {
      setResolving((prev) => ({ ...prev, [mentorId]: "error" }));
    }
  }

  async function handleResolveAll() {
    const unconfigured = channels.filter((c) => !c.isConfigured);
    for (const ch of unconfigured) {
      await handleResolve(ch.mentorId);
    }
  }

  // Fetch preview only (no save) — uses real DB data
  async function handlePreview(mentorId) {
    setChannelStatus(mentorId, { state: "loading", preview: null });
    try {
      const mentor = mentors.find((m) => m.id === mentorId);
      const source = sources.find((s) => s.mentorId === mentorId && s.sourceType === "youtube");
      const incoming = await fetchChannelRSSFromSource(mentor, source, topics);
      const toSave = filterNewVideos(incoming, videos);
      setChannelStatus(mentorId, { state: "success", saved: 0, skipped: incoming.length - toSave.length, preview: toSave });
    } catch (err) {
      setChannelStatus(mentorId, { state: "error", error: err.message });
    }
  }

  async function handleImport(mentorId) {
    const preview = statuses[mentorId]?.preview;
    if (!preview?.length) return;
    setChannelStatus(mentorId, { state: "loading" });
    try {
      let saved = 0;
      const savedMap = [];

      for (const record of preview) {
        const { _videoId, _channelName, ...videoData } = record;
        const created = await createVideo.mutateAsync(videoData);
        if (created?.id && _videoId) {
          savedMap.push({ base44Id: created.id, youtubeId: _videoId });
        }
        saved++;
      }

      if (savedMap.length > 0) {
        try {
          const youtubeIds = savedMap.map((v) => v.youtubeId);
          const res = await base44.functions.invoke('fetchVideoStats', { videoIds: youtubeIds });
          const stats = res?.data ?? res;
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

  async function handleTopicChange(mentorId, topicId) {
    const topic = mainTopics.find((t) => t.id === topicId);
    const categoryCode = getCategoryCodeForTopicName(topic?.name) ?? null;
    await updateMentor.mutateAsync({
      id: mentorId,
      topicIds: topicId ? [topicId] : [],
      ...(categoryCode && { category: categoryCode }),
    });
    setEditingTopicFor(null);
  }

  async function handleDeleteMentor(mentorId) {
    await deleteMentor.mutateAsync(mentorId);
    setConfirmDeleteId(null);
  }

  async function handleDeleteAll() {
    setDeletingAll(true);
    for (const ch of channels) {
      await deleteMentor.mutateAsync(ch.mentorId);
    }
    setDeletingAll(false);
    setConfirmDeleteAll(false);
  }

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
          {/* Refresh Stats button */}
          <button
            onClick={handleRefreshStats}
            disabled={refreshingStats}
            className="flex items-center gap-1.5 text-sm border border-emerald-300 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-50 disabled:opacity-50 transition-colors"
          >
            {refreshingStats ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            רענן סטטיסטיקות
          </button>

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
          {confirmDeleteAll ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-red-600">למחוק את כל {channels.length} המנטורים?</span>
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className="text-xs px-2.5 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deletingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : "כן, מחק"}
              </button>
              <button
                onClick={() => setConfirmDeleteAll(false)}
                className="text-xs px-2.5 py-1.5 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ביטול
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDeleteAll(true)}
              disabled={channels.length === 0}
              className="flex items-center gap-1.5 text-sm border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-40 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              מחק את כולם
            </button>
          )}
        </div>
      </div>

      {/* Refresh Stats result */}
      {refreshResult && (
        <div className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm ${
          refreshResult.error ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
        }`}>
          {refreshResult.error ? (
            <><XCircle className="h-4 w-4 shrink-0" /> שגיאה: {refreshResult.error}</>
          ) : (
            <><CheckCircle2 className="h-4 w-4 shrink-0" /> עודכנו {refreshResult.updated} מתוך {refreshResult.total} סרטונים חסרי סטטיסטיקות</>
          )}
        </div>
      )}

      {/* Missing channel IDs notice */}
      {configuredCount < channels.length && (
        <div className="mb-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-700">
            <p className="font-medium mb-0.5">{channels.length - configuredCount} ערוצים ממתינים ל-Channel ID</p>
            <p>לחץ <strong>זהה</strong> בשורת הערוץ לזיהוי אוטומטי, או הוסף ב-Source entity: <code className="bg-amber-100 px-1 rounded">youtube.com/channel/UCxxxxxx</code>.</p>
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
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {ch.name?.[0]?.toUpperCase()}
                      </span>
                      <span className="font-medium text-gray-800 text-right">{ch.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {editingTopicFor === ch.mentorId ? (
                      <select
                        autoFocus
                        onBlur={() => setEditingTopicFor(null)}
                        onChange={(e) => handleTopicChange(ch.mentorId, e.target.value)}
                        defaultValue={mainTopics.find((t) => getCategoryCodeForTopicName(t.name) === ch.category)?.id ?? ""}
                        className="text-xs border border-indigo-300 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                      >
                        <option value="">— ללא נושא —</option>
                        {mainTopics.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center gap-1 group">
                        {catCfg ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${catCfg.color}`}>
                            {CatIcon && <CatIcon className="h-3 w-3" />}
                            {catCfg.label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                        <button
                          onClick={() => setEditingTopicFor(ch.mentorId)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-indigo-600 rounded transition-all"
                          title="שנה נושא"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {ch.isConfigured ? (
                      <span className="font-mono text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        {ch.channelId?.slice(0, 12)}…
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
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
                  <td className="px-4 py-3">
                    <ChannelStatus status={status} channelId={ch.channelId} />
                    {hasPreview && (
                      <p className="text-xs text-indigo-600 mt-0.5">{status.preview.length} סרטונים חדשים מוכנים לייבוא</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {confirmDeleteId === ch.mentorId ? (
                        <>
                          <span className="text-xs text-red-600">למחוק?</span>
                          <button
                            onClick={() => handleDeleteMentor(ch.mentorId)}
                            className="text-xs px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
                          >כן</button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs px-2 py-0.5 border border-gray-200 text-gray-500 rounded hover:bg-gray-50"
                          >לא</button>
                        </>
                      ) : (
                        <>
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
                          <button
                            onClick={() => setConfirmDeleteId(ch.mentorId)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="מחק מנטור"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
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
                  <a href={video.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
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
            <RssTab videos={videos} mentors={mentors} sources={sources} topics={topics} />
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
