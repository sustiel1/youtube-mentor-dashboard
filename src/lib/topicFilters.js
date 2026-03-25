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

export function mentorBelongsToTopicFamily(mentor, rootTopicId, topics = []) {
  if (!mentor || !rootTopicId || rootTopicId === "all") return false;

  const mentorTopicIds = mentor.topicIds || [];
  if (mentorTopicIds.length === 0) return false;

  const relevantIds = getTopicFamilyIds(rootTopicId, topics);
  return mentorTopicIds.some((topicId) => relevantIds.has(topicId));
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
