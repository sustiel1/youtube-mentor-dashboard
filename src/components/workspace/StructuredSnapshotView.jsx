import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AnalysisSectionCard } from '@/components/shared/AnalysisContentPrimitives';
import { AnalysisTickerLink } from '@/components/shared/AnalysisTickerLink';
import {
  DASHBOARD_TABLE_CELL_BODY_CLS,
  DASHBOARD_TABLE_CELL_MUTED_CLS,
  DASHBOARD_TABLE_CELL_PRIMARY_CLS,
  DASHBOARD_TABLE_HEAD_CLS,
} from '@/components/dashboard/MorningBriefVisualPrimitives';
import { format } from "date-fns";
import { he } from "date-fns/locale";

/**
 * Read-only viewer for a `structured-snapshot` Workspace Library item.
 * Renders ONLY what is stored in `snapshot` (structuredSnapshot) — never
 * re-derives rows from live video/marketBriefData. Self-contained Dialog,
 * so it can be opened on top of WorkspaceSaveReviewOverlay's own Dialog.
 */
export function StructuredSnapshotView({ open, onOpenChange, snapshot, itemTitle }) {
  if (!snapshot) return null;

  const savedLabel = (() => {
    try { return format(new Date(snapshot.savedAt), "d בMMMM yyyy, HH:mm", { locale: he }); }
    catch { return ''; }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="flex flex-col p-0 gap-0 w-[98vw] max-w-[98vw] h-[96vh] max-h-[96vh]">
        <DialogHeader className="shrink-0 border-b border-slate-200 dark:border-zinc-800 px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-right text-base font-bold text-slate-900 dark:text-zinc-100">
            📊 {itemTitle || snapshot.videoTitle || 'תמונת מצב שוק'}
            {savedLabel && (
              <span className="text-xs font-normal text-slate-400 dark:text-zinc-500">— נשמר {savedLabel}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5"><StructuredSnapshotContent snapshot={snapshot} /></div>
      </DialogContent>
    </Dialog>
  );
}

export function StructuredSnapshotContent({ snapshot }) {
  if (!snapshot) return null;
  return (
    <div className="space-y-3" data-persisted-snapshot="true">
      <SnapshotSection title="⭐ מניות שהוזכרו" count={snapshot.stocksTable?.length || 0}>
        <StocksTable rows={snapshot.stocksTable} />
      </SnapshotSection>
      <SnapshotSection title="📈 שווקים" count={snapshot.marketsTable?.length || 0}>
        <MarketsTable rows={snapshot.marketsTable} />
      </SnapshotSection>
      <SnapshotSection title="📊 סנטימנט שוק" count={snapshot.sentimentTable?.length || 0}>
        <SentimentTable rows={snapshot.sentimentTable} />
      </SnapshotSection>
    </div>
  );
}

function SnapshotSection({ title, count, children }) {
  return (
    <AnalysisSectionCard title={title} count={count}>
      {children}
    </AnalysisSectionCard>
  );
}

function EmptyTableNote({ label }) {
  return <p className="py-6 text-center text-sm text-slate-400 dark:text-zinc-600">{label}</p>;
}

const TH_CLS = `py-2.5 px-2 first:pr-0 last:pl-0 ${DASHBOARD_TABLE_HEAD_CLS}`;
const TD_CLS = `py-2.5 px-2 first:pr-0 last:pl-0 ${DASHBOARD_TABLE_CELL_BODY_CLS}`;

function StocksTable({ rows = [] }) {
  if (rows.length === 0) return <EmptyTableNote label="לא נשמרו מניות בתמונת המצב הזו" />;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700">
      <table className="w-full min-w-[640px] text-right" dir="rtl">
        <thead>
          <tr className="border-b border-slate-200 dark:border-zinc-700">
            <th className={TH_CLS}>טיקר</th>
            <th className={TH_CLS}>חברה</th>
            <th className={TH_CLS}>הקשר</th>
            <th className={TH_CLS}>סנטימנט</th>
            <th className={TH_CLS}>קטגוריה</th>
            <th className={TH_CLS}>פעילות</th>
            <th className={TH_CLS}>הערות</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.ticker || 'row'}-${i}`} className="border-b border-slate-100 dark:border-zinc-800 last:border-0">
              <td className={`${TD_CLS} ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}><AnalysisTickerLink ticker={r.ticker}>{r.ticker || '—'}</AnalysisTickerLink></td>
              <td className={TD_CLS}>{r.company || '—'}</td>
              <td className={TD_CLS}>{r.context || '—'}</td>
              <td className={TD_CLS}>{r.sentiment || '—'}</td>
              <td className={TD_CLS}>{r.category || '—'}</td>
              <td className={TD_CLS}>{r.actionability || '—'}</td>
              <td className={TD_CLS}>{r.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarketsTable({ rows = [] }) {
  if (rows.length === 0) return <EmptyTableNote label="לא נשמרו נתוני שווקים בתמונת המצב הזו" />;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700">
      <table className="w-full min-w-[480px] text-right" dir="rtl">
        <thead>
          <tr className="border-b border-slate-200 dark:border-zinc-700">
            <th className={TH_CLS}>נכס</th>
            <th className={TH_CLS}>מגמה</th>
            <th className={TH_CLS}>עוצמה</th>
            <th className={TH_CLS}>הערה</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.asset || 'row'}-${i}`} className="border-b border-slate-100 dark:border-zinc-800 last:border-0">
              <td className={`${TD_CLS} ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>{r.asset || '—'}</td>
              <td className={TD_CLS}>{r.trend || '—'}</td>
              <td className={TD_CLS}>{r.strength || '—'}</td>
              <td className={TD_CLS}>{r.comment || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SentimentTable({ rows = [] }) {
  if (rows.length === 0) return <EmptyTableNote label="לא נשמר סנטימנט בתמונת המצב הזו" />;
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={`${r.label || 'row'}-${i}`} className="rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-2 flex items-start gap-2">
          <span className={`shrink-0 ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>{r.label || '—'}</span>
          <span className={DASHBOARD_TABLE_CELL_MUTED_CLS}>{r.value || '—'}</span>
        </div>
      ))}
    </div>
  );
}
