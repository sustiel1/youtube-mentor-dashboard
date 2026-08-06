import {
  extractOpportunityIdeas,
  extractRiskItems,
  extractUnifiedStocks,
  getSpecializedSrc,
} from '@/lib/morningBriefDisplay';

const MAX_VISIBLE_ITEMS = 3;

function summaryLayers(marketBriefData) {
  return [
    { value: marketBriefData?.universalTabs?.summary, path: 'marketBriefData.universalTabs.summary' },
    { value: marketBriefData?.rawData?.universalTabs?.summary, path: 'marketBriefData.rawData.universalTabs.summary' },
    { value: marketBriefData?.summary, path: 'marketBriefData.summary' },
    { value: marketBriefData?.rawData?.summary, path: 'marketBriefData.rawData.summary' },
    { value: marketBriefData, path: 'marketBriefData' },
    { value: marketBriefData?.rawData, path: 'marketBriefData.rawData' },
  ].filter(({ value }) => value && typeof value === 'object' && !Array.isArray(value));
}

function firstSummarySource(marketBriefData, key) {
  for (const { value, path } of summaryLayers(marketBriefData)) {
    if (Array.isArray(value[key]) && value[key].length > 0) {
      return { items: value[key], path: `${path}.${key}` };
    }
  }
  return { items: [], path: '' };
}

function normalizedText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('he')
    .replace(/[\u0591-\u05c7]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function semanticRiskKey(value) {
  const text = normalizedText(value);
  if (/(soxl|ממונ|מינוף|leverag)/.test(text)) return 'leveraged-products';
  if (/(התחז|הונא|סקאמר|מתחז|fraud|imperson|scam)/.test(text)) return 'fraud-impersonation';
  if (/(דוח|דוחות|רווח|earnings).*(meta|msft|מיקרוסופט|מטא)|(meta|msft|מיקרוסופט|מטא).*(דוח|דוחות|רווח|earnings)/.test(text)) return 'earnings-event';
  return text;
}

function resolveCandidates(items, getText, getSemanticKey = (text) => normalizedText(text)) {
  const seen = new Set();
  const displayed = [];
  const diagnostics = [];
  for (const item of items) {
    const key = getSemanticKey(getText(item));
    if (!key) {
      diagnostics.push({ ...item, status: 'insufficient-evidence', semanticKey: key });
      continue;
    }
    if (seen.has(key)) {
      diagnostics.push({ ...item, status: 'duplicate-of-structured-item', semanticKey: key });
      continue;
    }
    seen.add(key);
    if (displayed.length >= MAX_VISIBLE_ITEMS) {
      diagnostics.push({ ...item, status: 'over-display-limit', semanticKey: key });
      continue;
    }
    displayed.push(item);
    diagnostics.push({
      ...item,
      status: item.sourceKind === 'structured' ? 'displayed-structured' : 'displayed-summary-fallback',
      semanticKey: key,
    });
  }
  return { displayed, diagnostics };
}

function excludeTickerOnlyIdeas(ideas, marketBriefData, effectiveVideo) {
  const stockTickers = new Set(
    extractUnifiedStocks(marketBriefData, effectiveVideo).map((stock) => stock.ticker),
  );
  return ideas.filter((idea) => {
    const title = String(idea.title || '').trim().toUpperCase();
    return !(stockTickers.has(title) && title.length <= 5);
  });
}

/**
 * Canonical presentation resolver shared by the panel and bulk/export selection.
 * Structured Specialized fields win; summary arrays are evidence-only fallbacks.
 */
export function resolveOpportunitiesAndRisks(marketBriefData, effectiveVideo = {}) {
  const specialized = getSpecializedSrc(marketBriefData);
  const opportunityFallbackSource = firstSummarySource(marketBriefData, 'keyOpportunities');
  const riskFallbackSource = firstSummarySource(marketBriefData, 'importantWarnings');
  const structuredOpportunities = excludeTickerOnlyIdeas(
    extractOpportunityIdeas(specialized),
    marketBriefData,
    effectiveVideo,
  ).map((item) => ({
    ...item,
    text: [item.title, item.detail].filter(Boolean).join(' — '),
    sourcePath: 'marketBriefData.tradingOpportunities',
    sourceKind: 'structured',
    sourceType: 'structured',
    confidence: 'source-explicit',
    isFallback: false,
  }));
  const fallbackOpportunities = extractOpportunityIdeas({
    opportunities: opportunityFallbackSource.items,
  }).map((item) => ({
    ...item,
    kindLabel: 'למעקב',
    text: [item.title, item.detail].filter(Boolean).join(' — '),
    sourcePath: opportunityFallbackSource.path,
    sourceKind: 'summary-fallback',
    sourceType: 'summary-fallback',
    confidence: 'source-explicit',
    isFallback: true,
  }));

  const structuredRisks = extractRiskItems(specialized).map((item) => ({
    ...item,
    sourcePath: 'marketBriefData.risks',
    sourceKind: 'structured',
    sourceType: 'structured',
    confidence: 'source-explicit',
    isFallback: false,
  }));
  const fallbackRisks = extractRiskItems({
    risks: riskFallbackSource.items,
  }).map((item) => ({
    ...item,
    category: item.category || 'אזהרה',
    sourcePath: riskFallbackSource.path,
    sourceKind: 'summary-fallback',
    sourceType: 'summary-fallback',
    confidence: 'source-explicit',
    isFallback: true,
  }));

  const opportunityResolution = resolveCandidates(
    [...structuredOpportunities, ...fallbackOpportunities],
    (item) => `${item.title} ${item.detail}`,
  );
  const riskResolution = resolveCandidates(
    [...structuredRisks, ...fallbackRisks],
    (item) => item.text,
    semanticRiskKey,
  );

  return {
    opportunities: opportunityResolution.displayed,
    risks: riskResolution.displayed,
    diagnostics: {
      opportunityCandidates: structuredOpportunities.length + fallbackOpportunities.length,
      riskCandidates: structuredRisks.length + fallbackRisks.length,
      opportunityItems: opportunityResolution.diagnostics,
      riskItems: riskResolution.diagnostics,
      usedOpportunityFallback: opportunityResolution.displayed.some((item) => item.isFallback),
      usedRiskFallback: riskResolution.displayed.some((item) => item.isFallback),
    },
  };
}
