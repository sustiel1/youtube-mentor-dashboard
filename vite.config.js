import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import { YoutubeTranscript } from 'youtube-transcript'

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

  function buildGeminiAnalysisPrompt({ title, channelName, mentor, category, chaptersTarget, durationSeconds, userNotes }) {
    return [
      'נתח את הסרטון ביסודיות והחזר JSON בלבד, בלי markdown ובלי טקסט נוסף.',
      '',
      '═══ מטרת הניתוח ═══',
      'המטרה: חלץ ידע אישי מקצועי שניתן לעשות בו שימוש חוזר.',
      'שאל: "אם שכחתי לגמרי את הסרטון — מה הייתי רוצה שיישאר?" — זה הידע שצריך לחלץ.',
      '',
      '═══ כללי פרקים ═══',
      `צור בערך ${chaptersTarget || 6} פרקים איכותיים שמכסים את כל הסרטון.`,
      'כל כותרת פרק חייבת להיות ספציפית. אסור: "פתיח", "סיכום", "פרק 1".',
      'כלול startSeconds ו-endSeconds לכל פרק.',
      '',
      '═══ כללי איכות ═══',
      'אסור: "placeholder", ביטויים גנריים.',
      'אם אין חומר לשדה — החזר מערך ריק.',
      'עברית תקינה וברורה.',
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
      JSON.stringify({
        shortSummary: '2-3 משפטים',
        fullSummary: '4-6 משפטים עם תובנות מעשיות',
        keyPoints: ['...'],
        chapters: [{ title: '...', startSeconds: 0, endSeconds: 120, summary: '...', keyPoints: ['...'] }],
        keyInsights: ['...'],
        actionItems: ['...'],
        rules: ['...'],
        mainLesson: '...',
        strategyOrMethod: '...',
        tags: ['...'],
      }, null, 2),
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
        } = body;

        const ytUrl = youtubeUrl || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);

        try {
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(apiKey);
          const prompt = buildGeminiAnalysisPrompt({ title, channelName, mentor, category, chaptersTarget, durationSeconds, userNotes });

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
              const cleaned = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/, '').trim();
              const parsed = JSON.parse(cleaned);
              const sufficient = isResultSufficient(parsed);
              console.log(`[gemini-video-content] URL result sufficient=${sufficient}`);

              if (sufficient || analysisMode === 'url_only') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ...parsed, analysisSource: 'youtube_url', analysisMode: 'fast', lowConfidence: !sufficient }));
                return;
              }
              urlAnalysisResult = parsed;
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
          const cleaned = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/, '').trim();
          const parsed = JSON.parse(cleaned);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ...parsed, analysisSource: 'transcript', analysisMode: 'transcript' }));
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

          // publishedAt — meta tag is most reliable
          const metaDateMatch = html.match(/<meta itemprop="datePublished" content="([\d-]+)">/);
          const jsonDateMatch = html.match(/"publishDate":"([\d-]+)"/);
          const rawDate = metaDateMatch?.[1] || jsonDateMatch?.[1] || null;
          const publishedAt = rawDate ? `${rawDate}T00:00:00Z` : null;

          const result = {
            channelId,
            channelTitle,
            channelUrl: channelId ? `https://www.youtube.com/channel/${channelId}` : null,
            viewCount,
            duration,
            publishedAt,
          };

          console.log(`[yt-metadata] ← result for ${videoId}:`, {
            channelId: result.channelId || '(none)',
            channelTitle: result.channelTitle || '(none)',
            viewCount: result.viewCount ?? '(none)',
            duration: result.duration || '(none)',
            publishedAt: result.publishedAt || '(none)',
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

export default defineConfig(({ mode }) => {
  // loadEnv with '' prefix loads ALL vars from .env (not just VITE_ ones)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    logLevel: 'error',
    server: {
      port: 5184,
      strictPort: true,
    },
    plugins: [
      makeRssProxyPlugin(),
      makeChannelResolverPlugin(),
      makeYoutubeTranscriptPlugin(),
      makeGeminiVideoContentPlugin(env),
      makeGeminiPlugin(env),
      makeYouTubeVideoMetadataPlugin(),
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
