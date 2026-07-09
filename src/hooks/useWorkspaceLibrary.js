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
} from "@/lib/workspaceLibraryStore";

export function useWorkspaceTopics() {
  const [topics, setTopics] = useState(() => getWorkspaceTopics());

  const reload = useCallback(() => setTopics(getWorkspaceTopics()), []);

  const addTopic = useCallback((params) => {
    const t = addWorkspaceTopic(params);
    setTopics(getWorkspaceTopics());
    return t;
  }, []);

  const updateTopic = useCallback((id, updates) => {
    updateWorkspaceTopic(id, updates);
    setTopics(getWorkspaceTopics());
  }, []);

  const deleteTopic = useCallback((id) => {
    const result = deleteWorkspaceTopic(id);
    setTopics(getWorkspaceTopics());
    return result;
  }, []);

  const mainTopics = topics.filter(t => !t.parentId);

  const getSubTopics = useCallback(
    (parentId) => topics.filter(t => t.parentId === parentId),
    [topics]
  );

  return { topics, mainTopics, getSubTopics, addTopic, updateTopic, deleteTopic, reload };
}

export function useWorkspaceItems() {
  const [items, setItems] = useState(() => getWorkspaceItems());

  const reload = useCallback(() => setItems(getWorkspaceItems()), []);

  const saveItem = useCallback((item) => {
    saveWorkspaceItem(item);
    setItems(getWorkspaceItems());
  }, []);

  const updateItem = useCallback((id, updates) => {
    updateWorkspaceItem(id, updates);
    setItems(getWorkspaceItems());
  }, []);

  const deleteItem = useCallback((id) => {
    deleteWorkspaceItem(id);
    setItems(getWorkspaceItems());
  }, []);

  return { items, reload, saveItem, updateItem, deleteItem };
}
