import { useState, useMemo, useCallback } from "react";
import {
  Cloud, CloudUpload, RefreshCw, Trash2, ExternalLink,
  Search, CheckSquare, Square, X, AlertTriangle,
} from "lucide-react";
import { useVideos, useUpdateVideo } from "@/hooks/useVideos";
import { loadSavedAnalysis } from "@/lib/localAnalysisStore";
import { backupAnalysisToDrive, deleteDriveFileById, isDriveConnected } from "@/lib/gdriveAnalysisStore";
import { readDriveFile } from "@/lib/gdriveClient";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── helpers ───────────────────────────────────────────────────────────────────

function getBackupStatus(video, scanResults) {
  if (scanResults[video.id] === 'missing') return 'missing';
  if (video.cloudBackupStatus === 'saved' && video.cloudBackupFileId) return 'backed_up';
  if (video.cloudBackupStatus === 'error') return 'error';
  return 'local_only';
}

function buildDriveBackupMeta(video) {
  const mainTopic = String(video.category || '').trim() || 'כללי';
  const subTopic  = String(video.subCategory || video.subTopic || '').trim() || null;
  const folderPath = [mainTopic, subTopic].filter(Boolean).join('/');
  const rawTitle   = String(video.title || '').trim();
  const safeTitle  = rawTitle.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').trim().slice(0, 60);
  return { folderPath, fileName: `${safeTitle || video.id}-${video.id}.json` };
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const STATUS_CFG = {
  backed_up:  { label: 'מגובה ✓',     cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  error:      { label: 'נכשל',        cls: 'bg-red-50 text-red-700 border border-red-200' },
  local_only: { label: 'מקומי בלבד', cls: 'bg-slate-100 text-slate-600 border border-slate-200' },
  missing:    { label: 'חסר ב-Drive', cls: 'bg-orange-50 text-orange-700 border border-orange-200' },
};

// ── component ─────────────────────────────────────────────────────────────────

export default function CloudBackups() {
  const { data: videos = [], isLoading } = useVideos();
  const updateVideo = useUpdateVideo();

  const [searchQuery,  setSearchQuery]  = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedIds,  setSelectedIds]  = useState(new Set());
  const [rowStates,    setRowStates]    = useState({}); // videoId → 'backing_up' | 'deleting'
  const [scanResults,  setScanResults]  = useState({}); // videoId → 'ok' | 'missing'
  const [isScanning,   setIsScanning]   = useState(false);
  const [isBulkOp,     setIsBulkOp]    = useState(false);

  const driveConnected = isDriveConnected();

  // ── data ──────────────────────────────────────────────────────────────────

  // Pre-compute which videos have local analysis (sync, fast)
  const localAnalysisSet = useMemo(() => {
    const s = new Set();
    videos.forEach(v => { if (loadSavedAnalysis(v.id)) s.add(v.id); });
    return s;
  }, [videos]);

  const analyzedVideos = useMemo(() =>
    videos.filter(v =>
      v.analysisStatus === 'completed' ||
      v.analysisStatus === 'analyzed' ||
      !!v.analyzedAt ||
      v.cloudBackupFileId ||
      localAnalysisSet.has(v.id)
    ),
  [videos, localAnalysisSet]);

  const filteredVideos = useMemo(() => {
    return analyzedVideos.filter(video => {
      const status = getBackupStatus(video, scanResults);

      if (activeFilter === 'backed_up'  && status !== 'backed_up')  return false;
      if (activeFilter === 'local_only' && status !== 'local_only') return false;
      if (activeFilter === 'failed'     && status !== 'error' && status !== 'missing') return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !(video.title       || '').toLowerCase().includes(q) &&
          !(video.category    || '').toLowerCase().includes(q) &&
          !(video.channelTitle || '').toLowerCase().includes(q)
        ) return false;
      }

      return true;
    });
  }, [analyzedVideos, activeFilter, searchQuery, scanResults]);

  const stats = useMemo(() => ({
    total:     analyzedVideos.length,
    backedUp:  analyzedVideos.filter(v => getBackupStatus(v, scanResults) === 'backed_up').length,
    localOnly: analyzedVideos.filter(v => getBackupStatus(v, scanResults) === 'local_only').length,
    failed:    analyzedVideos.filter(v => ['error','missing'].includes(getBackupStatus(v, scanResults))).length,
  }), [analyzedVideos, scanResults]);

  // ── single-row actions ────────────────────────────────────────────────────

  const doBackup = useCallback(async (video) => {
    if (!isDriveConnected()) { toast.error('Drive לא מחובר'); return false; }
    const analysis = loadSavedAnalysis(video.id);
    if (!analysis) { toast.error('אין ניתוח מקומי לגיבוי'); return false; }

    setRowStates(p => ({ ...p, [video.id]: 'backing_up' }));
    try {
      const { folderPath, fileName } = buildDriveBackupMeta(video);
      const { fileId } = await backupAnalysisToDrive(video.id, analysis, folderPath, fileName);
      const now = new Date().toISOString();
      await updateVideo.mutateAsync({
        id: video.id,
        cloudBackupFileId: fileId, cloudBackupPath: folderPath,
        cloudBackupAt: now, cloudBackupStatus: 'saved',
      });
      setScanResults(p => ({ ...p, [video.id]: 'ok' }));
      return true;
    } catch (e) {
      console.warn('[CloudBackups] backup failed:', e.message);
      await updateVideo.mutateAsync({ id: video.id, cloudBackupStatus: 'error' }).catch(() => {});
      return false;
    } finally {
      setRowStates(p => { const n = { ...p }; delete n[video.id]; return n; });
    }
  }, [updateVideo]);

  const handleBackup = useCallback(async (video) => {
    const ok = await doBackup(video);
    toast[ok ? 'success' : 'error'](ok ? `${(video.title || '').slice(0,30)} — גובה ✓` : 'גיבוי נכשל');
  }, [doBackup]);

  const handleDeleteBackup = useCallback(async (video) => {
    if (!video.cloudBackupFileId) return;
    const confirmed = window.confirm(`מחק גיבוי Drive של "${String(video.title || '').slice(0,50)}"?`);
    if (!confirmed) return;
    setRowStates(p => ({ ...p, [video.id]: 'deleting' }));
    try {
      await deleteDriveFileById(video.cloudBackupFileId);
      await updateVideo.mutateAsync({
        id: video.id, cloudBackupFileId: null,
        cloudBackupPath: null, cloudBackupAt: null, cloudBackupStatus: null,
      });
      setScanResults(p => { const n = { ...p }; delete n[video.id]; return n; });
      toast.success('גיבוי Drive נמחק');
    } catch {
      toast.error('מחיקה נכשלה');
    } finally {
      setRowStates(p => { const n = { ...p }; delete n[video.id]; return n; });
    }
  }, [updateVideo]);

  const handleOpenInDrive = useCallback((fileId) => {
    if (fileId) window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank', 'noopener');
  }, []);

  // ── validation scan ───────────────────────────────────────────────────────

  const handleScan = useCallback(async () => {
    if (!isDriveConnected()) { toast.error('Drive לא מחובר — אי אפשר לסרוק'); return; }
    const toScan = analyzedVideos.filter(v => v.cloudBackupFileId);
    if (toScan.length === 0) { toast.info('אין קבצים לסריקה'); return; }

    setIsScanning(true);
    const results = {};
    for (const video of toScan) {
      try {
        const file = await readDriveFile(video.cloudBackupFileId);
        results[video.id] = file === null ? 'missing' : 'ok';
      } catch {
        results[video.id] = 'missing';
      }
    }
    setScanResults(results);
    const missing = Object.values(results).filter(r => r === 'missing').length;
    toast[missing > 0 ? 'warning' : 'success'](
      missing > 0 ? `סריקה הושלמה — ${missing} קבצים חסרים ב-Drive` : 'סריקה הושלמה — כל הגיבויים תקינים'
    );
    setIsScanning(false);
  }, [analyzedVideos]);

  // ── bulk actions ──────────────────────────────────────────────────────────

  const allSelected = filteredVideos.length > 0 && filteredVideos.every(v => selectedIds.has(v.id));

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(filteredVideos.map(v => v.id)));
  };
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const handleBulkBackup = async () => {
    if (!isDriveConnected()) { toast.error('Drive לא מחובר'); return; }
    const toBackup = filteredVideos.filter(v => selectedIds.has(v.id));
    setIsBulkOp(true);
    let ok = 0;
    for (const v of toBackup) { if (await doBackup(v)) ok++; }
    setIsBulkOp(false);
    setSelectedIds(new Set());
    toast.success(`${ok} גיבויים הושלמו${ok < toBackup.length ? `, ${toBackup.length - ok} נכשלו` : ''}`);
  };

  const handleBulkDelete = async () => {
    const toDel = filteredVideos.filter(v => selectedIds.has(v.id) && v.cloudBackupFileId);
    if (toDel.length === 0) { toast.info('אין גיבויים למחיקה'); return; }
    if (!window.confirm(`מחק ${toDel.length} גיבויי Drive?`)) return;
    setIsBulkOp(true);
    for (const video of toDel) {
      try {
        await deleteDriveFileById(video.cloudBackupFileId);
        await updateVideo.mutateAsync({
          id: video.id, cloudBackupFileId: null,
          cloudBackupPath: null, cloudBackupAt: null, cloudBackupStatus: null,
        });
        setScanResults(p => { const n = { ...p }; delete n[video.id]; return n; });
      } catch {}
    }
    setIsBulkOp(false);
    setSelectedIds(new Set());
    toast.success('גיבויים נמחקו');
  };

  const handleBulkResync = async () => {
    if (!isDriveConnected()) { toast.error('Drive לא מחובר'); return; }
    const toResync = filteredVideos.filter(v => selectedIds.has(v.id) && v.cloudBackupFileId);
    if (toResync.length === 0) { toast.info('אין גיבויים לסנכרון'); return; }
    setIsBulkOp(true);
    let ok = 0;
    for (const v of toResync) { if (await doBackup(v)) ok++; }
    setIsBulkOp(false);
    setSelectedIds(new Set());
    toast.success(`${ok} סינכרונים הושלמו`);
  };

  // ── render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse dark:bg-zinc-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6 gap-4 overflow-hidden" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Cloud className="h-6 w-6 text-blue-500" />
            גיבויי ענן
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {stats.total} מנותחים · {stats.backedUp} מגובים · {stats.localOnly} מקומי בלבד
            {stats.failed > 0 && (
              <span className="text-orange-500 font-medium"> · {stats.failed} בעיות</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!driveConnected && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Drive לא מחובר
            </span>
          )}
          <button
            onClick={handleScan}
            disabled={isScanning || !driveConnected}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
          >
            <RefreshCw className={cn("h-4 w-4", isScanning && "animate-spin")} />
            {isScanning ? 'סורק...' : 'סרוק Drive'}
          </button>
        </div>
      </div>

      {/* ── Filters + search ── */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 dark:bg-zinc-800">
          {[
            { key: 'all',        label: `הכל (${stats.total})` },
            { key: 'backed_up',  label: `מגובה (${stats.backedUp})` },
            { key: 'local_only', label: `מקומי (${stats.localOnly})` },
            { key: 'failed',     label: `בעיות${stats.failed > 0 ? ` (${stats.failed})` : ''}` },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap",
                activeFilter === f.key
                  ? "bg-white text-slate-900 shadow-sm font-medium dark:bg-zinc-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="חיפוש לפי כותרת, קטגוריה, ערוץ..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white dark:placeholder-zinc-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute left-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl shrink-0 dark:bg-blue-950/30 dark:border-blue-800">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{selectedIds.size} נבחרו</span>
          <div className="flex gap-2 mr-auto flex-wrap">
            <button
              onClick={handleBulkBackup}
              disabled={isBulkOp || !driveConnected}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <CloudUpload className="h-3.5 w-3.5" />
              {isBulkOp ? 'מגבה...' : 'גיבוי נבחרים'}
            </button>
            <button
              onClick={handleBulkResync}
              disabled={isBulkOp || !driveConnected}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              סנכרן מחדש
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isBulkOp}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              מחק גיבויים
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              בטל בחירה
            </button>
          </div>
        </div>
      )}

      {/* ── Table / empty state ── */}
      {filteredVideos.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-400">
            <Cloud className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {analyzedVideos.length === 0
                ? 'אין סרטונים מנותחים עדיין'
                : 'אין תוצאות לפילטר הנוכחי'}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white dark:bg-zinc-900 dark:border-zinc-700">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 dark:bg-zinc-800 dark:border-zinc-700">
              <tr>
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleSelectAll} className="block">
                    {allSelected
                      ? <CheckSquare className="h-4 w-4 text-blue-600" />
                      : <Square className="h-4 w-4 text-slate-400" />}
                  </button>
                </th>
                <th className="px-2 py-3 w-14" />
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-zinc-400">כותרת</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-zinc-400">קטגוריה</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-zinc-400">סטטוס</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-zinc-400 whitespace-nowrap">תאריך גיבוי</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-zinc-400">נתיב Drive</th>
                <th className="px-4 py-3 w-32 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-zinc-400">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredVideos.map(video => {
                const status    = getBackupStatus(video, scanResults);
                const statusCfg = STATUS_CFG[status] || STATUS_CFG.local_only;
                const isSelected = selectedIds.has(video.id);
                const rowState   = rowStates[video.id];
                const hasLocal   = localAnalysisSet.has(video.id);

                return (
                  <tr
                    key={video.id}
                    className={cn(
                      "hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800/50",
                      isSelected && "bg-blue-50/60 dark:bg-blue-950/20"
                    )}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSelect(video.id)} className="block">
                        {isSelected
                          ? <CheckSquare className="h-4 w-4 text-blue-600" />
                          : <Square className="h-4 w-4 text-slate-300 hover:text-slate-500" />}
                      </button>
                    </td>

                    {/* Thumbnail */}
                    <td className="px-2 py-3">
                      {(video.thumbnail || video.thumbnailUrl) ? (
                        <img
                          src={video.thumbnail || video.thumbnailUrl}
                          alt=""
                          loading="lazy"
                          className="w-14 h-9 rounded object-cover"
                        />
                      ) : (
                        <div className="w-14 h-9 rounded bg-slate-100 dark:bg-zinc-700" />
                      )}
                    </td>

                    {/* Title */}
                    <td className="px-4 py-3 max-w-[220px]">
                      <div className="font-medium text-slate-800 truncate dark:text-zinc-100" title={video.title}>
                        {video.title || '—'}
                      </div>
                      <div className="text-xs text-slate-400 truncate">{video.channelTitle}</div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-slate-600 dark:text-zinc-300">{video.category || ''}</span>
                      {video.subCategory && (
                        <span className="text-xs text-slate-400 dark:text-zinc-500"> / {video.subCategory}</span>
                      )}
                      {!video.category && <span className="text-slate-300">—</span>}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", statusCfg.cls)}>
                        {rowState === 'backing_up' ? 'מגבה...'
                          : rowState === 'deleting' ? 'מוחק...'
                          : statusCfg.label}
                      </span>
                      {!hasLocal && status === 'local_only' && (
                        <span title="אין ניתוח מקומי" className="mr-1 text-amber-400 text-xs">⚠</span>
                      )}
                    </td>

                    {/* Backup date */}
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                      {formatDate(video.cloudBackupAt)}
                    </td>

                    {/* Drive path */}
                    <td className="px-4 py-3 max-w-[180px]">
                      <span
                        className="text-xs text-slate-400 dark:text-zinc-500 truncate block"
                        title={video.cloudBackupPath ? `YouTubeMentor/${video.cloudBackupPath}` : ''}
                      >
                        {video.cloudBackupPath ? `YouTubeMentor/${video.cloudBackupPath}` : '—'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        {/* Backup or re-sync */}
                        {status !== 'backed_up' ? (
                          <button
                            onClick={() => handleBackup(video)}
                            disabled={!!rowState || !driveConnected || !hasLocal}
                            title={!hasLocal ? 'אין ניתוח מקומי' : 'גיבוי לענן'}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors dark:hover:bg-blue-900/30"
                          >
                            <CloudUpload className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBackup(video)}
                            disabled={!!rowState || !driveConnected || !hasLocal}
                            title="סנכרן מחדש"
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors dark:hover:bg-emerald-900/30"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        )}

                        {/* Open in Drive */}
                        {video.cloudBackupFileId && (
                          <button
                            onClick={() => handleOpenInDrive(video.cloudBackupFileId)}
                            title="פתח ב-Drive"
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors dark:hover:bg-zinc-700"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        )}

                        {/* Delete Drive backup */}
                        {video.cloudBackupFileId && (
                          <button
                            onClick={() => handleDeleteBackup(video)}
                            disabled={!!rowState}
                            title="מחק גיבוי Drive"
                            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      {filteredVideos.length > 0 && (
        <p className="text-xs text-slate-400 text-center shrink-0">
          מציג {filteredVideos.length} מתוך {analyzedVideos.length} סרטונים מנותחים
        </p>
      )}
    </div>
  );
}
