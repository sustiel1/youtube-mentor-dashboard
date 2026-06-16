import { useEffect, useState } from 'react';
import {
  cloneEditableRows,
  emptyRowForColumns,
  getManualSectionSource,
} from '@/lib/manualBriefOverrides';

export function ManualSourceBadge({ marketBriefData, sectionId }) {
  const source = getManualSectionSource(marketBriefData, sectionId);
  const isManual = source === 'manual';
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${
        isManual
          ? 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40'
          : 'text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800/60'
      }`}
      data-manual-source={source}
    >
      {isManual ? '✏️ Manual' : '🤖 AI'}
    </span>
  );
}

export function ManualSectionHeaderActions({
  editing,
  onEdit,
  onCancel,
  onSave,
  saving = false,
}) {
  if (editing) {
    return (
      <div className="flex items-center gap-1 shrink-0" dir="rtl">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-0.5 rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          title="שמור"
        >
          💾 שמור
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center rounded-lg border border-slate-200 dark:border-zinc-700 px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
        >
          ביטול
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      className="inline-flex items-center rounded-lg border border-slate-200 dark:border-zinc-700 px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 shrink-0"
      title="עריכה ידנית"
    >
      ✏️ ערוך
    </button>
  );
}

export function ManualEditGrid({ columns, rows, onChange, rowKeyPrefix = 'row' }) {
  const safeRows = Array.isArray(rows) ? rows : [];

  const updateCell = (rowIndex, key, value) => {
    const next = safeRows.map((row, i) => (i === rowIndex ? { ...row, [key]: value } : row));
    onChange(next);
  };

  const addRow = () => {
    onChange([...safeRows, emptyRowForColumns(columns)]);
  };

  const deleteRow = (rowIndex) => {
    onChange(safeRows.filter((_, i) => i !== rowIndex));
  };

  return (
    <div className="space-y-2" dir="rtl" data-manual-edit-grid>
      <div className="overflow-x-auto rounded-lg border border-slate-200/80 dark:border-zinc-700/70">
        <table className="w-full border-collapse text-xs min-w-[280px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-zinc-700 bg-slate-50/80 dark:bg-zinc-800/40">
              {columns.map((col) => (
                <th key={col.key} className="px-2 py-1.5 text-right font-semibold text-slate-600 dark:text-zinc-300">
                  {col.label}
                </th>
              ))}
              <th className="px-2 py-1.5 w-10" aria-label="מחק" />
            </tr>
          </thead>
          <tbody>
            {safeRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-2 py-4 text-center text-slate-400 dark:text-zinc-500">
                  אין שורות — לחץ הוסף שורה
                </td>
              </tr>
            ) : (
              safeRows.map((row, rowIndex) => (
                <tr key={`${rowKeyPrefix}-${rowIndex}`} className="border-b border-slate-100 dark:border-zinc-800/80">
                  {columns.map((col) => (
                    <td key={col.key} className="px-1.5 py-1">
                      <input
                        type="text"
                        value={row[col.key] ?? ''}
                        onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
                        className="w-full rounded border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        dir="rtl"
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => deleteRow(rowIndex)}
                      className="text-red-500 hover:text-red-700 text-sm leading-none px-1"
                      title="מחק שורה"
                      aria-label="מחק שורה"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center rounded-lg border border-dashed border-slate-300 dark:border-zinc-600 px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800/50"
      >
        + הוסף שורה
      </button>
    </div>
  );
}

/** Dual-grid editor for opportunities + risks. */
export function ManualOpportunitiesRisksEdit({ draft, onChange, opportunityColumns, riskColumns }) {
  return (
    <div className="space-y-4" dir="rtl">
      <div>
        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-1.5">🎯 הזדמנויות</p>
        <ManualEditGrid
          columns={opportunityColumns}
          rows={draft.opportunities ?? []}
          onChange={(opportunities) => onChange({ ...draft, opportunities })}
          rowKeyPrefix="opp"
        />
      </div>
      <div>
        <p className="text-xs font-bold text-red-700 dark:text-red-300 mb-1.5">⚠️ סיכונים</p>
        <ManualEditGrid
          columns={riskColumns}
          rows={draft.risks ?? []}
          onChange={(risks) => onChange({ ...draft, risks })}
          rowKeyPrefix="risk"
        />
      </div>
    </div>
  );
}

/**
 * Wraps SectionCard manual edit state — edit grid or children.
 */
export function useBriefSectionManualEdit({
  sectionId,
  marketBriefData,
  getDraftRows,
  onSaveSection,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => cloneEditableRows(getDraftRows()));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(cloneEditableRows(getDraftRows()));
  }, [marketBriefData, editing]);

  const startEdit = () => {
    setDraft(cloneEditableRows(getDraftRows()));
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(cloneEditableRows(getDraftRows()));
    setEditing(false);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await onSaveSection(sectionId, draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return {
    editing,
    draft,
    setDraft,
    saving,
    startEdit,
    cancelEdit,
    saveEdit,
  };
}

export function BriefSectionManualHeaderExtras({
  sectionId,
  marketBriefData,
  editing,
  saving,
  onEdit,
  onCancel,
  onSave,
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0 mr-auto" dir="rtl">
      <ManualSourceBadge marketBriefData={marketBriefData} sectionId={sectionId} />
      <ManualSectionHeaderActions
        editing={editing}
        onEdit={onEdit}
        onCancel={onCancel}
        onSave={onSave}
        saving={saving}
      />
    </div>
  );
}
