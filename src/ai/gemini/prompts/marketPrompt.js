/**
 * Builds the analysis prompt for market/trading content.
 * Focuses on extracting actionable trading setups, tickers, risk rules, and price levels.
 */
export function buildMarketAnalysisPrompt({
  chaptersTarget,
  title,
  mentor,
  category,
  durationSeconds,
  chapterHintsText,
  transcriptMode = 'full',
}) {
  const chapterInstruction =
    transcriptMode === 'short'
      ? 'התמלול קצר — אל תמציא פרקים. החזר chapters: [] אם אין מספיק תוכן.'
      : transcriptMode === 'medium'
      ? `צור 2-3 פרקים לפי נושאי מסחר ברורים מהתמלול.`
      : `צור ${chaptersTarget} פרקים שמכסים את כל הדיון. כל פרק צריך לכסות ticker ספציפי, נושא מסחרי, או תנאי שוק קונקרטי.`;

  return [
    'נתח את התמלול הפיננסי/מסחרי הבא בלבד והחזר JSON בלבד, בלי markdown ובלי טקסט נוסף.',
    '',
    '═══ מטרת הניתוח ═══',
    'לחלץ תזה מסחרית, קטליסטורים, רעיונות actionable, וכללי ניהול סיכון שניתן לשחזר.',
    '',
    '═══ כללי חילוץ שוק ═══',
    'הפרד בין ארגומנטים שוריים לדוביים — תייג כל ארגומנט לאיזה כיוון הוא שייך.',
    'חלץ הנחות מאחורי כל טיעון: מה חייב להיות נכון כדי שהתזה תתקיים?',
    'זהה שינויי סנטימנט: האם הדובר שינה עמדה במהלך הסרטון? איפה ולמה?',
    'חלץ כל ticker/ETF/מדד שמוזכר בפועל — אל תמציא סמלי מניות שאינם בתמלול.',
    'רמות מחיר: ספציפיות בלבד עם מספרים ממשיים (לא "קרוב ל-support", "אזור מחיר").',
    'tradingRules: פורמט — תנאי → פעולה. דוגמה: "אם RSI < 30 + קפיצת נפח → כניסה Long".',
    'riskRules: כלל ניהול סיכון ספציפי: stop-loss, גודל פוזיציה, יחס סיכון-תגמול, מקסימום הפסד יומי.',
    'זהה מה הדובר לא אומר: סיכונים שלא מוזכרים, הנחות שלא נבדקות.',
    'אל תכתוב המלצות השקעה מפורשות — תאר את מה שנאמר.',
    'אסור: ערכים גנריים, מדומים, placeholder.',
    'אם אין חומר חזק לשדה — החזר מערך ריק.',
    '',
    '═══ כללי פרקים ═══',
    'כותרות פרקים חייבות לכלול: ticker ספציפי / מספר/אחוז / מונח טכני מדויק מהתמלול.',
    'כותרות תקינות: "NVDA: פריצת resistance 480$" | "SPY vs QQQ — רוטציה" | "VIX מעל 20 — שינוי גישה".',
    'כותרות אסורות: "ניתוח השוק", "כלים מעשיים", "פתיח", "סיכום", "המצב הכלכלי".',
    chapterInstruction,
    '',
    `כותרת: ${title}`,
    mentor ? `מנטור: ${mentor}` : null,
    category ? `קטגוריה: ${category}` : null,
    Number.isFinite(Number(durationSeconds)) && Number(durationSeconds) > 0
      ? `משך סרטון בשניות: ${Math.floor(Number(durationSeconds))}`
      : null,
    '',
    'רמזי פרקים/YouTube (אם קיימים):',
    chapterHintsText,
  ].filter(Boolean).join('\n');
}
