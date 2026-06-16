/**
 * Obsidian export helpers for Market App Brain (append-only).
 * Path: App Ideas/Market App Brain/{Ideas|Features|...}.md
 */
import { APP_IDEAS_BRAIN_SECTIONS } from '@/lib/extractAppIdeas';
import { getObsidianVaultRequestFields } from '@/lib/obsidianVaultConfig';

const BRAIN_ROOT = 'App Ideas/Market App Brain';

export function getMarketAppBrainPath(fileName) {
  const safe = String(fileName || 'Ideas.md').replace(/[/\\]/g, '');
  return `${BRAIN_ROOT}/${safe}`;
}

export function getMarketAppBrainSectionPath(sectionKey) {
  const def = APP_IDEAS_BRAIN_SECTIONS.find((s) => s.key === sectionKey);
  return getMarketAppBrainPath(def?.file || 'Ideas.md');
}

function resolveVideoUrl(video = {}) {
  const id = video.videoId || video.id;
  if (id && /^[a-zA-Z0-9_-]{11}$/.test(String(id))) {
    return `https://www.youtube.com/watch?v=${id}`;
  }
  return String(video.url || video.link || '').trim() || '';
}

function resolveVideoDate(video = {}) {
  const raw = video.publishedAt || video.uploadDate || video.date || video.createdAt;
  if (!raw) return new Date().toISOString().slice(0, 10);
  try {
    return new Date(raw).toISOString().slice(0, 10);
  } catch {
    return String(raw).slice(0, 10);
  }
}

/**
 * Builds a single append entry for vault/append API.
 */
export function buildMarketAppBrainEntry(item, video, topicName = '') {
  const title = item?.title || 'Untitled';
  const content = item?.content || '';
  const url = resolveVideoUrl(video);
  const savedAt = new Date().toISOString();
  const channel = video?.channelTitle || video?.channelName || video?.channel || video?.mentorName || '—';
  const category = topicName || video?.category || '—';
  const subCategory = video?.subCategory || '—';
  const tags = ['market-app-brain', item?.category || 'idea', 'youtube-mentor'].join(', ');

  return [
    `### ${title}`,
    '',
    content,
    '',
    `- **Source Video:** ${video?.title || '—'}`,
    url ? `- **Source URL:** ${url}` : null,
    `- **Source Date:** ${resolveVideoDate(video)}`,
    `- **Channel/Mentor:** ${channel}`,
    `- **Category:** ${category}`,
    `- **SubCategory:** ${subCategory}`,
    `- **SavedAt:** ${savedAt}`,
    `- **Tags:** ${tags}`,
    item?.sourcePath ? `- **Trace:** \`${item.sourcePath}\`` : null,
    '',
  ].filter((line) => line !== null).join('\n');
}

/**
 * Append selected brain items to Obsidian Market App Brain files.
 * @returns {Promise<{ ok: boolean, saved: number, paths: string[], errors: string[] }>}
 */
export async function appendMarketAppBrainItems(items, video, topicName = '') {
  if (!items?.length) {
    return { ok: false, saved: 0, paths: [], errors: ['אין פריטים לשמירה'] };
  }

  const { vaultPath, vaultName } = getObsidianVaultRequestFields();
  const byFile = new Map();

  for (const item of items) {
    const path = getMarketAppBrainSectionPath(item.sectionKey || item.category);
    if (!byFile.has(path)) byFile.set(path, []);
    byFile.get(path).push(item);
  }

  let saved = 0;
  const paths = [];
  const errors = [];

  for (const [relativePath, fileItems] of byFile.entries()) {
    const pathParts = relativePath.split('/');
    const manualFile = pathParts.pop() || 'Ideas.md';
    const manualFolder = pathParts.join('/');

    for (const item of fileItems) {
      const entryContent = buildMarketAppBrainEntry(item, video, topicName);
      const verifyKey = `${item.id}::${String(item.content || '').slice(0, 80)}`;

      try {
        const res = await fetch('/api/vault/append', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vaultPath,
            vaultName,
            manualFolder,
            manualFile,
            path: relativePath,
            content: entryContent,
            verifyKeyPoints: [verifyKey],
            videoTitle: video?.title || null,
            channelTitle: video?.channelTitle || video?.channelName || null,
            url: resolveVideoUrl(video) || null,
            date: resolveVideoDate(video),
          }),
        });
        const data = await res.json();
        if (data.ok) {
          saved += 1;
          if (!paths.includes(relativePath)) paths.push(relativePath);
        } else {
          errors.push(data.message || data.error || relativePath);
        }
      } catch (err) {
        errors.push(err?.message || String(err));
      }
    }
  }

  return { ok: saved > 0, saved, paths, errors };
}
