import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'

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
              shortSummary: `[MOCK] הסרטון "${title}" מציג גישה מעמיקה לנושא. זוהי תוצאה מדומה לבדיקת UI.`,
              fullSummary: `[MOCK] הסרטון מכסה נושאים מרכזיים ומציג גישות מעשיות ברורות. כל התוכן הוא לבדיקה בלבד.`,
              keyPoints: [
                '[MOCK] נקודה ראשונה — מושג מרכזי מהסרטון',
                '[MOCK] נקודה שנייה — יישום מעשי',
                '[MOCK] נקודה שלישית — דוגמה מהסרטון',
                '[MOCK] נקודה רביעית — תובנה חשובה',
              ],
              tags: ['mock', 'בדיקה'],
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

export default defineConfig(({ mode }) => {
  // loadEnv with '' prefix loads ALL vars from .env (not just VITE_ ones)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    logLevel: 'error',
    plugins: [
      makeRssProxyPlugin(),
      makeChannelResolverPlugin(),
      makeGeminiPlugin(env),
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
