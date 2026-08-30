// ─── Saved Market Rows — parse flat text back into columns (display-only) ──────
// Individually-saved "indices" rows are persisted only as the flat
// "<asset> · <trend> · <strength> · <comment>" blob produced by
// MorningBriefMarketsTable's formatRowText (asset/trend/strength/comment are
// NOT kept as fields). This best-effort parser restores that structure at
// render time for SavedMarketRowsTable. It NEVER writes back to storage.
//
// Fragility is expected and accepted (see task Path A): saved blobs have
// inconsistent ordering ("0.8% · DOW"), asset-only rows ("BONDS10Y"), and
// trend words embedded in prose. Parsing stays conservative — unresolved parts
// fall through to the comment, and a row with no identifiable asset and no
// " · " structure returns null so the caller can render it as plain text.

import { isTickerLike, inferSentimentFromText } from '@/utils/workspaceStockItems';
import { resolveMarketAssetProviderLinks } from '@/lib/marketAssetProviderLinks';

const TREND_RE = /^(עולה|עולות|עלייה|עליות|יורד|יורדת|ירידה|ירידות|נפילה|נחלש|מתחזק|מזנק|צונח|דשדוש|מדשדש|שטוח|יציב|ללא שינוי|מעורב|צידי|ניטרלי|נייטרלי|בוליש|ביריש|bullish|bearish|neutral)$/i;

const STRENGTH_NUMERIC_RE = /^[+\-]?\d+(?:[.,]\d+)?\s*%$/;
const STRENGTH_WORD_RE = /^(חזקה?|חלשה?|בינונית?|מתונה?|נמוכה?|גבוהה?|מאוד\s+\S+|קלה?)$/;

function looksLikeAsset(part) {
  const value = String(part || '').trim();
  if (!value) return false;
  if (isTickerLike(value.toUpperCase())) return true;
  return Boolean(resolveMarketAssetProviderLinks(value));
}

/**
 * @param {string} text  flat " · "-joined market row text
 * @returns {{asset: string|null, trend: string|null, strength: string|null, comment: string|null} | null}
 */
export function parseMarketRowFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const parts = text.split(' · ').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  // asset: first of the first two segments that resolves as a market asset
  // (covers both "SPX · ..." and the reversed "0.8% · DOW").
  let assetIdx = -1;
  for (let i = 0; i < Math.min(parts.length, 2); i += 1) {
    if (looksLikeAsset(parts[i])) { assetIdx = i; break; }
  }
  if (assetIdx === -1 && parts.length < 2) return null;

  const asset = assetIdx >= 0 ? parts[assetIdx].trim().toUpperCase() : null;
  const rest = parts.filter((_, i) => i !== assetIdx);

  let trend = null;
  let strength = null;
  const commentParts = [];
  for (const part of rest) {
    if (!trend && TREND_RE.test(part)) { trend = part; continue; }
    if (!strength && (STRENGTH_NUMERIC_RE.test(part) || STRENGTH_WORD_RE.test(part))) { strength = part; continue; }
    commentParts.push(part);
  }

  const comment = commentParts.join(' · ') || null;
  // Fill a missing trend from the comment tone only when it is otherwise empty —
  // keeps the pill useful for "VIX · עולה במקביל לעליית המדדים" style rows.
  if (!trend && comment) {
    const inferred = inferSentimentFromText(comment);
    if (inferred === 'positive') trend = 'עולה';
    else if (inferred === 'negative') trend = 'יורד';
  }

  return { asset, trend, strength, comment };
}
