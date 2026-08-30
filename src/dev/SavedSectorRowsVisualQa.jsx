import { createRoot } from 'react-dom/client';

import { SavedSectorRowsTable } from '@/components/workspace/SavedSectorRowsTable';
import '@/index.css';

// Fixture mirrors the real screenshot's IGV/CRWD/OKTA/CRM row, plus edge cases:
// sector-only, unrecognised sentiment word, unmapped sector name, non-sector prose.
const QA_ENTRIES = Object.freeze([
  { text: 'תוכנה · positive · ETF IGV נהנה מהוצאות תשתית AI. CRWD, OKTA ו-CRM מוזכרות כנהנות עיקריות' },
  { text: 'אנרגיה · negative · לחץ ממחירי נפט נמוכים על רווחיות הסקטור' },
  { text: 'מוליכים למחצה · into · המשך ביקוש חזק ל-AI מניע את הסקטור' },
  { text: 'פיננסים' },
  { text: 'סקטור לא ממופה · מוביל · ביצועים חזקים יחסית לשוק' },
  { text: 'הודעת הפד צפויה להשפיע על כלל השווקים היום' },
]);

function SavedSectorRowsVisualQa() {
  return (
    <main className="min-h-screen bg-slate-50 px-3 py-6 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100 sm:px-6" dir="rtl">
      <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-6">
        <header className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
          <h1 className="text-xl font-bold">בדיקת QA מבודדת — טבלת סקטורים (Saved Rows)</h1>
          <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-zinc-300">
            fixture בזיכרון בלבד. הדף אינו קורא או כותב localStorage, IndexedDB או נתוני משתמש.
          </p>
        </header>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-bold text-slate-800 dark:text-zinc-100">SavedSectorRowsTable</h2>
          <SavedSectorRowsTable entries={QA_ENTRIES} />
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<SavedSectorRowsVisualQa />);
