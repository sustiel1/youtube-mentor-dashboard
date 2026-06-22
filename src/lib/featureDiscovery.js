/**
 * Discovers app feature opportunities from macro / video analysis JSON.
 * Pure client-side — no AI, no GEM, no API calls.
 * Quality over quantity: low-confidence ideas are dropped.
 *
 * Each idea carries paired titles:
 *   titleHe — primary display (Hebrew)
 *   titleEn — technical name (English, for dev tools / GEM)
 */

export const FEATURE_CATEGORIES = [
  'Scanner',
  'Dashboard',
  'Tracker',
  'Analytics',
  'Alert System',
  'Watchlist',
  'Index',
  'Matrix',
];

const MIN_CONFIDENCE = 0.65;
const MIN_APP_FIT = 6;
const HEBREW_RE = /[\u0590-\u05FF]/;

/** Canonical Hebrew ↔ English name pairs */
const KNOWN_NAMES = {
  'XBI Momentum Scanner': { he: 'סורק מומנטום ביוטק', en: 'XBI Momentum Scanner' },
  'Real Estate Stress Index': { he: 'מדד לחץ נדל״ן ישראלי', en: 'Real Estate Stress Index' },
  'Tech Leaders Tracker': { he: 'מעקב מניות טכנולוגיה מובילות', en: 'Tech Leaders Tracker' },
  'Financials Sector Tracker': { he: 'מעקב סקטור פיננסים', en: 'Financials Sector Tracker' },
  'Consumer Pressure Index': { he: 'מדד לחץ צרכני', en: 'Consumer Pressure Index' },
  'Fed Reform Tracker': { he: 'מעקב רפורמות הפד', en: 'Fed Reform Tracker' },
  'Fed Rate Decision Tracker': { he: 'מעקב החלטות ריבית הפד', en: 'Fed Rate Decision Tracker' },
  'Fed Communication Analyzer': { he: 'מנתח תקשורת הפד', en: 'Fed Communication Analyzer' },
  'Fed Balance Sheet Tracker': { he: 'מעקב מאזן הפד', en: 'Fed Balance Sheet Tracker' },
  'Fed Policy Tracker': { he: 'מעקב מדיניות הפד', en: 'Fed Policy Tracker' },
  'Dot Plot Analyzer': { he: 'מנתח Dot Plot', en: 'Dot Plot Analyzer' },
  'Employment & AI Index': { he: 'מדד תעסוקה ו-AI', en: 'Employment & AI Index' },
  'Support Level Watchlist': { he: 'מעקב רמות תמיכה', en: 'Support Level Watchlist' },
  'Sector Impact Matrix': { he: 'מטריצת השפעה סקטוריאלית', en: 'Sector Impact Matrix' },
  'Macro Risk Alert System': { he: 'מערכת התראות סיכון מאקרו', en: 'Macro Risk Alert System' },
  'Market Opportunity Scanner': { he: 'סורק הזדמנויות שוק', en: 'Market Opportunity Scanner' },
  'Insight-Driven Feature': { he: 'פיצ׳ר מתובנת וידאו', en: 'Insight-Driven Feature' },
};

function s(val) {
  return typeof val === 'string' ? val.trim() : String(val ?? '').trim();
}

function clampScore(n, min = 1, max = 10) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function pair(he, en) {
  const known = KNOWN_NAMES[en];
  if (known) return { titleHe: known.he, titleEn: known.en };
  return { titleHe: s(he), titleEn: s(en) };
}

function resolveTitles(partial) {
  const he = s(partial.titleHe);
  const en = s(partial.titleEn);
  if (he && en) return { titleHe: he, titleEn: en };

  const legacy = s(partial.productIdea);
  if (!legacy) return { titleHe: '', titleEn: '' };

  const byEn = KNOWN_NAMES[legacy];
  if (byEn) return { titleHe: byEn.he, titleEn: byEn.en };

  const byHe = Object.values(KNOWN_NAMES).find((n) => n.he === legacy);
  if (byHe) return { titleHe: byHe.he, titleEn: byHe.en };

  if (HEBREW_RE.test(legacy)) {
    return pair('פיצ׳ר מתובנת וידאו', 'Custom Feature');
  }
  return pair('פיצ׳ר מותאם', legacy);
}

function inferCategory(titleEn, components = [], sourceType = '') {
  const text = `${s(titleEn)} ${components.join(' ')} ${sourceType}`.toLowerCase();
  if (/matrix|מטריצ/.test(text)) return 'Matrix';
  if (/scanner|סורק|breakout/.test(text)) return 'Scanner';
  if (/watchlist|רמות תמיכה|support level/.test(text)) return 'Watchlist';
  if (/alert|התרא|warning|אזהר|risk/.test(text)) return 'Alert System';
  if (/index|מדד|pressure|לחץ|stress/.test(text)) return 'Index';
  if (/dot.?plot|analyzer|analytic|מנתח/.test(text)) return 'Analytics';
  if (/dashboard|לוח בקרה|macro.*system/.test(text)) return 'Dashboard';
  if (/tracker|מעקב|fed|פד/.test(text)) return 'Tracker';
  return 'Dashboard';
}

function inferReusability(components = [], category = '') {
  const reusable = ['Alert Engine', 'Watchlist', 'Dashboard Card', 'Metric Widget', 'Trend Chart', 'Heatmap'];
  const hits = (Array.isArray(components) ? components : []).filter((c) =>
    reusable.some((r) => s(c).toLowerCase().includes(r.toLowerCase())),
  ).length;
  const base = { Matrix: 8, Scanner: 7, Tracker: 8, Index: 7, Watchlist: 9, 'Alert System': 8, Analytics: 6, Dashboard: 7 };
  return clampScore((base[category] || 6) + Math.min(2, hits));
}

function inferWorthBuilding(appFitScore, reusabilityScore, confidence) {
  if (appFitScore >= 8 && confidence >= 0.75) return 'Yes';
  if (appFitScore >= 7 || (appFitScore >= 6 && reusabilityScore >= 7)) return 'Maybe';
  if (appFitScore >= MIN_APP_FIT) return 'Maybe';
  return 'No';
}

function whySentence(userValue, shortDescription, fallback) {
  const pick = s(userValue) || s(shortDescription) || s(fallback);
  if (!pick) return '';
  const one = pick.split(/[.!?]\s/)[0].trim();
  return one.length > 120 ? `${one.slice(0, 117)}…` : one;
}

function namesForOpportunity(opp) {
  const text = (s(opp.title) + ' ' + s(opp.details)).toLowerCase();
  if (/ביוטק|biotech|xbi/.test(text)) return pair('סורק מומנטום ביוטק', 'XBI Momentum Scanner');
  if (/נדל[״"]?ן|real.?estate|קבלן/.test(text)) return pair('מדד לחץ נדל״ן ישראלי', 'Real Estate Stress Index');
  if (/טכנולוג|tech|avgo|magnificent/.test(text)) return pair('מעקב מניות טכנולוגיה מובילות', 'Tech Leaders Tracker');
  const title = s(opp.title);
  if (HEBREW_RE.test(title)) return pair(title.split(' ').slice(0, 5).join(' '), 'Market Opportunity Scanner');
  return pair('סורק הזדמנויות שוק', title.split(' ').slice(0, 4).join(' ') || 'Market Opportunity Scanner');
}

function compsForOppType(type) {
  const t = s(type).toLowerCase();
  if (/swing|סווינג/.test(t)) return ['Momentum Scanner', 'Breakout Chart', 'Alert Engine', 'Watchlist'];
  if (/real.?estate|נדל/.test(t)) return ['Pressure Index', 'Risk Gauge', 'Sales Tracker', 'Alert Banner'];
  return ['Metric Widget', 'Trend Chart', 'Alert Engine', 'Dashboard Card'];
}

function namesForSector(sector) {
  const t = s(sector).toLowerCase();
  if (/xbi|biotech|ביוטק/.test(t)) return pair('סורק מומנטום ביוטק', 'XBI Momentum Scanner');
  if (/xlf|financials|פיננסי/.test(t)) return pair('מעקב סקטור פיננסים', 'Financials Sector Tracker');
  if (/real.?estate|נדל/.test(t)) return pair('מדד לחץ נדל״ן', 'Real Estate Stress Index');
  if (/consumer|צרכנות/.test(t)) return pair('מדד לחץ צרכני', 'Consumer Pressure Index');
  const base = s(sector).split('(')[0].split('/').pop().trim().slice(0, 20);
  return pair(`מעקב סקטור ${base}`, `${base} Sector Tracker`);
}

function namesForStressSector(sectorLabel) {
  const raw = s(sectorLabel).split('(')[0].split('/').pop().trim();
  const t = raw.toLowerCase();
  if (/xbi|biotech|ביוטק/.test(t)) return pair('מדד לחץ ביוטק', 'Biotech Stress Index');
  if (/real.?estate|נדל/.test(t)) return pair('מדד לחץ נדל״ן', 'Real Estate Stress Index');
  if (/consumer|צרכנות/.test(t)) return pair('מדד לחץ צרכני', 'Consumer Stress Index');
  const en = `${raw.slice(0, 18)} Stress Index`;
  return pair(`מדד לחץ ${raw.slice(0, 14)}`, en);
}

function compsForSector(sector) {
  const t = s(sector).toLowerCase();
  if (/xbi|biotech/.test(t)) return ['Momentum Scanner', 'Breakout Chart', 'Top Movers', 'Alert Engine'];
  if (/xlf|financials/.test(t)) return ['Sector Chart', 'Yield Spread', 'Heatmap', 'Alert Engine'];
  if (/real.?estate|נדל/.test(t)) return ['Pressure Index', 'Debt Gauge', 'Sales Tracker', 'Alert Banner'];
  if (/consumer/.test(t)) return ['Pressure Gauge', 'Spending Index', 'Retail Trend', 'Alert Engine'];
  return ['Sector Chart', 'Heatmap', 'Alert Engine', 'Watchlist'];
}

function namesForPolicy(topic, desc) {
  const text = (s(topic) + ' ' + s(desc)).toLowerCase();
  if (/ועדות|committees|reform|מבנ/.test(text)) return pair('מעקב רפורמות הפד', 'Fed Reform Tracker');
  if (/ריבית|rate|decision/.test(text)) return pair('מעקב החלטות ריבית הפד', 'Fed Rate Decision Tracker');
  if (/תקשורת|communication/.test(text)) return pair('מנתח תקשורת הפד', 'Fed Communication Analyzer');
  if (/מאזן|balance.sheet/.test(text)) return pair('מעקב מאזן הפד', 'Fed Balance Sheet Tracker');
  return pair('מעקב מדיניות הפד', 'Fed Policy Tracker');
}

function compsForPolicy(isReform) {
  return isReform
    ? ['Committee Tracker', 'Reform Timeline', 'Announcement Feed', 'Impact Matrix']
    : ['Rate Widget', 'Dot Plot Chart', 'Rate History', 'Alert Engine'];
}

function namesForMacroFactor(indicator) {
  const t = s(indicator).toLowerCase();
  if (/dot.?plot/.test(t)) return pair('מנתח Dot Plot', 'Dot Plot Analyzer');
  if (/balance.sheet|מאזן/.test(t)) return pair('מעקב מאזן הפד', 'Fed Balance Sheet Tracker');
  if (/communication|תקשורת/.test(t)) return pair('מנתח תקשורת הפד', 'Fed Communication Analyzer');
  if (/employ|תעסוקה/.test(t)) return pair('מדד תעסוקה ו-AI', 'Employment & AI Index');
  const label = s(indicator).slice(0, 28);
  return pair(`מעקב ${label}`, `${label} Tracker`);
}

function finalizeIdea(partial) {
  const { titleHe, titleEn } = resolveTitles(partial);
  const sourceInsight = s(partial.sourceInsight);
  if (!titleHe || !titleEn || !sourceInsight || sourceInsight.length < 8) return null;

  const components = (Array.isArray(partial.components) ? partial.components : [])
    .map(s)
    .filter(Boolean)
    .slice(0, 4);
  if (components.length < 2) return null;

  const category = partial.category || inferCategory(titleEn, components, partial.sourceType);
  const appFitScore = clampScore(partial.appFitScore ?? 6);
  const confidence = Math.min(1, Math.max(0, Number(partial.confidence) || 0));
  if (confidence < MIN_CONFIDENCE || appFitScore < MIN_APP_FIT) return null;

  const reusabilityScore = clampScore(
    partial.reusabilityScore ?? inferReusability(components, category),
  );
  const worthBuilding = partial.worthBuilding || inferWorthBuilding(appFitScore, reusabilityScore, confidence);
  if (worthBuilding === 'No') return null;

  const whyItMatters = whySentence(
    partial.userValue,
    partial.shortDescription,
    partial.whyItMatters,
  );
  if (!whyItMatters || whyItMatters.length < 12) return null;

  return {
    id: partial.id || `${titleEn}-${sourceInsight}`.toLowerCase().replace(/\s+/g, '-').slice(0, 80),
    titleHe,
    titleEn,
    productIdea: titleEn,
    category,
    sourceInsight,
    whyItMatters,
    components,
    reusabilityScore,
    appFitScore,
    worthBuilding,
    confidence,
    sourceType: partial.sourceType || 'macro',
  };
}

/** Normalizes legacy / GEM idea objects into discovery shape. */
export function normalizeDiscoveryIdea(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;

  const components = (Array.isArray(raw.components) ? raw.components : [])
    .concat(raw.suggestedComponent ? [raw.suggestedComponent] : [])
    .map(s)
    .filter(Boolean)
    .slice(0, 4);

  return finalizeIdea({
    id: raw.id || `gem-${index}`,
    titleHe: raw.titleHe,
    titleEn: raw.titleEn,
    productIdea: raw.productIdea || raw.appName || raw.name,
    sourceInsight: s(raw.sourceInsight) || s(raw.shortDescription)?.slice(0, 80),
    userValue: raw.userValue,
    shortDescription: raw.shortDescription,
    components: components.length >= 2 ? components : ['Dashboard Card', 'Alert Engine', 'Trend Chart'],
    appFitScore: raw.appFitScore ?? 7,
    confidence: raw.confidence ?? 0.72,
    category: raw.category,
    sourceType: 'gem',
  });
}

export function discoverFeaturesFromMacro(marketBriefData) {
  if (!marketBriefData) return [];

  const raw = marketBriefData.rawData || {};
  const ut = marketBriefData.universalTabs || {};
  const utInsights = ut.insights || {};
  const utApp = ut.app || ut.appBuilder || {};

  const ideas = [];
  const seen = new Set();

  function add(partial) {
    const idea = finalizeIdea(partial);
    if (!idea) return;
    const key = idea.titleEn.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    ideas.push(idea);
  }

  for (const opp of raw.opportunities || []) {
    if (!opp?.title || s(opp.title).length < 6) continue;
    const details = s(opp.details);
    if (!details && s(opp.title).length < 15) continue;
    const names = namesForOpportunity(opp);
    add({
      ...names,
      sourceInsight: s(opp.title),
      userValue: details ? `Helps act on: ${s(opp.title).slice(0, 90)}` : '',
      shortDescription: details,
      components: compsForOppType(opp.type || ''),
      sourceType: 'opportunity',
      appFitScore: 9,
      confidence: 0.92,
    });
  }

  for (const sec of raw.sectors || []) {
    if (!sec?.sector) continue;
    const sentiment = s(sec.sentiment);
    if (sentiment !== 'חיובי' && sentiment !== 'שלילי') continue;
    const desc = s(sec.description) || s(sec.reason);
    if (desc.length < 15) continue;

    const isNegative = sentiment === 'שלילי';
    const sectorLabel = s(sec.sector).split('(')[0].trim();
    const names = isNegative ? namesForStressSector(sectorLabel) : namesForSector(sec.sector);
    add({
      ...names,
      sourceInsight: isNegative
        ? `Sector under pressure: ${sectorLabel}`
        : `Strong ${sectorLabel} momentum`,
      userValue: isNegative
        ? `Surfaces risk in ${sectorLabel} before it spreads.`
        : `Helps identify breakout opportunities in ${sectorLabel}.`,
      shortDescription: desc,
      components: isNegative
        ? ['Pressure Gauge', 'Risk Indicator', 'Trend Line', 'Alert Banner']
        : compsForSector(sec.sector),
      sourceType: 'sector',
      appFitScore: isNegative ? 7 : 8,
      confidence: 0.85,
    });
  }

  const stocksWithLevels = (raw.stocksMentioned || []).filter(
    (st) => st?.symbol && /\d/.test(String(st.reason || '')),
  );
  if (stocksWithLevels.length >= 2) {
    const symbols = stocksWithLevels.slice(0, 4).map((x) => x.symbol).join(', ');
    add({
      ...pair('מעקב רמות תמיכה', 'Support Level Watchlist'),
      sourceInsight: `Key levels mentioned: ${symbols}`,
      userValue: 'Alerts when a tracked stock breaks a critical support or resistance level.',
      components: ['Support Level Table', 'Price Alert Engine', 'Mini Chart', 'Watchlist'],
      sourceType: 'watchlist',
      appFitScore: 8,
      confidence: 0.88,
    });
  }

  const policyNamesSeen = new Set();
  for (const policy of raw.fedPolicy || []) {
    if (!policy?.topic) continue;
    const desc = s(policy.description);
    if (desc.length < 20) continue;
    const isReform = /ועדות|reform|committee|מבנ/i.test(desc);
    const names = namesForPolicy(policy.topic, desc);
    if (policyNamesSeen.has(names.titleEn)) continue;
    policyNamesSeen.add(names.titleEn);
    add({
      ...names,
      sourceInsight: `Fed: ${s(policy.topic).slice(0, 60)}`,
      userValue: `Tracks ${s(policy.topic).slice(0, 55)} without manual monitoring.`,
      shortDescription: desc,
      components: compsForPolicy(isReform),
      sourceType: 'fed',
      appFitScore: isReform ? 8 : 7,
      confidence: 0.82,
    });
  }

  const sectorsWithDesc = (raw.sectors || []).filter((sec) => s(sec.description).length >= 10);
  if (sectorsWithDesc.length >= 4) {
    add({
      ...pair('מטריצת השפעה סקטוריאלית', 'Sector Impact Matrix'),
      sourceInsight: `${sectorsWithDesc.length} sectors analyzed in video`,
      userValue: 'Shows which sectors benefit or suffer from current macro policy in seconds.',
      components: ['Impact Matrix', 'Sentiment Heatmap', 'Relative Strength Chart', 'Quick Filter'],
      sourceType: 'structure',
      appFitScore: 7,
      confidence: 0.78,
    });
  }

  for (const factor of raw.macroFactors || []) {
    if (!factor?.indicator) continue;
    const desc = s(factor.description);
    if (desc.length < 15) continue;
    add({
      ...namesForMacroFactor(factor.indicator),
      sourceInsight: `Macro indicator: ${s(factor.indicator)}`,
      userValue: `Makes ${s(factor.indicator)} easy to monitor and interpret.`,
      shortDescription: desc,
      components: ['Indicator Card', 'Trend Chart', 'Dot Plot Visualizer', 'Alert Engine'],
      sourceType: 'macro',
      appFitScore: 7,
      confidence: 0.8,
    });
  }

  const warnings = (raw.warnings || []).map(s).filter((w) => w.length >= 20);
  if (warnings.length >= 2) {
    add({
      ...pair('מערכת התראות סיכון מאקרו', 'Macro Risk Alert System'),
      sourceInsight: warnings[0].slice(0, 80),
      userValue: 'Consolidates active macro and sector risks into one actionable view.',
      components: ['Warnings Feed', 'Risk Gauge', 'Macro Dashboard', 'Alert Banner'],
      sourceType: 'risk',
      appFitScore: 7,
      confidence: 0.76,
      reusabilityScore: 8,
    });
  }

  const insightLists = [
    ...(Array.isArray(utInsights) ? utInsights : []),
    ...(Array.isArray(utInsights.top5Insights) ? utInsights.top5Insights : []),
    ...(Array.isArray(utInsights.tradingInsights) ? utInsights.tradingInsights : []),
    ...(Array.isArray(marketBriefData.top5Insights) ? marketBriefData.top5Insights : []),
  ];
  for (const item of insightLists) {
    const text = typeof item === 'string' ? item : s(item?.text || item?.point || item?.insight);
    if (text.length < 25) continue;
    if (!/scanner|tracker|dashboard|מעקב|סורק|מדד|סקטור|fed|פד|מניה|stock|alert/i.test(text)) continue;
    const snippet = text.split(/[.:]/)[0].trim().slice(0, 40);
    const names = HEBREW_RE.test(snippet)
      ? pair(snippet, 'Insight-Driven Feature')
      : pair('פיצ׳ר מתובנת וידאו', snippet.length >= 8 ? snippet : 'Insight-Driven Feature');
    add({
      ...names,
      sourceInsight: text.slice(0, 90),
      userValue: 'Turns a specific video insight into a reusable app component.',
      components: ['Insight Card', 'Trend Chart', 'Alert Engine', 'Watchlist'],
      sourceType: 'insight',
      appFitScore: 6,
      confidence: 0.68,
    });
  }

  for (const ind of utApp.newIndicators || []) {
    const text = s(ind);
    if (text.length < 25 || /מדד חדש|new indicator/i.test(text)) continue;
    const label = text.split('(')[0].trim().slice(0, 45);
    if (label.length < 8) continue;
    const names = HEBREW_RE.test(label)
      ? pair(label, `${label.replace(/[^\w\s]/g, '').slice(0, 24) || 'Custom'} Indicator`)
      : pair(`מדד ${label.slice(0, 20)}`, label);
    add({
      ...names,
      sourceInsight: text.slice(0, 90),
      userValue: 'Monitors a novel market signal mentioned in the video.',
      components: ['Indicator Card', 'Trend Chart', 'Benchmark Compare', 'Alert Engine'],
      sourceType: 'indicator',
      appFitScore: 6,
      confidence: 0.66,
    });
  }

  return ideas
    .sort((a, b) => {
      const worthOrder = { Yes: 3, Maybe: 2, No: 1 };
      const w = (worthOrder[b.worthBuilding] || 0) - (worthOrder[a.worthBuilding] || 0);
      if (w !== 0) return w;
      return (b.appFitScore || 0) - (a.appFitScore || 0);
    })
    .slice(0, 10);
}

/** Brief for pasting into the dedicated App Builder GEM (discovery → builder handoff). */
export function buildDiscoveryGemBrief(idea, video, topicName = '') {
  if (!idea) return '';
  const title = video?.title || 'הסרטון';
  const vId = video?.videoId || video?.id || '';
  const url = vId ? `https://www.youtube.com/watch?v=${encodeURIComponent(vId)}` : null;
  const comps = (idea.components || []).map((c) => `• ${c}`).join('\n');
  const nameHe = idea.titleHe || idea.productIdea;
  const nameEn = idea.titleEn || idea.productIdea;

  return [
    '# Feature Discovery — App Builder GEM Input',
    '',
    url ? `Video: ${url}` : null,
    `Title: ${title}`,
    topicName ? `Topic: ${topicName}` : null,
    '',
    '## Selected Feature Opportunity',
    `**Name (HE):** ${nameHe}`,
    `**Name (EN):** ${nameEn}`,
    `**Category:** ${idea.category || '—'}`,
    `**Source insight:** ${idea.sourceInsight}`,
    `**Why it matters:** ${idea.whyItMatters}`,
    '',
    '## Suggested Components',
    comps || '—',
    '',
    '## Evaluation',
    `• App Fit Score: ${idea.appFitScore}/10`,
    `• Reusability Score: ${idea.reusabilityScore}/10`,
    `• Worth building: ${idea.worthBuilding}`,
    '',
    '## Instructions for GEM',
    'Expand this single feature into a full PRD with JSON, development prompts, and implementation plan.',
    'Use the English technical name for component naming and code generation.',
    'Do NOT generate unrelated features — focus only on the selected opportunity above.',
  ].filter((line) => line !== null).join('\n').trim();
}
