/**
 * Dedicated, annotation-only operation for opt-in row timestamps
 * (WORK-ID YMD-ONDEMAND-ROW-TIMES) — deliberately NOT a rerun of full
 * analysis. The outbound prompt carries only the transcript and the
 * existing visible row texts (with their stable paths); the model may
 * return ONLY timestamp proposals keyed by rowPath — never rewritten row
 * text, never new rows, never content for a row path it wasn't given.
 */
import { verifyTimedNarrativeEvidence } from './timedNarrativeEvidenceGate.js';

export const ROW_TIMESTAMP_SYSTEM_PROMPT = [
  'Return ONLY valid JSON.',
  'Do not wrap the output in Markdown code fences.',
  'Your entire response must be a single JSON object that starts with "{" and ends with "}".',
].join('\n');

export function buildRowTimestampRequestPayload({ transcript, rows, durationSeconds = 0 } = {}) {
  return {
    transcript: String(transcript || ''),
    rows: (Array.isArray(rows) ? rows : []).map((row) => ({
      rowPath: String(row?.rowPath || ''),
      text: String(row?.text || ''),
    })),
    durationSeconds: Number.isFinite(Number(durationSeconds)) ? Number(durationSeconds) : 0,
  };
}

/**
 * rows: [{ rowPath, text }] — the exact, already-existing row texts to
 * annotate. transcriptText: the `[seconds] text` timed transcript.
 */
export function buildRowTimestampPrompt({ transcriptText, rows }) {
  const rowsBlock = rows.map((r) => `${r.rowPath}: ${r.text}`).join('\n');
  return [
    'להלן רשימת שורות טקסט קיימות מניתוח סרטון, ותמלול מתוזמן של אותו סרטון.',
    'המשימה שלך היא לאתר, עבור כל שורה, האם קיים ציטוט מילולי בתמלול שתומך בה — ואם כן, לציין את הזמן.',
    '',
    'אסור בהחלט:',
    '- לשכתב, לקצר או לשנות את טקסט השורה בכל צורה.',
    '- להחזיר שורות חדשות שלא קיבלת.',
    '- להסיק זמן מסדר השורות, מהתקדמות הטקסט או מחלוקת הסרטון לחלונות שווים.',
    '- להמציא ציטוט או זמן שאינו קיים מילולית בתמלול.',
    '',
    'עבור כל שורה שיש לה ראיית זמן מילולית וניתנת להגנה:',
    '- rowPath: העתק בדיוק את המזהה שקיבלת (לדוגמה summary.keyPoints[0]).',
    '- sourceQuote: ציטוט מילולי מדויק מהתמלול (חייב להופיע מילה במילה בתמלול).',
    '- estimatedStartSeconds: מספר שניות, בתוך קטע התמלול שמכיל את הציטוט.',
    '- estimatedEndSeconds: אופציונלי.',
    '- timestampConfidence: מספר בין 0 ל-1.',
    '',
    'עבור שורה שאין לה ראיית זמן ניתנת להגנה — אל תכלול אותה בכלל בתשובה (אל תמציא ערך).',
    '',
    'החזר JSON בפורמט הבא בדיוק:',
    JSON.stringify({
      annotations: [
        { rowPath: '...', sourceQuote: '...', estimatedStartSeconds: 0, estimatedEndSeconds: null, timestampConfidence: 0.9 },
      ],
    }, null, 2),
    '',
    'שורות לניתוח:',
    rowsBlock,
    '',
    'תמלול מתוזמן:',
    String(transcriptText || '').trim(),
  ].join('\n');
}

/**
 * Verifies each raw annotation the model returned against:
 *  1. It references a rowPath we actually asked about (rejects invented
 *     paths outright — the model cannot introduce a new row).
 *  2. The Evidence Gate (literal quote, inside the matching transcript
 *     window) — same verifyTimedNarrativeEvidence used by the main
 *     Evidence Gate, no relaxed thresholds.
 *
 * Returns { accepted: [...], rejected: [...] } — rejected entries carry a
 * `reason` for reporting; nothing here ever touches row TEXT.
 */
export function applyEvidenceGateToRowAnnotations(rawAnnotations, rows, segments) {
  const rowsByPath = new Map(rows.map((r) => [r.rowPath, r]));
  const accepted = [];
  const rejected = [];

  const list = Array.isArray(rawAnnotations) ? rawAnnotations : [];
  for (const raw of list) {
    const rowPath = raw?.rowPath;
    const row = rowsByPath.get(rowPath);
    if (!row) {
      rejected.push({ rowPath: rowPath || null, reason: 'unknown-row-path', raw });
      continue;
    }
    const evidence = verifyTimedNarrativeEvidence(
      { estimatedStartSeconds: raw.estimatedStartSeconds, sourceQuote: raw.sourceQuote },
      segments
    );
    if (!evidence.verified) {
      rejected.push({ rowPath, reason: evidence.reason || 'no-time-claim', raw });
      continue;
    }
    accepted.push({
      rowPath,
      fingerprint: row.fingerprint,
      estimatedStartSeconds: raw.estimatedStartSeconds,
      estimatedEndSeconds: Number.isFinite(Number(raw.estimatedEndSeconds)) ? Number(raw.estimatedEndSeconds) : null,
      timestampConfidence: raw.timestampConfidence ?? null,
      sourceQuote: raw.sourceQuote,
      rowText: row.text,
      tab: row.tab,
      field: row.field,
    });
  }

  return { accepted, rejected };
}
