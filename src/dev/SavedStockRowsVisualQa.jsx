import { createRoot } from 'react-dom/client';

import { SavedStockRowsTable } from '@/components/workspace/SavedStockRowsTable';
import '@/index.css';

// Fixture text mirrors real saved "מניות שהוזכרו" rows (symbol · company · sentiment · reason),
// including the real 30.8.2026 screenshot's OKTA row, plus edge cases:
// no-tags row, avoid-activity row, unresolvable-sector ticker, and non-stock prose fallback.
const QA_ENTRIES = Object.freeze([
  { text: 'VEEV · Veeva Systems · חיובי · היפוך חד מירידה ראשונית לעלייה של כ-8% בעקבות הכנסות ורווחיות. watch :פעולה · מיידי :עדכון · בינונית :טווח · חדש · בינונית :עדיפות · לא :למעקב' },
  { text: 'SNPS · Synopsys · שלילי · הציגה דוח סביר אך תחזית פושרת לירידות במסחר. שלילי :פעולה · מיידי :עדכון · בינונית :טווח · חדש · בינונית :עדיפות · לא :למעקב' },
  { text: 'OKTA · Okta Inc · חיובי · הכאה גדולה בהכנסות וברווח (1.05$ מול 0.97$ צפי, הכנסות 805M$). watch :פעולה · מיידי :עדכון · בינונית :טווח · חדש · גבוהה :עדיפות · לא :למעקב' },
  { text: 'NVDA · Nvidia · שלילי · הכתה את התחזית ההכנסות והרווח, אך נסחרה בירידה מתונה בשל תנודתיות ולחץ על שולי הרווח הגלומי. watch :פעולה · מיידי :עדכון · גבוהה :עדיפות · לא :למעקב' },
  { text: 'CRWD · CrowdStrike · חיובי · הכנסות של 1.47 מיליארד דולר וגידול חד ב-ARR מעל הציפיות. buy :פעולה · חדש :עדכון · גבוהה :עדיפות · כן :למעקב' },
  { text: 'XYZCO · חברה לא מוכרת · שלילי · פעילות חשודה. avoid :פעולה' },
  { text: 'AAPL · Apple · הערה כללית ללא תיוג פעולה' },
  { text: 'הפד צפוי להותיר את הריבית ללא שינוי ברבעון הקרוב.' },
]);

function SavedStockRowsVisualQa() {
  return (
    <main className="min-h-screen bg-slate-50 px-3 py-6 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100 sm:px-6" dir="rtl">
      <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-6">
        <header className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
          <h1 className="text-xl font-bold">בדיקת QA מבודדת — טבלת מניות שהוזכרו (Saved Rows)</h1>
          <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-zinc-300">
            fixture בזיכרון בלבד. הדף אינו קורא או כותב localStorage, IndexedDB או נתוני משתמש.
          </p>
        </header>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-bold text-slate-800 dark:text-zinc-100">SavedStockRowsTable</h2>
          <SavedStockRowsTable entries={QA_ENTRIES} />
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<SavedStockRowsVisualQa />);
