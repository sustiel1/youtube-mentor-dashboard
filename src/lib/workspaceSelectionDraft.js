function normalizedText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

/** Build one Workspace draft per logical selected row, independent of alias IDs. */
export function buildWorkspaceSelectionDraft(entries = [], activeTab = '') {
  const drafts = [];
  const seenLogicalItems = new Set();

  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const [id, item = {}] = entry;
    const text = normalizedText(item.text);
    if (!text) continue;
    const type = item.type || item.tabScope || '';
    const logicalKey = `${type}\0${text}`;
    if (seenLogicalItems.has(logicalKey)) continue;
    seenLogicalItems.add(logicalKey);

    drafts.push({
      id,
      text,
      sectionLabel: item.sectionLabel || '',
      type,
      tabScope: item.tabScope || activeTab,
      sectionKey: item.sectionKey || item.sourceSectionId || item.type || 'unsectioned',
      sourceSectionId: item.sourceSectionId || item.sectionKey || item.type || null,
      timestamp: item.timestamp ?? null,
      ...(item.newsMetadata ? { newsMetadata: item.newsMetadata } : {}),
    });
  }

  return drafts;
}

