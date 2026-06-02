import { getChannelCollectionForVideo } from "@/lib/localChannelCollectionsStore";

const DEFAULT_SUB_TOPIC = "כללי";
const NO_MAIN_TOPIC = "לא נבחר";

/**
 * Resolves main + sub topic labels for list/grid cards (channel mapping + video overrides).
 * Mirrors VideoDetailPanel priority without needing mentor URL resolution on the card.
 */
export function resolveVideoCardTopics(video, topics = []) {
  const topicsById = new Map((Array.isArray(topics) ? topics : []).map((t) => [t.id, t]));
  const collection = getChannelCollectionForVideo(video);

  const inheritedMainTopicId = String(video?.inheritedMainTopicId || "").trim() || null;
  const directTopicIds = Array.isArray(video?.topicIds) ? video.topicIds : [];
  const directMainTopic = directTopicIds.find((topicId) => {
    const topic = topicsById.get(topicId);
    return topic && !topic.parentId;
  }) || null;

  let mainTopicId = null;
  if (directMainTopic) {
    const isPurelyInheritedRoot = inheritedMainTopicId && directMainTopic === inheritedMainTopicId;
    if (!isPurelyInheritedRoot) mainTopicId = directMainTopic;
  }
  if (!mainTopicId) {
    mainTopicId = String(collection?.mainTopicId || collection?.topicId || "").trim() || null;
  }

  const mainLabel =
    (mainTopicId && topicsById.get(mainTopicId)?.name)
    || (typeof video?.category === "string" && video.category.trim() ? video.category.trim() : null)
    || (collection?.mainTopic ? String(collection.mainTopic).trim() : null)
    || (video?.inheritedMainTopic ? String(video.inheritedMainTopic).trim() : null)
    || NO_MAIN_TOPIC;

  let subLabel = String(video?.subTopic || video?.subCategory || "").trim();
  if (!subLabel) {
    const subId = String(video?.subTopicId || "").trim();
    if (subId && topicsById.get(subId)?.name) subLabel = topicsById.get(subId).name;
  }
  if (!subLabel && mainTopicId) {
    const nestedSub = directTopicIds.find((tid) => topicsById.get(tid)?.parentId === mainTopicId);
    if (nestedSub && topicsById.get(nestedSub)?.name) subLabel = topicsById.get(nestedSub).name;
  }
  if (!subLabel && video?.inheritedSubTopic) subLabel = String(video.inheritedSubTopic).trim();
  if (!subLabel && collection?.subTopic) subLabel = String(collection.subTopic).trim();
  if (!subLabel) subLabel = DEFAULT_SUB_TOPIC;

  return { mainLabel, subLabel, mainTopicId };
}
