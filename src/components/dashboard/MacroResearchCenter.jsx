import { useEffect, useRef, useState } from 'react';
import { getMacroResearchResources } from '@/lib/specializedSectionResources';

const DISCLAIMER = 'הקישורים מיועדים לבדיקת נתוני שוק ומאקרו ואינם המלצת השקעה.';

export function MacroResearchCenter() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const resources = getMacroResearchResources();

  const closeAndRestoreFocus = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!panelRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAndRestoreFocus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" dir="rtl" data-macro-research-center>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="macro-research-menu"
        aria-label="פתח את מרכז מקורות המאקרו בחלון אפשרויות"
        title="פתח מקורות מאקרו לבדיקת מצב השוק"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        <span>מרכז מאקרו</span>
        <span aria-hidden>↗</span>
      </button>

      {open ? (
        <div
          ref={panelRef}
          id="macro-research-menu"
          role="menu"
          aria-label="מקורות מחקר מאקרו"
          className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white p-2 text-right shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="space-y-1">
            {resources.map((resource) => (
              <a
                key={resource.key}
                role="menuitem"
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`פתח ${resource.labelHe} אצל ${resource.provider} בחלון חדש`}
                title={`${resource.provider} — ${resource.descriptionHe}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                }}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === ' ') {
                    event.preventDefault();
                    event.currentTarget.click();
                  }
                }}
                className="flex items-start gap-2 rounded-lg px-2.5 py-2 no-underline hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-zinc-800"
                data-macro-resource={resource.key}
              >
                <span className="mt-0.5 shrink-0" aria-hidden>{resource.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-zinc-50">
                    {resource.labelHe}<span aria-hidden className="text-[10px] opacity-60">↗</span>
                  </span>
                  <span className="block text-xs leading-snug text-slate-600 dark:text-zinc-300">{resource.descriptionHe}</span>
                  <span className="block text-[11px] text-slate-400 dark:text-zinc-500">{resource.provider}</span>
                </span>
              </a>
            ))}
          </div>
          <p className="mt-2 border-t border-slate-200 px-2 pt-2 text-[11px] leading-snug text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
            {DISCLAIMER}
          </p>
        </div>
      ) : null}
    </div>
  );
}
