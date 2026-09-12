const planFields = [
  { key: "action", label: "פעולה", type: "select", options: ["לא לעשות דבר", "מעקב", "כניסה מתוכננת", "יציאה מתוכננת"] },
  { key: "trigger", label: "תנאי הפעלה", type: "textarea" },
  { key: "invalidation", label: "תנאי ביטול", type: "textarea" },
  { key: "lockPrice", label: "מחיר הנכס בזמן הנעילה", type: "text", ltr: true },
  { key: "targetPrice", label: "מחיר יעד", type: "text", ltr: true, note: "היעד שלך בלבד — אינו יעד של מקור חיצוני" },
  { key: "rewardRisk", label: "יחס תגמול–סיכון מתוכנן", type: "text", ltr: true },
  { key: "horizon", label: "אופק", type: "select", options: ["יומי", "מספר ימים", "שבועיים", "חודש"] },
  { key: "reviewDate", label: "תאריך סקירה", type: "date", ltr: true },
  { key: "automaticExpiry", label: "פקיעה אוטומטית", type: "text" },
  { key: "plannedRisk", label: "סיכון מתוכנן", type: "text", ltr: true },
  { key: "setupTag", label: "תגית תבנית", type: "select", options: ["פריצה מריכוז", "בדיקת תמיכה", "עוצמה יחסית", "פריצה כושלת"] },
  { key: "lockTime", label: "זמן נעילה", type: "text", ltr: true },
  { key: "executionTime", label: "זמן ביצוע בפועל", type: "text", ltr: true },
  { key: "exitReason", label: "סיבת יציאה", type: "textarea" },
  { key: "dailyRuleViolation", label: "חריגה מכלל הפסילה היומי", type: "flag" },
  { key: "mentalState", label: "מצב מנטלי — אופציונלי", type: "rating" },
];

const statusOpen = [
  { label: "תאריך מסחר בארה״ב", value: "יום שלישי, 8 בספטמבר 2026", freshness: "לפי שעון ניו יורק · נבדק 08:27" },
  { label: "מצב השוק", value: "טרום־מסחר · פתיחה בעוד 6:03 שעות", freshness: "לוח המסחר נבדק 08:27" },
  { label: "חשיפה מול מזומן", value: "42% חשיפה · 58% מזומן", freshness: "תמונת חשבון נעולה ל־08:10", valueTone: "mixed" },
  { label: "עדכון אחרון", value: "08:27 שעון ישראל", freshness: "לפני 3 דקות" },
];

const statusClosed = [
  { label: "תאריך בארה״ב", value: "יום שני, 7 בספטמבר 2026", freshness: "לפי שעון ניו יורק · נבדק 08:27" },
  { label: "מצב השוק", value: "השוק בארה״ב סגור · יום העבודה", freshness: "לוח NYSE אומת 08:27", state: "closed" },
  { label: "חשיפה מול מזומן", value: "42% חשיפה · 58% מזומן", freshness: "סגירה קודמת · 4 בספטמבר 23:00", valueTone: "mixed" },
  { label: "עדכון אחרון", value: "08:27 שעון ישראל", freshness: "בדיקת חג הושלמה כעת" },
];

const risk = {
  rule: "אם SPY מאבד את 6,344, אין לפתוח תוכניות לונג חדשות היום.",
  requiredLabel: "השדה היחיד שחובה למלא היום",
  stopWidth: { label: "רוחב סטופ מוצע", value: "1.6× ATR", freshness: "מחקר נעול · 08:15" },
  positionSize: { label: "גודל פוזיציה מוצע", value: "75% מהגודל הרגיל", freshness: "מחקר נעול · 08:15" },
  boundary: "מנוע המחקר אינו מאשר או אוסר כניסה. ההחלטה על כניסה נשארת שלך לפי מבנה המחיר בגרף ארבע השעות.",
};

const events = {
  headingState: "לוח נבדק · 08:20",
  status: "events",
  items: [
    { time: "15:30", name: "מדד מחירי היצרן", impact: "השפעה גבוהה", consensus: "+0.3%", consensusState: "קונצנזוס ממקור", freshness: "מקור: הלוח הכלכלי · נבדק 08:20" },
    { time: "17:00", name: "מלאי סיטונאי", impact: "השפעה בינונית", consensus: "+0.2%", consensusState: "הוזן ידנית", freshness: "מקור ידני · הוזן 07:55" },
    { time: "20:00", name: "מכרז אג״ח ל־3 שנים", impact: "השפעה בינונית", consensus: "אין קונצנזוס", consensusState: "לא פורסם", freshness: "נתוני יום קודם · עיכוב במקור" },
  ],
};

const focusItems = [
  {
    symbol: "NVDA",
    company: "אנבידיה",
    structure: "דחיסה מתחת להתנגדות עם שיאים ושפלים עולים",
    level: "מעקב רק מעל 181.40 בסגירת ארבע שעות",
    distance: "1.2% מתחת לתנאי ההפעלה",
    distanceTone: "neutral",
    context: "עוצמה יחסית מול ETF הסקטור; המחזור עדיין מתחת לממוצע.",
    sources: ["מיכה סטוקס · 07:42", "סקירת שוק שבועית · אתמול 21:10"],
  },
  {
    symbol: "AMZN",
    company: "אמזון",
    structure: "בדיקה חוזרת של תמיכה לאחר פריצה",
    level: "התמיכה הנצפית: 226.80–228.10",
    distance: "0.7% מעל קצה האזור",
    distanceTone: "positive",
    context: "הסקטור יציב; אין עדיין אישור ממבנה ארבע השעות.",
    sources: ["נועם מדר · 06:58", "סיכום סקטור צריכה · אתמול 19:40"],
  },
  {
    symbol: "PLTR",
    company: "פלנטיר",
    structure: "פריצה כושלת וחזרה אל תוך הטווח",
    level: "תנאי לבחינה מחדש: החזרת 164.20",
    distance: "2.4% מתחת לתנאי",
    distanceTone: "negative",
    context: "חולשה יחסית מול ETF התוכנה; אופק המקור קצר מהאופק שלך.",
    sources: ["דניאל כהן · 08:04"],
  },
];

const unlockedPlan = {
  locked: false,
  title: "תוכנית עבודה לפני נעילה",
  statusText: "טיוטה פתוחה · הנתונים אינם נשמרים",
  noPlanOption: "אין תוכנית היום",
  values: {
    action: "מעקב",
    trigger: "סגירת ארבע שעות מעל 181.40 תוך שמירה על שפל עולה.",
    invalidation: "סגירת ארבע שעות מתחת 176.20 או איבוד כלל הפסילה היומי.",
    lockPrice: "—",
    targetPrice: "190.00",
    rewardRisk: "2.2R",
    horizon: "מספר ימים",
    reviewDate: "2026-09-11",
    automaticExpiry: "בסיום יום המסחר 11.09",
    plannedRisk: "0.5% מההון",
    setupTag: "פריצה מריכוז",
    lockTime: "טרם ננעל",
    executionTime: "טרם בוצע",
    exitReason: "טרם נקבע",
    dailyRuleViolation: "לא סומן",
    mentalState: "רגוע",
  },
  fields: planFields,
};

const lockedPlan = {
  ...unlockedPlan,
  locked: true,
  title: "תוכנית עבודה נעולה",
  statusText: "התוכנית קפואה לקריאה בלבד · נעילה: 08.09.2026, 08:31",
  values: {
    ...unlockedPlan.values,
    lockPrice: "179.26",
    lockTime: "08.09.2026 · 08:31",
    mentalState: "ממוקד",
  },
};

const emptyFocus = {
  title: "אין נכסים במיקוד היום",
  message: "אף נכס לא עמד היום בקריטריוני המיקוד. זהו מצב מכוון, לא חוסר בנתונים.",
  freshness: "סריקת המקורות הושלמה · 08:22",
};

const reviewQueue = [
  { asset: "NVDA · תוכנית פריצה", horizon: "מספר ימים", reviewDate: "היום · 18:30", status: "ממתין לסקירה" },
  { asset: "MSFT · בדיקת תמיכה", horizon: "שבועיים", reviewDate: "היום · לאחר הסגירה", status: "הגיע מועד הסקירה" },
  { asset: "אין פעולה · 04.09", horizon: "יומי", reviewDate: "היום", status: "סקירת משמעת" },
];

const baseSnapshot = {
  eyebrow: "מוח מסחר · סביבת עבודה יומית",
  title: "תמונת מצב יומית",
  subtitle: "קוקפיט תפעולי לפני פתיחת המסחר בארה״ב",
  status: statusOpen,
  risk,
  macro: events,
  focus: { items: focusItems },
  plan: unlockedPlan,
  reviews: reviewQueue,
};

export const presentationStates = [
  { key: "unlocked", label: "לפני נעילת התוכנית", snapshot: baseSnapshot },
  { key: "locked", label: "אחרי נעילת התוכנית", snapshot: { ...baseSnapshot, plan: lockedPlan } },
  {
    key: "holiday",
    label: "יום ללא מסחר בארה״ב",
    snapshot: {
      ...baseSnapshot,
      status: statusClosed,
      closureNotice: {
        title: "השוק בארה״ב סגור היום",
        message: "יום העבודה הוא יום חופשה רשמי בבורסות ארה״ב. זהו מצב מסחר מאומת, לא נתון שוק חסר.",
        freshness: "לוח NYSE נבדק · 08:27",
      },
      macro: {
        status: "confirmed-none",
        headingState: "לוח נבדק · 08:20",
        title: "אין אירועי מאקרו מתוזמנים היום",
        message: "היעדר האירועים אושר מול הלוח הכלכלי.",
        freshness: "אימות אחרון · 08:20",
        items: [],
      },
      plan: {
        ...unlockedPlan,
        title: "אין תוכנית היום",
        statusText: "תגובה יומית תקפה · השוק סגור",
        values: { ...unlockedPlan.values, action: "לא לעשות דבר", trigger: "אין תוכנית היום", invalidation: "השוק בארה״ב סגור — אין תוכנית מסחר להיום." },
      },
    },
  },
  {
    key: "no-focus",
    label: "יום ללא נכסים במיקוד",
    snapshot: {
      ...baseSnapshot,
      macro: {
        status: "not-checked",
        headingState: "לא נבדק",
        title: "לוח המאקרו טרם נבדק",
        message: "אין להסיק מכאן שאין אירועים. נדרש אימות של מקור הנתונים.",
        freshness: "מצב מקור: טרם בוצעה בדיקה",
        items: [],
      },
      focus: { items: [], empty: emptyFocus },
      plan: {
        ...unlockedPlan,
        title: "אין תוכנית היום",
        statusText: "תגובה יומית תקפה · אין נכסים במיקוד",
        values: { ...unlockedPlan.values, action: "לא לעשות דבר", trigger: "אין תוכנית היום", invalidation: "אם SPY מאבד את 6,344, אין לפתוח תוכניות לונג חדשות היום." },
      },
    },
  },
];

export const defaultPresentationState = "unlocked";
