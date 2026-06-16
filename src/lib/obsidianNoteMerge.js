/**
 * Merge per-item Obsidian row saves into an existing note without overwriting.
 * Uses HTML comment markers for item-level dedupe (invisible in Obsidian reading view).
 */

export const OBSIDIAN_ITEM_MARKER_PREFIX = 'obsidian-item:';

export function buildObsidianItemMarker(identityKey) {
  const key = String(identityKey || '').trim();
  if (!key) return '';
  const normalized = key.startsWith(OBSIDIAN_ITEM_MARKER_PREFIX)
    ? key
    : `${OBSIDIAN_ITEM_MARKER_PREFIX}${key}`;
  return `<!-- ${normalized} -->`;
}

export function noteContainsItemMarker(content, identityKey) {
  const marker = buildObsidianItemMarker(identityKey);
  return Boolean(marker && String(content || '').includes(marker));
}

function escapeSectionLabel(label) {
  return String(label || 'כללי').trim() || 'כללי';
}

/**
 * Insert a bullet line into the matching ## section, preserving all other content.
 */
export function insertBulletIntoSection(content, sectionLabel, bulletBlock) {
  const base = String(content || '');
  const sectionHeader = `## ${escapeSectionLabel(sectionLabel)}`;
  const headerIdx = base.indexOf(sectionHeader);

  if (headerIdx >= 0) {
    const afterHeader = headerIdx + sectionHeader.length;
    const rest = base.slice(afterHeader);
    const nextSection = rest.search(/\n## /);
    const footer = rest.search(/\n---/);
    let endOffset = rest.length;
    if (nextSection >= 0) endOffset = Math.min(endOffset, nextSection);
    if (footer >= 0) endOffset = Math.min(endOffset, footer);

    const sectionBody = rest.slice(0, endOffset);
    const insertAt = afterHeader + endOffset;
    const gap = sectionBody.trim() ? '\n' : '\n\n';
    return `${base.slice(0, insertAt)}${gap}${bulletBlock}\n${base.slice(insertAt)}`;
  }

  const footerIdx = base.indexOf('\n---');
  const block = `\n## ${escapeSectionLabel(sectionLabel)}\n\n${bulletBlock}\n`;
  if (footerIdx >= 0) {
    return `${base.slice(0, footerIdx)}${block}${base.slice(footerIdx)}`;
  }
  return `${base.trimEnd()}\n${block}`;
}

function buildBulletBlock(text, identityKey, timestamp) {
  const body = String(text || '').trim();
  const marker = buildObsidianItemMarker(identityKey);
  const ts = timestamp ? ` (${timestamp})` : '';
  return `* ${body}${ts}\n${marker}`;
}

/**
 * @param {object} params
 * @param {string} [params.existingContent]
 * @param {string} [params.videoTitle]
 * @param {Array<{ text, sectionLabel?, identityKey, timestamp? }>} params.items
 * @param {string[]} [params.footerLines]
 * @returns {{ content: string, changed: boolean, added: number, skipped: number }}
 */
export function mergeItemsIntoObsidianNote({
  existingContent = '',
  videoTitle = '',
  items = [],
  footerLines = [],
} = {}) {
  const incoming = (Array.isArray(items) ? items : []).filter((item) => String(item?.text || '').trim());
  let content = String(existingContent || '');
  const isNewFile = !content.trim();
  let added = 0;
  let skipped = 0;

  if (isNewFile) {
    const title = String(videoTitle || 'הערה').trim() || 'הערה';
    content = `# ${title}\n\n`;
  }

  incoming.forEach((item) => {
    const identityKey = String(item.identityKey || '').trim();
    if (!identityKey) return;

    if (noteContainsItemMarker(content, identityKey)) {
      skipped += 1;
      return;
    }

    const bulletBlock = buildBulletBlock(item.text, identityKey, item.timestamp);
    content = insertBulletIntoSection(content, item.sectionLabel, bulletBlock);
    added += 1;
  });

  if (isNewFile && added > 0 && footerLines.length > 0) {
    content = `${content.trimEnd()}\n\n---\n${footerLines.filter(Boolean).join('\n')}\n`;
  }

  return {
    content,
    changed: added > 0,
    added,
    skipped,
  };
}
