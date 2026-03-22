/**
 * Base44 Backend Function: ResolveChannel
 *
 * HOW TO DEPLOY:
 * 1. Open your Base44 project → Functions → Create New Function
 * 2. Name it exactly: ResolveChannel
 * 3. Paste this code into the function editor
 * 4. Save & Deploy
 *
 * INPUT:  { handle: string }  — YouTube handle (e.g. "@MichaStocks" or full URL)
 * OUTPUT: { handle, channelId, url }
 */

async function handler({ handle }) {
  if (!handle) {
    throw new Error('handle is required');
  }

  // ── Build channel URL ──────────────────────────────────────────────────
  const channelUrl = handle.startsWith('http')
    ? handle
    : `https://www.youtube.com/${handle.startsWith('@') ? handle : '@' + handle}`;

  // ── Fetch YouTube channel page ─────────────────────────────────────────
  const response = await fetch(channelUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`YouTube returned ${response.status} for ${channelUrl}`);
  }

  const html = await response.text();

  // ── Extract channelId from page HTML ───────────────────────────────────
  // YouTube embeds channelId in several places in the initial JS data
  const patterns = [
    /"channelId":"(UC[\w-]{22})"/,
    /"externalId":"(UC[\w-]{22})"/,
    /"browseId":"(UC[\w-]{22})"/,
    /channel\/(UC[\w-]{22})/,
  ];

  let channelId = null;
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      channelId = match[1];
      break;
    }
  }

  return { handle, channelId, url: channelUrl };
}

module.exports = { handler };
