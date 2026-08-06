import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Youtube } from 'lucide-react';
import { resolveMentorChannelResourceSet } from '@/lib/mentorChannelResources';

export function MentorChannelQuickNav({ mentor, variant = 'toolbar', label = 'מרכז הערוץ' }) {
  const resourceSet = resolveMentorChannelResourceSet(mentor);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const menuId = `mentor-channel-menu-${useId().replace(/:/g, '')}`;

  const closeAndRestoreFocus = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 8;
    const width = Math.min(368, window.innerWidth - (viewportPadding * 2));
    const panelHeight = panelRef.current?.offsetHeight || 390;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const openAbove = spaceBelow < Math.min(panelHeight, 320) && rect.top > spaceBelow;
    const preferredLeft = rect.right - width;
    const left = Math.min(
      Math.max(viewportPadding, preferredLeft),
      Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
    );
    const top = openAbove
      ? Math.max(viewportPadding, rect.top - panelHeight - gap)
      : Math.min(rect.bottom + gap, window.innerHeight - viewportPadding);
    const maxHeight = openAbove
      ? Math.max(160, rect.top - gap - (viewportPadding * 2))
      : Math.max(160, window.innerHeight - top - viewportPadding);
    setPosition({ left, top, width, maxHeight, placement: openAbove ? 'top' : 'bottom' });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!panelRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAndRestoreFocus();
      }
    };
    updatePosition();
    const focusFrame = requestAnimationFrame(() => {
      updatePosition();
      panelRef.current?.querySelector('[role="menuitem"]')?.focus();
    });
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  if (!resourceSet) return null;
  const topicTypes = ['playlist', 'course', 'topic-playlist', 'topic-course', 'topic'];
  const channelResources = resourceSet.resources.filter((resource) => !topicTypes.includes(resource.type));
  const topicResources = resourceSet.resources.filter((resource) => topicTypes.includes(resource.type));
  const mentorName = mentor?.name || resourceSet.channelIdentity.handle.replace(/^@/, '');
  const triggerClassName = variant === 'text-link'
    ? 'inline-flex w-fit items-center gap-1 rounded-sm text-sm font-semibold text-indigo-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-400'
    : 'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl border border-red-200/80 bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-500/30 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-red-500/10';

  return (
    <div className="relative shrink-0" dir="rtl" data-mentor-channel-quick-nav>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`פתח קישורים מהירים לערוץ ${mentorName}`}
        title={`פתח את מרכז הערוץ של ${mentorName}`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className={triggerClassName}
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
          aria-label={`קישורים מהירים לערוץ ${mentorName}`}
          data-placement={position?.placement || 'bottom'}
          style={position ? {
            left: `${position.left}px`,
            top: `${position.top}px`,
            width: `${position.width}px`,
            maxHeight: `${position.maxHeight}px`,
          } : { visibility: 'hidden' }}
          className="fixed z-50 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-2 text-right shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        >
          <h2 className="px-2.5 pb-2 pt-1 text-sm font-bold text-slate-900 dark:text-zinc-50">
            מרכז הערוץ של {mentorName}
          </h2>
          {[{ title: 'קישורי הערוץ', resources: channelResources }, { title: 'נושאי לימוד וקורסים', resources: topicResources }].filter((group) => group.resources.length).map((group) => <div key={group.title}>
          <h3 className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:text-zinc-400">{group.title}</h3>
          {group.resources.map((resource) => (
            <a
              key={resource.key}
              role="menuitem"
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`פתח ${resource.labelHe} בערוץ ${mentorName} בחלון חדש`}
              title={resource.descriptionHe}
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
              className="flex items-start gap-2 rounded-lg px-2.5 py-2 no-underline hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-zinc-800"
              data-mentor-channel-resource={resource.key}
            >
              <span className="mt-0.5 shrink-0" aria-hidden>{resource.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-zinc-50">
                  {resource.labelHe}<span aria-hidden className="text-[10px] opacity-60">↗</span>
                </span>
                <span className="block text-xs leading-snug text-slate-600 dark:text-zinc-300">{resource.descriptionHe}</span>
              </span>
            </a>
          ))}</div>)}
          {resourceSet.channelIdentity.canonicalUrl ? <a
            href={resourceSet.channelIdentity.canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`פתח את ערוץ YouTube של ${mentorName} בחלון חדש`}
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
            }}
            className="mt-1 flex items-center justify-center gap-1 rounded-lg border-t border-slate-200 px-2.5 py-2 text-xs font-semibold text-red-600 no-underline hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-500/10"
            data-mentor-channel-home-action
          >
            <Youtube className="h-3.5 w-3.5" aria-hidden />
            <span>פתח ערוץ YouTube</span>
            <span aria-hidden>↗</span>
          </a> : null}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
