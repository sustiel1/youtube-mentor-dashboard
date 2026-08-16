import { ExternalLink } from 'lucide-react';

function formatDate(value) {
  if (!value) return 'טרם נשמר';
  try {
    return new Date(value).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return 'תאריך לא זמין';
  }
}

function StatusPill({ active, activeLabel, inactiveLabel }) {
  return (
    <span
      role="status"
      aria-label={active ? activeLabel : inactiveLabel}
      className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${active
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
        : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'}`}
    >
      {active ? `✓ ${activeLabel}` : `○ ${inactiveLabel}`}
    </span>
  );
}

function DestinationCard({ title, icon, children, actionLabel, onAction, actionHref, disabled = false }) {
  const className = 'inline-flex items-center justify-center gap-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <section className="flex min-h-[190px] flex-col rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h4 className="text-lg font-extrabold text-slate-900 dark:text-zinc-100">{icon} {title}</h4>
      <div className="mt-3 flex-1 space-y-2 text-sm text-slate-600 dark:text-zinc-300">{children}</div>
      {actionHref && !disabled ? (
        <a href={actionHref} className={className} aria-label={actionLabel}>
          <ExternalLink className="h-4 w-4" /> {actionLabel}
        </a>
      ) : (
        <button type="button" onClick={onAction} disabled={disabled} className={className} aria-label={actionLabel}>
          <ExternalLink className="h-4 w-4" /> {actionLabel}
        </button>
      )}
    </section>
  );
}

export function ContentRoutingBridge({
  routing,
  readOnly = false,
  onPreviewCollection,
  onEditClassification,
  onOpenWorkspace,
  onOpenAnalysis,
  onObsidianAction,
}) {
  if (!routing) return null;
  const { source, classification, collections, workspace, obsidian } = routing;
  const obsidianActionLabel = obsidian.exported ? 'פתח ב־Obsidian' : 'ייצא ל־Obsidian';
  const canOpenObsidian = Boolean(obsidian.exported && obsidian.openUrl);

  return (
    <section className="space-y-5 rounded-3xl border border-indigo-200 bg-gradient-to-b from-indigo-50/70 to-white p-5 text-right shadow-sm dark:border-indigo-900 dark:from-indigo-950/20 dark:to-zinc-950" dir="rtl" data-content-routing-version={routing.version} data-routing-read-only={readOnly ? 'true' : 'false'}>
      <header>
        <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">ניתוח סרטון ← Workspace Library ← Obsidian</p>
        <h2 className="mt-1 text-2xl font-extrabold text-slate-950 dark:text-zinc-50">גשר ניתוב ותיעוד מקור</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">{readOnly ? 'תצוגה לקריאה בלבד המבוססת על הרשומות והסטטוסים שנשמרו.' : 'מצב ניתוב משותף לשבעת אוספי התוכן.'}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex gap-4">
            {source.thumbnail ? <img src={source.thumbnail} alt="" className="h-24 w-40 rounded-xl object-cover" /> : <div className="h-24 w-40 rounded-xl bg-slate-100 dark:bg-zinc-800" />}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-300">מקור</p>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-zinc-100">{source.title}</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400">{source.channel}</p>
              <code dir="ltr" className="mt-2 block break-all text-xs text-slate-500">{source.videoId || 'ללא מזהה מקור'}</code>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusPill active activeLabel={source.analysisStatus} inactiveLabel="ניתוח לא זמין" />
            <span className="rounded-full border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 dark:border-zinc-700 dark:text-zinc-300">{source.availableCollectionCount} אוספים עם תוכן</span>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-300">סיווג קנוני</p>
              <h3 className="mt-1 text-lg font-extrabold text-slate-900 dark:text-zinc-100">{classification.primaryTopicName || 'ללא נושא מאומת'} ← {classification.organizationalSubtopicName || 'ללא תת־נושא'}</h3>
            </div>
            {!readOnly && onEditClassification && <button type="button" onClick={onEditClassification} className="rounded-xl border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-800 dark:text-indigo-300">ערוך סיווג</button>}
          </div>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-400">נושא Workspace</dt><dd className="font-bold">{classification.primaryTopicName || 'לא הוגדר'}</dd></div>
            <div><dt className="text-slate-400">תת־נושא ארגוני</dt><dd className="font-bold">{classification.organizationalSubtopicName || 'לא הוגדר'}</dd></div>
            <div><dt className="text-slate-400">המלצה</dt><dd>{classification.recommended || 'סיווג קנוני קיים'}</dd></div>
            <div><dt className="text-slate-400">ביטחון</dt><dd>{classification.confidence != null ? `${classification.confidence}%` : 'מאומת לפי taxonomy'}</dd></div>
          </dl>
          <div className="mt-3"><StatusPill active={classification.valid} activeLabel="יעד תקין" inactiveLabel="יעד דורש תיקון" /></div>
        </section>
      </div>

      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-200 bg-white/70 px-4 py-3 text-center text-sm font-bold text-slate-700 dark:border-indigo-900 dark:bg-zinc-900/70 dark:text-zinc-200 md:flex-row" aria-label="זרימת הניתוב">
        <span>ניתוח הסרטון</span><span aria-hidden="true">←</span>
        <span>נושא: {classification.primaryTopicName || 'לא הוגדר'}</span><span aria-hidden="true">←</span>
        <span>תת־נושא: {classification.organizationalSubtopicName || 'לא הוגדר'}</span><span aria-hidden="true">←</span>
        <span>7 אוספי תוכן</span><span aria-hidden="true">↙ Workspace</span><span aria-hidden="true">↘ Obsidian</span>
      </div>

      <section>
        <h3 className="text-lg font-extrabold text-slate-900 dark:text-zinc-100">ניתוב האוספים</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {collections.map(collection => (
            <article key={collection.collectionKey} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900" data-routing-collection={collection.collectionKey}>
              <div className="flex items-start justify-between gap-3">
                <h4 className="font-extrabold text-slate-900 dark:text-zinc-100">{collection.icon} {collection.label}</h4>
                <span className="text-xs text-slate-500">{collection.logicalItemCount} פריטים לוגיים</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill active={collection.available} activeLabel="קיים תוכן" inactiveLabel="אין תוכן" />
                <StatusPill active={collection.workspaceSaved} activeLabel={`Workspace: ${collection.workspaceLogicalCount}`} inactiveLabel="לא נשמר ב־Workspace" />
                <StatusPill active={collection.obsidianExported} activeLabel={`Obsidian: ${collection.obsidianLogicalCount}`} inactiveLabel="לא יוצא ל־Obsidian" />
              </div>
              <p className="mt-3 text-xs text-slate-400">Workspace: {formatDate(collection.workspaceSavedAt)} · Obsidian: {formatDate(collection.obsidianExportedAt)}</p>
              {onPreviewCollection && <button type="button" onClick={() => onPreviewCollection(collection)} className="mt-3 rounded-xl border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-800 dark:text-indigo-300" aria-label={`הצג תצוגה מקדימה של ${collection.label}`}>הצג תוכן</button>}
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <DestinationCard title="Workspace Library" icon="⭐" actionLabel={readOnly ? 'פתח ניתוח סרטון' : 'פתח ב־Workspace'} onAction={readOnly ? onOpenAnalysis : onOpenWorkspace} disabled={readOnly ? !onOpenAnalysis : !onOpenWorkspace}>
          <p>יעד: <strong>{classification.primaryTopicName || 'לא הוגדר'} / {classification.organizationalSubtopicName || 'הכל'}</strong></p>
          <p>מיפוי: שבעת האוספים הקנוניים</p>
          <p>{workspace.logicalItemCount} פריטים לוגיים · {workspace.recordCount} רשומות</p>
          <p>שמירה אחרונה: {formatDate(workspace.lastSavedAt)}</p>
          <StatusPill active={workspace.saved} activeLabel="נשמר" inactiveLabel="לא נשמר" />
        </DestinationCard>

        <DestinationCard title="Obsidian" icon="🟣" actionLabel={obsidianActionLabel} onAction={onObsidianAction} actionHref={canOpenObsidian ? obsidian.openUrl : null} disabled={!canOpenObsidian && !onObsidianAction}>
          <p>Vault: <strong>{obsidian.vaultName || 'לא הוגדר'}</strong></p>
          <p className="break-all">תיקייה: <span dir="ltr">{obsidian.folderPath || 'לא נפתרה'}</span></p>
          <p className="break-all">קובץ: <span dir="ltr">{obsidian.filePath || obsidian.exportedPath || 'טרם יוצא'}</span></p>
          <p>ייצוא אחרון: {formatDate(obsidian.exportedAt)}</p>
          <StatusPill active={obsidian.exported} activeLabel="יוצא" inactiveLabel="לא יוצא" />
        </DestinationCard>
      </div>

      {readOnly && <p className="text-xs text-slate-400">מקור התצוגה: {routing.provenance.metadataRecordCount} רשומות persisted; {routing.provenance.legacyMetadataCount} מהן נקראו דרך מתאם legacy ללא שינוי נתונים.</p>}
    </section>
  );
}
