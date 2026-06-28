/**
 * Morning Brief news normalization — defensive parsing for strings and objects.
 * Presentation only; does not mutate stored GEM data.
 */

import { resolveTone, TONE } from '@/lib/morningBriefVisuals';

export const MAX_NEWS_ITEMS = 6;
export const COLLAPSED_NEWS_ITEMS = 3;

const INTERNAL_NEWS_FIELD_RE = /^[a-z][a-zA-Z0-9]*:\s*/;

const TAG_INFERENCE = [
  { tag: 'מאקרו', re: /מאקרו|macro|פדרל|\bfed\b|ריבית|cpi|אינפלציה/i },
  { tag: 'טכנולוגיה', re: /טכנולוג|technology|\btech\b|nasdaq|בינה מלאכותית|\bai\b/i },
  { tag: 'אג״ח', re: /אג"ח|אג״ח|bond|treasury|אוצר/i },
  { tag: 'סקטורים', re: /סקטור|sector|רוטציה/i },
  { tag: 'דולר', re: /דולר|\bdxy\b|dollar|מט"ח|מט״ח/i },
  { tag: 'ראסל 2000', re: /ראסל|russell|\brty\b|\biwm\b/i },
  { tag: 'אנרגיה', re: /אנרגיה|energy|\boil\b|נפט|גז/i },
  { tag: 'גיאופוליטי', re: /גיאופוליט|geopolit|מלחמה|סנקצ/i },
];

function stripInternalFieldLabels(text) {
  const raw = String(text || '').trim();
  if (!raw) return raw;
  if (raw.includes(' | ')) {
    return raw
      .split(' | ')
      .map((part) => stripInternalFieldLabels(part))
      .filter(Boolean)
      .join(' · ');
  }
  let s = raw;
  while (INTERNAL_NEWS_FIELD_RE.test(s)) {
    s = s.replace(INTERNAL_NEWS_FIELD_RE, '').trim();
  }
  return s;
}

function safeString(val) {
  if (val == null) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return '';
}

function pickString(obj, ...keys) {
  for (const key of keys) {
    const v = safeString(obj?.[key]);
    if (v) return v;
  }
  return '';
}

function firstSentence(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const dashIdx = raw.indexOf(' — ');
  if (dashIdx > 0 && dashIdx <= 140) return raw.slice(0, dashIdx).trim();
  const punct = raw.match(/^[^.!?…]+[.!?…]?/u);
  if (punct?.[0] && punct[0].length <= 160) return punct[0].trim();
  if (raw.length > 120) return `${raw.slice(0, 117).trim()}…`;
  return raw;
}

function summarizeLine(text, impact = '') {
  const raw = stripInternalFieldLabels(String(text || '').trim());
  if (!raw) return '';
  const impactClean = stripInternalFieldLabels(impact);
  let summary = raw;
  if (impactClean && summary.includes(impactClean)) {
    summary = summary.replace(impactClean, '').trim();
  }
  summary = summary.replace(/^השפעה על השוק\s*:\s*/i, '').trim();
  if (summary.length > 160) return `${summary.slice(0, 157).trim()}…`;
  return summary;
}

function extractImpactFromText(text) {
  const raw = stripInternalFieldLabels(String(text || '').trim());
  if (!raw) return '';
  const labeled = raw.match(/השפעה על השוק\s*:\s*(.+)$/i);
  if (labeled?.[1]) return labeled[1].trim();
  const impactField = raw.match(/(?:impact|marketImpact|effect)\s*:\s*(.+)$/i);
  if (impactField?.[1]) return impactField[1].trim();
  return '';
}

export function normalizeNewsSentiment(raw, contextText = '') {
  const s = safeString(raw).toLowerCase();
  if (/חיוב|bull|positive|שורי/.test(s)) return 'positive';
  if (/שליל|bear|negative|דובי/.test(s)) return 'negative';
  if (/ניטרל|neutral|כללי/.test(s)) return 'neutral';
  const tone = resolveTone(contextText || s);
  if (tone === TONE.BULLISH) return 'positive';
  if (tone === TONE.BEARISH) return 'negative';
  return 'neutral';
}

function collectExplicitTags(item) {
  const tags = [];
  const raw = item?.tags ?? item?.categories ?? item?.labels;
  if (Array.isArray(raw)) {
    for (const t of raw) {
      const s = safeString(t);
      if (s) tags.push(s);
    }
  } else if (typeof raw === 'string') {
    for (const part of raw.split(/[,،|]/)) {
      const s = part.trim();
      if (s) tags.push(s);
    }
  }
  return tags;
}

function inferTags(text, explicit = []) {
  const tags = [];
  const seen = new Set();
  for (const t of explicit) {
    const s = stripInternalFieldLabels(safeString(t));
    if (s && !seen.has(s)) {
      tags.push(s);
      seen.add(s);
    }
  }
  for (const { tag, re } of TAG_INFERENCE) {
    if (tags.length >= 3) break;
    if (seen.has(tag)) continue;
    if (re.test(text)) {
      tags.push(tag);
      seen.add(tag);
    }
  }
  return tags.slice(0, 3);
}

function normalizeFromString(raw) {
  const cleaned = stripInternalFieldLabels(raw);
  if (!cleaned) return null;

  const dashIdx = cleaned.indexOf(' — ');
  let headline;
  let body;
  if (dashIdx !== -1) {
    headline = cleaned.slice(0, dashIdx).trim();
    body = cleaned.slice(dashIdx + 3).trim();
  } else {
    headline = firstSentence(cleaned);
    body = cleaned.slice(headline.length).trim().replace(/^[.!?…\s—-]+/u, '');
  }

  const impact = extractImpactFromText(body) || extractImpactFromText(cleaned);
  const summary = summarizeLine(body, impact);

  return {
    title: headline,
    summary,
    sentiment: normalizeNewsSentiment('', cleaned),
    impact,
    tags: inferTags(cleaned),
    saveText: cleaned,
  };
}

function normalizeFromObject(item) {
  const title = pickString(item, 'title', 'headline', 'name');
  const summaryRaw = pickString(item, 'summary', 'description', 'note', 'content');
  const impact = pickString(item, 'impact', 'marketImpact', 'effect', 'market_effect')
    || extractImpactFromText(summaryRaw);

  const contextForTone = [title, summaryRaw, impact].filter(Boolean).join(' ');
  let sentimentField = pickString(item, 'sentiment', 'status', 'tone');
  const valueField = safeString(item.value);
  if (!sentimentField && valueField.length > 0 && valueField.length < 40) {
    sentimentField = valueField;
  }

  let titleFinal = stripInternalFieldLabels(title);
  let summaryFinal = stripInternalFieldLabels(summaryRaw);
  if (!titleFinal && summaryFinal) {
    titleFinal = firstSentence(summaryFinal);
    summaryFinal = summaryFinal.slice(titleFinal.length).trim().replace(/^[.!?…\s—-]+/u, '');
  }
  if (!titleFinal) return null;

  return {
    title: titleFinal,
    summary: summarizeLine(summaryFinal, impact),
    sentiment: normalizeNewsSentiment(sentimentField, contextForTone),
    impact: stripInternalFieldLabels(impact),
    tags: inferTags([titleFinal, summaryFinal, impact].join(' '), collectExplicitTags(item)),
    saveText: [titleFinal, summaryFinal, impact].filter(Boolean).join(' — '),
  };
}

/** Normalize raw news items into structured card rows. */
export function normalizeNewsItems(items) {
  const safe = Array.isArray(items) ? items.filter(Boolean) : [];
  const out = [];
  const seen = new Set();

  for (const item of safe) {
    let normalized = null;
    if (typeof item === 'string') normalized = normalizeFromString(item);
    else if (typeof item === 'object') normalized = normalizeFromObject(item);
    else normalized = normalizeFromString(String(item));

    if (!normalized?.title) continue;
    const sig = normalized.saveText.slice(0, 160);
    if (!sig || seen.has(sig)) continue;
    seen.add(sig);
    out.push({ ...normalized, id: sig });
  }

  return out;
}
