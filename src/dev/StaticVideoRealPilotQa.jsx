import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { StaticVideoTimestampLink } from '@/components/shared/StaticVideoTimestampLink';

const VIDEO_ID = '9su_tZfRYrI';
const SHOW_TIMESTAMPS = new URLSearchParams(window.location.search).get('timestamps') !== '0';
const timed = (text, estimatedStartSeconds) => ({ text, estimatedStartSeconds, timestampKind: 'estimated' });

const tabs = [
  {
    id: 'summary',
    label: 'סיכום',
    rows: [
      timed('מדד הוויקס עומד על 15.49 – אין סימני פחד אמיתיים בשוק למרות הלחצים הגיאופוליטיים', 287),
      'ה-AAII חמישה שבועות רצופים דובי – סימן שהשוק לא בשיא ואין אופוריה',
      timed('וולמרט ירדה 9% בגלל ביצועים תפעוליים חלשים – לא בגלל מכסים, ריבית או צרכן', 495),
      'ברודקום מגייסת עד 100 מיליארד דולר לתמיכה בייצור שבבי AI עבור אנתרופיק',
      timed('טראמפ מציב יעד של 1,000 שיגורי חלל עד 2030 – צפוי להגדיל תקציבים לחברות חלל', 568),
    ],
  },
  {
    id: 'insights',
    label: 'תובנות',
    rows: [
      timed("הוויקס הוא ה'ביטוח' שגופים גדולים לוקחים – כשהוא נמוך, הם לא מפחדים, ולכן גם אתם לא צריכים", 364),
      timed('סנטימנט דובי ממושך של ה-AAII הוא דווקא סימן חיובי – אין אופוריה, השוק לא בשיא', 450),
      timed('כשסיכון ידוע (חוב אמריקאי, אגח גבוה) – זה כבר לא ברבור שחור; ברבור שחור הוא רק מה שאף אחד לא רואה', 471),
      timed('ביצועים חלשים של מניה בודדת (וולמרט) אינם מעידים על מצב הצרכן או הכלכלה הכללית', 500),
    ],
  },
  {
    id: 'useful-knowledge',
    label: 'ידע שימושי',
    rows: [
      'בדוק תמיד את הוויקס לפני שאתה מגיב לכותרות פחד – אם הוא נמוך, הגופים הגדולים לא מפחדים',
      'אל תפרש ירידה חדה במניה בודדת כסימן למשבר מאקרו – בדוק קודם את הסיבה הפנימית',
      'סנטימנט דובי ממושך בקרב משקיעים קמעונאיים הוא לרוב סימן שהשוק עדיין לא בשיא',
      timed('כל מה שמוצג בלייב הוא דעת המגיש בלבד ואינו המלצה לפעולה או ייעוץ פיננסי', 161),
      'עקוב אחר מדד הוויקס כאינדיקטור ראשי לפחד בשוק לפני קבלת החלטות השקעה',
      'בדוק את נתוני ה-AAII שבועית כדי להבין את הסנטימנט הכללי של המשקיעים הקמעונאיים',
      'לפני שמגיבים לדיווח תוצאות שלילי – בדוק אם הסיבה תפעולית פנימית או מאקרו-כלכלית',
      'עקוב אחר גיוסי החוב של חברות AI גדולות (כמו ברודקום) כאינדיקטור לביקוש בסקטור',
    ],
  },
  {
    id: 'specialized',
    label: 'תוכן ייעודי',
    rows: [
      timed('לא לפרש ירידה של מניה בודדת כסימן למשבר כלכלי רחב', 500),
      timed('לא להיכנס ללחץ על בסיס כותרות פחד כשהוויקס נמוך ואין אינדיקציה אמיתית לסיכון', 461),
      timed('לא לטעות בין סיכון ידוע (חוב, אגח גבוה) לבין ברבור שחור – ברבור שחור הוא רק מה שאף אחד לא רואה', 471),
      'לא להתעלם מתוכן הלייב ולשאול שאלות שאינן קשורות – זה מפספס את הערך האמיתי',
    ],
  },
];

function PilotQa() {
  const [activeId, setActiveId] = useState('summary');
  const active = tabs.find((tab) => tab.id === activeId) || tabs[0];

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-100 p-3 text-slate-900 sm:p-6" dir="rtl">
      <section className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-6">
        <div className="mb-4 min-w-0">
          <h1 className="break-words text-lg font-bold sm:text-xl">לייב פתיחה לתאריך 21.8.26</h1>
          <p className="mt-1 text-sm text-slate-500">פיילוט מבודד · 11 זמנים מאושרים · 10 שורות ללא זמן</p>
        </div>
        <div role="tablist" aria-label="לשוניות הפיילוט" className="mb-4 flex max-w-full gap-1 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === activeId}
              onClick={() => setActiveId(tab.id)}
              className={`min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium ${tab.id === activeId ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" data-pilot-tab={active.id} className="space-y-2">
          {active.rows.map((row, index) => {
            const item = typeof row === 'string' ? row : row;
            const text = typeof row === 'string' ? row : row.text;
            return (
              <div key={`${active.id}-${index}`} className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-slate-100 px-3 py-2.5">
                <span className="min-w-0 flex-1 break-words text-sm leading-6">{text}</span>
                {SHOW_TIMESTAMPS ? <StaticVideoTimestampLink videoId={VIDEO_ID} item={item} /> : null}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<PilotQa />);
