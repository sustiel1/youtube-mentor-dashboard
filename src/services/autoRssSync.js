// ─── Auto RSS Sync Service ───────────────────────────────────────────────────
// Syncs YouTube RSS feeds to localStorage once every 8 hours.
// Deduplication is delegated to upsertVideos (videoStorage.js).
//
// API:
//   shouldAutoSync()          → true if ≥ 8h since last sync (or never synced)
//   runAutoSync(mentors)      → fetch RSS for all mentors with valid channelId, save new videos
//   getLastSyncAt()           → Date | null
//   getLastSyncResult()       → { addedCount, syncedAt } | null

import { fetchChannelRSSFromSource, RSS_FETCH_LIMIT } from './rssIngestion';
import { upsertVideos } from './videoStorage';

export const AUTO_SYNC_INTERVAL_MS = 8 * 60 * 60 * 1000; // 8 hours

const LAST_SYNC_KEY        = 'yt_mentor_last_sync_v1';
const LAST_SYNC_RESULT_KEY = 'yt_mentor_last_sync_result_v1';

export function getLastSyncAt() {
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    return raw ? new Date(raw) : null;
  } catch { return null; }
}

function setLastSyncAt(date) {
  try { localStorage.setItem(LAST_SYNC_KEY, date.toISOString()); } catch {}
}

export function getLastSyncResult() {
  try {
    const raw = localStorage.getItem(LAST_SYNC_RESULT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setLastSyncResult(result) {
  try { localStorage.setItem(LAST_SYNC_RESULT_KEY, JSON.stringify(result)); } catch {}
}

// Returns true if no sync has happened yet, or last sync was ≥ 8 hours ago
export function shouldAutoSync() {
  const last = getLastSyncAt();
  if (!last) return true;
  return Date.now() - last.getTime() >= AUTO_SYNC_INTERVAL_MS;
}

// Fetch RSS for all mentors with a valid youtubeChannelId, upsert new videos to localStorage.
// Never saves to Base44. Updates lastSyncAt and lastSyncResult on completion.
export async function runAutoSync(mentors) {
  const eligible = mentors.filter(
    (m) =>
      m.youtubeChannelId &&
      m.youtubeChannelId.startsWith('UC') &&
      m.youtubeChannelId.length === 24
  );

  if (!eligible.length) {
    console.info('[autoRssSync] אין מנטורים עם Channel ID תקין — מדלג');
    return { addedCount: 0, syncedAt: new Date() };
  }

  console.info(`[autoRssSync] מתחיל sync עבור ${eligible.length} מנטורים`);

  let totalAdded = 0;

  for (const mentor of eligible) {
    try {
      // source=null → fetchChannelRSSFromSource falls back to mentor.youtubeChannelId
      const fetched = await fetchChannelRSSFromSource(mentor, null, [], RSS_FETCH_LIMIT);

      // Strip internal fields (_videoId, _channelName) before saving
      const toSave = fetched.map(({ _videoId, _channelName, ...rest }) => rest);

      // upsertVideos deduplicates by URL and YouTube video ID
      const added = upsertVideos(toSave);

      console.info(
        `[autoRssSync] ${mentor.name}: ${fetched.length} ב-RSS, ` +
        `${fetched.length - added.length} קיימים, ${added.length} חדשים`
      );

      totalAdded += added.length;
    } catch (err) {
      console.warn(`[autoRssSync] ${mentor.name}: נכשל — ${err.message}`);
    }
  }

  const syncedAt = new Date();
  setLastSyncAt(syncedAt);
  setLastSyncResult({ addedCount: totalAdded, syncedAt: syncedAt.toISOString() });

  console.info(`[autoRssSync] הסתיים — ${totalAdded} סרטונים חדשים נוספו`);

  return { addedCount: totalAdded, syncedAt };
}
