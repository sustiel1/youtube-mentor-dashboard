import { createRoot } from 'react-dom/client';

import { MorningBriefMarketsTable } from '@/components/dashboard/MorningBriefMarketsTable';
import { MarketAssetProviderLinks } from '@/components/shared/MarketAssetProviderLinks';
import '@/index.css';

const QA_ROWS = Object.freeze([
  { asset: 'BITCOIN', trend: 'bullish', strength: '+2.4%', comment: 'יעד Finviz מדויק ומאומת' },
  { asset: 'SPX', trend: 'bullish', strength: '+0.8%', comment: 'מדד S&P 500' },
  { asset: 'NASDAQ', trend: 'bullish', strength: '+1.1%', comment: 'מדד Nasdaq Composite' },
  { asset: 'DOW', trend: 'neutral', strength: '+0.2%', comment: 'מדד Dow Jones' },
  { asset: 'RUSSELL', trend: 'bearish', strength: '-0.4%', comment: 'מדד Russell 2000' },
  { asset: 'VIX', trend: 'bearish', strength: '-1.7%', comment: 'מדד התנודתיות' },
  { asset: 'OIL', trend: 'bullish', strength: '+0.6%', comment: 'נפט גולמי' },
  { asset: 'DOLLAR', trend: 'neutral', strength: '0%', comment: 'מדד הדולר האמריקאי' },
  { asset: 'BONDS10Y', trend: 'bullish', strength: '+0.1%', comment: 'תשואת אג״ח ארה״ב ל־10 שנים' },
  { asset: 'KOSPI', type: 'index', trend: 'neutral', strength: '+0.3%', comment: 'נפילה ל־TradingView' },
  { asset: 'UNKNOWN-ASSET', trend: 'neutral', strength: '0%', comment: 'נכס לא נתמך — ללא קישור' },
]);

function ProviderControl({ asset, label }) {
  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
      data-qa-provider-control={asset}
    >
      <h2 className="mb-3 text-sm font-bold text-slate-800 dark:text-zinc-100">{label}</h2>
      <MarketAssetProviderLinks asset={asset} />
    </section>
  );
}

function MarketLinksVisualQa() {
  return (
    <main className="min-h-screen bg-slate-50 px-3 py-6 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100 sm:px-6" dir="rtl">
      <div className="mx-auto grid w-full min-w-0 max-w-7xl gap-6">
        <header className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
          <h1 className="text-xl font-bold">בדיקת QA מבודדת — קישורי שוק</h1>
          <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-zinc-300">
            fixture בזיכרון בלבד. הדף אינו קורא או כותב localStorage, IndexedDB או נתוני משתמש.
          </p>
        </header>

        <section className="min-w-0" data-qa-markets-table>
          <h2 className="mb-3 text-lg font-bold">טבלת שווקים אמיתית</h2>
          <MorningBriefMarketsTable marketBriefData={null} items={QA_ROWS} />
        </section>

        <section className="grid gap-3 md:grid-cols-2" aria-label="בקרת צרכני ספקים מחוץ לטבלת השווקים">
          <ProviderControl asset="BITCOIN" label="בקרת ספקים משותפת — BITCOIN" />
          <ProviderControl asset="SPX" label="בקרת ספקים משותפת — SPX" />
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<MarketLinksVisualQa />);
