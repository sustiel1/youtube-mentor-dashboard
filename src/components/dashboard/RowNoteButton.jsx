// Standalone row-note button + modal, for row renderers that don't go through
// LearningTabContent/ItemRowActions (e.g. MacroGemDashboard's hand-built
// tables/cards). Same behaviour and styling as ItemRowActions' inline version,
// just decoupled from bulkSelection — callers supply their own idPrefix string.
import { useState } from 'react';
import { StickyNote } from 'lucide-react';
import { isRowNotesEnabledForPrefix, buildRowNoteId } from '@/lib/rowNotes';
import { useRowNotes } from '@/hooks/useNotes';
import { RowNoteModal } from './RowNoteModal';

export function RowNoteButton({ videoId, idPrefix, text }) {
  const enabled = isRowNotesEnabledForPrefix(idPrefix) && !!videoId;
  const rowNoteId = enabled ? buildRowNoteId(idPrefix, text) : null;
  const [open, setOpen] = useState(false);
  const { data: rowNotes = [] } = useRowNotes(enabled ? videoId : null, rowNoteId);
  const hasRowNote = rowNotes.length > 0;

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={hasRowNote ? 'יש הערה לשורה זו — לחץ לצפייה/עריכה' : 'הוסף הערה לשורה'}
        className={
          hasRowNote
            ? 'p-1 rounded text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-sm leading-none transition-colors opacity-100'
            : 'p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-700 transition-colors opacity-100 max-md:opacity-90 md:opacity-0 md:group-hover:opacity-100'
        }
      >
        <StickyNote className="h-3 w-3" fill={hasRowNote ? 'currentColor' : 'none'} />
      </button>
      <RowNoteModal
        open={open}
        onOpenChange={setOpen}
        videoId={videoId}
        rowId={rowNoteId}
        rowLabel={text}
      />
    </>
  );
}
