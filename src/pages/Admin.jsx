import { useState, useCallback, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, TrendingUp, Pencil, Trash2, Globe, Youtube, Rss, Hash, RefreshCw, CheckCircle2, XCircle, Loader2, AlertTriangle, Code, ChevronsUp, ListVideo, Download, Archive, FolderTree, Snowflake, Play, Search, X, FolderSync, GitMerge, BookOpen, Lightbulb, Copy, Network, CreditCard, ExternalLink } from "lucide-react";
import { TOPIC_ICON_MAP, getTopicConfig, CATEGORY_CONFIG, getCategoryCodeForTopicName } from "@/config/topicConfig";
import { useMentors, useUpdateMentor, useDeleteMentor, useHiddenMentors, useRestoreMentor } from "@/hooks/useMentors";
import { useTopics, useCreateTopic, useUpdateTopic, useDeleteTopic } from "@/hooks/useTopics";
import { isUserTopic } from "@/services/topicStorage";
import { detectDuplicateTopics, countVideosByTopic, countSubTopics, mergeTopics } from "@/services/topicMerge";
import { useSources, useUpdateSource, useCreateSource } from "@/hooks/useSources";
import { useVideos, useCreateVideo } from "@/hooks/useVideos";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchChannelRSSFromSource,
  extractChannelIdFromUrl,
  extractHandleFromUrl,
  filterNewVideos,
} from "@/services/rssIngestion";
import { checkChannelRssFeed } from "@/services/rssFeedHealth";
import { isSuspiciousChannelId, repairChannelId } from "@/services/channelResolver";
import { loadVideos, upsertVideos, getVideoCount, clearAllVideos, clearLocalVideoData, updateStoredVideo } from "@/services/videoStorage";
import {
  analyzeVideo,
  chaptersToVideoTopics,
  hasNonEmptyChapters,
} from "@/services/videoAnalytics";
import { getLastSyncAt, getLastSyncResult } from "@/services/autoRssSync";
import { base44 } from "@/api/base44Client";
import { isBase44Enabled } from "@/config/base44Flags";
import { Video } from "@/api/entities";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  buildWorkspaceZip,
  formatZipExportSuccessHebrew,
  logWorkspaceZipExportSummary,
} from "@/lib/buildWorkspaceZip";
import { downloadWorkspaceZip } from "@/lib/downloadWorkspaceZip";
import { buildBrainStructureZip, countBrainStructure } from "@/lib/buildBrainStructureZip";
import { getFrozenMentorIds, toggleMentorFreeze } from "@/services/mentorScanStorage";
import StorageManager from "@/components/admin/StorageManager";
import { getMentorTopicOverride } from "@/lib/mentorTopicOverrides";
import { updateChannelCollectionByChannelId, updateChannelCollectionByChannelName } from "@/lib/localChannelCollectionsStore";
import { GEM_CATEGORY_MAP } from "@/lib/gemRecommender";
import { CATEGORY_TO_NAME } from "@/config/topicConfig";
import { getAllScanHistory, setScanHistory as persistScanHistory } from "@/lib/localScanHistoryStore";


const SOURCE_TYPE_ICON = {
  youtube: Youtube,
  rss: Rss,
  site: Globe,
};

/** Admin UI tokens — style/copy only; no logic */
const adminBtnPrimary =
  "inline-flex items-center justify-center gap-2 shrink-0 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";
const adminBtnSecondary =
  "inline-flex items-center justify-center gap-2 shrink-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";
const adminBtnDestructive =
  "inline-flex items-center justify-center gap-2 shrink-0 rounded-xl border border-red-200/80 bg-red-50 px-3.5 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/25 dark:text-red-300 dark:hover:bg-red-950/40";
const adminCard =
  "w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white/90 px-4 py-5 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70";
const adminIconBtn =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800";
const adminIconBtnDestructive =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-200/80 bg-red-50 text-red-600 transition-colors hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/25 dark:text-red-300 dark:hover:bg-red-950/40";
// Labeled variant — icon + always-visible text below
const adminLabelBtn =
  "inline-flex flex-col items-center justify-center gap-0.5 min-w-[44px] px-1.5 py-1.5 shrink-0 rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800";
const adminLabelBtnDestructive =
  "inline-flex flex-col items-center justify-center gap-0.5 min-w-[44px] px-1.5 py-1.5 shrink-0 rounded-xl border border-red-200/80 bg-red-50 text-red-600 transition-colors hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/25 dark:text-red-300 dark:hover:bg-red-950/40";

function matchesMentorChannelSearch({ mentor, channel, topics = [], query }) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;

  const topicNames = (mentor?.topicIds || [])
    .map((id) => topics.find((t) => t.id === id)?.name)
    .filter(Boolean);

  const categoryCode = channel?.category || mentor?.category;
  const categoryLabel = categoryCode ? CATEGORY_CONFIG[categoryCode]?.name : null;

  const haystack = [
    channel?.name,
    channel?.channelName,
    mentor?.name,
    mentor?.channelName,
    mentor?.handle,
    channel?.handle,
    categoryCode,
    categoryLabel,
    mentor?.youtubeChannelId,
    mentor?.channelId,
    channel?.channelId,
    channel?.youtubeChannelId,
    ...topicNames,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

function MentorSearchInput({ value, onChange, className }) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
      <input
        type="search"
        dir="rtl"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="חפש מנטור לפי שם..."
        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-10 pl-10 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label="נקה חיפוש"
          title="נקה חיפוש"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────
// ניהול מנטורים
// ────────────────────────────────────────────
const MARKET_GEM_OPTIONS = [
  { value: "", label: "אוטומטי (AI)" },
  { value: "fundamental", label: "פונדמנטלי" },
  { value: "technical",   label: "טכני" },
  { value: "news",        label: "חדשות שוק" },
  { value: "macro",       label: "מאקרו" },
];

const CATEGORY_OPTIONS = [
  { value: "Markets",   label: "שוק ההון" },
  { value: "AI",        label: "בינה מלאכותית ואוטומציה" },
  { value: "Dev",       label: "פיתוח תוכנה" },
  { value: "Politics",  label: "פוליטיקה" },
  { value: "Health",    label: "בריאות ותזונה" },
  { value: "",          label: "כללי / אחר" },
];

function EditMentorDialog({ mentor, topics, onClose }) {
  const [form, setForm] = useState({
    name: mentor.name,
    active: mentor.active ?? true,
    topicIds: mentor.topicIds || [],
    isOpponentView: mentor.isOpponentView ?? false,
    category: mentor.category || "",
    defaultSubTopic: mentor.defaultSubTopic || mentor.subTopic || "",
    defaultGem: mentor.defaultGem || "",
  });
  const updateMentor = useUpdateMentor();
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const toggleTopic = (id) => set("topicIds", form.topicIds.includes(id) ? form.topicIds.filter((t) => t !== id) : [...form.topicIds, id]);

  const handleSave = async () => {
    await updateMentor.mutateAsync({
      id: mentor.id,
      name: form.name,
      active: form.active,
      topicIds: form.topicIds,
      isOpponentView: form.isOpponentView,
      category: form.category || undefined,
      subTopic: form.defaultSubTopic || undefined,
      defaultSubTopic: form.defaultSubTopic || undefined,
      defaultGem: form.defaultGem || undefined,
    });
    onClose();
  };

  const isMarket = form.category === "Markets";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-96 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
        <h3 className="text-base font-semibold text-gray-900">עריכת מנטור</h3>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">שם</label>
          <input value={form.name} onChange={(e) => set("name", e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">קטגוריה ראשית</label>
          <select value={form.category} onChange={(e) => set("category", e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white">
            {CATEGORY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">תת-נושא ברירת מחדל</label>
          <input value={form.defaultSubTopic} onChange={(e) => set("defaultSubTopic", e.target.value)}
            placeholder="לדוגמה: ניתוח טכני, אסטרטגיות מסחר..."
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        </div>

        {isMarket && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">GEM ברירת מחדל</label>
            <select value={form.defaultGem} onChange={(e) => set("defaultGem", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white">
              {MARKET_GEM_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
          <span className="text-sm text-gray-700">פעיל</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 transition hover:bg-rose-100">
          <input type="checkbox" checked={form.isOpponentView} onChange={(e) => set("isOpponentView", e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-rose-600" />
          <span className="text-sm font-medium text-rose-700">☑ דעת האויב</span>
        </label>
        {topics.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">נושאים</label>
            <div className="flex flex-wrap gap-1.5">
              {topics.map((t) => (
                <button key={t.id} type="button" onClick={() => toggleTopic(t.id)}
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
  const [searchQuery, setSearchQuery] = useState("");
  const mainTopics = topics.filter((t) => !t.parentId);
  const { data: hiddenMentors = [] } = useHiddenMentors();
  const restoreMentor = useRestoreMentor();

  const visibleMentors = useMemo(() => {
    if (!searchQuery.trim()) return mentors;
    return mentors.filter((m) =>
      matchesMentorChannelSearch({ mentor: m, topics: mainTopics, query: searchQuery })
    );
  }, [mentors, mainTopics, searchQuery]);

  // Group mentors by topic
  const groups = mainTopics.map((topic) => ({
    label: topic.name,
    mentors: visibleMentors.filter((m) => m.topicIds?.includes(topic.id) || (
      // fallback: category match
      !m.topicIds?.length && m.category &&
      (topic.name.includes(m.category) || m.category.toLowerCase() === topic.name.toLowerCase())
    )),
  }));

  const assignedIds = new Set(groups.flatMap((g) => g.mentors.map((m) => m.id)));
  const unassigned = visibleMentors.filter((m) => !assignedIds.has(m.id));
  const hasSearch = Boolean(searchQuery.trim());

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-800 dark:text-white">מנטורים ({mentors.length})</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">עריכה וסיווג של מנטורים לפי נושאים</p>
      </div>

      <MentorSearchInput value={searchQuery} onChange={setSearchQuery} className="mb-4" />

      {hasSearch && (
        <p className="mb-3 text-xs text-slate-500 dark:text-zinc-400">
          {visibleMentors.length > 0
            ? `נמצאו ${visibleMentors.length} מתוך ${mentors.length} מנטורים`
            : "לא נמצאו מנטורים מתאימים"}
        </p>
      )}

      {visibleMentors.length === 0 && hasSearch ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
          לא נמצאו מנטורים מתאימים
        </div>
      ) : (
        <>
          {groups.map((g) => <MentorGroup key={g.label} label={g.label} mentors={g.mentors} topics={mainTopics} />)}
          <MentorGroup label="לא משויך" mentors={unassigned} topics={mainTopics} />
        </>
      )}

      {/* Hidden mentors — restore section */}
      {hiddenMentors.length > 0 && (
        <div className="mt-6" dir="rtl">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1.5">
            מוסתרים ({hiddenMentors.length})
          </h3>
          <div className="border border-dashed border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {hiddenMentors.map((m) => (
                  <tr key={m.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="text-sm text-gray-400 line-through">{m.name}</span>
                    </td>
                    <td className="px-4 py-2.5 text-left">
                      <button
                        onClick={() => restoreMentor.mutate(m.id)}
                        disabled={restoreMentor.isPending}
                        className="text-xs px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 transition-colors"
                      >
                        שחזר
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-white">קטגוריות</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">קיבוץ מנטורים לפי תחומי עניין</p>
        </div>
        <button className={cn(adminBtnPrimary, "text-xs px-3 py-1.5")}>
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
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-white">מקורות ({sources.length})</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">ערוצי YouTube ו-RSS המקושרים למנטורים</p>
        </div>
        <button className={cn(adminBtnPrimary, "text-xs px-3 py-1.5")}>
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

const TOPIC_COLOR_OPTIONS = ["blue", "violet", "cyan", "emerald", "amber", "rose", "orange"];
const TOPIC_COLOR_BG = {
  blue:    "bg-blue-400",
  violet:  "bg-violet-400",
  cyan:    "bg-cyan-400",
  emerald: "bg-emerald-400",
  amber:   "bg-amber-400",
  rose:    "bg-rose-400",
  orange:  "bg-orange-400",
};

// ── Topic Integrity Report ──────────────────────────────────────────────────
function TopicIntegrityReport({ topics, videos, onMerged }) {
  const [mergeState, setMergeState] = useState(null); // { keepId, mergeId, label }
  const [merging, setMerging] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const duplicates = useMemo(() => detectDuplicateTopics(topics), [topics]);

  if (!duplicates.length && !lastResult) return null;

  const handleConfirmMerge = () => {
    if (!mergeState) return;
    setMerging(true);
    try {
      const stats = mergeTopics(mergeState.keepId, mergeState.mergeId);
      setLastResult({ ...stats, label: mergeState.label });
      setMergeState(null);
      onMerged?.();
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="mb-5 rounded-2xl border border-orange-200 bg-orange-50 dark:border-orange-800/50 dark:bg-orange-950/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-orange-200 dark:border-orange-800/40">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
          <span className="text-sm font-bold text-orange-800 dark:text-orange-300">
            בדיקת תקינות נושאים
          </span>
          {duplicates.length > 0 && (
            <span className="rounded-full bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5">
              {duplicates.length} כפילויות
            </span>
          )}
        </div>
        {lastResult && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            ✅ מוזג — {lastResult.videos} סרטונים, {lastResult.knowledgeItems} פריטי מוח, {lastResult.subTopics} תת-נושאים
          </span>
        )}
      </div>

      {duplicates.length === 0 && lastResult && (
        <p className="px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          אין כפילויות נוספות — כל הנושאים תקינים.
        </p>
      )}

      {duplicates.map((group) => (
        <div key={group[0].name.toLowerCase()} className="px-4 py-3 border-b border-orange-100 dark:border-orange-800/30 last:border-0">
          <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 mb-2">
            ⚠️ &quot;{group[0].name}&quot; — {group.length} כפולים
          </p>
          <div className="space-y-1.5">
            {group.map(t => {
              const vCount  = countVideosByTopic(t.id, videos);
              const subCount = countSubTopics(t.id, topics);
              const isMock  = !isUserTopic(t.id);
              return (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-orange-200 bg-white dark:border-orange-800/40 dark:bg-zinc-900 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isMock ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                      {isMock ? 'מובנה' : 'מותאם'}
                    </span>
                    <code className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono truncate">{t.id}</code>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500 dark:text-zinc-400">
                    <span title="סרטונים">🎬 {vCount}</span>
                    <span title="תת-נושאים">📂 {subCount}</span>
                    {group.length === 2 && (
                      <button
                        type="button"
                        disabled={merging}
                        onClick={() => {
                          // Always keep the mock/built-in topic or the one with more data
                          const other = group.find(x => x.id !== t.id);
                          setMergeState({
                            keepId: t.id,
                            mergeId: other.id,
                            label: t.name,
                            keepLabel: isMock ? `${t.id} (מובנה)` : t.id,
                            mergeLabel: other.id,
                          });
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 text-[10px] font-bold transition-colors"
                      >
                        <GitMerge className="h-3 w-3" />
                        <span>שמור זה, מחק שני</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {group.length > 2 && (
            <p className="mt-1.5 text-[10px] text-orange-600 dark:text-orange-400">
              יש {group.length} כפולים — בחר ידנית בכל זוג
            </p>
          )}
        </div>
      ))}

      {/* Merge confirmation modal */}
      {mergeState && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" dir="rtl">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6 w-96 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">אשר מיזוג נושאים</h3>
            <div className="rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 px-4 py-3 space-y-1 text-sm">
              <p><span className="font-semibold text-green-700 dark:text-green-400">שומרים:</span> <code className="text-xs">{mergeState.keepLabel}</code></p>
              <p><span className="font-semibold text-red-600 dark:text-red-400">מוחקים:</span> <code className="text-xs">{mergeState.mergeLabel}</code></p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5">
                כל הסרטונים, פריטי המוח ותת-הנושאים של הנושא שנמחק יועברו לנושא שנשמר.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmMerge}
                disabled={merging}
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors"
              >
                {merging ? "מזג..." : "אשר מיזוג"}
              </button>
              <button
                type="button"
                onClick={() => setMergeState(null)}
                className="flex-1 py-2 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-sm rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TopicsTab({ topics, videos, mentors = [] }) {
  const [orderedTopics, setOrderedTopics] = useState(topics);
  const [editingTopic, setEditingTopic]   = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [addingNew, setAddingNew]         = useState(false);
  const [newName, setNewName]             = useState("");
  const [newColor, setNewColor]           = useState("blue");
  const [newError, setNewError]           = useState("");
  const [integrityKey, setIntegrityKey]   = useState(0);

  const updateTopic = useUpdateTopic();
  const deleteTopic = useDeleteTopic();
  const createTopic = useCreateTopic();
  const queryClient  = useQueryClient();

  const handleMerged = () => {
    queryClient.invalidateQueries({ queryKey: ['topics'] });
    queryClient.invalidateQueries({ queryKey: ['videos'] });
    queryClient.invalidateQueries({ queryKey: ['mentors'] });
    setIntegrityKey(k => k + 1);
  };

  // Sync orderedTopics whenever the topics prop changes (initial load + after mutations)
  useEffect(() => {
    if (topics.length > 0) setOrderedTopics(topics);
  }, [topics]);

  const getVideoCount  = (topicId) => videos.filter((v) => (v.topicIds || []).includes(topicId)).length;
  const getMentorCount = (topicId) => mentors.filter((m) => (m.topicIds || []).includes(topicId)).length;

  const handleMoveToTop = (topic) => {
    const items = [topic, ...orderedTopics.filter((t) => t.id !== topic.id)];
    setOrderedTopics(items);
    items.forEach((t, i) => updateTopic.mutate({ id: t.id, sortOrder: i }));
  };

  const handleAddTopic = async () => {
    setNewError("");
    try {
      await createTopic.mutateAsync({ name: newName, color: newColor });
      setNewName("");
      setNewColor("blue");
      setAddingNew(false);
    } catch (err) {
      setNewError(err.message);
    }
  };

  const handleDeleteTopic = (topicId) => {
    deleteTopic.mutate(topicId, {
      onSuccess: () => setConfirmDeleteId(null),
      onError:   (err) => { alert(err.message); setConfirmDeleteId(null); },
    });
  };

  const displayTopics = orderedTopics.length ? orderedTopics : topics;
  return (
    <div dir="rtl">
      {/* ── Integrity Report ── */}
      <TopicIntegrityReport key={integrityKey} topics={topics} videos={videos} onMerged={handleMerged} />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-white">נושאים ({displayTopics.length})</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">ארגון תוכן לפי נושאים וברינים</p>
        </div>
        <button
          onClick={() => { setAddingNew((p) => !p); setNewName(""); setNewError(""); }}
          className={cn(adminBtnPrimary, "text-xs px-3 py-1.5")}
        >
          {addingNew ? "ביטול" : "+ הוסף נושא"}
        </button>
      </div>

      {/* Add new topic form */}
      {addingNew && (
        <div className="mb-4 border border-indigo-100 bg-indigo-50/30 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">נושא חדש</p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setNewError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleAddTopic()}
              placeholder="שם הנושא..."
              className="flex-1 min-w-40 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <div className="flex gap-1.5">
              {TOPIC_COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  title={c}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${TOPIC_COLOR_BG[c]} ${newColor === c ? "border-gray-700 scale-110" : "border-transparent opacity-60 hover:opacity-100"}`}
                />
              ))}
            </div>
          </div>
          {newError && <p className="text-xs text-red-500">{newError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAddTopic}
              disabled={!newName.trim() || createTopic.isPending}
              className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {createTopic.isPending ? "שומר..." : "הוסף"}
            </button>
            <button
              onClick={() => { setAddingNew(false); setNewName(""); setNewError(""); }}
              className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50 transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

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
                <th className="text-right px-4 py-3 text-gray-500 font-medium">מנטורים</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">סרטונים</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {displayTopics.map((topic, i) => {
                const colorClass     = TOPIC_COLOR_MAP[topic.color] || TOPIC_COLOR_MAP.violet;
                const isConfirmDelete = confirmDeleteId === topic.id;
                const canDelete      = isUserTopic(topic.id);
                const mentorCount    = getMentorCount(topic.id);
                return (
                  <tr key={topic.id} className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`p-1 rounded ${colorClass}`}>
                          {(() => { const I = TOPIC_ICON_MAP[topic.icon]; return I ? <I className="h-3.5 w-3.5" /> : <Hash className="h-3.5 w-3.5" />; })()}
                        </span>
                        <span className="font-medium text-gray-800">{topic.name}</span>
                        {canDelete && (
                          <span className="text-xs text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded">מותאם</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">{topic.description}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-700">{mentorCount || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-700">{getVideoCount(topic.id)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isConfirmDelete ? (
                          <>
                            <span className="text-xs text-red-600">למחוק?</span>
                            <button
                              onClick={() => handleDeleteTopic(topic.id)}
                              className="text-xs px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              כן
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs px-2 py-0.5 border border-gray-200 text-gray-500 rounded hover:bg-gray-50"
                            >
                              לא
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleMoveToTop(topic)}
                              title="העבר לראש"
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                            >
                              <ChevronsUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingTopic(topic)}
                              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            {canDelete ? (
                              <button
                                onClick={() => {
                                  if (mentorCount > 0) {
                                    alert(`לא ניתן למחוק — ${mentorCount} מנטורים משתמשים בנושא זה`);
                                    return;
                                  }
                                  setConfirmDeleteId(topic.id);
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <span className="p-1.5 text-gray-200" title="נושא מובנה — לא ניתן למחוק">
                                <Trash2 className="h-3.5 w-3.5" />
                              </span>
                            )}
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
// Manual Merge Helpers
// ────────────────────────────────────────────

function safeStr(v) {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  return String(v);
}

function ManualConflictViewer({ relPath, loading, data, onDecide }) {
  const [merged, setMerged] = useState('');
  useEffect(() => { if (data?.merged) setMerged(safeStr(data.merged)); }, [data]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> טוען קובץ...
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        לא ניתן לטעון את הקובץ
      </div>
    );
  }

  const safePath = (p) => safeStr(p).split('/').slice(-2).join('/');

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>השוואת קבצים:</strong> {safeStr(relPath)}
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <span className="font-semibold text-red-700">A (מקור):</span> {safePath(data.fileA?.path)}
          <span className="mx-2 text-slate-400">{data.fileA?.size} תווים</span>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <span className="font-semibold text-emerald-700">B (יעד):</span> {safePath(data.fileB?.path)}
          <span className="mx-2 text-slate-400">{data.fileB?.size} תווים</span>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex justify-between">
          <span>הבדלים</span>
          <div className="flex gap-3">
            <span className="text-red-500">A בלבד: {data.onlyA?.length ?? 0}</span>
            <span className="text-emerald-600">B בלבד: {data.onlyB?.length ?? 0}</span>
            <span className="text-slate-400">משותף: {data.common?.length ?? 0}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-slate-200 max-h-64 overflow-y-auto text-xs font-mono">
          <div className="p-3 overflow-x-auto">
            {(data.diff || []).filter(l => l.type !== 'only_b').map((l, i) => (
              <div key={i} className={`whitespace-pre-wrap break-all leading-5 ${l.type === 'only_a' ? 'bg-red-50 text-red-700' : 'text-slate-400'}`}>
                {safeStr(l.line) || ' '}
              </div>
            ))}
          </div>
          <div className="p-3 overflow-x-auto">
            {(data.diff || []).filter(l => l.type !== 'only_a').map((l, i) => (
              <div key={i} className={`whitespace-pre-wrap break-all leading-5 ${l.type === 'only_b' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-400'}`}>
                {safeStr(l.line) || ' '}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => onDecide('accept_source')}
          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100">
          קבל A (מקור)
        </button>
        <button type="button" onClick={() => onDecide('accept_target')}
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
          קבל B (יעד)
        </button>
        <button type="button" onClick={() => onDecide('merge_both', merged)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100">
          מזג שניים
        </button>
        <button type="button" onClick={() => onDecide('skip')}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          דלג
        </button>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600">תוכן ממוזג — ניתן לערוך לפני הבחירה</label>
        <textarea
          value={merged}
          onChange={e => setMerged(e.target.value)}
          rows={12}
          dir="rtl"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
        />
      </div>
    </div>
  );
}

function ManualFileList({ scanResult, decisions, sourceDir, targetDir, onDecide, onViewConflict }) {
  const toMove     = scanResult.toMove  || [];
  const toMerge    = scanResult.toMerge || [];
  const identical  = toMerge.filter(f => f.identical);
  const conflicts  = toMerge.filter(f => !f.identical);

  const ACTION_BTN = (label, action, current, colorActive, colorInactive) => (
    <button type="button" onClick={action}
      className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-colors ${current ? colorActive : colorInactive}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'להעברה', value: toMove.length, color: 'text-blue-600' },
          { label: 'לבדיקה/מיזוג', value: conflicts.length, color: 'text-amber-600 font-semibold' },
          { label: 'זהים (דלג)', value: identical.length, color: 'text-slate-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      {toMove.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-blue-700 mb-2">📦 קבצים להעברה ({toMove.length}) — קיימים רק ב-{safeStr(sourceDir)}</h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {toMove.map(f => {
              const dec = decisions[f.relPath] || { action: 'move' };
              return (
                <div key={f.relPath} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs">
                  <span className="flex-1 font-mono text-slate-700 break-all">{safeStr(f.relPath)}</span>
                  <span className="text-slate-400 whitespace-nowrap">{f.sizeB ? `${Math.round(f.sizeB / 1024)} KB` : ''}</span>
                  <div className="flex gap-1 shrink-0">
                    {ACTION_BTN('העבר', () => onDecide(f.relPath, 'move'), dec.action === 'move',
                      'bg-blue-100 border-blue-300 text-blue-700', 'border-slate-200 text-slate-400 hover:bg-slate-50')}
                    {ACTION_BTN('דלג', () => onDecide(f.relPath, 'skip'), dec.action === 'skip',
                      'bg-slate-100 border-slate-300 text-slate-600', 'border-slate-200 text-slate-400 hover:bg-slate-50')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {conflicts.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-amber-700 mb-2">⚡ קבצים בשני עצים — תוכן שונה ({conflicts.length})</h4>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {conflicts.map(f => {
              const dec = decisions[f.relPath] || { action: 'accept_target' };
              const decLabels = { accept_source: 'קבל מקור (A)', accept_target: 'קבל יעד (B)', merge_both: 'מזג שניים', skip: 'דלג' };
              const decColors = {
                accept_source: 'bg-red-50 border-red-200 text-red-700',
                accept_target: 'bg-emerald-50 border-emerald-200 text-emerald-700',
                merge_both: 'bg-violet-50 border-violet-200 text-violet-700',
                skip: 'bg-slate-50 border-slate-200 text-slate-500',
              };
              return (
                <div key={f.relPath} className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="flex-1 font-mono text-xs text-slate-700 break-all">{safeStr(f.relPath)}</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {f.sourceSizeB ? `${Math.round(f.sourceSizeB / 1024)} KB` : '—'} / {f.targetSizeB ? `${Math.round(f.targetSizeB / 1024)} KB` : '—'}
                    </span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {['accept_source', 'accept_target', 'merge_both', 'skip'].map(act => (
                      <button key={act} type="button" onClick={() => onDecide(f.relPath, act)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-colors ${dec.action === act ? decColors[act] : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                        {decLabels[act]}
                      </button>
                    ))}
                    <button type="button" onClick={() => onViewConflict(f)}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-semibold border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100">
                      👁 הצג diff
                    </button>
                  </div>
                  {dec.action !== 'skip' && (
                    <div className={`mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded inline-flex border ${decColors[dec.action] || 'border-slate-200'}`}>
                      ← {decLabels[dec.action] || dec.action}
                      <div><span className="font-semibold">פעולה מומלצת:</span> {getRecommendationLabel(recommendation.recommendedAction || 'Manual Review')}</div>
                      <div><span className="font-semibold">רמת ביטחון:</span> {recommendation.confidence ?? 0}% {recommendation.manualReviewRecommended ? '⚠ מומלץ לבדיקה ידנית' : ''}</div>
                      <div><span className="font-semibold">סיבת ההמלצה:</span> {safeStr(recommendation.reason) || '—'}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {identical.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-500 mb-2">✓ קבצים זהים ({identical.length}) — ידולגו אוטומטית</h4>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {identical.map(f => (
              <div key={f.relPath} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-1.5 text-xs text-slate-400">
                <span className="flex-1 font-mono break-all">{safeStr(f.relPath)}</span>
                <span className="whitespace-nowrap">זהה</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ManualMergePanel() {
  const [trees, setTrees]               = useState([]);
  const [sourceDir, setSourceDir]       = useState('');
  const [targetDir, setTargetDir]       = useState('');
  const [phase, setPhase]               = useState('idle'); // idle|scanning|review|conflict|executing|done|error
  const [scanResult, setScanResult]     = useState(null);
  const [decisions, setDecisions]       = useState({}); // relPath → { action, mergedContent? }
  const [conflictFile, setConflictFile] = useState(null);
  const [conflictData, setConflictData] = useState(null);
  const [loadingConflict, setLoadingConflict] = useState(false);
  const [dryRunOnly, setDryRunOnly]     = useState(false);
  const [execResult, setExecResult]     = useState(null);
  const [error, setError]               = useState(null);

  useEffect(() => {
    fetch('/api/vault/list-trees')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.trees)) setTrees(d.trees); })
      .catch(() => {});
  }, []);

  async function handleScan() {
    if (!sourceDir || !targetDir) { toast.error('בחר עץ מקור ועץ יעד'); return; }
    if (sourceDir === targetDir) { toast.error('עץ המקור ועץ היעד חייבים להיות שונים'); return; }
    setPhase('scanning'); setError(null); setScanResult(null); setDecisions({});
    try {
      const res  = await fetch('/api/vault/manual-scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceDir, targetDir }) });
      const data = await res.json();
      if (!res.ok) throw new Error(safeStr(data.error) || 'scan failed');
      setScanResult(data);
      const init = {};
      (data.toMove  || []).forEach(f => { init[f.relPath] = { action: 'move' }; });
      (data.toMerge || []).forEach(f => { init[f.relPath] = f.identical ? { action: 'skip' } : { action: 'accept_target' }; });
      setDecisions(init);
      setPhase('review');
    } catch (err) { setError(err.message); setPhase('error'); }
  }

  async function handleLoadConflict(file) {
    setConflictFile(file.relPath);
    setLoadingConflict(true);
    setPhase('conflict');
    try {
      const params = new URLSearchParams({ fileA: `${sourceDir}/${safeStr(file.relPath)}`, fileB: `${targetDir}/${safeStr(file.relPath)}` });
      const res  = await fetch(`/api/vault/conflict-compare?${params}`);
      const data = await res.json();
      setConflictData(data);
    } catch (err) { toast.error('לא ניתן לטעון קובץ: ' + err.message); }
    finally { setLoadingConflict(false); }
  }

  function setDecision(relPath, action, mergedContent) {
    setDecisions(prev => ({ ...prev, [relPath]: { action, ...(mergedContent != null ? { mergedContent } : {}) } }));
  }

  async function handleExecute(dryRun = false) {
    if (!scanResult) return;
    setDryRunOnly(dryRun); setPhase('executing'); setError(null);
    try {
      const res  = await fetch('/api/vault/manual-execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDir, targetDir, decisions, confirmed: !dryRun, dryRun }),
      });
      const data = await res.json();
      if (!data.ok && data.error) throw new Error(safeStr(data.error));
      setExecResult(data);
      setPhase('done');
    } catch (err) { setError(err.message); setPhase('error'); }
  }

  function handleReset() {
    setPhase('idle'); setScanResult(null); setDecisions({});
    setConflictFile(null); setConflictData(null); setExecResult(null);
    setError(null); setDryRunOnly(false);
  }

  const isReview = phase === 'review' || phase === 'conflict';

  return (
    <div dir="rtl" className="space-y-5">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 px-4 py-3 text-xs text-indigo-700">
        <strong>מצב ידני:</strong> בחר שני עצי תיקיות, בדוק קובץ-קובץ מה להעביר, למזג, או לדלג.
        גיבוי אוטומטי נוצר לפני כל ביצוע בפועל.
      </div>

      {/* Tree selection */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: '📂 עץ מקור', value: sourceDir, onChange: setSourceDir },
          { label: '📁 עץ יעד',  value: targetDir, onChange: setTargetDir },
        ].map(({ label, value, onChange }) => (
          <div key={label}>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
            <select value={value} onChange={e => onChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="">— בחר תיקיה —</option>
              {trees.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {(phase === 'idle' || phase === 'error') && (
          <button type="button" onClick={handleScan} disabled={!sourceDir || !targetDir}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            <Search className="h-4 w-4" /> סרוק ובדוק
          </button>
        )}
        {phase === 'scanning' && (
          <button type="button" disabled className="inline-flex items-center gap-2 rounded-xl bg-indigo-400 px-4 py-2 text-sm font-medium text-white cursor-not-allowed">
            <Loader2 className="h-4 w-4 animate-spin" /> סורק...
          </button>
        )}
        {isReview && (
          <>
            <button type="button" onClick={() => handleExecute(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100">
              <Play className="h-4 w-4" /> Dry Run
            </button>
            <button type="button" onClick={() => handleExecute(false)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> בצע מיזוג
            </button>
            <button type="button" onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <X className="h-4 w-4" /> בטל
            </button>
          </>
        )}
        {phase === 'conflict' && (
          <button type="button" onClick={() => setPhase('review')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            ← חזור לרשימה
          </button>
        )}
        {phase === 'executing' && (
          <button type="button" disabled className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-medium text-white cursor-not-allowed">
            <Loader2 className="h-4 w-4 animate-spin" /> מבצע...
          </button>
        )}
        {(phase === 'done' || phase === 'error') && (
          <button type="button" onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" /> סרוק מחדש
          </button>
        )}
      </div>

      {/* Error */}
      {phase === 'error' && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          שגיאה: {error}
        </div>
      )}

      {/* Done */}
      {phase === 'done' && execResult && (
        <div className={`rounded-xl border px-4 py-3 space-y-1 ${dryRunOnly ? 'border-indigo-200 bg-indigo-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <div className={`font-semibold text-sm ${dryRunOnly ? 'text-indigo-800' : 'text-emerald-800'}`}>
            {dryRunOnly ? '🔍 Dry Run — לא בוצעו שינויים' : '✅ המיזוג הושלם'}
          </div>
          <div className="text-xs text-slate-600">
            הועברו: {execResult.moved} | מוזגו: {execResult.merged} | דולגו: {execResult.skipped} | שגיאות: {execResult.errors}
          </div>
          {!dryRunOnly && execResult.archiveBase && (
            <div className="text-xs font-mono text-slate-500">גיבוי: {safeStr(execResult.archiveBase)}</div>
          )}
          {dryRunOnly && (
            <div className="mt-2">
              <button type="button" onClick={() => handleExecute(false)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> בצע בפועל
              </button>
            </div>
          )}
        </div>
      )}

      {/* File review list */}
      {phase === 'review' && scanResult && (
        <ManualFileList
          scanResult={scanResult}
          decisions={decisions}
          sourceDir={sourceDir}
          targetDir={targetDir}
          onDecide={setDecision}
          onViewConflict={handleLoadConflict}
        />
      )}

      {/* Conflict diff viewer */}
      {phase === 'conflict' && (
        <ManualConflictViewer
          relPath={conflictFile}
          loading={loadingConflict}
          data={conflictData}
          onDecide={(action, merged) => {
            setDecision(conflictFile, action, merged);
            setPhase('review');
          }}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────
// Vault Migration Tab
// ────────────────────────────────────────────

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safePathDisplay(value) {
  return safeStr(value).split('/').filter(Boolean).join('/') || '—';
}

function getConflictPath(conflict, kind) {
  if (kind === 'source') return safeStr(conflict?.sourcePath || conflict?.sourceFile || conflict?.duplicateFile || conflict?.from);
  return safeStr(conflict?.targetPath || conflict?.canonicalFile || conflict?.to);
}

function getConflictStatusLabel(status) {
  const key = safeStr(status);
  if (key === 'same_content') return 'תוכן זהה';
  if (key === 'empty') return 'תוכן ריק או חסר';
  if (key === 'missing') return 'קובץ חסר';
  return 'תוכן שונה';
}

const recommendation = {};

const ROLE_LABELS = {
  canonical: { label: "עץ ראשי",  color: "bg-green-100 text-green-700" },
  duplicate: { label: "כפול",    color: "bg-orange-100 text-orange-700" },
  typo:      { label: "שגיאת כתיב", color: "bg-red-100 text-red-700" },
  empty:     { label: "ריק",     color: "bg-gray-100 text-gray-500" },
};

const ACTION_LABELS = {
  MERGE_CONTENT:  { label: "מיזוג תוכן", color: "bg-blue-50 text-blue-700 border-blue-200" },
  METADATA_CLEANUP: { label: "ניקוי מטא־דאטה", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  MOVE_TREE:      { label: "העבר עץ", color: "bg-blue-50 text-blue-700 border-blue-200" },
  RENAME_TREE:    { label: "שנה שם עץ", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  MANUAL_REVIEW:  { label: "דורש בדיקה ידנית", color: "bg-amber-50 text-amber-700 border-amber-200" },
  move:         { label: "העבר",        color: "bg-blue-50 text-blue-700 border-blue-200" },
  "archive-root": { label: "ארכיב",   color: "bg-slate-50 text-slate-600 border-slate-200" },
  "archive-file": { label: "ארכיב קובץ", color: "bg-slate-50 text-slate-600 border-slate-200" },
  skip:         { label: "דלג",        color: "bg-gray-50 text-gray-500 border-gray-200" },
};

function formatYesNo(value) {
  return value ? "כן" : "לא";
}

function getActionTypeLabel(type) {
  return ACTION_LABELS[safeStr(type)]?.label || safeStr(type);
}

function getRiskLevelLabel(riskLevel) {
  const level = safeStr(riskLevel).toUpperCase();
  if (level === "LOW") return "נמוכה";
  if (level === "HIGH") return "גבוהה";
  return "בינונית";
}

function getRecommendationLabel(value) {
  const key = safeStr(value);
  if (key === "auto_merge") return "מומלץ למיזוג אוטומטי";
  if (key === "manual_review") return "מומלץ לבדיקה ידנית";
  if (key === "Merge") return "מיזוג";
  if (key === "Manual Review") return "בדיקה ידנית";
  if (key === "Archive source") return "העבר מקור לארכיון";
  if (key === "Do Not Merge Automatically") return "לא מומלץ למיזוג אוטומטי";
  if (key === "Invalid merge candidate") return "מועמד מיזוג לא תקין";
  return key;
}

function LegacyVaultMigrationTab() {
  const [phase, setPhase]                   = useState("idle"); // idle|scanning|report|comparing|conflict-review|executing|done|error
  const [report, setReport]                 = useState(null);
  const [error, setError]                   = useState(null);
  const [execResult, setExecResult]         = useState(null);
  const [executing, setExecuting]           = useState(false);
  const [migrationReport, setMigrationReport] = useState(null);
  const [conflictDiffs, setConflictDiffs]   = useState([]);    // [{conflict, fileA, fileB, diff, onlyA, onlyB, common, merged}]
  const [mergedContent, setMergedContent]   = useState("");    // editable combined merged textarea
  const [loadingConflicts, setLoadingConflicts] = useState(false);
  const [mode, setMode] = useState('auto'); // 'auto' | 'manual'

  async function handleScan() {
    setPhase("scanning");
    setError(null);
    setReport(null);
    try {
      const res  = await fetch("/api/vault/scan-duplicates");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "scan failed");
      setReport(data);
      setPhase("report");
    } catch (err) {
      setError(err.message);
      setPhase("error");
    }
  }

  // Runs execute-migration + generate-report (shared by both paths)
  async function runExecuteAndReport(scanReport) {
    const res  = await fetch("/api/vault/execute-migration", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ actions: scanReport.actions, confirmed: true }),
    });
    const data = await res.json();
    if (!data.ok && data.error) throw new Error(data.error);
    setExecResult(data);

    const reportRes = await fetch("/api/vault/generate-migration-report", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ originalReport: scanReport, execResult: data }),
    });
    const reportData = await reportRes.json();
    if (reportData.ok) setMigrationReport(reportData);
  }

  // Direct execute — used when there are no conflicts
  async function handleExecute() {
    if (!report) return;
    setExecuting(true);
    try {
      await runExecuteAndReport(report);
      setPhase("done");
    } catch (err) {
      setError(err.message);
      setPhase("error");
    } finally {
      setExecuting(false);
    }
  }

  // Load diffs for all conflicts and enter conflict-review phase
  async function handleLoadConflicts() {
    if (!report?.conflicts?.length) { handleExecute(); return; }
    setLoadingConflicts(true);
    setPhase("comparing");
    try {
      const diffs = [];
      for (const c of report.conflicts) {
        const params = new URLSearchParams({ fileA: c.sourceFile, fileB: c.canonicalFile });
        const res    = await fetch(`/api/vault/conflict-compare?${params}`);
        const data   = await res.json();
        diffs.push({ conflict: c, ...data });
      }
      setConflictDiffs(diffs);

      // Build combined merged: header + each part separated
      const partLabels = ['## חלק 1', '## חלק 2', '## חלק 3'];
      const combined = diffs
        .map((d, i) => `${partLabels[i] ?? `## חלק ${i + 1}`}\n\n${d.merged}`)
        .join('\n\n---\n\n');
      setMergedContent(`# ניתוח ערך פונדמנטלי בעידן הבינה המלאכותית AI\n\n${combined}`);
      setPhase("conflict-review");
    } catch (err) {
      setError(err.message);
      setPhase("error");
    } finally {
      setLoadingConflicts(false);
    }
  }

  // Resolve conflicts then auto-execute migration
  async function handleResolveAndExecute() {
    if (!report) return;
    setExecuting(true);
    try {
      // Step 1: save merged + archive originals
      const resolveRes = await fetch("/api/vault/resolve-conflict", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          conflicts:     report.conflicts.map(c => ({ sourceFile: c.sourceFile, canonicalFile: c.canonicalFile })),
          mergedContent,
          targetPath:    "שוק ההון/ספריית ידע/פונדמנטלי/ניתוח ערך פונדמנטלי.md",
        }),
      });
      const resolveData = await resolveRes.json();
      if (!resolveData.ok) throw new Error(resolveData.error || "conflict resolution failed");

      // Step 2: execute remaining migrations + generate report
      await runExecuteAndReport(report);
      setPhase("done");
    } catch (err) {
      setError(err.message);
      setPhase("error");
    } finally {
      setExecuting(false);
    }
  }

  function handleReset() {
    setPhase("idle");
    setReport(null);
    setError(null);
    setExecResult(null);
    setMigrationReport(null);
    setConflictDiffs([]);
    setMergedContent("");
    setLoadingConflicts(false);
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-800 dark:text-zinc-200 mb-1">אחד עצי ידע כפולים</h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          סורק כפילויות בתיקיות ה-Vault ומציג תוכנית מיזוג. לא מבצע שינויים לפני אישור מפורש.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
        <button type="button" onClick={() => setMode('auto')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === 'auto' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-500 hover:text-slate-700'}`}>
          🔄 אוטומטי
        </button>
        <button type="button" onClick={() => setMode('manual')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === 'manual' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-500 hover:text-slate-700'}`}>
          <GitMerge className="h-3.5 w-3.5" /> ידני
        </button>
      </div>

      {mode === 'manual' && <ManualMergePanel />}

      {mode === 'auto' && <>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {phase === "idle" && (
          <button type="button" onClick={handleScan} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            <FolderSync className="h-4 w-4" />
            סרוק כפילויות
          </button>
        )}
        {phase === "scanning" && (
          <button type="button" disabled className="inline-flex items-center gap-2 rounded-xl bg-indigo-400 px-4 py-2 text-sm font-medium text-white cursor-not-allowed">
            <Loader2 className="h-4 w-4 animate-spin" />
            סורק...
          </button>
        )}
        {phase === "report" && (
          <>
            {report?.conflicts?.length > 0 ? (
              <button type="button" onClick={handleLoadConflicts} disabled={loadingConflicts}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                {loadingConflicts ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                פתור קונפליקטים ({report.conflicts.length}) לפני מיזוג
              </button>
            ) : (
              <button type="button" onClick={handleExecute} disabled={executing || !report?.actions?.length}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                אשר מיזוג
              </button>
            )}
            <button type="button" onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <X className="h-4 w-4" />
              בטל
            </button>
          </>
        )}
        {phase === "comparing" && (
          <button type="button" disabled className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-sm font-medium text-white cursor-not-allowed">
            <Loader2 className="h-4 w-4 animate-spin" />
            טוען השוואת קבצים...
          </button>
        )}
        {phase === "conflict-review" && (
          <>
            <button type="button" onClick={handleResolveAndExecute} disabled={executing}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              שמור מיזוג ובצע מיגרציה
            </button>
            <button type="button" onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <X className="h-4 w-4" />
              בטל
            </button>
          </>
        )}
        {(phase === "done" || phase === "error") && (
          <button type="button" onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
            סרוק שוב
          </button>
        )}
      </div>

      {/* Error */}
      {phase === "error" && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          שגיאה: {error}
        </div>
      )}

      {/* Done */}
      {phase === "done" && execResult && (
        <div className="space-y-4">
          {/* Summary banner */}
          <div className={`rounded-xl border px-4 py-3 space-y-1 ${migrationReport?.allOk === false ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
            <div className={`font-semibold text-sm ${migrationReport?.allOk === false ? "text-amber-800" : "text-emerald-800"}`}>
              {migrationReport?.allOk === false ? "⚠️ המיזוג הושלם עם הערות" : "✅ המיזוג הושלם בהצלחה"}
            </div>
            <div className="text-xs text-emerald-700">
              הועברו: {execResult.moved} | ארכיב: {execResult.archived} | שגיאות: {execResult.errors}
            </div>
            {execResult.archiveBase && (
              <div className="text-xs text-emerald-600 font-mono break-all">גיבוי: {execResult.archiveBase}</div>
            )}
            {migrationReport?.reportPath && (
              <div className="text-xs text-slate-500 font-mono break-all">דוח: {migrationReport.reportPath}</div>
            )}
          </div>

          {/* Verification table */}
          {migrationReport?.verifications?.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                תוצאות אימות
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {migrationReport.verifications.map((v, i) => (
                    <tr key={i} className={`border-b border-slate-100 last:border-0 ${v.ok ? "" : "bg-amber-50"}`}>
                      <td className="px-4 py-2 text-slate-700">{v.check}</td>
                      <td className={`px-4 py-2 font-mono font-semibold ${v.ok ? "text-emerald-600" : "text-amber-600"}`}>{v.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Download report button */}
          {migrationReport?.content && (
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([migrationReport.content], { type: "text/markdown;charset=utf-8" });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement("a");
                a.href     = url;
                a.download = "migration-complete-report.md";
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              הורד migration-complete-report.md
            </button>
          )}
        </div>
      )}

      {/* Conflict Review */}
      {phase === "conflict-review" && conflictDiffs.length > 0 && (
        <div className="space-y-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>פתרון קונפליקטים ({conflictDiffs.length})</strong> — קבצים עם אותו שם אך תוכן שונה.
            קבצי המקור יועתקו ל-<span className="font-mono text-xs">_archive/conflicts/</span>.
            הגרסה הממוזגת תישמר ל-<span className="font-mono text-xs">שוק ההון/ספריית ידע/פונדמנטלי/ניתוח ערך פונדמנטלי.md</span>.
          </div>

          {conflictDiffs.map((d, idx) => (
            <div key={idx} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  קונפליקט {idx + 1} — {d.conflict?.file || d.fileA?.path?.split('/').pop()}
                </span>
                <div className="flex gap-3 text-xs">
                  <span className="text-red-500">רק ב-A: {d.onlyA?.length ?? 0} שורות</span>
                  <span className="text-emerald-600">רק ב-B (קנוני): {d.onlyB?.length ?? 0} שורות</span>
                  <span className="text-slate-500">משותפות: {d.common?.length ?? 0} שורות</span>
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-200 text-xs font-mono max-h-52 overflow-y-auto">
                <div className="p-3 overflow-x-auto">
                  <div className="text-slate-400 mb-1.5 font-sans not-mono text-right">
                    A — {d.fileA?.path?.split('/').slice(-2).join('/')} ({d.fileA?.size}B)
                  </div>
                  {d.diff?.filter(l => l.type !== 'only_b').map((l, i) => (
                    <div key={i} className={`whitespace-pre-wrap break-all leading-5 ${l.type === 'only_a' ? 'bg-red-50 text-red-700' : 'text-slate-400'}`}>
                      {l.line || ' '}
                    </div>
                  ))}
                </div>
                <div className="p-3 overflow-x-auto">
                  <div className="text-slate-400 mb-1.5 font-sans not-mono text-right">
                    B (קנוני) — {d.fileB?.path?.split('/').slice(-2).join('/')} ({d.fileB?.size}B)
                  </div>
                  {d.diff?.filter(l => l.type !== 'only_a').map((l, i) => (
                    <div key={i} className={`whitespace-pre-wrap break-all leading-5 ${l.type === 'only_b' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-400'}`}>
                      {l.line || ' '}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">גרסה ממוזגת — ניתן לערוך לפני השמירה</label>
            <textarea
              value={mergedContent}
              onChange={e => setMergedContent(e.target.value)}
              rows={16}
              dir="rtl"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
            />
            <div className="text-xs text-slate-400">
              יישמר כ: <span className="font-mono">שוק ההון/ספריית ידע/פונדמנטלי/ניתוח ערך פונדמנטלי.md</span>
            </div>
          </div>
        </div>
      )}

      {/* Dry-run report */}
      {(phase === "report" || phase === "executing") && report && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "להעברה",    value: report.summary?.toMove,    color: "text-blue-600" },
              { label: "לארכיב",    value: report.summary?.toArchive, color: "text-slate-500" },
              { label: "לדילוג",    value: report.summary?.toSkip,    color: "text-gray-400" },
              { label: "קונפליקטים", value: report.summary?.conflicts, color: "text-red-500 font-semibold" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
                <div className={`text-2xl font-bold ${color}`}>{value ?? 0}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            ))}
          </div>

          {/* Roots */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-2">תיקיות שנסרקו</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900">
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">תיקיה</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">סטטוס</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">קבצים</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">גודל</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">עדכון אחרון</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">עץ ראשי</th>
                  </tr>
                </thead>
                <tbody>
                  {report.roots?.map((root) => {
                    const roleTag = ROLE_LABELS[root.role] || { label: root.role, color: "bg-gray-100 text-gray-500" };
                    return (
                      <tr key={root.name} className="border-b border-slate-100 dark:border-zinc-800 last:border-0">
                        <td className="px-3 py-2 font-mono text-xs">{root.name}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${roleTag.color}`}>{roleTag.label}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-zinc-400">{root.exists ? root.fileCount : "—"}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-zinc-400">{root.exists ? `${root.sizeKB}KB` : "—"}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">{root.lastMod || "—"}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs font-mono">{root.canonical || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Planned actions */}
          {report.actions?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-2">
                תוכנית פעולה ({report.actions.length})
              </h3>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {report.actions.map((action, i) => {
                  const tag = ACTION_LABELS[action.type] || { label: action.type, color: "bg-gray-50 text-gray-500 border-gray-200" };
                  return (
                    <div key={i} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${tag.color}`}>
                      <span className="shrink-0 font-semibold">{tag.label}</span>
                      <span className="font-mono break-all text-current/80">{action.from}</span>
                      {action.to && <><span className="shrink-0">→</span><span className="font-mono break-all">{action.to}</span></>}
                      {action.reason && <span className="text-current/60 shrink-0 mr-auto">({action.reason})</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conflicts */}
          {report.conflicts?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
                קונפליקטים — דורשים בדיקה ידנית ({report.conflicts.length})
              </h3>
              <div className="space-y-1.5">
                {report.conflicts.map((c, i) => (
                  <div key={i} className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 px-3 py-2 text-xs space-y-0.5">
                    <div className="font-mono text-red-700 dark:text-red-300 break-all">{c.from}</div>
                    <div className="text-red-500">↔ {c.to}</div>
                    <div className="text-red-400">
                      {c.fromSizeB}B ↔ {c.toSizeB}B — {c.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning before approve */}
          {phase === "report" && report.actions?.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              <strong>שים לב:</strong> {report.conflicts?.length > 0
                ? `יש ${report.conflicts.length} קונפליקטים — לחץ "פתור קונפליקטים" קודם. לאחר מכן המיגרציה תרוץ אוטומטית.`
                : `לחיצה על "אשר מיזוג" תעביר קבצים בפועל.`} גיבוי אוטומטי יישמר תחת
              <span className="font-mono text-xs mx-1">_archive/vault-migration/{new Date().toISOString().slice(0,10)}/</span>.
            </div>
          )}
        </div>
      )}

      </>}
    </div>
  );
}

// ────────────────────────────────────────────
// RSS Ingestion Tab
// ────────────────────────────────────────────

function formatChannelIdDisplay(id) {
  if (!id) return null;
  if (id.length <= 12) return id;
  return `${id.slice(0, 5)}...${id.slice(-4)}`;
}

// ─── Semantic Suggestions Panel ────────────────────────────────────────────────
const DISMISSED_KEY = 'yt_vault_sem_dismissed_v1';
const SAVED_KEY = 'yt_vault_sem_saved_v1';

function riskColor(level) {
  if (level === 'HIGH') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300';
  if (level === 'MEDIUM') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-300';
}

function simColor(pct) {
  if (pct >= 85) return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300';
  if (pct >= 68) return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300';
}

function SemanticSuggestionsPanel() {
  const [phase, setPhase] = useState('idle');
  const [suggestions, setSuggestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')); }
    catch { return new Set(); }
  });
  const [saved, setSaved] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')); }
    catch { return new Set(); }
  });
  const [creating, setCreating] = useState(null);
  const [creatingName, setCreatingName] = useState('');
  const [creatingBusy, setCreatingBusy] = useState(false);
  const [filterSaved, setFilterSaved] = useState(false);

  const visible = suggestions.filter(s =>
    !dismissed.has(s.id) && (!filterSaved || saved.has(s.id))
  );

  const handleScan = async () => {
    setPhase('scanning'); setError(null);
    try {
      const res = await fetch('/api/vault/semantic-suggestions');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'שגיאה בסריקה');
      setSuggestions(data.suggestions || []);
      setTotal(data.total || 0);
      setPhase('done');
    } catch (err) {
      setError(err.message); setPhase('idle');
    }
  };

  const dismiss = (id) => {
    const next = new Set(dismissed); next.add(id);
    setDismissed(next);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
  };

  const toggleSave = (id) => {
    const next = new Set(saved);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSaved(next);
    localStorage.setItem(SAVED_KEY, JSON.stringify([...next]));
  };

  const copyForAI = async (s) => {
    const md = [
      '## הצעת חיבור — Vault Semantic Suggestion',
      '',
      `**פריט א:** \`${s.itemA}\``,
      `**פריט ב:** \`${s.itemB}\``,
      `**דמיון:** ${s.similarity}%`,
      `**פעולה מומלצת:** ${s.suggestedAction}`,
      `**סיבה:** ${s.reason}`,
      `**רמת סיכון:** ${s.risk.label}`,
      s.recommendedStructure ? `\n**מבנה מוצע:**\n\`\`\`\n${s.recommendedStructure}\n\`\`\`` : '',
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(md);
      toast.success('הועתק — ניתן להדביק ב-AI לייעוץ');
    } catch { toast.error('לא ניתן להעתיק'); }
  };

  const openCreateParent = (s) => {
    setCreating(s);
    setCreatingName(s.suggestedParentName || '');
  };

  const confirmCreateParent = async () => {
    if (!creating || !creatingName.trim()) return;
    setCreatingBusy(true);
    try {
      const res = await fetch('/api/vault/create-parent-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemAPath: creating.itemA, itemBPath: creating.itemB, parentFolderName: creatingName.trim() }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'שגיאה');
      toast.success(`תיקיית אב נוצרה: ${data.parentFolder}`);
      dismiss(creating.id);
      setCreating(null);
    } catch (err) { toast.error(`שגיאה: ${err.message}`); }
    finally { setCreatingBusy(false); }
  };

  const exportMd = () => {
    const lines = [
      '# הצעות חיבור — Vault Semantic Suggestions',
      `נסרקו ${total} הצעות | מוצגות ${visible.length} | ${new Date().toLocaleDateString('he-IL')}`,
      '',
    ];
    visible.forEach((s, i) => {
      lines.push(`## ${i + 1}. ${s.similarity}% — ${s.suggestedAction}`);
      lines.push(`- **פריט א:** \`${s.itemA}\``);
      lines.push(`- **פריט ב:** \`${s.itemB}\``);
      lines.push(`- **סיבה:** ${s.reason}`);
      lines.push(`- **סיכון:** ${s.risk.label}`);
      if (s.recommendedStructure) lines.push(`\`\`\`\n${s.recommendedStructure}\n\`\`\``);
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'semantic-suggestions.md'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div dir="rtl" className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          הצעות חיבור סמנטי
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          סריקת שמות קבצים ותיקיות דומים — הצעה בלבד, ללא שינוי אוטומטי.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleScan} disabled={phase === 'scanning'}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
          {phase === 'scanning' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Network className="h-4 w-4" />}
          {phase === 'scanning' ? 'סורק...' : 'סרוק הצעות'}
        </button>
        {phase === 'done' && (
          <>
            <button type="button" onClick={exportMd}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              <Download className="h-3.5 w-3.5" /> ייצא Markdown
            </button>
            <button type="button" onClick={() => setFilterSaved(!filterSaved)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${filterSaved ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
              <Lightbulb className="h-3.5 w-3.5" />
              {filterSaved ? 'כל ההצעות' : 'שמורות בלבד'}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300">
          שגיאה: {error}
        </div>
      )}

      {phase === 'done' && (
        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-zinc-400">
          <span>נמצאו <strong className="text-slate-800 dark:text-zinc-200">{total}</strong> הצעות</span>
          <span>מוצגות: <strong>{visible.length}</strong></span>
          {dismissed.size > 0 && <span>נדחו: {dismissed.size}</span>}
          {saved.size > 0 && <span className="text-amber-600">שמורות: {saved.size}</span>}
        </div>
      )}

      {phase === 'idle' && suggestions.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
          לחץ "סרוק הצעות" כדי לאתר קבצים ותיקיות עם שמות דומים ב-Vault
        </div>
      )}

      {/* Suggestion cards */}
      <div className="space-y-3">
        {visible.map((s) => (
          <div key={s.id}
            className={`rounded-2xl border bg-white px-4 py-4 shadow-sm dark:bg-zinc-900/80 ${saved.has(s.id) ? 'border-amber-200 dark:border-amber-800/40' : 'border-slate-200 dark:border-zinc-700'}`}>
            {/* Header row */}
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${simColor(s.similarity)}`}>
                  {s.similarity}%
                </span>
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">{s.suggestedAction}</span>
                <span className="text-[10px] text-slate-400">📁 {s.folder}</span>
                <span className="text-[10px] text-slate-400">{s.type === 'folder' ? '📂 תיקיות' : '📄 קבצים'}</span>
              </div>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${riskColor(s.risk.level)}`}>
                סיכון: {s.risk.label}
              </span>
            </div>

            {/* Items */}
            <div className="mb-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-300 space-y-1">
              <div><span className="text-slate-400">א:</span> {s.itemA}</div>
              <div><span className="text-slate-400">ב:</span> {s.itemB}</div>
            </div>

            {/* Reason */}
            <p className="mb-2 text-sm text-slate-600 dark:text-zinc-300">{s.reason}</p>

            {/* Recommended structure */}
            {s.recommendedStructure && (
              <pre className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800/30 dark:bg-emerald-950/20 dark:text-emerald-300 whitespace-pre-wrap">
                {s.recommendedStructure}
              </pre>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => copyForAI(s)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                <Copy className="h-3 w-3" /> העתק להתייעצות
              </button>
              <button type="button" onClick={() => toggleSave(s.id)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${saved.has(s.id) ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/20 dark:text-amber-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}>
                <Lightbulb className="h-3 w-3" /> {saved.has(s.id) ? 'שמור ✓' : 'שמור הצעה'}
              </button>
              {s.type === 'file' && (
                <button type="button" onClick={() => openCreateParent(s)}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700/40 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30">
                  <FolderTree className="h-3 w-3" /> צור תיקיית אב
                </button>
              )}
              <button type="button" onClick={() => dismiss(s.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors dark:border-zinc-700 dark:text-zinc-500">
                <X className="h-3 w-3" /> דחה הצעה
              </button>
            </div>
          </div>
        ))}
      </div>

      {phase === 'done' && visible.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
          {dismissed.size > 0 ? `כל ההצעות נדחו (${dismissed.size}) — לחץ "סרוק הצעות" מחדש לסריקה רעננה` : 'לא נמצאו הצעות חיבור'}
        </div>
      )}

      {/* Create parent folder modal */}
      {creating && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" dir="rtl">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setCreating(null)} />
          <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-950">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-1">צור תיקיית אב</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
              שני הקבצים יועברו לתיקייה החדשה. גיבוי יישמר ב-_archive.
            </p>
            <div className="mb-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-0.5">
              <div className="text-slate-400">א: {creating.itemA}</div>
              <div className="text-slate-400">ב: {creating.itemB}</div>
            </div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">שם התיקייה החדשה</label>
            <input
              type="text"
              value={creatingName}
              onChange={e => setCreatingName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 mb-4"
              placeholder="שם תיקיית האב"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setCreating(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300">
                ביטול
              </button>
              <button type="button" onClick={confirmCreateParent} disabled={creatingBusy || !creatingName.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {creatingBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderTree className="h-3.5 w-3.5" />}
                צור ועבר
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VaultMigrationTab() {
  const [phase, setPhase] = useState("idle");
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [execResult, setExecResult] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [migrationReport, setMigrationReport] = useState(null);
  const [conflictDiffs, setConflictDiffs] = useState([]);
  const [conflictResolutions, setConflictResolutions] = useState({});
  const [conflictRunResult, setConflictRunResult] = useState(null);
  const [loadingConflicts, setLoadingConflicts] = useState(false);
  const [generatingMergeReport, setGeneratingMergeReport] = useState(false);
  const [mergeReportMarkdown, setMergeReportMarkdown] = useState("");
  const [mergeReportMeta, setMergeReportMeta] = useState(null);
  const [mode, setMode] = useState('auto');
  const [showFullTreeContents, setShowFullTreeContents] = useState(false);
  const [emptyTreeConfirm, setEmptyTreeConfirm] = useState(null);
  const [deletingEmptyTree, setDeletingEmptyTree] = useState(false);
  const [emptyTreeResult, setEmptyTreeResult] = useState(null);

  const reportConflicts = safeArray(report?.conflicts);
  const reportActionPlan = safeArray(report?.actionPlan).length ? safeArray(report?.actionPlan) : safeArray(report?.actions);
  const rawDuplicateCounterSource = safeArray(report?.rawDuplicateCounterSource);
  const reportMergeCandidates = safeArray(report?.mergeCandidates);
  const reportDuplicateTrees = safeArray(report?.duplicateTrees);
  const duplicateRootsCount = rawDuplicateCounterSource.length;
  const invalidMergeCandidates = reportMergeCandidates.filter((candidate) =>
    safeStr(candidate?.sourceTree || candidate?.duplicateTree) === safeStr(candidate?.targetTree || candidate?.canonicalTree)
    && safeStr(candidate?.sourcePath) === safeStr(candidate?.targetPath)
  );
  const emptyTreeCandidates = reportMergeCandidates.filter((c) =>
    (!c?.physicalPathExists && Number(c?.physicalFileCount || 0) === 0 && Number(c?.physicalFolderCount || 0) === 0) ||
    safeStr(c?.candidateStatus) === 'EMPTY_SOURCE'
  );
  const mergeCandidatesOnly = reportMergeCandidates.filter((c) =>
    !emptyTreeCandidates.includes(c)
  );

  function getCandidateStatusLabel(candidate) {
    if (safeStr(candidate?.candidateStatus) === "EMPTY_SOURCE") return "ניקוי מטא־דאטה בלבד";
    return "בדיקת מיזוג תוכן";
  }

  function getCandidateRiskLevel(candidate) {
    const riskLevel = safeStr(candidate?.riskLevel).toUpperCase();
    if (["LOW", "MEDIUM", "HIGH"].includes(riskLevel)) return riskLevel;
    const physicalFileCount = Number(candidate?.physicalFileCount || 0);
    const conflictCount = Number(candidate?.conflictCount || candidate?.overlapAnalysis?.potentialConflicts || 0);
    if (physicalFileCount === 0) return "LOW";
    if (conflictCount > 0) return "HIGH";
    return "MEDIUM";
  }

  function getCandidateRiskLabel(candidate) {
    return getRiskLevelLabel(getCandidateRiskLevel(candidate));
  }

  function getOverallMergeRiskLevel(candidates = []) {
    const levels = safeArray(candidates).map((candidate) => getCandidateRiskLevel(candidate));
    if (levels.includes("HIGH")) return "HIGH";
    if (levels.includes("MEDIUM")) return "MEDIUM";
    return "LOW";
  }

  function normalizeForSimilarity(value) {
    return safeStr(value).toLowerCase().replace(/\.md$/i, '').replace(/[^a-z0-9\u0590-\u05ff]+/g, ' ').trim();
  }

  function stripRootPrefix(rootName, relPath) {
    const normalizedRoot = safeStr(rootName).replace(/\\/g, '/');
    const normalizedPath = safeStr(relPath).replace(/\\/g, '/');
    const prefix = normalizedRoot ? `${normalizedRoot}/` : '';
    return prefix && normalizedPath.startsWith(prefix) ? normalizedPath.slice(prefix.length) : normalizedPath;
  }

  function collectFolderPaths(filePaths) {
    const folderSet = new Set();
    safeArray(filePaths).forEach((filePath) => {
      const parts = safeStr(filePath).split('/').filter(Boolean);
      let current = '';
      parts.slice(0, -1).forEach((part) => {
        current = current ? `${current}/${part}` : part;
        folderSet.add(current);
      });
    });
    return Array.from(folderSet).sort((a, b) => a.localeCompare(b));
  }

  function buildRootInventory(rootName, roots = []) {
    const rootMap = new Map(safeArray(roots).map((root) => [safeStr(root?.name), root]));
    const root = rootMap.get(safeStr(rootName)) || null;
    const relativeFiles = safeArray(root?.files)
      .map((file) => stripRootPrefix(rootName, file))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    const folderPaths = collectFolderPaths(relativeFiles);
    const topLevelFolders = Array.from(new Set(
      folderPaths
        .map((folder) => safeStr(folder).split('/').filter(Boolean)[0])
        .filter(Boolean),
    )).sort((a, b) => a.localeCompare(b));
    return {
      exists: root?.exists !== false,
      folderCount: Number(root?.dirCount || folderPaths.length),
      fileCount: Number(root?.fileCount || relativeFiles.length),
      files: relativeFiles,
      folders: folderPaths,
      topLevelFolders,
      previewFiles: relativeFiles.slice(0, 20),
      previewFolders: topLevelFolders.slice(0, 10),
    };
  }

  function buildOverlapAnalysis(sourceInventory, targetInventory) {
    const sourceNameMap = new Map();
    const targetNameMap = new Map();

    safeArray(sourceInventory?.files).forEach((filePath) => {
      const baseName = normalizeForSimilarity(safeStr(filePath).split('/').filter(Boolean).pop());
      if (!baseName) return;
      if (!sourceNameMap.has(baseName)) sourceNameMap.set(baseName, []);
      sourceNameMap.get(baseName).push(filePath);
    });

    safeArray(targetInventory?.files).forEach((filePath) => {
      const baseName = normalizeForSimilarity(safeStr(filePath).split('/').filter(Boolean).pop());
      if (!baseName) return;
      if (!targetNameMap.has(baseName)) targetNameMap.set(baseName, []);
      targetNameMap.get(baseName).push(filePath);
    });

    const matchingKeys = Array.from(sourceNameMap.keys()).filter((key) => targetNameMap.has(key)).sort((a, b) => a.localeCompare(b));
    const uniqueSourceFiles = safeArray(sourceInventory?.files).filter((filePath) => !targetNameMap.has(normalizeForSimilarity(safeStr(filePath).split('/').filter(Boolean).pop()))).length;
    const uniqueTargetFiles = safeArray(targetInventory?.files).filter((filePath) => !sourceNameMap.has(normalizeForSimilarity(safeStr(filePath).split('/').filter(Boolean).pop()))).length;
    const exampleConflicts = matchingKeys
      .map((key) => {
        const sourceFile = safeArray(sourceNameMap.get(key))[0];
        return safeStr(sourceFile).split('/').filter(Boolean).pop() || key;
      })
      .filter(Boolean)
      .slice(0, 10);

    return {
      matchingFileNames: matchingKeys.length,
      uniqueSourceFiles,
      uniqueTargetFiles,
      potentialConflicts: matchingKeys.length,
      exampleConflicts,
    };
  }

  function buildConflictRecommendation(conflict, compareData) {
    const sourcePath = getConflictPath(conflict, 'source');
    const targetPath = getConflictPath(conflict, 'target');
    const sourceParts = safeStr(sourcePath).split('/').filter(Boolean);
    const targetParts = safeStr(targetPath).split('/').filter(Boolean);
    const sourceFileName = normalizeForSimilarity(sourceParts[sourceParts.length - 1]);
    const targetFileName = normalizeForSimilarity(targetParts[targetParts.length - 1]);
    const sourceFolders = sourceParts.slice(0, -1).map(normalizeForSimilarity).filter(Boolean);
    const targetFolders = targetParts.slice(0, -1).map(normalizeForSimilarity).filter(Boolean);
    const onlySource = safeArray(compareData?.onlyA).length;
    const onlyTarget = safeArray(compareData?.onlyB).length;
    const sharedLines = safeArray(compareData?.common).length;
    const totalLines = Math.max(onlySource + onlyTarget + sharedLines, 1);
    const sharedRatio = sharedLines / totalLines;
    const overlapFolders = sourceFolders.filter((folder) => targetFolders.includes(folder)).length;
    const fileNameSimilarity = sourceFileName && targetFileName && sourceFileName === targetFileName ? 1 : 0;
    const folderSimilarity = Math.max(sourceFolders.length, targetFolders.length) ? overlapFolders / Math.max(sourceFolders.length, targetFolders.length) : 0;
    const complementaryRatio = (onlySource > 0 && onlyTarget > 0) ? Math.min(onlySource, onlyTarget) / Math.max(onlySource, onlyTarget) : 0;
    const conflictingLines = onlySource + onlyTarget;
    const duplicateDetected = safeStr(conflict?.status) === 'same_content' || sharedRatio > 0.92;

    let score = 35;
    score += fileNameSimilarity * 28;
    score += folderSimilarity * 18;
    score += sharedRatio * 22;
    score += complementaryRatio * 12;
    if (duplicateDetected) score += 10;
    if (conflictingLines > sharedLines * 3) score -= 18;
    if (folderSimilarity === 0 && fileNameSimilarity === 0) score -= 14;
    score = Math.max(0, Math.min(100, Math.round(score)));

    const signals = [
      `דמיון בשם הקובץ: ${Math.round(fileNameSimilarity * 100)}%`,
      `דמיון במבנה התיקיות: ${Math.round(folderSimilarity * 100)}%`,
      `דמיון סמנטי משוער: ${Math.round(sharedRatio * 100)}%`,
      `שורות משותפות: ${sharedLines}`,
      `שורות מתנגשות: ${conflictingLines}`,
      `זיהוי כפילות: ${duplicateDetected ? 'כן' : 'לא'}`,
    ];

    let recommendedAction = 'Manual Review';
    if (safeStr(conflict?.status) === 'same_content') {
      recommendedAction = 'Archive source';
      score = Math.max(score, 96);
    } else if (score >= 90) {
      recommendedAction = 'Merge';
    } else if (score >= 70) {
      recommendedAction = 'Merge';
    } else if (score >= 40) {
      recommendedAction = 'Manual Review';
    } else {
      recommendedAction = 'Do Not Merge Automatically';
    }

    const reasons = [];
    if (fileNameSimilarity === 1) reasons.push('זוהה אותו נושא');
    if (folderSimilarity >= 0.5) reasons.push('מבנה תיקיות דומה');
    if (sharedRatio >= 0.45) reasons.push('דמיון סמנטי גבוה');
    if (onlySource > 0 && onlyTarget > 0 && complementaryRatio >= 0.35) reasons.push('רוב התוכן משלים זה את זה');
    if (conflictingLines > sharedLines * 2) reasons.push('נמצאו הרבה חלקים מתנגשים');
    if (recommendedAction !== 'Merge' && folderSimilarity === 0) reasons.push('קיים סיכון לערבוב תוכן לא קשור');
    if (!reasons.length) reasons.push('זוהתה חפיפה נמוכה');

    return {
      recommendedAction,
      confidence: score,
      reason: reasons.join('. ') + '.',
      signals,
      sourcePath,
      targetPath,
      linesOnlyInSource: onlySource,
      linesOnlyInTarget: onlyTarget,
      sharedLines,
      previewTargetPath: targetPath,
      manualReviewRecommended: score < 70,
    };
  }

  function buildTreeMergeCandidate(tree, roots = []) {
    const duplicateTree = safeStr(tree?.name || tree?.duplicateTree);
    const canonicalTree = safeStr(tree?.canonical || tree?.canonicalTree);
    const rootMap = new Map(safeArray(roots).map((root) => [safeStr(root?.name), root]));
    const sourceRoot = rootMap.get(duplicateTree) || null;
    const targetRoot = rootMap.get(canonicalTree) || null;
    const sourceInventory = buildRootInventory(duplicateTree, roots);
    const targetInventory = buildRootInventory(canonicalTree, roots);
    const overlapAnalysis = buildOverlapAnalysis(sourceInventory, targetInventory);
    const sourcePath = safeStr(tree?.sourcePath || duplicateTree);
    const targetPath = safeStr(tree?.targetPath || canonicalTree);
    const reason = safeStr(tree?.reason || (safeStr(tree?.role) === 'typo'
      ? `typo duplicate of ${canonicalTree}`
      : `duplicate root of ${canonicalTree}`));
    let confidence = Number(tree?.confidence || 0);
    if (!confidence) {
      confidence = safeStr(tree?.role) === 'typo' ? 95 : 92;
      if (tree?.exists === false) confidence -= 10;
    }
    confidence = Math.max(0, Math.min(100, Math.round(confidence)));
    const physicalPathExists = tree?.physicalPathExists === true || sourceRoot?.exists === true;
    const physicalFileCount = Number(tree?.physicalFileCount ?? tree?.sourceFileCount ?? sourceRoot?.fileCount ?? 0);
    const physicalFolderCount = Number(tree?.physicalFolderCount ?? tree?.sourceFolderCount ?? sourceRoot?.dirCount ?? 0);
    const candidateStatus = safeStr(tree?.candidateStatus || (!physicalPathExists && physicalFileCount === 0 && physicalFolderCount === 0 ? 'EMPTY_SOURCE' : 'READY'));
    const mergeType = safeStr(tree?.mergeType || (candidateStatus === 'EMPTY_SOURCE'
      ? 'METADATA_CLEANUP'
      : safeStr(tree?.role) === 'typo'
        ? 'RENAME_TREE'
        : 'MERGE_CONTENT'));
    const riskLevel = safeStr(tree?.riskLevel || (physicalFileCount === 0
      ? 'LOW'
      : Number(tree?.conflictCount || overlapAnalysis?.potentialConflicts || 0) > 0
        ? 'HIGH'
        : 'MEDIUM'));
    const recommendedAction = safeStr(tree?.recommendedAction || (candidateStatus === 'EMPTY_SOURCE' || confidence >= 90 ? 'auto_merge' : 'manual_review'));
    return {
      duplicateTree,
      canonicalTree,
      sourceTree: duplicateTree,
      targetTree: canonicalTree,
      sourcePath,
      targetPath,
      sourceExists: sourceInventory.exists,
      targetExists: targetInventory.exists,
      sourceFolderCount: sourceInventory.folderCount,
      targetFolderCount: targetInventory.folderCount,
      fileCount: Number(tree?.fileCount || tree?.sourceFileCount || sourceRoot?.fileCount || 0),
      reason,
      confidence,
      recommendedAction,
      sourceFileCount: Number(tree?.fileCount || tree?.sourceFileCount || sourceRoot?.fileCount || 0),
      targetFileCount: Number(tree?.targetFileCount || targetRoot?.fileCount || 0),
      sourceInventory,
      targetInventory,
      overlapAnalysis,
      role: safeStr(tree?.role),
      exists: tree?.exists !== false,
      physicalPathExists,
      physicalFileCount,
      physicalFolderCount,
      candidateStatus,
      mergeType,
      conflictCount: Number(tree?.conflictCount || overlapAnalysis?.potentialConflicts || 0),
      riskLevel,
    };
  }

  function normalizeScanReportData(data) {
    const rawDuplicateCounterSource = safeArray(data?.rawDuplicateCounterSource).length
      ? safeArray(data.rawDuplicateCounterSource)
      : safeArray(data?.duplicateTrees).length
        ? safeArray(data.duplicateTrees)
        : safeArray(data?.roots).filter((root) => ['duplicate', 'typo'].includes(root?.role));

    const duplicateTrees = rawDuplicateCounterSource.map((tree) => ({
      name: safeStr(tree?.name || tree?.duplicateTree),
      canonical: safeStr(tree?.canonical || tree?.canonicalTree),
      role: safeStr(tree?.role || 'duplicate'),
      exists: tree?.exists !== false,
      fileCount: Number(tree?.fileCount || 0),
      dirCount: Number(tree?.dirCount || 0),
      sizeKB: Number(tree?.sizeKB || 0),
      lastMod: safeStr(tree?.lastMod),
      reason: safeStr(tree?.reason || (safeStr(tree?.role) === 'typo'
        ? `typo duplicate of ${safeStr(tree?.canonical || tree?.canonicalTree)}`
        : `duplicate root of ${safeStr(tree?.canonical || tree?.canonicalTree)}`)),
      sourcePath: safeStr(tree?.sourcePath || tree?.name || tree?.duplicateTree),
      targetPath: safeStr(tree?.targetPath || tree?.canonical || tree?.canonicalTree),
      physicalPathExists: tree?.physicalPathExists === true || tree?.exists === true,
      physicalFileCount: Number(tree?.physicalFileCount ?? tree?.fileCount ?? 0),
      physicalFolderCount: Number(tree?.physicalFolderCount ?? tree?.dirCount ?? 0),
      candidateStatus: safeStr(tree?.candidateStatus),
      mergeType: safeStr(tree?.mergeType),
      riskLevel: safeStr(tree?.riskLevel),
    }));

    const mergeCandidates = duplicateTrees
      .filter((tree) => safeStr(tree?.canonical))
      .map((tree) => buildTreeMergeCandidate(tree, safeArray(data?.roots)));

    const actionPlanSource = safeArray(data?.actionPlan).length ? safeArray(data.actionPlan) : safeArray(data?.actions);
    const actionPlan = actionPlanSource.map((action) => {
      const sourcePath = safeStr(action?.sourcePath || action?.from || action?.sourceTree);
      const targetPath = safeStr(action?.targetPath || action?.to || action?.targetTree);
      const sourceTree = safeStr(action?.sourceTree || sourcePath.split('/').filter(Boolean)[0] || action?.duplicateTree);
      const targetTree = safeStr(action?.targetTree || targetPath.split('/').filter(Boolean)[0] || action?.canonicalTree);
      const confidence = Number(action?.confidence || 0);
      return {
        ...action,
        type: safeStr(action?.type || 'METADATA_CLEANUP'),
        sourceTree,
        targetTree,
        sourcePath,
        targetPath,
        confidence,
        reason: safeStr(action?.reason),
        status: safeStr(action?.status || 'dry_run'),
        requiresBackup: action?.requiresBackup !== false,
        recommendedAction: safeStr(action?.recommendedAction || (confidence >= 90 ? 'auto_merge' : 'manual_review')),
        candidateStatus: safeStr(action?.candidateStatus),
        mergeType: safeStr(action?.mergeType || action?.type),
        conflictCount: Number(action?.conflictCount || 0),
        physicalPathExists: action?.physicalPathExists === true,
        physicalFileCount: Number(action?.physicalFileCount || 0),
        physicalFolderCount: Number(action?.physicalFolderCount || 0),
        riskLevel: safeStr(action?.riskLevel || 'LOW'),
      };
    });

    const actionPlanMoveCount = actionPlan.filter((action) => ['MERGE_CONTENT', 'RENAME_TREE', 'MOVE_TREE'].includes(safeStr(action?.type))).length;
    const manualReviewCount = actionPlan.filter((action) => safeStr(action?.recommendedAction) === 'manual_review').length;
    const metadataCleanupCount = actionPlan.filter((action) => safeStr(action?.type) === 'METADATA_CLEANUP').length;

    return {
      ...data,
      rawDuplicateCounterSource,
      duplicateTrees,
      mergeCandidates,
      actionPlan,
      actions: actionPlan,
      summary: {
        ...(data?.summary || {}),
        toMove: data?.summary?.toMove ?? actionPlanMoveCount,
        toArchive: data?.summary?.toArchive ?? actionPlanMoveCount,
        metadataCleanup: data?.summary?.metadataCleanup ?? metadataCleanupCount,
        manualReview: data?.summary?.manualReview ?? manualReviewCount,
        duplicateTrees: rawDuplicateCounterSource.length,
        mergeCandidates: mergeCandidates.length,
      },
    };
  }

  async function scanVaultDuplicates(nextPhase = "report") {
    const res = await fetch("/api/vault/scan-duplicates");
    const data = await res.json();
    if (!res.ok) throw new Error(safeStr(data.error) || "scan failed");
    const normalized = normalizeScanReportData(data);
    setReport(normalized);
    setPhase(nextPhase);
    return normalized;
  }

  async function handleScan() {
    setPhase("scanning");
    setError(null);
    setReport(null);
    setExecResult(null);
    setMigrationReport(null);
    setConflictRunResult(null);
    try {
      await scanVaultDuplicates("report");
    } catch (err) {
      setError(err.message);
      setPhase("error");
    }
  }

  async function runExecuteAndReport(scanReport) {
    const res = await fetch("/api/vault/execute-migration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actionPlan: safeArray(scanReport?.actionPlan),
        actions: safeArray(scanReport?.actions),
        confirmed: true,
      }),
    });
    const data = await res.json();
    if (!data.ok && data.error) throw new Error(safeStr(data.error));

    const reportRes = await fetch("/api/vault/generate-migration-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ originalReport: scanReport, execResult: data }),
    });
    const reportData = await reportRes.json();
    if (reportData.ok) setMigrationReport(reportData);
    const postScan = await scanVaultDuplicates("done");
    const cleanupCompleted = Number(postScan?.summary?.duplicateTrees || 0) === 0
      && Number(postScan?.summary?.mergeCandidates || 0) === 0;
    setExecResult({
      ...data,
      postScan,
      cleanupCompleted,
    });
  }

  async function handleExecute() {
    if (!report) return;
    if (invalidMergeCandidates.length > 0) {
      setError("Invalid merge candidate");
      setPhase("error");
      return;
    }
    setExecuting(true);
    setError(null);
    try {
      await runExecuteAndReport(report);
      setPhase("done");
    } catch (err) {
      setError(err.message);
      setPhase("error");
    } finally {
      setExecuting(false);
    }
  }

  async function handleDeleteEmptyTree(candidate) {
    if (!candidate) return;
    setDeletingEmptyTree(true);
    setError(null);
    const treeName = safeStr(candidate.sourceTree || candidate.duplicateTree);
    try {
      const action = {
        type: 'METADATA_CLEANUP',
        sourceTree: treeName,
        targetTree: safeStr(candidate.targetTree || candidate.canonicalTree),
        sourcePath: safeStr(candidate.sourcePath),
        targetPath: safeStr(candidate.targetPath),
        candidateStatus: 'EMPTY_SOURCE',
        physicalFileCount: 0,
        physicalFolderCount: 0,
        physicalPathExists: false,
        riskLevel: 'LOW',
        requiresBackup: false,
      };
      const res = await fetch('/api/vault/execute-migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionPlan: [action], actions: [action], confirmed: true }),
      });
      const data = await res.json();
      if (!data.ok && data.error) throw new Error(safeStr(data.error));
      console.log(`[VaultMigrationTab] empty tree cleanup completed: ${treeName}`);
      setEmptyTreeResult({ treeName, success: true });
      setEmptyTreeConfirm(null);
      await scanVaultDuplicates('report');
    } catch (err) {
      setError(err.message);
      setEmptyTreeResult({ treeName, success: false });
    } finally {
      setDeletingEmptyTree(false);
    }
  }

  function getDefaultConflictAction(conflict, compareData) {
    const status = safeStr(compareData?.status || conflict?.status);
    if (status === 'same_content' || status === 'empty' || status === 'missing') return 'archive_source';
    return 'keep_target';
  }

  async function handleLoadConflicts() {
    if (!reportConflicts.length) return;
    setLoadingConflicts(true);
    setError(null);
    setPhase("comparing");
    try {
      const diffs = [];
      const nextResolutions = {};
      for (const conflict of reportConflicts) {
        const sourcePath = getConflictPath(conflict, 'source');
        const targetPath = getConflictPath(conflict, 'target');
        const params = new URLSearchParams({ fileA: sourcePath, fileB: targetPath });
        const res = await fetch(`/api/vault/conflict-compare?${params}`);
        const data = await res.json();
        if (!res.ok && data?.error) throw new Error(safeStr(data.error));
        const recommendation = buildConflictRecommendation(conflict, data);
        const action = getDefaultConflictAction(conflict, data);
        const conflictKey = conflict.id || `${sourcePath}__${targetPath}`;
        diffs.push({ conflict, recommendation, ...data });
        nextResolutions[conflictKey] = {
          sourcePath,
          targetPath,
          action,
          mergedContent: safeStr(data?.merged),
        };
      }
      setConflictDiffs(diffs);
      setConflictResolutions(nextResolutions);
      setPhase("conflict-review");
    } catch (err) {
      setError(err.message);
      setPhase("error");
    } finally {
      setLoadingConflicts(false);
    }
  }

  function updateConflictResolution(conflictKey, patch) {
    setConflictResolutions((prev) => ({
      ...prev,
      [conflictKey]: {
        ...(prev[conflictKey] || {}),
        ...patch,
      },
    }));
  }

  async function ensureConflictDiffsForReport() {
    if (conflictDiffs.length || !reportConflicts.length) return conflictDiffs;
    setGeneratingMergeReport(true);
    try {
      const diffs = [];
      const nextResolutions = {};
      for (const conflict of reportConflicts) {
        const sourcePath = getConflictPath(conflict, 'source');
        const targetPath = getConflictPath(conflict, 'target');
        const params = new URLSearchParams({ fileA: sourcePath, fileB: targetPath });
        const res = await fetch(`/api/vault/conflict-compare?${params}`);
        const data = await res.json();
        if (!res.ok && data?.error) throw new Error(safeStr(data.error));
        const recommendation = buildConflictRecommendation(conflict, data);
        const action = getDefaultConflictAction(conflict, data);
        const conflictKey = conflict.id || `${sourcePath}__${targetPath}`;
        diffs.push({ conflict, recommendation, ...data });
        nextResolutions[conflictKey] = {
          sourcePath,
          targetPath,
          action,
          mergedContent: safeStr(data?.merged),
        };
      }
      setConflictDiffs(diffs);
      setConflictResolutions((prev) => ({ ...nextResolutions, ...prev }));
      return diffs;
    } finally {
      setGeneratingMergeReport(false);
    }
  }

  function getActionPlanCandidateKey(item) {
    const sourcePath = safeStr(item?.sourcePath || item?.sourceTree || item?.from);
    const targetPath = safeStr(item?.targetPath || item?.targetTree || item?.to);
    return `${sourcePath}__${targetPath}`;
  }

  function findActionPlanForCandidate(candidate) {
    const candidateKey = getActionPlanCandidateKey(candidate);
    return reportActionPlan.find((action) => getActionPlanCandidateKey(action) === candidateKey) || null;
  }

  function getCandidateReviewReason(candidate) {
    const targetTree = safeStr(candidate?.targetTree || candidate?.canonicalTree);
    if (safeStr(candidate?.candidateStatus) === "EMPTY_SOURCE") return "עץ המקור לא נמצא פיזית בדיסק, ולכן מדובר בניקוי מטא־דאטה בלבד.";
    if (safeStr(candidate?.role) === "typo") return `שכפול כתיב של ${targetTree}`;
    if (targetTree) return `שורש כפול של ${targetTree}`;
    return "זוהה עץ כפול";
  }

  function getCandidateReviewRecommendation(candidate, action) {
    const invalidCandidate =
      safeStr(candidate?.sourceTree || candidate?.duplicateTree) === safeStr(candidate?.targetTree || candidate?.canonicalTree)
      && safeStr(candidate?.sourcePath) === safeStr(candidate?.targetPath);
    if (invalidCandidate) return "מועמד מיזוג לא תקין";
    if (safeStr(candidate?.candidateStatus) === "EMPTY_SOURCE") return "מומלץ למיזוג אוטומטי";
    if (safeStr(action?.recommendedAction) === "auto_merge" || Number(candidate?.confidence || 0) >= 90) return "מומלץ למיזוג אוטומטי";
    return "מומלץ לבדיקה ידנית";
  }

  function getCandidateDisplayActionType(candidate, action) {
    const actionType = safeStr(action?.type || candidate?.mergeType);
    if (safeStr(candidate?.candidateStatus) === "EMPTY_SOURCE") return getActionTypeLabel("METADATA_CLEANUP");
    return getActionTypeLabel(actionType || (safeStr(candidate?.role) === "typo" ? "RENAME_TREE" : "MERGE_CONTENT"));
  }

  function formatInventoryMarkdown(treeName, inventory, label) {
    const folders = showFullTreeContents ? safeArray(inventory?.folders) : safeArray(inventory?.previewFolders);
    const files = showFullTreeContents ? safeArray(inventory?.files) : safeArray(inventory?.previewFiles);
    const remainingFolders = Math.max(safeArray(inventory?.folders).length - folders.length, 0);
    const remainingFiles = Math.max(safeArray(inventory?.files).length - files.length, 0);
    return [
      `${label} סטטיסטיקות:`,
      ``,
      `תיקיות: ${Number(inventory?.folderCount || 0)}`,
      `קבצים: ${Number(inventory?.fileCount || 0)}`,
      ``,
      `מבנה תיקיות ראשי:`,
      ``,
      `${safeStr(treeName)}/`,
      ...(folders.length ? folders.map((folder) => `- ${folder}/`) : ['(לא נמצאו תיקיות)']),
      ...(remainingFolders > 0 ? [`(+${remainingFolders} תיקיות נוספות)`] : []),
      ``,
      `קבצים:`,
      ``,
      ...(files.length ? files.map((file, index) => `${index + 1}. ${file}`) : ['(לא נמצאו קבצים)']),
      ...(remainingFiles > 0 ? [`(+${remainingFiles} נוספים)`] : []),
      ``,
    ];
  }

  function formatOverlapMarkdown(overlapAnalysis) {
    return [
      `ניתוח חפיפה`,
      ``,
      `שמות קבצים תואמים: ${Number(overlapAnalysis?.matchingFileNames || 0)}`,
      `קבצי מקור ייחודיים: ${Number(overlapAnalysis?.uniqueSourceFiles || 0)}`,
      `קבצי יעד ייחודיים: ${Number(overlapAnalysis?.uniqueTargetFiles || 0)}`,
      `קונפליקטים פוטנציאליים: ${Number(overlapAnalysis?.potentialConflicts || 0)}`,
      ``,
      `דוגמאות לקונפליקטים:`,
      ...(safeArray(overlapAnalysis?.exampleConflicts).length
        ? safeArray(overlapAnalysis?.exampleConflicts).map((fileName) => `- ${fileName}`)
        : ['- אין']),
      ``,
    ];
  }

  function renderInventorySection(treeName, inventory, label) {
    const folders = showFullTreeContents ? safeArray(inventory?.folders) : safeArray(inventory?.previewFolders);
    const files = showFullTreeContents ? safeArray(inventory?.files) : safeArray(inventory?.previewFiles);
    const remainingFolders = Math.max(safeArray(inventory?.folders).length - folders.length, 0);
    const remainingFiles = Math.max(safeArray(inventory?.files).length - files.length, 0);

    return (
      <div className="space-y-2">
        <div className="font-semibold text-slate-700">{label} סטטיסטיקות</div>
        <div>תיקיות: {Number(inventory?.folderCount || 0)}</div>
        <div>קבצים: {Number(inventory?.fileCount || 0)}</div>
        <div className="pt-1 font-semibold text-slate-600">מבנה תיקיות ראשי</div>
        <div className="font-mono">{safeStr(treeName)}/</div>
        <div className="space-y-1">
          {folders.length ? folders.map((folder) => (
            <div key={`${label}-${folder}`} className="font-mono break-all">- {folder}/</div>
          )) : <div className="text-slate-400">(לא נמצאו תיקיות)</div>}
          {remainingFolders > 0 && <div className="text-slate-400">(+{remainingFolders} תיקיות נוספות)</div>}
        </div>
        <div className="pt-1 font-semibold text-slate-600">קבצים</div>
        <div className="space-y-1">
          {files.length ? files.map((file, index) => (
            <div key={`${label}-file-${file}`} className="font-mono break-all">{index + 1}. {file}</div>
          )) : <div className="text-slate-400">(לא נמצאו קבצים)</div>}
          {remainingFiles > 0 && <div className="text-slate-400">(+{remainingFiles} נוספים)</div>}
        </div>
      </div>
    );
  }

  function renderOverlapAnalysis(candidate) {
    const overlap = candidate?.overlapAnalysis || {};
    return (
      <div className="space-y-1">
        <div className="font-semibold text-slate-700">ניתוח חפיפה</div>
        <div>שמות קבצים תואמים: {Number(overlap?.matchingFileNames || 0)}</div>
        <div>קבצי מקור ייחודיים: {Number(overlap?.uniqueSourceFiles || 0)}</div>
        <div>קבצי יעד ייחודיים: {Number(overlap?.uniqueTargetFiles || 0)}</div>
        <div>קונפליקטים פוטנציאליים: {Number(overlap?.potentialConflicts || 0)}</div>
        <div className="pt-1 font-semibold text-slate-600">דוגמאות לקונפליקטים</div>
        <div className="space-y-1">
          {safeArray(overlap?.exampleConflicts).length ? safeArray(overlap?.exampleConflicts).map((fileName) => (
            <div key={`conflict-${fileName}`} className="font-mono break-all">{fileName}</div>
          )) : <div className="text-slate-400">אין</div>}
        </div>
      </div>
    );
  }

  function buildMergeReviewReportMarkdown() {
    const generated = new Date().toISOString();
    const overallRiskLevel = getOverallMergeRiskLevel(reportMergeCandidates);
    const candidateSections = reportMergeCandidates.map((candidate, index) => {
      const action = findActionPlanForCandidate(candidate);
      const sourceTree = safeStr(candidate?.sourceTree || candidate?.duplicateTree);
      const targetTree = safeStr(candidate?.targetTree || candidate?.canonicalTree);
      const actionType = getCandidateDisplayActionType(candidate, action);
      const sourceInventory = candidate?.sourceInventory || {};
      const targetInventory = candidate?.targetInventory || {};
      const overlap = candidate?.overlapAnalysis || {};
      return [
        `## מועמד ${index + 1}`,
        ``,
        `עץ מקור:`,
        `${sourceTree}`,
        ``,
        `עץ יעד:`,
        `${targetTree}`,
        ``,
        `סוג פעולה:`,
        `${actionType}`,
        ``,
        `סטטוס:`,
        `${getCandidateStatusLabel(candidate)}`,
        ``,
        `רמת ביטחון:`,
        `${Number(candidate?.confidence || action?.confidence || 0)}%`,
        ``,
        `רמת סיכון:`,
        `${getCandidateRiskLabel(candidate)}`,
        ``,
        `סיבה:`,
        `${getCandidateReviewReason(candidate)}`,
        ``,
        `קיים במקור:`,
        `${formatYesNo(candidate?.sourceExists)}`,
        ``,
        `קיים ביעד:`,
        `${formatYesNo(candidate?.targetExists)}`,
        ``,
        `נתיב פיזי קיים:`,
        `${formatYesNo(candidate?.physicalPathExists)}`,
        ``,
        `קבצים פיזיים שנמצאו:`,
        `${Number(candidate?.physicalFileCount || 0)}`,
        ``,
        `תיקיות פיזיות שנמצאו:`,
        `${Number(candidate?.physicalFolderCount || 0)}`,
        ``,
        `מספר קבצי מקור:`,
        `${Number(sourceInventory?.fileCount || candidate?.sourceFileCount || 0)}`,
        ``,
        `מספר תיקיות מקור:`,
        `${Number(sourceInventory?.folderCount || candidate?.sourceFolderCount || 0)}`,
        ``,
        `מספר קבצי יעד:`,
        `${Number(targetInventory?.fileCount || candidate?.targetFileCount || 0)}`,
        ``,
        `מספר תיקיות יעד:`,
        `${Number(targetInventory?.folderCount || candidate?.targetFolderCount || 0)}`,
        ``,
        `קבצים מובילים:`,
        ...(safeArray(sourceInventory?.previewFiles).length
          ? safeArray(sourceInventory.previewFiles).slice(0, 5).map((file) => `- ${file}`)
          : ['- אין']),
        ``,
        `📂 תצוגת תוכן העץ`,
        ``,
        ...formatInventoryMarkdown(sourceTree, candidate?.sourceInventory, 'מקור'),
        ...formatInventoryMarkdown(targetTree, candidate?.targetInventory, 'יעד'),
        ...formatOverlapMarkdown(overlap),
        `פעולה מומלצת:`,
        `${getCandidateReviewRecommendation(candidate, action)}`,
        ``,
        `---`,
        ``,
      ].join("\n");
    });

    const plannedActions = reportActionPlan.length
      ? reportActionPlan.map((action, index) => {
        const sourceTree = safeStr(action?.sourceTree || action?.sourcePath || action?.from);
        const targetTree = safeStr(action?.targetTree || action?.targetPath || action?.to);
        return `${index + 1}. ${getActionTypeLabel(action?.type || "MANUAL_REVIEW")}\n   ${sourceTree} -> ${targetTree}`;
      })
      : ["1. לא נוצרו פעולות מתוכננות"];

    return [
      `# דוח בדיקת מיזוג Vault`,
      ``,
      `נוצר: ${generated}`,
      ``,
      `## סיכום`,
      ``,
      `מועמדי מיזוג: ${reportMergeCandidates.length}`,
      `עצים כפולים: ${duplicateRootsCount}`,
      `קונפליקטים: ${reportConflicts.length}`,
      `קבצים להעברה: ${Number(report?.summary?.toMove || 0)}`,
      `קבצים לארכיון: ${Number(report?.summary?.toArchive || 0)}`,
      ``,
      `---`,
      ``,
      ...(candidateSections.length ? candidateSections : ["לא זוהו מועמדי מיזוג.", "", "---", ""]),
      `## תוכנית פעולה`,
      ``,
      ...plannedActions,
      ``,
      `---`,
      ``,
      `רמת סיכון כללית: ${getRiskLevelLabel(overallRiskLevel)}`,
      ``,
      `---`,
      ``,
      `שאלה ל-AI:`,
      ``,
      `האם כדאי לבצע את המיזוגים האלה?`,
      `האם יש כאן מיזוגים מסוכנים?`,
      `האם היית משנה פעולה מומלצת כלשהי?`,
    ].join("\n");
  }

  function buildMergeReportMarkdown(entries) {
    const generated = new Date().toISOString();
    const actionLines = [];
    const archiveCount = Number(report?.summary?.toArchive || 0);
    const plannedMergeCount = reportActionPlan.filter((action) => ['MERGE_CONTENT', 'RENAME_TREE', 'MOVE_TREE'].includes(safeStr(action?.type))).length;
    const overallRiskLevel = getOverallMergeRiskLevel(reportMergeCandidates);
    const duplicateTreeSections = reportMergeCandidates.map((candidate, index) => [
      `### עץ כפול ${index + 1}`,
      ``,
      `עץ מקור: ${safeStr(candidate?.sourceTree || candidate?.duplicateTree)}`,
      `עץ יעד: ${safeStr(candidate?.targetTree || candidate?.canonicalTree)}`,
      `נתיב מקור: ${safeStr(candidate?.sourcePath)}`,
      `נתיב יעד: ${safeStr(candidate?.targetPath)}`,
      `סוג מיזוג: ${getActionTypeLabel(candidate?.mergeType || safeStr(findActionPlanForCandidate(candidate)?.type))}`,
      `סטטוס: ${getCandidateStatusLabel(candidate)}`,
      `רמת סיכון: ${getCandidateRiskLabel(candidate)}`,
      `קיים במקור: ${formatYesNo(candidate?.sourceExists)}`,
      `קיים ביעד: ${formatYesNo(candidate?.targetExists)}`,
      `נתיב פיזי קיים: ${formatYesNo(candidate?.physicalPathExists)}`,
      `קבצים פיזיים שנמצאו: ${Number(candidate?.physicalFileCount || 0)}`,
      `תיקיות פיזיות שנמצאו: ${Number(candidate?.physicalFolderCount || 0)}`,
      `מספר קבצים: ${candidate?.fileCount ?? candidate?.sourceFileCount ?? 0}`,
      `רמת ביטחון: ${candidate?.confidence ?? 0}%${candidate?.confidence >= 90 ? '' : ' ⚠ מומלץ לבדיקה ידנית'}`,
      `פעולה מומלצת: ${getCandidateReviewRecommendation(candidate, findActionPlanForCandidate(candidate))}`,
      `סיבה: ${getCandidateReviewReason(candidate)}`,
      ``,
      `📂 תצוגת תוכן העץ`,
      ``,
      ...formatInventoryMarkdown(safeStr(candidate?.sourceTree || candidate?.duplicateTree), candidate?.sourceInventory, 'מקור'),
      ...formatInventoryMarkdown(safeStr(candidate?.targetTree || candidate?.canonicalTree), candidate?.targetInventory, 'יעד'),
      ...formatOverlapMarkdown(candidate?.overlapAnalysis),
    ].join('\n'));
    safeArray(reportActionPlan).forEach((action, index) => {
      const sourcePath = safeStr(action?.sourcePath || action?.from || action?.sourceTree);
      const targetPath = safeStr(action?.targetPath || action?.to || action?.targetTree);
      const confidence = Number(action?.confidence || 0);
      const reason = safeStr(action?.reason);
      actionLines.push(`${index + 1}. ${getActionTypeLabel(action?.type || 'MANUAL_REVIEW')}: ${sourcePath}${targetPath ? ` -> ${targetPath}` : ''}${confidence ? ` (${confidence}%)` : ''}${reason ? ` - ${reason}` : ''}`.trim());
    });
    safeArray(entries).forEach((entry, index) => {
      const rec = entry?.recommendation || {};
      actionLines.push(`${actionLines.length + 1}. ${getRecommendationLabel(rec.recommendedAction || 'Manual Review')} -> ${safeStr(rec.previewTargetPath || rec.targetPath || getConflictPath(entry?.conflict, 'target'))} (${rec.confidence ?? 0}%)`);
    });

    const sections = safeArray(entries).map((entry, index) => {
      const conflict = entry?.conflict || {};
      const rec = entry?.recommendation || {};
      const sourceTree = safeStr(getConflictPath(conflict, 'source')).split('/').filter(Boolean)[0] || '—';
      const targetTree = safeStr(getConflictPath(conflict, 'target')).split('/').filter(Boolean)[0] || '—';
      return [
        `## קונפליקט ${index + 1}`,
        ``,
        `עץ מקור:`,
        `${sourceTree}`,
        ``,
        `עץ יעד:`,
        `${targetTree}`,
        ``,
        `קובץ מקור:`,
        `${safeStr(rec.sourcePath || getConflictPath(conflict, 'source'))}`,
        ``,
        `קובץ יעד:`,
        `${safeStr(rec.targetPath || getConflictPath(conflict, 'target'))}`,
        ``,
        `סוג קונפליקט:`,
        `${safeStr(conflict?.reason) || 'שם קובץ כפול'}`,
        ``,
        `שורות שקיימות רק במקור:`,
        `${rec.linesOnlyInSource ?? 0}`,
        ``,
        `שורות שקיימות רק ביעד:`,
        `${rec.linesOnlyInTarget ?? 0}`,
        ``,
        `שורות משותפות:`,
        `${rec.sharedLines ?? 0}`,
        ``,
        `פעולה מומלצת:`,
        `${getRecommendationLabel(rec.recommendedAction || 'Manual Review')}`,
        ``,
        `רמת ביטחון:`,
        `${rec.confidence ?? 0}%${rec.manualReviewRecommended ? ' ⚠ מומלץ לבדיקה ידנית' : ''}`,
        ``,
        `סיבה:`,
        `${safeStr(rec.reason)}`,
        ``,
        `אותות ששימשו להחלטה:`,
        ...safeArray(rec.signals).map((signal) => `- ${signal}`),
        ``,
        `נתיב יעד מוצע:`,
        `${safeStr(rec.previewTargetPath || rec.targetPath || getConflictPath(conflict, 'target'))}`,
        ``,
        `---`,
        ``,
      ].join('\n');
    });

    return [
      `# דוח מיזוג Vault`,
      ``,
      `נוצר:`,
      `${generated}`,
      ``,
      `## סיכום`,
      ``,
      `קונפליקטים שנמצאו: ${reportConflicts.length}`,
      `עצים כפולים: ${duplicateRootsCount}`,
      `קבצים למיזוג: ${plannedMergeCount || safeArray(entries).filter((entry) => safeStr(entry?.recommendation?.recommendedAction) === 'Merge').length}`,
      `קבצים לארכיון: ${archiveCount}`,
      ``,
      `---`,
      ``,
      `## עצים כפולים שנמצאו`,
      ``,
      ...(duplicateTreeSections.length ? duplicateTreeSections : ['לא זוהו מועמדי עץ כפול.', '']),
      ...sections,
      `## תוכנית פעולה`,
      ``,
      ...(actionLines.length ? actionLines : ['1. לא הומלצו פעולות מיזוג']),
      ``,
      `---`,
      ``,
      `## בדיקת בטיחות`,
      ``,
      `רמת סיכון כללית: ${getRiskLevelLabel(overallRiskLevel)}`,
      `קבצים שנמחקו: 0`,
      `קבצים שהועברו לארכיון: ${archiveCount}`,
      `קבצים שמוזגו: ${plannedMergeCount || safeArray(entries).filter((entry) => safeStr(entry?.recommendation?.recommendedAction) === 'Merge').length}`,
      `נדרש גיבוי: כן`,
      ``,
      `---`,
    ].join('\n');
  }

  async function handleGenerateMergeReport() {
    if (!report) return;
    setGeneratingMergeReport(true);
    setError(null);
    try {
      const entries = await ensureConflictDiffsForReport();
      const markdown = buildMergeReportMarkdown(entries);
      console.log('[VaultMigration] rawDuplicateCounterSource', rawDuplicateCounterSource);
      console.log('[VaultMigration] duplicateTrees', reportDuplicateTrees);
      console.log('[VaultMigration] mergeCandidates', reportMergeCandidates);
      console.log('[VaultMigration] actionPlan', reportActionPlan);
      setMergeReportMarkdown(markdown);
      setMergeReportMeta({
        generatedAt: new Date().toISOString(),
        conflicts: reportConflicts.length,
        duplicateTrees: duplicateRootsCount,
        mergeCandidates: reportMergeCandidates.length || safeArray(entries).filter((entry) => safeStr(entry?.recommendation?.recommendedAction) === 'Merge').length,
        archiveCandidates: Number(report?.summary?.toArchive || 0),
      });
    } catch (err) {
      setError(err.message);
      setPhase("error");
    } finally {
      setGeneratingMergeReport(false);
    }
  }

  async function copyMergeReportToClipboard(withToastMessage = true) {
    if (!mergeReportMarkdown) return;
    await navigator.clipboard.writeText(mergeReportMarkdown);
    if (withToastMessage) toast.success('דוח המיזוג הועתק ללוח');
  }

  async function handleCopyMergeReviewReport() {
    if (!report) return;
    const markdown = buildMergeReviewReportMarkdown();
    await navigator.clipboard.writeText(markdown);
    toast.success("דוח הבדיקה הועתק ללוח");
  }

  function handleDownloadMergeReviewReport() {
    if (!report) return;
    const markdown = buildMergeReviewReportMarkdown();
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vault-merge-review.md";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleAskAi() {
    if (!mergeReportMarkdown) return;
    await copyMergeReportToClipboard(false);
    toast.success('דוח המיזוג הועתק. אפשר להדביק אותו ל-AI חיצוני לבדיקה.');
  }

  async function handleApplyConflictResolutions() {
    if (!conflictDiffs.length) return;
    setExecuting(true);
    setError(null);
    try {
      const lowConfidenceAutoMerge = conflictDiffs.find((entry) => {
        const conflict = entry?.conflict || {};
        const conflictKey = conflict.id || `${getConflictPath(conflict, 'source')}__${getConflictPath(conflict, 'target')}`;
        const resolution = conflictResolutions[conflictKey] || {};
        const action = safeStr(resolution.action || 'skip');
        const confidence = Number(entry?.recommendation?.confidence || 0);
        return ['merge_both', 'replace_with_source'].includes(action) && confidence < 70;
      });
      if (lowConfidenceAutoMerge) {
        throw new Error('יש קונפליקט עם רמת ביטחון מתחת ל-70%. נדרשת בדיקה ידנית לפני מיזוג אוטומטי.');
      }

      const resolutions = conflictDiffs.map((entry) => {
        const conflict = entry?.conflict || {};
        const conflictKey = conflict.id || `${getConflictPath(conflict, 'source')}__${getConflictPath(conflict, 'target')}`;
        const resolution = conflictResolutions[conflictKey] || {};
        return {
          sourcePath: safeStr(resolution.sourcePath || getConflictPath(conflict, 'source')),
          targetPath: safeStr(resolution.targetPath || getConflictPath(conflict, 'target')),
          action: safeStr(resolution.action || 'skip'),
          mergedContent: safeStr(resolution.mergedContent || entry?.merged),
        };
      });

      const resolveRes = await fetch("/api/vault/resolve-conflict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutions, confirmed: true }),
      });
      const resolveData = await resolveRes.json();
      if (!resolveRes.ok || !resolveData?.ok) {
        throw new Error(safeStr(resolveData?.error) || "פתרון הקונפליקטים נכשל");
      }

      setConflictRunResult(resolveData);
      const nextReport = await scanVaultDuplicates("report");
      if (!safeArray(nextReport?.conflicts).length) {
        setConflictDiffs([]);
        setConflictResolutions({});
      }
    } catch (err) {
      setError(err.message);
      setPhase("error");
    } finally {
      setExecuting(false);
    }
  }

  function handleReset() {
    setPhase("idle");
    setReport(null);
    setError(null);
    setExecResult(null);
    setMigrationReport(null);
    setMergeReportMarkdown("");
    setMergeReportMeta(null);
    setConflictDiffs([]);
    setConflictResolutions({});
    setConflictRunResult(null);
    setLoadingConflicts(false);
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-800 dark:text-zinc-200 mb-1">איחוד עצי Vault כפולים</h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          סריקה, פתרון קונפליקטים, גיבוי ומיזוג מבוקר בלי למחוק קבצים אוטומטית.
        </p>
      </div>

      {mode === 'auto' && report && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "מועמדי מיזוג", value: reportMergeCandidates.length, color: "text-indigo-600" },
            { label: "עצים כפולים", value: duplicateRootsCount, color: "text-amber-600 font-semibold" },
            { label: "קונפליקטים", value: report?.summary?.conflicts, color: "text-red-500 font-semibold" },
            { label: "קבצים לארכיון", value: report?.summary?.toArchive, color: "text-slate-500" },
            { label: "קבצים להעברה", value: report?.summary?.toMove, color: "text-blue-600" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className={`text-2xl font-bold ${item.color}`}>{item.value ?? 0}</div>
              <div className="text-xs text-slate-500">{item.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
        <button type="button" onClick={() => setMode('auto')} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === 'auto' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-500 hover:text-slate-700'}`}>
          אוטומטי
        </button>
        <button type="button" onClick={() => setMode('manual')} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === 'manual' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-500 hover:text-slate-700'}`}>
          <GitMerge className="h-3.5 w-3.5" /> ידני
        </button>
        <button type="button" onClick={() => setMode('semantic')} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === 'semantic' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-500 hover:text-slate-700'}`}>
          <Lightbulb className="h-3.5 w-3.5" /> הצעות חיבור
        </button>
      </div>

      {mode === 'manual' && <ManualMergePanel />}
      {mode === 'semantic' && <SemanticSuggestionsPanel />}

      {mode === 'auto' && (
        <>
          <div className="flex flex-wrap gap-2">
            {phase === "idle" && (
              <button type="button" onClick={handleScan} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                <FolderSync className="h-4 w-4" />
                סרוק כפילויות
              </button>
            )}
            {phase === "scanning" && (
              <button type="button" disabled className="inline-flex items-center gap-2 rounded-xl bg-indigo-400 px-4 py-2 text-sm font-medium text-white cursor-not-allowed">
                <Loader2 className="h-4 w-4 animate-spin" />
                סורק...
              </button>
            )}
            {(phase === "report" || phase === "conflict-review") && (
              <>
                <button type="button" onClick={handleGenerateMergeReport} disabled={generatingMergeReport || loadingConflicts} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  {generatingMergeReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  📄 צור דוח מיזוג
                </button>
                <button type="button" onClick={handleCopyMergeReviewReport} disabled={loadingConflicts || !reportMergeCandidates.length} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  📋 העתק דוח לבדיקה
                </button>
                <button type="button" onClick={handleDownloadMergeReviewReport} disabled={!reportMergeCandidates.length} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  <Download className="h-4 w-4" />
                  הורד דוח בדיקה .md
                </button>
                {reportConflicts.length > 0 && (
                  <button type="button" onClick={handleLoadConflicts} disabled={loadingConflicts} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                    {loadingConflicts ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                    פתור קונפליקטים לפני מיזוג ({reportConflicts.length})
                  </button>
                )}
                {reportConflicts.length === 0 && (
                  <button type="button" onClick={handleExecute} disabled={executing || !reportActionPlan.length || invalidMergeCandidates.length > 0} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                    {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    אשר מיזוג
                  </button>
                )}
                {phase === "conflict-review" && (
                  <button type="button" onClick={handleApplyConflictResolutions} disabled={executing} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                    {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    החל פתרונות ורענן סריקה
                  </button>
                )}
                <button type="button" onClick={handleReset} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <X className="h-4 w-4" />
                  בטל
                </button>
              </>
            )}
            {phase === "comparing" && (
              <button type="button" disabled className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-sm font-medium text-white cursor-not-allowed">
                <Loader2 className="h-4 w-4 animate-spin" />
                טוען קונפליקטים...
              </button>
            )}
            {(phase === "done" || phase === "error") && (
              <button type="button" onClick={handleReset} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <RefreshCw className="h-4 w-4" />
                סרוק שוב
              </button>
            )}
          </div>

          {phase === "error" && error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              שגיאה: {error}
            </div>
          )}

          {invalidMergeCandidates.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              מועמד מיזוג לא תקין
            </div>
          )}

          {conflictRunResult && (phase === "report" || phase === "conflict-review") && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800 space-y-1">
              <div className="font-semibold">פתרון הקונפליקטים הוחל והסריקה עודכנה.</div>
              <div className="text-xs">נפתרו: {conflictRunResult.resolvedCount ?? 0} | נשארו פתוחים: {conflictRunResult.unresolvedCount ?? 0}</div>
              <div className="text-xs font-mono break-all">ארכיון: {safeStr(conflictRunResult.archiveDir)}</div>
              <div className="text-xs font-mono break-all">גיבוי: {safeStr(conflictRunResult.backupDir)}</div>
            </div>
          )}

          {mergeReportMarkdown && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2 justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-800">דוח מיזוג Vault</div>
                  {mergeReportMeta && (
                    <div className="text-xs text-slate-500">
                      קונפליקטים: {mergeReportMeta.conflicts} | עצים כפולים: {mergeReportMeta.duplicateTrees} | מועמדי מיזוג: {mergeReportMeta.mergeCandidates}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => copyMergeReportToClipboard(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    העתק
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob([mergeReportMarkdown], { type: "text/markdown;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = "vault-merge-report.md";
                      link.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    הורד .md
                  </button>
                  <button type="button" onClick={handleAskAi} className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
                    שאל AI
                  </button>
                </div>
              </div>
              <textarea
                readOnly
                value={mergeReportMarkdown}
                rows={18}
                className="w-full px-4 py-3 text-xs font-mono text-slate-700 bg-white resize-y focus:outline-none"
              />
            </div>
          )}

          {(phase === "report" || phase === "conflict-review") && report && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-700">
                פאנל בדיקות
              </div>
              <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-4">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-600">מקור גולמי למונה הכפילויות</div>
                  <pre className="max-h-56 overflow-auto rounded-lg bg-white p-3 text-[11px] text-slate-700">{JSON.stringify(rawDuplicateCounterSource, null, 2)}</pre>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-600">עצים כפולים - נתונים גולמיים</div>
                  <pre className="max-h-56 overflow-auto rounded-lg bg-white p-3 text-[11px] text-slate-700">{JSON.stringify(reportDuplicateTrees, null, 2)}</pre>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-600">מועמדי מיזוג - נתונים גולמיים</div>
                  <pre className="max-h-56 overflow-auto rounded-lg bg-white p-3 text-[11px] text-slate-700">{JSON.stringify(reportMergeCandidates, null, 2)}</pre>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-600">תוכנית פעולה - נתונים גולמיים</div>
                  <pre className="max-h-56 overflow-auto rounded-lg bg-white p-3 text-[11px] text-slate-700">{JSON.stringify(reportActionPlan, null, 2)}</pre>
                </div>
              </div>
            </div>
          )}

          {phase === "done" && execResult && (
            <div className="space-y-4">
              <div className={`rounded-xl border px-4 py-3 space-y-1 ${migrationReport?.allOk === false ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                <div className={`font-semibold text-sm ${migrationReport?.allOk === false ? "text-amber-800" : "text-emerald-800"}`}>
                  {migrationReport?.allOk === false ? "המיזוג הושלם עם הערות" : "המיזוג הושלם בהצלחה"}
                </div>
                {execResult?.cleanupCompleted && (
                  <div className="text-sm font-semibold text-emerald-700">✅ ניקוי ה-Vault הושלם</div>
                )}
                <div className="text-xs text-slate-700">הועברו: {execResult.moved} | אוכסנו: {execResult.archived} | נוקו פריטי מטא־דאטה: {Number(execResult?.metadataCleaned || 0)} | שגיאות: {execResult.errors}</div>
                {execResult.archiveBase && <div className="text-xs font-mono break-all">גיבוי: {safeStr(execResult.archiveBase)}</div>}
                {migrationReport?.reportPath && <div className="text-xs font-mono break-all">דוח: {safeStr(migrationReport.reportPath)}</div>}
              </div>

              {safeArray(migrationReport?.verifications).length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">תוצאות אימות</div>
                  <table className="w-full text-xs">
                    <tbody>
                      {safeArray(migrationReport?.verifications).map((verification, index) => (
                        <tr key={index} className={`border-b border-slate-100 last:border-0 ${verification?.ok ? "" : "bg-amber-50"}`}>
                          <td className="px-4 py-2 text-slate-700">{safeStr(verification?.check)}</td>
                          <td className={`px-4 py-2 font-mono font-semibold ${verification?.ok ? "text-emerald-600" : "text-amber-600"}`}>{safeStr(verification?.detail)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {phase === "conflict-review" && conflictDiffs.length > 0 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <strong>פתרון קונפליקטים ({conflictDiffs.length})</strong> בחר לכל קובץ אם לשמור את היעד, להחליף, למזג, לארכב או לדלג.
              </div>

              {conflictDiffs.map((entry, index) => {
                const conflict = entry?.conflict || {};
                const conflictKey = conflict.id || `${getConflictPath(conflict, 'source')}__${getConflictPath(conflict, 'target')}`;
                const resolution = conflictResolutions[conflictKey] || {};
                const sourcePath = safeStr(resolution.sourcePath || getConflictPath(conflict, 'source'));
                const targetPath = safeStr(resolution.targetPath || getConflictPath(conflict, 'target'));
                const action = safeStr(resolution.action || 'skip');
                const recommendation = entry?.recommendation || {};
                return (
                  <div key={conflictKey} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 space-y-1 text-xs">
                      <div className="text-sm font-semibold text-slate-800">קונפליקט #{index + 1}</div>
                      <div><span className="font-semibold">מקור:</span> <span className="font-mono break-all">{safePathDisplay(sourcePath)}</span></div>
                      <div><span className="font-semibold">יעד:</span> <span className="font-mono break-all">{safePathDisplay(targetPath)}</span></div>
                      <div><span className="font-semibold">סטטוס:</span> {getConflictStatusLabel(entry?.status || conflict?.status)}</div>
                      <div><span className="font-semibold">סיבה:</span> {safeStr(conflict?.reason) || '—'}</div>
                    </div>

                    <div className="p-4 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: 'keep_target', label: 'שמור יעד', color: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
                          { key: 'replace_with_source', label: 'החלף במקור', color: 'border-red-200 bg-red-50 text-red-700' },
                          { key: 'merge_both', label: 'מזג את שניהם', color: 'border-violet-200 bg-violet-50 text-violet-700' },
                          { key: 'archive_source', label: 'העבר מקור לארכיון', color: 'border-slate-200 bg-slate-50 text-slate-700' },
                          { key: 'skip', label: 'דלג', color: 'border-amber-200 bg-amber-50 text-amber-700' },
                        ].map((item) => (
                          <button key={item.key} type="button" onClick={() => updateConflictResolution(conflictKey, { action: item.key })} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${action === item.key ? item.color : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                            {item.label}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">תצוגת מקור</div>
                          <div className="max-h-52 overflow-y-auto p-3 text-xs font-mono space-y-1">
                            {safeArray(entry?.diff).filter((line) => line?.type !== 'only_b').map((line, lineIndex) => (
                              <div key={lineIndex} className={`whitespace-pre-wrap break-all ${line?.type === 'only_a' ? 'bg-red-50 text-red-700' : 'text-slate-400'}`}>
                                {safeStr(line?.line) || ' '}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">תצוגת יעד</div>
                          <div className="max-h-52 overflow-y-auto p-3 text-xs font-mono space-y-1">
                            {safeArray(entry?.diff).filter((line) => line?.type !== 'only_a').map((line, lineIndex) => (
                              <div key={lineIndex} className={`whitespace-pre-wrap break-all ${line?.type === 'only_b' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-400'}`}>
                                {safeStr(line?.line) || ' '}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {action === 'merge_both' && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-600">תוכן ממוזג</label>
                          <textarea
                            value={safeStr(resolution.mergedContent)}
                            onChange={(event) => updateConflictResolution(conflictKey, { mergedContent: event.target.value })}
                            rows={10}
                            dir="rtl"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(phase === "report" || phase === "executing") && report && (
            <div className="space-y-5">
              <div className="hidden grid-cols-2 gap-3 sm:grid-cols-6">
                {[
                  { label: "להעברה", value: report?.summary?.toMove, color: "text-blue-600" },
                  { label: "לארכיב", value: report?.summary?.toArchive, color: "text-slate-500" },
                  { label: "קונפליקטים", value: report?.summary?.conflicts, color: "text-red-500 font-semibold" },
                  { label: "עצים כפולים", value: duplicateRootsCount, color: "text-amber-600 font-semibold" },
                  { label: "מועמדי מיזוג", value: reportMergeCandidates.length, color: "text-indigo-600" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className={`text-2xl font-bold ${item.color}`}>{item.value ?? 0}</div>
                    <div className="text-xs text-slate-500">{item.label}</div>
                  </div>
                ))}
              </div>

              {reportConflicts.length > 0 && (
                <div className="space-y-2">
                  {reportConflicts.map((conflict, index) => (
                    <div key={conflict?.id || index} className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-xs space-y-1">
                      <div className="font-semibold text-red-800">קונפליקט #{index + 1}</div>
                      <div><span className="font-semibold">מקור:</span> <span className="font-mono break-all">{safePathDisplay(getConflictPath(conflict, 'source'))}</span></div>
                      <div><span className="font-semibold">יעד:</span> <span className="font-mono break-all">{safePathDisplay(getConflictPath(conflict, 'target'))}</span></div>
                      <div><span className="font-semibold">סטטוס:</span> {getConflictStatusLabel(conflict?.status)}</div>
                      <div><span className="font-semibold">סיבה:</span> {safeStr(conflict?.reason) || '—'}</div>
                    </div>
                  ))}
                </div>
              )}

              {(report?.summary?.manualReview ?? 0) > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                  <span className="font-semibold">בדיקה ידנית:</span> {report?.summary?.manualReview ?? 0}
                </div>
              )}

              {reportMergeCandidates.length > 0 && (
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={showFullTreeContents}
                    onChange={(event) => setShowFullTreeContents(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  הצג את כל תוכן העץ
                </label>
              )}

              {/* Empty tree cleanup success notification */}
              {emptyTreeResult?.success && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  הרשומה הכפולה הוסרה
                </div>
              )}

              {/* Empty trees — separate cleanup flow */}
              {emptyTreeCandidates.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">🟢 עצים ריקים ({emptyTreeCandidates.length})</h3>
                  <div className="space-y-2">
                    {emptyTreeCandidates.map((candidate, index) => {
                      const treeName = safeStr(candidate.sourceTree || candidate.duplicateTree);
                      return (
                        <div key={`empty__${treeName}__${index}`} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 space-y-3 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">🟢 עץ ריק</span>
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">סיכון: נמוכה</span>
                          </div>
                          <div className="space-y-1 text-xs text-slate-700 dark:text-zinc-300">
                            <div><span className="font-semibold">שם העץ:</span> <span className="font-mono">{treeName}</span></div>
                            <div><span className="font-semibold">Canonical:</span> <span className="font-mono">{safeStr(candidate.targetTree || candidate.canonicalTree)}</span></div>
                          </div>
                          <div className="rounded-lg border border-emerald-100 bg-white/70 px-3 py-2 space-y-1 dark:border-emerald-900/30 dark:bg-zinc-900/50">
                            <div className="mb-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">אימות ריקנות העץ</div>
                            {["לא נמצאו קבצים פיזיים", "לא נמצאו תיקיות פיזיות", "לא נמצאו קונפליקטים", "לא יועבר שום תוכן"].map(msg => (
                              <div key={msg} className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                {msg}
                              </div>
                            ))}
                          </div>
                          <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300">מומלץ למחוק את הרשומה הכפולה</div>
                          <div className="flex items-center justify-end gap-2" dir="rtl">
                            <button
                              type="button"
                              onClick={() => setEmptyTreeResult(null)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            >
                              בטל
                            </button>
                            <button
                              type="button"
                              onClick={() => setEmptyTreeConfirm(candidate)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                            >
                              🧹 מחק רשומה
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Regular merge candidates (with actual content) */}
              {mergeCandidatesOnly.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-indigo-700 mb-2">עצים כפולים שנמצאו ({mergeCandidatesOnly.length})</h3>
                  <div className="space-y-2">
                    {mergeCandidatesOnly.map((candidate, index) => (
                      <div key={`${safeStr(candidate?.duplicateTree)}__${safeStr(candidate?.canonicalTree)}__${index}`} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-3 text-xs space-y-3">
                        <div><span className="font-semibold">עץ מקור:</span> <span className="font-mono">{safeStr(candidate?.sourceTree || candidate?.duplicateTree)}</span></div>
                        <div><span className="font-semibold">עץ יעד:</span> <span className="font-mono">{safeStr(candidate?.targetTree || candidate?.canonicalTree)}</span></div>
                        <div><span className="font-semibold">נתיב מקור:</span> <span className="font-mono break-all">{safeStr(candidate?.sourcePath)}</span></div>
                        <div><span className="font-semibold">נתיב יעד:</span> <span className="font-mono break-all">{safeStr(candidate?.targetPath)}</span></div>
                        <div><span className="font-semibold">סוג פעולה:</span> {getActionTypeLabel(candidate?.mergeType || safeStr(findActionPlanForCandidate(candidate)?.type))}</div>
                        <div><span className="font-semibold">סטטוס:</span> בדיקת מיזוג תוכן</div>
                        <div><span className="font-semibold">רמת סיכון:</span> {getCandidateRiskLabel(candidate)}</div>
                        <div><span className="font-semibold">קיים במקור:</span> {formatYesNo(candidate?.sourceExists)}</div>
                        <div><span className="font-semibold">קיים ביעד:</span> {formatYesNo(candidate?.targetExists)}</div>
                        <div><span className="font-semibold">נתיב פיזי קיים:</span> {formatYesNo(candidate?.physicalPathExists)}</div>
                        <div><span className="font-semibold">קבצים פיזיים שנמצאו:</span> {Number(candidate?.physicalFileCount || 0)}</div>
                        <div><span className="font-semibold">תיקיות פיזיות שנמצאו:</span> {Number(candidate?.physicalFolderCount || 0)}</div>
                        <div><span className="font-semibold">מספר קבצים:</span> {candidate?.fileCount ?? candidate?.sourceFileCount ?? 0}</div>
                        <div><span className="font-semibold">רמת ביטחון:</span> {candidate?.confidence ?? 0}%</div>
                        <div className="rounded-lg border border-white/70 bg-white/80 p-3 space-y-4">
                          <div className="font-semibold text-slate-800">📂 תצוגת תוכן העץ</div>
                          {renderInventorySection(safeStr(candidate?.sourceTree || candidate?.duplicateTree), candidate?.sourceInventory, 'מקור')}
                          {renderInventorySection(safeStr(candidate?.targetTree || candidate?.canonicalTree), candidate?.targetInventory, 'יעד')}
                          {renderOverlapAnalysis(candidate)}
                        </div>
                        <div><span className="font-semibold">פעולה מומלצת:</span> {getCandidateReviewRecommendation(candidate, findActionPlanForCandidate(candidate))}</div>
                        <div><span className="font-semibold">סיבה:</span> {getCandidateReviewReason(candidate)}</div>
                        {safeStr(candidate?.sourceTree || candidate?.duplicateTree) === safeStr(candidate?.targetTree || candidate?.canonicalTree) && safeStr(candidate?.sourcePath) !== safeStr(candidate?.targetPath) && (
                          <div className="text-amber-700 font-semibold">זוהה אותו שם עץ, אבל הנתיבים שונים. כדאי לבדוק את שני הנתיבים המלאים לפני מיזוג.</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reportActionPlan.length > 0 && (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {reportActionPlan.map((action, index) => {
                    const tag = ACTION_LABELS[action?.type] || { label: safeStr(action?.type), color: "bg-gray-50 text-gray-500 border-gray-200" };
                    const sourcePath = safeStr(action?.sourcePath || action?.from || action?.sourceTree);
                    const targetPath = safeStr(action?.targetPath || action?.to || action?.targetTree);
                    return (
                      <div key={index} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${tag.color}`}>
                        <span className="shrink-0 font-semibold">{tag.label}</span>
                        <span className="font-mono break-all text-current/80">{sourcePath}</span>
                        {targetPath && <><span className="shrink-0">→</span><span className="font-mono break-all">{targetPath}</span></>}
                        {Number(action?.confidence || 0) > 0 && <span className="shrink-0 text-current/70">({Number(action?.confidence || 0)}%)</span>}
                        {action?.reason && <span className="text-current/60 shrink-0 mr-auto">({safeStr(action.reason)})</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Empty tree deletion confirmation dialog */}
      {emptyTreeConfirm && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => { if (!deletingEmptyTree) setEmptyTreeConfirm(null); }}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-zinc-800 dark:bg-zinc-950"
            dir="rtl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">האם אתה בטוח?</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold text-slate-700 dark:text-zinc-300">שם העץ: </span>
                <span className="font-mono text-slate-800 dark:text-zinc-100">{safeStr(emptyTreeConfirm.sourceTree || emptyTreeConfirm.duplicateTree)}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-700 dark:text-zinc-300">פעולה: </span>
                <span className="text-slate-600 dark:text-zinc-400">מחיקת רשומת מטא-דאטה בלבד</span>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/30 dark:text-emerald-300">
                לא יימחקו קבצים מ-Obsidian.
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1" dir="rtl">
              <button
                type="button"
                onClick={() => setEmptyTreeConfirm(null)}
                disabled={deletingEmptyTree}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                חזור
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteEmptyTree(emptyTreeConfirm)}
                disabled={deletingEmptyTree}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {deletingEmptyTree && <Loader2 className="h-4 w-4 animate-spin" />}
                אשר מחיקה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getRssStatusTone(status) {
  if (status === "ok") return "text-emerald-700";
  if (status === "failed") return "text-red-600";
  if (status === "temporary_error") return "text-amber-700";
  if (status === "network_error" || status === "needs_proxy") return "text-sky-700";
  return "text-gray-600";
}

function getRssStatusLabel(result) {
  if (!result) return "לא נבדק";
  if (result.ok) return `תקין (${result.status})`;
  if (result.errorType === "invalid_channel_id") return "Channel ID חסר או מקוצר";
  if (result.errorType === "not_found") return "RSS 404 — ייתכן ID שגוי";
  if (result.errorType === "temporary_error") return `שגיאה זמנית (${result.status || 500})`;
  if (result.errorType === "network_error") return "שגיאת רשת / CORS";
  if (result.errorType === "needs_proxy") return "נדרש proxy לבדיקת RSS";
  return result.detail || `HTTP ${result.status || 0}`;
}

function toStoredRssState(result) {
  if (result.ok) return { rssStatus: "ok", rssError: null };
  if (result.errorType === "not_found" || result.errorType === "invalid_channel_id") {
    return { rssStatus: "failed", rssError: result.detail };
  }
  if (result.errorType === "temporary_error") {
    return { rssStatus: "temporary_error", rssError: result.detail };
  }
  if (result.errorType === "network_error") {
    return { rssStatus: "network_error", rssError: result.detail };
  }
  if (result.errorType === "needs_proxy") {
    return { rssStatus: "needs_proxy", rssError: result.detail };
  }
  return { rssStatus: "needs_proxy", rssError: result.detail || "בדיקת RSS מהדפדפן עלולה להיכשל בגלל CORS. יש להעביר דרך backend/proxy." };
}

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

function formatRelativeTime(date) {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'עכשיו';
  if (minutes < 60) return `לפני ${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  return `לפני ${Math.floor(hours / 24)} ימים`;
}

function RssTab({ videos, mentors = [], sources = [], topics = [] }) {
  // Build channel list from real DB data (Mentor + Source entities)
  const queryClient = useQueryClient();
  const [storedCount, setStoredCount] = useState(() => getVideoCount());
  /** RSS validation report for the current mentor list. */
  const [rssValidationRows, setRssValidationRows] = useState([]);
  const [validatingRss, setValidatingRss] = useState(false);

  const channels = useMemo(() => mentors.map((mentor) => {
    const source = sources.find((s) => s.mentorId === mentor.id && s.sourceType === "youtube");
    const extractedUrlId = extractChannelIdFromUrl(source?.sourceUrl);
    const channelId = extractedUrlId || mentor.youtubeChannelId || mentor.channelId || null;
    return {
      mentorId:     mentor.id,
      name:         mentor.name,
      channelName:  mentor.channelName || mentor.name,
      category:     mentor.category,
      channelId:    channelId ?? null,
      youtubeChannelId: mentor.youtubeChannelId || mentor.channelId || null,
      channelUrl:   source?.sourceUrl || mentor.channelUrl || mentor.youtubeUrl || null,
      youtubeUrl:   mentor.youtubeUrl || source?.sourceUrl || mentor.channelUrl || null,
      handle:       mentor.handle || extractHandleFromUrl(source?.sourceUrl) || null,
      rssStatus:    mentor.rssStatus || null,
      rssError:     mentor.rssError || null,
      rssCheckedAt: mentor.rssCheckedAt || null,
      channelIdResolvedAt: mentor.channelIdResolvedAt || null,
      channelIdResolveMethod: mentor.channelIdResolveMethod || null,
      isConfigured: !!channelId && !isSuspiciousChannelId(channelId),
      sourceId:     source?.id ?? null,
      sourceUrl:    source?.sourceUrl ?? null,
    };
  }), [mentors, sources]);

  const [frozenIds, setFrozenIds] = useState(() => new Set(getFrozenMentorIds()));
  const [statuses, setStatuses] = useState({});
  const [rssCheckFor, setRssCheckFor] = useState({});
  const [globalLoading, setGlobalLoading] = useState(false);
  const [resolving, setResolving] = useState({});
  const [repairingAll, setRepairingAll] = useState(false);
  const [repairLog, setRepairLog] = useState([]);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [refreshResult, setRefreshResult] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [fetchingFor, setFetchingFor] = useState({});
  const [fetchResultFor, setFetchResultFor] = useState({});
  const [scanHistory, setScanHistoryState] = useState(() => getAllScanHistory());
  const [channelSearch, setChannelSearch] = useState("");
  const [syncInfo] = useState(() => ({
    lastAt: getLastSyncAt(),
    result: getLastSyncResult(),
  }));
  const [clearVideosToast, setClearVideosToast] = useState(false);

  const configuredCount = channels.filter((c) => c.isConfigured).length;

  const createVideo = useCreateVideo();
  const updateSource = useUpdateSource();
  const createSource = useCreateSource();
  const deleteMentor = useDeleteMentor();
  const updateMentor = useUpdateMentor();

  function handleToggleFreeze(mentorId) {
    const nowFrozen = toggleMentorFreeze(mentorId);
    setFrozenIds((prev) => {
      const next = new Set(prev);
      if (nowFrozen) next.add(mentorId);
      else next.delete(mentorId);
      return next;
    });
  }

  async function persistResolvedMentor(mentor, channel, result) {
    const now = new Date().toISOString();
    const patch = {
      id: mentor.id,
      name: mentor.name,
      channelName: mentor.channelName || channel.channelName || mentor.name,
      channelUrl: result.channelUrl,
      youtubeUrl: result.youtubeUrl || result.channelUrl,
      handle: channel.handle || mentor.handle || extractHandleFromUrl(result.channelUrl),
      youtubeChannelId: result.channelId,
      channelId: result.channelId,
      rssStatus: 'ok',
      rssError: null,
      rssCheckedAt: now,
      channelIdResolvedAt: now,
      channelIdResolveMethod: result.method,
      channelIdResolveAttempts: result.attempts || [],
      channelIdResolveLastError: null,
    };
    await updateMentor.mutateAsync(patch).catch(() => null);
    if (channel.sourceId) {
      await updateSource.mutateAsync({ id: channel.sourceId, sourceUrl: result.channelUrl }).catch(() => null);
    } else if (result.channelUrl) {
      await createSource.mutateAsync({
        mentorId: mentor.id,
        sourceType: "youtube",
        sourceUrl: result.channelUrl,
        active: true,
      }).catch(() => null);
    }
  }

  async function persistFailedMentor(mentor, channel, error, attempts = []) {
    await updateMentor.mutateAsync({
      id: mentor.id,
      name: mentor.name,
      channelName: mentor.channelName || channel.channelName || mentor.name,
      channelUrl: channel.channelUrl || mentor.channelUrl || mentor.youtubeUrl || null,
      youtubeUrl: channel.youtubeUrl || mentor.youtubeUrl || mentor.channelUrl || null,
      handle: channel.handle || mentor.handle || null,
      youtubeChannelId: mentor.youtubeChannelId || mentor.channelId || null,
      channelId: mentor.channelId || mentor.youtubeChannelId || null,
      rssStatus: 'failed',
      rssError: error,
      rssCheckedAt: new Date().toISOString(),
      channelIdResolveAttempts: attempts,
      channelIdResolveLastError: error,
    }).catch(() => null);
  }

  async function handleValidateAllRss() {
    setValidatingRss(true);
    setRssValidationRows([]);
    const rows = [];

    for (const mentor of mentors) {
      const source = sources.find((s) => s.mentorId === mentor.id && s.sourceType === "youtube");
      const rawId = extractChannelIdFromUrl(source?.sourceUrl) || mentor.youtubeChannelId || null;
      if (!rawId) {
        rows.push({
          mentorId: mentor.id,
          name:     mentor.name,
          channelId: "—",
          rssStatus: "אין Channel ID",
          action:   "—",
        });
        continue;
      }

      const result = await checkChannelRssFeed(rawId);
      if (result.ok) {
        rows.push({
          mentorId: mentor.id,
          name:     mentor.name,
          channelId: rawId,
          rssStatus: `תקין (${result.status})`,
          action:   "—",
        });
      } else {
        rows.push({
          mentorId: mentor.id,
          name:     mentor.name,
          channelId: rawId,
          rssStatus: `כשל: ${result.detail || "לא ידוע"} (HTTP ${result.status || "—"})`,
          action:   "נדרש תיקון Channel ID",
        });
        await updateMentor.mutateAsync({
          id: mentor.id,
          rssStatus: 'failed',
          rssError: result.detail || `HTTP ${result.status || 0}`,
          rssCheckedAt: new Date().toISOString(),
        }).catch(() => null);
      }
    }

    setRssValidationRows(rows);
    setValidatingRss(false);
  }

  async function handleValidateAllRssV2() {
    setValidatingRss(true);
    setRssValidationRows([]);
    const rows = [];

    for (const mentor of mentors) {
      const source = sources.find((s) => s.mentorId === mentor.id && s.sourceType === "youtube");
      const rawId = extractChannelIdFromUrl(source?.sourceUrl) || mentor.youtubeChannelId || mentor.channelId || null;
      const result = rawId
        ? await checkChannelRssFeed(rawId)
        : {
            ok: false,
            channelId: "",
            rssUrl: "",
            status: 0,
            errorType: "invalid_channel_id",
            detail: "Channel ID חסר או מקוצר",
            needsRepair: true,
            needsProxy: false,
          };

      const nextState = toStoredRssState(result);
      rows.push({
        mentorId: mentor.id,
        name: mentor.name,
        channelId: rawId || "—",
        rssUrl: result.rssUrl || "—",
        httpStatus: result.status || 0,
        errorType: result.errorType || "ok",
        rssStatus: getRssStatusLabel(result),
        needsRepair: result.needsRepair ? "כן" : "לא",
        needsProxy: result.needsProxy ? "כן" : "לא",
        action: result.needsRepair
          ? "נדרש תיקון Channel ID"
          : result.needsProxy
            ? "נדרש proxy/backend"
            : result.ok
              ? "—"
              : "בדוק שוב מאוחר יותר",
      });

      await updateMentor.mutateAsync({
        id: mentor.id,
        rssStatus: nextState.rssStatus,
        rssError: nextState.rssError,
        rssCheckedAt: new Date().toISOString(),
      }).catch(() => null);
    }

    setRssValidationRows(rows);
    setValidatingRss(false);
  }
  const mainTopics = topics.filter((t) => !t.parentId);
  const [editingTopicFor, setEditingTopicFor] = useState(null);
  const [topicSaveStatus, setTopicSaveStatus] = useState({}); // { mentorId: "saved" | "saving" }
  const [syncPanelFor, setSyncPanelFor] = useState(null); // mentorId whose sync panel is open

  const filteredChannels = useMemo(() => {
    if (!channelSearch.trim()) return channels;
    return channels.filter((ch) => {
      const mentor = mentors.find((m) => m.id === ch.mentorId);
      return matchesMentorChannelSearch({
        mentor,
        channel: ch,
        topics: mainTopics,
        query: channelSearch,
      });
    });
  }, [channels, mentors, mainTopics, channelSearch]);

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
      if (!isBase44Enabled() || !base44) {
        setRefreshResult({
          error: "מצב local-first: אין fetchVideoStats מרחוק. הגדר VITE_ENABLE_BASE44=true לעדכון אוטומטי.",
        });
        return;
      }

      const mapped = missing
        .map((v) => ({ base44Id: v.id, youtubeId: extractVideoId(v.url) }))
        .filter((v) => v.youtubeId);

      const youtubeIds = mapped.map((v) => v.youtubeId);
      const res = await base44.functions.invoke("fetchVideoStats", { videoIds: youtubeIds });
      const statsData = res?.data ?? res;

      let updated = 0;
      for (const { base44Id, youtubeId } of mapped) {
        const s = statsData?.[youtubeId];
        if (s?.duration || s?.viewCount) {
          await Video.update(base44Id, {
            ...(s.duration && { duration: s.duration }),
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
    const mentor = mentors.find((m) => m.id === mentorId);
    if (!mentor) return;
    setResolving((prev) => ({ ...prev, [mentorId]: { state: 'resolving' } }));
    const result = await repairChannelId({
      mentor,
      channelUrl: ch?.channelUrl || ch?.sourceUrl || null,
      handle: ch?.handle || null,
    });
    if (result.success) {
      await persistResolvedMentor(mentor, ch, result);
      setResolving((prev) => ({ ...prev, [mentorId]: { state: 'ok', channelId: result.channelId, method: result.method } }));
    } else {
      await persistFailedMentor(mentor, ch, result.error, result.attempts || []);
      setResolving((prev) => ({ ...prev, [mentorId]: { state: 'error', error: result.error, attempts: result.attempts } }));
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

      if (savedMap.length > 0 && isBase44Enabled() && base44) {
        try {
          const youtubeIds = savedMap.map((v) => v.youtubeId);
          const res = await base44.functions.invoke("fetchVideoStats", { videoIds: youtubeIds });
          const stats = res?.data ?? res;
          for (const { base44Id, youtubeId } of savedMap) {
            const s = stats?.[youtubeId];
            if (s?.duration || s?.viewCount) {
              await Video.update(base44Id, {
                ...(s.duration && { duration: s.duration }),
                ...(s.viewCount && { viewCount: s.viewCount }),
              });
            }
          }
        } catch (e) {
          console.warn("[FetchVideoStats] failed:", e.message);
        }
      }

      setChannelStatus(mentorId, { state: "success", saved, skipped: statuses[mentorId]?.skipped ?? 0, preview: null });
      setStoredCount(getVideoCount());
    } catch (err) {
      setChannelStatus(mentorId, { state: "error", error: "שגיאה בשמירה — " + err.message });
    }
  }

  async function handleTopicChange(mentorId, topicId) {
    const topic = mainTopics.find((t) => t.id === topicId);
    const categoryCode = getCategoryCodeForTopicName(topic?.name) ?? null;
    setTopicSaveStatus((p) => ({ ...p, [mentorId]: "saving" }));
    try {
      await updateMentor.mutateAsync({
        id: mentorId,
        topicIds: topicId ? [topicId] : [],
        ...(categoryCode && { category: categoryCode }),
      });
      // Propagate to channel collection (so future video imports inherit the new topic)
      const ch = channels.find((c) => c.mentorId === mentorId);
      const collectionPatch = {
        topicId,
        topic: topic?.name ?? null,
        mainTopicId: topicId,
        mainTopic: topic?.name ?? null,
      };
      if (ch?.channelId) {
        updateChannelCollectionByChannelId(ch.channelId, collectionPatch);
      } else if (ch?.name) {
        updateChannelCollectionByChannelName(ch.name, collectionPatch);
      }
      setTopicSaveStatus((p) => ({ ...p, [mentorId]: "saved" }));
      setTimeout(() => setTopicSaveStatus((p) => ({ ...p, [mentorId]: null })), 2500);
    } catch (e) {
      toast.error(`שגיאה בשמירת נושא: ${e?.message || "שגיאה לא ידועה"}`);
      setTopicSaveStatus((p) => ({ ...p, [mentorId]: null }));
    }
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

  function handleClearVideos() {
    const ok = window.confirm('האם למחוק את כל הסרטונים השמורים? הפעולה לא תמחק מנטורים או נושאים.');
    if (!ok) return;
    clearAllVideos();
    setStoredCount(0);
    setClearVideosToast(true);
    setTimeout(() => setClearVideosToast(false), 3500);
  }

  async function handleCheckRssRow(mentorId) {
    const ch = channels.find((c) => c.mentorId === mentorId);
    if (!ch?.channelId) return;
    setRssCheckFor((prev) => ({ ...prev, [mentorId]: { state: 'checking' } }));
    const result = await checkChannelRssFeed(ch.channelId);
    setRssCheckFor((prev) => ({
      ...prev,
      [mentorId]: {
        state: result.ok ? 'ok' : result.errorType || 'error',
        detail: result.detail,
        status: result.status,
        errorType: result.errorType,
        needsRepair: result.needsRepair,
        needsProxy: result.needsProxy,
        rssUrl: result.rssUrl,
      },
    }));
  }

  async function handleResolveChannel(mentorId) {
    const ch = channels.find((c) => c.mentorId === mentorId);
    const mentor = mentors.find((m) => m.id === mentorId);
    if (!mentor) return;

    setResolving((prev) => ({ ...prev, [mentorId]: { state: 'resolving' } }));

    const result = await repairChannelId({
      mentor,
      channelUrl: ch?.channelUrl || ch?.sourceUrl || null,
      handle: ch?.handle || null,
    });

    if (result.success) {
      await persistResolvedMentor(mentor, ch, result);
      setRssCheckFor((prev) => ({ ...prev, [mentorId]: { state: 'ok', detail: `✓ Channel ID: ${result.channelId}`, status: result.rssStatus } }));
      setResolving((prev) => ({ ...prev, [mentorId]: { state: 'ok', channelId: result.channelId, method: result.method } }));
      toast.success(`${mentor.name}: Channel ID אומת (${result.method})`);
    } else {
      await persistFailedMentor(mentor, ch, result.error, result.attempts || []);
      setResolving((prev) => ({ ...prev, [mentorId]: { state: 'error', error: result.error, attempts: result.attempts } }));
      toast.error(`${mentor.name}: ${result.error}`);
    }
  }

  async function handleRepairAll() {
    const needRepair = channels.filter((ch) => {
      const mentor = mentors.find((m) => m.id === ch.mentorId);
      const rc = rssCheckFor[ch.mentorId];
      return (
        !ch.channelId ||
        isSuspiciousChannelId(ch.channelId) ||
        ch.rssStatus === 'failed' ||
        rc?.errorType === 'not_found' ||
        mentor?.forceRepair === true
      );
    });
    if (!needRepair.length) { toast.info('כל הערוצים תקינים'); return; }

    setRepairingAll(true);
    setRepairLog([]);
    const log = [];
    console.log("[repair-all] start", needRepair.length);

    for (const ch of needRepair) {
      const mentor = mentors.find((m) => m.id === ch.mentorId);
      if (!mentor) continue;

      setResolving((prev) => ({ ...prev, [ch.mentorId]: { state: 'resolving' } }));

      const result = await repairChannelId({
        mentor,
        channelUrl: ch.channelUrl || ch.sourceUrl || null,
        handle: ch.handle || null,
        forceRepair: mentor.forceRepair === true,
      });

      const logEntry = {
        mentorName: mentor.name,
        oldChannelId: mentor.youtubeChannelId || '—',
        newChannelId: result.channelId || '—',
        status: result.success ? 'success' : 'failed',
        method: result.method || '—',
        error: result.error || null,
        note: result.success
          ? `RSS ${result.rssStatus}`
          : result.error,
      };
      log.push(logEntry);

      if (result.success) {
        await persistResolvedMentor(mentor, ch, result);
        setRssCheckFor((prev) => ({ ...prev, [ch.mentorId]: { state: 'ok', detail: `✓ ${result.channelId}`, status: result.rssStatus } }));
        setResolving((prev) => ({ ...prev, [ch.mentorId]: { state: 'ok', channelId: result.channelId, method: result.method } }));
      } else {
        await persistFailedMentor(mentor, ch, result.error, result.attempts || []);
        setResolving((prev) => ({ ...prev, [ch.mentorId]: { state: 'error', error: result.error, attempts: result.attempts } }));
      }

      setRepairLog([...log]);
    }

    setRepairingAll(false);
    const fixed = log.filter(r => r.status === 'success').length;
    const failed = log.filter(r => r.status === 'failed').length;
    toast.info(`תיקון הסתיים: ${fixed} תוקנו, ${failed} נכשלו`);
  }

  async function handleFetchNew(mentorId) {
    const mentor = mentors.find((m) => m.id === mentorId);
    const source = sources.find((s) => s.mentorId === mentorId && s.sourceType === "youtube");
    if (!mentor) return;

    setFetchingFor((prev) => ({ ...prev, [mentorId]: true }));
    setFetchResultFor((prev) => ({ ...prev, [mentorId]: null }));

    try {
      const ch = channels.find((c) => c.mentorId === mentorId);
      let resolvedMentor = mentor;

      // ── DEBUG: channel record ────────────────────────────────────────────────
      console.group(`[scan] ${mentor.name}`);
      console.log('[scan] 1. channel record', {
        mentorId:        mentor.id,
        name:            mentor.name,
        youtubeChannelId: mentor.youtubeChannelId || mentor.channelId || '—',
        sourceUrl:       source?.sourceUrl || '—',
        handle:          ch?.handle || '—',
        channelUrl:      ch?.channelUrl || '—',
        isConfigured:    ch?.isConfigured ?? false,
        rssStatus:       mentor.rssStatus || '—',
      });

      // If no valid channelId but has a handle/URL → auto-resolve before fetching
      if (!ch?.isConfigured && (ch?.handle || ch?.channelUrl || ch?.sourceUrl)) {
        console.log('[scan] 2. no channelId → attempting handle resolution', {
          channelUrl: ch?.channelUrl || ch?.sourceUrl,
          handle: ch?.handle,
        });
        const result = await repairChannelId({
          mentor,
          channelUrl: ch?.channelUrl || ch?.sourceUrl || null,
          handle: ch?.handle || null,
        });
        console.log('[scan] 3. resolution result', {
          success:   result.success,
          channelId: result.channelId || '—',
          method:    result.method || '—',
          error:     result.error || null,
          attempts:  result.attempts,
        });
        if (result.success) {
          await persistResolvedMentor(mentor, ch, result);
          resolvedMentor = { ...mentor, youtubeChannelId: result.channelId, channelId: result.channelId };
        } else {
          console.groupEnd();
          throw new Error(`לא ניתן לאתר Channel ID עבור "${mentor.name}": ${result.error}`);
        }
      } else {
        console.log('[scan] 2. channelId already known', mentor.youtubeChannelId || mentor.channelId);
      }

      console.log('[scan] 4. fetching RSS with channelId', resolvedMentor.youtubeChannelId || resolvedMentor.channelId);
      const fetched = await fetchChannelRSSFromSource(resolvedMentor, source, topics);
      console.log('[scan] 5. RSS returned', fetched.length, 'videos');
      fetched.forEach((v, i) =>
        console.log(`  [${i + 1}]`, v.title, '|', v.url?.split('=')[1] || '', '|', v.publishedAt?.slice(0, 10) || '')
      );

      const toSave = fetched.map(({ _videoId, _channelName, ...rest }) => rest);

      const added = upsertVideos(toSave);

      // Dedup report: anything in toSave that isn't in added was skipped by dedup
      const addedUrls = new Set(added.map((v) => v.url));
      const skipped = toSave.filter((v) => !addedUrls.has(v.url));
      console.log('[scan] 6. dedup — skipped (already in storage):', skipped.length);
      skipped.forEach((v) => console.log('  skip:', v.title, '|', v.url?.split('=')[1] || ''));
      console.log('[scan] 7. upsertVideos inserted', added.length, 'records');
      added.forEach((v) => console.log('  +', v.title, '|', v.id));

      console.log(`[scan] summary: fetched=${fetched.length} skipped=${skipped.length} inserted=${added.length}`);
      console.groupEnd();

      const chaptersUpdated = 0;
      const chaptersFailed = 0;

      if (added.length > 0) {
        await queryClient.invalidateQueries({ queryKey: ["videos"] });
      }

      setFetchResultFor((prev) => ({
        ...prev,
        [mentorId]: {
          added: added.length,
          imported: added.length,
          chaptersGenerated: chaptersUpdated,
          failed: chaptersFailed,
        },
      }));
      persistScanHistory(mentorId, {
        lastScanStatus: added.length > 0 ? "ok" : "no_new",
        lastScanFoundCount: fetched.length,
        lastScanImportedCount: added.length,
        lastScanError: null,
        lastScanSource: "RSS",
      });
      setScanHistoryState(getAllScanHistory());
      if (added.length > 0) setStoredCount(getVideoCount());
      toast.success(`יובאו ${added.length} · נוצרו פרקים ל-${chaptersUpdated} · נכשלו ${chaptersFailed}`);
    } catch (err) {
      console.warn(`[RssTab] ${mentor.name}: שגיאה — ${err.message}`);
      console.groupEnd();
      setFetchResultFor((prev) => ({ ...prev, [mentorId]: { error: err.message } }));
      persistScanHistory(mentorId, {
        lastScanStatus: "error",
        lastScanFoundCount: 0,
        lastScanImportedCount: 0,
        lastScanError: err.message,
        lastScanSource: "RSS",
      });
      setScanHistoryState(getAllScanHistory());
    } finally {
      setFetchingFor((prev) => ({ ...prev, [mentorId]: false }));
    }
  }

  async function handleFetchAll() {
    const toFetch = [];
    const skippedFrozen = [];
    const skippedNoUrl = [];

    for (const c of channels) {
      if (frozenIds.has(c.mentorId)) {
        skippedFrozen.push(c.name);
        continue;
      }
      const hasUrl = c.isConfigured || c.handle || c.channelUrl || c.sourceUrl;
      if (!hasUrl) {
        skippedNoUrl.push(c.name);
        continue;
      }
      toFetch.push(c);
    }

    if (skippedFrozen.length) {
      console.log('[scan-all] skipped frozen mentors:', skippedFrozen);
    }
    if (skippedNoUrl.length) {
      console.log('[scan-all] EXCLUDED (no channelId and no handle/url):', skippedNoUrl);
    }
    console.log('[scan-all] channels to fetch:', toFetch.length, '/', channels.length);
    toFetch.forEach((c) => console.log(
      `  ${c.name} | configured=${c.isConfigured} | channelId=${c.channelId || '—'} | handle=${c.handle || '—'}`
    ));

    if (!toFetch.length) return;
    setGlobalLoading(true);
    for (const ch of toFetch) {
      await handleFetchNew(ch.mentorId);
    }
    setGlobalLoading(false);
  }

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-white">משיכת RSS מיוטיוב</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            סנכרון ערוצים, בדיקות RSS ומשיכת סרטונים חדשים
          </p>
          <p className="text-xs text-slate-400 mt-1 dark:text-zinc-500">
            {configuredCount} מתוך {channels.length} ערוצים מוגדרים עם Channel ID
            {storedCount > 0 && (
              <span className="mr-2 text-indigo-500">· {storedCount} סרטונים שמורים</span>
            )}
          </p>
          {syncInfo.lastAt && (
            <p className="text-xs text-gray-400 mt-0.5">
              סנכרון אחרון: {formatRelativeTime(syncInfo.lastAt)}
              {syncInfo.result?.addedCount > 0 && (
                <span className="mr-1 text-emerald-600"> · נוספו {syncInfo.result.addedCount} חדשים</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Refresh Stats button */}
          <button
            onClick={handleRefreshStats}
            disabled={refreshingStats}
            className={cn(adminBtnSecondary, "text-xs px-3 py-1.5")}
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
              className={cn(adminBtnSecondary, "text-xs px-3 py-1.5")}
            >
              <Hash className="h-3.5 w-3.5" />
              זיהוי Channel IDs
            </button>
          )}
          <button
            type="button"
            onClick={handleValidateAllRssV2}
            disabled={validatingRss || mentors.length === 0}
            className={cn(adminBtnSecondary, "text-xs px-3 py-1.5")}
            title="בודק מול https://www.youtube.com/feeds/videos.xml?channel_id=…"
          >
            {validatingRss ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Rss className="h-3.5 w-3.5" />
            )}
            בדיקת RSS
          </button>
          <button
            type="button"
            onClick={handleRepairAll}
            disabled={repairingAll || mentors.length === 0}
            className={cn(adminBtnSecondary, "text-xs px-3 py-1.5")}
            title="מנסה לפתור מחדש את כל ה-Channel IDs שנכשלו"
          >
            {repairingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            תקן Channel IDs
          </button>
          <button
            onClick={handleFetchAll}
            disabled={globalLoading || configuredCount === 0}
            className={cn(adminBtnPrimary, "text-xs px-3 py-1.5")}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${globalLoading ? "animate-spin" : ""}`} />
            משוך את כולם
          </button>
          <button
            onClick={handleClearVideos}
            disabled={storedCount === 0}
            className={cn(adminBtnDestructive, "text-xs px-3 py-1.5 disabled:opacity-40")}
          >
            <Trash2 className="h-3.5 w-3.5" />
            מחק סרטונים
          </button>
          {confirmDeleteAll ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-red-600">למחוק את כל {channels.length} המנטורים?</span>
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className={cn(adminBtnDestructive, "text-xs px-2.5 py-1")}
              >
                {deletingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : "כן, מחק"}
              </button>
              <button
                onClick={() => setConfirmDeleteAll(false)}
                className={cn(adminBtnSecondary, "text-xs px-2.5 py-1")}
              >
                ביטול
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDeleteAll(true)}
              disabled={channels.length === 0}
              className={cn(adminBtnDestructive, "text-xs px-3 py-1.5 disabled:opacity-40")}
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

      {/* Clear videos toast */}
      {clearVideosToast && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          כל הסרטונים נמחקו — כעת ניתן למשוך מחדש
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

      <MentorSearchInput value={channelSearch} onChange={setChannelSearch} className="mb-4" />

      {channelSearch.trim() && (
        <p className="mb-3 text-xs text-slate-500 dark:text-zinc-400">
          {filteredChannels.length > 0
            ? `נמצאו ${filteredChannels.length} מתוך ${channels.length} ערוצים`
            : "לא נמצאו מנטורים מתאימים"}
        </p>
      )}

      {/* Channel list */}
      <div className="space-y-2">
        {filteredChannels.length === 0 && channelSearch.trim() ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
            לא נמצאו מנטורים מתאימים
          </div>
        ) : (
        filteredChannels.map((ch) => {
          const catCfg = CATEGORY_CONFIG[ch.category];
          const status = statuses[ch.mentorId];
          const hasPreview = status?.preview?.length > 0;
          const rv = resolving[ch.mentorId];
          const missingAutoRepairInput = !ch.channelUrl && !ch.handle && !ch.youtubeChannelId;
          const rssFailed = ch.rssStatus === "failed";
          const canFetchFromRss = ch.isConfigured && !rssFailed;
          const rc = rssCheckFor[ch.mentorId];
          const isFrozen = frozenIds.has(ch.mentorId);

          return (
            <div
              key={ch.mentorId}
              className={cn(
                "rounded-2xl border px-4 py-3.5 transition-all",
                isFrozen
                  ? "border-slate-200/60 bg-slate-100/50 opacity-60 grayscale-[40%] dark:border-zinc-800/50 dark:bg-zinc-900/20"
                  : "border-slate-200/90 bg-slate-50/60 hover:bg-slate-50 dark:border-zinc-800/80 dark:bg-zinc-900/40 dark:hover:bg-zinc-900/60"
              )}
              dir="rtl"
            >
              <div className="flex items-start gap-4 flex-row-reverse">
                {/* Avatar (right) */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-indigo-200/80 bg-indigo-50 text-sm font-bold text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300">
                  {ch.name?.[0]?.toUpperCase()}
                </div>

                {/* Main */}
                <div className="flex-1 min-w-0">
                  {/* Title row */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate dark:text-white flex items-center gap-2">
                        {ch.name}
                        {isFrozen && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            <Snowflake className="h-2.5 w-2.5" />
                            מוקפא
                          </span>
                        )}
                      </p>
                      <div className="mt-1 flex items-center gap-2 flex-wrap justify-end">
                        {/* Category pill */}
                        {(() => {
                          const ov = getMentorTopicOverride(ch.mentorId);
                          const mentor = mentors.find((m) => m.id === ch.mentorId);
                          const effectiveTopicIds = ov?.topicIds ?? mentor?.topicIds ?? [];
                          const selectedTopicId = effectiveTopicIds[0] ?? "";
                          const selectedTopic = mainTopics.find((t) => t.id === selectedTopicId);
                          const effectiveCategory = ov?.category ?? ch.category;
                          const gemKeys = Object.entries(GEM_CATEGORY_MAP)
                            .filter(([, v]) => v.categoryCode === effectiveCategory)
                            .map(([k]) => k);
                          const gemLabel = gemKeys.length ? gemKeys.join(", ") : null;
                          const ovUpdatedAt = ov?.updatedAt;
                          const saveStatus = topicSaveStatus[ch.mentorId];
                          return (
                            <>
                              <select
                                value={selectedTopicId}
                                onChange={(e) => handleTopicChange(ch.mentorId, e.target.value)}
                                className="h-8 text-xs rounded-full px-3 border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800 cursor-pointer"
                              >
                                <option value="">— בחר נושא —</option>
                                {mainTopics.map((t) => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>

                              {/* Save feedback */}
                              {saveStatus === "saving" && (
                                <span className="text-[10px] text-slate-400 whitespace-nowrap flex items-center gap-1">
                                  <Loader2 className="h-3 w-3 animate-spin" />שומר...
                                </span>
                              )}
                              {saveStatus === "saved" && (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 whitespace-nowrap flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" />נשמר
                                </span>
                              )}

                              {/* GEM mapping */}
                              {gemLabel && (
                                <span className="rounded-full border border-violet-200/80 bg-violet-50 px-2 py-0.5 text-[10px] text-violet-700 dark:border-violet-800/50 dark:bg-violet-950/30 dark:text-violet-300" title="Gems מומלצים לערוץ זה">
                                  💎 {gemLabel}
                                </span>
                              )}

                              {/* Last updated */}
                              {ovUpdatedAt && (
                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 whitespace-nowrap" title={`עודכן: ${ovUpdatedAt}`}>
                                  עודכן {new Date(ovUpdatedAt).toLocaleDateString("he-IL")}
                                </span>
                              )}

                              {/* Audit button */}
                              <button
                                type="button"
                                onClick={() => setSyncPanelFor((prev) => prev === ch.mentorId ? null : ch.mentorId)}
                                className="text-[10px] rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                                title="בדוק סנכרון ערוץ"
                              >
                                🔍 בדוק סנכרון
                              </button>
                            </>
                          );
                        })()}

                        {/* Channel ID badge */}
                        {ch.isConfigured ? (
                          <span
                            className="rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                            title={ch.channelId}
                          >
                            {formatChannelIdDisplay(ch.channelId)}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-700 dark:text-amber-300">
                            {missingAutoRepairInput ? "חסר URL ערוץ" : "חסר Channel ID"}
                          </span>
                        )}

                        {/* Ready indicator */}
                        {ch.isConfigured && !rssFailed ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            מוכן
                          </span>
                        ) : rssFailed ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            RSS לא תקף
                          </span>
                        ) : rv?.state === "resolving" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            מתקן...
                          </span>
                        ) : rv?.state === "error" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            שגיאה
                          </span>
                        ) : (
                          <button
                            onClick={() => handleResolve(ch.mentorId)}
                            className={cn(adminBtnSecondary, "text-xs px-2.5 py-1 rounded-full")}
                          >
                            זהה
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Actions toolbar */}
                    <div className="flex items-end gap-1.5 flex-wrap">
                      {/* Fix Channel ID */}
                      {(() => {
                        const rowMentor = mentors.find((m) => m.id === ch.mentorId);
                        if (!ch.channelUrl && !ch.handle && !rowMentor?.youtubeChannelId) return null;
                        const tone =
                          rv?.state === "ok"
                            ? "border-emerald-200/80 text-emerald-700 dark:text-emerald-300"
                            : rv?.state === "error"
                              ? "border-red-200/80 text-red-600 dark:text-red-300"
                              : "";
                        return (
                          <button
                            onClick={() => handleResolveChannel(ch.mentorId)}
                            disabled={rv?.state === "resolving" || repairingAll}
                            className={cn(adminLabelBtn, tone, "disabled:opacity-50")}
                            title="תקן Channel ID"
                            aria-label="תקן Channel ID"
                          >
                            {rv?.state === "resolving" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Code className="h-4 w-4" />
                            )}
                            <span className="text-[10px] leading-none font-medium">זהה</span>
                          </button>
                        );
                      })()}

                      {/* Check RSS */}
                      {canFetchFromRss && (
                        <button
                          onClick={() => handleCheckRssRow(ch.mentorId)}
                          disabled={rc?.state === "checking"}
                          className={cn(
                            adminLabelBtn,
                            rc?.state === "ok"
                              ? "border-emerald-200/80 text-emerald-700 dark:text-emerald-300"
                              : rc?.state === "error"
                                ? "border-red-200/80 text-red-600 dark:text-red-300"
                                : "",
                            "disabled:opacity-50"
                          )}
                          title={rc?.detail ?? "בדוק RSS"}
                          aria-label="בדוק RSS"
                        >
                          {rc?.state === "checking" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Rss className="h-4 w-4" />
                          )}
                          <span className="text-[10px] leading-none font-medium">RSS</span>
                        </button>
                      )}

                      {/* Preview */}
                      <button
                        onClick={() => handlePreview(ch.mentorId)}
                        disabled={!canFetchFromRss || status?.state === "loading"}
                        className={cn(adminLabelBtn, "disabled:cursor-not-allowed disabled:opacity-40")}
                        title="בדוק מה חדש ב-RSS"
                        aria-label="בדוק"
                      >
                        {status?.state === "loading" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ListVideo className="h-4 w-4" />
                        )}
                        <span className="text-[10px] leading-none font-medium">בדוק</span>
                      </button>

                      {/* Fetch new */}
                      {canFetchFromRss && (
                        <button
                          onClick={() => handleFetchNew(ch.mentorId)}
                          disabled={!!fetchingFor[ch.mentorId]}
                          className={cn(adminLabelBtn, "text-indigo-600 dark:text-indigo-300", "disabled:opacity-50")}
                          title="משוך סרטונים חדשים"
                          aria-label="משוך חדשים"
                        >
                          {fetchingFor[ch.mentorId] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          <span className="text-[10px] leading-none font-medium">סרוק</span>
                        </button>
                      )}

                      {/* Import */}
                      {hasPreview && (
                        <button
                          onClick={() => handleImport(ch.mentorId)}
                          disabled={status?.state === "loading"}
                          className={cn(adminLabelBtn, "text-emerald-700 dark:text-emerald-300", "disabled:opacity-50")}
                          title={`שמור ${status.preview.length} סרטונים`}
                          aria-label="שמור"
                        >
                          <Download className="h-4 w-4" />
                          <span className="text-[10px] leading-none font-medium">שמור {status.preview.length}</span>
                        </button>
                      )}

                      {/* Freeze / Unfreeze scan */}
                      <button
                        onClick={() => handleToggleFreeze(ch.mentorId)}
                        className={cn(
                          adminLabelBtn,
                          isFrozen
                            ? "border-amber-300/80 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700/40 dark:bg-amber-950/25 dark:text-amber-300"
                            : "text-emerald-700 border-emerald-200/80 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                        )}
                        title={isFrozen ? "הפעל סריקה אוטומטית" : "הקפא — הסר מסריקה אוטומטית"}
                        aria-label={isFrozen ? "הפעל" : "הקפא"}
                      >
                        {isFrozen ? (
                          <Play className="h-4 w-4" />
                        ) : (
                          <Snowflake className="h-4 w-4" />
                        )}
                        <span className="text-[10px] leading-none font-medium">
                          {isFrozen ? "פעיל" : "מוקפא"}
                        </span>
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setConfirmDeleteId(ch.mentorId)}
                        className={adminLabelBtnDestructive}
                        title="מחק מנטור"
                        aria-label="מחק מנטור"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="text-[10px] leading-none font-medium">מחק</span>
                      </button>
                    </div>
                  </div>

                  {/* Secondary status line */}
                  <div className="mt-2 flex items-start justify-between gap-3 flex-row-reverse">
                    <div className="text-right">
                      <ChannelStatus status={status} channelId={ch.channelId} />
                      {/* Persistent scan history badge */}
                      {(() => {
                        const h = scanHistory[ch.mentorId];
                        if (!h) return (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[10px] text-yellow-600 dark:border-yellow-800/50 dark:bg-yellow-950/20 dark:text-yellow-400" title="ערוץ זה טרם נסרק">
                            ⚪ טרם נסרק
                          </span>
                        );
                        const dateStr = new Date(h.lastScannedAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
                        const tooltip = [
                          `סריקה אחרונה: ${dateStr}`,
                          h.lastScanFoundCount != null ? `נמצאו: ${h.lastScanFoundCount}` : null,
                          h.lastScanImportedCount != null ? `יובאו: ${h.lastScanImportedCount}` : null,
                          h.lastScanError ? `שגיאה: ${h.lastScanError}` : null,
                          h.lastScanSource ? `מקור: ${h.lastScanSource}` : null,
                        ].filter(Boolean).join("\n");
                        if (h.lastScanStatus === "error") return (
                          <span title={tooltip} className="mt-1 inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                            🔴 נכשל · {dateStr}
                          </span>
                        );
                        if (h.lastScanImportedCount > 0) return (
                          <span title={tooltip} className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
                            🟢 נוספו {h.lastScanImportedCount} · {dateStr}
                          </span>
                        );
                        return (
                          <span title={tooltip} className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                            ⚫ אין חדשים · {dateStr}
                          </span>
                        );
                      })()}
                      {hasPreview && (
                        <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-300">
                          {status.preview.length} סרטונים חדשים מוכנים לייבוא
                        </p>
                      )}
                      {fetchResultFor[ch.mentorId] && (
                        <p className={cn(
                          "text-xs mt-1",
                          fetchResultFor[ch.mentorId].error ? "text-red-600 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"
                        )}>
                          {fetchResultFor[ch.mentorId].error
                            ? `שגיאה: ${fetchResultFor[ch.mentorId].error.split('\n')[0]}`
                            : (fetchResultFor[ch.mentorId].imported ?? 0) === 0
                              ? 'אין סרטונים חדשים'
                              : `נוספו ${fetchResultFor[ch.mentorId].added} חדשים ל-localStorage`}
                        </p>
                      )}
                    </div>

                    {/* Delete confirm (kept intact, compact) */}
                    {confirmDeleteId === ch.mentorId && (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-red-200">למחוק?</span>
                        <button
                          onClick={() => handleDeleteMentor(ch.mentorId)}
                          className={cn(adminBtnDestructive, "text-xs px-2.5 py-1")}
                        >
                          כן
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className={cn(adminBtnSecondary, "text-xs px-2.5 py-1")}
                        >
                          לא
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── Sync Audit Panel ── */}
                  {syncPanelFor === ch.mentorId && (() => {
                    const ov = getMentorTopicOverride(ch.mentorId);
                    const mentor = mentors.find((m) => m.id === ch.mentorId);
                    const effectiveCategory = ov?.category ?? mentor?.category ?? ch.category;
                    const effectiveTopicIds = ov?.topicIds ?? mentor?.topicIds ?? [];
                    const topicName = mainTopics.find((t) => t.id === effectiveTopicIds[0])?.name ?? "—";
                    const subTopic = ov?.subTopic ?? mentor?.topic ?? "—";
                    const gemKeys = Object.entries(GEM_CATEGORY_MAP)
                      .filter(([, v]) => v.categoryCode === effectiveCategory)
                      .map(([k]) => k);
                    const obsidianCategory = CATEGORY_TO_NAME[effectiveCategory] ?? "—";
                    const videoCount = videos.filter((v) => {
                      const vid = v?.channelId || v?.youtubeChannelId;
                      const mName = v?._channelName || v?.channelTitle || v?.channelName;
                      return (ch.channelId && vid === ch.channelId) || mName === ch.name;
                    }).length;
                    return (
                      <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-right dark:border-indigo-900/40 dark:bg-indigo-950/20" dir="rtl">
                        <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-200 mb-2">🔍 בדיקת סנכרון ערוץ — {ch.name}</p>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <dt className="text-slate-500 dark:text-zinc-400">נושא ראשי</dt>
                          <dd className="font-medium text-slate-800 dark:text-zinc-100">{topicName}</dd>
                          <dt className="text-slate-500 dark:text-zinc-400">קטגוריה</dt>
                          <dd className="font-medium text-slate-800 dark:text-zinc-100">{effectiveCategory ?? "—"}</dd>
                          <dt className="text-slate-500 dark:text-zinc-400">תת-נושא</dt>
                          <dd className="font-medium text-slate-800 dark:text-zinc-100">{subTopic}</dd>
                          <dt className="text-slate-500 dark:text-zinc-400">Gems ממופים</dt>
                          <dd className="font-medium text-slate-800 dark:text-zinc-100">{gemKeys.length ? gemKeys.join(", ") : "—"}</dd>
                          <dt className="text-slate-500 dark:text-zinc-400">תיקיית Obsidian</dt>
                          <dd className="font-medium text-slate-800 dark:text-zinc-100">{obsidianCategory}</dd>
                          <dt className="text-slate-500 dark:text-zinc-400">סרטונים משויכים</dt>
                          <dd className="font-medium text-slate-800 dark:text-zinc-100">{videoCount}</dd>
                          {ov?.updatedAt && (
                            <>
                              <dt className="text-slate-500 dark:text-zinc-400">עדכון אחרון</dt>
                              <dd className="font-medium text-slate-800 dark:text-zinc-100">
                                {new Date(ov.updatedAt).toLocaleString("he-IL")}
                              </dd>
                            </>
                          )}
                        </dl>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })
        )}
      </div>

      {/* RSS validation report */}
      {rssValidationRows.length > 0 && (
        <div className="mt-6 border border-sky-100 rounded-xl overflow-hidden">
          <div className="bg-sky-50 px-4 py-2.5 border-b border-sky-100">
            <p className="text-xs font-semibold text-sky-800">תוצאות בדיקת RSS (mentor | channelId | סטטוס | פעולה)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs">
                  <th className="px-3 py-2 font-medium">מנטור</th>
                  <th className="px-3 py-2 font-medium">Channel ID</th>
                  <th className="px-3 py-2 font-medium">סטטוס RSS</th>
                  <th className="px-3 py-2 font-medium">פעולה</th>
                </tr>
              </thead>
              <tbody>
                {rssValidationRows.map((row) => (
                  <tr key={row.mentorId} className="border-b border-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800">{row.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600 break-all max-w-[200px]">
                      {row.channelId === "—" ? (
                        "—"
                      ) : (
                        <a
                          href={`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(row.channelId)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {row.channelId}
                        </a>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-xs ${row.rssStatus.startsWith("תקין") ? "text-emerald-700" : "text-red-600"}`}>
                      {row.rssStatus}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rssValidationRows.length > 0 && (
        <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden bg-white">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
            <p className="text-xs font-semibold text-slate-800">דוח אבחון RSS</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs">
                  <th className="px-3 py-2 font-medium">מנטור</th>
                  <th className="px-3 py-2 font-medium">Channel ID</th>
                  <th className="px-3 py-2 font-medium">RSS URL</th>
                  <th className="px-3 py-2 font-medium">HTTP</th>
                  <th className="px-3 py-2 font-medium">Error Type</th>
                  <th className="px-3 py-2 font-medium">צריך תיקון</th>
                  <th className="px-3 py-2 font-medium">צריך Proxy</th>
                </tr>
              </thead>
              <tbody>
                {rssValidationRows.map((row) => (
                  <tr key={`diagnostic-${row.mentorId}`} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-800">{row.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.channelId}</td>
                    <td className="px-3 py-2 text-xs text-blue-600 max-w-[260px] truncate">
                      {row.rssUrl && row.rssUrl !== "—" ? (
                        <a href={row.rssUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {row.rssUrl}
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{row.httpStatus || "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{row.errorType || "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{row.needsRepair || "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{row.needsProxy || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Repair log */}
      {repairLog.length > 0 && (
        <div className="mt-6 border border-slate-700 rounded-xl overflow-hidden bg-slate-950 text-slate-100">
          <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-700 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-100">
              דוח תיקון Channel IDs — {repairLog.filter(r => r.status === 'success').length} הצליחו, {repairLog.filter(r => r.status === 'failed').length} נכשלו
            </p>
            <button onClick={() => setRepairLog([])} className="text-xs text-slate-400 hover:text-white">נקה</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-700 text-slate-400 text-xs">
                  <th className="px-3 py-2 font-medium">מנטור</th>
                  <th className="px-3 py-2 font-medium">ID ישן</th>
                  <th className="px-3 py-2 font-medium">ID חדש</th>
                  <th className="px-3 py-2 font-medium">שיטה</th>
                  <th className="px-3 py-2 font-medium">סטטוס</th>
                  <th className="px-3 py-2 font-medium">הערה</th>
                </tr>
              </thead>
              <tbody>
                {repairLog.map((row, i) => (
                  <tr key={i} className="border-b border-slate-800">
                    <td className="px-3 py-2 font-medium text-slate-100">{row.mentorName}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-400">{row.oldChannelId}</td>
                    <td className={`px-3 py-2 font-mono text-xs ${row.status === 'success' ? 'text-emerald-400' : 'text-slate-500'}`}>{row.newChannelId}</td>
                    <td className="px-3 py-2 text-xs text-slate-300">{row.method}</td>
                    <td className={`px-3 py-2 text-xs font-medium ${row.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {row.status === 'success' ? '✓ תוקן' : '✗ נכשל'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300">{row.note || row.error || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
// ────────────────────────────────────────────
// Anthropic Billing Quick Access
// ────────────────────────────────────────────
const ANTHROPIC_LINKS = [
  { label: "Anthropic Console", href: "https://console.anthropic.com/", icon: "🏠", desc: "דף הבית של Anthropic Console" },
  { label: "Usage",             href: "https://console.anthropic.com/settings/usage",   icon: "📊", desc: "נתוני שימוש בטוקנים" },
  { label: "Billing",           href: "https://console.anthropic.com/settings/billing", icon: "💳", desc: "ניהול חיוב ותשלומים" },
  { label: "API Keys",          href: "https://console.anthropic.com/settings/keys",    icon: "🔑", desc: "ניהול מפתחות API" },
];

function AnthropicBillingTab() {
  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem('yt_claude_safety_v1');
      return { requireConfirmation: true, hideWhenGeminiActive: true, ...(raw ? JSON.parse(raw) : {}) };
    } catch { return { requireConfirmation: true, hideWhenGeminiActive: true }; }
  });

  const updateSetting = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    try { localStorage.setItem('yt_claude_safety_v1', JSON.stringify(next)); } catch {}
  };

  return (
    <div className="flex flex-col gap-5" dir="rtl">
      <div>
        <h2 className="text-base font-semibold text-slate-800 dark:text-zinc-200 mb-1">💳 תשלומים ועלויות API</h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          גישה מהירה לניהול עלויות ושימוש ב-Claude API של Anthropic.
        </p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ANTHROPIC_LINKS.map(link => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 transition-colors hover:border-indigo-300 hover:bg-indigo-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/30"
          >
            <span className="text-2xl shrink-0">{link.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{link.label}</div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400">{link.desc}</div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
          </a>
        ))}
      </div>

      {/* Warning notice */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
        ניתוח Claude API עשוי לחייב את החשבון לפי שימוש בטוקנים.
        יתרה ושימוש מדויקים מופיעים ב-<strong>Billing</strong> ו-<strong>Usage</strong> בלבד — לא כאן.
      </div>

      {/* Safety settings */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">🛡️ הגדרות הגנת עלות</h3>
        <div className="space-y-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
          {[
            { key: 'requireConfirmation', label: 'דרוש אישור לפני קריאות Claude API בתשלום', desc: 'מציג dialog אישור עם עלות משוערת לפני כל ניתוח Claude.' },
            { key: 'hideWhenGeminiActive', label: 'הצג אזהרה כשניתוח Gemini כבר קיים', desc: 'כשיש ניתוח Gemini פעיל — מוסיף הודעת אזהרה שניתוח Claude נוסף יעלה כסף.' },
          ].map(({ key, label, desc }) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!settings[key]}
                onChange={e => updateSetting(key, e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-indigo-600 cursor-pointer"
              />
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-zinc-100">{label}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">{desc}</p>
              </div>
            </label>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1.5">ברירת מחדל: כל ההגנות מופעלות — מומלץ להשאיר כך.</p>
      </div>

      {/* Model info */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">🤖 מודל Claude בשימוש</h3>
        <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 flex items-center justify-between">
          <span className="font-mono text-sm text-slate-700 dark:text-zinc-200">claude-sonnet-4-6</span>
          <a href="https://www.anthropic.com/pricing" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-800">מחירון</a>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1.5">מוגדר ב-ANTHROPIC_MODEL ב-.env.local — לשינוי יש לערוך ולהפעיל מחדש.</p>
      </div>
    </div>
  );
}

// Admin Page
// ────────────────────────────────────────────
const ADMIN_TOOLS = [
  { tab: "rss",            label: "משיכת RSS",    desc: "סריקה ומשיכת סרטונים חדשים מערוצי YouTube", Icon: Rss,       iconBg: "bg-orange-100 dark:bg-orange-900/30", iconColor: "text-orange-600 dark:text-orange-400", aliases: ["rss","feed","channel","youtube","ערוץ"] },
  { tab: "vault-migration",label: "ארגון Vault",  desc: "כפילויות ומיזוג עצי Obsidian",              Icon: FolderSync,iconBg: "bg-emerald-100 dark:bg-emerald-900/30",iconColor: "text-emerald-600 dark:text-emerald-400",aliases: ["vault","obsidian","merge","duplicate","כפילויות"] },
  { tab: "mentors",        label: "ערוצים",        desc: "ניהול מנטורים וערוצי YouTube",              Icon: Bot,       iconBg: "bg-blue-100 dark:bg-blue-900/30",     iconColor: "text-blue-600 dark:text-blue-400",    aliases: ["mentor","channel","מנטור","ערוץ"] },
  { tab: "sources",        label: "מקורות",        desc: "ניהול מקורות YouTube ו-RSS",                Icon: Globe,     iconBg: "bg-indigo-100 dark:bg-indigo-900/30", iconColor: "text-indigo-600 dark:text-indigo-400", aliases: ["source","rss","feed","מקור"] },
  { tab: "storage",        label: "אחסון",         desc: "ניהול localStorage וסטטיסטיקות",            Icon: Archive,   iconBg: "bg-amber-100 dark:bg-amber-900/30",   iconColor: "text-amber-600 dark:text-amber-400",  aliases: ["archive","storage","local","ארכיון","אחסון"] },
  { tab: "topics",         label: "נושאים",        desc: "יצירה, עריכה ומחיקת נושאים",               Icon: ListVideo, iconBg: "bg-violet-100 dark:bg-violet-900/30", iconColor: "text-violet-600 dark:text-violet-400", aliases: ["topic","brain","נושא"] },
  { tab: "categories",     label: "קטגוריות",      desc: "ניהול קטגוריות וסטטיסטיקות",               Icon: TrendingUp,iconBg: "bg-pink-100 dark:bg-pink-900/30",     iconColor: "text-pink-600 dark:text-pink-400",    aliases: ["category","קטגוריה"] },
  { route: "CloudBackups", label: "גיבויי ענן",    desc: "גיבוי נתונים לענן",                        Icon: Download,  iconBg: "bg-sky-100 dark:bg-sky-900/30",       iconColor: "text-sky-600 dark:text-sky-400",      aliases: ["backup","cloud","gdrive","גיבוי"] },
  { route: "Workspace",    label: "Workspace",     desc: "ייצוא מבנה Obsidian ו-Brain",              Icon: FolderTree,iconBg: "bg-teal-100 dark:bg-teal-900/30",    iconColor: "text-teal-600 dark:text-teal-400",    aliases: ["export","workspace","obsidian","zip","ייצוא"] },
  { route: "KnowledgeLibrary", label: "ספריית ידע",desc: "פריטי ידע ומסמכים",                       Icon: BookOpen,  iconBg: "bg-cyan-100 dark:bg-cyan-900/30",     iconColor: "text-cyan-600 dark:text-cyan-400",    aliases: ["knowledge","library","ידע","ספרייה"] },
  { tab: "billing",          label: "תשלומים ועלויות", desc: "גישה מהירה לעלויות ושימוש ב-Anthropic", Icon: CreditCard,iconBg: "bg-rose-100 dark:bg-rose-900/30",     iconColor: "text-rose-600 dark:text-rose-400",    aliases: ["billing","anthropic","api","תשלום","עלויות","claude"] },
];

const TAB_LABELS = {
  rss: "משיכת RSS",
  mentors: "ערוצים",
  topics: "נושאים",
  categories: "קטגוריות",
  sources: "מקורות",
  storage: "אחסון",
  "vault-migration": "ארגון Vault",
  billing: "תשלומים ועלויות API",
};

export default function Admin({ navigateTo = null }) {
  const queryClient = useQueryClient();
  const { data: mentors = [] } = useMentors();
  const { data: sources = [] } = useSources();
  const { data: topics = [] } = useTopics();
  const { data: videos = [] } = useVideos();
  const [refreshingAllChapters, setRefreshingAllChapters] = useState(false);
  const [bulkFixingChapters, setBulkFixingChapters] = useState(false);
  const [bulkFixProgress, setBulkFixProgress] = useState(null); // { done, total }
  const [clearingLocalVideos, setClearingLocalVideos] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [exportingBrainZip, setExportingBrainZip] = useState(false);
  const [activeTab, setActiveTab] = useState("rss");
  const [adminSearch, setAdminSearch] = useState("");

  async function handleRefreshAllChapters() {
    const targets = videos.filter((v) => !Array.isArray(v.aiChapters) || v.aiChapters.length === 0);
    if (targets.length === 0) {
      toast.info("לכל הסרטונים כבר יש פרקים (aiChapters)");
      return;
    }
    setRefreshingAllChapters(true);
    let updated = 0;
    try {
      for (const v of targets) {
        const analyzed = analyzeVideo(v, { force: true });
        const ch = buildFallbackAiChapters(v);
        if (!hasNonEmptyChapters(ch)) continue;
        const localPayload = {
          aiChapters: ch,
          videoTopics: chaptersToVideoTopics(ch),
          aiSummaryShort: analyzed.aiSummaryShort,
          aiSummaryLong: analyzed.aiSummaryLong,
          aiTags: analyzed.aiTags,
          qualityScore: analyzed.qualityScore,
          analyzedAt: analyzed.analyzedAt,
        };
        const remotePayload = {
          aiChapters: ch,
          videoTopics: chaptersToVideoTopics(ch),
        };
        if (!isBase44Enabled()) {
          if (updateStoredVideo(v.id, localPayload)) updated += 1;
        } else {
          try {
            await Video.update(v.id, remotePayload);
            updated += 1;
          } catch {
            if (updateStoredVideo(v.id, localPayload)) updated += 1;
          }
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["videos"] });
      toast.success(`נוצרו פרקים בסיסיים ל־${updated} סרטונים (מתוך ${targets.length} ללא פרקים)`);
    } catch (e) {
      toast.error(e?.message || "רענון פרקים נכשל");
    } finally {
      setRefreshingAllChapters(false);
    }
  }

  async function handleBulkFixChapters() {
    const local = loadVideos();
    const targets = local.filter((v) =>
      !Array.isArray(v.aiChapters) ||
      v.aiChapters.length === 0 ||
      v.aiChapters.some((chapter) => !Number.isFinite(chapter?.startSeconds))
    );
    if (targets.length === 0) {
      toast.info("אין מה לתקן — לכל הסרטונים יש aiChapters");
      return;
    }

    setBulkFixingChapters(true);
    setBulkFixProgress({ done: 0, total: targets.length });

    let done = 0;
    let saved = 0;

    try {
      for (const v of targets) {
        done += 1;
        setBulkFixProgress({ done, total: targets.length });

        const ytId = extractVideoId(v.url);
        const metadata =
          ytId && (!v.duration || !v.description || !v.viewCount)
            ? await fetchVideoMetadata(ytId).catch(() => null)
            : null;
        const enrichedVideo = {
          ...v,
          ...(metadata?.description && (!v.description || metadata.description.length > String(v.description || "").length)
            ? { description: metadata.description }
            : {}),
          ...(metadata?.duration ? { duration: metadata.duration } : {}),
          ...(metadata?.viewCount ? { viewCount: metadata.viewCount } : {}),
        };

        // Never overwrite good chapters; only backfill or add estimated timestamps when missing.
        const analyzed = analyzeVideo(enrichedVideo, { force: true });
        const sourceChapters = hasNonEmptyChapters(v.aiChapters) ? v.aiChapters : buildFallbackAiChapters(enrichedVideo);
        const chapters = ensureChaptersHaveNavigation(sourceChapters, enrichedVideo);
        if (!hasNonEmptyChapters(chapters)) {
          console.log("[bulk chapters fix]", v?.title, 0, "none");
          updateStoredVideo(v.id, {
            chapterStatus: "failed",
            updatedAt: new Date().toISOString(),
          });
          continue;
        }

        const ts = chapters?.[0]?.timeSource;
        const source = ts === "real" ? "description" : ts === "estimated" ? "estimated" : "outline";

        updateStoredVideo(v.id, {
          aiChapters: chapters,
          videoTopics: chaptersToVideoTopics(chapters),
          chapterStatus: "fixed",
          ...(enrichedVideo.description ? { description: enrichedVideo.description } : {}),
          ...(enrichedVideo.duration ? { duration: enrichedVideo.duration } : {}),
          ...(enrichedVideo.viewCount ? { viewCount: enrichedVideo.viewCount } : {}),
          analyzedAt: v.analyzedAt || analyzed.analyzedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        saved += 1;

        console.log("[bulk chapters fix]", v?.title, chapters.length, source);
      }

      await queryClient.invalidateQueries({ queryKey: ["videos"] });
      toast.success(`תוקן ${saved} מתוך ${targets.length} סרטונים ללא פרקים`);
    } catch (e) {
      toast.error(e?.message || "Bulk fix נכשל");
    } finally {
      setBulkFixingChapters(false);
      setTimeout(() => setBulkFixProgress(null), 1500);
    }
  }

  async function handleExportBrainStructureZip() {
    setExportingBrainZip(true);
    try {
      const zip = buildBrainStructureZip();
      const { brains, subBrains } = countBrainStructure();
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Knowledge-Base-Structure-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`יוצא מבנה Brain: ${brains} ברינים, ${subBrains} תת-ברינים`);
    } catch (e) {
      toast.error(e?.message || "ייצוא מבנה Brain נכשל");
    } finally {
      setExportingBrainZip(false);
    }
  }

  async function handleExportWorkspaceZip() {
    const analyzed = videos.filter((v) => v.analyzedAt);
    if (analyzed.length === 0) {
      toast.info("אין סרטונים מנותחים לייצוא");
      return;
    }
    setExportingZip(true);
    try {
      const { zip, exportStats } = await buildWorkspaceZip(videos, mentors, topics);
      logWorkspaceZipExportSummary(exportStats);
      await downloadWorkspaceZip(zip);
      toast.success(formatZipExportSuccessHebrew(exportStats));
    } catch (e) {
      toast.error(e?.message || "ייצוא ZIP נכשל");
    } finally {
      setExportingZip(false);
    }
  }

  function handleBackupLocalVideos() {
    try {
      const data = loadVideos();
      const payload = {
        exportedAt: new Date().toISOString(),
        count: data.length,
        videos: data,
      };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.href = url;
      a.download = `youtube-mentor-videos-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`גיבוי ירד (${data.length} סרטונים)`);
    } catch (e) {
      toast.error(e?.message || "גיבוי נכשל");
    }
  }

  async function handleClearAllLocalVideosSafe() {
    const local = loadVideos();
    const count = local.length;
    const msg =
      `למחוק את כל הסרטונים המקומיים?\\n` +
      `יימחקו ${count} סרטונים מה-localStorage בלבד.\\n` +
      `לא יימחקו מנטורים/נושאים/קטגוריות/הגדרות.\\n\\n` +
      `המשך?`;
    const ok = window.confirm(msg);
    if (!ok) return;

    setClearingLocalVideos(true);
    try {
      clearLocalVideoData();
      queryClient.setQueryData(["videos"], []);
      await queryClient.invalidateQueries({ queryKey: ["videos"] });
      try {
        window.dispatchEvent(new Event("storage"));
      } catch {}
      toast.success(`כל הסרטונים המקומיים נמחקו (${count})`);
    } catch (e) {
      toast.error(e?.message || "מחיקה נכשלה");
    } finally {
      setClearingLocalVideos(false);
    }
  }

  return (
    <div data-testid="page-admin" className="min-h-screen w-full text-slate-900 dark:text-white">
      <header className="border-b border-slate-200 bg-white/90 px-6 py-5 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/90">
        <div className="mx-auto flex w-full max-w-none flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">ניהול</h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">
              מרכז השליטה של YouTube Mentor — כל הכלים לניהול הערוצים, הידע והאוטומציות במקום אחד.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <p className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 sm:text-right">פעולות מערכת</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleExportWorkspaceZip()}
                disabled={exportingZip}
                className={adminBtnPrimary}
                title="ייצא את כל הסרטונים המנותחים וההערות כ-ZIP מאורגן לפי נושאים"
              >
                {exportingZip ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                ייצא Workspace
              </button>
              <button
                type="button"
                onClick={() => void handleExportBrainStructureZip()}
                disabled={exportingBrainZip}
                className={adminBtnSecondary}
                title="ייצא את מבנה ה-Brain המלא כ-ZIP מוכן לייבוא ל-Obsidian"
              >
                {exportingBrainZip ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderTree className="h-4 w-4" />}
                ייצא מבנה Obsidian
              </button>
              <button
                type="button"
                onClick={handleBackupLocalVideos}
                className={adminBtnSecondary}
                title="מוריד קובץ JSON של כל הסרטונים מה-localStorage"
              >
                <Download className="h-4 w-4" />
                גבה סרטונים
              </button>
              <button
                type="button"
                onClick={() => void handleBulkFixChapters()}
                disabled={bulkFixingChapters}
                className={adminBtnSecondary}
              >
                {bulkFixingChapters ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListVideo className="h-4 w-4" />}
                תקן פרקים
              </button>
              <button
                type="button"
                onClick={() => void handleRefreshAllChapters()}
                disabled={refreshingAllChapters || videos.length === 0}
                className={adminBtnSecondary}
              >
                {refreshingAllChapters ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ListVideo className="h-4 w-4" />
                )}
                רענן פרקים
              </button>
              <button
                type="button"
                onClick={() => void handleClearAllLocalVideosSafe()}
                disabled={clearingLocalVideos}
                className={adminBtnDestructive}
                title="מוחק רק את רשימת הסרטונים המקומיים (localStorage)"
              >
                {clearingLocalVideos ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                מחק מקומיים
              </button>
            </div>
            {bulkFixProgress ? (
              <div className="text-right text-xs text-slate-500 dark:text-zinc-400">
                תוקן {bulkFixProgress.done} מתוך {bulkFixProgress.total}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Admin Tools Dashboard */}
      <div className="border-b border-slate-200 bg-slate-50/60 px-6 py-5 dark:border-zinc-800/80 dark:bg-zinc-950/40">
        <div className="relative mb-4 max-w-xs" dir="rtl">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
          <input
            type="search"
            dir="rtl"
            value={adminSearch}
            onChange={(e) => setAdminSearch(e.target.value)}
            placeholder="חפש כלי ניהול..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-10 pl-8 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500"
          />
          {adminSearch && (
            <button
              type="button"
              onClick={() => setAdminSearch("")}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              aria-label="נקה חיפוש"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5" dir="rtl">
          {ADMIN_TOOLS.filter(t =>
            !adminSearch.trim() ||
            t.label.toLowerCase().includes(adminSearch.trim().toLowerCase()) ||
            t.desc.toLowerCase().includes(adminSearch.trim().toLowerCase()) ||
            (t.aliases || []).some(a => a.toLowerCase().includes(adminSearch.trim().toLowerCase()))
          ).map(tool => (
            <button
              key={tool.tab || tool.route}
              type="button"
              onClick={() => { setAdminSearch(""); if (tool.tab) setActiveTab(tool.tab); else if (tool.route && navigateTo) navigateTo(tool.route); }}
              className={[
                "text-right rounded-xl border p-3 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md",
                tool.tab && activeTab === tool.tab
                  ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200/60 dark:border-indigo-700 dark:bg-indigo-950/40 dark:ring-indigo-800/50"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700",
              ].join(" ")}
              dir="rtl"
            >
              <div className={`mb-2 inline-flex rounded-lg p-1.5 ${tool.iconBg}`}>
                <tool.Icon className={`h-4 w-4 ${tool.iconColor}`} />
              </div>
              <div className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{tool.label}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-zinc-400">{tool.desc}</div>
              {tool.route && <div className="mt-1 text-[10px] font-medium text-indigo-400 dark:text-indigo-500">↗ מעבר לדף</div>}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl" className="w-full">
          <div className="mb-4 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs" dir="rtl">
              <span className="text-slate-400 dark:text-zinc-500">ניהול</span>
              <span className="text-slate-300 dark:text-zinc-600">←</span>
              <span className="font-semibold text-slate-700 dark:text-zinc-200">{TAB_LABELS[activeTab]}</span>
            </div>
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="rss" className="text-sm flex items-center gap-1.5">
                <Rss className="h-3.5 w-3.5" />
                משיכת RSS
              </TabsTrigger>
              <TabsTrigger value="mentors" className="text-sm">ערוצים</TabsTrigger>
              <TabsTrigger value="topics" className="text-sm">נושאים</TabsTrigger>
              <TabsTrigger value="categories" className="text-sm">קטגוריות</TabsTrigger>
              <TabsTrigger value="sources" className="text-sm">מקורות</TabsTrigger>
              <TabsTrigger value="storage" className="text-sm flex items-center gap-1.5">
                💾 אחסון
              </TabsTrigger>
              <TabsTrigger value="vault-migration" className="text-sm flex items-center gap-1.5">
                <FolderSync className="h-3.5 w-3.5" />
                ארגון Vault
              </TabsTrigger>
              <TabsTrigger value="billing" className="text-sm flex items-center gap-1.5">
                💳 Anthropic Billing
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="rss" className="mt-0 w-full">
            <div className={adminCard}>
              <div className="min-w-[900px]">
                <RssTab videos={videos} mentors={mentors} sources={sources} topics={topics} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="mentors" className="mt-0 w-full">
            <div className={adminCard}>
              <div className="min-w-[900px]">
                <MentorsTab mentors={mentors} topics={topics} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="topics" className="mt-0 w-full">
            <div className={adminCard}>
              <div className="min-w-[900px]">
                <TopicsTab topics={topics} videos={videos} mentors={mentors} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="categories" className="mt-0 w-full">
            <div className={adminCard}>
              <div className="min-w-[900px]">
                <CategoriesTab mentors={mentors} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="sources" className="mt-0 w-full">
            <div className={adminCard}>
              <div className="min-w-[900px]">
                <SourcesTab sources={sources} mentors={mentors} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="storage" className="mt-0 w-full">
            <div className={adminCard}>
              <StorageManager />
            </div>
          </TabsContent>
          <TabsContent value="vault-migration" className="mt-0 w-full">
            <div className={adminCard}>
              <VaultMigrationTab />
            </div>
          </TabsContent>

          <TabsContent value="billing" className="mt-0 w-full">
            <AnthropicBillingTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
