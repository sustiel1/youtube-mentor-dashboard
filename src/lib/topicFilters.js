import { CATEGORY_TO_NAME } from "@/config/topicConfig";

const ORDER_KEY = "ym_topic_order";

export function getMainTopics(topics = []) {
  return topics.filter((topic) => topic.isMainCategory || !topic.parentId);
}

function loadTopicOrder() {
  if (typeof window === "undefined") return null;

  try {
    return JSON.parse(window.localStorage.getItem(ORDER_KEY));
  } catch {
    return null;
  }
}

export function getOrderedMainTopics(topics = []) {
  const mainTopics = getMainTopics(topics);
  const stored = loadTopicOrder();

  if (!stored || !stored.length) return mainTopics;

  const topicsById = new Map(mainTopics.map((topic) => [topic.id, topic]));
  const orderedTopics = stored.map((id) => topicsById.get(id)).filter(Boolean);
  const newTopics = mainTopics.filter((topic) => !stored.includes(topic.id));

  return [...orderedTopics, ...newTopics];
}

export function getTopicFamilyIds(rootTopicId, topics = []) {
  if (!rootTopicId) return new Set();

  const topicIds = new Set([rootTopicId]);
  const queue = [rootTopicId];

  while (queue.length > 0) {
    const currentId = queue.shift();

    topics.forEach((topic) => {
      if (topic.parentId === currentId && !topicIds.has(topic.id)) {
        topicIds.add(topic.id);
        queue.push(topic.id);
      }
    });
  }

  return topicIds;
}

export function getMainTopicIdForTopic(topicId, topics = []) {
  if (!topicId || topicId === "all") return "all";

  const topicsById = new Map(topics.map((topic) => [topic.id, topic]));
  let currentTopic = topicsById.get(topicId);

  while (currentTopic?.parentId) {
    currentTopic = topicsById.get(currentTopic.parentId);
  }

  return currentTopic?.id || "all";
}

export function getEffectiveMainTopicId(filters = {}, topics = []) {
  if (filters.category && filters.category !== "all") {
    return getMainTopicIdForTopic(filters.category, topics);
  }

  if (filters.topicId && filters.topicId !== "all") {
    return getMainTopicIdForTopic(filters.topicId, topics);
  }

  return "all";
}

export function normalizeDashboardFilters(filters = {}, topics = []) {
  const nextFilters = { ...filters };
  const effectiveMainTopicId = getEffectiveMainTopicId(nextFilters, topics);

  nextFilters.category = effectiveMainTopicId;

  if (!nextFilters.topicId) {
    nextFilters.topicId = "all";
  }

  if (!nextFilters.mentor) {
    nextFilters.mentor = "all";
  }

  if (nextFilters.category === "all" && nextFilters.topicId !== "all") {
    nextFilters.category = getMainTopicIdForTopic(nextFilters.topicId, topics);
  }

  return nextFilters;
}

// Returns true if a mentor.category code (e.g. "Markets") matches a topic name (e.g. "שוק ההון")
export function categoryMatchesTopicName(mentorCategory, topicName) {
  if (!mentorCategory || !topicName) return false;
  const mappedName = CATEGORY_TO_NAME[mentorCategory];
  if (!mappedName) return false;
  const a = mappedName.toLowerCase();
  const b = topicName.toLowerCase();
  return a === b || b.includes(a) || a.includes(b);
}

export function mentorBelongsToTopicFamily(mentor, rootTopicId, topics = []) {
  if (!mentor || !rootTopicId || rootTopicId === "all") return false;

  const mentorTopicIds = mentor.topicIds || [];
  const relevantIds = getTopicFamilyIds(rootTopicId, topics);

  // Primary: topicIds match
  if (mentorTopicIds.some((tid) => relevantIds.has(tid))) return true;

  // Fallback: match mentor.category string against root topic name
  const rootTopic = topics.find((t) => t.id === rootTopicId);
  return categoryMatchesTopicName(mentor.category, rootTopic?.name);
}

export function filterMentorsByTopicFamily(mentors = [], rootTopicId, topics = []) {
  if (!rootTopicId || rootTopicId === "all") return mentors;
  return mentors.filter((mentor) => mentorBelongsToTopicFamily(mentor, rootTopicId, topics));
}

export function videoBelongsToTopicFamily(video, rootTopicId, topics = []) {
  if (!video || !rootTopicId || rootTopicId === "all") return rootTopicId === "all";

  const videoTopicIds = video.topicIds || [];
  if (videoTopicIds.length === 0) return false;

  const relevantIds = getTopicFamilyIds(rootTopicId, topics);
  return videoTopicIds.some((topicId) => relevantIds.has(topicId));
}
