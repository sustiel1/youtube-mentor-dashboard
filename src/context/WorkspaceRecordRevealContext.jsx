import { createContext, useContext, useMemo } from 'react';

const WorkspaceRecordRevealContext = createContext(new Set());

function normalizedIds(recordIds) {
  return [...new Set((Array.isArray(recordIds) ? recordIds : [recordIds])
    .map(value => String(value || '').trim())
    .filter(Boolean))];
}

export const WORKSPACE_RECORD_REVEAL_CLASS = 'bg-amber-100/90 ring-2 ring-inset ring-amber-400 dark:bg-amber-950/40 dark:ring-amber-500';

export function WorkspaceRecordRevealProvider({ recordIds = [], children }) {
  const value = useMemo(() => new Set(normalizedIds(recordIds)), [recordIds]);
  return (
    <WorkspaceRecordRevealContext.Provider value={value}>
      {children}
    </WorkspaceRecordRevealContext.Provider>
  );
}

export function useWorkspaceRecordRevealIds() {
  return useContext(WorkspaceRecordRevealContext);
}

export function getWorkspaceRecordRevealState(recordIds, revealIds) {
  const ids = normalizedIds(recordIds);
  const highlighted = ids.some(id => revealIds?.has(id));
  return {
    ids,
    highlighted,
    attributes: {
      ...(ids.length > 0 ? { 'data-workspace-record-ids': ids.join(' ') } : {}),
      ...(highlighted ? { 'data-workspace-record-highlight': 'true' } : {}),
    },
  };
}

