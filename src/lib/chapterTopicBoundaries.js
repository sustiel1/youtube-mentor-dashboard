/**
 * Lightweight topic-boundary detection for local transcript chapter generation.
 * Phase 2 — heuristic only, not AI. Falls back to equal-chunk splitting when weak.
 */

import {
  buildTranscriptChunkTitle,
  stripTranscriptNoiseMarkers,
} from '@/lib/chapterTitleUtils';

const MIN_CHAPTER_SECONDS = 90;
const MIN_BOUNDARY_SCORE = 3;

const TRANSITION_PHRASE_RE = [
  /\bעכשיו\b/u,
  /\bנעבור\b/u,
  /\bבואו נדבר\b/u,
  /\bהנושא הבא\b/u,
  /\bנמשיך ל[\u0590-\u05FF]/u,
  /\bלעבור ל[\u0590-\u05FF]/u,
  /\bmoving on\b/i,
  /\bnow let's talk\b/i,
  /\blet's move on\b/i,
  /\bnext topic\b/i,
  /\bturning to\b/i,
  /\bin terms of\b/i,
];

export const MACRO_THEMES = [
  { id: 'fed', titleHe: 'מדיניות הפד ושינויי ריבית', patterns: [/\bfed\b/i, /federal reserve/i, /\bהפד\b/u, /fomc/i, /ריבית/u, /interest rate/i, /rate cut/i, /rate hike/i] },
  { id: 'inflation', titleHe: 'אינפלציה ולחצי מחירים בשוק', patterns: [/inflation/i, /אינפלציה/u, /\bcpi\b/i, /ppi\b/i, /מדד המחירים/u] },
  { id: 'yields', titleHe: 'תשואות אג״ח ועקום התשואות', patterns: [/yield/i, /treasury/i, /תשואות/u, /אגח/u, /bond market/i, /10-year/i, /2-year/i] },
  { id: 'realestate', titleHe: 'שוק הנדל״ן ומחירי דיור', patterns: [/real estate/i, /housing/i, /נדלן/u, /נדל״ן/u, /mortgage/i, /משכנת/u] },
  { id: 'biotech', titleHe: 'מגמות בביוטק ומניות צמיחה', patterns: [/biotech/i, /ביוטק/u, /pharma/i, /פארמה/u, /clinical trial/i] },
  { id: 'banks', titleHe: 'מגזר הבנקים ומניות פיננסים', patterns: [/\bbanks?\b/i, /בנקים/u, /financials/i, /credit/i, /אשראי/u] },
  { id: 'technology', titleHe: 'מגזר הטכנולוגיה ומניות צמיחה', patterns: [/\btech\b/i, /technology/i, /טכנולוגיה/u, /nasdaq/i, /semiconductor/i, /ai stocks/i] },
  { id: 'labor', titleHe: 'שוק העבודה ונתוני תעסוקה', patterns: [/labor market/i, /payroll/i, /unemployment/i, /שוק עבודה/u, /אבטלה/u, /תעסוקה/u, /jobs report/i] },
  { id: 'equities', titleHe: 'מגמות מדדים ושוק המניות', patterns: [/\bs&p\b/i, /\bnasdaq\b/i, /\bdow\b/i, /מדד/u, /stock market/i, /equities/i, /rally/i] },
  { id: 'energy', titleHe: 'אנרגיה ומחירי נפט בשוק', patterns: [/\boil\b/i, /crude/i, /energy sector/i, /נפט/u, /אנרגיה/u, /\bwti\b/i] },
];

const TICKER_STOP = new Set([
  'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT',
  'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'WAY', 'WHO',
  'DID', 'LET', 'SAY', 'SHE', 'TOO', 'USE', 'USD', 'GDP', 'EPS', 'CEO', 'IPO', 'ETF', 'ATH', 'FED',
  'SEC', 'CPI', 'PPI', 'GDP', 'YES', 'LOT', 'BIG', 'TOP', 'LOW', 'HIGH', 'PUT', 'CALL', 'BUY', 'SELL',
]);

function lineStartSeconds(line) {
  const s = Number(line?.start ?? line?.startSeconds ?? 0);
  return Number.isFinite(s) && s >= 0 ? s : 0;
}

export function extractTickers(text) {
  const found = new Set();
  const raw = String(text || '');
  (raw.match(/\$[A-Z]{1,5}\b/g) || []).forEach((t) => found.add(t.replace('$', '')));
  (raw.match(/\b[A-Z]{2,5}\b/g) || []).forEach((t) => {
    if (!TICKER_STOP.has(t)) found.add(t);
  });
  return [...found];
}

export function detectMacroThemes(text) {
  const raw = String(text || '');
  return MACRO_THEMES.filter((theme) => theme.patterns.some((p) => p.test(raw)));
}

export function computeTopicChapterTarget(durationSeconds) {
  const d = Number(durationSeconds);
  if (!Number.isFinite(d) || d <= 0) return 5;
  if (d < 15 * 60) return 4;
  if (d < 30 * 60) return 5;
  if (d < 60 * 60) return 7;
  return 8;
}

function scoreLineForBoundary(line, windowMacroIds, windowTickers) {
  const text = stripTranscriptNoiseMarkers(line?.text || '');
  let score = 0;
  const signals = { transition: false, macroShift: null, tickers: [] };

  if (!text) return { score: 0, signals };

  if (TRANSITION_PHRASE_RE.some((re) => re.test(text))) {
    score += 4;
    signals.transition = true;
  }

  const lineMacros = detectMacroThemes(text);
  const newMacro = lineMacros.find((m) => !windowMacroIds.has(m.id));
  if (newMacro) {
    score += 3;
    signals.macroShift = newMacro;
  }

  const lineTickers = extractTickers(text);
  const newTickers = lineTickers.filter((t) => !windowTickers.has(t));
  if (newTickers.length > 0) {
    score += 2;
    signals.tickers = newTickers.slice(0, 3);
  }

  return { score, signals };
}

export function detectTopicBoundaries(lines, durationSeconds) {
  if (!Array.isArray(lines) || lines.length < 12) return null;

  const target = computeTopicChapterTarget(durationSeconds);
  const windowSize = 12;
  const candidates = [];

  for (let i = 1; i < lines.length; i += 1) {
    const sliceStart = Math.max(0, i - windowSize);
    const slice = lines.slice(sliceStart, i);
    const windowMacroIds = new Set(slice.flatMap((l) => detectMacroThemes(l.text).map((m) => m.id)));
    const windowTickers = new Set(slice.flatMap((l) => extractTickers(l.text)));

    const { score, signals } = scoreLineForBoundary(lines[i], windowMacroIds, windowTickers);
    if (score >= MIN_BOUNDARY_SCORE) {
      candidates.push({
        lineIndex: i,
        startSeconds: lineStartSeconds(lines[i]),
        score,
        signals,
      });
    }
  }

  const selected = [{
    lineIndex: 0,
    startSeconds: lineStartSeconds(lines[0]),
    score: 1000,
    signals: {},
  }];

  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  for (const candidate of ranked) {
    if (selected.length >= target) break;
    const tooClose = selected.some(
      (s) => Math.abs(candidate.startSeconds - s.startSeconds) < MIN_CHAPTER_SECONDS,
    );
    if (!tooClose) selected.push(candidate);
  }

  selected.sort((a, b) => a.startSeconds - b.startSeconds);

  if (selected.length < 3) return null;
  return selected;
}

function countTitleWords(title) {
  return String(title || '').split(/\s+/).filter(Boolean).length;
}

export function isQualityTopicTitle(title, context = {}) {
  const words = countTitleWords(title);
  if (words < 4 || words > 9) return false;
  if (context.macroId || (context.tickers?.length ?? 0) > 0) return true;
  if (detectMacroThemes(title).length > 0) return true;
  if (extractTickers(title).length > 0) return true;
  return /אינפלציה|ריבית|מדד|בנק|טכנולוגיה|נדלן|תשואות|הפד|בורסה|שוק|מניות|ביוטק/u.test(title);
}

function fitHebrewTitleWords(title) {
  const words = String(title || '').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 4 && words.length <= 9) return words.join(' ');
  if (words.length < 4) {
    return [...words, 'בשוק', 'ההון', 'והמאקרו'].slice(0, 4).join(' ');
  }
  return words.slice(0, 9).join(' ');
}

function dominantMacroInText(text) {
  const counts = new Map();
  for (const theme of detectMacroThemes(text)) {
    counts.set(theme.id, (counts.get(theme.id) || 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = MACRO_THEMES.find((m) => m.id === id) || null;
    }
  }
  return best;
}

export function buildTopicChapterTitle(segmentText, boundary, segmentIndex, videoTitle, usedMacroIds = new Set()) {
  const cleaned = stripTranscriptNoiseMarkers(segmentText);

  if (boundary?.signals?.macroShift?.titleHe) {
    const mId = boundary.signals.macroShift.id;
    if (!usedMacroIds.has(mId)) {
      usedMacroIds.add(mId);
      return fitHebrewTitleWords(boundary.signals.macroShift.titleHe);
    }
    // Same macro theme already used — fall through to ticker / dominant / fallback
  }

  if (boundary?.signals?.tickers?.length) {
    const tickers = boundary.signals.tickers.slice(0, 2).join(' ו');
    return fitHebrewTitleWords(`ניתוח מניות ${tickers} ומגמות שוק`);
  }

  const dominant = dominantMacroInText(cleaned);
  if (dominant && !usedMacroIds.has(dominant.id)) {
    usedMacroIds.add(dominant.id);
    return fitHebrewTitleWords(dominant.titleHe);
  }

  const tickers = extractTickers(cleaned);
  if (tickers.length > 0) {
    return fitHebrewTitleWords(`דיון ב${tickers[0]} ותנועות מחיר`);
  }

  if (boundary?.signals?.transition) {
    return fitHebrewTitleWords('מעבר לנושא חדש בסקירת השוק');
  }

  const fallback = videoTitle
    ? `פרק ${segmentIndex + 1} בנושא ${String(videoTitle).slice(0, 28)}`
    : `פרק ${segmentIndex + 1} בסקירת שוק ההון`;
  return fitHebrewTitleWords(fallback);
}

function segmentTextFromLines(lines, startIdx, endIdx) {
  return stripTranscriptNoiseMarkers(
    lines
      .slice(startIdx, endIdx)
      .map((l) => l.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

export function buildChaptersFromBoundaries(lines, boundaries, video, durationSeconds) {
  const dur = Number.isFinite(durationSeconds) && durationSeconds > 0
    ? durationSeconds
    : lineStartSeconds(lines[lines.length - 1]);

  const usedMacroIds = new Set();

  const chapters = boundaries.map((boundary, index) => {
    const next = boundaries[index + 1];
    const startIdx = boundary.lineIndex;
    const endIdx = next ? next.lineIndex : lines.length;
    const blob = segmentTextFromLines(lines, startIdx, endIdx);
    const startSeconds = Math.floor(boundary.startSeconds);
    const endSeconds = next
      ? Math.floor(next.startSeconds)
      : Math.floor(dur);

    const title = buildTopicChapterTitle(blob, boundary, index, video?.title, usedMacroIds);
    const topicContext = {
      macroId: boundary.signals?.macroShift?.id || dominantMacroInText(blob)?.id || null,
      tickers: boundary.signals?.tickers?.length
        ? boundary.signals.tickers
        : extractTickers(blob).slice(0, 3),
    };

    return {
      title,
      description: blob.length > 220 ? `${blob.slice(0, 217)}…` : blob,
      startSeconds,
      endSeconds: Number.isFinite(endSeconds) && endSeconds >= startSeconds ? endSeconds : null,
      timestamp: formatMmSs(startSeconds),
      timeSource: 'transcript',
      chapterSource: 'transcript_topic_heuristic',
      boundaryMethod: 'topic',
      _topicContext: topicContext,
    };
  });

  return applyChapterQualityRules(chapters, dur);
}

export function applyChapterQualityRules(chapters, durationSeconds) {
  let list = Array.isArray(chapters) ? [...chapters] : [];
  if (list.length === 0) return [];

  const maxChapters = computeTopicChapterTarget(durationSeconds) + 1;
  if (list.length > maxChapters) {
    list = list.slice(0, maxChapters);
  }

  const merged = [];
  for (let i = 0; i < list.length; i += 1) {
    const cur = list[i];
    const next = list[i + 1];
    const end = Number.isFinite(cur.endSeconds)
      ? cur.endSeconds
      : (next ? next.startSeconds : durationSeconds);
    const duration = end - cur.startSeconds;

    if (duration < MIN_CHAPTER_SECONDS && next && merged.length > 0) {
      const prev = merged[merged.length - 1];
      prev.description = [prev.description, cur.description, next.description].filter(Boolean).join(' ');
      prev.endSeconds = next.endSeconds;
      prev.title = buildTopicChapterTitle(
        `${prev.description || ''} ${next.description || ''}`,
        next,
        merged.length - 1,
        null,
      );
      i += 1;
      continue;
    }

    merged.push(cur);
  }

  return merged
    .filter((ch) => isQualityTopicTitle(ch.title, ch._topicContext))
    .map(({ _topicContext, ...ch }) => ch);
}

function formatMmSs(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function tryTopicDrivenChapters(lines, video, durationSeconds) {
  const boundaries = detectTopicBoundaries(lines, durationSeconds);
  if (!boundaries) return null;

  const built = buildChaptersFromBoundaries(lines, boundaries, video, durationSeconds);
  if (built.length < 3) return null;

  return {
    chapters: built,
    chapterSource: 'transcript_topic_heuristic',
    analysisQuality: 'medium',
    boundaryMethod: 'topic',
  };
}

export function buildEqualChunkChapters(lines, video) {
  const fullText = lines.map((l) => l.text).join(' ');
  if (fullText.length < 400) return null;

  const nTarget = Math.min(6, Math.max(4, Math.round(lines.length / 40)));
  const chunk = Math.ceil(lines.length / nTarget);
  const chapters = [];

  for (let i = 0; i < nTarget; i += 1) {
    const slice = lines.slice(i * chunk, (i + 1) * chunk);
    if (!slice.length) continue;
    const start = lineStartSeconds(slice[0]);
    const blob = stripTranscriptNoiseMarkers(
      slice.map((l) => l.text).join(' ').replace(/\s+/g, ' ').trim(),
    );
    if (!blob || blob.length < 20) continue;
    chapters.push({
      title: buildTranscriptChunkTitle(blob, i, video?.title),
      description: blob.length > 220 ? `${blob.slice(0, 217)}…` : blob,
      timestamp: formatMmSs(start),
      startSeconds: Math.floor(start),
      timeSource: 'transcript',
      chapterSource: 'transcript_heuristic',
      boundaryMethod: 'chunk',
      analysisQuality: 'low',
    });
  }

  if (chapters.length < 2) return null;
  return {
    chapters,
    chapterSource: 'transcript_heuristic',
    analysisQuality: 'low',
    boundaryMethod: 'chunk',
  };
}
