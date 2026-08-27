import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import { YoutubeTranscript } from 'youtube-transcript'
import {
  DEFAULT_OBSIDIAN_VAULT_NAME,
  DEFAULT_OBSIDIAN_VAULT_PATH,
  normalizeObsidianVaultPath,
  resolveObsidianVaultSettings,
  stripMigrationPrefixFromRelativePath,
} from './src/lib/obsidianVaultDefaults.js'
import {
  mergeItemsIntoObsidianNote,
  noteContainsItemMarker,
} from './src/lib/obsidianNoteMerge.js'
import {
  parseTimedTranscriptSegments,
  applyTimedNarrativeEvidenceGateToAnalysis,
  computeTranscriptCoverage,
} from './src/lib/timedNarrativeEvidenceGate.js'
import {
  applyEvidenceGateToRowAnnotations,
  buildRowTimestampPrompt,
} from './src/lib/rowTimestampAnnotation.js'
import { fingerprintRowText } from './src/lib/rowTimestampSidecar.js'
import { parseModelJsonSafely } from './src/lib/claudeJsonRepair.js'
import {
  runGemsJsonRepair,
  serializeGemsRepairError,
} from './src/server/gemsJsonRepairProvider.js'

// ─── RSS Proxy Plugin ─────────────────────────────────────────────────────────
// Route: GET /api/rss?channelId=UCxxxxxxxx
// Fetches YouTube RSS from Node (bypasses browser CORS restriction).
// Returns raw XML; parsing happens client-side with DOMParser.
// ─────────────────────────────────────────────────────────────────────────────
function makeRssProxyPlugin() {
  return {
    name: 'rss-proxy',
    configureServer(server) {
      server.middlewares.use('/api/rss', async (req, res) => {
        const urlObj = new URL(req.url, 'http://localhost');
        const channelId = urlObj.searchParams.get('channelId');

        if (!channelId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'MISSING_CHANNEL_ID', message: 'channelId query param required' }));
          return;
        }

        // Validate channel ID format on the server side too
        if (!channelId.startsWith('UC') || channelId.length !== 24) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'INVALID_CHANNEL_ID',
            message: `Channel ID לא תקין: "${channelId}" — חייב להתחיל ב-UC ולהיות 24 תווים`,
          }));
          return;
        }

        const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
        console.log(`[rss-proxy] → ${rssUrl}`);

        try {
          const response = await fetch(rssUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)' },
          });

          console.log(`[rss-proxy] ← ${response.status} (channelId=${channelId})`);

          if (!response.ok) {
            const hint = response.status === 404
              ? `Channel ID "${channelId}" לא נמצא ב-YouTube RSS. URL: ${rssUrl}`
              : `YouTube returned ${response.status}`;
            res.writeHead(response.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'RSS_UPSTREAM_ERROR', message: hint, url: rssUrl }));
            return;
          }

          const xml = await response.text();
          res.writeHead(200, {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'max-age=300',
          });
          res.end(xml);
        } catch (err) {
          console.error(`[rss-proxy] error for ${channelId}:`, err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'RSS_FETCH_FAILED', message: err.message, url: rssUrl }));
        }
      });
    },
  };
}

// ─── Fear & Greed Proxy Plugin ────────────────────────────────────────────────
// Route: GET /api/market/fear-greed
// Dev-only mirror of backend/fetch-fear-greed.function.js — fetches CNN's
// Fear & Greed data feed from Node (CNN returns HTTP 418 without a same-site
// Referer header, and has no CORS allowance for browser calls). Production
// must route the same client-facing path to the deployed Base44 function.
// ─────────────────────────────────────────────────────────────────────────────
function makeFearGreedProxyPlugin() {
  const CNN_FEAR_GREED_ENDPOINT = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
  const FETCH_TIMEOUT_MS = 10_000;

  // Kept in sync with backend/fetch-fear-greed.function.js's INDICATOR_CNN_KEYS —
  // see that file's comment for why _sp500/_vix are used over the _sp125/_vix_50
  // duplicates CNN also exposes.
  const INDICATOR_CNN_KEYS = {
    market_momentum: 'market_momentum_sp500',
    stock_price_strength: 'stock_price_strength',
    stock_price_breadth: 'stock_price_breadth',
    put_call_options: 'put_call_options',
    market_volatility: 'market_volatility_vix',
    safe_haven_demand: 'safe_haven_demand',
    junk_bond_demand: 'junk_bond_demand',
  };

  function toIsoOrNull(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    return null;
  }

  function buildIndicators(data) {
    const indicators = {};
    for (const [id, cnnKey] of Object.entries(INDICATOR_CNN_KEYS)) {
      const entry = data?.[cnnKey];
      const score = Number(entry?.score);
      const rating = typeof entry?.rating === 'string' ? entry.rating : null;
      indicators[id] = Number.isFinite(score) && rating
        ? { score, rating, timestamp: toIsoOrNull(entry?.timestamp) }
        : null;
    }
    return indicators;
  }

  function toFiniteScoreOrNull(value) {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 && num <= 100 ? num : null;
  }

  return {
    name: 'fear-greed-proxy',
    configureServer(server) {
      server.middlewares.use('/api/market/fear-greed', async (req, res) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
          const response = await fetch(CNN_FEAR_GREED_ENDPOINT, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; MarketDataProxy)',
              Accept: 'application/json',
              Referer: 'https://www.cnn.com/markets/fear-and-greed',
            },
            signal: controller.signal,
          });

          console.log(`[fear-greed-proxy] ← ${response.status}`);

          if (!response.ok) {
            res.writeHead(response.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: 'FEAR_GREED_UPSTREAM_ERROR',
              message: `CNN Fear & Greed upstream returned HTTP ${response.status}`,
            }));
            return;
          }

          const data = await response.json();
          const score = Number(data?.fear_and_greed?.score);
          if (!Number.isFinite(score) || score < 0 || score > 100) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: 'FEAR_GREED_INVALID_PAYLOAD',
              message: 'CNN Fear & Greed payload missing a valid score',
            }));
            return;
          }

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          });
          res.end(JSON.stringify({
            fear_and_greed: {
              score,
              timestamp: toIsoOrNull(data?.fear_and_greed?.timestamp),
              previousClose: toFiniteScoreOrNull(data?.fear_and_greed?.previous_close),
              previousWeek: toFiniteScoreOrNull(data?.fear_and_greed?.previous_1_week),
              previousMonth: toFiniteScoreOrNull(data?.fear_and_greed?.previous_1_month),
              previousYear: toFiniteScoreOrNull(data?.fear_and_greed?.previous_1_year),
            },
            indicators: buildIndicators(data),
          }));
        } catch (err) {
          const message = err?.name === 'AbortError'
            ? `CNN Fear & Greed upstream timed out after ${FETCH_TIMEOUT_MS}ms`
            : err.message;
          console.error('[fear-greed-proxy] error:', message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'FEAR_GREED_FETCH_FAILED', message }));
        } finally {
          clearTimeout(timeout);
        }
      });
    },
  };
}

// ─── Channel ID Resolver Plugin ───────────────────────────────────────────────
// Route: GET /api/resolve-channel?handle=@ChannelHandle
// Fetches the YouTube channel page in Node (no CORS) and extracts the channelId
// from the raw HTML using regex. YouTube embeds it in the initial page data.
// ─────────────────────────────────────────────────────────────────────────────
function makeChannelResolverPlugin() {
  return {
    name: 'channel-resolver',
    configureServer(server) {
      server.middlewares.use('/api/resolve-channel', async (req, res) => {
        const urlObj = new URL(req.url, 'http://localhost');
        const handle = urlObj.searchParams.get('handle'); // e.g. "@MichaStocks"

        if (!handle) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'MISSING_HANDLE' }));
          return;
        }

        const channelUrl = handle.startsWith('http')
          ? handle
          : `https://www.youtube.com/${handle.startsWith('@') ? handle : '@' + handle}`;

        try {
          const response = await fetch(channelUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
            },
          });

          if (!response.ok) {
            res.writeHead(response.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'CHANNEL_NOT_FOUND', message: `YouTube returned ${response.status}` }));
            return;
          }

          const html = await response.text();

          // YouTube embeds channelId in several places in the initial JS data
          const patterns = [
            /"channelId":"(UC[\w-]{22})"/,
            /"externalId":"(UC[\w-]{22})"/,
            /\"browseId\":\"(UC[\w-]{22})\"/,
            /channel\/(UC[\w-]{22})/,
          ];

          let channelId = null;
          for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match?.[1]) { channelId = match[1]; break; }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ handle, channelId, url: channelUrl }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'RESOLVE_FAILED', message: err.message }));
        }
      });
    },
  };
}

// ─── Local Gemini Proxy Plugin ────────────────────────────────────────────────
// Runs inside Vite's dev server (Node.js process).
// GEMINI_API_KEY is loaded via loadEnv — NEVER bundled or sent to the browser.
// In production, Base44 backend function handles Gemini (/backend/analyze-video.function.js).
// ─────────────────────────────────────────────────────────────────────────────
// ─── YouTube Transcript Proxy (dev only) ─────────────────────────────────────
// GET /api/youtube-transcript?v=VIDEO_ID
// Uses youtube-transcript package (InnerTube API) — works where timedtext API is blocked.
// Returns { body, segments, lang, fetchedAt } matching fetchTranscriptPayload expectations.
// ─────────────────────────────────────────────────────────────────────────────
function makeYoutubeTranscriptPlugin() {
  return {
    name: 'youtube-transcript-proxy',
    configureServer(server) {
      server.middlewares.use('/api/youtube-transcript', async (req, res) => {
        const urlObj = new URL(req.url, 'http://localhost');
        const v = urlObj.searchParams.get('v');
        if (!v) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'MISSING_V', message: 'v query param required' }));
          return;
        }

        const langs = ['iw', 'he', 'en'];
        console.log(`[transcript-proxy] videoId=${v} provider=youtube-transcript trying langs=${langs.join(',')}`);

        let segments = null;
        let selectedLang = null;

        for (const lang of langs) {
          try {
            const raw = await YoutubeTranscript.fetchTranscript(v, { lang });
            if (Array.isArray(raw) && raw.length > 0) {
              // offset/duration are in milliseconds — convert to seconds
              segments = raw.map(s => ({
                text: String(s.text || '').trim(),
                start: Number(s.offset ?? s.start ?? 0) / 1000,
                duration: Number(s.duration ?? 0) / 1000,
                startSeconds: Number(s.offset ?? s.start ?? 0) / 1000,
                durationSeconds: Number(s.duration ?? 0) / 1000,
              })).filter(s => s.text);
              selectedLang = lang;
              break;
            }
          } catch (err) {
            console.log(`[transcript-proxy] lang=${lang} unavailable: ${err.message?.slice(0, 80)}`);
          }
        }

        if (!segments || segments.length === 0) {
          console.log(`[transcript-proxy] ALL_LANGS_FAILED videoId=${v}`);
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'NO_TRANSCRIPT', message: 'No captions available' }));
          return;
        }

        const body = segments.map(s => s.text).join(' ');
        console.log(`[transcript-proxy] SUCCESS videoId=${v} lang=${selectedLang} segments=${segments.length} bodyLen=${body.length}`);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: true,
          body,
          segments,
          lang: selectedLang,
          fetchedAt: new Date().toISOString(),
        }));
      });
    },
  };
}

// ─── Gemini Video Content Plugin ─────────────────────────────────────────────
// Route: POST /api/gemini-video-content
// Smart input strategy: URL-first analysis, transcript fallback.
// analysisMode: 'smart' (default) | 'url_only' | 'transcript_only'
// ─────────────────────────────────────────────────────────────────────────────
function makeGeminiVideoContentPlugin(env) {
  function isResultSufficient(data) {
    if (!data || typeof data !== 'object') return false;
    const raw = JSON.stringify(data).toLowerCase();
    if (raw.includes('placeholder') || raw.includes('cannot access') || raw.includes('לא יכול לגשת')) return false;
    const hasFullSummary = String(data.fullSummary || '').trim().length > 50;
    const hasKeyPoints  = Array.isArray(data.keyPoints)  && data.keyPoints.filter(Boolean).length >= 2;
    const hasChapters   = Array.isArray(data.chapters)   && data.chapters.length >= 2;
    return hasFullSummary && hasKeyPoints && hasChapters;
  }

  function buildTxText(transcriptText, transcriptSegments) {
    if (Array.isArray(transcriptSegments) && transcriptSegments.length > 0) {
      const seg = transcriptSegments
        .map(s => `[${Math.floor(Number(s.start ?? s.startSeconds ?? 0))}] ${String(s.text || '').trim()}`)
        .filter(s => s.length > 5)
        .join('\n');
      if (seg.length > 200) return seg;
    }
    return typeof transcriptText === 'string' && transcriptText.trim().length > 200
      ? transcriptText.trim()
      : null;
  }

  function buildGeminiAnalysisPrompt({ title, channelName, mentor, category, chaptersTarget, durationSeconds, userNotes, attachedDocumentsMetadata }) {
    const hasAttached = Array.isArray(attachedDocumentsMetadata) && attachedDocumentsMetadata.length > 0;
    const attachedSection = hasAttached ? [
      '',
      '═══ מסמכים מצורפים ═══',
      `המשתמש צירף ${attachedDocumentsMetadata.length} מסמכי PDF לסרטון זה:`,
      ...attachedDocumentsMetadata.map(d => `- ${d.name}${d.pages ? ` (${d.pages} עמ')` : ''}`),
      'המסמכים כלולים בתמלול שלהלן, מסומנים "--- מסמך מצורף: שם ---".',
      'בנוסף לשדות הרגילים, הוסף שדה attachedDocumentsInsights עם ניתוח ייעודי של המסמכים.',
    ] : [];

    // Row timestamps (estimatedStartSeconds/sourceQuote/etc.) are
    // intentionally NOT requested here. Normal analysis must never
    // auto-generate them — that is a separate, explicit, per-video opt-in
    // operation. See WORK-ID YMD-ONDEMAND-ROW-TIMES.
    const narrativeItem = { text: '...' };
    const baseSchema = {
      shortSummary: '2-3 משפטים',
      fullSummary: '4-6 משפטים עם תובנות מעשיות',
      keyPoints: [narrativeItem],
      chapters: [{ title: '...', startSeconds: 0, endSeconds: 120, summary: '...', keyPoints: ['...'] }],
      keyInsights: [narrativeItem],
      actionItems: [narrativeItem],
      rules: [narrativeItem],
      mainLesson: '...',
      strategyOrMethod: '...',
      tags: ['...'],
    };
    const schema = hasAttached
      ? { ...baseSchema, attachedDocumentsInsights: {
          overallSummary: 'סיכום כולל של המסמכים המצורפים ביחס לסרטון',
          keyFindings: ['ממצא מפתח ייחודי מהמסמכים שלא הוזכר בסרטון'],
          supportingEvidence: ['ראיה מהמסמכים שמחזקת נקודה בסרטון'],
          contradictions: ['סתירה בין המסמכים לתוכן הסרטון — ריק אם אין'],
          additionalConcepts: ['מושג שנוסף מהמסמכים מעבר לסרטון'],
        }}
      : baseSchema;

    return [
      'נתח את הסרטון ביסודיות והחזר JSON בלבד, בלי markdown ובלי טקסט נוסף.',
      '',
      '═══ מטרת הניתוח ═══',
      'המטרה: חלץ ידע אישי מקצועי שניתן לעשות בו שימוש חוזר.',
      'שאל: "אם שכחתי לגמרי את הסרטון — מה הייתי רוצה שיישאר?" — זה הידע שצריך לחלץ.',
      '',
      '═══ כללי פרקים ═══',
      `צור בערך ${chaptersTarget || 6} פרקים איכותיים שמכסים את כל הסרטון מההתחלה ועד הסוף.`,
      'כל כותרת פרק חייבת להיות ספציפית. אסור: "פתיח", "סיכום", "פרק 1".',
      'כלול startSeconds ו-endSeconds לכל פרק.',
      'הפרק האחרון חייב להתחיל בשליש האחרון של הסרטון (startSeconds ≥ 65% ממשך הסרטון).',
      'אסור לעצור פרקים באמצע הסרטון — הפרקים חייבים להגיע קרוב לסוף.',
      '',
      '═══ כללי איכות ═══',
      'אסור: "placeholder", ביטויים גנריים.',
      'אם אין חומר לשדה — החזר מערך ריק.',
      'עברית תקינה וברורה.',
      ...attachedSection,
      '',
      `כותרת: ${title}`,
      channelName ? `ערוץ: ${channelName}` : null,
      mentor ? `מנטור: ${mentor}` : null,
      category ? `קטגוריה: ${category}` : null,
      Number.isFinite(Number(durationSeconds)) && Number(durationSeconds) > 0
        ? `משך סרטון בשניות: ${Math.floor(Number(durationSeconds))}`
        : null,
      userNotes ? `הערות: ${userNotes}` : null,
      '',
      'החזר JSON עם השדות הבאים בלבד:',
      JSON.stringify(schema, null, 2),
    ].filter(Boolean).join('\n');
  }

  return {
    name: 'gemini-video-content',
    configureServer(server) {
      server.middlewares.use('/api/gemini-video-content', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
          return;
        }

        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'GEMINI_API_KEY_MISSING', message: 'Add GEMINI_API_KEY to .env' }));
          return;
        }

        let body;
        try {
          body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', chunk => { data += chunk; });
            req.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
            req.on('error', reject);
          });
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_BODY' }));
          return;
        }

        const {
          videoId,
          title = '',
          channelName = '',
          youtubeUrl,
          transcriptText,
          transcriptSegments,
          analysisMode = 'smart',
          userNotes,
          durationSeconds = null,
          mentor = null,
          category = null,
          chaptersTarget = 6,
          chapterHints = [],
          attachedDocumentsMetadata = null,
        } = body;

        const ytUrl = youtubeUrl || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);

        try {
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(apiKey);
          const prompt = buildGeminiAnalysisPrompt({ title, channelName, mentor, category, chaptersTarget, durationSeconds, userNotes, attachedDocumentsMetadata });

          let urlAnalysisResult = null;
          let urlAnalysisError = null;

          // Stage 1: URL-based analysis (Smart or URL-Only mode)
          if (analysisMode !== 'transcript_only' && ytUrl) {
            console.log(`[gemini-video-content] Stage 1: URL analysis mode=${analysisMode} videoId=${videoId || 'unknown'}`);
            try {
              const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
              const urlResult = await model.generateContent([
                { fileData: { mimeType: 'video/mp4', fileUri: ytUrl } },
                { text: prompt },
              ]);
              const raw = urlResult.response.text().trim();
              const cleaned = sanitizeJsonGershayim(
                raw.replace(/^```json?\n?/i, '').replace(/\n?```$/, '').trim()
              );
              const parsed = JSON.parse(cleaned);
              // URL-only analysis has no timestamped transcript text to verify a
              // sourceQuote against — gate with an empty segment list so any
              // time claim is stripped rather than trusted on faith.
              const gatedUrlResult = applyTimedNarrativeEvidenceGateToAnalysis(parsed, []);
              const sufficient = isResultSufficient(gatedUrlResult);
              console.log(`[gemini-video-content] URL result sufficient=${sufficient}`);

              if (sufficient || analysisMode === 'url_only') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ...gatedUrlResult, analysisSource: 'youtube_url', analysisMode: 'fast', lowConfidence: !sufficient }));
                return;
              }
              urlAnalysisResult = gatedUrlResult;
              console.log('[gemini-video-content] URL result insufficient — falling back to transcript');
            } catch (err) {
              urlAnalysisError = String(err?.message || err);
              console.log(`[gemini-video-content] URL analysis failed: ${urlAnalysisError.slice(0, 100)}`);
              if (analysisMode === 'url_only') {
                const status = err?.status ?? err?.statusCode ?? 500;
                res.writeHead(status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'URL_ANALYSIS_FAILED', message: urlAnalysisError }));
                return;
              }
            }
          }

          // Stage 2: Transcript fallback
          const txText = buildTxText(transcriptText, transcriptSegments);
          if (!txText || txText.length < 300) {
            if (urlAnalysisResult) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ...urlAnalysisResult, analysisSource: 'youtube_url', analysisMode: 'fast', lowConfidence: true, noTranscriptFallback: true }));
              return;
            }
            const reason = urlAnalysisError
              ? `ניתוח URL נכשל ואין תמלול זמין לגיבוי`
              : 'אין תמלול זמין לניתוח';
            res.writeHead(422, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'NO_TRANSCRIPT', message: reason }));
            return;
          }

          console.log(`[gemini-video-content] Stage 2: Transcript analysis txLen=${txText.length}`);
          const chapterHintsText = Array.isArray(chapterHints) && chapterHints.length > 0
            ? chapterHints.map(c => `${c.timestampLabel || ''}: ${c.title || ''}`.trim()).filter(Boolean).join('\n')
            : '';
          const txPrompt = [prompt, chapterHintsText ? `\nרמזי פרקים:\n${chapterHintsText}` : null, '\nTranscript:', txText].filter(Boolean).join('\n');

          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
          const txResult = await model.generateContent(txPrompt);
          const raw = txResult.response.text().trim();
          const cleaned = sanitizeJsonGershayim(
            raw.replace(/^```json?\n?/i, '').replace(/\n?```$/, '').trim()
          );
          const parsed = JSON.parse(cleaned);
          const txSegments = parseTimedTranscriptSegments(txText);
          // Row timestamps are no longer requested (see
          // buildGeminiAnalysisPrompt) — gated with an EMPTY segment list as
          // defense in depth, guaranteeing none can survive the normal,
          // automatic analysis path. See WORK-ID YMD-ONDEMAND-ROW-TIMES.
          const gatedResult = applyTimedNarrativeEvidenceGateToAnalysis(parsed, []);
          // Gemini's Stage 2 prompt already sends the full, untruncated
          // transcript (see buildTxText above) — coverage is 'full' by
          // construction here, unlike the Claude path's char-limited input.
          const staticTimeCoverage = computeTranscriptCoverage(txSegments, txSegments, txText.length, txText.length);
          console.log(`[gemini-video-content] transcript coverage`, staticTimeCoverage);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ...gatedResult, analysisSource: 'transcript', analysisMode: 'transcript', staticTimeCoverage }));
        } catch (err) {
          const status = err?.status ?? err?.statusCode ?? 500;
          const isQuotaZero = status === 429 && String(err?.message || '').includes('limit: 0');
          const code = isQuotaZero ? 'QUOTA_ZERO' : status === 429 ? 'RATE_LIMIT' : status === 401 ? 'INVALID_KEY' : 'GEMINI_ERROR';
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: code, message: err?.message }));
        }
      });
    },
  };
}

function makeGeminiPlugin(env) {
  return {
    name: 'gemini-proxy',

    configureServer(server) {
      server.middlewares.use('/api/analyze-video', async (req, res) => {

        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
          return;
        }

        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'GEMINI_API_KEY_MISSING', message: 'Add GEMINI_API_KEY to .env' }));
          return;
        }

        try {
          // Parse JSON body
          const body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', chunk => { data += chunk; });
            req.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
            req.on('error', reject);
          });

          const { title, description = '', keyPoints = [] } = body;
          if (!title) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'MISSING_TITLE' }));
            return;
          }

          // ── Mock mode (set GEMINI_MOCK=true in .env to test UI without Gemini) ──
          if (env.GEMINI_MOCK === 'true') {
            await new Promise(r => setTimeout(r, 1200));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              shortSummary: `הסרטון "${title}" מציג גישה מעמיקה לנושא עם הסברים ברורים ויישום מעשי.`,
              fullSummary: `הסרטון מכסה נושאים מרכזיים ומציג גישות מעשיות ברורות. הדגש הוא על יישום ישיר של מה שנלמד, עם דוגמאות מהחיים האמיתיים ותובנות שניתן לאמץ מיד.`,
              keyPoints: [
                'הצגת הבעיה המרכזית והפתרון המוצע',
                'יישום מעשי עם דוגמאות מהחיים',
                'טיפים ועצות מניסיון אישי',
                'נקודות חשובות לזכור לאחר הצפייה',
              ],
              tags: ['trading', 'analysis'],
            }));
            return;
          }

          // Hebrew prompt
          const existingPoints = keyPoints.length > 0 ? keyPoints.join(', ') : 'אין';
          const prompt = `
אתה עוזר לימוד בעברית. נתח את הסרטון הבא והחזר JSON בלבד, ללא markdown, ללא טקסט נוסף.
כל הטקסטים בתוצאה חייבים להיות בעברית טבעית וברורה.

כותרת הסרטון: ${title}
תיאור: ${description || 'אין תיאור'}
נקודות מפתח קיימות: ${existingPoints}

החזר JSON בפורמט הזה בלבד:
{
  "shortSummary": "תקציר קצר של 2-3 משפטים בעברית על מה שהסרטון מלמד",
  "fullSummary": "תקציר מפורט של 4-6 משפטים בעברית עם תובנות מעשיות",
  "keyPoints": ["נקודה מרכזית 1 בעברית", "נקודה מרכזית 2 בעברית", "נקודה מרכזית 3 בעברית", "נקודה מרכזית 4 בעברית", "נקודה מרכזית 5 בעברית"],
  "tags": ["תגית1", "תגית2", "תגית3"]
}
`.trim();

          // Call Gemini (dynamic import — stays in Node, not bundled)
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

          const geminiResult = await model.generateContent(prompt);
          const rawText = geminiResult.response.text().trim();

          // Strip markdown fences if present
          const cleaned = rawText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
          const analysis = JSON.parse(cleaned);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(analysis));

        } catch (err) {
          const status  = err.status ?? err.statusCode ?? 500;
          const message = err.message || '';
          // "limit: 0" = project has zero quota (billing/config issue, not temporary)
          const isQuotaZero = status === 429 && message.includes('limit: 0');
          const code =
            isQuotaZero  ? 'QUOTA_ZERO'    :
            status === 429 ? 'RATE_LIMIT'  :
            status === 401 ? 'INVALID_KEY' :
            status === 403 ? 'QUOTA_EXCEEDED' :
                             'GEMINI_ERROR';

          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: code, message: err.message }));
        }
      });

      server.middlewares.use('/api/gemini-repair-json', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
          return;
        }
        try {
          const body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', chunk => { data += chunk; });
            req.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
            req.on('error', reject);
          });
          const result = await runGemsJsonRepair({
            rawJson: body?.rawJson,
            apiKey: env.GEMINI_API_KEY,
            model: env.GEMINI_REPAIR_MODEL,
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          const failure = serializeGemsRepairError(err);
          res.writeHead(failure.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: failure.error, message: failure.message }));
        }
      });
    },
  };
}

// ─── JSON sanitizer: escapes Hebrew gershayim unescaped inside JSON strings ──
// Handles abbreviations like עו"ד, חרד"לי, ז"ל, מ"מ, ח"כ, etc.
// Pattern: [Hebrew/word char]"[Hebrew/word char] → [same]\\"[same]
// Uses explicit \u escapes for Hebrew block (U+05B0–U+05FF) to avoid engine quirks.
function sanitizeJsonGershayim(text) {
  // Pass 1: regex — catches the clear word"word pattern
  let s = text.replace(/([ְ-׿\w])"([ְ-׿\w])/g, '$1\\"$2');

  // Pass 2: position-based — fix remaining broken quotes via iterative parse
  for (let attempt = 0; attempt < 20; attempt++) {
    let parseErr = null;
    try { JSON.parse(s); break; } catch (e) { parseErr = e; }
    const msg = parseErr.message || '';
    const posMatch = msg.match(/position (\d+)/i) || msg.match(/\bat (\d+)\b/);
    const lcMatch  = !posMatch && msg.match(/line (\d+) column (\d+)/i);
    let pos = -1;
    if (posMatch) {
      pos = parseInt(posMatch[1], 10);
    } else if (lcMatch) {
      const ln = parseInt(lcMatch[1], 10) - 1;
      const col = parseInt(lcMatch[2], 10) - 1;
      const lines = s.split('\n');
      pos = lines.slice(0, ln).reduce((a, l) => a + l.length + 1, 0) + col;
    }
    if (pos <= 0) break;
    // The premature " is one position before the reported error char
    if (s[pos - 1] !== '"') break;
    s = s.slice(0, pos - 1) + '\\"' + s.slice(pos);
  }

  return s;
}

const ROW_TIMESTAMP_TRANSCRIPT_CHAR_LIMIT = 200_000;

function makeRowTimestampsPlugin(env) {
  return {
    name: 'row-timestamps',
    configureServer(server) {
      server.middlewares.use('/api/generate-row-timestamps', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
          return;
        }

        let body;
        try {
          body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', (chunk) => { data += chunk; });
            req.on('end', () => {
              try { resolve(JSON.parse(data || '{}')); } catch (error) { reject(error); }
            });
            req.on('error', reject);
          });
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_JSON', message: 'Request body must be valid JSON' }));
          return;
        }

        const rawTranscript = String(body?.transcript || '').trim();
        const rows = (Array.isArray(body?.rows) ? body.rows : [])
          .map((row) => {
            const text = String(row?.text || '').trim();
            return {
              rowPath: String(row?.rowPath || ''),
              text,
              fingerprint: fingerprintRowText(text),
            };
          })
          .filter((row) => row.rowPath && row.text);

        if (!rawTranscript || rows.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_INPUT', message: 'Timed transcript and existing rows are required' }));
          return;
        }

        const apiKey = env.ANTHROPIC_API_KEY || env.VITE_ANTHROPIC_API_KEY;
        if (!apiKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'CLAUDE_API_KEY_MISSING', message: 'Missing ANTHROPIC_API_KEY' }));
          return;
        }

        const transcript = rawTranscript.slice(0, ROW_TIMESTAMP_TRANSCRIPT_CHAR_LIMIT);
        const selectedModel = env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

        try {
          const providerResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: selectedModel,
              max_tokens: 4_000,
              temperature: 0.1,
              system: [
                'Return ONLY valid JSON.',
                'Do not wrap the output in Markdown code fences.',
                'Your entire response must be a single JSON object that starts with "{" and ends with "}".',
              ].join('\n'),
              messages: [{ role: 'user', content: buildRowTimestampPrompt({ transcriptText: transcript, rows }) }],
            }),
          });
          const providerData = await providerResponse.json().catch(() => null);
          if (!providerResponse.ok) {
            const error = new Error(providerData?.error?.message || providerData?.message || 'Claude request failed');
            error.status = providerResponse.status;
            throw error;
          }

          const responseText = Array.isArray(providerData?.content)
            ? providerData.content.filter((item) => item?.type === 'text').map((item) => item.text || '').join('\n')
            : '';
          const parsed = parseModelJsonSafely(responseText).value;
          const segments = parseTimedTranscriptSegments(transcript);
          const fullSegments = parseTimedTranscriptSegments(rawTranscript);
          const { accepted, rejected } = applyEvidenceGateToRowAnnotations(parsed?.annotations, rows, segments);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            provider: 'claude',
            model: selectedModel,
            rowCount: rows.length,
            accepted,
            rejected,
            staticTimeCoverage: {
              totalChars: rawTranscript.length,
              analyzedChars: transcript.length,
              totalSegments: fullSegments.length,
              analyzedSegments: segments.length,
              skippedSegments: Math.max(0, fullSegments.length - segments.length),
              status: segments.length >= fullSegments.length && fullSegments.length > 0
                ? 'full'
                : (fullSegments.length === 0 ? 'unknown' : 'partial'),
            },
            usage: providerData?.usage || null,
          }));
        } catch (error) {
          const status = Number(error?.status) || 502;
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: error?.code || 'ROW_TIMESTAMPS_FAILED',
            message: error?.message || 'Timestamp generation failed',
          }));
        }
      });
    },
  };
}

// ─── Claude Video Analyze Plugin ────────────────────────────────────────────
// Routes: GET /api/claude-video-analyze/status, POST /api/claude-video-analyze
// Dev-only mirror of backend/analyze-video.function.js (general video analysis
// with Claude). In PROD the client calls the Base44 "AnalyzeVideo" function
// instead; this middleware only runs under `vite dev`.
// Body: { videoId, title, transcript, durationSeconds, mentor?, category?, chaptersTarget? }
// Returns: { shortSummary, fullSummary, keyPoints[], chapters[], mainLesson,
//   keyInsights[], rules[], actionItems[], mistakesToAvoid[], strategyOrMethod,
//   tags[], provider:'claude', model, isFallback:false, staticTimeCoverage }
// ────────────────────────────────────────────────────────────────────────────
const CLAUDE_ANALYZE_TRANSCRIPT_CHAR_LIMIT = 200_000;
const CLAUDE_ANALYZE_MAX_TOKENS = 6_000;

// Kept behaviourally identical to buildPrompt() in
// backend/analyze-video.function.js — the two paths must produce the same
// analysis shape for a given transcript. Row-timestamp fields are deliberately
// not requested here (that is a separate opt-in operation).
function buildClaudeAnalyzePrompt({ title, transcript, durationSeconds, mentor, category, chaptersTarget }) {
  const narrativeItem = { text: '...' };
  return [
    'נתח את התמלול הבא בלבד והחזר JSON בלבד, בלי markdown ובלי טקסט נוסף.',
    'שמור על תשובה קצרה ויציבה. אל תחזיר brainSummary, markdown, או שדות ארוכים שלא נתבקשו.',
    'החזר רק את השדות הבאים ובאותו סדר.',
    'shortSummary: 2-3 משפטים.',
    'fullSummary: 4-6 משפטים.',
    'keyPoints: עד 5 פריטים במבנה האובייקט שבסכמה.',
    `chapters: בערך ${chaptersTarget} פרקים שמכסים את כל הסרטון.`,
    'mainLesson: משפט קצר אחד.',
    'keyInsights: עד 4 פריטים במבנה האובייקט שבסכמה.',
    'rules: עד 4 פריטים במבנה האובייקט שבסכמה.',
    'actionItems: עד 4 פריטים במבנה האובייקט שבסכמה.',
    'mistakesToAvoid: עד 4 פריטים במבנה האובייקט שבסכמה.',
    'strategyOrMethod: משפט קצר אחד או מחרוזת ריקה.',
    'tags: עד 4 תגיות.',
    'אם אין מספיק חומר לשדה מסוים, החזר מערך ריק או מחרוזת ריקה.',
    'כל כותרת פרק חייבת להיות ספציפית ולא גנרית.',
    '',
    `כותרת: ${title}`,
    mentor ? `מנטור: ${mentor}` : null,
    category ? `קטגוריה: ${category}` : null,
    Number.isFinite(Number(durationSeconds)) && Number(durationSeconds) > 0
      ? `משך סרטון בשניות: ${Math.floor(Number(durationSeconds))}`
      : null,
    '',
    'החזר רק JSON בפורמט הבא:',
    JSON.stringify({
      shortSummary: '...',
      fullSummary: '...',
      keyPoints: [narrativeItem],
      chapters: [
        {
          title: '...',
          startSeconds: 0,
          endSeconds: 120,
          summary: '...',
          keyPoints: ['...'],
        },
      ],
      mainLesson: '...',
      keyInsights: [narrativeItem],
      rules: [narrativeItem],
      actionItems: [narrativeItem],
      mistakesToAvoid: [narrativeItem],
      strategyOrMethod: '...',
      tags: ['...'],
    }, null, 2),
    '',
    'אל תחזיר שום שדה נוסף.',
    'Transcript:',
    String(transcript || '').trim(),
  ].filter(Boolean).join('\n');
}

function makeClaudeVideoAnalyzePlugin(env) {
  const apiKey = env.ANTHROPIC_API_KEY || env.VITE_ANTHROPIC_API_KEY;
  const model = env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

  return {
    name: 'claude-video-analyze',
    configureServer(server) {
      server.middlewares.use('/api/claude-video-analyze/status', (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          configured: Boolean(apiKey),
          provider: 'claude',
          model,
          missingEnvKey: apiKey ? null : 'ANTHROPIC_API_KEY',
        }));
      });

      server.middlewares.use('/api/claude-video-analyze', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
          return;
        }

        if (!apiKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'CLAUDE_API_KEY_MISSING', message: 'Missing ANTHROPIC_API_KEY' }));
          return;
        }

        let body;
        try {
          body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', (chunk) => { data += chunk; });
            req.on('end', () => {
              try { resolve(JSON.parse(data || '{}')); } catch (error) { reject(error); }
            });
            req.on('error', reject);
          });
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_JSON', message: 'Request body must be valid JSON' }));
          return;
        }

        const rawTranscript = String(body?.transcript || '').trim();
        if (!rawTranscript) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'TRANSCRIPT_REQUIRED', message: 'Transcript is required for Claude analysis' }));
          return;
        }

        const transcript = rawTranscript.slice(0, CLAUDE_ANALYZE_TRANSCRIPT_CHAR_LIMIT);
        const durationSeconds = Number(body?.durationSeconds) || 0;
        const chaptersTarget = Number(body?.chaptersTarget) > 0
          ? Math.floor(Number(body.chaptersTarget))
          : (durationSeconds > 0
              ? (durationSeconds <= 14 * 60 ? 5 : durationSeconds <= 22 * 60 ? 7 : 8)
              : 6);

        const prompt = buildClaudeAnalyzePrompt({
          title: String(body?.title || '').trim(),
          transcript,
          durationSeconds,
          mentor: body?.mentor || null,
          category: body?.category || null,
          chaptersTarget,
        });

        try {
          const providerResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model,
              max_tokens: CLAUDE_ANALYZE_MAX_TOKENS,
              temperature: 0.1,
              system: [
                'Return ONLY valid JSON.',
                'Do not wrap the output in Markdown code fences.',
                'Your entire response must be a single JSON object that starts with "{" and ends with "}".',
              ].join('\n'),
              messages: [{ role: 'user', content: prompt }],
            }),
          });
          const providerData = await providerResponse.json().catch(() => null);
          if (!providerResponse.ok) {
            const error = new Error(providerData?.error?.message || providerData?.message || 'Claude request failed');
            error.code = 'CLAUDE_ERROR';
            error.status = providerResponse.status;
            throw error;
          }

          const responseText = Array.isArray(providerData?.content)
            ? providerData.content.filter((item) => item?.type === 'text').map((item) => item.text || '').join('\n')
            : '';
          const parsed = parseModelJsonSafely(responseText).value;
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            const error = new Error('Claude returned invalid JSON. Try Gemini or reduce transcript length.');
            error.code = 'CLAUDE_INVALID_JSON';
            error.status = 502;
            throw error;
          }

          // Fail-closed with an empty segment list: guarantees no unverified
          // row-timestamp fields survive the normal analysis path (matches
          // backend/analyze-video.function.js).
          const analysis = applyTimedNarrativeEvidenceGateToAnalysis(parsed, []);
          const fullSegments = parseTimedTranscriptSegments(rawTranscript);
          const analysisSegments = parseTimedTranscriptSegments(transcript);
          const staticTimeCoverage = computeTranscriptCoverage(
            fullSegments,
            analysisSegments,
            rawTranscript.length,
            transcript.length,
          );

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ...analysis,
            provider: 'claude',
            model,
            isFallback: false,
            staticTimeCoverage,
          }));
        } catch (error) {
          const status = Number(error?.status) || 502;
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: error?.code || 'CLAUDE_ERROR',
            message: error?.message || 'Claude analysis failed',
          }));
        }
      });
    },
  };
}

// ─── Political Summary Plugin ────────────────────────────────────────────────
// Route: POST /api/political-summary
// Body: { videoId, title, transcriptText, channelName? }
// Returns: 10-field structured political analysis JSON (Hebrew)
// ─────────────────────────────────────────────────────────────────────────────
function makePoliticalSummaryPlugin(env) {
  return {
    name: 'political-summary',
    configureServer(server) {
      server.middlewares.use('/api/political-summary', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
          return;
        }
        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'GEMINI_API_KEY_MISSING', message: 'Add GEMINI_API_KEY to .env' }));
          return;
        }
        let body;
        try {
          body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', chunk => { data += chunk; });
            req.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
            req.on('error', reject);
          });
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_BODY' }));
          return;
        }
        const { title = '', transcriptText = '', channelName = '' } = body;
        if (!transcriptText || transcriptText.trim().length < 100) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'TRANSCRIPT_TOO_SHORT', message: 'יש לספק תמלול של לפחות 100 תווים' }));
          return;
        }
        const prompt = `אתה מנתח פוליטי מומחה. נתח את הסרטון הפוליטי הבא על סמך התמלול.
החזר JSON תקין בלבד. ללא markdown. ללא \`\`\`json. ללא טקסט לפני ה-JSON ואחריו.
חובה להתחיל ב-{ ולהסתיים ב-}. פסיקים בין כל השדות. ללא גרשיים שבורים. כל הטקסטים בעברית.

כותרת: ${title}
${channelName ? `ערוץ: ${channelName}` : ''}
תמלול:
${transcriptText.slice(0, 12000)}

החזר JSON בפורמט הבא בדיוק:
{
  "videoMetadata": { "title": "כותרת הסרטון", "channel": "שם הערוץ" },
  "politicalSummary": {
    "shortSummary": "תקציר קצר של 3-5 משפטים",
    "mainClaim": "הטענה המרכזית של הסרטון",
    "keyPoints": ["נקודה 1", "נקודה 2", "נקודה 3", "נקודה 4", "נקודה 5"],
    "actorsMap": {
      "speakers": ["שם הדובר"],
      "attackedGroups": ["מי מותקף"],
      "defendedGroups": ["מי מוגן"],
      "targetAudience": ["קהל יעד"]
    },
    "supportingArguments": ["טיעון 1", "טיעון 2", "טיעון 3"],
    "weaknessesAndCounterpoints": ["חולשה 1", "חולשה 2"],
    "usefulQuotes": ["ציטוט 1", "ציטוט 2", "ציטוט 3"],
    "emotionalFraming": ["רגש1", "רגש2"],
    "practicalUse": ["תגובה מוכנה לשיתוף בפוסט", "טיעון לוויכוח", "סיסמה קצרה מהסרטון"],
    "bottomLine": "משפט אחד חד שמסכם את כל הסרטון"
  },
  "chapters": [{ "title": "שם פרק", "startTime": 0, "summary": "תקציר הפרק" }],
  "arguments": ["טיעון עיקרי 1", "טיעון עיקרי 2"],
  "counterArguments": ["טיעון נגד 1", "טיעון נגד 2"],
  "knowledgePoints": ["נקודת ידע 1", "נקודת ידע 2"],
  "keyInsights": ["תובנה 1", "תובנה 2"],
  "warnings": ["אזהרה 1"],
  "rules": ["כלל 1"],
  "concepts": ["מושג 1", "מושג 2"],
  "politicalSlogans": ["סיסמה 1", "סיסמה 2"],
  "viralQuotes": ["ציטוט ויראלי 1", "ציטוט ויראלי 2"],
  "debateResponses": ["תגובה לוויכוח 1", "תגובה לוויכוח 2"],
  "commentBank": ["תגובה לרשתות 1", "תגובה לרשתות 2"],
  "campaignKit": { "mainMessage": "מסר מרכזי", "hashtags": ["#hashtag1"], "callToAction": "קריאה לפעולה" },
  "ideologyAnalysis": { "ideology": "שם האידיאולוגיה", "alignment": "שמאל/ימין/מרכז", "framing": "תיאור מסגור" }
}`.trim();
        try {
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
          const result = await model.generateContent(prompt);
          const raw = result.response.text().trim();
          const cleaned = sanitizeJsonGershayim(
            raw.replace(/^```json?\n?/i, '').replace(/\n?```$/, '').trim()
          );
          const parsed = JSON.parse(cleaned);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(parsed));
        } catch (err) {
          const status = err.status ?? err.statusCode ?? 500;
          const code = status === 429 ? 'RATE_LIMIT' : status === 401 ? 'INVALID_KEY' : 'GEMINI_ERROR';
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: code, message: err.message }));
        }
      });
    },
  };
}

// ─── YouTube Video Metadata Proxy ────────────────────────────────────────────
// Route: GET /api/youtube-video-metadata?v=VIDEO_ID
// Scrapes YouTube watch page in Node (no CORS, no API key) to extract:
//   channelId, channelTitle, channelUrl, viewCount, duration, publishedAt
// Used by buildExternalVideoObject → resolveChannelToMentor for auto mentor detection.
// ─────────────────────────────────────────────────────────────────────────────
function makeYouTubeVideoMetadataPlugin() {
  return {
    name: 'youtube-video-metadata',
    configureServer(server) {
      server.middlewares.use('/api/youtube-video-metadata', async (req, res) => {
        const urlObj = new URL(req.url, 'http://localhost');
        const videoId = urlObj.searchParams.get('v');

        if (!videoId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'MISSING_VIDEO_ID', message: 'v query param required' }));
          return;
        }

        console.log(`[yt-metadata] → fetching metadata for videoId=${videoId}`);

        try {
          const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
          });

          if (!response.ok) {
            console.log(`[yt-metadata] ← YouTube returned ${response.status} for videoId=${videoId}`);
            res.writeHead(response.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'YOUTUBE_FETCH_FAILED', status: response.status }));
            return;
          }

          const html = await response.text();

          // channelId — reliable across page formats
          const channelIdMatch = html.match(/"channelId":"(UC[\w-]{22})"/);
          const channelId = channelIdMatch?.[1] || null;

          // channelTitle — try ownerChannelName first, then author
          const ownerChannelMatch = html.match(/"ownerChannelName":"([^"]+)"/);
          const authorMatch = html.match(/"author":"([^"]+)"/);
          const rawChannelTitle = ownerChannelMatch?.[1] || authorMatch?.[1] || null;
          const channelTitle = rawChannelTitle ? rawChannelTitle.replace(/\\u0026/g, '&').replace(/\\"/g, '"') : null;

          // viewCount
          const viewCountMatch = html.match(/"viewCount":"(\d+)"/);
          const viewCount = viewCountMatch ? Number(viewCountMatch[1]) : null;

          // duration — lengthSeconds → ISO 8601
          const lengthMatch = html.match(/"lengthSeconds":"(\d+)"/);
          const lengthSeconds = lengthMatch ? Number(lengthMatch[1]) : null;
          let duration = null;
          if (lengthSeconds > 0) {
            const h = Math.floor(lengthSeconds / 3600);
            const m = Math.floor((lengthSeconds % 3600) / 60);
            const s = lengthSeconds % 60;
            duration = h > 0 ? `PT${h}H${m}M${s}S` : `PT${m}M${s}S`;
          }

          // publishedAt — try multiple YouTube page patterns (YouTube changes these frequently)
          const metaDateMatch      = html.match(/<meta itemprop="datePublished" content="([\d-]+)">/);
          const jsonPublishDate    = html.match(/"publishDate"\s*:\s*"([\d-]+)"/);
          const jsonPublishedFull  = html.match(/"publishedAt"\s*:\s*"(\d{4}-\d{2}-\d{2}T[^"]{5,35})"/);
          const jsonPublishedDate  = html.match(/"publishedAt"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
          const jsonUploadDate     = html.match(/"uploadDate"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
          const jsonLdUploadDate   = html.match(/"uploadDate"\s*:\s*"(\d{4}-\d{2}-\d{2}T[^"]{5,35})"/);
          const metaOgUpdatedTime  = html.match(/<meta property="og:updated_time" content="([^"]+)"/);
          // Full ISO timestamp wins; date-only patterns are padded to midnight UTC
          const rawDate = metaDateMatch?.[1] || jsonPublishDate?.[1] || jsonPublishedDate?.[1] || jsonUploadDate?.[1] || null;
          const publishedAt = jsonPublishedFull?.[1] || jsonLdUploadDate?.[1] || metaOgUpdatedTime?.[1] || (rawDate ? `${rawDate}T00:00:00Z` : null);

          // Diagnostic: log what we found (and what we didn't) when publishedAt is null
          if (!publishedAt) {
            const snippets = {
              publishDate:   (html.match(/.{0,20}"publishDate".{0,30}/)?.[0] || '').replace(/\s+/g, ' '),
              publishedAt:   (html.match(/.{0,20}"publishedAt".{0,30}/)?.[0] || '').replace(/\s+/g, ' '),
              uploadDate:    (html.match(/.{0,20}"uploadDate".{0,30}/)?.[0] || '').replace(/\s+/g, ' '),
              datePublished: (html.match(/.{0,20}datePublished.{0,30}/)?.[0] || '').replace(/\s+/g, ' '),
            };
            console.warn(`[yt-metadata] publishedAt NOT FOUND for ${videoId}. Snippets:`, snippets);
          }

          // description — extracted from ytInitialPlayerResponse shortDescription
          // YouTube JSON-encodes the full description (including chapter timestamps) here.
          const shortDescMatch = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
          const description = shortDescMatch
            ? shortDescMatch[1]
                .replace(/\\n/g, '\n')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\')
                .replace(/\\u003e/g, '>')
                .replace(/\\u003c/g, '<')
                .replace(/\\u0026/g, '&')
            : null;

          const result = {
            channelId,
            channelTitle,
            channelUrl: channelId ? `https://www.youtube.com/channel/${channelId}` : null,
            viewCount,
            duration,
            publishedAt,
            ...(description ? { description } : {}),
          };

          console.log(`[yt-metadata] ← result for ${videoId}:`, {
            channelId: result.channelId || '(none)',
            channelTitle: result.channelTitle || '(none)',
            viewCount: result.viewCount ?? '(none)',
            duration: result.duration || '(none)',
            publishedAt: result.publishedAt || '(none)',
            descriptionLen: description?.length ?? 0,
          });

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': 'max-age=300',
          });
          res.end(JSON.stringify(result));

        } catch (err) {
          console.error(`[yt-metadata] error for ${videoId}:`, err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'FETCH_FAILED', message: err.message }));
        }
      });
    },
  };
}

// ─── Obsidian Vault Write Plugin ─────────────────────────────────────────────
// Route: POST /api/vault/write
// Body: { path, content, vaultPath, vaultName, subtitle?, ... }
// Writes the markdown file directly into the configured Obsidian vault.
// Creates parent folders if missing. Returns { ok, savedPath, absolutePath, obsidianUri }.
// ─────────────────────────────────────────────────────────────────────────────
function sanitizeVaultRelativePath(relPath = '') {
  const base = String(relPath || '')
    .replace(/\.\./g, '')
    .replace(/^[/\\]+/, '')
    .replace(/\\/g, '/')
    .trim();
  return stripMigrationPrefixFromRelativePath(base);
}

function getVaultRequestConfig(body = {}, env = {}) {
  const requestVaultPath = String(body?.vaultPath || '').trim();
  const requestVaultName = String(body?.vaultName || '').trim();
  const envVaultPath = String(env.OBSIDIAN_VAULT_PATH || env.VITE_OBSIDIAN_VAULT_PATH || '').trim();
  const envVaultName = String(env.VITE_OBSIDIAN_VAULT_NAME || '').trim();

  const resolved = resolveObsidianVaultSettings({
    vaultName: requestVaultName || envVaultName || DEFAULT_OBSIDIAN_VAULT_NAME,
    vaultPath: requestVaultPath || envVaultPath || DEFAULT_OBSIDIAN_VAULT_PATH,
  });

  return {
    vaultPath: resolved.vaultPath,
    vaultName: resolved.vaultName,
    vaultSource: requestVaultName ? 'request' : envVaultName ? 'env' : resolved.migrated ? 'migrated' : 'default',
    pathSource: requestVaultPath ? 'request' : envVaultPath ? 'env' : 'default',
  };
}

async function buildVaultDiagnostics({
  vaultPath = '',
  vaultName = DEFAULT_OBSIDIAN_VAULT_NAME,
  relativePath = '',
  createFolder = false,
} = {}) {
  const { default: fs } = await import('fs');
  const nodePath = (await import('path')).default;
  const safePath = sanitizeVaultRelativePath(relativePath);
  const normalizedVaultPath = normalizeObsidianVaultPath(String(vaultPath || '').trim());
  const normalizedVaultName = String(vaultName || '').trim() || DEFAULT_OBSIDIAN_VAULT_NAME;
  const vaultExists = normalizedVaultPath ? fs.existsSync(normalizedVaultPath) : false;
  const resolvedFolder = safePath.includes('/') ? safePath.slice(0, safePath.lastIndexOf('/')) : '';
  const folderResolved = Boolean(resolvedFolder);
  const filePathValid = Boolean(safePath);
  const absoluteFolderPath = vaultExists && resolvedFolder ? nodePath.join(normalizedVaultPath, resolvedFolder) : '';
  const absoluteFilePath = vaultExists && safePath ? nodePath.join(normalizedVaultPath, safePath) : '';
  let folderExists = absoluteFolderPath ? fs.existsSync(absoluteFolderPath) : vaultExists;
  let folderCreated = false;

  if (vaultExists && absoluteFolderPath && createFolder && !folderExists) {
    fs.mkdirSync(absoluteFolderPath, { recursive: true });
    folderExists = fs.existsSync(absoluteFolderPath);
    folderCreated = folderExists;
  }

  const fileExists = absoluteFilePath ? fs.existsSync(absoluteFilePath) : false;
  const obsidianUrl = safePath
    ? `obsidian://open?vault=${encodeURIComponent(normalizedVaultName)}&file=${encodeURIComponent(safePath)}`
    : '';

  return {
    activeVault: normalizedVaultName,
    vaultName: normalizedVaultName,
    vaultPath: normalizedVaultPath,
    vaultExists,
    folderResolved,
    folderExists,
    folderCreated,
    filePathValid,
    finalFilePath: safePath,
    resolvedFolder,
    absoluteFolderPath,
    absoluteFilePath,
    fileExists,
    obsidianUrl,
  };
}

function makeVaultDiagnosticsPlugin(env) {
  return {
    name: 'vault-diagnostics',
    configureServer(server) {
      server.middlewares.use('/api/vault/diagnostics', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
          return;
        }

        let body;
        try {
          body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', chunk => { data += chunk; });
            req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
            req.on('error', reject);
          });
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_BODY' }));
          return;
        }

        const config = getVaultRequestConfig(body, env);
        const diagnostics = await buildVaultDiagnostics({
          vaultPath: config.vaultPath,
          vaultName: config.vaultName,
          relativePath: body.filePath || body.path || '',
          createFolder: body.createFolder === true,
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          sourceOfActiveVault: config.vaultSource,
          sourceOfVaultPath: config.pathSource,
          ...diagnostics,
        }));
      });
    },
  };
}

function makeVaultReadPlugin(env) {
  return {
    name: 'vault-read',
    configureServer(server) {
      server.middlewares.use('/api/vault/read', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
          return;
        }

        let body;
        try {
          body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', chunk => { data += chunk; });
            req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
            req.on('error', reject);
          });
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_BODY' }));
          return;
        }

        const config = getVaultRequestConfig(body, env);
        if (!config.vaultPath) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'NO_VAULT_PATH' }));
          return;
        }

        const safePath = sanitizeVaultRelativePath(body.path || '');
        if (!safePath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_PATH' }));
          return;
        }

        const diagnostics = await buildVaultDiagnostics({
          vaultPath: config.vaultPath,
          vaultName: config.vaultName,
          relativePath: safePath,
          createFolder: false,
        });

        if (!diagnostics.vaultExists) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: false,
            error: 'VAULT_NOT_FOUND',
            savedPath: safePath,
            exists: false,
            content: '',
          }));
          return;
        }

        const { default: fs } = await import('fs');
        const exists = diagnostics.fileExists === true;
        const content = exists ? fs.readFileSync(diagnostics.absoluteFilePath, 'utf-8') : '';

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          savedPath: safePath,
          exists,
          content,
          absolutePath: diagnostics.absoluteFilePath,
        }));
      });
    },
  };
}

function makeVaultWritePlugin(env) {
  return {
    name: 'vault-write',
    configureServer(server) {
      server.middlewares.use('/api/vault/write', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
          return;
        }

        let body;
        try {
          body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', chunk => { data += chunk; });
            req.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
            req.on('error', reject);
          });
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_BODY' }));
          return;
        }

        const { path: relPath, content } = body;
        const writeMode = String(body.mode || 'overwrite').trim().toLowerCase();
        const mergeItems = Array.isArray(body.mergeItems) ? body.mergeItems : [];
        const footerLines = Array.isArray(body.footerLines) ? body.footerLines : [];
        const config = getVaultRequestConfig(body, env);
        const vaultPath = config.vaultPath;
        const vaultName = config.vaultName;

        if (!vaultPath) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: false,
            error: 'NO_VAULT_PATH',
            message: 'נתיב ה-vault לא מוגדר. פתח הגדרות Obsidian כדי לקבוע את הנתיב.',
          }));
          return;
        }

        if (!relPath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'MISSING_FIELDS', message: 'path is required' }));
          return;
        }

        if (writeMode === 'merge') {
          if (mergeItems.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'MISSING_MERGE_ITEMS', message: 'mergeItems are required for merge mode' }));
            return;
          }
        } else if (writeMode === 'merged-content') {
          if (!content) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'MISSING_FIELDS', message: 'content is required for merged-content mode' }));
            return;
          }
        } else if (!content) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'MISSING_FIELDS', message: 'path and content are required' }));
          return;
        }

        const safePath = sanitizeVaultRelativePath(relPath);
        if (!safePath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_PATH' }));
          return;
        }

        const { default: fs } = await import('fs');
        const diagnostics = await buildVaultDiagnostics({
          vaultPath,
          vaultName,
          relativePath: safePath,
          createFolder: true,
        });

        if (!diagnostics.vaultExists) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: false,
            error: 'VAULT_NOT_FOUND',
            message: 'ה-vault שהוגדר לא נמצא בנתיב המקומי',
            ...diagnostics,
          }));
          return;
        }

        try {
          let finalContent = content;
          let mergeMeta = null;

          if (writeMode === 'merge') {
            const existing = diagnostics.fileExists
              ? fs.readFileSync(diagnostics.absoluteFilePath, 'utf-8')
              : '';
            mergeMeta = mergeItemsIntoObsidianNote({
              existingContent: existing,
              videoTitle: body.videoTitle || '',
              items: mergeItems,
              footerLines,
            });
            finalContent = mergeMeta.content;
            console.log(`[vault-write] merge: ${diagnostics.absoluteFilePath}`, {
              added: mergeMeta.added,
              skipped: mergeMeta.skipped,
              changed: mergeMeta.changed,
            });
          } else if (writeMode === 'merged-content') {
            finalContent = content;
            console.log(`[vault-write] merged-content: ${diagnostics.absoluteFilePath}`, {
              bytes: String(content || '').length,
              items: mergeItems.length,
            });
          } else {
            console.log(`[vault-write] writing: ${diagnostics.absoluteFilePath}`);
          }

          fs.writeFileSync(diagnostics.absoluteFilePath, finalContent, 'utf-8');

          const exists = fs.existsSync(diagnostics.absoluteFilePath);
          const verifiedContent = exists ? fs.readFileSync(diagnostics.absoluteFilePath, 'utf-8') : '';
          const verified = writeMode === 'merge' || writeMode === 'merged-content'
            ? exists && mergeItems.every((item) => noteContainsItemMarker(verifiedContent, item.identityKey))
            : exists && verifiedContent === finalContent;

          console.log('[vault-write] success:', {
            savedPath: safePath,
            exists,
            verified,
            mode: writeMode,
            obsidianUri: diagnostics.obsidianUrl,
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: true,
            savedPath: safePath,
            absolutePath: diagnostics.absoluteFilePath,
            obsidianUri: diagnostics.obsidianUrl,
            exists,
            verified,
            mode: writeMode,
            merge: mergeMeta,
            ...diagnostics,
          }));
        } catch (err) {
          console.error('[vault-write] error:', err.message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'WRITE_FAILED', message: err.message, ...diagnostics }));
        }
      });
    },
  };
}

function makeVaultAppendPlugin(env) {
  return {
    name: 'vault-append',
    configureServer(server) {
      server.middlewares.use('/api/vault/append', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
          return;
        }

        let body;
        try {
          body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', chunk => { data += chunk; });
            req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
            req.on('error', reject);
          });
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_BODY' }));
          return;
        }

        const config = getVaultRequestConfig(body, env);
        if (!config.vaultPath) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: false,
            error: 'NO_VAULT_PATH',
            message: 'נתיב ה-vault לא מוגדר',
          }));
          return;
        }

        const manualFolder = sanitizeVaultRelativePath(body.manualFolder || body.folder || '');
        const manualFile = sanitizeVaultRelativePath(body.manualFile || body.file || '');
        const relativePath = sanitizeVaultRelativePath(
          body.path || [manualFolder, manualFile].filter(Boolean).join('/')
        );
        if (!relativePath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_PATH' }));
          return;
        }

        const verifyKeyPoints = (Array.isArray(body.verifyKeyPoints) ? body.verifyKeyPoints : body.keyPoints || [])
          .map(item => String(item || '').trim())
          .filter(Boolean);
        const keyPoints = (Array.isArray(body.keyPoints) ? body.keyPoints : [])
          .map(item => String(item || '').trim())
          .filter(Boolean);
        const entryContent = String(body.content || '').trim() || [
          body.videoTitle ? `## ${body.videoTitle}` : null,
          ...keyPoints.map(item => `- ${item}`),
          [
            body.channelTitle || body.channel ? `ערוץ: ${body.channelTitle || body.channel}` : null,
            body.date ? `תאריך: ${body.date}` : null,
            body.url ? `קישור: ${body.url}` : null,
          ].filter(Boolean).join(' | ') || null,
        ].filter(Boolean).join('\n');

        const diagnostics = await buildVaultDiagnostics({
          vaultPath: config.vaultPath,
          vaultName: config.vaultName,
          relativePath,
          createFolder: true,
        });

        if (!diagnostics.vaultExists) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: false,
            error: 'VAULT_NOT_FOUND',
            message: 'ה-vault שהוגדר לא נמצא בנתיב המקומי',
            ...diagnostics,
          }));
          return;
        }

        const { default: fs } = await import('fs');
        try {
          const fileTitle = String(relativePath.split('/').pop() || 'Note').replace(/\.md$/i, '').trim() || 'Note';
          if (!fs.existsSync(diagnostics.absoluteFilePath)) {
            fs.writeFileSync(diagnostics.absoluteFilePath, `# ${fileTitle}\n\n`, 'utf-8');
          }

          const before = fs.readFileSync(diagnostics.absoluteFilePath, 'utf-8');
          const alreadyExists = verifyKeyPoints.length > 0 && verifyKeyPoints.every(point => before.includes(point));

          if (!alreadyExists && entryContent) {
            const separator = before.trim().endsWith('\n') ? '\n' : '\n\n';
            fs.appendFileSync(diagnostics.absoluteFilePath, `${separator}${entryContent.trim()}\n`, 'utf-8');
          }

          const after = fs.readFileSync(diagnostics.absoluteFilePath, 'utf-8');
          const verified = verifyKeyPoints.length > 0
            ? verifyKeyPoints.every(point => after.includes(point))
            : after.includes(entryContent.trim());

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: true,
            alreadyExists,
            verified,
            savedPath: relativePath,
            absolutePath: diagnostics.absoluteFilePath,
            obsidianUrl: diagnostics.obsidianUrl,
            ...diagnostics,
          }));
        } catch (err) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'WRITE_FAILED', message: err.message, ...diagnostics }));
        }
      });
    },
  };
}

function makeKnowledgeLibraryEnsurePlugin(env) {
  return {
    name: 'knowledge-library-ensure',
    configureServer(server) {
      server.middlewares.use('/api/vault/knowledge-library/ensure', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
          return;
        }

        let body;
        try {
          body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', chunk => { data += chunk; });
            req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
            req.on('error', reject);
          });
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_BODY' }));
          return;
        }

        const config = getVaultRequestConfig(body, env);
        if (!config.vaultPath) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: false,
            error: 'NO_VAULT_PATH',
            message: 'נתיב ה-vault לא מוגדר',
          }));
          return;
        }

        const requestedPaths = (Array.isArray(body.paths) ? body.paths : [])
          .map(item => sanitizeVaultRelativePath(item))
          .filter(Boolean);

        if (requestedPaths.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'NO_PATHS' }));
          return;
        }

        const { default: fs } = await import('fs');
        const ensured = [];

        for (const relativePath of requestedPaths) {
          const diagnostics = await buildVaultDiagnostics({
            vaultPath: config.vaultPath,
            vaultName: config.vaultName,
            relativePath,
            createFolder: true,
          });

          if (!diagnostics.vaultExists) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              ok: false,
              error: 'VAULT_NOT_FOUND',
              message: 'ה-vault שהוגדר לא נמצא בנתיב המקומי',
              ...diagnostics,
            }));
            return;
          }

          const title = String(relativePath.split('/').pop() || 'Note').replace(/\.md$/i, '').trim() || 'Note';
          const existedBefore = fs.existsSync(diagnostics.absoluteFilePath);
          if (!existedBefore) {
            fs.writeFileSync(diagnostics.absoluteFilePath, `# ${title}\n\n`, 'utf-8');
          }

          ensured.push({
            path: relativePath,
            absolutePath: diagnostics.absoluteFilePath,
            existed: existedBefore,
            created: !existedBefore,
            verified: fs.existsSync(diagnostics.absoluteFilePath),
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          vaultName: config.vaultName,
          vaultPath: config.vaultPath,
          ensuredCount: ensured.length,
          createdCount: ensured.filter(item => item.created).length,
          ensured,
        }));
      });
    },
  };
}

// Route: GET /api/vault/list?topic=<topicName>
// Returns all immediate subdirectory names (and .md file stems) under vault/<topic>/.
// Used by the sub-topic pill dropdown to populate options from the real Obsidian vault.
function makeVaultListPlugin(env) {
  return {
    name: 'vault-list',
    configureServer(server) {
      server.middlewares.use('/api/vault/list', async (req, res) => {
        if (req.method !== 'GET') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
          return;
        }
        const url = new URL(req.url, 'http://localhost');
        const topic = (url.searchParams.get('topic') || '').replace(/\.\./g, '').trim();
        const vaultPath = (url.searchParams.get('vaultPath') || env.OBSIDIAN_VAULT_PATH || env.VITE_OBSIDIAN_VAULT_PATH || '').trim();
        if (!vaultPath || !topic) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, subtopics: [] }));
          return;
        }
        const { default: fs } = await import('fs');
        const nodePath = await import('path');
        try {
          if (!fs.existsSync(vaultPath)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, subtopics: [], message: 'VAULT_NOT_FOUND' }));
            return;
          }
          const topicDir = nodePath.default.join(vaultPath, topic);
          if (!fs.existsSync(topicDir)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, subtopics: [] }));
            return;
          }
          const entries = fs.readdirSync(topicDir, { withFileTypes: true });
          const subtopics = entries
            .filter(e => !e.name.startsWith('.') && !e.name.startsWith('_'))
            .map(e => e.isDirectory() ? e.name : (e.name.endsWith('.md') ? e.name.slice(0, -3) : null))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, 'he'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, subtopics }));
        } catch (err) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, subtopics: [], message: err.message }));
        }
      });
    },
  };
}

// Route: POST /api/gemini-hebrew-titles
// Lightweight: generate Hebrew chapter titles using Gemini flash-lite.
// ─────────────────────────────────────────────────────────────────────────────
function makeHebrewChapterTitlesPlugin(env) {
  return {
    name: 'gemini-hebrew-titles',
    configureServer(server) {
      server.middlewares.use('/api/gemini-hebrew-titles', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
          return;
        }
        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'GEMINI_API_KEY_MISSING', hebrewTitles: [] }));
          return;
        }
        try {
          const body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', chunk => { data += chunk; });
            req.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
            req.on('error', reject);
          });
          const { videoTitle = '', category = '', subCategory = '', chapters = [] } = body;
          if (!Array.isArray(chapters) || chapters.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'NO_CHAPTERS' }));
            return;
          }
          const chapterLines = chapters.map((ch, i) => {
            const ts = ch.startSeconds != null
              ? '[' + Math.floor(ch.startSeconds) + 's]'
              : '[פרק ' + (i + 1) + ']';
            const snippet = typeof ch.transcriptText === 'string' && ch.transcriptText.trim().length > 0
              ? ' — קטע: "' + ch.transcriptText.trim().slice(0, 300) + '"'
              : '';
            return (i + 1) + '. ' + ts + ' ' + ch.title + snippet;
          }).join('\n');

          const prompt = 'אתה עוזר לימוד. תפקידך לתרגם ולנסח מחדש כותרות פרקים לעברית בצורה ברורה ותמציתית.\n\n'
            + 'כותרת הסרטון: ' + videoTitle + '\n'
            + 'קטגוריה: ' + category + '\n'
            + 'תת-קטגוריה: ' + subCategory + '\n\n'
            + 'פרקים לעיבוד:\n' + chapterLines + '\n\n'
            + 'הוראות:\n'
            + '- צור כותרת עברית קצרה (4-8 מילים) לכל פרק.\n'
            + '- הכותרת חייבת לשקף את תוכן הפרק, לא להיות תרגום מילולי.\n'
            + '- אל תשתמש ב-"פרק 1", "פתיח" וכו\'\' — כותרת ספציפית בלבד.\n'
            + '- החזר JSON בלבד, ללא markdown, בפורמט הזה:\n'
            + '{"hebrewTitles": ["כותרת 1", "כותרת 2", ...]}\n\n'
            + 'מספר הכותרות חייב להיות בדיוק ' + chapters.length + '.';

          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });
          const result = await model.generateContent(prompt);
          let raw = result.response.text().trim();
          raw = raw.replace(/^```jsons*/i, '').replace(/```s*$/, '').trim();
          const parsed = JSON.parse(raw);
          const titles = Array.isArray(parsed.hebrewTitles)
            ? parsed.hebrewTitles.map(title => String(title || '').trim())
            : [];
          if (titles.length !== chapters.length || titles.some(title => !title)) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: 'INVALID_MODEL_RESPONSE',
              message: 'Hebrew title count did not match the chapter count',
            }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ hebrewTitles: titles }));
        } catch (err) {
          console.error('[gemini-hebrew-titles] error:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'GENERATION_FAILED', message: err.message }));
        }
      });
    },
  };
}

function makeAiMappingDiagnosisPlugin(env) {
  return {
    name: 'gemini-ai-mapping-diagnosis',
    configureServer(server) {
      server.middlewares.use('/api/gemini-ai-mapping-diagnosis', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
          return;
        }
        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'GEMINI_API_KEY_MISSING' }));
          return;
        }
        let body;
        try {
          body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', chunk => { data += chunk; });
            req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
            req.on('error', reject);
          });
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_BODY' }));
          return;
        }
        const diagnosticReport = body?.diagnosticReport;
        if (!diagnosticReport) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'MISSING_REPORT' }));
          return;
        }
        const reportStr = JSON.stringify(diagnosticReport, null, 2);
        const prompt = `You are a debugging assistant for a React app that maps YouTube video AI analysis into 7 universal tabs: summary, chapters, insights, useful-knowledge, app-builder, topics-subtopics, specialized.

Analyze the diagnostic report below and return ONLY valid JSON (no markdown fences, no extra text) with this exact structure:
{
  "status": "ok",
  "working": ["what works correctly"],
  "issues": [{"severity":"high|medium|low","area":"tabs.summary","problem":"what is broken","evidence":"what data shows this","recommendedFix":"minimal fix"}],
  "missingData": ["missing fields or data sources"],
  "unmappedData": ["fields that exist but are not mapped to any tab"],
  "tabMappingPlan": {"summary":[],"chapters":[],"insights":[],"usefulKnowledge":[],"appBuilder":[],"topics":[],"specialized":[]},
  "fixPromptForClaudeCode": "A complete ready-to-use English prompt that a developer can paste into Claude Code to fix the most critical issue"
}

Diagnostic report:
${reportStr}`;
        try {
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
          });
          let raw = result.response.text().trim();
          raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```\s*$/i, '').trim();
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = {
              status: 'raw', rawText: raw,
              issues: [{ severity: 'high', area: 'parse', problem: 'AI returned non-JSON', evidence: raw.slice(0, 300), recommendedFix: 'Check prompt or model output' }],
              working: [], missingData: [], unmappedData: [], tabMappingPlan: {}, fixPromptForClaudeCode: '',
            };
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, result: parsed }));
        } catch (err) {
          console.error('[gemini-ai-mapping-diagnosis] error:', err.message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'DIAGNOSIS_FAILED', message: err.message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // loadEnv with '' prefix loads ALL vars from .env (not just VITE_ ones)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    logLevel: 'error',
    server: {
      port: 5184,
      strictPort: true,
      warmup: {
        clientFiles: [
          './src/components/dashboard/briefTableLayout.jsx',
          './src/components/dashboard/BriefSentimentNotesTable.jsx',
          './src/components/dashboard/MacroStyleInsightCards.jsx',
          './src/lib/chapterCountUtils.js',
          './src/lib/chapterTitleUtils.js',
          './src/lib/chapterTopicBoundaries.js',
        ],
      },
    },
    plugins: [
      makeRssProxyPlugin(),
      makeFearGreedProxyPlugin(),
      makeChannelResolverPlugin(),
      makeYoutubeTranscriptPlugin(),
      makeGeminiVideoContentPlugin(env),
      makeGeminiPlugin(env),
      makeRowTimestampsPlugin(env),
      makeClaudeVideoAnalyzePlugin(env),
      makePoliticalSummaryPlugin(env),
      makeYouTubeVideoMetadataPlugin(),
      makeVaultDiagnosticsPlugin(env),
      makeVaultReadPlugin(env),
      makeVaultWritePlugin(env),
      makeVaultAppendPlugin(env),
      makeKnowledgeLibraryEnsurePlugin(env),
      makeVaultListPlugin(env),
      makeHebrewChapterTitlesPlugin(env),
      makeAiMappingDiagnosisPlugin(env),
      base44({
        legacySDKImports: false,
        hmrNotifier: true,
        navigationNotifier: true,
        analyticsTracker: true,
        visualEditAgent: true,
      }),
      react(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
