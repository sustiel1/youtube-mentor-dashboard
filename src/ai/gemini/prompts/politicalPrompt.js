/**
 * Builds the analysis prompt for political content.
 * Extracted from vite.config.js buildPoliticalGeminiAnalysisLines.
 */
export function buildPoliticalAnalysisPrompt({
  chaptersTarget,
  title,
  mentor,
  category,
  durationSeconds,
  chapterHintsText,
}) {
  return [
    'STATIC NARRATIVE TIMES: Preserve an explicit source time as numeric timestampSeconds. When timestamped transcript segments defensibly locate a narrative source region, store numeric estimatedStartSeconds with timestampKind: estimated and, when available, timestampSource, timestampConfidence and sourceQuote.',
    'If there is no defensible source region, omit all time fields. Never infer a narrative item time from item order and never divide the video into equal windows.',
    'נתח את התמלול הפוליטי הבא בלבד והחזר JSON בלבד, בלי markdown ובלי טקסט נוסף.',
    '',
    '═══ מטרת הניתוח ═══',
    'ניתוח עמוק של טענות, אידיאולוגיה, פריימינג, וכלי שכנוע. אובייקטיביות מוחלטת — אל תציג עמדה.',
    '',
    '═══ כללי ניתוח פוליטי ═══',
    'הבחן בין עובדות לפריימינג אידיאולוגי: עובדה = ניתנת לאימות. פריימינג = הקשר שמוסיפים לה.',
    'זהה טכניקות שכנוע רגשי: פאתוס (ערעור רגשי), אתוס (בניית אמינות), לוגוס (ניתוח לוגי).',
    'חלץ הנחות יסוד נסתרות: מה הדובר מניח שנכון מבלי לומר זאת?',
    'זהה לאיזה קהל מכוונת ההודעה: מה הפחדים, התקוות, והזהות שהיא מנצלת?',
    'weakPoints: חולשות לוגיות ומוסריות, לא רק רטוריות.',
    'counterArguments: טיעוני נגד חזקים ומנומקים — לא "אבל..." פשוט.',
    'socialMediaReplies: תגובות קצרות וחדות לרשתות חברתיות, לא אקדמיות.',
    'networkSlogans: 10-25 שורות קצרות שניתן להדביק ישירות כתגובה/פוסט/כותרת ברשתות. כל אחת: text (השורה), tone (חד/אירוני/רגשי/ענייני/מחאתי), useCase (תגובה קצרה/פוסט/כותרת/תגובת נגד), sourceIdea (על מה מבוסס הרעיון). חלץ מהתמלול — לא סיסמאות גנריות.',
    'politicalSlogans: 15-25 סיסמאות פוליטיות מהתמלול. כל פריט: text (הסיסמה), tone (רגשי/חד/מחאתי/ענייני/אירוני), confidence (0-100), sourceIdea (על מה מבוסס). כללים נוקשים: משפט אחד בלבד. מקסימום 12 מילים. חד. זכיר. מתאים לתגובות פייסבוק, טוויטר, ת\'רדס, ויכוחים פוליטיים. סגנון: ישיר, רגשי, ברחוב. דוגמאות: "גאולה רוויה בדם" / "פחד הוא לא מדיניות" / "מלחמה אינסופית איננה חזון". אל תייצר סיסמאות גנריות.',
    'viralQuotes: 10-20 ציטוטים מדויקים מהתמלול שכדאי לשתף — ניסוחים זכירים, חדים, ובעלי עוצמה רגשית או לוגית. מחרוזות בלבד.',
    'debateResponses: 10-20 תגובות קצרות ומוכנות לשימוש לויכוחים ברשת. משפט אחד בלבד לכל תגובה. חדות, ישירות, לנקודה. מחרוזות בלבד.',
    'commentBank: 20-50 תגובות מוכנות לשימוש — תמהיל: חדות, רגשיות, אנליטיות, סרקסטיות, חד-שורות. מחרוזות בלבד.',
    '',
    '═══ כללי פרקים ═══',
    `צור בין ${chaptersTarget} ל-${Math.max(chaptersTarget, 8)} פרקים כרונולוגיים שמכסים את כל הדיון.`,
    'כל פרק = מעבר אידיאולוגי או נושאי אמיתי, לא חלוקת זמן שווה.',
    'כל פרק חייב לכלול: כותרת ספציפית, startSeconds, endSeconds, summary.',
    'כותרות תקינות: "נתניהו: מדיניות הביטחון" | "הטיעון נגד חוק הגיוס" | "תגובת האופוזיציה לתקציב".',
    'כותרות אסורות: "פתיחה", "סיכום", "פרק 1", "מבוא", "ניתוח".',
    'אם אין timestamps — הערך לפי סדר הטקסט ומשך הסרטון.',
    'אל תחזיר chapters: [] — פרקים הם חובה.',
    '',
    '═══ כללי JSON קפדניים ═══',
    'אסור מרכאות (") בתוך ערכי מחרוזת — גרשיים עבריים שוברים JSON. כתוב: חכ, מג, זל, מם, עוד, בגץ (בלי גרשיים).',
    'סיים את כל ה-JSON — כולל הסגריות הסוגרות האחרונות. אסור לחתוך באמצע ערך.',
    '',
    `כותרת: ${title}`,
    mentor ? `מנטור: ${mentor}` : null,
    category ? `קטגוריה: ${category}` : null,
    Number.isFinite(Number(durationSeconds)) && Number(durationSeconds) > 0
      ? `משך סרטון בשניות: ${Math.floor(Number(durationSeconds))}`
      : null,
    chapterHintsText ? `\nרמזי פרקים/YouTube (אם קיימים):\n${chapterHintsText}` : null,
  ].filter(Boolean).join('\n');
}
