import { useState, useEffect } from "react";
import { Loader2, Youtube, Lightbulb } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTopics } from "@/hooks/useTopics";
import {
  upsertKnowledgeItem,
  createKnowledgeItemFromIdea,
  createKnowledgeItemFromNote,
} from "@/lib/localKnowledgeItemStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TABS = [
  { key: "youtube", label: "YouTube", Icon: Youtube },
  { key: "idea", label: "רעיון / הערה", Icon: Lightbulb },
];

function extractYouTubeId(url) {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match?.[1] || null;
}

async function fetchYouTubeTitle(videoId) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.title || null;
  } catch {
    return null;
  }
}

export function SaveToBrainModal({ open, onOpenChange, initialBrainId }) {
  const [tab, setTab] = useState("youtube");
  const [ideaKind, setIdeaKind] = useState("idea"); // "idea" | "note"
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [brainId, setBrainId] = useState(initialBrainId || "");
  const [subBrainId, setSubBrainId] = useState("");
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: topics = [] } = useTopics();
  const mainTopics = topics.filter((t) => !t.parentId || t.isMainCategory);
  const subBrains = brainId ? topics.filter((t) => t.parentId === brainId) : [];

  // Auto-fetch YouTube title when a valid URL is pasted
  useEffect(() => {
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      setTitle("");
      return;
    }
    setFetching(true);
    setTitle("");
    fetchYouTubeTitle(videoId).then((fetched) => {
      if (fetched) setTitle(fetched);
      setFetching(false);
    });
  }, [url]);

  // Sync brain when opened with a pre-selected brain
  useEffect(() => {
    if (initialBrainId) { setBrainId(initialBrainId); setSubBrainId(""); }
  }, [initialBrainId, open]);

  const videoId = extractYouTubeId(url);
  const canSave = (() => {
    if (!brainId) return false;
    if (tab === "youtube") return !!videoId && !!title.trim() && !fetching;
    return !!title.trim();
  })();

  function reset() {
    setTab("youtube");
    setIdeaKind("idea");
    setUrl("");
    setTitle("");
    setContent("");
    setBrainId(initialBrainId || "");
    setSubBrainId("");
    setFetching(false);
    setSaving(false);
  }

  function handleClose(isOpen) {
    if (!isOpen) reset();
    onOpenChange(isOpen);
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      let item;
      if (tab === "youtube") {
        const now = new Date().toISOString();
        item = {
          id: `youtube-link:${videoId}`,
          sourceType: "youtube",
          sourceId: videoId,
          title: title.trim(),
          topicId: brainId,
          subBrainId: subBrainId || null,
          kind: "link",
          markdown: `# ${title.trim()}\n\n[צפה בסרטון](https://youtube.com/watch?v=${videoId})`,
          workspacePath: null,
          createdAt: now,
          updatedAt: now,
          metadata: { url: `https://youtube.com/watch?v=${videoId}` },
        };
      } else if (ideaKind === "note") {
        item = createKnowledgeItemFromNote(
          {
            id: `modal-${Date.now()}`,
            title: title.trim(),
            content,
            tags: [],
            sourceType: "manual",
            createdAt: new Date().toISOString(),
          },
          brainId,
          subBrainId || null
        );
      } else {
        item = createKnowledgeItemFromIdea({
          title: title.trim(),
          excerpt: content,
          brainId,
          subBrainId: subBrainId || null,
        });
      }
      upsertKnowledgeItem(item);
      toast.success("נשמר למוח בהצלחה!");
      handleClose(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        dir="rtl"
        className="max-w-md border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-bold">🧠 שמור למוח</DialogTitle>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 rounded-xl bg-slate-100 dark:bg-zinc-900 p-1">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setTab(key); setTitle(""); setUrl(""); setContent(""); }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition-colors",
                tab === key
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-3 pt-1">
          {/* Brain selector */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-zinc-400">
              ברין
            </label>
            <select
              value={brainId}
              onChange={(e) => { setBrainId(e.target.value); setSubBrainId(""); }}
              className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            >
              <option value="">בחר ברין...</option>
              {mainTopics.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Sub Brain selector — appears only when Brain is selected and has sub-brains */}
          {subBrains.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-zinc-400">
                תת-ברין <span className="text-slate-400 dark:text-zinc-500">(אופציונלי)</span>
              </label>
              <select
                value={subBrainId}
                onChange={(e) => setSubBrainId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              >
                <option value="">ללא תת-ברין</option>
                {subBrains.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* YouTube tab */}
          {tab === "youtube" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-zinc-400">
                  קישור YouTube
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  dir="ltr"
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
              </div>

              {videoId && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-zinc-400">
                    כותרת
                  </label>
                  {fetching ? (
                    <div className="flex items-center gap-2 text-sm text-slate-400 px-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      מאחזר כותרת...
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="הזן כותרת ידנית..."
                      className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    />
                  )}
                </div>
              )}
            </>
          )}

          {/* Idea / Note tab */}
          {tab === "idea" && (
            <>
              {/* Kind toggle: רעיון | הערה */}
              <div className="flex gap-1 rounded-lg bg-slate-100 dark:bg-zinc-900 p-0.5">
                {[{ k: "idea", label: "רעיון" }, { k: "note", label: "הערה" }].map(({ k, label }) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setIdeaKind(k)}
                    className={cn(
                      "flex-1 rounded-md py-1 text-xs font-medium transition-colors",
                      ideaKind === k
                        ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm"
                        : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-zinc-400">
                  כותרת
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="שם הרעיון..."
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-zinc-400">
                  תוכן (אופציונלי)
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="תאר את הרעיון..."
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
              </div>
            </>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || saving}
              className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
            >
              {saving ? "שומר..." : "שמור למוח"}
            </button>
            <button
              type="button"
              onClick={() => handleClose(false)}
              className="rounded-xl border border-slate-200 dark:border-zinc-700 px-4 py-2.5 text-sm text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
