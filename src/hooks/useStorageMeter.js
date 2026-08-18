import { useCallback, useEffect, useRef, useState } from 'react';
import { getWorkspacePersistence } from '@/lib/persistence/workspacePersistence';
import { getApplicationStorageMode } from '@/lib/persistence/storageMode';
import {
  buildStorageMeterModel,
  collectStorageMeterSnapshot,
  getLocalStorageUsageBytes,
} from '@/lib/persistence/storageMeter';

export function useStorageMeter() {
  const mode = getApplicationStorageMode();
  const requestId = useRef(0);
  const [snapshot, setSnapshot] = useState(() => ({
    ...buildStorageMeterModel({
      mode,
      localStorageBytes: getLocalStorageUsageBytes(),
    }),
    loading: mode === 'indexedDB',
  }));

  const refresh = useCallback(async () => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    const next = await collectStorageMeterSnapshot({ mode });
    if (requestId.current === currentRequest) setSnapshot({ ...next, loading: false });
    return next;
  }, [mode]);

  useEffect(() => {
    let active = true;
    const persistence = getWorkspacePersistence();
    const safeRefresh = () => {
      if (active) void refresh();
    };
    const unsubscribe = persistence.subscribe(safeRefresh);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') safeRefresh();
    };

    safeRefresh();
    window.addEventListener('storage', safeRefresh);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener('storage', safeRefresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refresh]);

  return { mode, snapshot, refresh };
}
