import { useState, useMemo, useEffect } from "react";
import { useTopics } from "@/hooks/useTopics";
import { useVideos } from "@/hooks/useVideos";
import { useMentors } from "@/hooks/useMentors";
import { getManualNotesByTopic } from "@/lib/localManualNoteStore";
import { getKnowledgeItems } from "@/lib/localKnowledgeItemStore";
import {
  buildWorkspaceZip,
  formatZipExportSuccessHebrew,
  logWorkspaceZipExportSummary,
} from "@/lib/buildWorkspaceZip";
import { downloadWorkspaceZip } from "@/lib/downloadWorkspaceZip";
import { Archive, Download, BookMarked, Play, FileText, FolderOpen, X, Star } from "lucide-react";
import { toast } from "sonner";
import { getWorkspaceItems } from "@/lib/workspaceLibraryStore";

export default function Workspace({ navigateTo, pageParams }) {
  const { data: topics = [], isLoading } = useTopics();
  const { data: videos = [] } = useVideos();
  const { data: mentors = [] } = useMentors();
  const [exportingAll, setExportingAll] = useState(false);
  const [exportingTopicId, setExportingTopicId] = useState(null);

  const knowledgeItems = useMemo(() => {
    try {
      return getKnowledgeItems();
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    if (pageParams?.hint === "choose-topic") {
      toast.info("בחר נושא לסרטון לפני ייצוא ל-Obsidian", { duration: 4000 });
    }
  }, [pageParams?.hint]);

  const mainTopics = useMemo(
    () => topics.filter((t) => !t.parentId || t.isMainCategory),
    [topics]
  );

  const topicStats = useMemo(
    () =>
      mainTopics.map((topic) => ({
        ...topic,
        videoCount: videos.filter((video) => video.topicIds?.includes(topic.id)).length,
        learningCount: knowledgeItems.filter((i) => i?.topicId === topic.id).length,
        noteCount: getManualNotesByTopic(topic.id).length,
      })),
    [mainTopics, knowledgeItems, videos]
  );

  const totalAnalyzed = useMemo(() => videos.filter((v) => v.analyzedAt).length, [videos]);
  const totalNotes = useMemo(() => topicStats.reduce((sum, t) => sum + t.noteCount, 0), [topicStats]);
  const totalBrainItems = useMemo(
    () => topicStats.reduce((sum, t) => sum + (t.learningCount || 0), 0),
    [topicStats]
  );

  const workspaceLibCount = useMemo(() => {
    try { return getWorkspaceItems().length; } catch { return 0; }
  }, []);

  const handleExportAll = async () => {
    setExportingAll(true);
    try {
      const { zip, exportStats } = await buildWorkspaceZip(videos, mentors, topics);
      logWorkspaceZipExportSummary(exportStats);
      await downloadWorkspaceZip(zip);
      toast.success(formatZipExportSuccessHebrew(exportStats));
    } catch {
      toast.error("שגיאה בייצוא ZIP");
    } finally {
      setExportingAll(false);
    }
  };

  const handleExportTopic = async (topic) => {
    setExportingTopicId(topic.id);
    try {
      const topicVideos = videos.filter((v) => v.topicIds?.includes(topic.id));
      const topicNotes = getManualNotesByTopic(topic.id);
      const { zip, exportStats } = await buildWorkspaceZip(topicVideos, mentors, topics, { manualNotesOverride: topicNotes });
      logWorkspaceZipExportSummary(exportStats);
      await downloadWorkspaceZip(zip);
      toast.success(formatZipExportSuccessHebrew(exportStats));
    } catch {
      toast.error("שגיאה בייצוא ZIP");
    } finally {
      setExportingTopicId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 dark:text-zinc-600 text-sm">
        טוען...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      <button
        type="button"
        onClick={() => {
          const back = pageParams?.__returnTo;
          if (back?.page && navigateTo) {
            navigateTo(back.page, back.params || {});
            return;
          }
          navigateTo?.("Dashboard");
        }}
        className="fixed top-4 left-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/85 text-slate-700 shadow-sm transition-colors hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900/85 dark:text-zinc-200 dark:hover:bg-zinc-800"
        title="סגור"
        aria-label="סגור"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-2 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            <BookMarked className="h-6 w-6 text-violet-500" />
            Workspace
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            הידע שלך מאורגן לפי נושאים — לניתוח, עיון וייצוא ל-Obsidian
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigateTo?.("WorkspaceLibrary")}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-950/40"
          >
            <Star className="h-4 w-4 fill-amber-400" />
            ספריית הסרטונים {workspaceLibCount > 0 && `(${workspaceLibCount})`}
          </button>
          <button
            onClick={handleExportAll}
            disabled={exportingAll}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            <Archive className="h-4 w-4" />
            {exportingAll ? "מייצא..." : "ייצוא מלא ZIP"}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-6 mb-8 py-3 border-b border-slate-200 dark:border-zinc-800">
        <span className="text-xs text-slate-500 dark:text-zinc-400">
          <span className="font-semibold text-slate-800 dark:text-zinc-200">{mainTopics.length}</span> נושאים
        </span>
        <span className="text-xs text-slate-500 dark:text-zinc-400">
          <span className="font-semibold text-slate-800 dark:text-zinc-200">{totalBrainItems}</span> Brain items
        </span>
        <span className="text-xs text-slate-500 dark:text-zinc-400">
          <span className="font-semibold text-slate-800 dark:text-zinc-200">{totalAnalyzed}</span> סרטונים מנותחים
        </span>
        <span className="text-xs text-slate-500 dark:text-zinc-400">
          <span className="font-semibold text-slate-800 dark:text-zinc-200">{totalNotes}</span> הערות ידע
        </span>
        <span className="text-xs text-slate-500 dark:text-zinc-400">
          <span className="font-semibold text-slate-800 dark:text-zinc-200">{workspaceLibCount}</span> סרטוני ספרייה
        </span>
      </div>

      {/* Topic cards */}
      {topicStats.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-zinc-600 gap-3">
          <BookMarked className="h-10 w-10 opacity-30" />
          <p className="text-sm">אין נושאים עדיין. הוסף נושאים דרך דף הנושאים.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {topicStats.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              exporting={exportingTopicId === topic.id}
              onOpen={() => navigateTo("TopicKnowledgePage", { topicId: topic.id })}
              onExport={() => handleExportTopic(topic)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TopicCard({ topic, exporting, onOpen, onExport }) {
  const isEmpty = (topic.learningCount || 0) === 0 && topic.noteCount === 0 && (topic.videoCount || 0) === 0;

  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-5 flex flex-col gap-3 hover:border-violet-200 dark:hover:border-violet-800/50 transition-colors">

      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 truncate">
            {topic.name}
          </h2>
          <span className="shrink-0 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
            Brain items: {topic.learningCount || 0}
          </span>
        </div>
        {topic.description && (
          <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-500 line-clamp-2">
            {topic.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
          <Play className="h-3.5 w-3.5 text-violet-400" />
          <span>{topic.videoCount || 0} סרטונים</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
          <BookMarked className="h-3.5 w-3.5 text-fuchsia-400" />
          <span>{topic.learningCount || 0} Saved Learnings</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
          <FileText className="h-3.5 w-3.5 text-blue-400" />
          <span>{topic.noteCount} הערות</span>
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800 mt-auto">
        <button
          onClick={onOpen}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition-colors"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          פתח נושא
        </button>
        <button
          onClick={onExport}
          disabled={exporting || isEmpty}
          title={isEmpty ? "אין תוכן לייצוא" : "ייצא נושא זה ל-ZIP"}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          {exporting ? "..." : "ZIP"}
        </button>
      </div>
    </div>
  );
}
