import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useWorkspaceTopics } from "@/hooks/useWorkspaceLibrary";
import { saveWorkspaceItem, getWorkspaceItemByVideoId } from "@/lib/workspaceLibraryStore";
import { updateLocalVideo } from "@/lib/localVideoStore";
import { updateKnowledgeItemsForVideo } from "@/lib/localKnowledgeItemStore";

function detectMainTopic(video, topics) {
  if (!video) return null;
  const mainTopics = topics.filter(t => !t.parentId);
  const cat = String(video.category || '').trim().toLowerCase();
  if (!cat) return null;
  return mainTopics.find(t => String(t.name || '').trim().toLowerCase() === cat)?.id || null;
}

function detectSubTopic(video, topics, mainTopicId) {
  if (!video || !mainTopicId) return null;
  const subs = topics.filter(t => t.parentId === mainTopicId);
  if (!subs.length) return null;
  const sub = String(video.subCategory || video.subTopic || '').trim().toLowerCase();
  if (!sub) return null;
  return subs.find(t => String(t.name || '').trim().toLowerCase() === sub)?.id || null;
}

export function SaveToWorkspaceDialog({ open, onOpenChange, video, onSaved }) {
  const { topics, mainTopics, getSubTopics, addTopic } = useWorkspaceTopics();

  const [topicId, setTopicId] = useState('');
  const [subTopicId, setSubTopicId] = useState('');
  const [notes, setNotes] = useState('');
  const [flags, setFlags] = useState({ isFavorite: false, isImportant: false, mustWatchAgain: false });
  const [autoDetected, setAutoDetected] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [showNewSub, setShowNewSub] = useState(false);

  useEffect(() => {
    if (!open || !video) return;

    const existing = getWorkspaceItemByVideoId(video.id || video.videoId);
    if (existing) {
      setTopicId(existing.topicId || '');
      setSubTopicId(existing.subTopicId || '');
      setNotes(existing.notes || '');
      setFlags(existing.flags || { isFavorite: false, isImportant: false, mustWatchAgain: false });
      setAutoDetected(false);
      return;
    }

    // Auto-detect from video metadata
    const currentTopics = topics;
    const detected = detectMainTopic(video, currentTopics);
    const detectedSub = detected ? detectSubTopic(video, currentTopics, detected) : null;

    if (detected) {
      setTopicId(detected);
      setSubTopicId(detectedSub || '');
      setAutoDetected(true);
    } else {
      const general = currentTopics.find(t => !t.parentId && t.name === 'כללי');
      setTopicId(general?.id || '');
      setSubTopicId('');
      setAutoDetected(false);
    }
    setNotes('');
    setFlags({ isFavorite: false, isImportant: false, mustWatchAgain: false });
    setShowNewTopic(false);
    setShowNewSub(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, video?.id, video?.videoId]);

  const subTopics = getSubTopics(topicId);
  const selectedMainTopic = mainTopics.find(t => t.id === topicId);
  const selectedSubTopic = subTopics.find(t => t.id === subTopicId);

  const handleSave = () => {
    const videoId = video?.id || video?.videoId;
    if (!videoId) return;

    const topicName    = selectedMainTopic?.name || '';
    const subTopicName = selectedSubTopic?.name  || '';

    const youtubeId = video?.youtubeId || video?.videoId;
    const videoUrl = video?.url || video?.youtubeUrl
      || (youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : '');

    saveWorkspaceItem({
      videoId,
      videoUrl,
      videoTitle: video?.title || '',
      channelName: video?.channelTitle || video?.channelName || '',
      thumbnail: video?.thumbnail || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg` : ''),
      topicId: topicId || null,
      subTopicId: subTopicId || null,
      topicName,
      subTopicName,
      notes,
      flags,
      autoDetected,
      category: topicName || video?.category || null,
      subCategory: subTopicName || video?.subCategory || null,
      gemId: video?.selectedGemId || null,
    });

    // Sync topic to video record and knowledge items so all views stay consistent
    if (topicName) {
      try { updateLocalVideo(videoId, { category: topicName, subCategory: subTopicName }); } catch {}
      try { updateKnowledgeItemsForVideo(videoId, { category: topicName, subCategory: subTopicName }); } catch {}
    }

    onSaved?.({ topicName, subTopicName });
  };

  const handleAddTopic = () => {
    if (!newTopicName.trim()) return;
    const t = addTopic({ name: newTopicName.trim() });
    setTopicId(t.id);
    setSubTopicId('');
    setNewTopicName('');
    setShowNewTopic(false);
    setAutoDetected(false);
  };

  const handleAddSub = () => {
    if (!newSubName.trim() || !topicId) return;
    const t = addTopic({ name: newSubName.trim(), parentId: topicId });
    setSubTopicId(t.id);
    setNewSubName('');
    setShowNewSub(false);
    setAutoDetected(false);
  };

  if (!video) return null;

  const youtubeId = video?.youtubeId || video?.videoId;
  const thumbnail = video?.thumbnail
    || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg` : '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="flex flex-col w-[min(92vw,560px)] max-h-[90vh] p-0 border-amber-100 bg-white dark:border-amber-900/30 dark:bg-zinc-950"
      >
        <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-5 dark:border-zinc-800">
          <DialogTitle className="flex items-center gap-2 text-right text-base font-bold text-slate-900 dark:text-zinc-100">
            <span>⭐</span>
            <span>שמור ל-Workspace Library</span>
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5" dir="rtl">
          {/* Video preview */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
            {thumbnail && (
              <img
                src={thumbnail}
                alt=""
                className="h-14 w-24 rounded-lg object-cover shrink-0 bg-slate-200"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200 line-clamp-2 text-right">
                {video.title || 'ללא כותרת'}
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5 text-right">
                {video.channelTitle || video.channelName || ''}
              </p>
            </div>
          </div>

          {/* Auto-detected badge */}
          {autoDetected && (
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-400">
              <span>✨</span>
              <span>זוהה אוטומטית — ניתן לשנות לפי הצורך</span>
            </div>
          )}

          {/* Topic selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
              נושא ראשי
            </label>
            <Select
              value={topicId}
              onValueChange={(v) => {
                setTopicId(v);
                setSubTopicId('');
                setAutoDetected(false);
              }}
            >
              <SelectTrigger className="w-full text-right" dir="rtl">
                <SelectValue placeholder="בחר נושא..." />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {mainTopics.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.emoji ? `${t.emoji} ` : ''}{t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {showNewTopic ? (
              <div className="flex gap-2 mt-1">
                <input
                  autoFocus
                  value={newTopicName}
                  onChange={e => setNewTopicName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTopic()}
                  placeholder="שם הנושא החדש..."
                  className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-right placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                />
                <button
                  type="button"
                  onClick={handleAddTopic}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  הוסף
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewTopic(false); setNewTopicName(''); }}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50 dark:border-zinc-700"
                >
                  ביטול
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewTopic(true)}
                className="text-xs text-indigo-500 hover:text-indigo-700 hover:underline"
              >
                + הוסף נושא חדש
              </button>
            )}
          </div>

          {/* Sub-topic selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
              תת-נושא (אופציונלי)
            </label>
            <Select
              value={subTopicId}
              onValueChange={(v) => {
                setSubTopicId(v === '__none__' ? '' : v);
                setAutoDetected(false);
              }}
              disabled={!topicId}
            >
              <SelectTrigger className="w-full text-right" dir="rtl">
                <SelectValue
                  placeholder={
                    !topicId ? 'בחר נושא ראשי תחילה' :
                    subTopics.length === 0 ? 'אין תת-נושאים — הוסף למטה' :
                    'בחר תת-נושא...'
                  }
                />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="__none__">ללא תת-נושא</SelectItem>
                {subTopics.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {topicId && (
              showNewSub ? (
                <div className="flex gap-2 mt-1">
                  <input
                    autoFocus
                    value={newSubName}
                    onChange={e => setNewSubName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddSub()}
                    placeholder="שם תת-הנושא..."
                    className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-right placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  />
                  <button
                    type="button"
                    onClick={handleAddSub}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    הוסף
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowNewSub(false); setNewSubName(''); }}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50 dark:border-zinc-700"
                  >
                    ביטול
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNewSub(true)}
                  className="text-xs text-indigo-500 hover:text-indigo-700 hover:underline"
                >
                  + הוסף תת-נושא חדש
                </button>
              )
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
              הערות (אופציונלי)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              dir="rtl"
              placeholder="הוסף הערות אישיות לסרטון..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-right placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 resize-none"
            />
          </div>

          {/* Flags */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
              סמן כ...
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  key: 'isFavorite',
                  label: '⭐ מועדף',
                  active: 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-600 dark:text-amber-300',
                },
                {
                  key: 'isImportant',
                  label: '🔴 חשוב',
                  active: 'bg-red-100 border-red-300 text-red-800 dark:bg-red-950/40 dark:border-red-600 dark:text-red-300',
                },
                {
                  key: 'mustWatchAgain',
                  label: '🔁 לצפות שוב',
                  active: 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-950/40 dark:border-blue-600 dark:text-blue-300',
                },
              ].map(({ key, label, active }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFlags(f => ({ ...f, [key]: !f[key] }))}
                  className={cn(
                    'rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all',
                    flags[key]
                      ? active
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            ⭐ שמור ל-Workspace
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
