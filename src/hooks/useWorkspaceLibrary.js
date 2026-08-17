import { useState, useCallback, useEffect } from "react";
import {
  getWorkspaceTopics,
  addWorkspaceTopic,
  updateWorkspaceTopic,
  deleteWorkspaceTopic,
} from "@/lib/workspaceLibraryStore";
import { getWorkspaceMainTopics, getWorkspaceSubtopics } from "@/utils/workspaceTopicHierarchy";
import {
  getWorkspaceItemsSnapshot,
  getWorkspacePersistence,
} from "@/lib/persistence/workspacePersistence";

export function useWorkspaceTopics() {
  const [topics, setTopics] = useState(() => getWorkspaceTopics());

  const reload = useCallback(() => setTopics(getWorkspaceTopics()), []);

  const addTopic = useCallback((params) => {
    const result = addWorkspaceTopic(params);
    if (result?.ok) setTopics(getWorkspaceTopics());
    return result;
  }, []);

  const updateTopic = useCallback((id, updates) => {
    const result = updateWorkspaceTopic(id, updates);
    if (result?.ok) setTopics(getWorkspaceTopics());
    return result;
  }, []);

  const deleteTopic = useCallback((id) => {
    const result = deleteWorkspaceTopic(id, { items: getWorkspaceItemsSnapshot() });
    setTopics(getWorkspaceTopics());
    return result;
  }, []);

  const mainTopics = getWorkspaceMainTopics(topics);

  const getSubTopics = useCallback(
    (parentId) => getWorkspaceSubtopics(topics, parentId),
    [topics]
  );

  return { topics, mainTopics, getSubTopics, addTopic, updateTopic, deleteTopic, reload };
}

export function useWorkspaceItems() {
  const persistence = getWorkspacePersistence();
  const [items, setItems] = useState(() => persistence.readItemsSnapshot());

  const reload = useCallback(() => {
    const result = persistence.readItems();
    if (result && typeof result.then === 'function') {
      return result.then((persistedItems) => {
        setItems(persistedItems);
        return persistedItems;
      });
    }
    setItems(result);
    return result;
  }, [persistence]);

  const applyResult = useCallback((result) => {
    if (result && typeof result.then === 'function') {
      return result.then((resolved) => {
        if (resolved?.ok && Array.isArray(resolved.persistedItems)) {
          setItems(resolved.persistedItems);
        }
        return resolved;
      });
    }
    if (result?.ok && Array.isArray(result.persistedItems)) {
      setItems(result.persistedItems);
    }
    return result;
  }, []);

  useEffect(() => {
    const unsubscribe = persistence.subscribe((event) => {
      if (event?.type === 'record-updated' || event?.type === 'generation-active') {
        void reload();
      }
    });
    const initial = persistence.readItems();
    if (initial && typeof initial.then === 'function') void initial.then(setItems);
    return unsubscribe;
  }, [persistence, reload]);

  const saveItem = useCallback(
    (item) => applyResult(persistence.saveItem(item)),
    [applyResult, persistence],
  );
  const saveItemsBulk = useCallback(
    (nextItems) => applyResult(persistence.saveItemsBulk(nextItems)),
    [applyResult, persistence],
  );
  const updateItem = useCallback(
    (id, updates) => applyResult(persistence.updateItem(id, updates)),
    [applyResult, persistence],
  );
  const deleteItem = useCallback(
    (id) => applyResult(persistence.deleteItem(id)),
    [applyResult, persistence],
  );
  const deleteItems = useCallback(
    (ids) => applyResult(persistence.deleteItems(ids)),
    [applyResult, persistence],
  );
  const deleteAllItems = useCallback(
    () => applyResult(persistence.deleteAllItems()),
    [applyResult, persistence],
  );
  const updateItemsBulk = useCallback(
    (ids, updates) => applyResult(persistence.updateItemsBulk(ids, updates)),
    [applyResult, persistence],
  );
  const archiveItems = useCallback(
    (ids, archived = true) => applyResult(persistence.archiveItems(ids, archived)),
    [applyResult, persistence],
  );
  const reassignVideoGroupTopic = useCallback(
    (params) => applyResult(persistence.reassignVideoGroupTopic(params)),
    [applyResult, persistence],
  );
  const updateItemByVideoId = useCallback(
    (videoId, updates) => applyResult(persistence.updateItemByVideoId(videoId, updates)),
    [applyResult, persistence],
  );
  const findByContentHash = useCallback(
    (contentHash) => items.find((item) => item?.contentHash === contentHash) || null,
    [items],
  );

  return {
    items,
    reload,
    saveItem,
    saveItemsBulk,
    updateItem,
    updateItemByVideoId,
    deleteItem,
    deleteItems,
    deleteAllItems,
    updateItemsBulk,
    archiveItems,
    reassignVideoGroupTopic,
    findByContentHash,
  };
}
