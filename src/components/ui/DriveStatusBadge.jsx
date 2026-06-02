import { useState, useEffect } from 'react';
import { getDriveStatus, getDriveAuthUrl } from '@/lib/gdriveClient';
import { setDriveConnected } from '@/lib/gdriveAnalysisStore';

/**
 * Small badge shown in the Dashboard header.
 * - Connected: shows "☁ Drive מחובר" in green
 * - Disconnected: shows "☁ חבר Drive" as a clickable button
 * - Loading: renders nothing (avoids layout shift)
 */
export function DriveStatusBadge() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    // Handle redirect back from Google OAuth
    const url = new URL(window.location.href);
    const gdrive = url.searchParams.get('gdrive');
    if (gdrive) {
      url.searchParams.delete('gdrive');
      window.history.replaceState({}, '', url.toString());
    }

    getDriveStatus().then((s) => {
      setStatus(s);
      setDriveConnected(s.connected);
    });
  }, []);

  const handleConnect = async () => {
    try {
      const authUrl = await getDriveAuthUrl();
      window.location.href = authUrl;
    } catch (e) {
      console.error('[DriveStatusBadge] failed to get auth URL:', e.message);
    }
  };

  if (status === null) return null;

  if (status.connected) {
    return (
      <span
        title={`Google Drive מחובר: ${status.email}`}
        className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 select-none"
      >
        <span aria-hidden="true">☁</span>
        <span className="hidden sm:inline">Drive ✓</span>
      </span>
    );
  }

  return (
    <button
      onClick={handleConnect}
      title="חבר Google Drive לשמירת ניתוחים מחוץ ל-localStorage"
      className="text-xs text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
    >
      <span aria-hidden="true">☁</span>
      <span className="hidden sm:inline">חבר Drive</span>
    </button>
  );
}
