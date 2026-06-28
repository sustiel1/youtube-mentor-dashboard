/**
 * Quick-copy prompt builders for the Transcript modal action buttons.
 * Each function builds a full prompt (instructions + schema + transcript)
 * ready to paste into Gemini or Claude directly.
 */
import { getGeneralSchemaExample } from './gemini/schemas/generalSchema.js';
import { getPoliticalSchemaExample } from './gemini/schemas/politicalSchema.js';
import { getMarketSchemaExample } from './gemini/schemas/marketSchema.js';
import { getMorningBriefSchemaExample } from './gemini/schemas/morningBriefSchema.js';

function transcriptBlock({ title, duration, transcript }) {
  return [
    title ? `כותרת: ${title}` : null,
    duration ? `משך: ${duration}` : null,
    '',
    'תמלול:',
    '"""',
    transcript,
    '"""',
  ].filter((l) => l !== null).join('\n');
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

export function buildGeminiGeneralQuickPrompt({ title, duration, transcript }) {
  const schema = getGeneralSchemaExample();
  return [
    'נתח את התמלול הבא והחזר JSON בלבד, ללא markdown, ללא טקסט נוסף.',
    '',
    'מטרה: לחלץ ידע אישי-מקצועי לשימוש חוזר — לא סיכום של מה קרה בסרטון.',
    '',
    'כללי ניתוח:',
    '• כל keyPoint חייב לבטא רעיון אחד ויחיד — אסור לשלב כמה רעיונות במשפט אחד',
    '• אם פריט מורכב — פצל לכמה פריטים נפרדים, כל אחד עצמאי',
    '• עדיף ניסוח קצר, קונקרטי, מעשי — לא שיווקי ולא סיפורי',
    '• כל פריט חייב להיות reusable גם מחוץ לסרטון הזה',
    '• אסור placeholder, אסור ביטויים גנריים כמו "המרצה הסביר", "נאמר בסרטון"',
    '• אחד פריטים דומים — בלי כפילויות',
    '• chapters: גבולות נושאיים סמנטיים אמיתיים, לא חלוקת זמן שווה',
    '• כותרת פרק חייבת לכלול שם ספציפי / מספר / מונח טכני מהתמלול',
    '• כותרות אסורות: "פתיח", "סיכום", "מבוא", "פרק 1", "ניתוח כללי"',
    '• אם שדה מסוים חסר חומר חזק — החזר מערך ריק, לא ערך גנרי',
    '',
    'JSON schema:',
    schema,
    '',
    transcriptBlock({ title, duration, transcript }),
  ].join('\n');
}

export function buildGeminiPoliticalQuickPrompt({ title, duration, transcript }) {
  const schema = getPoliticalSchemaExample({ chaptersTarget: 8 });
  return [
    'נתח את התמלול הפוליטי הבא והחזר JSON בלבד, ללא markdown, ללא טקסט נוסף.',
    '',
    'מטרה: ניתוח עמוק של טענות, אידיאולוגיה, פריימינג, וכלי שכנוע.',
    '',
    'כללי ניתוח פוליטי:',
    '• הבחן בין עובדות לפריימינג אידיאולוגי — אל תערבב',
    '• זהה טכניקות שכנוע רגשי: פאתוס (ערעור רגשי), אתוס (אמינות), לוגוס (לוגיקה)',
    '• חלץ הנחות יסוד של הדובר — מה הוא מניח שנכון מבלי לומר?',
    '• זהה לאיזה קהל מכוונת ההודעה: מה הפחדים/תקוות שהיא מנצלת?',
    '• weakPoints: חולשות לוגיות ומוסריות — לא רק רטוריות',
    '• counterArguments: טיעוני נגד חזקים ומנומקים, לא פשטניים',
    '• זהה סתירות פנימיות בטיעונים',
    '• chapters: מעברים אידיאולוגיים/נושאיים אמיתיים — חובה, אל תחזיר []',
    '• כותרות פרקים: שם אדם/מפלגה/נושא פוליטי קונקרטי מהתמלול',
    '• אם אין timestamps — הערך לפי סדר הטקסט',
    '',
    'JSON schema:',
    schema,
    '',
    transcriptBlock({ title, duration, transcript }),
  ].join('\n');
}

export function buildGeminiMarketQuickPrompt({ title, duration, transcript }) {
  const schema = getMarketSchemaExample({ chaptersTarget: 6 });
  return [
    'נתח את התמלול הפיננסי/מסחרי הבא והחזר JSON בלבד, ללא markdown, ללא טקסט נוסף.',
    '',
    'מטרה: לחלץ תזה מסחרית, קטליסטורים, רעיונות actionable, וניהול סיכון.',
    '',
    'כללי ניתוח שוק ההון:',
    '• הפרד בין ארגומנטים שוריים לדוביים — תייג כל ארגומנט',
    '• חלץ הנחות מאחורי כל טיעון: מה חייב להיות נכון כדי שהתזה תתקיים?',
    '• זהה שינויי סנטימנט במהלך התמלול — האם הדובר שינה עמדה?',
    '• רמות מחיר ספציפיות בלבד (מספרים ממשיים) — לא "קרוב ל-support"',
    '• כל ticker/ETF/מדד שמוזכר → stocksMentioned (בדוק מה ממש נאמר)',
    '• tradingSetups: פורמט — תנאי → פעולה → יעד → stop',
    '• riskRules: כלל ניהול סיכון ספציפי — לא המלצה רגילה',
    '• זהה מה הדובר לא אומר: סיכונים שלא מוזכרים',
    '• chapters: נושאי שוק ספציפיים (ticker/מדד/אירוע מאקרו)',
    '• אסור placeholder, אסור ערכים גנריים',
    '',
    'JSON schema:',
    schema,
    '',
    transcriptBlock({ title, duration, transcript }),
  ].join('\n');
}

export function buildGeminiAppBuilderQuickPrompt({ title, duration, transcript }) {
  const schema = JSON.stringify({
    universalTabs: {
      summary: ['מה האפליקציה עושה — תיאור תמציתי של המטרה'],
      chapters: [{ title: '...', startSeconds: 0, endSeconds: 0, summary: '...' }],
      insights: ['תובנה שמשפיעה על ארכיטקטורה או UX'],
      usefulKnowledge: ['עקרון לשימוש חוזר בפיתוח'],
      topicsSubtopics: ['React', 'TypeScript'],
      appBuilder: {
        suggestedFeatures: ['פיצ׳ר: שם קצר — מה הוא עושה'],
        kpiList: ['שם KPI: מה מוצג וכיצד'],
        dataPoints: ['שם שדה נתון: מקור הנתון'],
        dataFields: ['שם שדה — סוג — מקור'],
        dashboards: ['שם מסך: מה הוא עושה'],
        dashboardUpdates: ['עדכון לוח: מה ישתנה'],
        screeningCriteria: ['קריטריון: שם — לוגיקה — ערכי סף'],
        newIndicators: ['אינדיקטור: שם — חישוב — שימוש'],
        alerts: ['התראה: תנאי — פעולה מוצעת'],
        componentSuggestions: ['קומפוננטה React: שם — תפקיד'],
        prompts: ['פרומפט AI לשימוש בתוך האפליקציה'],
      },
    },
  }, null, 2);
  return [
    'נתח את התמלול הבא והחזר JSON בלבד, ללא markdown, ללא טקסט נוסף.',
    '',
    'מטרה: לחלץ רעיונות לפיתוח אפליקציה — פיצ׳רים, KPI, מסכים, לוגיקה, פרומפטים.',
    '',
    'כללי ניתוח App Builder:',
    '• suggestedFeatures: תיאור קצר מה הפיצ׳ר עושה — לא המלצה כללית',
    '• kpiList: מדדים ספציפיים שהאפליקציה מציגה או מחשבת',
    '• dashboards: שם מסך + מה המטרה שלו',
    '• componentSuggestions: קומפוננטות React ספציפיות עם תפקיד ברור',
    '• prompts: פרומפטים ל-AI שניתן להטמיע בתוך האפליקציה',
    '• screeningCriteria: קריטריוני סינון ספציפיים עם ערכי סף מספריים אם קיימים',
    '• אם שדה חסר חומר — החזר מערך ריק, לא placeholder',
    '• אסור ערכים גנריים',
    '',
    'JSON schema:',
    schema,
    '',
    transcriptBlock({ title, duration, transcript }),
  ].join('\n');
}

export function buildGeminiNewsQuickPrompt({ title, duration, transcript }) {
  const baseSchema = JSON.parse(getMorningBriefSchemaExample());
  const schema = JSON.stringify({ contentType: 'marketBrief', ...baseSchema }, null, 2);
  return [
    'נתח את התמלול הבא והחזר JSON בלבד, ללא markdown, ללא טקסט נוסף.',
    '',
    'מטרה: לנתח מבזק שוק / מבזק בוקר ולייצר דוח מסחר יומי מובנה.',
    '',
    'שפת פלט:',
    '• כל תוכן הטקסט חייב להיות בעברית — סיכומים, כותרות, הסברים, הערות, סיכונים, הזדמנויות, תיאורי סנטימנט, פרשנות שוק.',
    '• אל תפיק משפטים באנגלית אלא אם מדובר בשם פרטי, טיקר, שם ETF, או URL.',
    '• מותר באנגלית: טיקרים (AAPL, SPY, QQQ), שמות חברות (Apple, Nvidia), שמות מדדים (S&P 500, Nasdaq, CPI), שמות ETF, URLs.',
    '',
    'כללי ניתוח מבזק בוקר:',
    '• contentType חייב להיות "marketBrief" — חובה, ללא יוצא מן הכלל',
    '• מלא את universalTabs.specialized עם כל השדות הרלוונטיים',
    '• indices: שמות מדדים + רמה + שינוי + הערה קצרה בעברית',
    '• stocksMentioned: ticker באנגלית, סיבה בעברית, חשיבות (high / medium / low)',
    '• macro: אירועים מאקרו עם תאריך, חשיבות, והשפעה צפויה — בעברית',
    '• calendar: אירועי לוח שנה כ-objects — כל אובייקט: event (שם האירוע), date (מועד), importance (high/medium/low), impact (השפעה צפויה) — בעברית',
    '• opportunities: הזדמנויות מסחר קונקרטיות עם הגיון — בעברית',
    '• risks: סיכונים מרכזיים לסשן עם מנגנון — בעברית',
    '• אם שדה ריק — החזר מערך ריק, לא placeholder',
    '• אסור ערכים גנריים',
    '',
    'JSON schema:',
    schema,
    '',
    transcriptBlock({ title, duration, transcript }),
  ].join('\n');
}

// ─── Claude ───────────────────────────────────────────────────────────────────

export function buildClaudeGeneralQuickPrompt({ title, duration, transcript }) {
  const schema = getGeneralSchemaExample();
  return [
    'Return ONLY valid JSON. No markdown, no code fences, no explanations before or after.',
    '',
    'You are a knowledge extraction specialist. Analyze the following Hebrew transcript.',
    '',
    'Goals:',
    '• Extract reusable professional insights — not a summary of events',
    '• Each keyPoint = exactly one atomic, reusable idea — standalone, no narrative context',
    '• If an idea is complex, split it into multiple keyPoints',
    '• Prefer concise semantic statements over story-style descriptions',
    '• Generate chapters based on real semantic topic transitions — not time splits',
    '• Chapter titles must contain specific names/numbers/technical terms from the transcript',
    '• Forbidden chapter titles: "Introduction", "Summary", "Chapter 1", "General Analysis"',
    '• actionItems: concrete, actionable — what can the listener do with this knowledge?',
    '• If a field has no strong data, return an empty array — never generic filler',
    '• Language: Hebrew',
    '',
    'JSON schema:',
    schema,
    '',
    transcriptBlock({ title, duration, transcript }),
  ].join('\n');
}

export function buildClaudeDeepPoliticalQuickPrompt({ title, duration, transcript }) {
  const baseSchema = getPoliticalSchemaExample({ chaptersTarget: 8 });
  const extendedSchema = JSON.stringify({
    contentType: 'political',
    shortSummary: '...',
    mainClaim: '...',
    speakerPosition: '...',
    ideologicalMapping: 'תיאור מערכת הערכים והאידיאולוגיה של הדובר',
    rhetoricalTechniques: ['פאתוס: ...', 'אתוס: ...', 'לוגוס: ...'],
    hiddenAssumptions: ['הנחה שלא נאמרה אך הכרחית לטיעון ...'],
    audienceTargeting: 'לאיזה קהל מכוונת ההודעה, ומה היא מנצלת אצלם',
    emotionalFraming: ['איזה רגש מופעל ובאיזה מנגנון ...'],
    contradictions: ['סתירה פנימית שזוהתה ...'],
    longTermImplications: ['אם תפיסה זו תנצח, מה ייקרה ...'],
    arguments: ['...'],
    weakPoints: ['...'],
    counterArguments: ['...'],
    socialMediaReplies: ['...'],
    chapters: [{ title: '...', startSeconds: 0, endSeconds: 0, summary: '...' }],
    tags: ['...'],
  }, null, 2);
  return [
    'Return ONLY valid JSON. No markdown, no code fences, no explanations.',
    '',
    'You are a political analyst specializing in rhetoric, ideology, and persuasion. Analyze this Hebrew transcript in depth.',
    '',
    'Deep analysis requirements:',
    '1. Ideological mapping — what worldview and value system is the speaker promoting? What are the core beliefs assumed?',
    '2. Rhetorical techniques — identify pathos/ethos/logos with specific examples from the text',
    '3. Hidden assumptions — what must be true for each major argument to hold, even if never stated?',
    '4. Audience targeting — who is the intended audience? What fears, hopes, or identities are being addressed?',
    '5. Emotional framing — what emotions are triggered and through what specific mechanisms?',
    '6. Contradiction detection — find internal inconsistencies in the argument structure',
    '7. Long-term implications — if this ideology prevailed, what would follow in 5-10 years?',
    '8. Counter-arguments — the strongest possible substantive challenges to each major claim',
    '',
    'Critical rule: DISTINGUISH facts from framing. A fact can be verified. Framing is how facts are contextualized.',
    'Chapters must reflect ideological/topic transitions — not generic sections.',
    'Language: Hebrew',
    '',
    'JSON schema (use the extended version below):',
    extendedSchema,
    '',
    transcriptBlock({ title, duration, transcript }),
  ].join('\n');
}

export function buildClaudeDeepMarketQuickPrompt({ title, duration, transcript }) {
  const extendedSchema = JSON.stringify({
    contentType: 'market',
    shortSummary: '...',
    fullSummary: '...',
    marketThesis: 'התזה המרכזית של הסרטון בפסקה אחת',
    bullishArguments: ['ארגומנט שורי ...'],
    bearishArguments: ['ארגומנט דובי ...'],
    secondOrderEffects: ['אם התזה נכונה, מה קורה בשלב השני ...'],
    marketPsychology: 'איזה סנטימנט מתואר? האם הוא אמיתי או מכוון?',
    institutionalBehavior: 'כיצד יגיבו מוסדיים/קרנות גידור למידע זה?',
    narrativeShift: 'האם יש שינוי נרטיב? הנרטיב הישן לעומת החדש',
    hiddenRisks: ['סיכון שלא הוזכר ...'],
    positioningAssumptions: ['עצה זו מניחה שהמאזין כבר מחזיק ב-...'],
    catalystTimeline: ['קטליסטור X צפוי ב-...'],
    keyLevels: ['AAPL resistance 195$', 'SPY support 520$'],
    stocksMentioned: ['AAPL', 'SPY'],
    tradingSetups: ['אם ... → כניסה Long ב-... יעד ... stop ...'],
    tradingRules: ['...'],
    riskRules: ['stop-loss: ...', 'גודל פוזיציה: ...'],
    actionItems: ['...'],
    chapters: [{ title: '...', startSeconds: 0, endSeconds: 0, summary: '...', keyPoints: ['...'] }],
    tags: ['...'],
  }, null, 2);
  return [
    'Return ONLY valid JSON. No markdown, no code fences, no explanations.',
    '',
    'You are a senior market analyst specializing in second-order effects, institutional behavior, and market psychology. Analyze this Hebrew transcript in depth.',
    '',
    'Deep analysis requirements:',
    '1. Second-order effects — what happens downstream from the main thesis? Who benefits and who loses, beyond the obvious?',
    '2. Market psychology — what sentiment is being expressed or manufactured? Is it genuine or narrative-driven?',
    '3. Institutional behavior — how would hedge funds/large institutions react to this information or thesis?',
    '4. Narrative shift detection — is a regime change being argued? Describe the old narrative vs. the new one explicitly',
    '5. Hidden risks — what risks are NOT being mentioned? What would invalidate this thesis entirely?',
    '6. Positioning assumptions — what existing positions does this advice implicitly assume the listener already has?',
    '7. Catalyst timeline — when do these catalysts actually materialize? Assign timeframes: days/weeks/months/quarters',
    '8. Actionable setups — specific, risk-defined trades with entry conditions, target, and stop-loss',
    '',
    'Separate bullish and bearish arguments explicitly into separate arrays.',
    'Chapter titles must include specific tickers/numbers/technical terms from the transcript.',
    'Language: Hebrew',
    '',
    'JSON schema:',
    extendedSchema,
    '',
    transcriptBlock({ title, duration, transcript }),
  ].join('\n');
}

// ─── Action config for UI buttons ────────────────────────────────────────────

export const QUICK_COPY_ACTIONS = [
  {
    id: 'gemini-general',
    label: 'Gemini כללי',
    icon: '✨',
    className: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    buildPrompt: buildGeminiGeneralQuickPrompt,
    toastMsg: 'הפרומפט הועתק — הדבק ב-Gemini',
  },
  {
    id: 'gemini-political',
    label: 'Gemini פוליטי',
    icon: '🏛️',
    className: 'bg-rose-600 hover:bg-rose-700 text-white',
    flow: 'gem-political',
    buildPrompt: buildGeminiPoliticalQuickPrompt,
    toastMsg: 'התמלול הועתק — הדבק אותו בג׳מיני',
  },
  {
    id: 'gemini-fundamental',
    label: 'Gemini פונדמנטלי',
    icon: '📊',
    className: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    flow: 'gem-fundamental',
    buildPrompt: buildGeminiMarketQuickPrompt,
    toastMsg: 'התמלול הועתק — הדבק אותו בג׳מיני',
  },
  {
    id: 'gemini-appBuilder',
    label: 'Gemini App Builder',
    icon: '🏗️',
    className: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    flow: 'gem-appBuilder',
    buildPrompt: buildGeminiAppBuilderQuickPrompt,
    toastMsg: 'התמלול הועתק — הדבק אותו ב-App Builder',
  },
  {
    id: 'gemini-technical',
    label: 'Gemini טכני',
    icon: '📈',
    flow: 'gem-technical',
    className: 'bg-blue-600 hover:bg-blue-700 text-white',
    buildPrompt: buildGeminiMarketQuickPrompt,
    toastMsg: 'התמלול הועתק — הדבק אותו ב-Gem הטכני',
  },
  {
    id: 'gemini-macro',
    label: 'Gemini מאקרו',
    icon: '🌍',
    flow: 'gem-macro',
    className: 'bg-orange-500 hover:bg-orange-600 text-white',
    buildPrompt: buildGeminiMarketQuickPrompt,
    toastMsg: 'התמלול הועתק — הדבק אותו ב-Gem המאקרו',
  },
  {
    id: 'gemini-daytrading',
    label: 'Gemini מסחר יומי',
    icon: '🗓️',
    flow: 'gem-dayTrading',
    className: 'bg-cyan-600 hover:bg-cyan-700 text-white',
    buildPrompt: buildGeminiMarketQuickPrompt,
    toastMsg: 'התמלול הועתק — הדבק אותו ב-Gem המסחר היומי',
  },
  {
    id: 'gemini-news',
    label: 'Gemini חדשות',
    icon: '📰',
    flow: 'gem-news',
    className: 'bg-amber-500 hover:bg-amber-600 text-white',
    buildPrompt: buildGeminiNewsQuickPrompt,
    toastMsg: 'התמלול הועתק — הדבק אותו ב-Gem מבזק בוקר',
  },
  {
    id: 'gemini-combo',
    label: 'Gemini שוק הון',
    icon: '💹',
    className: 'bg-slate-600 hover:bg-slate-700 text-white',
    buildPrompt: buildGeminiMarketQuickPrompt,
    toastMsg: 'הפרומפט הועתק — הדבק ב-Gemini',
  },
  {
    id: 'gemini-health',
    label: 'Gemini בריאות',
    icon: '🏥',
    className: 'bg-teal-600 hover:bg-teal-700 text-white',
    buildPrompt: buildGeminiGeneralQuickPrompt,
    toastMsg: 'הפרומפט הועתק — הדבק ב-Gemini',
  },
  {
    id: 'gemini-nutrition',
    label: 'Gemini תזונה',
    icon: '🥗',
    className: 'bg-lime-600 hover:bg-lime-700 text-white',
    buildPrompt: buildGeminiGeneralQuickPrompt,
    toastMsg: 'הפרומפט הועתק — הדבק ב-Gemini',
  },
  {
    id: 'gemini-recipes',
    label: 'Gemini מתכונים',
    icon: '🍳',
    className: 'bg-orange-600 hover:bg-orange-700 text-white',
    buildPrompt: buildGeminiGeneralQuickPrompt,
    toastMsg: 'הפרומפט הועתק — הדבק ב-Gemini',
  },
  {
    id: 'gemini-ai',
    label: 'Gemini AI',
    icon: '🤖',
    className: 'bg-violet-600 hover:bg-violet-700 text-white',
    buildPrompt: buildGeminiGeneralQuickPrompt,
    toastMsg: 'הפרומפט הועתק — הדבק ב-Gemini',
  },
  {
    id: 'gemini-personal',
    label: 'Gemini ידע אישי',
    icon: '📖',
    className: 'bg-sky-600 hover:bg-sky-700 text-white',
    buildPrompt: buildGeminiGeneralQuickPrompt,
    toastMsg: 'הפרומפט הועתק — הדבק ב-Gemini',
  },
];

export const QUICK_COPY_GROUPS = [
  {
    id: 'general',
    label: 'כללי',
    cols: 1,
    actionIds: ['gemini-general'],
  },
  {
    id: 'political',
    label: 'פוליטי',
    cols: 1,
    actionIds: ['gemini-political'],
  },
  {
    id: 'market',
    label: 'שוק הון',
    cols: 3,
    actionIds: ['gemini-fundamental', 'gemini-technical', 'gemini-macro', 'gemini-daytrading', 'gemini-news', 'gemini-combo'],
  },
];
