import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { StaticVideoTimestampLink } from '@/components/shared/StaticVideoTimestampLink';

/**
 * LATEST Evidence-Gated pilot output — non-persistent QA fixture.
 *
 * Every item below is copied verbatim from the PILOT_REPORT JSON captured
 * during the real Claude run executed through the restarted production
 * Evidence Gate on 2026-08-24 (log: pilot-rerun.log,
 * fetchedAt=2026-08-24T05:42:39.888Z). Nothing here is reconstructed or
 * invented — this is exactly `safeAnalysis` / `rows[].item` from that run.
 *
 * This is a tested-only dev fixture: it renders through the same
 * StaticVideoTimestampLink component (and therefore the same
 * resolveStaticVideoTimestamp/buildStaticYouTubeTimestampLink selectors)
 * used in production. It does not write to localStorage/IndexedDB and does
 * not touch the genuine 9su_tZfRYrI record.
 */

const VIDEO_ID = '9su_tZfRYrI';

const tabs = [
  {
    id: 'summary',
    label: 'סיכום',
    field: 'keyPoints',
    rows: [
      {
        text: 'הוויקס עומד על 15.49 – אין סימן לפחד אמיתי בשוק למרות חששות המשקיעים',
        estimatedStartSeconds: 287,
        estimatedEndSeconds: 376,
        timestampKind: 'estimated',
        timestampSource: 'youtube-transcript-segment',
        timestampConfidence: 0.9,
        sourceQuote: 'תסתכלו על הוויקס. אוקיי, הויקס הוא מדד הוולטיליות, הוא מדד הפחד',
        evidence: { intervalStart: 266.759, intervalEnd: 302.36 },
      },
      {
        text: 'סקר AAII מראה חמישה שבועות רצופים של דובים יותר משורים – אין אופוריה, השוק לא בטופ',
        estimatedStartSeconds: 437,
        estimatedEndSeconds: 458,
        timestampKind: 'estimated',
        timestampSource: 'youtube-transcript-segment',
        timestampConfidence: 0.88,
        sourceQuote: 'אותה קבוצה שבעצם היא כבר חמישה שבועות רצופים יותר דובית משורית',
        evidence: { intervalStart: 411.08, intervalEnd: 446.759 },
      },
      {
        text: 'וולמרט ירדה 9% בגלל ביצועים תפעוליים חלשים – לא קשור למכסים, ריבית או צרכן',
        estimatedStartSeconds: 495,
        estimatedEndSeconds: 526,
        timestampKind: 'estimated',
        timestampSource: 'youtube-transcript-segment',
        timestampConfidence: 0.85,
        sourceQuote: 'וואלמרט לא עבדה טוב זה לא קשור לצרכן זה לא קשור למכסים זה לא קשור לריבית',
        evidence: { intervalStart: 478.199, intervalEnd: 511.039 },
      },
      'ברודקום מגייסת עד 100 מיליארד דולר לסיוע לאנתרופיק בייצור שבבים',
      {
        text: 'טראמפ שואף ל-1000 שיגורי חלליות עד 2030 – עשוי להגדיל תקציבים לחברות חלל',
        estimatedStartSeconds: 568,
        estimatedEndSeconds: 598,
        timestampKind: 'estimated',
        timestampSource: 'youtube-transcript-segment',
        timestampConfidence: 0.85,
        sourceQuote: 'טראמפ רוצה להגיע ל1000 פלוס שיגורים של חלליות של החברות השונות עד שנת 2030',
        evidence: { intervalStart: 541.24, intervalEnd: 585.2 },
      },
    ],
  },
  {
    id: 'insights',
    label: 'תובנות',
    field: 'keyInsights',
    rows: [
      'הוויקס הוא מדד הפחד האמיתי – כשהגופים הגדולים לא קונים ביטוח, אין לחץ אמיתי בשוק',
      {
        text: 'היעדר אופוריה בסקר AAII הוא סימן חיובי – שוק שעדיין מפחד לא נמצא בשיא',
        estimatedStartSeconds: 437,
        estimatedEndSeconds: 458,
        timestampKind: 'estimated',
        timestampSource: 'youtube-transcript-segment',
        timestampConfidence: 0.85,
        sourceQuote: 'אין אופוריה. אין אופוריה. אז זה רק שתדעו ברקע',
        evidence: { intervalStart: 432.28, intervalEnd: 468.4 },
      },
      {
        text: 'ברבור שחור אמיתי הוא רק אירוע שאף אחד לא יודע עליו – חוב אמריקאי גבוה כבר ידוע ולכן אינו ברבור שחור',
        estimatedStartSeconds: 468,
        estimatedEndSeconds: 492,
        timestampKind: 'estimated',
        timestampSource: 'youtube-transcript-segment',
        timestampConfidence: 0.83,
        sourceQuote: 'לאנשי הברבור השחור כשאין שום סימן אז יש סיכוי לברבור שחור אם אתם יודעים שיש חוב אמריקאי גבוה זה כבר לא ברבור שחור',
        evidence: { intervalStart: 446.759, intervalEnd: 483.12 },
      },
      {
        text: 'כשל של חברה בודדת כמו וולמרט אינו מעיד על מצב המאקרו – חשוב להבחין בין גורמים פנימיים לחיצוניים',
        estimatedStartSeconds: 495,
        estimatedEndSeconds: 522,
        timestampKind: 'estimated',
        timestampSource: 'youtube-transcript-segment',
        timestampConfidence: 0.85,
        sourceQuote: 'וואלמרט לא עבדה טוב זה לא קשור לצרכן זה לא קשור למכסים זה לא קשור לריבית זה לא קשור לשום דבר',
        evidence: { intervalStart: 481, intervalEnd: 515.44 },
      },
    ],
  },
  {
    id: 'useful-knowledge',
    label: 'ידע שימושי',
    field: 'rules + actionItems',
    rows: [
      {
        text: 'תמיד בדוק את הוויקס לפני שאתה מגיב לפחד בשוק – הוא האינדיקטור האמיתי ולא הכותרות',
        estimatedStartSeconds: 287,
        estimatedEndSeconds: 376,
        timestampKind: 'estimated',
        timestampSource: 'youtube-transcript-segment',
        timestampConfidence: 0.88,
        sourceQuote: 'תסתכלו על הוויקס',
        evidence: { intervalStart: 259.88, intervalEnd: 292.759 },
      },
      'אל תבלבל בין כשל תפעולי של חברה בודדת לבין מצב כלכלי כללי',
      {
        text: 'ברבור שחור הוא רק מה שאף אחד לא יודע – סיכון ידוע הוא סיכון מתומחר',
        estimatedStartSeconds: 468,
        estimatedEndSeconds: 487,
        timestampKind: 'estimated',
        timestampSource: 'youtube-transcript-segment',
        timestampConfidence: 0.82,
        sourceQuote: 'כשאין שום סימן אז יש סיכוי לברבור שחור אם אתם יודעים שיש חוב אמריקאי גבוה זה כבר לא ברבור שחור',
        evidence: { intervalStart: 446.759, intervalEnd: 483.12 },
      },
      {
        text: 'שוק ללא אופוריה עדיין לא הגיע לשיא – סנטימנט דובי של המשקיעים הפרטיים הוא סימן חיובי',
        estimatedStartSeconds: 437,
        estimatedEndSeconds: 458,
        timestampKind: 'estimated',
        timestampSource: 'youtube-transcript-segment',
        timestampConfidence: 0.85,
        sourceQuote: 'אין אופוריה. אין אופוריה',
        evidence: { intervalStart: 430.12, intervalEnd: 464.639 },
      },
      'עקוב אחר הוויקס כאינדיקטור ראשי לפחד בשוק לפני כל החלטת השקעה',
      'בדוק את סקר AAII שבועי כדי להבין את סנטימנט המשקיעים הפרטיים',
      'לפני תגובה לדיווח חברה, בדוק אם הסיבה לכשל היא פנימית או מאקרו-כלכלית',
      'עקוב אחר גיוסי הון של חברות טכנולוגיה גדולות כברודקום כאינדיקטור לביקוש בתחום ה-AI',
    ],
  },
  {
    id: 'specialized',
    label: 'תוכן ייעודי',
    field: 'mistakesToAvoid',
    rows: [
      'לא לפרש ירידה של מניה בודדת כסימן למשבר כלכלי כללי',
      {
        text: 'לא לבלבל בין סיכון ידוע ומתומחר לבין ברבור שחור אמיתי',
        estimatedStartSeconds: 468,
        estimatedEndSeconds: 487,
        timestampKind: 'estimated',
        timestampSource: 'youtube-transcript-segment',
        timestampConfidence: 0.82,
        sourceQuote: 'אם אתם יודעים שיש חוב אמריקאי גבוה זה כבר לא ברבור שחור',
        evidence: { intervalStart: 446.759, intervalEnd: 483.12 },
      },
      'לא להגיב לרעש בצ׳אט ובכותרות מבלי לבדוק את הנתונים האמיתיים כמו הוויקס',
      'לא לפרש סנטימנט דובי של משקיעים פרטיים כאות לקריסה – לעיתים זה דווקא סימן חיובי',
    ],
  },
];

const timedCounts = Object.fromEntries(
  tabs.map((tab) => [tab.label, tab.rows.filter((r) => typeof r === 'object').length]),
);

function Row({ row, index }) {
  const item = typeof row === 'string' ? row : row;
  const text = typeof row === 'string' ? row : row.text;
  const evidence = typeof row === 'object' ? row.evidence : null;
  return (
    <div className="min-w-0 rounded-xl border border-amber-100 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 break-words text-sm leading-6">{text}</span>
        <StaticVideoTimestampLink videoId={VIDEO_ID} item={item} />
      </div>
      {typeof row === 'object' && (
        <div dir="ltr" className="mt-1.5 break-words rounded-md bg-slate-50 px-2 py-1 text-left font-mono text-[11px] text-slate-500">
          sourceQuote: "{row.sourceQuote}" · seconds={row.estimatedStartSeconds} · window=[{evidence.intervalStart}, {evidence.intervalEnd}]
        </div>
      )}
    </div>
  );
}

function LatestPilotQa() {
  const [activeId, setActiveId] = useState('summary');
  const active = tabs.find((tab) => tab.id === activeId) || tabs[0];

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-100 p-3 text-slate-900 dark:bg-black dark:text-zinc-100 sm:p-6" dir="rtl">
      <section className="mx-auto w-full max-w-4xl rounded-2xl border-2 border-amber-400 bg-white p-3 shadow-sm dark:bg-zinc-950 sm:p-6">
        <div className="mb-4 min-w-0 rounded-lg bg-amber-100 p-3 dark:bg-amber-950/40">
          <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
            ⚠️ ריצה אחרונה (LATEST) — Evidence-Gated, לאחר אתחול השרת · לא הרשומה הישנה (500s)
          </p>
          <h1 className="mt-1 break-words text-lg font-bold sm:text-xl">לייב פתיחה לתאריך 21.8.26</h1>
          <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
            נתונים מועתקים אחד-לאחד מ-PILOT_REPORT שנלכד ב-2026-08-24T05:42:39.888Z · provider=claude · model=claude-sonnet-4-6 · 11 מתוזמנים / 10 ללא זמן
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
            התפלגות: סיכום {timedCounts['סיכום']} · תובנות {timedCounts['תובנות']} · ידע שימושי {timedCounts['ידע שימושי']} · תוכן ייעודי {timedCounts['תוכן ייעודי']}
          </p>
        </div>
        <div role="tablist" aria-label="לשוניות הפיילוט האחרון" className="mb-4 flex max-w-full gap-1 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === activeId}
              onClick={() => setActiveId(tab.id)}
              className={`min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium ${tab.id === activeId ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300'}`}
            >
              {tab.label} ({timedCounts[tab.label]})
            </button>
          ))}
        </div>
        <div role="tabpanel" data-pilot-tab={active.id} className="space-y-2">
          {active.rows.map((row, index) => (
            <Row key={`${active.id}-${index}`} row={row} index={index} />
          ))}
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<LatestPilotQa />);
