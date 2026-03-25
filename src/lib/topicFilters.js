export function getMainTopics(topics = []) {
  return topics.filter((topic) => topic.isMainCategory || !topic.parentId);
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

export function mentorBelongsToTopicFamily(mentor, rootTopicId, topics = []) {
  if (!mentor || !rootTopicId) return false;

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
  if (!video || !rootTopicId) return false;

  const videoTopicIds = video.topicIds || [];
  if (videoTopicIds.length === 0) return false;

  const relevantIds = getTopicFamilyIds(rootTopicId, topics);
  return videoTopicIds.some((topicId) => relevantIds.has(topicId));
}
