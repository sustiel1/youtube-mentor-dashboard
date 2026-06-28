import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';

export function extractQueryFromPxUrl(pxUrl) {
  if (!pxUrl) return null;
  try { return new URL(pxUrl).searchParams.get('q') || null; }
  catch { return null; }
}

export function openGoogleFinance(query) {
  if (query) {
    navigator.clipboard?.writeText(query).catch(() => {});
    toast.success('שאילתת המחקר הועתקה. הדבק אותה ב-Google Finance.', { duration: 4000 });
  }
  window.open('https://www.google.com/finance/', '_blank', 'noopener,noreferrer');
}

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return { open, setOpen, ref };
}

const MENU_CLS =
  'absolute right-0 top-full mt-1 z-50 min-w-[150px] rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1';
const ITEM_LINK_CLS =
  'flex w-full items-center gap-2 px-3 py-2 text-[12px] font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap';

function DropdownMenu({ pxUrl, query, onSelect }) {
  return (
    <div className={MENU_CLS} dir="rtl">
      {pxUrl && (
        <a
          href={pxUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className={ITEM_LINK_CLS}
        >
          🔍 פרפלקסיטי
        </a>
      )}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); openGoogleFinance(query); onSelect(); }}
        className={`${ITEM_LINK_CLS} text-right`}
      >
        📊 Google Finance
      </button>
    </div>
  );
}

/**
 * Full pill split-button: clicking the label opens Perplexity directly;
 * clicking ▾ opens a dropdown with Perplexity + Google Finance.
 */
export function ResearchDropdown({ pxUrl, label = 'מחקר AI' }) {
  const { open, setOpen, ref } = useDropdown();
  const query = extractQueryFromPxUrl(pxUrl);
  if (!pxUrl) return null;

  return (
    <div ref={ref} className="relative inline-flex" dir="ltr">
      <div className="inline-flex rounded-lg overflow-hidden">
        <a
          href={pxUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-[11px] font-semibold text-white transition-colors whitespace-nowrap"
        >
          🔍 {label}
        </a>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
          className="px-1.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] transition-colors border-r border-emerald-500/30"
          title="בחר ספק מחקר"
          aria-haspopup="true"
          aria-expanded={open}
        >
          ▾
        </button>
      </div>
      {open && <DropdownMenu pxUrl={pxUrl} query={query} onSelect={() => setOpen(false)} />}
    </div>
  );
}

/**
 * Compact icon-only variant — replaces PxBtn in dense table rows.
 * Shows 🔍 icon; clicking opens dropdown with Perplexity + Google Finance.
 */
export function ResearchDropdownCompact({ pxUrl }) {
  const { open, setOpen, ref } = useDropdown();
  const query = extractQueryFromPxUrl(pxUrl);
  if (!pxUrl) return null;

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        className="p-1 rounded text-violet-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30 text-sm leading-none transition-colors"
        title="מחקר AI"
      >
        🔍
      </button>
      {open && <DropdownMenu pxUrl={pxUrl} query={query} onSelect={() => setOpen(false)} />}
    </div>
  );
}

/**
 * Link-style variant — replaces "בדוק אחזקות" text links.
 * Styled as a small violet text button; clicking opens dropdown.
 */
export function ResearchDropdownLink({ pxUrl, label = 'בדוק אחזקות', titleHe }) {
  const { open, setOpen, ref } = useDropdown();
  const query = extractQueryFromPxUrl(pxUrl);
  if (!pxUrl) return null;

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        title={titleHe}
        className="text-[10px] font-medium text-violet-500 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 whitespace-nowrap transition-colors"
      >
        🔎 {label} ▾
      </button>
      {open && <DropdownMenu pxUrl={pxUrl} query={query} onSelect={() => setOpen(false)} />}
    </div>
  );
}
