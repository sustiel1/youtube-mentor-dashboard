import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Edit2, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { WORKSPACE_COLLECTION_HEADINGS } from '@/config/workspaceHeadingRegistry';
import {
  getWorkspaceRecordRevealState,
  useWorkspaceRecordRevealIds,
  WORKSPACE_RECORD_REVEAL_CLASS,
} from '@/context/WorkspaceRecordRevealContext';
import { buildSectionMetadataLine } from '@/components/workspace/WorkspaceFocusedVideoCard';
import { provenanceFor } from '@/utils/workspaceSavedAnalysis';

const COLLECTIONS = [
  ...WORKSPACE_COLLECTION_HEADINGS.map(definition => ({
    id: definition.id,
    label: `${definition.emoji} ${definition.label}`,
  })),
  { id: 'unclassified', label: '📦 פריטים נוספים' },
];
const LABELS = Object.fromEntries(COLLECTIONS.map(collection => [collection.id, collection.label]));

function dateText(value) { try { return value ? new Date(value).toLocaleDateString('he-IL') : 'ללא תאריך'; } catch { return 'ללא תאריך'; } }

export function WorkspaceVideoGroupCard({ group, topics, selectedIds, onToggleItem, onToggleGroup, onOpenVideo, onOpenItem, onEditItem, onArchiveItem, onDeleteItem, focusItemId, onFocusVideo, isFocused = false, videoLookup }) {
  const [expanded, setExpanded] = useState(false);
  const revealIds = useWorkspaceRecordRevealIds();
  useEffect(() => {
    if (isFocused || (focusItemId && group.items.some(item => item.id === focusItemId))) setExpanded(true);
  }, [focusItemId, group.items, isFocused]);
  const allSelected = group.items.length > 0 && group.items.every(item => selectedIds.has(item.id));
  const mainTopic = topics.find(topic => topic.id === group.topicId);
  const subTopic = topics.find(topic => topic.id === group.subTopicId);
  const collectionCounts = group.collectionUniqueCounts;
  // Reuses the same shared metadata-line composition as the focused-video view
  // (buildSectionMetadataLine) instead of this card's own older, date-only,
  // no-time, no-videoLookup-fallback "פורסם" field — provenanceFor() already
  // knows how to resolve videoPublishedAt (own field or videoLookup fallback).
  const cardProvenance = group.items.map(item => provenanceFor(item, group.videoTitle, videoLookup));
  const metadataLine = buildSectionMetadataLine(cardProvenance, group.items.length);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900" data-video-key={group.videoKey}>
      <div className={`grid gap-4 p-4 md:items-center ${isFocused ? 'md:grid-cols-[1fr_auto]' : 'md:grid-cols-[220px_1fr_auto]'}`}>
        {!isFocused && <div className="aspect-video overflow-hidden rounded-xl bg-slate-100 dark:bg-zinc-800">{group.thumbnail ? <img src={group.thumbnail} alt="" className="h-full w-full object-cover" /> : null}</div>}
        <div className="min-w-0 space-y-2 text-right">
          <div className="flex items-start gap-2"><input aria-label={`בחר את כל השמירות של ${group.videoTitle}`} type="checkbox" checked={allSelected} onChange={() => onToggleGroup(group.items.map(item => item.id), !allSelected)} className="mt-1 h-4 w-4" /><div><h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">{group.videoTitle || 'סרטון ללא כותרת'}</h3><p className="text-sm text-slate-500">{group.channel || 'ערוץ לא ידוע'}</p></div></div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500"><span>{group.items.length} שמירות</span><span>· {group.uniqueContentCount} תכנים ייחודיים</span>{group.exactDuplicateGroups.length > 0 && <span>· {group.exactDuplicateGroups.reduce((sum, version) => sum + version.copyCount - 1, 0)} כפילויות זהות</span>}<span>· {metadataLine}</span></div>
          <div className="flex flex-wrap gap-1.5">{COLLECTIONS.filter(({ id }) => collectionCounts[id] > 0).map(({ id, label }) => <span key={id} className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">{label} {collectionCounts[id]}</span>)}</div>
          {(mainTopic || subTopic) && <p className="text-xs text-slate-500">{mainTopic?.name || ''}{subTopic ? ` / ${subTopic.name}` : ''}</p>}
        </div>
        <div className="flex gap-2 md:flex-col">{onFocusVideo && !isFocused && <button type="button" onClick={onFocusVideo} aria-label={`הצג תוכן מהסרטון ${group.videoTitle}`} className="inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300">הצג תוכן מהסרטון</button>}<button type="button" onClick={onOpenVideo} aria-label={`פתח את סרטון המקור ${group.videoTitle}`} className="inline-flex items-center justify-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><ExternalLink className="h-3.5 w-3.5" />פתח סרטון</button><button type="button" aria-label={`פתח אוסף של ${group.videoTitle}`} aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700">פתח אוסף {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button></div>
      </div>
      {expanded && <div className="space-y-4 border-t border-slate-200 bg-slate-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">{COLLECTIONS.map(({ id: collection }) => {
        const versions = group.versions.filter(version => version.collection === collection); if (!versions.length) return null;
        return <section key={collection}><h4 className="mb-2 font-bold">{LABELS[collection]}</h4><div className="space-y-2">{versions.map(version => {
          const reveal = getWorkspaceRecordRevealState(version.records.map(item => item.id), revealIds);
          return <div key={version.contentKey} {...reveal.attributes} className={`rounded-xl border border-slate-200 bg-white p-3 transition-colors dark:border-zinc-700 dark:bg-zinc-900 ${reveal.highlighted ? WORKSPACE_RECORD_REVEAL_CLASS : ''}`}><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => onOpenItem(version.canonical)} className="font-semibold text-indigo-700 hover:underline dark:text-indigo-300">{version.canonical.sourceHeading || version.canonical.videoTitle || version.canonical.title || 'פריט שמור'}</button><span className="text-xs text-slate-500">{dateText(version.canonical.savedAt)}</span>{version.copyCount > 1 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{version.copyCount} שמירות זהות</span>}</div><details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-slate-500">פרטים טכניים</summary><div className="mt-2 flex flex-wrap gap-2">{version.records.map(item => <div key={item.id} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] dark:border-zinc-700"><input aria-label={`בחר רשומה שמורה מתאריך ${dateText(item.savedAt)}`} type="checkbox" checked={selectedIds.has(item.id)} onChange={() => onToggleItem(item.id)} /><span className="font-mono">{item.id}</span><button onClick={() => onEditItem(item)} aria-label="ערוך"><Edit2 className="h-3 w-3" /></button><button onClick={() => onArchiveItem(item)} aria-label={item.archivedAt ? 'שחזר' : 'ארכיון'}>{item.archivedAt ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}</button><button onClick={() => onDeleteItem(item)} aria-label="מחק"><Trash2 className="h-3 w-3 text-red-500" /></button></div>)}</div></details></div>;
        })}</div></section>;
      })}</div>}
    </article>
  );
}
