import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { buildWorkspaceDuplicatePreview } from '@/utils/workspaceItemIdentity';

function recordMetadata({ item, identity }, canonicalId) {
  return (
    <li key={item.id} className="rounded-xl border border-slate-200 p-3 text-xs dark:border-zinc-700">
      <div className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">{item.id}</div>
      <div className="mt-1">{item.savedAt || 'ללא תאריך'} {item.id === canonicalId ? '· מוצע לשימור' : '· מועמד להסרה'}</div>
      <div>Topic: {item.topicId || 'ללא'} / {item.subTopicId || 'ללא'}</div>
      <div>Hash: <span className="font-mono">{identity.contentHash}</span></div>
      <div>מועדף: {item.flags?.isFavorite ? 'כן' : 'לא'} · ארכיון: {item.archivedAt ? 'כן' : 'לא'}</div>
    </li>
  );
}

export function WorkspaceDuplicatePreview({ open, onOpenChange, items }) {
  const preview = buildWorkspaceDuplicatePreview(items);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-slate-950/55" />
        <Dialog.Content dir="rtl" className="fixed left-1/2 top-1/2 z-[81] max-h-[85vh] w-[min(920px,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-bold text-slate-900 dark:text-zinc-100">איתור כפילויות — תצוגה מקדימה בלבד</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-500 dark:text-zinc-400">לא יתבצעו מחיקה, מיזוג או שינוי נתונים במסך זה.</Dialog.Description>
            </div>
            <Dialog.Close className="rounded-lg p-2 text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="סגור"><X className="h-5 w-5" /></Dialog.Close>
          </div>

          <section className="mt-6 space-y-4" aria-label="כפילויות מדויקות">
            <h3 className="font-bold">כפילויות תוכן מדויקות ({preview.exactDuplicates.length} קבוצות)</h3>
            {preview.exactDuplicates.length === 0 && <p className="text-sm text-slate-500">לא נמצאו כפילויות מדויקות.</p>}
            {preview.exactDuplicates.map(group => {
              const first = group.records[0];
              return (
                <article key={first.identity.key} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/10">
                  <h4 className="font-bold">{first.item.videoTitle || 'ללא כותרת'}</h4>
                  <p className="text-xs text-slate-600 dark:text-zinc-400">Video ID: {first.identity.sourceVideoId} · סוג: {first.identity.itemType} · {group.records.length} עותקים · התאמת hash מלאה</p>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">{group.records.map(record => recordMetadata(record, group.canonicalId))}</ul>
                </article>
              );
            })}
          </section>

          <section className="mt-6 space-y-3" aria-label="גרסאות שונות">
            <h3 className="font-bold">גרסאות שונות ({preview.historicalVersions.length} קבוצות)</h3>
            <p className="text-xs text-slate-500">קבוצות אלה נשמרות במלואן ולעולם אינן מוצעות למחיקה.</p>
            {preview.historicalVersions.map((group, index) => (
              <div key={index} className="rounded-xl border border-slate-200 p-3 text-xs dark:border-zinc-700">
                {group.records[0].item.videoTitle || 'ללא כותרת'} · {group.records.length} גרסאות · hashes שונים
              </div>
            ))}
          </section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

