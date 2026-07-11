import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Reusable tab row for Workspace Library.
 * Supports three sizes (lg / md / sm) and three accent colors (indigo / violet / teal).
 * Renders an inline "+ add" form when onAddTab is provided.
 *
 * Tab shape: { value: string, label: string, count?: number, empty?: boolean }
 */
export function WorkspaceTabRow({
  tabs,
  activeValue,
  onSelect,
  onAddTab = null,
  size = 'md',
  accentColor = 'indigo',
  addLabel = '+ הוסף',
  className = '',
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  const sizeClass = {
    lg: 'px-5 py-2.5 text-sm font-bold rounded-2xl',
    md: 'px-3.5 py-1.5 text-xs font-semibold rounded-xl',
    sm: 'px-2.5 py-1 text-xs font-semibold rounded-lg',
  }[size] ?? 'px-3.5 py-1.5 text-xs font-semibold rounded-xl';

  const activeClass = {
    indigo: 'border-indigo-600 bg-indigo-600 text-white shadow-sm dark:border-indigo-400 dark:bg-indigo-400 dark:text-zinc-900',
    violet: 'border-violet-500 bg-violet-500 text-white shadow-sm',
    teal:   'border-teal-600 bg-teal-600 text-white shadow-sm dark:border-teal-400 dark:bg-teal-400 dark:text-zinc-900',
  }[accentColor] ?? 'border-indigo-600 bg-indigo-600 text-white shadow-sm';

  const inactiveClass = 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800';
  const emptyClass    = 'border-slate-100 text-slate-400 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-600 dark:hover:bg-zinc-900';

  function handleSubmit() {
    const name = newName.trim();
    if (!name) return;
    onAddTab(name);
    setNewName('');
    setShowAdd(false);
  }

  return (
    <div className={cn('flex flex-wrap gap-2 items-center', className)} dir="rtl">
      {tabs.map(tab => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onSelect(tab.value)}
          className={cn(
            'border transition-all whitespace-nowrap',
            sizeClass,
            activeValue === tab.value
              ? activeClass
              : tab.empty
                ? emptyClass
                : inactiveClass,
          )}
        >
          {tab.label}
          {tab.count != null && tab.count > 0 && ` (${tab.count})`}
        </button>
      ))}

      {onAddTab && (
        showAdd ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSubmit();
                if (e.key === 'Escape') { setShowAdd(false); setNewName(''); }
              }}
              placeholder="שם הטאב..."
              dir="rtl"
              className="w-32 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:text-zinc-200"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!newName.trim()}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              הוסף
            </button>
            <button
              type="button"
              onClick={() => { setShowAdd(false); setNewName(''); }}
              className="rounded-lg border border-slate-200 dark:border-zinc-700 px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-xl border border-dashed border-slate-300 dark:border-zinc-600 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:text-zinc-500 dark:hover:text-indigo-400 transition-all whitespace-nowrap"
          >
            {addLabel}
          </button>
        )
      )}
    </div>
  );
}
