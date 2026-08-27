import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AnalysisSectionCard } from '@/components/shared/AnalysisContentPrimitives';
import { AnalysisTickerLink } from '@/components/shared/AnalysisTickerLink';
import {
  DASHBOARD_TABLE_CELL_BODY_CLS,
  DASHBOARD_TABLE_CELL_MUTED_CLS,
  DASHBOARD_TABLE_CELL_PRIMARY_CLS,
  DASHBOARD_TABLE_HEAD_CLS,
} from '@/components/dashboard/MorningBriefVisualPrimitives';
import { MarketAssetProviderLinks } from '@/components/shared/MarketAssetProviderLinks';
import { MarketAssetDescriptionTooltip } from '@/components/shared/MarketAssetDescriptionTooltip';
import { normalizeStructuredSnapshotCollections } from '@/utils/structuredSnapshot';
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
  const normalizedSnapshot = normalizeStructuredSnapshotCollections(snapshot);
  return (
    <div className="space-y-3" data-persisted-snapshot="true">
      <SnapshotSection title="📊 סנטימנט שוק" count={normalizedSnapshot.sentimentTable.length}>
        <SentimentTable rows={normalizedSnapshot.sentimentTable} />
      </SnapshotSection>
      <SnapshotSection title="📈 שווקים" count={normalizedSnapshot.marketsTable.length}>
        <MarketsTable rows={normalizedSnapshot.marketsTable} />
      </SnapshotSection>
      <SnapshotSection title="⭐ מניות שהוזכרו" count={normalizedSnapshot.stocksTable.length}>
        <StocksTable rows={normalizedSnapshot.stocksTable} />
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
      <table className="w-full min-w-[640px] text-right" dir="rtl">
        <thead>
          <tr className="border-b border-slate-200 dark:border-zinc-700">
            <th className={TH_CLS}>נכס</th>
            <th className={`${TH_CLS} text-center`}>קישורים</th>
            <th className={TH_CLS}>מגמה</th>
            <th className={TH_CLS}>עוצמה</th>
            <th className={TH_CLS}>הערה</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.asset || 'row'}-${i}`} className="border-b border-slate-100 dark:border-zinc-800 last:border-0">
              <td className={`${TD_CLS} ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>
                <MarketAssetDescriptionTooltip asset={r.asset}>{r.asset || '—'}</MarketAssetDescriptionTooltip>
              </td>
              <td className={`${TD_CLS} text-center`}><MarketAssetProviderLinks asset={r.asset} /></td>
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
      {rows.map((r, i) => {
        const tone = getSentimentTone(r.value);
        return (
          <div key={`${r.label || 'row'}-${i}`} className="rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-2 flex items-start gap-2">
            <span className={`shrink-0 ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>{r.label || '—'}</span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone.className}`}>
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${tone.dotClassName}`} />
              {r.value || '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function getSentimentTone(value) {
  const text = String(value || '').trim().toLowerCase();
  if (/מתוח|מעורב|זהיר|תנודתי/.test(text)) {
    return {
      className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
      dotClassName: 'bg-amber-500',
    };
  }
  if (/שלילי|דובי|יריד/.test(text)) {
    return {
      className: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300',
      dotClassName: 'bg-red-500',
    };
  }
  if (/חיובי|שורי|עליות?/.test(text)) {
    return {
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
      dotClassName: 'bg-emerald-500',
    };
  }
  return {
    className: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    dotClassName: 'bg-slate-400',
  };
}
