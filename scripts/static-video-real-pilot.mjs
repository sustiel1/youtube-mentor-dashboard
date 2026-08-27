import { readFileSync } from 'node:fs';
import { loadEnv } from 'vite';
import { normalizeAiAnalysisResult } from '../src/services/videoAnalytics.js';

const VIDEO_ID = '9su_tZfRYrI';
const RECORD_ID = 'local_1787391349973_v4gll';
const TITLE = 'לייב פתיחה לתאריך 21.8.26';
const TRANSCRIPT_URL = `http://127.0.0.1:5184/api/youtube-transcript?v=${VIDEO_ID}&diagnostics=1`;

const env = loadEnv('development', process.cwd(), '');
process.env.ANTHROPIC_API_KEY ||= env.ANTHROPIC_API_KEY;
process.env.VITE_ANTHROPIC_API_KEY ||= env.VITE_ANTHROPIC_API_KEY;
if (!process.env.ANTHROPIC_API_KEY && !process.env.VITE_ANTHROPIC_API_KEY) {
  throw new Error('Anthropic key is unavailable for the production-handler pilot');
}

const transcriptResponse = await fetch(TRANSCRIPT_URL);
if (!transcriptResponse.ok) throw new Error(`Transcript fetch failed: ${transcriptResponse.status}`);
const transcriptPayload = await transcriptResponse.json();
const segments = Array.isArray(transcriptPayload.segments) ? transcriptPayload.segments : [];
if (segments.length === 0) throw new Error('Timestamped transcript is empty');

const timestampedTranscript = segments.map((segment) => {
  const seconds = Math.floor(Number(segment.startSeconds ?? segment.start));
  return `[${seconds}] ${String(segment.text || '').trim()}`;
}).join('\n');

const backendSource = readFileSync(new URL('../backend/analyze-video.function.js', import.meta.url), 'utf8');
const backendModule = { exports: {} };
new Function('module', 'exports', 'require', backendSource)(backendModule, backendModule.exports, () => {
  throw new Error('Unexpected require in production handler');
});
const { handler } = backendModule.exports;
if (typeof handler !== 'function') throw new Error('Production handler export missing');

let capturedUpdate = null;
const fakeRecord = {
  _id: RECORD_ID,
  id: RECORD_ID,
  title: '',
};
const entities = {
  Video: {
    filter: async ({ _id }) => _id === RECORD_ID ? [fakeRecord] : [],
    update: async (id, patch) => {
      if (id !== RECORD_ID) throw new Error('Unexpected fake entity id');
      capturedUpdate = structuredClone(patch);
      return { ...fakeRecord, ...patch };
    },
  },
};

const raw = await handler({
  videoId: RECORD_ID,
  title: '',
  transcript: timestampedTranscript,
  durationSeconds: 0,
  mentor: null,
  category: null,
}, { entities });

const normalized = normalizeAiAnalysisResult(raw);
// Read the actual coverage the production handler reports, rather than
// re-deriving a truncation point locally — this stays correct even if
// TRANSCRIPT_CHAR_LIMIT changes again later. See computeTranscriptCoverage
// in backend/analyze-video.function.js.
const coverage = raw.staticTimeCoverage || null;
const analyzedTranscript = coverage ? timestampedTranscript.slice(0, coverage.analyzedChars) : timestampedTranscript;
const analyzedSegments = segments.filter((segment) => {
  const marker = `[${Math.floor(Number(segment.startSeconds ?? segment.start))}] ${String(segment.text || '').trim()}`;
  return analyzedTranscript.includes(marker);
});

function locateQuote(item) {
  const quote = String(item?.sourceQuote || '').trim();
  const time = Number(item?.estimatedStartSeconds);
  if (!quote || !Number.isFinite(time) || time < 0) return null;
  for (let startIndex = 0; startIndex < analyzedSegments.length; startIndex += 1) {
    for (let width = 1; width <= 10 && startIndex + width <= analyzedSegments.length; width += 1) {
      const window = analyzedSegments.slice(startIndex, startIndex + width);
      const windowText = window.map((segment) => String(segment.text || '').trim()).join(' ');
      if (!windowText.includes(quote)) continue;
      const intervalStart = Number(window[0].startSeconds ?? window[0].start);
      const last = window[window.length - 1];
      const intervalEnd = Number(last.startSeconds ?? last.start) + Number(last.durationSeconds ?? last.duration ?? 0);
      return {
        quote,
        intervalStart,
        intervalEnd,
        timeInsideInterval: time >= intervalStart && time <= intervalEnd,
      };
    }
  }
  return null;
}

const fieldTabs = [
  ['summary', 'keyPoints'],
  ['insights', 'keyInsights'],
  ['useful-knowledge', 'rules'],
  ['useful-knowledge', 'actionItems'],
  ['specialized', 'mistakesToAvoid'],
];
const rows = [];
for (const [tab, field] of fieldTabs) {
  for (const item of Array.isArray(normalized[field]) ? normalized[field] : []) {
    const evidence = item && typeof item === 'object' ? locateQuote(item) : null;
    rows.push({
      tab,
      field,
      text: typeof item === 'string' ? item : String(item?.text || ''),
      timed: Boolean(evidence?.timeInsideInterval),
      item,
      evidence,
    });
  }
}

const accepted = rows.filter((row) => row.timed);
const untimed = rows.filter((row) => !row.timed);
const safeAnalysis = Object.fromEntries(fieldTabs.map(([, field]) => [
  field,
  rows.filter((row) => row.field === field).map((row) => row.timed ? row.item : row.text),
]));

const report = {
  pipeline: {
    handler: 'backend/analyze-video.function.js#handler',
    normalizer: 'src/services/videoAnalytics.js#normalizeAiAnalysisResult',
    provider: raw.provider,
    model: raw.model,
    fakeEntityFilterCalls: 1,
    fakeEntityUpdateCaptured: Boolean(capturedUpdate),
    realStorageWrites: 0,
    outboundRecordMetadata: 0,
  },
  transcript: {
    source: 'youtube-transcript package through /api/youtube-transcript',
    language: transcriptPayload.lang,
    fetchedAt: transcriptPayload.fetchedAt,
    totalSegments: segments.length,
    timestampedSegments: segments.filter((segment) => Number.isFinite(Number(segment.startSeconds ?? segment.start))).length,
    analyzedChars: analyzedTranscript.length,
    analyzedSegments: analyzedSegments.length,
  },
  staticTimeCoverage: coverage,
  acceptedCount: accepted.length,
  untimedCount: untimed.length,
  rows,
  safeAnalysis,
};

console.log(`PILOT_REPORT=${JSON.stringify(report)}`);
