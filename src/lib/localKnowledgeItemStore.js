import { loadTopics } from "@/services/topicStorage";
import { buildAtomicKnowledgeMarkdown, buildVideoLearningNote, getSelectedAtomicKnowledge, resolvePrimaryTopic, slugify } from "@/lib/obsidianExport";

const STORAGE_KEY = "yt_knowledge_items_v1";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("[localKnowledgeItemStore] write failed:", e?.message || e);
  }
}

function nowIso() {
  return new Date().toISOString();
}

function stableKnowledgeItemId({ sourceType, sourceId }) {
  return `${sourceType}:${sourceId}`;
}

export function getKnowledgeItems() {
  return readAll().sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
}

export function getKnowledgeItemsByTopic(topicId) {
  if (!topicId) return [];
  return getKnowledgeItems().filter((i) => i.topicId === topicId);
}

export function upsertKnowledgeItem(item) {
  if (!item || !item.id) return null;
  const all = readAll();
  const idx = all.findIndex((i) => i.id === item.id);
  const next = [...all];
  if (idx === -1) next.unshift(item);
  else next[idx] = item;
  writeAll(next);
  // Notify same-tab listeners (e.g. TopicKnowledgePage) that items changed
  try { window.dispatchEvent(new CustomEvent("knowledge-items-updated")); } catch { /* non-browser env */ }
  return item;
}

export function removeKnowledgeItem(id) {
  const all = readAll();
  const next = all.filter((i) => i.id !== id);
  if (next.length === all.length) return false;
  writeAll(next);
  return true;
}

export function createKnowledgeItemFromNote(note, brainId) {
  const id = `note:${note.id}`;
  const topics = loadTopics?.() || [];
  const topic = brainId ? topics.find((t) => t.id === brainId) : null;
  const topicName = topic?.name || "General";
  const safeTitle = slugify(note.title || "note", 70) || "note";
  return {
    id,
    sourceType: "note",
    sourceId: note.id,
    title: note.title || "Untitled",
    topicId: brainId ?? null,
    kind: "note",
    markdown: `# ${note.title}\n\n${note.content || ""}`,
    workspacePath: `Workspace/${topicName}/Notes/${safeTitle}.md`,
    createdAt: note.createdAt || nowIso(),
    updatedAt: nowIso(),
    metadata: { tags: note.tags || [], sourceType: note.sourceType || "manual" },
  };
}

export function createKnowledgeItemFromIdea({ title, excerpt, brainId }) {
  const id = `idea:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const topics = loadTopics?.() || [];
  const topic = brainId ? topics.find((t) => t.id === brainId) : null;
  const topicName = topic?.name || "General";
  const safeTitle = slugify(title || "idea", 70) || "idea";
  return {
    id,
    sourceType: "idea",
    sourceId: id,
    title: title || "Untitled",
    topicId: brainId ?? null,
    kind: "idea",
    markdown: `# ${title}\n\n${excerpt || ""}`,
    workspacePath: `Workspace/${topicName}/Ideas/${safeTitle}.md`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    metadata: { excerpt: excerpt || null },
  };
}

export function createKnowledgeItemFromLink({ url, title, brainId }) {
  const id = `link:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const topics = loadTopics?.() || [];
  const topic = brainId ? topics.find((t) => t.id === brainId) : null;
  const topicName = topic?.name || "General";
  const safeTitle = slugify(title || "link", 70) || "link";
  return {
    id,
    sourceType: "link",
    sourceId: id,
    title: title || url || "Untitled",
    topicId: brainId ?? null,
    kind: "link",
    markdown: `# ${title || url}\n\n[פתח קישור](${url})`,
    workspacePath: `Workspace/${topicName}/Links/${safeTitle}.md`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    metadata: { url: url || null },
  };
}

/**
 * Minimal helper to turn a video into a KnowledgeItem.
 * This is intentionally lightweight: localStorage only, no migrations, no refactors.
 */
export function createKnowledgeItemFromVideo(video, topicId) {
  const v = video || {};
  const sourceType = "youtube";
  const sourceId = String(v.videoId || v.id || "");
  const id = stableKnowledgeItemId({ sourceType, sourceId });

  const topics = loadTopics?.() || [];
  const topic = topicId ? topics.find((t) => t.id === topicId) : null;
  const topicName = topic?.name || resolvePrimaryTopic(v) || "General";

  const safeTitle = slugify(v.title || "video", 70) || "video";
  const workspacePath = `Workspace/${topicName}/Learnings/${safeTitle}.md`;

  const channel = v.channelTitle || v.channel || "";
  const note = buildVideoLearningNote(v, channel, topicName, []);

  const selections = v.selectedKnowledgeItems;

  // If selections are explicitly set, check that at least one item is selected
  if (selections !== undefined && selections !== null) {
    const selected = getSelectedAtomicKnowledge(v, selections);
    const hasAny =
      selected.mainLesson ||
      selected.keyInsights.length > 0 ||
      (selected.brainHighlights && selected.brainHighlights.length > 0) ||
      selected.rules.length > 0 ||
      selected.actionItems.length > 0 ||
      selected.mistakesToAvoid.length > 0 ||
      selected.concepts.length > 0 ||
      (selected.frameworks && selected.frameworks.length > 0) ||
      (selected.questions && selected.questions.length > 0) ||
      (selected.quotes && selected.quotes.length > 0);
    if (!hasAny) return null;
  }

  // Priority: structured atomic fields (filtered by selection) → brainSummary blob → existing builder
  const atomicMarkdown = buildAtomicKnowledgeMarkdown(v, selections);
  const brainMarkdown  = v.brainSummary ? v.brainSummary.trim() : null;
  const markdown = atomicMarkdown || brainMarkdown || note?.content || "";

  const createdAt = v.createdAt || v.analyzedAt || v.publishedAt || nowIso();
  const updatedAt = nowIso();

  const formatMeta =
    typeof v.obsidianFormat === "string" && v.obsidianFormat.trim()
      ? v.obsidianFormat.trim()
      : typeof v.obsidianTemplate === "string" && v.obsidianTemplate.trim()
        ? v.obsidianTemplate.trim()
        : null;

  return {
    id,
    sourceType,
    sourceId,
    title: v.title || "Untitled",
    topicId: topicId ?? null,
    kind: "learning",
    markdown,
    workspacePath,
    createdAt,
    updatedAt,
    metadata: {
      channel: channel || null,
      publishedAt: v.publishedAt || null,
      format: formatMeta,
    },
  };
}
