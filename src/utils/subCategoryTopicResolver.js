// Derives a subCategory slug from a video's topicIds, for videos that were
// classified only through the knowledge-taxonomy topic picker and never had
// subCategory/confirmedSubCategory written directly (TRADINGBRAIN-GEM-FUNDAMENTAL-SCHEMA:
// SpecializedContentRenderer branches on subCategory, never on topicIds, so such
// videos silently fell back to its generic "default" branch).
//
// Read-time only — never writes to storage. Reuses the existing topic catalog
// (TOPICS in mockData.js) and the existing subCategory slug vocabulary
// (normalizeSubCategory / SUB_CATEGORY_SLUG_MAP in videoTabsConfig.js) instead
// of inventing a second mapping table.
import { TOPICS } from "@/data/mockData";
import { normalizeSubCategory } from "@/config/videoTabsConfig";

// Brief slugs are never derived from topicIds — briefs are detected via title
// keywords / contentType (see detectVideoType in videoTabsConfig.js) and this
// resolver must never intercept that flow. Excluded here as a defensive guard
// even though no current topic name resolves to one of these slugs.
const BRIEF_SLUGS = new Set(["morning-brief", "evening-brief", "weekly-brief", "earnings-brief"]);

const TOPICS_BY_ID = new Map(TOPICS.map((topic) => [topic.id, topic]));

function slugFromTopicName(name) {
  const raw = typeof name === "string" ? name.trim() : "";
  if (!raw) return null;
  // Topic names sometimes carry an extra "ניתוח " (analysis) prefix that isn't
  // part of the SUB_CATEGORY_SLUG_MAP key (e.g. "ניתוח פונדמנטלי" vs "פונדמנטלי").
  return normalizeSubCategory(raw) || normalizeSubCategory(raw.replace(/^ניתוח\s+/, ""));
}

function slugFromTopic(topic) {
  if (!topic) return null;
  const ownSlug = slugFromTopicName(topic.name);
  if (ownSlug) return ownSlug;
  if (topic.parentId) {
    return slugFromTopicName(TOPICS_BY_ID.get(topic.parentId)?.name);
  }
  return null;
}

/**
 * Returns the first non-brief subCategory slug reachable from a video's
 * topicIds, or null if none resolve. Intended as a last-resort fallback only
 * when both subCategory and confirmedSubCategory are missing.
 */
export function resolveSubCategorySlugFromTopics(topicIds) {
  if (!Array.isArray(topicIds)) return null;
  for (const id of topicIds) {
    const slug = slugFromTopic(TOPICS_BY_ID.get(id));
    if (slug && !BRIEF_SLUGS.has(slug)) return slug;
  }
  return null;
}
