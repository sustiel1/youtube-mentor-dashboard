import { useState, useMemo, useEffect } from "react";
import { Search, Clock } from "lucide-react";
import { buildTimestampUrl } from "@/services/youtubeMetadata";
import { useVideos, useSaveVideo, useUpdateLearningStatus, useAssignTopics } from "@/hooks/useVideos";
import { useMentors } from "@/hooks/useMentors";
import { useTopics } from "@/hooks/useTopics";
import { VideoDetailPanel } from "@/components/dashboard/VideoDetailPanel";
import { getAllChunks, getAllChunkCounts, saveChunks, hasChunks, deleteChunks, isChunkFresh, saveChunkMeta, enrichChunksWithExcerpts } from "@/lib/localChunkStore";
import { generateKnowledgeChunks } from "@/lib/generateKnowledgeChunks";
import { searchChunks } from "@/lib/chunkSearch";
import { hasSegments, getSegments } from "@/lib/localSegmentStore";
import { getManualNotes } from "@/lib/localManualNoteStore";

const SOURCE_BADGE = {
  ai:          { label: "AI",     cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
  description: { label: "תיאור", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  fallback:    { label: "הערכה", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  none:        { label: "—",     cls: "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-600" },
};

const QUALITY_BADGE = {
  high:   { label: "גבוה",   cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  medium: { label: "בינוני", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  low:    { label: "נמוך",   cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  none:   { label: "—",      cls: "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-600" },
};

const NOTE_SOURCE_BADGE = {
  manual:     { label: "ידני",       cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  notebooklm: { label: "NotebookLM", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
  research:   { label: "מחקר",       cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
};

function searchManualNotes(query, notes, topicMap) {
  if (!query.trim() || !notes.length) return [];
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return notes.filter((note) => {
    const hay = [
      note.title,
      note.content,
      (note.tags || []).join(' '),
      topicMap[note.topicId] || '',
      topicMap[note.subtopicId] || '',
    ].join(' ').toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

function ManualNoteCard({ note, topicMap, terms }) {
  const sourceCfg = NOTE_SOURCE_BADGE[note.sourceType] || NOTE_SOURCE_BADGE.manual;
  const topicName = topicMap[note.subtopicId] || topicMap[note.topicId] || '';
  const preview   = (note.content || '').slice(0, 200).replace(/\n/g, ' ');
  return (
    <div className="rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/40 dark:bg-blue-950/20 p-3 text-right">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-semibold text-slate-800 dark:text-zinc-100 text-sm leading-snug">
          <HighlightedText text={note.title} terms={terms} />
        </p>
        <span className={`shrink-0 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${sourceCfg.cls}`}>
          {sourceCfg.label}
        </span>
      </div>
      {preview && (
        <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2 mb-2 leading-relaxed">
          <HighlightedText text={preview} terms={terms} />
        </p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        {topicName && (
          <span className="text-[11px] text-slate-600 dark:text-zinc-300">{topicName}</span>
        )}
        {(note.tags || []).map((tag) => (
          <span key={tag} className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded px-1 py-0.5">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function SmallBadge({ cfg }) {
  return (
    <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function HighlightedText({ text, terms }) {
  if (!text) return null;
  if (!terms?.length) return <>{text}</>;
  const escaped = terms
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(Boolean);
  if (!escaped.length) return <>{text}</>;
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = String(text).split(re);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className="bg-violet-200/80 dark:bg-violet-900/60 text-inherit rounded-sm px-0.5 not-italic"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

function getMatchedFields(chunk, mentorName, terms) {
  if (!terms?.length) return [];
  const fields = [];
  const checks = [
    [(chunk.title || '').toLowerCase(),             'כותרת'],
    [(chunk.summary || '').toLowerCase(),           'סיכום'],
    [(chunk.tags || []).join(' ').toLowerCase(),    'תגיות'],
    [(mentorName || '').toLowerCase(),              'מנטור'],
    [(chunk.transcriptExcerpt || '').toLowerCase(), 'תמלול'],
  ];
  for (const term of terms) {
    for (const [hay, label] of checks) {
      if (hay.includes(term) && !fields.includes(label)) fields.push(label);
    }
  }
  return fields;
}

function EmptySearchState({ totalChunks, indexedCount, totalVideos }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-6">
      <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-4">
        <Search className="h-6 w-6 text-violet-500" />
      </div>
      <p className="text-sm font-medium text-slate-700 dark:text-zinc-200 mb-1">חיפוש פרקי ידע</p>
      <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-xs leading-relaxed">
        {totalChunks > 0
          ? `${totalChunks} פרקי ידע מוכנים מתוך ${indexedCount} סרטונים. חפש לפי נושא, מנטור, אסטרטגיה, טיקר ועוד.`
          : `עדיין אין פרקי ידע. נתח סרטונים כדי לאפשר חיפוש.`
        }
      </p>
    </div>
  );
}

function ResultCard({ result, terms, onClick, onTimestampClick }) {
  const { chunk, video, mentorName } = result;
  const sourceCfg    = SOURCE_BADGE[chunk.source]             || SOURCE_BADGE.none;
  const qualityCfg   = QUALITY_BADGE[chunk.transcriptQuality] || QUALITY_BADGE.none;
  const matchedFields = getMatchedFields(chunk, mentorName, terms);
  const showExcerpt  = chunk.transcriptExcerpt && matchedFields.includes('תמלול');

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-violet-200 dark:hover:border-violet-800/60 hover:shadow-sm transition-all p-3 text-right"
    >
      {/* Title + timestamp */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-semibold text-slate-800 dark:text-zinc-100 text-sm leading-snug">
          <HighlightedText text={chunk.title} terms={terms} />
        </p>
        {chunk.timestampLabel && (
          <button
            type="button"
            onClick={(e) => onTimestampClick(e, result)}
            title="פתח ב-YouTube בזמן המדויק"
            className="shrink-0 flex items-center gap-0.5 font-mono text-[11px] text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200 transition-colors"
          >
            <Clock className="h-3 w-3" />
            {chunk.timestampLabel}
          </button>
        )}
      </div>

      {/* Summary */}
      {chunk.summary && (
        <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2 mb-2 leading-relaxed">
          <HighlightedText text={chunk.summary} terms={terms} />
        </p>
      )}

      {/* Transcript excerpt — only when the match came from it */}
      {showExcerpt && (
        <p className="text-[11px] text-slate-400 dark:text-zinc-500 line-clamp-2 mb-2 leading-relaxed border-r-2 border-violet-200 dark:border-violet-800/50 pr-2">
          <HighlightedText text={chunk.transcriptExcerpt} terms={terms} />
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {video?.title && (
          <span className="text-[11px] text-slate-600 dark:text-zinc-300 truncate max-w-[180px]">
            {video.title}
          </span>
        )}
        {mentorName && (
          <>
            <span className="text-slate-300 dark:text-zinc-600 text-[10px]">·</span>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400">{mentorName}</span>
          </>
        )}
        <span className="text-slate-300 dark:text-zinc-600 text-[10px]">·</span>
        <SmallBadge cfg={sourceCfg} />
        <SmallBadge cfg={qualityCfg} />
        {matchedFields.length > 0 && (
          <>
            <span className="text-slate-300 dark:text-zinc-600 text-[10px]">·</span>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0">התאמה:</span>
            {matchedFields.map((f) => (
              <span
                key={f}
                className="text-[10px] bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 rounded px-1 py-0.5"
              >
                {f}
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default function KnowledgeSearch({ isDark, toggleTheme }) {
  const { data: videos = [], isLoading } = useVideos();
  const { data: mentors = [] } = useMentors();
  const { data: topics = [] } = useTopics();
  const [query, setQuery] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedChunk, setSelectedChunk] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [chunkVersion, setChunkVersion] = useState(0);

  const saveVideo           = useSaveVideo();
  const updateLearningStatus = useUpdateLearningStatus();
  const assignTopics        = useAssignTopics();

  // Auto-generate chunks for analyzed videos not yet indexed; enrich existing chunks lazily
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
    if (changed) setChunkVersion((v) => v + 1);
  }, [videos]);

  const mentorMap = useMemo(
    () => Object.fromEntries(mentors.map((m) => [m.id, m.name])),
    [mentors]
  );

  const topicMap = useMemo(
    () => Object.fromEntries(topics.map((t) => [t.id, t.name || t.label || ''])),
    [topics]
  );

  const videoMap = useMemo(() => {
    const map = {};
    for (const v of videos) {
      if (v.videoId) map[v.videoId] = v;
      if (v.id)      map[v.id]      = v;
    }
    return map;
  }, [videos]);

  // Re-read chunks from storage after generation or on mount
  const allChunks = useMemo(() => getAllChunks(), [chunkVersion]);

  const indexedCount = useMemo(() => {
    const counts = getAllChunkCounts();
    return Object.keys(counts).filter((id) => counts[id] > 0).length;
  }, [chunkVersion]);

  const terms = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query]
  );

  const results = useMemo(
    () => searchChunks(query, { chunks: allChunks, videoMap, mentorMap }),
    [query, allChunks, videoMap, mentorMap]
  );

  const manualResults = useMemo(
    () => searchManualNotes(query, getManualNotes(), topicMap),
    [query, topicMap]
  );

  const selectedMentorName = useMemo(
    () => (selectedVideo ? mentorMap[selectedVideo.mentorId] || selectedVideo.channelTitle || "" : ""),
    [selectedVideo, mentorMap]
  );

  const handleResultClick = (result) => {
    setSelectedVideo(result.video);
    setSelectedChunk(null);
    setPanelOpen(true);
  };

  const handleTimestampClick = (e, result) => {
    e.stopPropagation();
    setSelectedVideo(result.video);
    setSelectedChunk(result.chunk);
    setPanelOpen(true);
    const videoUrl = result.video?.url || '';
    const ts = result.chunk?.startSeconds;
    if (videoUrl && Number.isFinite(ts)) {
      const tsUrl = buildTimestampUrl(videoUrl, ts);
      if (tsUrl) window.open(tsUrl, '_blank', 'noopener,noreferrer');
    }
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

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-6 py-4 shrink-0">
        <Search className="h-5 w-5 text-violet-600 shrink-0" />
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-zinc-100">חיפוש ידע</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {isLoading
              ? "טוען..."
              : `${indexedCount}/${videos.length} סרטונים · ${allChunks.length} פרקי ידע · ${getManualNotes().length} הערות ידניות`
            }
          </p>
        </div>
      </div>

      {/* Search input */}
      <div className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-6 py-4 shrink-0">
        <div className="relative max-w-xl">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="חפש פרקים, נושאים, מנטורים, אסטרטגיות..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 pr-10 pl-10 py-2.5 text-sm text-right placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors text-sm leading-none"
            >
              ✕
            </button>
          )}
        </div>
        {query && (
          <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
            {results.length + manualResults.length === 0
              ? "לא נמצאו תוצאות"
              : `${results.length + manualResults.length} תוצאות`
            }
          </p>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!query ? (
          <EmptySearchState
            totalChunks={allChunks.length}
            indexedCount={indexedCount}
            totalVideos={videos.length}
          />
        ) : results.length === 0 && manualResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 dark:text-zinc-500">
            <p className="text-sm">לא נמצאו תוצאות התואמות לחיפוש</p>
            <p className="text-xs mt-1">נסה מונח אחר, או וודא שיש סרטונים מנותחים והערות ידע</p>
          </div>
        ) : (
          <div className="px-6 py-4 space-y-2">
            {manualResults.length > 0 && (
              <>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wide pb-1">
                  הערות ידע ({manualResults.length})
                </p>
                {manualResults.map((note) => (
                  <ManualNoteCard key={note.id} note={note} topicMap={topicMap} terms={terms} />
                ))}
                {results.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-zinc-800 pt-2 mt-2">
                    <p className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wide pb-1">
                      פרקי ידע מסרטונים ({results.length})
                    </p>
                  </div>
                )}
              </>
            )}
            {results.map((result, i) => (
              <ResultCard
                key={`${result.chunk.id}-${i}`}
                result={result}
                terms={terms}
                onClick={() => handleResultClick(result)}
                onTimestampClick={handleTimestampClick}
              />
            ))}
          </div>
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
        initialChapterIndex={selectedChunk?.chapterIndex ?? null}
      />
    </div>
  );
}
