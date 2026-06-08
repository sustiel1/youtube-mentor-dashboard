import { useEffect, useMemo, useState } from "react";
import { Copy, Download, Check, ChevronDown, FolderOpen, ExternalLink } from "lucide-react";
import {
  buildVideoLearningNote,
  resolveObsidianFolderForVideo,
  copyToClipboard,
  downloadMarkdown,
  buildObsidianUrl,
  openObsidianUrl,
  getFolderOptionsForVideo,
  getMainCategoryFromPath,
} from "@/lib/obsidianExport";
import { getActiveObsidianVaultConfig } from "@/lib/obsidianVaultConfig";

export function ObsidianExportButton({
  video,
  mentorName = "",
  notes = [],
  onPatch,
  showActions = true,
  topicButtonLabel = null,
  topicButtonClassName = null,
}) {
  const [copied, setCopied] = useState(false);
  const [topicOpen, setTopicOpen] = useState(false);

  const autoTopic = useMemo(() => resolveObsidianFolderForVideo(video || {}), [video]);
  const folderOptions = useMemo(() => getFolderOptionsForVideo(video || {}), [video]);
  const detectedMainCategory = useMemo(
    () => getMainCategoryFromPath(autoTopic) || getMainCategoryFromPath(folderOptions[0]) || null,
    [autoTopic, folderOptions]
  );
  const [primaryTopic, setPrimaryTopic] = useState(video?.obsidianTopic ?? null);

  useEffect(() => {
    setPrimaryTopic(video?.obsidianTopic ?? null);
  }, [video?.id, video?.obsidianTopic]);

  if (!video) return null;

  const activeTopic = primaryTopic ?? autoTopic;
  const activeMainCategory = getMainCategoryFromPath(activeTopic) || detectedMainCategory;
  const activeFolderOptions = folderOptions.filter(
    (folder) => getMainCategoryFromPath(folder) === activeMainCategory
  );

  const note = buildVideoLearningNote(video, mentorName, activeTopic, notes);
  const isAutoTopic = primaryTopic === null;
  const configuredVaultName = getActiveObsidianVaultConfig().vaultName;

  const handleTopicSelect = (topic) => {
    setPrimaryTopic(topic);
    setTopicOpen(false);
    onPatch?.({ obsidianTopic: topic });
  };

  const handleTopicAuto = () => {
    setPrimaryTopic(null);
    setTopicOpen(false);
    onPatch?.({ obsidianTopic: null });
  };

  const handleCopy = async () => {
    try {
      await copyToClipboard(note.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable
    }
  };

  const handleDownload = () => {
    downloadMarkdown(note.content, note.filename);
  };

  return (
    <div className="space-y-2" dir="rtl">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <button
            type="button"
            onClick={() => setTopicOpen((open) => !open)}
            className={
              topicButtonClassName ||
              "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }
          >
            <span className={isAutoTopic ? "opacity-60" : ""}>
              {topicButtonLabel || activeTopic}
            </span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </button>

          {topicOpen && (
            <div className="absolute top-full mt-1 left-0 z-50 min-w-[240px] rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden dark:border-zinc-700 dark:bg-zinc-900">
              <div className="px-2.5 py-1.5 text-[9px] font-semibold text-slate-400 border-b border-slate-100 dark:text-zinc-500 dark:border-zinc-800">
                {activeMainCategory ? `תיקיות תחת ${activeMainCategory}` : "תיקיות Obsidian"}
              </div>
              <button
                type="button"
                onClick={handleTopicAuto}
                className={[
                  "w-full text-right px-2.5 py-1.5 text-[10px] transition-colors",
                  primaryTopic === null
                    ? "bg-violet-50 text-violet-700 font-semibold dark:bg-violet-500/10 dark:text-violet-300"
                    : "text-slate-600 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800",
                ].join(" ")}
              >
                זיהוי אוטומטי ({autoTopic})
              </button>
              {activeFolderOptions.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => handleTopicSelect(topic)}
                  className={[
                    "w-full text-right px-2.5 py-1.5 text-[10px] transition-colors",
                    primaryTopic === topic
                      ? "bg-violet-50 text-violet-700 font-semibold dark:bg-violet-500/10 dark:text-violet-300"
                      : "text-slate-600 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800",
                  ].join(" ")}
                >
                  {topic}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-violet-100 bg-violet-50/70 px-3 py-2 text-[11px] text-violet-800 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200">
        תיקייה שזוהתה: <span className="font-semibold">{autoTopic}</span>
        {activeTopic !== autoTopic ? <span>{` • נבחרה ידנית: ${activeTopic}`}</span> : null}
      </div>

      {showActions && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <div
            className="flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5 flex-1 min-w-0 overflow-hidden dark:bg-zinc-800/60"
            title={note.path}
          >
            <FolderOpen className="h-3 w-3 text-violet-500 shrink-0 dark:text-violet-400" />
            <span className="text-[10px] text-slate-500 truncate font-mono dark:text-zinc-400" dir="ltr">
              {note.path}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            title="העתק Markdown"
            className="inline-flex min-h-8 items-center gap-1.5 flex-row-reverse rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 shrink-0 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-400" />
            )}
            {copied ? "הועתק" : "העתק"}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            title={`הורד ${note.filename}`}
            className="inline-flex min-h-8 items-center gap-1.5 flex-row-reverse rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 shadow-sm transition-colors hover:bg-violet-100 shrink-0 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20"
          >
            <Download className="h-3.5 w-3.5" />
            .md
          </button>

          <button
            type="button"
            onClick={() => {
              openObsidianUrl(buildObsidianUrl(
                { ...video, obsidianTopic: activeTopic },
                configuredVaultName
              ));
            }}
            title={`פתח ב-Obsidian (${configuredVaultName})`}
            className="inline-flex min-h-8 items-center gap-1.5 flex-row-reverse rounded-xl border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 shadow-sm transition-colors hover:bg-purple-100 shrink-0 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300 dark:hover:bg-purple-500/20"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Obsidian
          </button>
        </div>
      )}
    </div>
  );
}
