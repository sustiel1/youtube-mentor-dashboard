import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Database, ShieldCheck, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { APPLICATION_STORAGE_MODES } from '@/lib/persistence/storageMode';
import { formatStorageBytes, shortGenerationId } from '@/lib/persistence/storageMeter';

const HEALTH_STYLES = {
  healthy: {
    bar: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    bar: 'bg-amber-400',
    text: 'text-amber-600 dark:text-amber-400',
  },
  danger: {
    bar: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
  },
};

function persistenceLabel(value) {
  if (value === true) return 'מתמשך';
  if (value === false) return 'לא מובטח';
  return 'לא זמין';
}

function warningText(code) {
  if (code === 'indexeddb-unavailable') return 'IndexedDB אינו זמין. האפליקציה עלולה להשתמש בגיבוי המקומי.';
  if (code === 'quota-critical') return 'המכסה המשוערת כמעט מלאה.';
  if (code === 'quota-warning') return 'השימוש מתקרב למכסה המשוערת.';
  if (code === 'persistence-unavailable') return 'לא ניתן לאמת את מצב ההתמדה של האחסון.';
  if (code === 'quota-unavailable') return 'המכסה אינה זמינה.';
  return null;
}

export function StorageStatusWidget({ snapshot }) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (snapshot?.mode !== APPLICATION_STORAGE_MODES.INDEXED_DB) return null;

  const styles = HEALTH_STYLES[snapshot.health] || HEALTH_STYLES.warning;
  const usage = formatStorageBytes(snapshot.usageBytes);
  const quota = formatStorageBytes(snapshot.quotaBytes);
  const headroom = formatStorageBytes(snapshot.headroomBytes);
  const localFallback = formatStorageBytes(snapshot.localStorageBytes);
  const progress = snapshot.utilizationPercent ?? 0;
  const renderDetails = (testId, className) => (
    <div className={className} data-testid={testId}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-slate-600 dark:text-zinc-300">
        <dt>מצב פעיל</dt><dd className="font-semibold">IndexedDB</dd>
        <dt>מסד נתונים</dt><dd>{snapshot.database?.name || 'לא זמין'} / v{snapshot.database?.version ?? '—'}</dd>
        <dt>דור פעיל</dt><dd className="font-mono text-[10px]" dir="ltr">{shortGenerationId(snapshot.database?.activeGenerationId) || 'לא זמין'}</dd>
        <dt>רשומות Workspace</dt><dd>{snapshot.database?.workspaceRecordCount ?? 'לא זמין'}</dd>
        <dt>שימוש משוער</dt><dd>{usage || 'לא זמין'}</dd>
        <dt>מכסה משוערת</dt><dd>{quota || 'המכסה אינה זמינה'}</dd>
        <dt>מקום זמין משוער</dt><dd>{headroom || 'המכסה אינה זמינה'}</dd>
        <dt>התמדה</dt><dd>{persistenceLabel(snapshot.persisted)}</dd>
        <dt>גיבוי localStorage</dt><dd>{localFallback || 'לא זמין'}</dd>
      </dl>
      <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-400 dark:border-zinc-800 dark:text-zinc-500">
        הנתונים הם הערכות דפדפן ואינם הבטחה לנפח קבוע.
      </p>
    </div>
  );

  return (
    <div className="relative flex items-center gap-2" dir="rtl" data-testid="indexeddb-storage-meter">
      <Database className={cn('h-3.5 w-3.5 shrink-0', styles.text)} aria-hidden="true" />
      <div className="flex min-w-[138px] flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2 text-[10px]">
          <span className={cn('font-semibold', styles.text)}>IndexedDB פעיל</span>
          <span className="tabular-nums text-slate-500 dark:text-zinc-400">
            {snapshot.loading ? 'בודק אחסון…' : usage ? `${usage} בשימוש` : 'השימוש אינו זמין'}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700" title={quota ? `${progress}% מתוך מכסה משוערת של ${quota}` : 'המכסה אינה זמינה'}>
          <div className={cn('h-full rounded-full transition-all', styles.bar)} style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
        <span className="text-[10px] text-slate-500 dark:text-zinc-500">
          {headroom ? `מקום זמין משוער: ${headroom}` : 'המכסה אינה זמינה'}
        </span>
      </div>
      <details className="group relative" onToggle={(event) => setDetailsOpen(event.currentTarget.open)}>
        <summary className="cursor-pointer list-none text-[10px] text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300">
          פרטים
        </summary>
        {renderDetails(
          'indexeddb-storage-details-desktop',
          'absolute left-0 top-full z-50 mt-2 hidden min-w-[270px] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[11px] shadow-lg dark:border-zinc-700 dark:bg-zinc-900 sm:block',
        )}
      </details>
      {detailsOpen && typeof document !== 'undefined' && createPortal(
        renderDetails(
          'indexeddb-storage-details-mobile',
          'fixed inset-x-2 top-20 z-[100] mt-2 max-h-[calc(100vh-6rem)] w-[calc(100vw-1rem)] overflow-y-auto break-words rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[11px] shadow-lg dark:border-zinc-700 dark:bg-zinc-900 sm:hidden',
        ),
        document.body,
      )}
    </div>
  );
}

export function IndexedDbStorageWarning({ snapshot }) {
  if (
    snapshot?.mode !== APPLICATION_STORAGE_MODES.INDEXED_DB
    || snapshot.loading
    || snapshot.health === 'healthy'
  ) return null;
  const message = warningText(snapshot.warningCode);
  if (!message) return null;

  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300" dir="rtl" data-testid="indexeddb-storage-warning">
      {snapshot.health === 'danger'
        ? <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        : <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span>{message}</span>
    </div>
  );
}
