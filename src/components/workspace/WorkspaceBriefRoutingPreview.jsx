import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  TARGET_MORNING_EVENING_BRIEF_VIDEO_ID,
  buildWorkspaceVideoRoutingBackup,
  selectTargetedWorkspaceVideoRoutingPreview,
} from '@/utils/workspaceBriefRouting';

function short(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function WorkspaceBriefRoutingPreview({
  open,
  onOpenChange,
  items,
  topics,
  onApply,
  targetVideoId = TARGET_MORNING_EVENING_BRIEF_VIDEO_ID,
}) {
  const [backup, setBackup] = useState(null);
  const [message, setMessage] = useState('');
  const [applying, setApplying] = useState(false);
  const preview = useMemo(
    () => selectTargetedWorkspaceVideoRoutingPreview({ items, topics, sourceVideoId: targetVideoId }),
    [items, topics, targetVideoId],
  );

  useEffect(() => {
    if (!open) {
      setBackup(null);
      setMessage('');
      setApplying(false);
    }
  }, [open]);

  const downloadBackup = () => {
    try {
      const nextBackup = buildWorkspaceVideoRoutingBackup({ items, topics, sourceVideoId: targetVideoId });
      const url = `data:application/json;charset=utf-8,${encodeURIComponent(nextBackup.serialized)}`;
      const link = document.createElement('a');
      link.href = url;
      link.download = nextBackup.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setBackup(nextBackup);
      setMessage(`הגיבוי נוצר ואומת: ${nextBackup.filename}`);
    } catch (error) {
      setBackup(null);
      setMessage(error?.message || 'יצירת הגיבוי נכשלה.');
    }
  };

  const applyRepair = async () => {
    if (!preview.safe || !backup || applying) return;
    setApplying(true);
    const result = await onApply?.({
      sourceVideoId: targetVideoId,
      expectedItemIds: preview.recordIds,
      backup,
    });
    if (result?.ok) {
      setMessage(`השיוך הוחל על ${result.affectedCount} רשומות ואומת.`);
      onOpenChange(false);
      return;
    }
    setMessage(result?.error?.userMessage || 'השיוך לא הוחל; הנתונים הקיימים נשמרו ללא שינוי.');
    setApplying(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-6xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>תצוגה מקדימה — שיוך ממוקד למבזק בוקר/ערב</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-amber-700 dark:text-amber-300">
          עד ללחיצה המפורשת על “החל שיוך”, לא נשמר או משוכתב אף פריט.
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="סיכום תצוגת השיוך">
          {[
            ['סרטונים לוגיים', preview.logicalVideoCount],
            ['רשומות פיזיות', preview.physicalRecordCount],
            ['שינויים מוצעים', preview.proposedChangeCount],
            ['מצב יעד', preview.destination.valid ? 'מאומת' : 'לא תקין'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 p-3 dark:border-zinc-700">
              <div className="text-xs text-slate-500 dark:text-zinc-400">{label}</div>
              <div className="text-lg font-bold text-slate-900 dark:text-zinc-100">{value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 p-3 dark:border-zinc-700" aria-label="חלוקה לפי אוסף יעד">
          <div className="mb-2 text-sm font-bold text-slate-900 dark:text-zinc-100">חלוקה לפי אוסף יעד</div>
          <div className="flex flex-wrap gap-2">
            {preview.collectionGroups.map(group => (
              <div key={group.collection} className="rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-zinc-800">
                <span className="font-semibold">{group.collection}</span>
                <span className="mr-2">{group.uniqueLogicalContentCount} ייחודיים · {group.physicalRecordCount} שמירות</span>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-auto rounded-xl border border-slate-200 dark:border-zinc-700">
          <table className="w-full min-w-[820px] text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-600 dark:bg-zinc-900 dark:text-zinc-300">
              <tr>
                {['מזהה רשומה', 'סרטון מקור', 'שיוך קיים', 'שיוך מוצע'].map(label => (
                  <th key={label} className="px-3 py-2 text-right font-semibold">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map(row => (
                <tr key={row.itemId} className="border-t border-slate-100 align-top dark:border-zinc-800">
                  <td className="px-3 py-2 font-mono text-[10px]">{short(row.itemId)}</td>
                  <td className="px-3 py-2">
                    <div>{short(row.videoTitle)}</div>
                    <div className="font-mono text-[10px] text-slate-400">{short(row.sourceVideoId)}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px]">{short(row.existingTopicId)} / {short(row.existingSubtopicId)}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{short(row.proposedTopicId)} / {short(row.proposedSubtopicId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-zinc-700">
          <div className="text-xs text-slate-500 dark:text-zinc-400">
            יעד: {short(preview.destination.topicId)} / {short(preview.destination.subTopicId)}
            {message && <span className="mr-2 font-semibold text-indigo-700 dark:text-indigo-300">{message}</span>}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={downloadBackup} disabled={!preview.safe} className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-bold text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-700 dark:text-indigo-300">
              הורד גיבוי JSON מאומת
            </button>
            <button type="button" onClick={applyRepair} disabled={!preview.safe || !backup || applying} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {applying ? 'מאמת שמירה…' : 'החל שיוך על הקבוצה בלבד'}
            </button>
          </div>
        </div>
        <textarea
          data-testid="workspace-routing-backup-json"
          value={backup?.serialized || ''}
          readOnly
          hidden
          aria-hidden="true"
        />
      </DialogContent>
    </Dialog>
  );
}
