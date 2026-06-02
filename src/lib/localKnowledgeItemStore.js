import { loadTopics } from "@/services/topicStorage";
import { buildAtomicKnowledgeMarkdown, buildVideoLearningNote, getSelectedAtomicKnowledge, resolvePrimaryTopic, slugify } from "@/lib/obsidianExport";
import { applyObsidianExportMetadata } from "@/lib/obsidianExportMetadata";
import { resolveTopicBreadcrumb } from "@/lib/topicFilters";

const STORAGE_KEY = "yt_knowledge_items_v1";
const DEFAULT_BRAIN_POSITION_METADATA = {
  contentRole: "my_position",
  perspective: "self",
  userPosition: "endorsed",
};

function resolveBrainPositionMetadata(input = {}) {
  const raw = input && typeof input === "object" ? input : {};
  const contentRole = raw.contentRole === "opponent_view" ? "opponent_view" : "my_position";
  const perspective =
    raw.perspective === "external" || raw.perspective === "opponent"
      ? "external"
      : "self";
  const userPosition = raw.userPosition === "not_endorsed" ? "not_endorsed" : "endorsed";
  return { contentRole, perspective, userPosition };
}

function normalizeKnowledgeItem(item) {
  if (!item || typeof item !== "object") return item;
  const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
  return {
    ...item,
    metadata: {
      ...metadata,
      ...resolveBrainPositionMetadata(metadata),
    },
  };
}

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeKnowledgeItem).filter(Boolean) : [];
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

function resolveWorkspaceTopicFolder(brainId, topics, subBrainId) {
  // Use subBrainId when provided — resolveTopicBreadcrumb handles Brain/SubBrain automatically
  const leafId = subBrainId || brainId;
  if (!leafId) return { folder: null, label: null };
  const { main, sub } = resolveTopicBreadcrumb(leafId, topics);
  const mainName = main?.name ? String(main.name).trim() : "";
  const subName = sub?.name ? String(sub.name).trim() : "";
  if (mainName && subName) {
    return { folder: `${mainName}/${subName}`, label: `${mainName} · ${subName}` };
  }
  const single = mainName || subName;
  return single ? { folder: single, label: single } : { folder: null, label: null };
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
  const normalizedItem = normalizeKnowledgeItem(item);
  const idx = all.findIndex((i) => i.id === item.id);
  const next = [...all];
  if (idx === -1) next.unshift(normalizedItem);
  else next[idx] = normalizedItem;
  writeAll(next);
  // Notify same-tab listeners (e.g. TopicKnowledgePage) that items changed
  try { window.dispatchEvent(new CustomEvent("knowledge-items-updated")); } catch { /* non-browser env */ }
  return normalizedItem;
}

export function removeKnowledgeItem(id) {
  const all = readAll();
  const next = all.filter((i) => i.id !== id);
  if (next.length === all.length) return false;
  writeAll(next);
  return true;
}

export function createKnowledgeItemFromNote(note, brainId, subBrainId) {
  const id = `note:${note.id}`;
  const topics = loadTopics?.() || [];
  const resolved = resolveWorkspaceTopicFolder(brainId, topics, subBrainId);
  const topicName = resolved.label || "General";
  const topicFolder = resolved.folder || topicName;
  const safeTitle = slugify(note.title || "note", 70) || "note";
  return {
    id,
    sourceType: "note",
    sourceId: note.id,
    title: note.title || "Untitled",
    topicId: brainId ?? null,
    subBrainId: subBrainId ?? null,
    kind: "note",
    markdown: `# ${note.title}\n\n${note.content || ""}`,
    workspacePath: `Workspace/${topicFolder}/Notes/${safeTitle}.md`,
    createdAt: note.createdAt || nowIso(),
    updatedAt: nowIso(),
    metadata: {
      tags: note.tags || [],
      sourceType: note.sourceType || "manual",
      ...DEFAULT_BRAIN_POSITION_METADATA,
    },
  };
}

export function createKnowledgeItemFromIdea({ title, excerpt, brainId, subBrainId }) {
  const id = `idea:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const topics = loadTopics?.() || [];
  const resolved = resolveWorkspaceTopicFolder(brainId, topics, subBrainId);
  const topicName = resolved.label || "General";
  const topicFolder = resolved.folder || topicName;
  const safeTitle = slugify(title || "idea", 70) || "idea";
  return {
    id,
    sourceType: "idea",
    sourceId: id,
    title: title || "Untitled",
    topicId: brainId ?? null,
    subBrainId: subBrainId ?? null,
    kind: "idea",
    markdown: `# ${title}\n\n${excerpt || ""}`,
    workspacePath: `Workspace/${topicFolder}/Ideas/${safeTitle}.md`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    metadata: {
      excerpt: excerpt || null,
      ...DEFAULT_BRAIN_POSITION_METADATA,
    },
  };
}

export function createKnowledgeItemFromLink({ url, title, brainId, subBrainId }) {
  const id = `link:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const topics = loadTopics?.() || [];
  const resolved = resolveWorkspaceTopicFolder(brainId, topics, subBrainId);
  const topicName = resolved.label || "General";
  const topicFolder = resolved.folder || topicName;
  const safeTitle = slugify(title || "link", 70) || "link";
  return {
    id,
    sourceType: "link",
    sourceId: id,
    title: title || url || "Untitled",
    topicId: brainId ?? null,
    subBrainId: subBrainId ?? null,
    kind: "link",
    markdown: `# ${title || url}\n\n[פתח קישור](${url})`,
    workspacePath: `Workspace/${topicFolder}/Links/${safeTitle}.md`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    metadata: {
      url: url || null,
      ...DEFAULT_BRAIN_POSITION_METADATA,
    },
  };
}

/**
 * Minimal helper to turn a video into a KnowledgeItem.
 * This is intentionally lightweight: localStorage only, no migrations, no refactors.
 */
export function createKnowledgeItemFromVideo(video, topicId, subBrainId) {
  const v = video || {};
  const sourceType = "youtube";
  const sourceId = String(v.videoId || v.id || "");
  const id = stableKnowledgeItemId({ sourceType, sourceId });

  const topics = loadTopics?.() || [];
  const resolved = resolveWorkspaceTopicFolder(topicId, topics, subBrainId);
  const topicName = resolved.label || resolvePrimaryTopic(v) || "General";
  const topicFolder = resolved.folder || topicName;

  const safeTitle = slugify(v.title || "video", 70) || "video";
  const workspacePath = `Workspace/${topicFolder}/Learnings/${safeTitle}.md`;

  const channel = v.channelTitle || v.channel || "";
  const note = buildVideoLearningNote(v, channel, topicName, []);

  const selections = v.selectedKnowledgeItems;

  // If selections are explicitly set, check that at least one item is selected
  if (selections !== undefined && selections !== null) {
    const selected = getSelectedAtomicKnowledge(v, selections);
    const hasAny =
      selected.mainLesson ||
      (selected.keyPoints && selected.keyPoints.length > 0) ||
      selected.keyInsights.length > 0 ||
      (selected.brainHighlights && selected.brainHighlights.length > 0) ||
      selected.rules.length > 0 ||
      selected.actionItems.length > 0 ||
      selected.mistakesToAvoid.length > 0 ||
      selected.concepts.length > 0 ||
      (selected.frameworks && selected.frameworks.length > 0) ||
      (selected.questions && selected.questions.length > 0) ||
      (selected.quotes && selected.quotes.length > 0) ||
      (selected.appBuilderPoints && selected.appBuilderPoints.length > 0);
    if (!hasAny) return null;
  }

  // Priority: structured atomic fields (filtered by selection) → brainSummary blob → existing builder
  const atomicMarkdown = buildAtomicKnowledgeMarkdown(v, selections);
  const brainMarkdown  = v.brainSummary ? v.brainSummary.trim() : null;
  const rawMarkdown = atomicMarkdown || brainMarkdown || note?.content || "";
  const markdown = applyObsidianExportMetadata(rawMarkdown, v, {
    analysisType: atomicMarkdown ? "Useful Knowledge" : brainMarkdown ? "Summary" : "Useful Knowledge",
  });

  const createdAt = v.createdAt || v.analyzedAt || v.publishedAt || nowIso();
  const updatedAt = nowIso();

  const watchUrl =
    typeof v.url === "string" && v.url.trim()
      ? v.url.trim()
      : sourceId
        ? `https://www.youtube.com/watch?v=${encodeURIComponent(sourceId)}`
        : null;

  const formatMeta =
    typeof v.obsidianFormat === "string" && v.obsidianFormat.trim()
      ? v.obsidianFormat.trim()
      : typeof v.obsidianTemplate === "string" && v.obsidianTemplate.trim()
        ? v.obsidianTemplate.trim()
        : null;

  const videoMetadata = v.metadata && typeof v.metadata === "object" ? v.metadata : {};
  const isOpponentView =
    v.opponentView === true ||
    v.isOpponentView === true ||
    videoMetadata.opponentView === true ||
    videoMetadata.contentRole === "opponent_view" ||
    videoMetadata.userPosition === "not_endorsed";
  const positionMetadata = isOpponentView
    ? {
        contentRole: "opponent_view",
        perspective: "external",
        userPosition: "not_endorsed",
      }
    : DEFAULT_BRAIN_POSITION_METADATA;

  return {
    id,
    sourceType,
    sourceId,
    title: v.title || "Untitled",
    topicId: topicId ?? null,
    subBrainId: subBrainId ?? null,
    kind: "learning",
    markdown,
    workspacePath,
    createdAt,
    updatedAt,
    metadata: {
      videoId: sourceId || null,
      title: v.title || null,
      channel: channel || null,
      category: v.category || null,
      savedAt: updatedAt,
      url: watchUrl,
      originalUrl: watchUrl,
      publishedAt: v.publishedAt || null,
      format: formatMeta,
      ...positionMetadata,
    },
  };
}
