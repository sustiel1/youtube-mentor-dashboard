import assetAliases from '../../shared/marketAssetAliases.json';
import {
  EN_CARD_COMPANY_ALIASES,
  HE_CARD_COMPANY_ALIASES,
} from '@/utils/finvizLinks';
import { getMarketAssetDestination } from './marketAssetDestinations';

const TOKEN_CHARACTER = /[\p{L}\p{N}_]/u;

function hasValidBoundaries(text, start, length) {
  const before = start > 0 ? text[start - 1] : '';
  const afterIndex = start + length;
  const after = afterIndex < text.length ? text[afterIndex] : '';
  return (!before || !TOKEN_CHARACTER.test(before)) &&
    (!after || !TOKEN_CHARACTER.test(after));
}

const TEXT_ALIASES = Object.freeze([
  ...Object.entries(assetAliases),
  ...EN_CARD_COMPANY_ALIASES,
  ...HE_CARD_COMPANY_ALIASES,
]
  .map(([alias, identity]) => [String(alias).trim(), String(identity).trim()])
  .filter(([alias, identity]) => alias && identity)
  .sort((a, b) => b[0].length - a[0].length));

function collectAliasMatches(text) {
  const foldedText = text.toLocaleUpperCase('en-US');
  const matches = [];

  for (const [alias, identity] of TEXT_ALIASES) {
    const foldedAlias = alias.toLocaleUpperCase('en-US');
    let from = 0;
    while (from < text.length) {
      const start = foldedText.indexOf(foldedAlias, from);
      if (start === -1) break;
      if (hasValidBoundaries(text, start, alias.length)) {
        const destination = getMarketAssetDestination(identity);
        if (destination) {
          matches.push({ start, end: start + alias.length, destination });
        }
      }
      from = start + Math.max(alias.length, 1);
    }
  }
  return matches;
}

function collectTickerMatches(text) {
  const matches = [];
  const tickerPattern = /[A-Z]{1,6}(?:\.[AB])?/g;
  let match;
  while ((match = tickerPattern.exec(text)) !== null) {
    if (!hasValidBoundaries(text, match.index, match[0].length)) continue;
    const destination = getMarketAssetDestination(match[0]);
    if (destination) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        destination,
      });
    }
  }
  return matches;
}

export function segmentMarketLinkText(value) {
  if (typeof value !== 'string' || value.length === 0) return [];

  const candidates = [...collectAliasMatches(value), ...collectTickerMatches(value)]
    .sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const accepted = [];
  let cursor = 0;
  for (const candidate of candidates) {
    if (candidate.start < cursor) continue;
    accepted.push(candidate);
    cursor = candidate.end;
  }

  if (accepted.length === 0) return [{ type: 'text', text: value }];

  const segments = [];
  cursor = 0;
  for (const match of accepted) {
    if (match.start > cursor) {
      segments.push({ type: 'text', text: value.slice(cursor, match.start) });
    }
    segments.push({
      type: 'link',
      text: value.slice(match.start, match.end),
      destination: match.destination,
    });
    cursor = match.end;
  }
  if (cursor < value.length) segments.push({ type: 'text', text: value.slice(cursor) });
  return segments;
}

export const MARKET_TEXT_ALIASES = TEXT_ALIASES;
