function asText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function serializable(value, depth = 0) {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (depth >= 3) return null;
  if (Array.isArray(value)) {
    return value.map((entry) => serializable(entry, depth + 1)).filter((entry) => entry != null);
  }
  if (typeof value !== 'object') return null;
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entry]) => [key, serializable(entry, depth + 1)])
      .filter(([, entry]) => entry != null),
  );
}

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = asText(value);
    if (!text) continue;
    for (const part of text.split(/[,|]/).map((entry) => entry.trim()).filter(Boolean)) {
      const key = part.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(part);
    }
  }
  return out;
}

function collectSymbols(raw = {}) {
  const candidates = [
    raw.symbols,
    raw.tickers,
    raw.relatedSymbols,
    raw.relatedTickers,
    raw.affectedStocks,
    raw.stocks,
    raw.assets,
    raw.symbol,
    raw.ticker,
  ].flatMap((value) => Array.isArray(value) ? value : [value]);
  return uniqueStrings(candidates.map((value) => (
    value && typeof value === 'object'
      ? value.symbol || value.ticker || value.asset || value.name
      : value
  )));
}

function collectLinks(raw = {}) {
  const candidates = [
    raw.links,
    raw.urls,
    raw.sourceLinks,
    raw.references,
    raw.url,
    raw.link,
    raw.sourceUrl,
    raw.articleUrl,
  ].flatMap((value) => Array.isArray(value) ? value : [value]);
  const out = [];
  const seen = new Set();
  for (const candidate of candidates) {
    if (!candidate) continue;
    const clean = serializable(candidate);
    const url = typeof clean === 'string'
      ? clean.trim()
      : asText(clean?.url || clean?.href || clean?.link);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(clean);
  }
  return out;
}

/** Canonical structured metadata carried with one selectable Morning Brief news row. */
export function buildNewsSelectionMetadata(normalizedItem = {}) {
  const raw = normalizedItem.sourceItem && typeof normalizedItem.sourceItem === 'object'
    ? normalizedItem.sourceItem
    : {};
  const description = asText(raw.description || raw.summary || raw.note) || asText(normalizedItem.summary);
  const content = asText(raw.content || raw.details || raw.body) || description;
  const sourceMetadata = serializable({
    source: raw.source,
    sourceName: raw.sourceName,
    publisher: raw.publisher,
    author: raw.author,
    publishedAt: raw.publishedAt || raw.published_at,
    date: raw.date,
    url: raw.sourceUrl || raw.articleUrl || raw.url || raw.link,
  });

  return {
    title: asText(normalizedItem.title),
    description,
    content,
    sentiment: asText(raw.sentiment || raw.tone) || asText(normalizedItem.sentiment),
    impact: asText(normalizedItem.impact || raw.impact || raw.marketImpact || raw.effect),
    symbols: collectSymbols(raw),
    links: collectLinks(raw),
    tags: uniqueStrings(normalizedItem.tags || []),
    sourceMetadata,
  };
}

/** Additive persisted fields for a selected news draft; other item types are untouched. */
export function buildWorkspaceNewsFields(item = {}) {
  if (item.type !== 'market-news' || !item.newsMetadata) return {};
  const metadata = serializable(item.newsMetadata) || {};
  const text = asText(item.text);
  return {
    newsTitle: asText(metadata.title) || null,
    newsDescription: asText(metadata.description) || null,
    newsContent: asText(metadata.content) || null,
    sentiment: asText(metadata.sentiment) || null,
    impact: asText(metadata.impact) || null,
    symbols: Array.isArray(metadata.symbols) ? metadata.symbols : [],
    links: Array.isArray(metadata.links) ? metadata.links : [],
    sourceMetadata: metadata.sourceMetadata || {},
    rawSourceText: text,
    identityPayload: { text, ...metadata },
  };
}
