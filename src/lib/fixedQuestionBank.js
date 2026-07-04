// Strip leading emoji / symbols — "🚀 סיכום ב-30 שניות" → "סיכום ב-30 שניות"
function _normalize(label) {
  return (label || '').replace(/^[^א-ת\w]+/, '').trim();
}

const SECTION_QUESTIONS = {
  // ── Summary sections ────────────────────────────────────────────────────────
  'סיכום ב-30 שניות': [
    { id: 'summary30-1', text: 'מה הדבר הכי חשוב בסיכום הזה למסחר היום?' },
    { id: 'summary30-2', text: 'איזה משפט כאן הוא קטליזטור אמיתי ואיזה רק רעש?' },
    { id: 'summary30-3', text: 'האם הסיכום מצביע על שוק חיובי, שלילי או מעורב?' },
    { id: 'summary30-4', text: 'איזה טיקר או סקטור דורש בדיקה מיידית?' },
    { id: 'summary30-5', text: 'מה השתנה לעומת יום המסחר הקודם?' },
  ],
  'מצב השוק': [
    { id: 'market-1', text: 'האם מצב השוק כרגע תומך בכניסה ללונגים או מחייב זהירות?' },
    { id: 'market-2', text: 'איזה סקטור מוביל ואיזה סקטור נחלש?' },
    { id: 'market-3', text: 'האם הירידות הן מימוש בריא או סימן לשינוי מגמה?' },
    { id: 'market-4', text: 'מה רמות התמיכה או ההתנגדות החשובות להיום?' },
    { id: 'market-5', text: 'האם הסנטימנט הכללי מתאים למסחר אגרסיבי או הגנתי?' },
  ],
  'מה לעקוב היום': [
    { id: 'watch-1', text: 'מה הקטליזטור המרכזי בפריט הזה?' },
    { id: 'watch-2', text: 'האם המניה מתאימה למעקב בלבד או גם לפעולה?' },
    { id: 'watch-3', text: 'מה צריך לקרות כדי שהפריט הזה יהפוך להזדמנות?' },
    { id: 'watch-4', text: 'איפה רמות התמיכה, ההתנגדות והממוצעים החשובים?' },
    { id: 'watch-5', text: 'מה הסיכון המרכזי אם נכנסים מוקדם מדי?' },
  ],
  'תובנות מרכזיות': [
    { id: 'insights-1', text: 'מה התובנה הכי מעשית שאפשר לקחת למסחר היום?' },
    { id: 'insights-2', text: 'האם זו תובנה טכנית, פונדמנטלית או מאקרו?' },
    { id: 'insights-3', text: 'איזה טיקר או סקטור מושפע ישירות מהתובנה הזאת?' },
    { id: 'insights-4', text: 'האם התובנה משנה את התרחיש לטווח קצר?' },
    { id: 'insights-5', text: 'מה צריך לבדוק כדי לאמת שהתובנה נכונה?' },
  ],
  'סיכונים': [
    { id: 'risks-1', text: 'מה הסיכון הכי מיידי בפריט הזה?' },
    { id: 'risks-2', text: 'איזה סימן בשוק יאשר שהסיכון מתחיל להתממש?' },
    { id: 'risks-3', text: 'איך אפשר להקטין חשיפה או להגן על הפוזיציה?' },
    { id: 'risks-4', text: 'האם הסיכון נקודתי למניה או רחב לכל הסקטור?' },
    { id: 'risks-5', text: 'מה יבטל את הסיכון או יהפוך אותו להזדמנות?' },
  ],
  "צ'קליסט פעולה": [
    { id: 'checklist-1', text: 'מה הפעולה המעשית שצריך לבצע עכשיו?' },
    { id: 'checklist-2', text: 'איזה נתון צריך לבדוק לפני החלטת קנייה או מכירה?' },
    { id: 'checklist-3', text: 'האם יש רמת מחיר ברורה לפעולה?' },
    { id: 'checklist-4', text: 'מה הטריגר לכניסה, יציאה או המתנה?' },
    { id: 'checklist-5', text: 'מה צריך לעדכן ברשימת המעקב אחרי הבדיקה?' },
  ],
  'סיכום מלא': [
    { id: 'fullsummary-1', text: 'מה הסיפור המרכזי של יום המסחר לפי הסיכום המלא?' },
    { id: 'fullsummary-2', text: 'אילו מניות הן הזדמנות ואילו הן סיכון?' },
    { id: 'fullsummary-3', text: 'האם יש כאן שינוי מגמה או רק תגובה יומית?' },
    { id: 'fullsummary-4', text: 'איזה מידע חסר כדי לקבל החלטה טובה יותר?' },
    { id: 'fullsummary-5', text: 'מה שלושת הדברים הכי חשובים לבדוק ב-Perplexity עכשיו?' },
  ],

  // ── Specialized tab sections ─────────────────────────────────────────────────
  'חדשות': [
    { id: 'news-1', text: 'מה החדשה המרכזית כאן ומה ההשפעה המיידית שלה על השוק?' },
    { id: 'news-2', text: 'אילו מניות או סקטורים מושפעים ישירות מהחדשה הזאת?' },
    { id: 'news-3', text: 'האם מדובר בקטליזטור חד-פעמי או שינוי מהותי יותר?' },
    { id: 'news-4', text: 'מה צריך לבדוק כדי לוודא שהשוק מתמחר את החדשה נכון?' },
    { id: 'news-5', text: 'מה הסיכון אם השוק מגיב לחדשה בצורה מוגזמת?' },
  ],
  'מצב שוק': [
    { id: 'mktstate-1', text: 'האם מצב השוק כרגע תומך בלונגים, בשורטים או בהמתנה?' },
    { id: 'mktstate-2', text: 'איזה סימן מעיד אם הפתיחה האדומה היא מימוש בריא או שינוי מגמה?' },
    { id: 'mktstate-3', text: 'אילו מדדים או סקטורים מובילים את הכיוון היומי?' },
    { id: 'mktstate-4', text: 'האם יש פער בין הסטטיסטיקה ההיסטורית לבין התנהגות המחיר בפועל?' },
    { id: 'mktstate-5', text: 'מה צריך לקרות כדי שהשוק יחזור למומנטום חיובי?' },
  ],
  'סקטורים': [
    { id: 'sectors-1', text: 'איזה סקטור מציג עוצמה יחסית ואיזה סקטור נחלש?' },
    { id: 'sectors-2', text: 'האם החולשה בסקטור היא טכנית בלבד או קשורה לחדשות/מאקרו?' },
    { id: 'sectors-3', text: 'אילו מניות מובילות את התנועה בתוך הסקטור?' },
    { id: 'sectors-4', text: 'האם כדאי לעקוב אחרי הסקטור להזדמנות כניסה או להימנע כרגע?' },
    { id: 'sectors-5', text: 'מה רמת המחיר או התנאי שיאשרו שינוי כיוון בסקטור?' },
  ],
  'הזדמנויות': [
    { id: 'opps-1', text: 'מה בדיוק ההזדמנות בפריט הזה?' },
    { id: 'opps-2', text: 'מה צריך לקרות כדי שההזדמנות תהפוך לכניסה אמיתית?' },
    { id: 'opps-3', text: 'איפה רמות התמיכה, ההתנגדות או הממוצעים החשובים?' },
    { id: 'opps-4', text: 'מה יחס הסיכון/סיכוי לפני פעולה?' },
    { id: 'opps-5', text: 'איזה מידע נוסף צריך לבדוק לפני שמכניסים לרשימת מעקב?' },
  ],
  'מניות שהוזכרו': [
    { id: 'stocks-1', text: 'מה הסיבה המרכזית שהמניה הזאת הוזכרה היום?' },
    { id: 'stocks-2', text: 'האם הסנטימנט סביב המניה חיובי, שלילי או ניטרלי?' },
    { id: 'stocks-3', text: 'מה הקטליזטור החשוב ביותר שצריך לבדוק לגבי המניה?' },
    { id: 'stocks-4', text: 'איפה רמות התמיכה, ההתנגדות והממוצעים החשובים?' },
    { id: 'stocks-5', text: 'האם המניה מתאימה לפעולה עכשיו או רק למעקב?' },
  ],
  'לוח כלכלי': [
    { id: 'calendar-1', text: 'איזה אירוע בלוח הכלכלי יכול להשפיע הכי הרבה על השוק היום?' },
    { id: 'calendar-2', text: 'באיזו שעה או סביב איזה פרסום צריך להיזהר מתנודתיות?' },
    { id: 'calendar-3', text: 'אילו סקטורים או נכסים רגישים במיוחד לאירוע הזה?' },
    { id: 'calendar-4', text: 'מה התרחיש השורי ומה התרחיש הדובי סביב האירוע?' },
    { id: 'calendar-5', text: 'האם כדאי להקטין סיכון לפני האירוע או להמתין לאחריו?' },
  ],
  'מאקרו': [
    { id: 'macro-1', text: 'מה הנתון המאקרו המרכזי כאן ומה המשמעות שלו לשוק?' },
    { id: 'macro-2', text: 'איך הנתון משפיע על ריבית, דולר, אג"ח, סחורות או מניות?' },
    { id: 'macro-3', text: 'האם המאקרו תומך בסיכון או מעודד מעבר להגנה?' },
    { id: 'macro-4', text: 'איזה נכס או סקטור צפוי להגיב הכי חזק?' },
    { id: 'macro-5', text: 'מה צריך לבדוק בהמשך היום כדי לאשר את הכיוון המאקרו?' },
  ],
  'סנטימנט': [
    { id: 'sentiment-1', text: 'האם הסנטימנט כרגע חיובי, שלילי או מעורב?' },
    { id: 'sentiment-2', text: 'האם יש פער בין המחיר בפועל לבין תחושת השוק?' },
    { id: 'sentiment-3', text: 'האם הפחד/פומו נראה מוגזם או מוצדק?' },
    { id: 'sentiment-4', text: 'אילו נכסים משקפים הכי טוב את שינוי הסנטימנט?' },
    { id: 'sentiment-5', text: 'מה יהיה הסימן שהסנטימנט משתנה במהלך היום?' },
  ],
  'שווקים': [
    { id: 'indices-1', text: 'איזה מדד מוביל את הכיוון ואיזה מדד מפגר מאחור?' },
    { id: 'indices-2', text: 'האם הירידות/עליות רחבות או מרוכזות במדד מסוים?' },
    { id: 'indices-3', text: 'מה התמונה בין NASDAQ, S&P 500, Dow ו-Russell?' },
    { id: 'indices-4', text: 'האם יש עוצמה יחסית שמרמזת על סקטור או סגנון השקעה מוביל?' },
    { id: 'indices-5', text: 'מה רמת השוק או התנאי שחשוב לעקוב אחריו להמשך היום?' },
  ],

  // ── Insights tab sections ────────────────────────────────────────────────────
  'תובנות לימוד': [
    { id: 'learn-1', text: 'מה העיקרון הלימודי המרכזי שאפשר לקחת מהפריט הזה?' },
    { id: 'learn-2', text: 'איך אפשר להשתמש בתובנה הזאת בהחלטות מסחר עתידיות?' },
    { id: 'learn-3', text: 'באיזה מצב שוק התובנה הזאת הכי רלוונטית?' },
    { id: 'learn-4', text: 'מה הדוגמה המעשית מתוך הפריט שממחישה את הכלל?' },
    { id: 'learn-5', text: "איזה כלל אישי כדאי להוסיף לצ'קליסט המסחר בעקבות זה?" },
  ],
  'לקחי שוק': [
    { id: 'lessons-1', text: 'מה הלקח המרכזי שהשוק מלמד כאן?' },
    { id: 'lessons-2', text: 'איזו טעות סוחרים עלולים לעשות במצב כזה?' },
    { id: 'lessons-3', text: 'איך היה נכון לפעול לפי הלקח הזה בזמן אמת?' },
    { id: 'lessons-4', text: 'האם הלקח קשור לטכני, פונדמנטלי, סנטימנט או ניהול סיכונים?' },
    { id: 'lessons-5', text: 'איך אפשר לזהות מצב דומה בפעם הבאה?' },
  ],
  'תובנות מסחר': [
    { id: 'tradinginsights-1', text: 'מה התובנה הכי מעשית למסחר מתוך הפריט הזה?' },
    { id: 'tradinginsights-2', text: 'האם התובנה מתאימה לכניסה, יציאה, המתנה או ניהול פוזיציה?' },
    { id: 'tradinginsights-3', text: 'איזה טריגר טכני או פונדמנטלי צריך לבדוק לפני פעולה?' },
    { id: 'tradinginsights-4', text: 'מה הסיכון אם מיישמים את התובנה מוקדם מדי?' },
    { id: 'tradinginsights-5', text: 'איך להפוך את התובנה הזאת לכלל פעולה ברור?' },
  ],
  'מסקנות': [
    { id: 'conclusions-1', text: 'מה המסקנה המרכזית מהפריט הזה?' },
    { id: 'conclusions-2', text: 'אילו מניות, סקטורים או נכסים מושפעים מהמסקנה?' },
    { id: 'conclusions-3', text: 'האם המסקנה מחזקת תרחיש שורי, דובי או ניטרלי?' },
    { id: 'conclusions-4', text: 'מה צריך לבדוק כדי לוודא שהמסקנה עדיין תקפה?' },
    { id: 'conclusions-5', text: 'איזו פעולה או מעקב נובעים מהמסקנה הזאת?' },
  ],

  // ── Useful Knowledge tab sections ────────────────────────────────────────────
  'ידע לשימוש חוזר': [
    { id: 'reuse-1', text: 'מה המושג או הכלל המרכזי שכדאי לשמור מהפריט הזה?' },
    { id: 'reuse-2', text: 'איך משתמשים בידע הזה בפועל במסחר או בניתוח שוק?' },
    { id: 'reuse-3', text: 'באילו מצבים הידע הזה עוזר לקבל החלטה טובה יותר?' },
    { id: 'reuse-4', text: 'מה דוגמה מהשוק הנוכחי שממחישה את הידע הזה?' },
    { id: 'reuse-5', text: 'איך כדאי לנסח את זה ככלל קבוע למחברת המסחר?' },
  ],
  'נקודות מפתח': [
    { id: 'keypoints-1', text: 'מה נקודת המפתח החשובה ביותר בפריט הזה?' },
    { id: 'keypoints-2', text: 'למה הנקודה הזאת חשובה להבנת יום המסחר?' },
    { id: 'keypoints-3', text: 'איזה טיקר, סקטור או אירוע קשור אליה ישירות?' },
    { id: 'keypoints-4', text: 'האם זו נקודת מפתח לפעולה מיידית או למעקב בלבד?' },
    { id: 'keypoints-5', text: 'איזה מידע חסר כדי להפוך את הנקודה הזאת להחלטה?' },
  ],
  'ניהול סיכונים': [
    { id: 'riskman-1', text: 'מה הסיכון שצריך לנהל כאן?' },
    { id: 'riskman-2', text: 'האם הסיכון קשור לכניסה, יציאה, גודל פוזיציה או סטופ?' },
    { id: 'riskman-3', text: 'איזה סימן יראה שהסיכון מתממש?' },
    { id: 'riskman-4', text: 'איך אפשר להקטין חשיפה בלי לפספס הזדמנות?' },
    { id: 'riskman-5', text: "איזה כלל ניהול סיכונים כדאי להוסיף בעקבות הפריט הזה?" },
  ],
  'טעויות להימנע': [
    { id: 'mistakes-1', text: 'מה הטעות המרכזית שצריך להימנע ממנה כאן?' },
    { id: 'mistakes-2', text: 'למה הטעות הזאת מסוכנת במיוחד במצב השוק הנוכחי?' },
    { id: 'mistakes-3', text: 'איזה סימן מוקדם יכול לעזור לזהות את הטעות לפני שהיא קורית?' },
    { id: 'mistakes-4', text: 'מה הפעולה הנכונה במקום הטעות הזאת?' },
    { id: 'mistakes-5', text: "איך להפוך את זה לכלל ברור בצ'קליסט?" },
  ],
  'כללים': [
    { id: 'rules-1', text: 'מה הכלל המרכזי שמופיע בפריט הזה?' },
    { id: 'rules-2', text: 'מתי הכלל הזה תקף ומתי הוא עלול לא לעבוד?' },
    { id: 'rules-3', text: 'איזה תנאי צריך לבדוק לפני שמיישמים את הכלל?' },
    { id: 'rules-4', text: 'מה דוגמה מעשית מהפריט שממחישה את הכלל?' },
    { id: 'rules-5', text: 'איך לנסח את הכלל בצורה קצרה וברורה לשימוש חוזר?' },
  ],
};

// Aliases: variant label (after emoji strip) → canonical key in SECTION_QUESTIONS
const ALIASES = {
  // Legacy summary labels
  'התובנות החשובות ביותר': 'תובנות מרכזיות',
  'סיכונים מרכזיים':       'סיכונים',
  'צ׳קליסט פעולה':         "צ'קליסט פעולה",  // Hebrew geresh (U+05F3) variant
  'מסקנה מנהלים':          'סיכום מלא',
  // Specialized tab — alternate forms after emoji strip
  'מצב שוק':               'מצב שוק',        // normalized "מצב שוק" → own key
};

const GENERIC_QUESTIONS = [
  { id: 'generic-1', text: 'מה הנתונים הכי עדכניים שצריך לבדוק לגבי הפריט הזה?' },
  { id: 'generic-2', text: 'מה יכול לשנות את הכיוון או המשמעות של הפריט הזה?' },
  { id: 'generic-3', text: 'אילו מניות, סקטורים או מדדים קשורים לפריט זה?' },
  { id: 'generic-4', text: 'מה התרחיש השורי ומה התרחיש הדובי?' },
  { id: 'generic-5', text: 'איזה מידע נוסף צריך לפני שמקבלים החלטה?' },
];

function findQuestions(sectionLabel) {
  if (!sectionLabel) return GENERIC_QUESTIONS;

  const normalized = _normalize(sectionLabel);

  // 1. Direct match
  if (SECTION_QUESTIONS[normalized]) return SECTION_QUESTIONS[normalized];

  // 2. Alias match
  const aliasTarget = ALIASES[normalized];
  if (aliasTarget && SECTION_QUESTIONS[aliasTarget]) return SECTION_QUESTIONS[aliasTarget];

  // 3. Fuzzy: normalized label contains or is contained by a canonical key
  const fuzzyKey = Object.keys(SECTION_QUESTIONS).find(
    (k) => normalized.includes(k) || k.includes(normalized)
  );
  if (fuzzyKey) return SECTION_QUESTIONS[fuzzyKey];

  // 4. Fuzzy alias fallback
  const fuzzyAlias = Object.keys(ALIASES).find(
    (k) => normalized.includes(k) || k.includes(normalized)
  );
  if (fuzzyAlias && SECTION_QUESTIONS[ALIASES[fuzzyAlias]]) {
    return SECTION_QUESTIONS[ALIASES[fuzzyAlias]];
  }

  return GENERIC_QUESTIONS;
}

export function getFixedQuestionsForItems(selectedItems) {
  const labels = (selectedItems || []).map((i) => i.sectionLabel || '').filter(Boolean);
  if (!labels.length) return GENERIC_QUESTIONS;
  const freq = {};
  labels.forEach((l) => { freq[l] = (freq[l] || 0) + 1; });
  const dominant = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  return findQuestions(dominant);
}

const COPY_HEADER = 'ענה בעברית בלבד.\nתן תשובות קצרות, מעשיות וממוקדות למסחר.\nאל תתרגם טיקרים, שמות חברות או מושגים מקצועיים באנגלית.';

export function buildFixedCopyText(selectedItems, selectedQIds, allQuestions) {
  const selectedQs = allQuestions.filter((q) => selectedQIds.has(q.id));
  const parts = [COPY_HEADER, ''];

  if (selectedItems.length === 1) {
    parts.push('פריט נבחר:');
    parts.push(selectedItems[0].text);
  } else {
    selectedItems.forEach((item, i) => {
      parts.push(`פריט ${i + 1}:`);
      parts.push(item.text);
    });
  }

  if (selectedQs.length > 0) {
    parts.push('');
    parts.push('שאלות לבדיקה:');
    selectedQs.forEach((q, i) => { parts.push(`${i + 1}. ${q.text}`); });
  }

  return parts.join('\n');
}
