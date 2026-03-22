/**
 * run-seed.js — Base44 Seed Script (Node.js)
 *
 * Usage:
 *   node scripts/run-seed.js
 *
 * Auth:
 *   Requires BASE44_TOKEN env var — get it from browser DevTools:
 *   localStorage.getItem('base44_access_token')
 *
 *   Run with:
 *   צור .env.local עם: BASE44_TOKEN=<token>
 *   ואז הרץ: node scripts/run-seed.js
 */

import { createClient } from '@base44/sdk';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Read env files (.env.local takes priority over .env) ──────────────────────
function loadEnvFile(filename) {
  try {
    const raw = readFileSync(resolve(__dirname, '..', filename), 'utf-8');
    return Object.fromEntries(
      raw.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#') && l.includes('='))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
    );
  } catch {
    return {};
  }
}

const envBase  = loadEnvFile('.env');
const envLocal = loadEnvFile('.env.local');
const env = { ...envBase, ...envLocal }; // .env.local overrides .env

const APP_ID       = env.VITE_BASE44_APP_ID;
const APP_BASE_URL = env.VITE_BASE44_APP_BASE_URL;
const TOKEN        = env.BASE44_TOKEN;

if (!APP_ID) {
  console.error('❌ VITE_BASE44_APP_ID חסר ב-.env');
  process.exit(1);
}
if (!TOKEN) {
  console.error('❌ BASE44_TOKEN חסר.');
  console.error('   קבל אותו מהדפדפן: localStorage.getItem("base44_access_token")');
  console.error('   הוסף ל-.env.local: BASE44_TOKEN=<token>');
  process.exit(1);
}

// ── Create Base44 client ──────────────────────────────────────────────────────
const client = createClient({
  appId: APP_ID,
  token: TOKEN,
  requiresAuth: false,
  appBaseUrl: APP_BASE_URL ?? '',
  serverUrl: 'https://base44.app',
});

const Category = client.entities.Category;
const Topic    = client.entities.Topic;
const Mentor   = client.entities.Mentor;

// ── Seed data ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'AI',      name: 'בינה מלאכותית ואוטומציה', description: 'AI, אוטומציה, כלים טכנולוגיים',              icon: 'Bot',        color: 'violet', active: true },
  { id: 'Markets', name: 'שוק ההון',                description: 'מסחר, השקעות, ניתוח טכני ופונדמנטלי',       icon: 'TrendingUp', color: 'cyan',   active: true },
  { id: 'Dev',     name: 'פיתוח תוכנה',             description: 'פיתוח, בניית אפליקציות, טכנולוגיה',          icon: 'Code',       color: 'blue',   active: true },
];

const TOPICS = [
  { id: 't1',  name: 'בינה מלאכותית',    description: 'מודלי שפה, סוכני AI, AI גנרטיבי',             color: 'violet', icon: 'Bot',        isMainCategory: true,  parentId: null },
  { id: 't2',  name: 'שוק ההון',         description: 'כלכלה, בורסה, מדדים גלובליים',                color: 'cyan',   icon: 'TrendingUp', isMainCategory: true,  parentId: null },
  { id: 't9',  name: 'פיתוח תוכנה',      description: 'קוד, ארכיטקטורה, שפות תכנות',                 color: 'blue',   icon: 'Code',       isMainCategory: true,  parentId: null },
  { id: 't8',  name: 'אוטומציה',         description: 'n8n, Make, תהליכי אוטומציה עסקית, סוכני AI',  color: 'violet', icon: 'Layers',     isMainCategory: false, parentId: 't1' },
  { id: 't12', name: 'כלים וטכנולוגיות', description: 'כלים חדשים, סקירות טכנולוגיה, תוכנות',        color: 'amber',  icon: 'Lightbulb',  isMainCategory: false, parentId: 't1' },
  { id: 't3',  name: 'השקעות',           description: 'אסטרטגיות השקעה, תיק מניות, הכנסה פסיבית',   color: 'cyan',   icon: 'Layers',     isMainCategory: false, parentId: 't2' },
  { id: 't4',  name: 'מסחר',             description: 'מסחר יומי, swing trading, ניהול פוזיציות',   color: 'cyan',   icon: 'TrendingUp', isMainCategory: false, parentId: 't2' },
  { id: 't5',  name: 'ניתוח טכני',       description: 'גרפים, אינדיקטורים, תבניות מחיר',             color: 'cyan',   icon: 'Brain',      isMainCategory: false, parentId: 't2' },
  { id: 't6',  name: 'ניתוח פונדמנטלי',  description: 'ניתוח דוחות כספיים, הערכת שווי חברות',        color: 'cyan',   icon: 'Lightbulb',  isMainCategory: false, parentId: 't2' },
  { id: 't7',  name: 'מניות',            description: 'בחירת מניות, מגזרים, דיבידנדים',              color: 'cyan',   icon: 'Cpu',        isMainCategory: false, parentId: 't2' },
  { id: 't13', name: 'בניית אפליקציות',  description: 'פיתוח אפליקציות, no-code, full-stack',        color: 'blue',   icon: 'BookOpen',   isMainCategory: false, parentId: 't9' },
  { id: 't10', name: 'שיווק דיגיטלי',    description: 'פרסום ממומן, SEO, שיווק ברשתות חברתיות',     color: 'blue',   icon: 'Globe',      isMainCategory: false, parentId: 't9' },
  { id: 't11', name: 'פודקאסטים',        description: 'פרקים מומלצים, ריאיונות, למידה דרך האזנה',   color: 'blue',   icon: 'BookOpen',   isMainCategory: false, parentId: 't9' },
];

const MENTORS = [
  { id: 'm1',  name: 'Micha.Stocks',          description: 'ניתוח מניות וסקירות שוק ההון',                    category: 'Markets', topicIds: ['t2','t7','t3'], avatarUrl: '', active: true },
  { id: 'm2',  name: 'בורסה גרף',             description: 'ניתוח טכני מקצועי וכלים פיננסיים',                category: 'Markets', topicIds: ['t5','t2'],      avatarUrl: '', active: true },
  { id: 'm7',  name: 'The Hasidic Trader',    description: 'אסטרטגיות מסחר יומי ופסיכולוגיית מסחר',          category: 'Markets', topicIds: ['t4','t2'],      avatarUrl: '', active: true },
  { id: 'm9',  name: 'Oliver Velez Trading',  description: 'מסחר מקצועי במניות ומומנטום',                    category: 'Markets', topicIds: ['t4','t7'],      avatarUrl: '', active: true },
  { id: 'm11', name: 'Dor Amir Trading',      description: 'סיכומי יום מסחר ואסטרטגיות בשוק האמריקאי',       category: 'Markets', topicIds: ['t4','t2'],      avatarUrl: '', active: true },
  { id: 'm12', name: 'Eyal Shani',            description: 'לימודי מסחר בשוק ההון למתחילים ומקצוענים',       category: 'Markets', topicIds: ['t2','t4'],      avatarUrl: '', active: true },
  { id: 'm15', name: 'Wysetrade',             description: 'ניתוח טכני ויזואלי ופרייס אקשן',                  category: 'Markets', topicIds: ['t5','t4'],      avatarUrl: '', active: true },
  { id: 'm3',  name: 'Ed Hill AI Automation', description: 'אוטומציה עסקית וסוכני AI — דגש על n8n',          category: 'AI',      topicIds: ['t1','t8'],      avatarUrl: '', active: true },
  { id: 'm4',  name: 'Automation-Tribe',      description: 'בניית תהליכי אוטומציה עם Make ו-n8n',            category: 'AI',      topicIds: ['t8','t12'],     avatarUrl: '', active: true },
  { id: 'm5',  name: 'AI Andy',               description: 'סקירת כלי AI חדשים ואוטומציה לתוכן',             category: 'AI',      topicIds: ['t1','t12'],     avatarUrl: '', active: true },
  { id: 'm6',  name: 'Aimprove - אימפרוב',    description: 'הנגשת בינה מלאכותית וכלים פרקטיים בעברית',       category: 'AI',      topicIds: ['t1'],           avatarUrl: '', active: true },
  { id: 'm8',  name: 'Eden Bibas',            description: 'כלים וחידושים בעולם ה-AI',                       category: 'AI',      topicIds: ['t1','t12'],     avatarUrl: '', active: true },
  { id: 'm10', name: 'AI Pathways',           description: 'בניית סוכני AI למסחר והשקעות',                   category: 'AI',      topicIds: ['t1','t3','t8'], avatarUrl: '', active: true },
  { id: 'm13', name: 'Base44 Community',      description: 'פיתוח ובניית אפליקציות בקהילת Base44',           category: 'Dev',     topicIds: ['t13','t9'],     avatarUrl: '', active: true },
  { id: 'm14', name: 'Ran Bar Zik',           description: 'טכנולוגיה, פיתוח ותוכנה בעברית',                 category: 'Dev',     topicIds: ['t9','t12'],     avatarUrl: '', active: true },
];

// ── Upsert helper ─────────────────────────────────────────────────────────────
async function upsert(EntityClass, items, label) {
  const existing = await EntityClass.list();
  const keys = new Set([
    ...existing.map(x => x.id).filter(Boolean),
    ...existing.map(x => x.name).filter(Boolean),
  ]);

  let created = 0, skipped = 0;

  for (const item of items) {
    if (keys.has(item.id) || keys.has(item.name)) {
      console.log(`  ⏭  קיים: ${item.name}`);
      skipped++;
      continue;
    }
    try {
      await EntityClass.create(item);
      console.log(`  ✓  נוצר: ${item.name}`);
      created++;
    } catch (err) {
      console.error(`  ❌ שגיאה ב-${label} "${item.name}": ${err.message ?? err}`);
      console.error(`     פרטים:`, JSON.stringify(item, null, 2));
      throw new Error(`Seed נעצר ב-${label} — תקן schema ואז הרץ שוב`);
    }
  }

  console.log(`  → ${label}: ${created} נוצרו, ${skipped} דולגו\n`);
  return { created, skipped };
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('\n🌱 Base44 Seed — מתחיל...\n');

try {
  const r1 = await upsert(Category, CATEGORIES, 'Category');
  const r2 = await upsert(Topic,    TOPICS,    'Topic');
  const r3 = await upsert(Mentor,   MENTORS,   'Mentor');

  const total = r1.created + r2.created + r3.created;
  const totalSkipped = r1.skipped + r2.skipped + r3.skipped;

  console.log('✅ Seed הסתיים בהצלחה');
  console.log(`   נוצרו: ${total} | דולגו: ${totalSkipped}`);
  console.log(`   Categories: ${r1.created}+${r1.skipped} | Topics: ${r2.created}+${r2.skipped} | Mentors: ${r3.created}+${r3.skipped}\n`);
} catch (err) {
  console.error('\n❌', err.message);
  process.exit(1);
}
