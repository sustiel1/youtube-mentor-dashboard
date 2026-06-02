import { getKnowledgeItems } from "@/lib/localKnowledgeItemStore";
import { getAllChunks } from "@/lib/localChunkStore";
import { searchChunks } from "@/lib/chunkSearch";
import { loadVideos } from "@/services/videoStorage";

const ITEM_TITLE_SCORE = 10;
const ITEM_TAG_SCORE = 6;
const ITEM_BODY_SCORE = 4;
const ITEM_PATH_SCORE = 3;
const ITEM_CATEGORY_SCORE = 3;
const MAX_RESULTS_PER_BUCKET = 6;
const MAX_SUPPORTING_CHUNKS = 2;
const MAX_EXCERPT_LENGTH = 280;
const MAX_CHUNK_SUMMARY_LENGTH = 180;

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeQuery(query) {
  return normalizeText(query)
    .toLowerCase()
    .split(/[\s,.;:!?()[\]{}"'\-_/\\]+/)
    .filter(Boolean);
}

function truncateText(text, maxLength) {
  const normalized = normalizeText(text);
  if (!normalized || normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function stripMarkdown(markdown) {
  return normalizeText(
    String(markdown || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .replace(/[*_~>#]/g, " ")
  );
}

function scoreKnowledgeItem(item, terms, chunkMeta) {
  const title = normalizeText(item?.title).toLowerCase();
  const body = stripMarkdown(item?.markdown).toLowerCase();
  const tags = Array.isArray(item?.metadata?.tags) ? item.metadata.tags.join(" ").toLowerCase() : "";
  const path = normalizeText(item?.workspacePath).toLowerCase();
  const category = normalizeText(item?.metadata?.category).toLowerCase();
  const channel = normalizeText(item?.metadata?.channel).toLowerCase();

  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += ITEM_TITLE_SCORE;
    if (tags.includes(term)) score += ITEM_TAG_SCORE;
    if (body.includes(term)) score += ITEM_BODY_SCORE;
    if (path.includes(term)) score += ITEM_PATH_SCORE;
    if (category.includes(term) || channel.includes(term)) score += ITEM_CATEGORY_SCORE;
  }

  if (chunkMeta?.topScore) {
    score += Math.min(16, chunkMeta.topScore);
  }

  return score;
}

function extractItemExcerpt(item) {
  const plain = stripMarkdown(item?.markdown);
  return truncateText(plain, MAX_EXCERPT_LENGTH);
}

function buildSupportingChunks(chunkMeta) {
  if (!chunkMeta?.results?.length) return [];
  return chunkMeta.results.slice(0, MAX_SUPPORTING_CHUNKS).map((result) => ({
    title: result.chunk?.title || "",
    summary: truncateText(result.chunk?.summary || result.chunk?.transcriptExcerpt || "", MAX_CHUNK_SUMMARY_LENGTH),
    timestampLabel: result.chunk?.timestampLabel || null,
    score: result.score,
  }));
}

function classifyItem(item) {
  const role = item?.metadata?.contentRole;
  const perspective = item?.metadata?.perspective;
  const userPosition = item?.metadata?.userPosition;
  const isOpponent =
    role === "opponent_view" ||
    perspective === "external" ||
    userPosition === "not_endorsed";
  return isOpponent ? "opponentViews" : "myPositions";
}

function buildCompactResult(item, score, chunkMeta) {
  return {
    id: item.id,
    title: item.title || "Untitled",
    kind: item.kind || "learning",
    score,
    excerpt: extractItemExcerpt(item),
    workspacePath: item.workspacePath || null,
    sourceType: item.sourceType || null,
    metadata: {
      contentRole: item?.metadata?.contentRole || "my_position",
      perspective: item?.metadata?.perspective || "self",
      userPosition: item?.metadata?.userPosition || "endorsed",
      category: item?.metadata?.category || null,
      channel: item?.metadata?.channel || null,
      tags: Array.isArray(item?.metadata?.tags) ? item.metadata.tags : [],
      url: item?.metadata?.url || item?.metadata?.originalUrl || null,
    },
    supportingChunks: buildSupportingChunks(chunkMeta),
  };
}

function buildVideoMap(videos) {
  const map = {};
  for (const video of Array.isArray(videos) ? videos : []) {
    if (video?.id) map[video.id] = video;
    if (video?.videoId) map[video.videoId] = video;
  }
  return map;
}

function buildChunkLookup(postText, videos) {
  const videoMap = buildVideoMap(videos);
  const chunkResults = searchChunks(postText, {
    chunks: getAllChunks(),
    videoMap,
    mentorMap: {},
  });

  const byVideoId = {};
  for (const result of chunkResults) {
    const videoId = result?.chunk?.videoId;
    if (!videoId) continue;
    if (!byVideoId[videoId]) {
      byVideoId[videoId] = { topScore: 0, results: [] };
    }
    byVideoId[videoId].topScore = Math.max(byVideoId[videoId].topScore, result.score || 0);
    byVideoId[videoId].results.push(result);
  }
  return byVideoId;
}

/**
 * Search Brain items for compact political-reply context.
 * Returns ranked, short context separated into the user's own positions and opponent-view material.
 */
export function searchBrainForReplyContext(postText) {
  const query = normalizeText(postText);
  if (!query) {
    return {
      query: "",
      myPositions: [],
      opponentViews: [],
      stats: {
        totalMatches: 0,
        myPositionCount: 0,
        opponentViewCount: 0,
      },
    };
  }

  const terms = tokenizeQuery(query);
  const items = getKnowledgeItems();
  const videos = loadVideos();
  const chunkLookup = buildChunkLookup(query, videos);

  const ranked = items
    .map((item) => {
      const videoId = item?.metadata?.videoId || item?.sourceId || null;
      const chunkMeta = videoId ? chunkLookup[videoId] : null;
      const score = scoreKnowledgeItem(item, terms, chunkMeta);
      if (score <= 0) return null;
      return {
        bucket: classifyItem(item),
        result: buildCompactResult(item, score, chunkMeta),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.result.score - a.result.score);

  const myPositions = [];
  const opponentViews = [];

  for (const entry of ranked) {
    if (entry.bucket === "opponentViews") {
      if (opponentViews.length < MAX_RESULTS_PER_BUCKET) opponentViews.push(entry.result);
      continue;
    }
    if (myPositions.length < MAX_RESULTS_PER_BUCKET) myPositions.push(entry.result);
  }

  return {
    query,
    myPositions,
    opponentViews,
    stats: {
      totalMatches: myPositions.length + opponentViews.length,
      myPositionCount: myPositions.length,
      opponentViewCount: opponentViews.length,
    },
  };
}
