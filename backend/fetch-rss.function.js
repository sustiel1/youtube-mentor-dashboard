/**
 * Base44 Backend Function: FetchRSS
 *
 * HOW TO DEPLOY:
 * 1. Open your Base44 project → Functions → Create New Function
 * 2. Name it exactly: FetchRSS
 * 3. Paste this code into the function editor
 * 4. Save & Deploy
 *
 * INPUT:  { channelId: string }  — YouTube channel ID (starts with "UC", 24 chars)
 * OUTPUT: { xml: string }        — raw RSS XML string for client-side parsing
 */

async function handler({ channelId }) {
  // ── Validation ─────────────────────────────────────────────────────────
  if (!channelId) {
    throw new Error('channelId is required');
  }

  if (!channelId.startsWith('UC') || channelId.length !== 24) {
    throw new Error(
      `Channel ID לא תקין: "${channelId}" — חייב להתחיל ב-UC ולהיות 24 תווים`
    );
  }

  // ── Fetch YouTube RSS ──────────────────────────────────────────────────
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

  const response = await fetch(rssUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)' },
  });

  if (!response.ok) {
    const hint = response.status === 404
      ? `Channel ID "${channelId}" לא נמצא ב-YouTube RSS.`
      : `YouTube returned HTTP ${response.status}`;
    throw new Error(hint);
  }

  const xml = await response.text();

  // Sanity check — a valid YouTube RSS feed always contains <feed>
  if (!xml.includes('<feed')) {
    throw new Error(`תגובה לא תקינה מ-YouTube עבור channel ${channelId}.`);
  }

  return { xml };
}

module.exports = { handler };
