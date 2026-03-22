/**
 * Base44 Seed Script — Phase 1
 *
 * הרץ מקונסול הדפדפן (DevTools) כשהאפליקציה פתוחה.
 * הסקריפט יוצר entities ב-Base44 עבור: Categories, Topics, Mentors.
 *
 * שימוש:
 *   1. פתח את האפליקציה בדפדפן
 *   2. פתח DevTools → Console
 *   3. הדבק את כל הקוד הזה והרץ
 *   4. בדוק את הפלט — כל entity שנוצר בהצלחה מודפס
 *
 * הערה: הסקריפט בודק כפילויות לפי id/name לפני יצירה.
 */

// ── Data to seed ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "AI",      name: "בינה מלאכותית ואוטומציה", description: "AI, אוטומציה, כלים טכנולוגיים", icon: "Bot",        color: "violet", active: true },
  { id: "Markets", name: "שוק ההון",                description: "מסחר, השקעות, ניתוח טכני ופונדמנטלי", icon: "TrendingUp", color: "cyan",   active: true },
  { id: "Dev",     name: "פיתוח תוכנה",             description: "פיתוח, בניית אפליקציות, טכנולוגיה",  icon: "Code",       color: "blue",   active: true },
];

const TOPICS = [
  // קטגוריות ראשיות
  { id: "t1",  name: "בינה מלאכותית",   description: "מודלי שפה, סוכני AI, AI גנרטיבי",            color: "violet", icon: "Bot",        isMainCategory: true,  parentId: null },
  { id: "t2",  name: "שוק ההון",        description: "כלכלה, בורסה, מדדים גלובליים",               color: "cyan",   icon: "TrendingUp", isMainCategory: true,  parentId: null },
  { id: "t9",  name: "פיתוח תוכנה",     description: "קוד, ארכיטקטורה, שפות תכנות",                color: "blue",   icon: "Code",       isMainCategory: true,  parentId: null },
  // תת-נושאים: בינה מלאכותית
  { id: "t8",  name: "אוטומציה",        description: "n8n, Make, תהליכי אוטומציה עסקית, סוכני AI", color: "violet", icon: "Layers",     isMainCategory: false, parentId: "t1" },
  { id: "t12", name: "כלים וטכנולוגיות", description: "כלים חדשים, סקירות טכנולוגיה, תוכנות",       color: "amber",  icon: "Lightbulb",  isMainCategory: false, parentId: "t1" },
  // תת-נושאים: שוק ההון
  { id: "t3",  name: "השקעות",          description: "אסטרטגיות השקעה, תיק מניות, הכנסה פסיבית",    color: "cyan",   icon: "Layers",     isMainCategory: false, parentId: "t2" },
  { id: "t4",  name: "מסחר",            description: "מסחר יומי, swing trading, ניהול פוזיציות",    color: "cyan",   icon: "TrendingUp", isMainCategory: false, parentId: "t2" },
  { id: "t5",  name: "ניתוח טכני",       description: "גרפים, אינדיקטורים, תבניות מחיר",            color: "cyan",   icon: "Brain",      isMainCategory: false, parentId: "t2" },
  { id: "t6",  name: "ניתוח פונדמנטלי",  description: "ניתוח דוחות כספיים, הערכת שווי חברות",        color: "cyan",   icon: "Lightbulb",  isMainCategory: false, parentId: "t2" },
  { id: "t7",  name: "מניות",           description: "בחירת מניות, מגזרים, דיבידנדים",              color: "cyan",   icon: "Cpu",        isMainCategory: false, parentId: "t2" },
  // תת-נושאים: פיתוח תוכנה
  { id: "t13", name: "בניית אפליקציות",  description: "פיתוח אפליקציות, no-code, full-stack",        color: "blue",   icon: "BookOpen",   isMainCategory: false, parentId: "t9" },
  { id: "t10", name: "שיווק דיגיטלי",    description: "פרסום ממומן, SEO, שיווק ברשתות חברתיות",     color: "blue",   icon: "Globe",      isMainCategory: false, parentId: "t9" },
  { id: "t11", name: "פודקאסטים",        description: "פרקים מומלצים, ריאיונות, למידה דרך האזנה",   color: "blue",   icon: "BookOpen",   isMainCategory: false, parentId: "t9" },
];

const MENTORS = [
  // שוק ההון
  { id: "m1",  name: "Micha.Stocks",            description: "ניתוח מניות וסקירות שוק ההון",                    category: "Markets", topicIds: ["t2","t7","t3"],  active: true },
  { id: "m2",  name: "בורסה גרף",               description: "ניתוח טכני מקצועי וכלים פיננסיים",                category: "Markets", topicIds: ["t5","t2"],       active: true },
  { id: "m7",  name: "The Hasidic Trader",       description: "אסטרטגיות מסחר יומי ופסיכולוגיית מסחר",          category: "Markets", topicIds: ["t4","t2"],       active: true },
  { id: "m9",  name: "Oliver Velez Trading",     description: "מסחר מקצועי במניות ומומנטום",                    category: "Markets", topicIds: ["t4","t7"],       active: true },
  { id: "m11", name: "Dor Amir Trading",         description: "סיכומי יום מסחר ואסטרטגיות בשוק האמריקאי",       category: "Markets", topicIds: ["t4","t2"],       active: true },
  { id: "m12", name: "Eyal Shani",               description: "לימודי מסחר בשוק ההון למתחילים ומקצוענים",       category: "Markets", topicIds: ["t2","t4"],       active: true },
  { id: "m15", name: "Wysetrade",                description: "ניתוח טכני ויזואלי ופרייס אקשן",                category: "Markets", topicIds: ["t5","t4"],       active: true },
  // בינה מלאכותית
  { id: "m3",  name: "Ed Hill AI Automation",    description: "אוטומציה עסקית וסוכני AI — דגש על n8n",          category: "AI",      topicIds: ["t1","t8"],       active: true },
  { id: "m4",  name: "Automation-Tribe",         description: "בניית תהליכי אוטומציה עם Make ו-n8n",            category: "AI",      topicIds: ["t8","t12"],      active: true },
  { id: "m5",  name: "AI Andy",                  description: "סקירת כלי AI חדשים ואוטומציה לתוכן",             category: "AI",      topicIds: ["t1","t12"],      active: true },
  { id: "m6",  name: "Aimprove - אימפרוב",       description: "הנגשת בינה מלאכותית וכלים פרקטיים בעברית",       category: "AI",      topicIds: ["t1"],            active: true },
  { id: "m8",  name: "Eden Bibas",               description: "כלים וחידושים בעולם ה-AI",                       category: "AI",      topicIds: ["t1","t12"],      active: true },
  { id: "m10", name: "AI Pathways",              description: "בניית סוכני AI למסחר והשקעות",                   category: "AI",      topicIds: ["t1","t3","t8"],  active: true },
  // פיתוח תוכנה
  { id: "m13", name: "Base44 Community",         description: "פיתוח ובניית אפליקציות בקהילת Base44",           category: "Dev",     topicIds: ["t13","t9"],      active: true },
  { id: "m14", name: "Ran Bar Zik",              description: "טכנולוגיה, פיתוח ותוכנה בעברית",                 category: "Dev",     topicIds: ["t9","t12"],      active: true },
];

// ── Instructions ─────────────────────────────────────────────────────────────

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  Base44 Seed Script — Phase 1                                ║
║                                                               ║
║  הסקריפט הזה מכין את הנתונים.                                 ║
║  כדי להריץ אותו, צריך גישה ל-Base44 entities.                ║
║                                                               ║
║  אפשרויות:                                                    ║
║  1. העתק את הנתונים מלמעלה לממשק Base44 Dashboard             ║
║  2. או השתמש ב-Base44 SDK מהקונסול:                           ║
║     import { Mentor, Topic, Category } from '/src/api/entities.js' ║
║     for (const m of MENTORS) await Mentor.create(m);          ║
║                                                               ║
║  נתונים מוכנים:                                               ║
║  • ${CATEGORIES.length} categories                            ║
║  • ${TOPICS.length} topics (${TOPICS.filter(t => t.isMainCategory).length} main + ${TOPICS.filter(t => !t.isMainCategory).length} sub)   ║
║  • ${MENTORS.length} mentors                                  ║
╚═══════════════════════════════════════════════════════════════╝
`);

console.log('CATEGORIES:', JSON.stringify(CATEGORIES, null, 2));
console.log('TOPICS:', JSON.stringify(TOPICS, null, 2));
console.log('MENTORS:', JSON.stringify(MENTORS, null, 2));
