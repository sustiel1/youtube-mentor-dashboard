import { useState, useMemo, useEffect } from "react";
import { Search, Library } from "lucide-react";
import { useVideos, useSaveVideo, useUpdateLearningStatus, useAssignTopics } from "@/hooks/useVideos";
import { useMentors } from "@/hooks/useMentors";
import { useTopics } from "@/hooks/useTopics";
import { VideoDetailPanel } from "@/components/dashboard/VideoDetailPanel";
import { getDashboardStats, resolveCanonicalChapters } from "@/services/videoAnalytics";
import { getAllChunkCounts, saveChunks, hasChunks, deleteChunks, isChunkFresh, saveChunkMeta, enrichChunksWithExcerpts } from "@/lib/localChunkStore";
import { generateKnowledgeChunks } from "@/lib/generateKnowledgeChunks";
import { hasSegments, getSegments } from "@/lib/localSegmentStore";

const QUALITY_BADGE = {
  high:   { label: "גבוה",   cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  medium: { label: "בינוני", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  low:    { label: "נמוך",   cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  none:   { label: "אין",    cls: "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-500" },
};

const SOURCE_BADGE = {
  ai:          { label: "AI",     cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
  description: { label: "תיאור", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  fallback:    { label: "הערכה", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  none:        { label: "—",      cls: "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-600" },
};

function Badge({ map, value }) {
  const cfg = map[value] ?? map.none;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        active
          ? "bg-violet-600 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

const QUALITY_OPTIONS = ["all", "high", "medium", "low", "none"];
const QUALITY_LABELS  = { all: "הכל", high: "גבוה", medium: "בינוני", low: "נמוך", none: "אין תמלול" };
const SOURCE_OPTIONS  = ["all", "ai", "description", "fallback", "none"];
const SOURCE_LABELS   = { all: "הכל", ai: "AI", description: "תיאור", fallback: "הערכה", none: "ללא פרקים" };

export default function KnowledgeLibrary({ isDark, toggleTheme }) {
  const { data: videos = [], isLoading } = useVideos();
  const { data: mentors = [] } = useMentors();
  const { data: topics = [] } = useTopics();
  const [search, setSearch] = useState("");
  const [qualityFilter, setQualityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [chunkCounts, setChunkCounts] = useState(() => getAllChunkCounts());
  /** AI tag chip filter (same tags as former dashboard SmartDistribution row) */
  const [selectedAiTag, setSelectedAiTag] = useState(null);

  const saveVideo = useSaveVideo();
  const updateLearningStatus = useUpdateLearningStatus();
  const assignTopics = useAssignTopics();

  const mentorMap = useMemo(
    () => Object.fromEntries(mentors.map((m) => [m.id, m.name])),
    [mentors]
  );

  const enriched = useMemo(
    () =>
      videos.map((v) => ({
        ...v,
        ...resolveCanonicalChapters(v),
        mentorName: mentorMap[v.mentorId] || v.channelTitle || "—",
      })),
    [videos, mentorMap]
  );

  const tagCounts = useMemo(() => {
    const stats = getDashboardStats(videos, mentors);
    return stats?.tagCounts && typeof stats.tagCounts === "object" ? stats.tagCounts : {};
  }, [videos, mentors]);

  const filtered = useMemo(() => {
    let list = enriched;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((v) => v.title?.toLowerCase().includes(q) || v.mentorName?.toLowerCase().includes(q));
    if (qualityFilter !== "all") list = list.filter((v) => (v.transcriptQuality || "none") === qualityFilter);
    if (sourceFilter !== "all") list = list.filter((v) => v.chapterSource === sourceFilter);
    if (selectedAiTag) {
      list = list.filter((v) => Array.isArray(v.aiTags) && v.aiTags.includes(selectedAiTag));
    }
    return list;
  }, [enriched, search, qualityFilter, sourceFilter, selectedAiTag]);

  const selectedMentorName = useMemo(
    () => (selectedVideo ? mentorMap[selectedVideo.mentorId] || selectedVideo.channelTitle || "" : ""),
    [selectedVideo, mentorMap]
  );

  const handleRowClick = (video) => {
    setSelectedVideo(video);
    setPanelOpen(true);
  };

  const handleSaveToggle = (video) => {
    saveVideo.mutate({ id: video.id, isSaved: !video.isSaved });
    if (selectedVideo?.id === video.id) setSelectedVideo({ ...video, isSaved: !video.isSaved });
  };

  const handleLearningStatusChange = (video, status) => {
    updateLearningStatus.mutate({ id: video.id, learningStatus: status });
    if (selectedVideo?.id === video.id) setSelectedVideo({ ...video, learningStatus: status });
  };

  const handleRemoveTopic = (video, topicId) => {
    const newTopicIds = (video.topicIds || []).filter((id) => id !== topicId);
    assignTopics.mutate({ id: video.id, topicIds: newTopicIds });
    if (selectedVideo?.id === video.id) setSelectedVideo({ ...video, topicIds: newTopicIds });
  };

  useEffect(() => {
    const analyzed = videos.filter((v) => v.analyzedAt);
    if (!analyzed.length) return;
    let changed = false;
    for (const video of analyzed) {
      const key = video.videoId || video.id;
      if (!key) continue;
      if (!hasChunks(key) || !isChunkFresh(key, video)) {
        deleteChunks(key);
        const chunks = generateKnowledgeChunks(video);
        if (chunks.length > 0) {
          saveChunks(key, chunks);
          saveChunkMeta(key, { analyzedAt: video.analyzedAt });
          changed = true;
        }
      } else if (hasSegments(key)) {
        if (enrichChunksWithExcerpts(key, getSegments(key))) changed = true;
      }
    }
    if (changed) setChunkCounts(getAllChunkCounts());
  }, [videos]);

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-6 py-4 shrink-0">
        <Library className="h-5 w-5 text-violet-600 shrink-0" />
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-zinc-100">ספריית ידע</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {isLoading ? "טוען..." : `${videos.length} סרטונים · ${filtered.length} מוצגים`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-6 py-3 space-y-2 shrink-0">
        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="חיפוש לפי כותרת או מנטור..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 pr-8 pl-3 py-1.5 text-sm text-right placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0">תמלול:</span>
          {QUALITY_OPTIONS.map((opt) => (
            <FilterChip key={opt} label={QUALITY_LABELS[opt]} active={qualityFilter === opt} onClick={() => setQualityFilter(opt)} />
          ))}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0">פרקים:</span>
          {SOURCE_OPTIONS.map((opt) => (
            <FilterChip key={opt} label={SOURCE_LABELS[opt]} active={sourceFilter === opt} onClick={() => setSourceFilter(opt)} />
          ))}
        </div>

        {Object.keys(tagCounts).length > 0 && (
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0">נושאים / תגיות:</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(tagCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([tag, count]) => {
                  const active = selectedAiTag === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedAiTag((prev) => (prev === tag ? null : tag))}
                      className={[
                        "text-xs px-2.5 py-1 rounded-full border transition-colors",
                        active
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60 dark:hover:bg-indigo-900/40",
                      ].join(" ")}
                    >
                      {tag} · {count}
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-slate-400 dark:text-zinc-500 text-sm">
            טוען סרטונים...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-400 dark:text-zinc-500 text-sm">
            לא נמצאו סרטונים
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white dark:bg-zinc-950 border-b border-slate-100 dark:border-zinc-800">
              <tr className="text-right text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
                <th className="px-6 py-2.5">כותרת</th>
                <th className="px-4 py-2.5">מנטור</th>
                <th className="px-4 py-2.5 text-center">דירוג</th>
                <th className="px-4 py-2.5 text-center">תמלול</th>
                <th className="px-4 py-2.5 text-center">פרקים</th>
                <th className="px-4 py-2.5 text-center">מקור פרקים</th>
                <th className="px-4 py-2.5 text-center">נותח</th>
                <th className="px-4 py-2.5 text-center">Brain</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-zinc-800/40">
              {filtered.map((v) => {
                const chunkKey = v.videoId || v.id;
                const chunkCount = chunkCounts[chunkKey] || 0;
                return (
                <tr
                  key={v.id}
                  onClick={() => handleRowClick(v)}
                  className="hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-3 max-w-xs">
                    <p className="font-medium text-slate-800 dark:text-zinc-100 line-clamp-1" title={v.title}>
                      {v.title}
                    </p>
                    {v.publishedAt && (
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                        {new Date(v.publishedAt).toLocaleDateString("he-IL")}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-zinc-300 whitespace-nowrap">
                    {v.mentorName}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {v.qualityScore != null ? (
                      <span className={`text-xs font-semibold ${
                        v.qualityScore >= 8 ? "text-emerald-600 dark:text-emerald-400" :
                        v.qualityScore >= 6 ? "text-amber-600 dark:text-amber-400" :
                                              "text-slate-400 dark:text-zinc-500"
                      }`}>
                        {v.qualityScore}
                        <span className="font-normal opacity-50">/10</span>
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-zinc-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge map={QUALITY_BADGE} value={v.transcriptQuality || "none"} />
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-slate-500 dark:text-zinc-400">
                    {v.chapterCount > 0 ? v.chapterCount : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge map={SOURCE_BADGE} value={v.chapterSource} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {v.analyzedAt ? (
                      <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">✓</span>
                    ) : (
                      <span className="text-slate-300 dark:text-zinc-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {chunkCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                        {chunkCount} · Brain
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-zinc-600 text-xs">—</span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Video Detail Panel */}
      <VideoDetailPanel
        video={selectedVideo}
        mentorName={selectedMentorName}
        mentors={mentors.filter((m) => m.active !== false)}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        topics={topics}
        onSaveToggle={handleSaveToggle}
        onLearningStatusChange={handleLearningStatusChange}
        onRemoveTopic={handleRemoveTopic}
        onVideoPatch={(patch) => setSelectedVideo((prev) => (prev ? { ...prev, ...patch } : null))}
        isDark={isDark}
        toggleTheme={toggleTheme}
      />
    </div>
  );
}
