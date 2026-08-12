export const WORKSPACE_TOPIC_TYPES = {
  MAIN: 'main',
  SUBTOPIC: 'subtopic',
};

function normalizeOrder(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getWorkspaceTopicType(topic) {
  return topic?.parentId ? WORKSPACE_TOPIC_TYPES.SUBTOPIC : WORKSPACE_TOPIC_TYPES.MAIN;
}

export function sortWorkspaceTopics(topics = []) {
  return topics
    .map((topic, index) => ({ topic, index }))
    .sort((left, right) => {
      const byOrder = normalizeOrder(left.topic.displayOrder, left.index)
        - normalizeOrder(right.topic.displayOrder, right.index);
      if (byOrder !== 0) return byOrder;
      return left.index - right.index;
    })
    .map(({ topic }) => topic);
}

export function getWorkspaceMainTopics(topics = []) {
  return sortWorkspaceTopics(topics.filter(topic => !topic?.parentId));
}

export function getWorkspaceSubtopics(topics = [], parentId) {
  return sortWorkspaceTopics(topics.filter(topic => topic?.parentId === parentId));
}

export function validateWorkspaceTopicDraft({ topicId = null, type, parentId = null, topics = [] }) {
  const errors = [];
  const topicsById = new Map(topics.map(topic => [topic.id, topic]));
  const normalizedParentId = type === WORKSPACE_TOPIC_TYPES.SUBTOPIC ? parentId || null : null;

  if (type !== WORKSPACE_TOPIC_TYPES.MAIN && type !== WORKSPACE_TOPIC_TYPES.SUBTOPIC) {
    errors.push('יש לבחור סוג נושא תקין.');
  }

  if (type === WORKSPACE_TOPIC_TYPES.MAIN && normalizedParentId) {
    errors.push('נושא ראשי אינו יכול לכלול נושא אב.');
  }

  if (type === WORKSPACE_TOPIC_TYPES.SUBTOPIC) {
    if (!normalizedParentId) {
      errors.push('תת־נושא מחייב נושא אב.');
    } else if (normalizedParentId === topicId) {
      errors.push('נושא אינו יכול להיות האב של עצמו.');
    } else {
      const parent = topicsById.get(normalizedParentId);
      if (!parent) errors.push('נושא האב אינו קיים או נמחק.');
      else if (parent.parentId) errors.push('ניתן לבחור רק נושא ראשי כאב; עומק של יותר משתי רמות אינו נתמך.');
    }
  }

  if (topicId && normalizedParentId) {
    let currentId = normalizedParentId;
    const seen = new Set();
    while (currentId && !seen.has(currentId)) {
      if (currentId === topicId) {
        errors.push('הקשר ייצור היררכיה מעגלית.');
        break;
      }
      seen.add(currentId);
      currentId = topicsById.get(currentId)?.parentId || null;
    }
  }

  if (topicId && type === WORKSPACE_TOPIC_TYPES.SUBTOPIC) {
    const hasChildren = topics.some(topic => topic.parentId === topicId);
    if (hasChildren) errors.push('לא ניתן להפוך נושא בעל תתי־נושאים לתת־נושא בלי ליצור יותר משתי רמות.');
  }

  return {
    ok: errors.length === 0,
    errors: [...new Set(errors)],
    parentId: normalizedParentId,
  };
}

export function getWorkspaceTopicAttachedItems(items = [], topicId) {
  return items.filter(item => (
    item?.topicId === topicId
    || item?.subTopicId === topicId
    || item?.subtopicId === topicId
  ));
}

export function buildWorkspaceTaxonomyRepairBackup({
  topics = [],
  items = [],
  topicId,
  createdAt = new Date().toISOString(),
} = {}) {
  const topic = topics.find(candidate => candidate?.id === topicId);
  if (!topic) throw new Error('The taxonomy topic to back up was not found.');

  const payload = {
    schemaVersion: 1,
    createdAt,
    topicId,
    workspaceItemCount: items.length,
    workspaceItemIds: items.map(item => item?.id).filter(Boolean),
    taxonomy: topics,
    topic,
    referencedItems: getWorkspaceTopicAttachedItems(items, topicId),
  };
  const serialized = JSON.stringify(payload, null, 2);
  const parsed = JSON.parse(serialized);
  if (parsed.topic?.id !== topicId || !Array.isArray(parsed.taxonomy) || !Array.isArray(parsed.referencedItems)) {
    throw new Error('The taxonomy backup could not be verified.');
  }

  const safeTimestamp = String(createdAt).replace(/[:.]/g, '-');
  return {
    filename: `workspace-taxonomy-backup-${topicId}-${safeTimestamp}.json`,
    payload: parsed,
    serialized,
  };
}

export function buildWorkspaceTopicChangePreview({ topic, draft, topics = [], items = [] }) {
  if (!topic) return null;
  const type = draft.type || getWorkspaceTopicType(topic);
  const validation = validateWorkspaceTopicDraft({ topicId: topic.id, type, parentId: draft.parentId, topics });
  const attachedItems = getWorkspaceTopicAttachedItems(items, topic.id);
  const proposedParentId = validation.parentId;

  return {
    topicId: topic.id,
    existingParentId: topic.parentId || null,
    proposedParentId,
    attachedItemCount: attachedItems.length,
    affectedItemIds: attachedItems.map(item => item.id).filter(Boolean),
    canPreserveTopicId: true,
    itemIdsRemainUnchanged: true,
    validation,
    changesHierarchy: (topic.parentId || null) !== proposedParentId,
  };
}

export function itemMatchesCanonicalTopic(item, topicId, topics = []) {
  if (!topicId) return true;
  const familyIds = new Set([topicId, ...topics.filter(topic => topic.parentId === topicId).map(topic => topic.id)]);
  return familyIds.has(item?.topicId) || familyIds.has(item?.subTopicId);
}
