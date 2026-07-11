// ─── Workspace Advanced Filters ───────────────────────────────────────────────
// Shared helpers for filtering stock workspace items.
// All functions are pure display-level — they never write to storage.

import { normalizeStockWorkspaceItem } from './workspaceStockItems';

// ─── Per-item matchers ────────────────────────────────────────────────────────

export function itemMatchesSymbol(item, symbol) {
  if (!symbol) return true;
  const q = symbol.trim().toUpperCase();
  if (!q) return true;
  const stock = normalizeStockWorkspaceItem(item);
  if ((stock.symbol || '').toUpperCase() === q) return true;
  // Fallback: symbol appears anywhere in text fields
  const text = [stock.fullNotes, stock.notes, stock.rawSourceText].filter(Boolean).join(' ');
  return text.toUpperCase().includes(q);
}

export function itemMatchesSector(item, sector) {
  if (!sector) return true;
  const stock = normalizeStockWorkspaceItem(item);
  const itemSector = stock.sector || item.sector || item.category || '';
  return itemSector.toLowerCase().includes(sector.toLowerCase());
}

export function itemMatchesSource(item, source) {
  if (!source) return true;
  const stock = normalizeStockWorkspaceItem(item);
  return (
    (stock.sourceTitle || '').includes(source) ||
    (stock.sourceSection || '').includes(source) ||
    (item.sourceTab || '').includes(source)
  );
}

export function itemMatchesSearch(item, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const stock = normalizeStockWorkspaceItem(item);
  return [
    stock.symbol, stock.companyName, stock.sector,
    stock.sentiment, stock.marketStatus,
    stock.sourceTitle, stock.sourceSection, item.sourceTab,
    stock.notes, stock.fullNotes, stock.rawSourceText,
    item.videoTitle, item.channelName,
    ...(item.tags || []),
  ].some(v => v && String(v).toLowerCase().includes(q));
}

export function itemMatchesDate(item, range) {
  if (!range) return true;
  const savedAt = new Date(item.savedAt || 0);
  if (isNaN(savedAt.getTime())) return false;
  const now = new Date();
  switch (range) {
    case 'today':
      return savedAt.toDateString() === now.toDateString();
    case 'week':
      return (now - savedAt) <= 7 * 24 * 60 * 60 * 1000;
    case 'month':
      return savedAt.getMonth() === now.getMonth() &&
             savedAt.getFullYear() === now.getFullYear();
    default:
      return true;
  }
}

// ─── Available values (for populating dropdowns) ──────────────────────────────

export function getAvailableSymbols(items) {
  const seen = new Set();
  items.forEach(item => {
    const stock = normalizeStockWorkspaceItem(item);
    if (stock.symbol) seen.add(stock.symbol.toUpperCase());
  });
  return [...seen].sort();
}

export function getAvailableSectors(items) {
  const seen = new Set();
  items.forEach(item => {
    const stock = normalizeStockWorkspaceItem(item);
    const sec = stock.sector || item.sector || item.category;
    if (sec) seen.add(sec);
  });
  return [...seen].sort();
}

export function getAvailableSources(items) {
  const seen = new Set();
  items.forEach(item => {
    const stock = normalizeStockWorkspaceItem(item);
    const src = stock.sourceTitle || stock.sourceSection;
    if (src) seen.add(src);
    if (item.sourceTab) seen.add(item.sourceTab);
  });
  return [...seen].sort();
}

// ─── Composite filter + history helpers ──────────────────────────────────────

export function getSymbolHistory(items, symbol) {
  const q = (symbol || '').trim().toUpperCase();
  if (!q) return [];
  return items
    .filter(item => itemMatchesSymbol(item, q))
    .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
}

export function filterWorkspaceItems(items, filters = {}) {
  return items.filter(item => {
    if (filters.symbol    && !itemMatchesSymbol(item, filters.symbol))     return false;
    if (filters.sector    && !itemMatchesSector(item, filters.sector))     return false;
    if (filters.source    && !itemMatchesSource(item, filters.source))     return false;
    if (filters.search    && !itemMatchesSearch(item, filters.search))     return false;
    if (filters.dateRange && !itemMatchesDate(item, filters.dateRange))    return false;
    if (filters.sentiment) {
      const stock = normalizeStockWorkspaceItem(item);
      const s = stock.sentiment || null;
      if (filters.sentiment === 'neutral') {
        if (s && s !== 'neutral') return false;
      } else if (s !== filters.sentiment) return false;
    }
    return true;
  });
}
