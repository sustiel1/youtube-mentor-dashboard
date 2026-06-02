// TopicKnowledgePage — knowledge browser organized by Topic / Subtopic.
// Left panel (content area in RTL): selected topic's videos + manual notes.
// Right panel (tree in RTL): collapsible topic tree for navigation.
//
// Data sources:
//   Topics:  useTopics() — flat array, parentId=null means main topic
//   Videos:  useVideos() — filtered by topicIds[]
//   Notes:   localManualNoteStore — localStorage, no React Query

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTopics } from "@/hooks/useTopics";
import { useVideos } from "@/hooks/useVideos";
import { useMentors } from "@/hooks/useMentors";
import {
  ChevronDown,
  Plus,
  Trash2,
  FileText,
  Play,
  BookMarked,
  Hash,
  Copy,
  Check,
  Eye,
  EyeOff,
  Download,
  ExternalLink,
  Lightbulb,
  Link2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  getManualNotesByTopic,
  saveManualNote,
  deleteManualNote,
} from "@/lib/localManualNoteStore";
import { getKnowledgeItemsByTopic } from "@/lib/localKnowledgeItemStore";
import {
  buildWorkspaceZip,
  formatZipExportSuccessHebrew,
  logWorkspaceZipExportSummary,
} from "@/lib/buildWorkspaceZip";
import { downloadWorkspaceZip } from "@/lib/downloadWorkspaceZip";
import { toast } from "sonner";
import { parseYouTubeVideoId } from "@/lib/youtubeUrlParser";
import { X } from "lucide-react";

// ── Source type display config ─────────────────────────────────────────────
const SOURCE_LABELS = {
  manual:     "ידני",
  notebooklm: "NotebookLM",
  research:   "מחקר",
};

const SOURCE_COLORS = {
  manual:     "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  notebooklm: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  research:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

// ── Empty form state ───────────────────────────────────────────────────────
const EMPTY_FORM = { title: "", content: "", sourceType: "manual", tags: "" };

// ── Main component ─────────────────────────────────────────────────────────
export default function TopicKnowledgePage({ topicId: initialTopicId, navigateTo, pageParams }) {
  // Data hooks
  const { data: topics = [], isLoading } = useTopics();
  const { data: videos = [] } = useVideos();
  const { data: mentors = [] } = useMentors();

  // Which topic/subtopic is selected in the tree
  const [selectedId, setSelectedId] = useState(initialTopicId || null);

  // Which main topics are expanded in the tree
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Local copy of manual notes for the selected topic (refreshed on select/save/delete)
  const [notes, setNotes] = useState([]);

  // Show/hide the "Add note" inline form
  const [showForm, setShowForm] = useState(false);

  // Current values in the note form
  const [form, setForm] = useState(EMPTY_FORM);

  // Which note is showing markdown preview (null = none)
  const [previewNoteId, setPreviewNoteId] = useState(null);

  // Which note just had its markdown copied (null = none, resets after 2s)
  const [copiedNoteId, setCopiedNoteId] = useState(null);

  // ZIP export in progress for this topic
  const [exportingTopic, setExportingTopic] = useState(false);

  // Kind filter for Brain items section
  const [kindFilter, setKindFilter] = useState("all");

  // Brain items (KnowledgeItem registry) for the selected topic — reactive via custom event
  const [brainItems, setBrainItems] = useState([]);

  const loadBrainItems = useCallback(() => {
    if (!selectedId) { setBrainItems([]); return; }
    try { setBrainItems(getKnowledgeItemsByTopic(selectedId)); }
    catch { setBrainItems([]); }
  }, [selectedId]);

  useEffect(() => {
    loadBrainItems();
    window.addEventListener("knowledge-items-updated", loadBrainItems);
    return () => window.removeEventListener("knowledge-items-updated", loadBrainItems);
  }, [loadBrainItems]);

  // Filtered brain items by kind
  const filteredBrainItems = useMemo(
    () => kindFilter === "all" ? brainItems : brainItems.filter((i) => i.kind === kindFilter),
    [brainItems, kindFilter]
  );

  const handleCopyBrainItem = async (item) => {
    try {
      await navigator.clipboard.writeText(item?.markdown || "");
      setCopiedNoteId(item?.id || "__brain__");
      setTimeout(() => setCopiedNoteId(null), 2000);
    } catch {
      // ignore
    }
  };

  const onOpenVideoFromWorkspace = useCallback((item) => {
    if (!navigateTo) {
      toast.error("ניווט לא זמין");
      return;
    }

    const possibleUrl =
      item?.metadata?.url ||
      item?.metadata?.originalUrl ||
      item?.youtubeUrl ||
      item?.url ||
      null;

    const extractedFromUrl = possibleUrl ? parseYouTubeVideoId(possibleUrl) : null;
    const videoId =
      item?.metadata?.videoId ||
      item?.sourceId ||
      extractedFromUrl ||
      null;

    if (!videoId) {
      toast.error("אין קישור לסרטון המקורי");
      return;
    }

    const existingVideo =
      videos.find((v) => v.videoId === videoId) ||
      videos.find((v) => v.id === videoId) ||
      null;

    const fallbackVideo = existingVideo || {
      id: videoId,
      videoId,
      title: item?.title || item?.metadata?.title || "Untitled",
      channelTitle: item?.metadata?.channel || "",
      url: possibleUrl || (extractedFromUrl ? `https://www.youtube.com/watch?v=${extractedFromUrl}` : undefined),
      category: item?.metadata?.category || null,
      savedFromWorkspace: true,
    };

    navigateTo("Dashboard", {
      openVideoId: videoId,
      openVideoMeta: fallbackVideo,
    });
  }, [navigateTo, videos]);

  const handleOpenWorkspaceVideo = useCallback((video) => {
    if (!navigateTo) {
      toast.error("ניווט לא זמין");
      return;
    }
    const videoId = String(video?.videoId || video?.id || "").trim();
    if (!videoId) {
      toast.error("אין קישור לסרטון המקורי");
      return;
    }
    navigateTo("Dashboard", {
      openVideoId: videoId,
      openVideoMeta: video,
    });
  }, [navigateTo]);

  // ── Derived topic lists ────────────────────────────────────────────────
  // Main topics: no parent (or flagged as main category)
  const mainTopics = useMemo(
    () => topics.filter((t) => !t.parentId || t.isMainCategory),
    [topics]
  );

  // Returns subtopics for a given main topic id
  const subtopicsOf = useCallback(
    (parentId) => topics.filter((t) => t.parentId === parentId),
    [topics]
  );

  // Mentor name lookup map: mentorId → name
  const mentorMap = useMemo(
    () => Object.fromEntries(mentors.map((m) => [m.id, m.name])),
    [mentors]
  );

  // Videos assigned to the selected topic via topicIds[]
  const topicVideos = useMemo(
    () => (selectedId ? videos.filter((v) => v.topicIds?.includes(selectedId)) : []),
    [videos, selectedId]
  );

  // The full topic object for the selected id (for title display)
  const selectedTopic = useMemo(
    () => topics.find((t) => t.id === selectedId),
    [topics, selectedId]
  );

  // ── Deep-link: when navigating from Workspace with a topicId param ────────
  useEffect(() => {
    if (!initialTopicId || !topics.length) return;
    setSelectedId(initialTopicId);
    const topic = topics.find((t) => t.id === initialTopicId);
    if (topic?.parentId) {
      setExpandedIds((prev) => new Set([...prev, topic.parentId]));
    }
  }, [initialTopicId, topics]);

  // ── Notes loading ──────────────────────────────────────────────────────
  // Re-load from localStorage whenever the selected topic changes
  useEffect(() => {
    if (!selectedId) {
      setNotes([]);
      return;
    }
    setNotes(getManualNotesByTopic(selectedId));
  }, [selectedId]);

  // Re-reads notes from localStorage (called after save/delete)
  const refreshNotes = useCallback(() => {
    if (selectedId) setNotes(getManualNotesByTopic(selectedId));
  }, [selectedId]);

  // ── Tree interaction ───────────────────────────────────────────────────
  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select a topic/subtopic and reset the note form
  const selectTopic = (id) => {
    setSelectedId(id);
    setShowForm(false);
    setForm(EMPTY_FORM);
  };

  // ── Note form handlers ─────────────────────────────────────────────────
  const handleSave = () => {
    if (!form.title.trim() || !selectedId) return;
    saveManualNote({
      topicId:    selectedId,
      title:      form.title.trim(),
      content:    form.content,
      sourceType: form.sourceType,
      // Tags: comma-separated string → trimmed array, empty strings removed
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    setForm(EMPTY_FORM);
    setShowForm(false);
    refreshNotes();
  };

  const handleDelete = (id) => {
    deleteManualNote(id);
    refreshNotes();
  };

  const handleCopyNote = async (note) => {
    const md = `# ${note.title}\n\n${note.content || ""}`;
    await navigator.clipboard.writeText(md);
    setCopiedNoteId(note.id);
    setTimeout(() => setCopiedNoteId(null), 2000);
  };

  const handleExportTopicZip = async () => {
    if (!selectedId) return;
    setExportingTopic(true);
    try {
      const { zip, exportStats } = await buildWorkspaceZip(topicVideos, mentors, topics, { manualNotesOverride: notes });
      logWorkspaceZipExportSummary(exportStats);
      await downloadWorkspaceZip(zip);
      toast.success(formatZipExportSuccessHebrew(exportStats));
    } catch {
      toast.error("שגיאה בייצוא ZIP");
    } finally {
      setExportingTopic(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        טוען נושאים...
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full" dir="rtl">
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

      {/* ── Topic tree panel (right side in RTL) ── */}
      <div className="w-56 shrink-0 border-l border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-y-auto">
        <div className="px-3 py-4">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider px-2 mb-3">
            ברינים
          </p>

          <div className="space-y-0.5">
            {mainTopics.map((topic) => {
              const subs       = subtopicsOf(topic.id);
              const isExpanded = expandedIds.has(topic.id);
              const isSelected = selectedId === topic.id;

              return (
                <div key={topic.id}>

                  {/* Main topic row: chevron (expand) + name (select) */}
                  <div className="flex items-center">
                    {subs.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => toggleExpand(topic.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 shrink-0"
                        title={isExpanded ? "כווץ" : "הרחב"}
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform duration-150 ${isExpanded ? "" : "-rotate-90"}`}
                        />
                      </button>
                    ) : (
                      // Placeholder so the name aligns with topics that have a chevron
                      <span className="w-6 shrink-0" />
                    )}

                    <button
                      type="button"
                      onClick={() => selectTopic(topic.id)}
                      className={[
                        "flex-1 text-right text-sm py-1.5 px-2 rounded-lg transition-colors truncate",
                        isSelected
                          ? "bg-violet-100 text-violet-700 font-semibold dark:bg-violet-900/30 dark:text-violet-300"
                          : "text-slate-700 hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-900",
                      ].join(" ")}
                    >
                      {topic.name}
                    </button>
                  </div>

                  {/* Subtopics — shown only when parent is expanded */}
                  {isExpanded &&
                    subs.map((sub) => {
                      const isSubSelected = selectedId === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => selectTopic(sub.id)}
                          className={[
                            "w-full flex items-center gap-1.5 text-right text-xs py-1.5 pr-7 pl-2 rounded-lg transition-colors",
                            isSubSelected
                              ? "bg-violet-100 text-violet-700 font-semibold dark:bg-violet-900/30 dark:text-violet-300"
                              : "text-slate-500 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-900/60",
                          ].join(" ")}
                        >
                          <Hash className="h-3 w-3 shrink-0 opacity-50" />
                          <span className="truncate">{sub.name}</span>
                        </button>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Content panel (left side in RTL) ── */}
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-zinc-950">

        {/* Empty state — nothing selected yet */}
        {!selectedId ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 p-8">
            <BookMarked className="h-10 w-10 text-slate-200 dark:text-zinc-700" />
            <p className="text-slate-400 dark:text-zinc-500 text-sm">
              בחר נושא מהעץ כדי לראות סרטונים והערות ידע
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-8">

            {/* Topic header */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">
                  {selectedTopic?.name}
                </h1>
                {selectedTopic?.description && (
                  <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                    {selectedTopic.description}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleExportTopicZip}
                disabled={exportingTopic || (topicVideos.length === 0 && notes.length === 0 && brainItems.length === 0)}
                title="ייצא נושא זה ל-ZIP"
                className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                {exportingTopic ? "מייצא..." : "ייצא ZIP"}
              </button>
            </div>

            {/* ── Videos section ── */}
            <section>
              <h2 className="flex items-center gap-2 text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
                <Play className="h-3.5 w-3.5" />
                סרטונים ({topicVideos.length})
              </h2>

              {topicVideos.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-zinc-600">
                  אין סרטונים משויכים לנושא זה
                </p>
              ) : (
                <div className="space-y-2">
                  {topicVideos.map((v) => (
                    <div
                      key={v.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpenWorkspaceVideo(v)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") handleOpenWorkspaceVideo(v);
                      }}
                      className="flex items-center gap-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/60 hover:border-violet-200 dark:hover:border-violet-800/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm font-medium text-slate-800 dark:text-zinc-100 truncate"
                          title={v.title}
                        >
                          {v.title}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                          {mentorMap[v.mentorId] || v.channelTitle || "—"}
                          {v.publishedAt &&
                            ` · ${new Date(v.publishedAt).toLocaleDateString("he-IL")}`}
                        </p>
                      </div>

                      {/* Badge: was the video analyzed by AI? */}
                      {v.analyzedAt && (
                        <span className="shrink-0 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          נותח
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Brain items section (KnowledgeItems registry) ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2 text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                  <BookMarked className="h-3.5 w-3.5" />
                  ידע במוח ({brainItems.length})
                </h2>
              </div>

              {/* Kind filter chips */}
              {brainItems.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {[
                    { key: "all", label: "הכל" },
                    { key: "learning", label: "סרטונים" },
                    { key: "link", label: "קישורים" },
                    { key: "idea", label: "רעיונות" },
                    { key: "note", label: "הערות" },
                  ].map(({ key, label }) => {
                    const count = key === "all" ? brainItems.length : brainItems.filter((i) => i.kind === key).length;
                    if (key !== "all" && count === 0) return null;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setKindFilter(key)}
                        className={[
                          "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                          kindFilter === key
                            ? "bg-violet-600 text-white"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700",
                        ].join(" ")}
                      >
                        {label} {count > 0 && <span className="opacity-70">({count})</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {brainItems.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-zinc-600">
                  אין פריטי ידע שמורים במוח הזה עדיין. השתמש ב־״🧠 שמור למוח״ בפרטי הסרטון כדי להוסיף.
                </p>
              ) : filteredBrainItems.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-zinc-600">
                  אין פריטים מסוג זה במוח.
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredBrainItems.map((item) => {
                    const externalUrl =
                      item?.metadata?.url ||
                      (item?.sourceType === "youtube" && item?.sourceId
                        ? `https://youtube.com/watch?v=${encodeURIComponent(item.sourceId)}`
                        : null);
                    const openVideoId =
                      item?.metadata?.videoId ||
                      item?.sourceId ||
                      (externalUrl ? parseYouTubeVideoId(externalUrl) : null);
                    const canOpenOriginal = Boolean(openVideoId);

                    const kindConfig = {
                      learning: { label: "סרטון", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", Icon: Play },
                      link:     { label: "קישור", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", Icon: Link2 },
                      idea:     { label: "רעיון", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", Icon: Lightbulb },
                      note:     { label: "הערה", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400", Icon: FileText },
                    };
                    const kCfg = kindConfig[item.kind] || kindConfig.note;

                    return (
                      <div
                        key={item.id}
                        className="rounded-xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 px-4 py-3 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${kCfg.color}`}>
                                {kCfg.label}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100 truncate" title={item.title}>
                              {item.title}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-500">
                              {item.updatedAt ? `עודכן: ${new Date(item.updatedAt).toLocaleDateString("he-IL")}` : ""}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopyBrainItem(item)}
                              title="העתק Markdown"
                              className="p-1 rounded text-slate-300 hover:text-violet-500 hover:bg-violet-50 dark:text-zinc-600 dark:hover:text-violet-400 dark:hover:bg-violet-900/20 transition-colors"
                            >
                              {copiedNoteId === item.id
                                ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                                : <Copy className="h-3.5 w-3.5" />}
                            </button>

                            {item?.kind === "learning" && (
                              <button
                                type="button"
                                onClick={() => canOpenOriginal && onOpenVideoFromWorkspace(item)}
                                disabled={!canOpenOriginal}
                                title={canOpenOriginal ? "פתח בניתוח סרטון" : "אין קישור לסרטון המקורי"}
                                className={[
                                  "px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors",
                                  canOpenOriginal
                                    ? "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                    : "border-slate-100 text-slate-300 dark:border-zinc-800 dark:text-zinc-700 cursor-not-allowed",
                                ].join(" ")}
                              >
                                חזור לסרטון
                              </button>
                            )}

                            {externalUrl && (
                              <a
                                href={externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="פתח מקור"
                                className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 dark:text-zinc-600 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </div>

                        {item.metadata?.excerpt && (
                          <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2 whitespace-pre-wrap">
                            {item.metadata.excerpt}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Manual Notes section ── */}
            <section>
              {/* Section header + Add button */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2 text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                  <FileText className="h-3.5 w-3.5" />
                  הערות ידע ({notes.length})
                </h2>

                {!showForm && (
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    הוסף הערה ידנית
                  </button>
                )}
              </div>

              {/* Add note inline form */}
              {showForm && (
                <div className="mb-4 rounded-xl border border-violet-200 dark:border-violet-800/50 bg-white dark:bg-zinc-900 p-4 space-y-3">

                  {/* Title */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">
                      כותרת
                    </label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="כותרת ההערה..."
                      autoFocus
                      className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-right placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    />
                  </div>

                  {/* Content — multiline, supports markdown paste from NotebookLM */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">
                      תוכן (Markdown)
                    </label>
                    <textarea
                      value={form.content}
                      onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                      placeholder="הדבק סיכום מ-NotebookLM, הערה ידנית, מחקר..."
                      rows={6}
                      className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-right placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-y font-mono"
                    />
                  </div>

                  {/* Source type + Tags on same row */}
                  <div className="flex gap-3 flex-wrap">
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">
                        סוג מקור
                      </label>
                      <select
                        value={form.sourceType}
                        onChange={(e) => setForm((f) => ({ ...f, sourceType: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                      >
                        <option value="manual">ידני</option>
                        <option value="notebooklm">NotebookLM</option>
                        <option value="research">מחקר</option>
                      </select>
                    </div>

                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">
                        תגיות (מופרדות בפסיק)
                      </label>
                      <input
                        type="text"
                        value={form.tags}
                        onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                        placeholder="200MA, RSI, אסטרטגיה"
                        className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-right placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                      />
                    </div>
                  </div>

                  {/* Form action buttons */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!form.title.trim()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                    >
                      שמור
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 px-4 py-2 text-sm text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              )}

              {/* Empty notes state */}
              {notes.length === 0 && !showForm && (
                <p className="text-sm text-slate-400 dark:text-zinc-600">
                  אין הערות ידע עדיין. לחץ &quot;הוסף הערה ידנית&quot; להתחיל.
                </p>
              )}

              {/* Notes list */}
              {notes.length > 0 && (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 px-4 py-3 space-y-2"
                    >
                      {/* Note header: title + date + source badge + delete */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                            {note.title}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                            {new Date(note.createdAt).toLocaleDateString("he-IL")}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                              SOURCE_COLORS[note.sourceType] || SOURCE_COLORS.manual
                            }`}
                          >
                            {SOURCE_LABELS[note.sourceType] || note.sourceType}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleCopyNote(note)}
                            title="העתק Markdown"
                            className="p-1 rounded text-slate-300 hover:text-violet-500 hover:bg-violet-50 dark:text-zinc-600 dark:hover:text-violet-400 dark:hover:bg-violet-900/20 transition-colors"
                          >
                            {copiedNoteId === note.id
                              ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                              : <Copy className="h-3.5 w-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => setPreviewNoteId(previewNoteId === note.id ? null : note.id)}
                            title={previewNoteId === note.id ? "הסתר תצוגה מקדימה" : "תצוגה מקדימה"}
                            className="p-1 rounded text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:text-zinc-600 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
                          >
                            {previewNoteId === note.id
                              ? <EyeOff className="h-3.5 w-3.5" />
                              : <Eye className="h-3.5 w-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(note.id)}
                            title="מחק הערה"
                            className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 dark:text-zinc-600 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Note content — markdown preview or raw clipped text */}
                      {note.content && (
                        previewNoteId === note.id ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none text-right text-sm pt-1 border-t border-slate-100 dark:border-zinc-800">
                            <ReactMarkdown>{note.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600 dark:text-zinc-300 whitespace-pre-wrap line-clamp-4">
                            {note.content}
                          </p>
                        )
                      )}

                      {/* Tags */}
                      {note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {note.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] rounded-full px-2 py-0.5 bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
