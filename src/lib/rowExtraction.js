/**
 * Extracts stable {tab, field, index, rowPath, text} rows from an analysis
 * object — the same tab/field mapping already used for static-time
 * rendering (see the fieldTabs constant in the earlier pilot scripts).
 *
 * Pure and storage-agnostic: used both to build the outbound annotation
 * request (only row TEXT leaves the app) and to compute fingerprints for
 * sidecar lookups.
 */
import { buildRowPath, fingerprintRowText, normalizeRowText } from './rowTimestampSidecar.js';
import { extractVideoTabItems } from '../config/videoTabsConfig.js';
import { formatInsightDisplayText } from './insightDisplay.js';

export const ROW_FIELD_TABS = [
  ['summary', 'keyPoints'],
  ['insights', 'keyInsights'],
  ['useful-knowledge', 'rules'],
  ['useful-knowledge', 'actionItems'],
  ['specialized', 'mistakesToAvoid'],
];

export function rowTextOf(item) {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return '';

  const insightText = formatInsightDisplayText(item);
  if (insightText) return insightText;

  const directText = [
    item.text,
    item.content,
    item.summary,
    item.point,
    item.rule,
    item.description,
    item.fact,
    item.definition,
    item.setup,
    item.pattern,
    item.name,
  ].find((value) => typeof value === 'string' && value.trim());
  return directText || '';
}

/**
 * Normalizes the same production selectors used by the four supported
 * narrative tabs into the legacy row fields consumed by the sidecar flow.
 * APP, topics, links, notes and tables are deliberately not selected.
 */
export function buildRowTimestampAnalysis(video, marketBriefData = null) {
  if (!video || typeof video !== 'object') return {};
  return {
    keyPoints: extractVideoTabItems(video, 'summary', marketBriefData),
    keyInsights: extractVideoTabItems(video, 'insights', marketBriefData),
    rules: extractVideoTabItems(video, 'useful-knowledge', marketBriefData),
    actionItems: [],
    mistakesToAvoid: extractVideoTabItems(video, 'specialized', marketBriefData),
  };
}

export function isValidRowTimestampYouTubeId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{11}$/.test(value);
}

export function getRowTimestampActionState({ video, youtubeId, analysis }) {
  const hasSavedRecord = Boolean(video?.id || video?._id);
  const validYoutubeId = isValidRowTimestampYouTubeId(youtubeId);
  const rowCount = extractRows(analysis || {}).length;
  const shouldRender = hasSavedRecord && validYoutubeId && rowCount > 0;
  return {
    shouldRender,
    rowCount,
    disabledReason: null,
  };
}

/**
 * Returns one entry per row: { tab, field, index, rowPath, text, fingerprint }.
 * Rows with empty text are skipped (nothing to annotate).
 */
export function extractRows(analysis, fieldTabs = ROW_FIELD_TABS) {
  const rows = [];
  if (!analysis || typeof analysis !== 'object') return rows;
  for (const [tab, field] of fieldTabs) {
    const items = Array.isArray(analysis[field]) ? analysis[field] : [];
    items.forEach((item, index) => {
      const text = rowTextOf(item).trim();
      if (!text) return;
      const rowPath = buildRowPath(tab, field, index);
      rows.push({ tab, field, index, rowPath, text, fingerprint: fingerprintRowText(text), sourceItem: item });
    });
  }
  return rows;
}

/**
 * One canonical identity contract shared by the results dialog and every
 * production row renderer. Legacy row paths remain byte-for-byte compatible
 * with already persisted sidecar entries; presentation order and display
 * substitutions never participate in the canonical fingerprint.
 */
export function buildRowTimestampDescriptors({
  analysis,
  recordId = null,
  youtubeId = null,
  structuredMorningBrief = false,
} = {}) {
  const rows = extractRows(analysis || {});
  const insightFingerprints = new Set(
    rows.filter((row) => row.tab === 'insights').map((row) => row.fingerprint),
  );

  return rows.map((row) => {
    const isStructuredDuplicate = structuredMorningBrief
      && row.tab === 'specialized'
      && insightFingerprints.has(row.fingerprint);
    return {
      recordId,
      youtubeId,
      tab: row.tab,
      section: row.field,
      field: row.field,
      productionRowId: `${row.tab}:${row.field}:${row.index}`,
      legacyRowPath: row.rowPath,
      rowPath: row.rowPath,
      text: row.text,
      canonicalSourceText: row.text,
      displayText: row.text,
      normalizedText: normalizeRowText(row.text),
      fingerprint: row.fingerprint,
      sourceItem: row.sourceItem,
      renderable: !isStructuredDuplicate,
    };
  });
}
