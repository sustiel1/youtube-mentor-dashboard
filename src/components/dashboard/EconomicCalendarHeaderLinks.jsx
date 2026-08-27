import { useEffect, useId, useRef, useState } from 'react';

export const ECONOMIC_CALENDAR_URL = 'https://il.investing.com/economic-calendar';
export const ECONOMIC_CALENDAR_ARIA_LABEL = 'פתיחת הלוח הכלכלי באתר Investing.com ישראל';

export const ECONOMIC_CALENDAR_PRIMARY_LINKS = Object.freeze([
  {
    key: 'earnings',
    label: 'דוחות כספיים',
    url: 'https://il.investing.com/earnings-calendar',
    title: 'מועדי פרסום דוחות ותחזיות לחברות',
    ariaLabel: 'פתיחת יומן הדוחות הכספיים',
  },
  {
    key: 'interest-rates',
    label: 'החלטות ריבית',
    url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
    title: 'לוח ישיבות והחלטות הריבית של הפדרל ריזרב',
    ariaLabel: 'פתיחת לוח החלטות הריבית של הפדרל ריזרב',
  },
  {
    key: 'market-holidays',
    label: 'חופשות בבורסה',
    url: 'https://il.investing.com/holiday-calendar/',
    title: 'ימי חופשה ושינויים בפעילות הבורסות בעולם',
    ariaLabel: 'פתיחת לוח החופשות בבורסות',
  },
]);

export const ECONOMIC_CALENDAR_ADDITIONAL_LINKS = Object.freeze([
  {
    key: 'dividends',
    label: 'יומן דיבידנדים',
    url: 'https://il.investing.com/dividends-calendar/',
    description: 'תאריכי אקס, תשלום וסכומי דיבידנד',
    ariaLabel: 'פתיחת יומן הדיבידנדים',
  },
  {
    key: 'ipos',
    label: 'יומן הנפקות',
    url: 'https://il.investing.com/ipo-calendar/',
    description: 'הנפקות ראשוניות וחברות חדשות בבורסה',
    ariaLabel: 'פתיחת יומן ההנפקות',
  },
  {
    key: 'treasury-auctions',
    label: 'מכרזי אג״ח ארה״ב',
    url: 'https://www.treasurydirect.gov/auctions/upcoming/',
    description: 'מכרזים קרובים של משרד האוצר האמריקאי',
    ariaLabel: 'פתיחת לוח מכרזי אג״ח ארצות הברית',
  },
]);

const CALENDAR_LINK_CHIP_CLS =
  'inline-flex min-h-8 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-zinc-900';

function ExternalLinkIcon() {
  return <span aria-hidden="true" className="text-xs leading-none">↗</span>;
}

function CalendarExternalLink({ link, className = '', onOpen }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      title={link.title}
      aria-label={link.ariaLabel}
      onClick={(event) => {
        event.stopPropagation();
        onOpen?.();
      }}
      className={`${CALENDAR_LINK_CHIP_CLS} ${className}`.trim()}
      data-calendar-link={link.key}
    >
      <span>{link.label}</span>
      <ExternalLinkIcon />
    </a>
  );
}

export function EconomicCalendarTitleLink() {
  return (
    <a
      href={ECONOMIC_CALENDAR_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="פתיחה באתר חיצוני"
      aria-label={ECONOMIC_CALENDAR_ARIA_LABEL}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex cursor-pointer items-center gap-1 rounded-sm hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-zinc-900"
      data-economic-calendar-heading-link
    >
      <span>לוח כלכלי 📅</span>
      <ExternalLinkIcon />
    </a>
  );
}

export function EconomicCalendarActionLink() {
  return (
    <CalendarExternalLink
      link={{
        key: 'economic-calendar',
        label: 'לוח כלכלי',
        url: ECONOMIC_CALENDAR_URL,
        title: 'אירועי מאקרו, אינפלציה, תעסוקה והחלטות ריבית',
        ariaLabel: ECONOMIC_CALENDAR_ARIA_LABEL,
      }}
      className="border-indigo-200 text-indigo-700 hover:border-indigo-300 dark:border-indigo-800 dark:text-indigo-300"
    />
  );
}

function CalendarMenuItem({ link, onOpen, responsivePrimary = false }) {
  return (
    <li className={responsivePrimary ? 'xl:hidden' : undefined}>
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={link.ariaLabel}
        title={link.title || link.description}
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
        className="flex cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2 text-right transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:text-zinc-100 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
        data-calendar-menu-link={link.key}
      >
        <span className="inline-flex items-center gap-1 text-xs font-semibold">
          {link.label}
          <ExternalLinkIcon />
        </span>
        {link.description && (
          <span className="text-[11px] leading-snug text-slate-500 dark:text-zinc-400">
            {link.description}
          </span>
        )}
      </a>
    </li>
  );
}

export function EconomicCalendarHeaderLinks() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const reactId = useId();
  const menuId = `economic-calendar-more-${reactId.replace(/:/g, '')}`;

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <div className="flex min-w-0 items-center gap-2" dir="rtl" data-economic-calendar-header-links>
      <div className="hidden items-center gap-2 xl:flex" data-calendar-desktop-links>
        {ECONOMIC_CALENDAR_PRIMARY_LINKS.map((link) => (
          <CalendarExternalLink key={link.key} link={link} />
        ))}
      </div>

      <div ref={rootRef} className="relative shrink-0">
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label="פתיחת תפריט לוחות נוספים"
          title="לוחות שוק נוספים"
          onClick={(event) => {
            event.stopPropagation();
            setOpen((current) => !current);
          }}
          className={`${CALENDAR_LINK_CHIP_CLS} border-dashed bg-slate-50 text-slate-600 dark:bg-zinc-950 dark:text-zinc-300`}
          data-calendar-more-button
        >
          <span>לוחות נוספים</span>
          <span aria-hidden="true" className={`text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        </button>

        {open && (
          <div
            id={menuId}
            role="group"
            aria-label="לוחות נוספים"
            className="absolute left-0 top-full z-[70] mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-1.5 text-right shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            dir="rtl"
            data-calendar-more-menu
          >
            <ul className="space-y-0.5">
              {ECONOMIC_CALENDAR_PRIMARY_LINKS.map((link) => (
                <CalendarMenuItem key={link.key} link={link} onOpen={closeMenu} responsivePrimary />
              ))}
              {ECONOMIC_CALENDAR_ADDITIONAL_LINKS.map((link) => (
                <CalendarMenuItem key={link.key} link={link} onOpen={closeMenu} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
