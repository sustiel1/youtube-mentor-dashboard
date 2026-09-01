import { ExternalLink } from 'lucide-react';
import { StructuredSnapshotContent } from '@/components/workspace/StructuredSnapshotView';
import { selectSavedAnalysisSections, selectSavedAnalysisViewer } from '@/utils/workspaceSavedAnalysis';
import { getWorkspaceHeadingByCollection } from '@/config/workspaceHeadingRegistry';
import { WorkspaceCollectionTiles } from '@/components/workspace/WorkspaceCollectionTiles';
import { SavedMarketRowsTable } from '@/components/workspace/SavedMarketRowsTable';
import { SavedStockRowsTable } from '@/components/workspace/SavedStockRowsTable';
import { SavedSectorRowsTable } from '@/components/workspace/SavedSectorRowsTable';
import { SavedOpportunityRowsTable } from '@/components/workspace/SavedOpportunityRowsTable';
import { SavedNewsRows } from '@/components/workspace/SavedNewsRows';
import {
  isMarketRowsSection,
  isStockRowsSection,
  isSectorRowsSection,
  isOpportunityRowsSection,
  isNewsRowsSection,
} from '@/utils/workspaceSavedRowsDetection';
import { ContentRoutingBridge } from '@/components/shared/ContentRoutingBridge';
import {
  selectContentRoutingState,
  selectObsidianCollectionStatuses,
} from '@/utils/contentRouting';
import { getWorkspaceSourceVideoId } from '@/utils/workspaceItemIdentity';
import { getObsidianItemSavesForVideo } from '@/lib/obsidianItemSaveStore';
import { buildObsidianOpenUrl, getActiveObsidianVaultConfig } from '@/lib/obsidianVaultConfig';
import { getBriefContextDisplay, formatBriefPublishDatePlain } from '@/lib/briefContextDisplay';
import {
  AnalysisFieldGrid,
  AnalysisList,
  AnalysisSectionCard,
  AnalysisTimestampLink,
} from '@/components/shared/AnalysisContentPrimitives';
import {
  getWorkspaceRecordRevealState,
  useWorkspaceRecordRevealIds,
  WORKSPACE_RECORD_REVEAL_CLASS,
} from '@/context/WorkspaceRecordRevealContext';

function dateText(value) {
  try { return value ? new Date(value).toLocaleDateString('he-IL') : 'ללא תאריך'; }
  catch { return 'ללא תאריך'; }
}

/**
 * `HH:mm` (24-hour, he-IL, local browser timezone) for a publish timestamp
 * whose DATE portion has already been confirmed valid via
 * formatBriefPublishDatePlain(). Returns '' (never a stray time with no
 * date) when the time itself can't be produced in the expected shape.
 */
function publishedTimeText(publishedAt) {
  try {
    const time = new Date(publishedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
    return /^\d{1,2}:\d{2}$/.test(time) ? time : '';
  } catch {
    return '';
  }
}

/**
 * Shared metadata line for all six saved-row section renderers
 * (SavedTextSection / SavedMarketSection / SavedStockSection /
 * SavedSectorSection / SavedOpportunitySection / SavedNewsSection).
 * Composes, in RTL reading order (rightmost first):
 *   1. "פורסם {publish date} {HH:mm}" — bold/emphasized, since this is the
 *      value a trader actually cares about. Only shown when at least one
 *      provenance entry resolves a videoPublishedAt (own persisted field or
 *      the videoLookup fallback, see provenanceFor() in
 *      workspaceSavedAnalysis.js). Omitted entirely when no publish date
 *      resolves, when the date is technically present but invalid
 *      ("Invalid Date"), or when the section's saved items come from more
 *      than one source video (2026-09-01: a mixed-video section showing one
 *      video's publish date would misrepresent the others — same unanimity
 *      guard as the brief label below, just keyed on sourceVideoId) — never
 *      rendered with a lone time and no date.
 *   2. The morning/evening brief label — only when every saved item in the
 *      section agrees on the same sourceBriefSlug (a mixed section would
 *      otherwise show one misleading label for items from a different
 *      brief). Generalized from the news-only logic that used to live here.
 *   3. "נשמר לאחרונה {save date}" — kept, but de-emphasized and moved after
 *      the publish date per user feedback (2026-09-01): the save date is
 *      the least important value for a trader and must not visually lead.
 *   4. "{N} רשומות מקור" — unchanged from before this task.
 * Returns JSX (not a plain string) so the publish-date segment can be bold
 * while the rest stays regular weight; AnalysisContentPrimitives.jsx's
 * `metadata` prop already renders whatever node it's given.
 */
function buildSectionMetadataLine(provenance, recordCount) {
  const latestSave = provenance.reduce((latest, entry) => (
    String(entry.savedAt || '') > latest ? String(entry.savedAt || '') : latest
  ), '');
  const sourceVideoIds = new Set(provenance.map(entry => entry.sourceVideoId).filter(Boolean));
  const singleVideoSection = sourceVideoIds.size <= 1;
  const publishedAt = singleVideoSection
    ? provenance.find(entry => entry.videoPublishedAt)?.videoPublishedAt || null
    : null;
  const publishDatePlain = formatBriefPublishDatePlain(publishedAt);
  let publishedText = null;
  if (publishDatePlain) {
    const timeText = publishedTimeText(publishedAt);
    publishedText = timeText ? `פורסם ${publishDatePlain} ${timeText}` : `פורסם ${publishDatePlain}`;
  }
  const briefSlugs = new Set(provenance.map(entry => entry.sourceBriefSlug).filter(Boolean));
  const briefLabel = briefSlugs.size === 1 ? getBriefContextDisplay([...briefSlugs][0])?.title : null;
  // Everything except the publish date stays a single plain-text node, joined
  // exactly like before this feature — only the publish date gets its own
  // bold element. When there's no publish date to show, this returns a plain
  // string, byte-identical to the pre-freshness-feature output.
  const restText = [
    briefLabel,
    `נשמר לאחרונה ${dateText(latestSave)}`,
    `${recordCount} רשומות מקור`,
  ].filter(Boolean).join(' · ');
  if (!publishedText) return restText;
  return (
    <>
      <strong className="font-extrabold text-slate-800 dark:text-zinc-100">{publishedText}</strong>
      {restText ? ` · ${restText}` : null}
    </>
  );
}

function technicalDetails(section) {
  return (
    <details className="mt-4 border-t border-slate-100 pt-3 text-xs dark:border-zinc-800">
      <summary className="cursor-pointer font-semibold text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">פרטים טכניים</summary>
      <ul className="mt-2 space-y-2">
        {section.provenance.map(entry => (
          <li key={entry.recordId} className="grid gap-1 rounded-xl bg-slate-50 px-3 py-2 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 sm:grid-cols-[1fr_auto]">
            <code dir="ltr" className="break-all text-[11px]">{entry.recordId}</code>
            <span>{dateText(entry.savedAt)}</span>
            <span>מקור: {entry.sourceTab || 'לא נשמר'} / {entry.sourceSectionHeading || 'לא נשמר'}</span>
            <span>סוג: {entry.originalItemType || 'legacy'}</span>
            {entry.sourceTimestamp != null && <span>זמן מקור: {entry.sourceTimestamp}</span>}
            {entry.contentHash && <code dir="ltr" className="break-all text-[10px]">Hash: {entry.contentHash}</code>}
          </li>
        ))}
      </ul>
    </details>
  );
}

function SavedTextSection({ section, selectedIds, onToggleGroup, videoUrl }) {
  const recordIds = [...new Set(section.provenance.map(entry => entry.recordId))];
  const selected = recordIds.length > 0 && recordIds.every(id => selectedIds.has(id));
  const sourceTimestamp = section.provenance.find(entry => entry.sourceTimestamp != null)?.sourceTimestamp ?? null;
  const collectionIcon = getWorkspaceHeadingByCollection(section.tabId)?.emoji || '';
  return (
    <AnalysisSectionCard
      title={section.heading}
      icon={section.icon || collectionIcon}
      count={section.entries.length + section.fields.length}
      metadata={buildSectionMetadataLine(section.provenance, recordIds.length)}
      checkbox={<input type="checkbox" checked={selected} onChange={() => onToggleGroup(recordIds, !selected)} aria-label={`בחר את התוכן השמור תחת ${section.heading}`} className="mt-2 h-4 w-4 shrink-0" />}
      className="shadow-sm"
    >
      <div className="space-y-3" data-persisted-record-count={recordIds.length}>
        <AnalysisFieldGrid fields={section.fields} />
        <AnalysisList entries={section.entries} selectedIds={selectedIds} onToggleGroup={onToggleGroup} />
        <AnalysisTimestampLink videoUrl={videoUrl} timestamp={sourceTimestamp} />
      </div>
      {technicalDetails(section)}
    </AnalysisSectionCard>
  );
}

/**
 * Same card shell as SavedTextSection, but the bullet list is replaced by
 * SavedMarketRowsTable (colored trend pills, consolidated links menu).
 * SavedTextSection / AnalysisList are left untouched for every other type.
 */
function SavedMarketSection({ section, selectedIds, onToggleGroup, videoUrl }) {
  const recordIds = [...new Set(section.provenance.map(entry => entry.recordId))];
  const selected = recordIds.length > 0 && recordIds.every(id => selectedIds.has(id));
  const sourceTimestamp = section.provenance.find(entry => entry.sourceTimestamp != null)?.sourceTimestamp ?? null;
  const collectionIcon = getWorkspaceHeadingByCollection(section.tabId)?.emoji || '';
  return (
    <AnalysisSectionCard
      title={section.heading}
      icon={section.icon || collectionIcon}
      count={section.entries.length + section.fields.length}
      metadata={buildSectionMetadataLine(section.provenance, recordIds.length)}
      checkbox={<input type="checkbox" checked={selected} onChange={() => onToggleGroup(recordIds, !selected)} aria-label={`בחר את התוכן השמור תחת ${section.heading}`} className="mt-2 h-4 w-4 shrink-0" />}
      className="shadow-sm"
    >
      <div className="space-y-3" data-persisted-record-count={recordIds.length}>
        <AnalysisFieldGrid fields={section.fields} />
        <SavedMarketRowsTable entries={section.entries} selectedIds={selectedIds} onToggleGroup={onToggleGroup} />
        <AnalysisTimestampLink videoUrl={videoUrl} timestamp={sourceTimestamp} />
      </div>
      {technicalDetails(section)}
    </AnalysisSectionCard>
  );
}

/**
 * Same card shell as SavedTextSection, but the bullet list is replaced by
 * SavedStockRowsTable (sector pill, sentiment/category pills, activity tag).
 * SavedTextSection / AnalysisList are left untouched for every other type.
 */
function SavedStockSection({ section, selectedIds, onToggleGroup, videoUrl }) {
  const recordIds = [...new Set(section.provenance.map(entry => entry.recordId))];
  const selected = recordIds.length > 0 && recordIds.every(id => selectedIds.has(id));
  const sourceTimestamp = section.provenance.find(entry => entry.sourceTimestamp != null)?.sourceTimestamp ?? null;
  const collectionIcon = getWorkspaceHeadingByCollection(section.tabId)?.emoji || '';
  return (
    <AnalysisSectionCard
      title={section.heading}
      icon={section.icon || collectionIcon}
      count={section.entries.length + section.fields.length}
      metadata={buildSectionMetadataLine(section.provenance, recordIds.length)}
      checkbox={<input type="checkbox" checked={selected} onChange={() => onToggleGroup(recordIds, !selected)} aria-label={`בחר את התוכן השמור תחת ${section.heading}`} className="mt-2 h-4 w-4 shrink-0" />}
      className="shadow-sm"
    >
      <div className="space-y-3" data-persisted-record-count={recordIds.length}>
        <AnalysisFieldGrid fields={section.fields} />
        <SavedStockRowsTable entries={section.entries} selectedIds={selectedIds} onToggleGroup={onToggleGroup} />
        <AnalysisTimestampLink videoUrl={videoUrl} timestamp={sourceTimestamp} />
      </div>
      {technicalDetails(section)}
    </AnalysisSectionCard>
  );
}

/**
 * Same card shell as SavedTextSection, but the bullet list is replaced by
 * SavedSectorRowsTable (ETF pill, sentiment pill, ticker-linkified commentary).
 * SavedTextSection / AnalysisList are left untouched for every other type.
 */
function SavedSectorSection({ section, selectedIds, onToggleGroup, videoUrl }) {
  const recordIds = [...new Set(section.provenance.map(entry => entry.recordId))];
  const selected = recordIds.length > 0 && recordIds.every(id => selectedIds.has(id));
  const sourceTimestamp = section.provenance.find(entry => entry.sourceTimestamp != null)?.sourceTimestamp ?? null;
  const collectionIcon = getWorkspaceHeadingByCollection(section.tabId)?.emoji || '';
  return (
    <AnalysisSectionCard
      title={section.heading}
      icon={section.icon || collectionIcon}
      count={section.entries.length + section.fields.length}
      metadata={buildSectionMetadataLine(section.provenance, recordIds.length)}
      checkbox={<input type="checkbox" checked={selected} onChange={() => onToggleGroup(recordIds, !selected)} aria-label={`בחר את התוכן השמור תחת ${section.heading}`} className="mt-2 h-4 w-4 shrink-0" />}
      className="shadow-sm"
    >
      <div className="space-y-3" data-persisted-record-count={recordIds.length}>
        <AnalysisFieldGrid fields={section.fields} />
        <SavedSectorRowsTable entries={section.entries} selectedIds={selectedIds} onToggleGroup={onToggleGroup} />
        <AnalysisTimestampLink videoUrl={videoUrl} timestamp={sourceTimestamp} />
      </div>
      {technicalDetails(section)}
    </AnalysisSectionCard>
  );
}

/**
 * Same card shell as SavedTextSection, but the bullet list is replaced by
 * SavedOpportunityRowsTable (trade-plan table for the dominant producer
 * shape, news-style fallback rows for the MacroGemDashboard shape).
 * SavedTextSection / AnalysisList are left untouched for every other type.
 */
function SavedOpportunitySection({ section, selectedIds, onToggleGroup, videoUrl }) {
  const recordIds = [...new Set(section.provenance.map(entry => entry.recordId))];
  const selected = recordIds.length > 0 && recordIds.every(id => selectedIds.has(id));
  const sourceTimestamp = section.provenance.find(entry => entry.sourceTimestamp != null)?.sourceTimestamp ?? null;
  const collectionIcon = getWorkspaceHeadingByCollection(section.tabId)?.emoji || '';
  return (
    <AnalysisSectionCard
      title={section.heading}
      icon={section.icon || collectionIcon}
      count={section.entries.length + section.fields.length}
      metadata={buildSectionMetadataLine(section.provenance, recordIds.length)}
      checkbox={<input type="checkbox" checked={selected} onChange={() => onToggleGroup(recordIds, !selected)} aria-label={`בחר את התוכן השמור תחת ${section.heading}`} className="mt-2 h-4 w-4 shrink-0" />}
      className="shadow-sm"
    >
      <div className="space-y-3" data-persisted-record-count={recordIds.length}>
        <AnalysisFieldGrid fields={section.fields} />
        <SavedOpportunityRowsTable entries={section.entries} selectedIds={selectedIds} onToggleGroup={onToggleGroup} />
        <AnalysisTimestampLink videoUrl={videoUrl} timestamp={sourceTimestamp} />
      </div>
      {technicalDetails(section)}
    </AnalysisSectionCard>
  );
}

/**
 * Same card shell as SavedTextSection, but the bullet list is replaced by
 * SavedNewsRows (topic chip + entity chips + tone-bordered row, not a table
 * — news text is free-form and would produce mostly "—" table cells).
 * SavedTextSection / AnalysisList are left untouched for every other type.
 */
function SavedNewsSection({ section, selectedIds, onToggleGroup, videoUrl }) {
  const recordIds = [...new Set(section.provenance.map(entry => entry.recordId))];
  const selected = recordIds.length > 0 && recordIds.every(id => selectedIds.has(id));
  const sourceTimestamp = section.provenance.find(entry => entry.sourceTimestamp != null)?.sourceTimestamp ?? null;
  const collectionIcon = getWorkspaceHeadingByCollection(section.tabId)?.emoji || '';
  return (
    <AnalysisSectionCard
      title={section.heading}
      icon={section.icon || collectionIcon}
      count={section.entries.length + section.fields.length}
      metadata={buildSectionMetadataLine(section.provenance, recordIds.length)}
      checkbox={<input type="checkbox" checked={selected} onChange={() => onToggleGroup(recordIds, !selected)} aria-label={`בחר את התוכן השמור תחת ${section.heading}`} className="mt-2 h-4 w-4 shrink-0" />}
      className="shadow-sm"
    >
      <div className="space-y-3" data-persisted-record-count={recordIds.length}>
        <AnalysisFieldGrid fields={section.fields} />
        <SavedNewsRows entries={section.entries} selectedIds={selectedIds} onToggleGroup={onToggleGroup} />
        <AnalysisTimestampLink videoUrl={videoUrl} timestamp={sourceTimestamp} />
      </div>
      {technicalDetails(section)}
    </AnalysisSectionCard>
  );
}

function SnapshotSection({ section, selectedIds, onToggleGroup }) {
  const recordIds = section.provenance.map(entry => entry.recordId);
  const revealIds = useWorkspaceRecordRevealIds();
  const reveal = getWorkspaceRecordRevealState(recordIds, revealIds);
  const selected = recordIds.length > 0 && recordIds.every(id => selectedIds.has(id));
  return (
    <div {...reveal.attributes} className={reveal.highlighted ? WORKSPACE_RECORD_REVEAL_CLASS : undefined}>
      <AnalysisSectionCard
        title={section.copyCount > 1 ? `תמונת מצב אחת · ${section.copyCount} שמירות זהות` : 'תמונת מצב אחת'}
        icon="📊"
        metadata={`${recordIds.length} רשומות מקור שמורות`}
        checkbox={<input type="checkbox" checked={selected} onChange={() => onToggleGroup(recordIds, !selected)} aria-label="בחר תמונת מצב שמורה" className="mt-2 h-4 w-4 shrink-0" />}
        className="shadow-sm"
      >
        <div data-persisted-record-count={recordIds.length}>
          <StructuredSnapshotContent snapshot={section.snapshot} />
          {technicalDetails(section)}
        </div>
      </AnalysisSectionCard>
    </div>
  );
}

export function WorkspaceSavedAnalysisContent({ group, activeCollection, selectedIds, onToggleGroup, videoLookup }) {
  const viewer = selectSavedAnalysisViewer(group, videoLookup);
  const { collectionId, sections } = selectSavedAnalysisSections(viewer, activeCollection);
  return (
    <div className="space-y-3 bg-slate-50/60 p-5 dark:bg-zinc-950/30" data-saved-analysis-tab={collectionId}>
      {sections.length === 0
        ? <p role="status" className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-base text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">{viewer.emptyMessage}</p>
        : sections.map(section => {
          if (section.snapshot) {
            return <SnapshotSection key={section.id} section={section} selectedIds={selectedIds} onToggleGroup={onToggleGroup} />;
          }
          if (isMarketRowsSection(section)) {
            return <SavedMarketSection key={section.id} section={section} selectedIds={selectedIds} onToggleGroup={onToggleGroup} videoUrl={group.videoUrl} />;
          }
          if (isStockRowsSection(section)) {
            return <SavedStockSection key={section.id} section={section} selectedIds={selectedIds} onToggleGroup={onToggleGroup} videoUrl={group.videoUrl} />;
          }
          if (isSectorRowsSection(section)) {
            return <SavedSectorSection key={section.id} section={section} selectedIds={selectedIds} onToggleGroup={onToggleGroup} videoUrl={group.videoUrl} />;
          }
          if (isOpportunityRowsSection(section)) {
            return <SavedOpportunitySection key={section.id} section={section} selectedIds={selectedIds} onToggleGroup={onToggleGroup} videoUrl={group.videoUrl} />;
          }
          if (isNewsRowsSection(section)) {
            return <SavedNewsSection key={section.id} section={section} selectedIds={selectedIds} onToggleGroup={onToggleGroup} videoUrl={group.videoUrl} />;
          }
          return <SavedTextSection key={section.id} section={section} selectedIds={selectedIds} onToggleGroup={onToggleGroup} videoUrl={group.videoUrl} />;
        })}
    </div>
  );
}

export function WorkspaceGlobalSavedAnalysisGroup({ group, activeCollection, selectedIds, onToggleGroup, onFocusVideo, videoLookup }) {
  const logicalItemCount = group.uniqueContentCount || 0;
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900" data-workspace-source-video={group.videoKey}>
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4 text-right dark:border-zinc-800">
        {group.thumbnail && <img src={group.thumbnail} alt="" className="h-16 w-28 rounded-xl object-cover" />}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">מקור התוכן השמור</p>
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-zinc-100">{group.videoTitle}</h3>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            {group.channel || 'ערוץ לא ידוע'} · {logicalItemCount} תכנים ייחודיים · {group.items.length} שמירות · נשמר לאחרונה {dateText(group.latestSaveDate)}
          </p>
        </div>
        <button type="button" onClick={onFocusVideo} aria-label={`פתח אוסף שמור מהסרטון ${group.videoTitle}`} className="rounded-xl border border-indigo-200 px-3 py-2 text-sm font-bold text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-800 dark:text-indigo-300">פתח אוסף</button>
      </header>
      <WorkspaceSavedAnalysisContent group={group} activeCollection={activeCollection} selectedIds={selectedIds} onToggleGroup={onToggleGroup} videoLookup={videoLookup} />
    </article>
  );
}

export function WorkspaceFocusedVideoCard({
  group, activeCollection, selectedIds, onCollectionSelect, onClearFocus,
  onOpenVideo, onToggleGroup, onRequestDuplicateCleanup, visibleGroup = group,
  collectionCounts, topics = [], videoLookup,
}) {
  const viewer = selectSavedAnalysisViewer(visibleGroup, videoLookup);
  const revealIds = useWorkspaceRecordRevealIds();
  const renderedIds = new Set(viewer.renderedRecordIds);
  const unrenderedRecordIds = group.items
    .map(item => item?.id)
    .filter(id => id && revealIds.has(id) && !renderedIds.has(id));
  const fallbackReveal = getWorkspaceRecordRevealState(unrenderedRecordIds, revealIds);
  const duplicateIds = group.exactDuplicateGroups.flatMap(version => version.records.slice(1).map(item => item.id));
  const sourceVideoId = group.items.map(getWorkspaceSourceVideoId).find(Boolean) || group.videoId || null;
  const obsidianEntries = getObsidianItemSavesForVideo(sourceVideoId);
  const obsidianByCollection = selectObsidianCollectionStatuses(obsidianEntries);
  const latestObsidianEntry = obsidianEntries[0] || null;
  const activeVault = getActiveObsidianVaultConfig();
  const exportedPath = latestObsidianEntry?.destinationPath || null;
  const folderPath = exportedPath?.includes('/') ? exportedPath.slice(0, exportedPath.lastIndexOf('/')) : null;
  const routing = selectContentRoutingState({
    items: group.items,
    topics,
    persistedSource: {
      title: group.videoTitle,
      channel: group.channel,
      thumbnail: group.thumbnail,
    },
    obsidianByCollection,
    obsidian: {
      vaultName: activeVault.vaultName,
      folderPath,
      filePath: exportedPath,
      exportedPath,
      exportedAt: latestObsidianEntry?.savedAt || null,
      openUrl: exportedPath ? buildObsidianOpenUrl(exportedPath, activeVault.vaultName) : null,
    },
    persistedOnly: true,
  });

  return (
    <article
      data-video-key={group.videoKey}
      data-workspace-scope="video"
      {...fallbackReveal.attributes}
      className={`overflow-hidden rounded-3xl border border-indigo-200 bg-white shadow-sm transition-colors dark:border-indigo-800 dark:bg-zinc-900 ${fallbackReveal.highlighted ? WORKSPACE_RECORD_REVEAL_CLASS : ''}`}
    >
      <header className="grid gap-5 p-5 md:grid-cols-[240px_1fr]">
        <div className="aspect-video overflow-hidden rounded-2xl bg-slate-100 dark:bg-zinc-800">{group.thumbnail && <img src={group.thumbnail} alt="" className="h-full w-full object-cover" />}</div>
        <div className="min-w-0 space-y-4 text-right">
          <div><p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">תוכן שנשמר מהסרטון</p><h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">{group.videoTitle || 'סרטון ללא כותרת'}</h2><p className="text-sm text-slate-500 dark:text-zinc-400">{group.channel || 'ערוץ לא ידוע'}{group.originalVideoDate ? ` · פורסם ${dateText(group.originalVideoDate)}` : ''}</p></div>
          <p className="text-sm text-slate-600 dark:text-zinc-300">{group.items.length} רשומות שמורות · {viewer.renderedRecordIds.length} רשומות בעלות תוכן שניתן להצגה · שמירה אחרונה {dateText(group.latestSaveDate)}</p>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={onOpenVideo} aria-label={`פתח את סרטון המקור ${group.videoTitle}`} className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><ExternalLink className="h-4 w-4" />פתח סרטון</button><button type="button" onClick={onClearFocus} className="rounded-xl border border-indigo-200 px-4 py-2 text-sm font-bold text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-800 dark:text-indigo-300">חזרה לכל הסרטונים</button>{duplicateIds.length > 0 && <button type="button" onClick={() => onRequestDuplicateCleanup(duplicateIds)} className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-bold text-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-700 dark:text-amber-300">נקה כפילויות</button>}</div>
        </div>
      </header>

      <div className="border-y border-slate-200 p-5 dark:border-zinc-800">
        <WorkspaceCollectionTiles
          counts={collectionCounts}
          activeCollection={activeCollection}
          scopeLabel={`התוכן שנשמר מהסרטון: ${group.videoTitle || 'ללא כותרת'}`}
          onSelect={onCollectionSelect}
        />
      </div>

      {activeCollection === 'topics' ? (
        <div className="bg-slate-50/60 p-5 dark:bg-zinc-950/30">
          <ContentRoutingBridge
            routing={routing}
            readOnly
            onPreviewCollection={collection => onCollectionSelect(collection.collectionKey)}
            onOpenAnalysis={onOpenVideo}
          />
        </div>
      ) : (
        <WorkspaceSavedAnalysisContent group={visibleGroup} activeCollection={activeCollection} selectedIds={selectedIds} onToggleGroup={onToggleGroup} videoLookup={videoLookup} />
      )}
    </article>
  );
}
