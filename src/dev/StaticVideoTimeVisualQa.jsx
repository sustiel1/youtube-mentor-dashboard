import { createRoot } from 'react-dom/client';
import '@/index.css';
import { StaticVideoTimestampLink } from '@/components/shared/StaticVideoTimestampLink';

const VIDEO_ID = 'dQw4w9WgXcQ';
const rows = [
  { label: 'זמן מקור מדויק', item: { text: 'שורת תוכן עם זמן מדויק', timestampSeconds: 729 } },
  { label: 'זמן מקור משוער', item: { text: 'שורת תוכן עם זמן משוער', estimatedStartSeconds: 729 } },
  { label: 'אפס אמיתי', item: { text: 'שורת תוכן שמתחילה בתחילת הסרטון', timestampSeconds: 0 } },
];

function QaPanel({ dark = false }) {
  return (
    <section className={dark ? 'dark' : ''}>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
        <h2 className="mb-3 text-base font-bold">{dark ? 'מצב כהה' : 'מצב בהיר'}</h2>
        <div className="space-y-2">
          {rows.map(({ label, item }) => (
            <div key={label} className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-slate-100 px-2 py-2 dark:border-zinc-800">
              <span className="min-w-0 flex-1 break-words text-sm">{item.text}</span>
              <StaticVideoTimestampLink videoId={VIDEO_ID} item={item} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StaticVideoTimeVisualQa() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-100 p-4 dark:bg-black" dir="rtl">
      <div className="mx-auto grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        <QaPanel />
        <QaPanel dark />
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<StaticVideoTimeVisualQa />);
