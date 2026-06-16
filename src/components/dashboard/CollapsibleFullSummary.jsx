import { useState } from 'react';
import { cn } from '@/lib/utils';

const COLLAPSE_CHAR_THRESHOLD = 220;
const PREVIEW_LINE_CLAMP = 3;

function readExpanded(storageKey) {
  if (!storageKey) return false;
  try {
    return sessionStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}

function writeExpanded(storageKey, expanded) {
  if (!storageKey) return;
  try {
    sessionStorage.setItem(storageKey, expanded ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/**
 * Progressive disclosure for long full-summary text (presentation only).
 */
export function CollapsibleFullSummary({
  text,
  storageKey = null,
  className = '',
}) {
  const body = String(text || '').trim();
  if (!body) return null;

  const lineCount = body.split('\n').filter((l) => l.trim()).length;
  const collapsible = body.length > COLLAPSE_CHAR_THRESHOLD || lineCount > PREVIEW_LINE_CLAMP;

  const [expanded, setExpanded] = useState(() => readExpanded(storageKey));

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    writeExpanded(storageKey, next);
  };

  if (!collapsible) {
    return (
      <p
        className={cn(
          'text-sm text-slate-800 dark:text-zinc-200 leading-7 text-right whitespace-pre-wrap',
          className,
        )}
      >
        {body}
      </p>
    );
  }

  return (
    <div className={className}>
      <p
        className={cn(
          'text-sm text-slate-800 dark:text-zinc-200 leading-7 text-right whitespace-pre-wrap',
          !expanded && 'line-clamp-3',
        )}
      >
        {body}
      </p>
      <button
        type="button"
        onClick={toggle}
        className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
      >
        {expanded ? 'כווץ סיכום מלא' : 'הרחב סיכום מלא'}
      </button>
    </div>
  );
}
