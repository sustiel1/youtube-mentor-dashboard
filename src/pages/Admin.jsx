import { useState, useCallback } from "react";
import { Bot, TrendingUp, Pencil, Trash2, Globe, Youtube, Rss, Hash, RefreshCw, CheckCircle2, XCircle, Loader2, AlertTriangle, Code } from "lucide-react";
import { useMentors } from "@/hooks/useMentors";
import { useSources } from "@/hooks/useSources";
import { useTopics } from "@/hooks/useTopics";
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
// ניהול מנטורים
// ────────────────────────────────────────────
function MentorsTab({ mentors }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">מנטורים ({mentors.length})</h2>
        <button className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">
          + הוסף מנטור
        </button>
      </div>

      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-right px-4 py-3 text-gray-500 font-medium">שם</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">קטגוריה</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">סטטוס</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {mentors.map((mentor, i) => {
              const cat = CATEGORY_CONFIG[mentor.category];
              const Icon = cat?.icon;
              return (
                <tr key={mentor.id} className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold">
                        {mentor.name?.[0]?.toUpperCase()}
                      </span>
                      <span className="font-medium text-gray-800">{mentor.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {cat && (
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cat.color}`}>
                        {Icon && <Icon className="h-3 w-3" />}
                        {cat.label}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                      mentor.active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {mentor.active ? "פעיל" : "מושבת"}
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
    </div>
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

function TopicsTab({ topics, videos }) {
  const getVideoCount = (topicId) =>
    videos.filter((v) => (v.topicIds || []).includes(topicId)).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">נושאים ({topics.length})</h2>
        <button className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">
          + הוסף נושא
        </button>
      </div>

      {topics.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-xl p-10 text-center">
          <p className="text-sm text-gray-400">אין נושאים מוגדרים</p>
          <p className="text-xs text-gray-300 mt-1">הוסף נושא כדי לארגן סרטונים</p>
        </div>
      ) : (
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-right px-4 py-3 text-gray-500 font-medium">נושא</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">תיאור</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">צבע</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">סרטונים</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {topics.map((topic, i) => {
                const colorClass = TOPIC_COLOR_MAP[topic.color] || TOPIC_COLOR_MAP.violet;
                return (
                  <tr key={topic.id} className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`p-1 rounded ${colorClass}`}>
                          <Hash className="h-3.5 w-3.5" />
                        </span>
                        <span className="font-medium text-gray-800">{topic.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">{topic.description}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
                        {topic.color}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-700">
                        {getVideoCount(topic.id)}
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
            <MentorsTab mentors={mentors} />
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
