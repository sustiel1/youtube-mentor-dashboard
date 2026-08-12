import { useState, useCallback } from "react";
import {
  getWorkspaceTopics,
  addWorkspaceTopic,
  updateWorkspaceTopic,
  deleteWorkspaceTopic,
  getWorkspaceItems,
  saveWorkspaceItem,
  updateWorkspaceItem,
  deleteWorkspaceItem,
  deleteWorkspaceItems,
  deleteAllWorkspaceItems,
  updateWorkspaceItemsBulk,
  archiveWorkspaceItems,
  reassignWorkspaceVideoGroupTopic,
} from "@/lib/workspaceLibraryStore";
import { getWorkspaceMainTopics, getWorkspaceSubtopics } from "@/utils/workspaceTopicHierarchy";

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
    const result = deleteWorkspaceTopic(id);
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
  const [items, setItems] = useState(() => getWorkspaceItems());

  const reload = useCallback(() => setItems(getWorkspaceItems()), []);

  const saveItem = useCallback((item) => {
    const result = saveWorkspaceItem(item);
    if (result.ok) setItems(result.persistedItems);
    return result;
  }, []);

  const updateItem = useCallback((id, updates) => {
    const result = updateWorkspaceItem(id, updates);
    if (result.ok) setItems(result.persistedItems);
    return result;
  }, []);

  const deleteItem = useCallback((id) => {
    const result = deleteWorkspaceItem(id);
    if (result.ok) setItems(result.persistedItems);
    return result;
  }, []);

  const deleteItems = useCallback((ids) => {
    const result = deleteWorkspaceItems(ids);
    if (result.ok) setItems(result.persistedItems);
    return result;
  }, []);

  const deleteAllItems = useCallback(() => {
    const result = deleteAllWorkspaceItems();
    if (result.ok) setItems(result.persistedItems);
    return result;
  }, []);

  const updateItemsBulk = useCallback((ids, updates) => {
    const result = updateWorkspaceItemsBulk(ids, updates);
    if (result.ok) setItems(result.persistedItems);
    return result;
  }, []);

  const archiveItems = useCallback((ids, archived = true) => {
    const result = archiveWorkspaceItems(ids, archived);
    if (result.ok) setItems(result.persistedItems);
    return result;
  }, []);

  const reassignVideoGroupTopic = useCallback((params) => {
    const result = reassignWorkspaceVideoGroupTopic(params);
    if (result.ok) setItems(result.persistedItems);
    return result;
  }, []);

  return { items, reload, saveItem, updateItem, deleteItem, deleteItems, deleteAllItems, updateItemsBulk, archiveItems, reassignVideoGroupTopic };
}
