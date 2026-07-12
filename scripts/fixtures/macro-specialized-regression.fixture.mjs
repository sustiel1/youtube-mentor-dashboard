/**
 * Regression fixture for the Specialized tab macro-mapping pipeline.
 * Source: "מבזק לייב פתיחה לתאריך 10.7.26" GEM JSON (trimmed to fields relevant
 * to the macro/stocks/markets cross-category bug — see
 * docs/MACRO_SPECIALIZED_MAPPING_AUDIT.md for the full audit).
 */
export const macroSpecializedFixture = {
  contentType: 'marketBrief',
  rawData: {
    marketNews: [
      { title: 'הנפקת SK Hynix בנאסדאק', description: 'הנפקה חיצונית ענקית שמגייסת כ-26-28 מיליארד דולר.' },
      { title: 'הכרזת הוועדות החדשות של הפד', description: 'הפד הכריז על חמישה צוותים מקצועיים לסקירת פעילותו ושינוי דרכי התקשורת שלו, מה שמוריד את ההסתברות לשינוי ריבית קרוב.' },
    ],
    indices: [
      { ticker: 'SPY', name: 'S&P 500', direction: 'up' },
      { ticker: 'QQQ', name: 'Nasdaq', direction: 'down' },
    ],
    macroFactors: [
      {
        factor: 'ריבית הפד והחלטות קרובות',
        note: 'אין כרגע נתונים כלכליים שמצדיקים תנועת ריבית מיידית. הקמת הוועדות החדשות תופסת את הפוקוס.',
      },
      {
        factor: 'דירוג האגח של אורקל',
        note: 'חטפה הורדת דירוג חמורה לרמת BBB מינוס, דרגה אחת בלבד מעל אגח זבל (Junk Bond), מה שיקפיץ לה את עלויות הגיוס.',
      },
      {
        factor: 'שוק הקריפטו',
        note: 'הביטקוין חזר אל מעל 64,000 אך נותר מתחת לממוצע הנע 150. האתריום נסחר ברמת 1794.',
      },
    ],
    stocksMentioned: [
      { ticker: 'ORCL', name: 'Oracle', note: 'נפגעת קשות מהורדת דירוג האשראי של החוב ל-BBB מינוס.' },
      { ticker: 'META', name: 'Meta', note: 'שבוע חזק של 12%-15% עם נר אלוהים שבועי.' },
    ],
    keyLevels: [
      { ticker: 'BTC', level: 64000.0, type: 'psychological' },
      { ticker: 'ETH', level: 1794.0, type: 'support' },
    ],
    sentiment: [
      { asset: 'השוק הכללי', mood: 'תנודתי ומעורב' },
    ],
  },
  universalTabs: {
    specialized: {
      indices: [
        { ticker: 'SPY', sentiment: 'חיובי מתון' },
        { ticker: 'QQQ', sentiment: 'שלילי זמני' },
      ],
      macroFactors: [
        { name: 'ועדות הבדיקה של הפד', status: 'צפי להשארת הריבית ללא שינוי בישיבה הקרובה' },
        { name: 'חוב אורקל', status: 'הורדת דירוג חמורה ל-BBB מינוס, סכנת הנמכה לאגח זבל' },
      ],
      stocksMentioned: [
        { ticker: 'META', status: 'נר אלוהים שבועי, נבלמת במדויק על קו שיאים יורדים' },
      ],
      keyLevels: [
        { ticker: 'BTC', level: 64000.0 },
      ],
    },
  },
  metadata: {
    title: 'מבזק לייב פתיחה לתאריך 10.7.26',
    mappingHints: {
      specializedSources: ['marketOverview', 'indices', 'stocksMentioned', 'sectorRotation'],
    },
  },
};
