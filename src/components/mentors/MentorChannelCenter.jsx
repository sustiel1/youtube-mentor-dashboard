import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Youtube } from 'lucide-react';
import { resolveMentorChannelCenter } from '@/lib/mentorRegistry';

export function MentorChannelCenter({
  mentor,
  variant = 'toolbar',
  label = 'מרכז הערוץ',
  showEmpty = true,
}) {
  const channelCenter = resolveMentorChannelCenter(mentor);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const menuId = `mentor-channel-center-${useId().replace(/:/g, '')}`;

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 8;
    const width = Math.min(352, window.innerWidth - viewportPadding * 2);
    const panelHeight = panelRef.current?.offsetHeight || 280;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const openAbove = spaceBelow < Math.min(panelHeight, 240) && rect.top > spaceBelow;
    const left = Math.min(
      Math.max(viewportPadding, rect.right - width),
      Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
    );
    const top = openAbove
      ? Math.max(viewportPadding, rect.top - panelHeight - gap)
      : Math.min(rect.bottom + gap, window.innerHeight - viewportPadding);
    setPosition({
      left,
      top,
      width,
      maxHeight: openAbove
        ? Math.max(144, rect.top - gap - viewportPadding * 2)
        : Math.max(144, window.innerHeight - top - viewportPadding),
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsidePointer = (event) => {
      if (!panelRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    updatePosition();
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  if (!channelCenter || channelCenter.links.length === 0) {
    return showEmpty && mentor ? (
      <span className="text-xs text-slate-400 dark:text-zinc-500" data-mentor-channel-center-empty>
        אין קישורי ערוץ זמינים
      </span>
    ) : null;
  }

  const mentorName = channelCenter.mentorName || 'המנטור';
  const triggerClass = variant === 'text-link'
    ? 'inline-flex w-fit items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-400'
    : 'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-red-200/80 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-500/30 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-red-500/10';

  return (
    <div className="relative shrink-0" dir="rtl" data-mentor-channel-center>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className={triggerClass}
      >
        {variant === 'toolbar' ? <Youtube className="h-4 w-4 text-red-600" aria-hidden /> : null}
        <span>{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open ? createPortal(
        <div
          ref={panelRef}
          id={menuId}
          role="menu"
          aria-label={`מרכז הערוץ של ${mentorName}`}
          dir="rtl"
          style={position ? {
            left: `${position.left}px`,
            top: `${position.top}px`,
            width: `${position.width}px`,
            maxHeight: `${position.maxHeight}px`,
          } : { visibility: 'hidden' }}
          className="fixed z-[100] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-2 text-right shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          data-mentor-channel-center-menu
        >
          <h2 className="px-2.5 pb-2 pt-1 text-sm font-bold text-slate-900 dark:text-zinc-50">
            מרכז הערוץ של {mentorName}
          </h2>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {channelCenter.links.map((link) => (
              <a
                key={link.key}
                role="menuitem"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                }}
                className="flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-800 no-underline hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-zinc-100 dark:hover:bg-zinc-800"
                data-mentor-channel-link={link.key}
              >
                <span aria-hidden>{link.icon}</span>
                <span className="min-w-0 truncate">{link.labelHe}</span>
                <span aria-hidden className="mr-auto text-[10px] opacity-60">↗</span>
              </a>
            ))}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
