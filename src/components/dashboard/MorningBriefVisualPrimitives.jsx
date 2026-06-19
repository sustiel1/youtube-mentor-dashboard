import {
  directionChip,
  DIRECTION,
  getDirectionBadge,
  getDirectionClassName,
  getMacroFieldDisplay,
  importanceTextStyles,
  formatMarketChange,
  isDuplicateDirectionLabel,
  parseChangeDisplay,
  resolveTone,
  stockCategoryBadge,
  toneStyles,
  TONE,
} from '@/lib/morningBriefVisuals';
import { translateDisplayLabel } from '@/lib/specializedDisplayI18n';

/** Shared neutral surface for all Morning Brief dashboard sections. */
export const COMPARISON_SURFACE_BG = 'bg-white dark:bg-zinc-900';
export const COMPARISON_SECTION_BORDER = 'border-slate-200/80 dark:border-zinc-700/70';
export const COMPARISON_TABLE_HEAD_BG = 'bg-white dark:bg-zinc-900';
export const COMPARISON_ROW_HOVER = 'hover:bg-slate-50/50 dark:hover:bg-zinc-800/25';

/** Top-level section title typography — single source for Morning Brief hierarchy. */
export const SECTION_HEADER_TITLE_CLS =
  'text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight leading-snug shrink-0';

export const SECTION_HEADER_ROW_CLS =
  'flex flex-wrap items-center justify-start gap-x-2.5 gap-y-1.5 pt-1 pb-3 mb-3 px-0.5 text-right border-b border-slate-200/80 dark:border-zinc-700/70';

export const SECTION_HEADER_COUNT_CLS = 'text-base font-bold tabular-nums';

/**
 * Dashboard typography scale — Macro section is the reference for all dedicated content.
 * Primary: 15px bold | Body: 15px semibold | Status: 16px bold | Headers: 16px bold
 */
export const DASHBOARD_TABLE_HEAD_CLS =
  'text-base font-bold text-slate-600 dark:text-zinc-300 leading-tight';

export const DASHBOARD_COLUMN_HEADER_CLS = DASHBOARD_TABLE_HEAD_CLS;

export const DASHBOARD_TABLE_CELL_PRIMARY_CLS =
  'text-[15px] font-bold text-slate-900 dark:text-zinc-50 leading-snug';

export const DASHBOARD_TABLE_CELL_BODY_CLS =
  'text-[15px] font-semibold text-slate-700 dark:text-zinc-200 leading-snug';

export const DASHBOARD_TABLE_CELL_DATE_CLS =
  'text-[15px] font-semibold text-slate-600 dark:text-zinc-300 tabular-nums leading-snug';

/** Status / change / direction values (↑ 0.6%, ↓ נחלש) */
export const DASHBOARD_TABLE_STATUS_CLS =
  'text-base font-bold leading-snug tabular-nums';

export const DASHBOARD_TABLE_CELL_MUTED_CLS =
  'text-sm font-medium text-slate-500 dark:text-zinc-400 leading-snug';

export const DASHBOARD_EMPTY_CLS =
  'text-[15px] font-medium text-slate-400 dark:text-zinc-500 leading-snug';

export const DASHBOARD_PILL_CLS = 'text-base font-semibold tabular-nums';

export const DASHBOARD_ITEM_ROW_CLS = 'py-2.5';

export function EmptyState({ message = 'אין נתונים זמינים לסעיף זה' }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-6 px-3 rounded-lg border border-dashed border-slate-200 dark:border-zinc-700 bg-transparent text-center"
      dir="rtl"
    >
      <span className="text-lg opacity-30 mb-1">—</span>
      <p className={DASHBOARD_EMPTY_CLS}>{message}</p>
    </div>
  );
}

export function SectionCard({
  title,
  count,
  tone = TONE.NEUTRAL,
  children,
  isEmpty = false,
  emptyMessage,
  headerPills,
  headerActions,
  plainSurface = false,
  cardBulk = null,
}) {
  const styles = toneStyles(tone);
  const borderCls = COMPARISON_SECTION_BORDER;
  const surfaceCls = COMPARISON_SURFACE_BG;
  // NOTE: card-level bulk-select header (checkbox + quick-save actions) is temporarily
  // unavailable — it depended on the untracked Universal Tab Bulk Selection cluster
  // (SelectableSummaryCardHeader.jsx + its deps). `cardBulk` is accepted but currently
  // ignored; the plain header below is used for all callers. No tracked caller relies on
  // the selectable path today. Restore by re-wiring `cardBulk` once that cluster lands.

  return (
    <div
      className={`rounded-xl border-2 ${borderCls} ${surfaceCls} px-3 py-3 transition-colors`}
      dir="rtl"
    >
      <div
        className="pt-1 pb-3 mb-3 px-0.5 text-right border-b border-slate-200/80 dark:border-zinc-700/70 flex flex-col gap-y-1"
        dir="rtl"
        data-section-header
      >
        <div className="flex items-center justify-between">
          <h2 className={SECTION_HEADER_TITLE_CLS}>{title}</h2>
          <div className="flex items-center gap-x-2 shrink-0">
            {count != null && count > 0 && (
              <span className={`${SECTION_HEADER_COUNT_CLS} shrink-0 ${styles.text}`}>
                {count}
              </span>
            )}
            {headerActions}
          </div>
        </div>
        {headerPills && (
          <div className="flex items-center">
            {headerPills}
          </div>
        )}
      </div>
      {isEmpty ? <EmptyState message={emptyMessage} /> : children}
    </div>
  );
}

export function ImportanceBadge({ level, className = '', size = 'xs' }) {
  const meta = importanceTextStyles(level);
  if (!meta) return null;
  const sizeCls = size === 'table' || size === 'sm'
    ? 'text-[15px] font-bold'
    : 'text-sm font-semibold';
  return (
    <span
      className={`inline tracking-wide uppercase whitespace-nowrap ${sizeCls} ${meta.textCls} ${className}`}
    >
      {meta.label}
    </span>
  );
}

export function DirectionChip({ text, displayText, light = false }) {
  const chip = directionChip(text);
  if (!chip) return null;
  const shown = displayText != null && String(displayText).trim()
    ? String(displayText).trim()
    : chip.label;
  return (
    <span
      className={`inline-flex items-center gap-0.5 leading-snug ${DASHBOARD_TABLE_CELL_BODY_CLS} ${chip.textCls}`}
    >
      <span>{shown}</span>
    </span>
  );
}

/** Lightweight tone-colored text — no fill, border, or pill container. */
export function DirectionText({ text, fields, displayText, className = '', size = 'table' }) {
  const badge = getDirectionBadge(text != null ? text : fields);
  const shown = displayText != null && String(displayText).trim()
    ? String(displayText).trim()
    : badge.label;
  if (!shown) return null;
  const styles = toneStyles(badge.tone);
  const sizeCls = size === 'body' ? DASHBOARD_TABLE_CELL_BODY_CLS : DASHBOARD_TABLE_STATUS_CLS;
  return (
    <span className={`inline text-right ${sizeCls} ${styles.text} ${className}`} dir="rtl">
      {shown}
    </span>
  );
}

/** Single renderer for market % and macro direction (↑ 0.6% / ↑ התחממות / • במעקב). */
export function NumericChangeSpan({ display, className = DASHBOARD_TABLE_STATUS_CLS }) {
  if (!display) return null;
  if (display.kind === 'percent' || display.kind === 'neutral') {
    return (
      <span className={`${DASHBOARD_TABLE_STATUS_CLS} ${display.cls} ${className}`.trim()}>
        {display.arrow ? `${display.arrow} ` : ''}{display.text}
      </span>
    );
  }
  if (display.kind === 'direction') {
    return (
      <span className={`${DASHBOARD_TABLE_STATUS_CLS} ${display.cls} ${className}`.trim()}>
        {display.arrow} {display.text}
      </span>
    );
  }
  const styles = toneStyles(display.tone);
  return (
    <span className={`${DASHBOARD_TABLE_CELL_BODY_CLS} ${styles.text} ${className}`.trim()}>
      {display.text}
    </span>
  );
}

export function ChangeValue({ value, contextText = '', className = DASHBOARD_TABLE_STATUS_CLS }) {
  const parsed = formatMarketChange(value, contextText) || parseChangeDisplay(value, contextText);
  if (!parsed) return null;
  return <NumericChangeSpan display={parsed} className={className} />;
}

const STOCK_CATEGORY_TEXT_ONLY_CLS = {
  opportunity: 'text-emerald-700 dark:text-emerald-300',
  watchlist: 'text-sky-700 dark:text-sky-300',
  risk: 'text-red-700 dark:text-red-300',
  general: 'text-slate-600 dark:text-zinc-400',
};

export function StockCategoryBadge({ category }) {
  const meta = stockCategoryBadge(category);
  const textCls = STOCK_CATEGORY_TEXT_ONLY_CLS[category] || STOCK_CATEGORY_TEXT_ONLY_CLS.general;
  return (
    <span className={`inline-flex items-center gap-0.5 ${DASHBOARD_TABLE_CELL_BODY_CLS} ${textCls}`}>
      <span>{meta.emoji}</span>
      <span>{meta.label}</span>
    </span>
  );
}

/** Text-only direction status: ↑ עולה / ↓ יורדת / 🚀 פריצה */
export function DirectionBadge({ fields, text, className = '' }) {
  const badge = getDirectionBadge(text != null ? text : fields);
  if (!badge.label && badge.direction === 'neutral') return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${DASHBOARD_TABLE_STATUS_CLS} ${badge.text} ${className}`}
      dir="rtl"
    >
      {badge.label && <span>{badge.label}</span>}
      {(badge.arrow || badge.icon) && badge.arrow !== '●' && (
        <span className="text-[11px] leading-none">{badge.arrow || badge.icon}</span>
      )}
    </span>
  );
}

/** Ticker row: NVDA  ↑ עולה */
export function TickerDirectionHeader({ ticker, company, fields, text }) {
  const badge = getDirectionBadge(text != null ? text : fields);
  const styles = getDirectionClassName(badge.direction);
  return (
    <div className="shrink-0 text-right" dir="rtl">
      <div className="flex items-center gap-1.5 justify-start">
        <p className={`${DASHBOARD_TABLE_CELL_PRIMARY_CLS} ${styles.text}`}>{ticker}</p>
        {(badge.label || badge.direction !== DIRECTION.NEUTRAL) && (
          <span className={`inline-flex items-center gap-0.5 ${DASHBOARD_TABLE_STATUS_CLS} ${styles.text}`}>
            {badge.label && <span>{badge.label}</span>}
            {badge.arrow && badge.arrow !== '●' && <span>{badge.arrow}</span>}
          </span>
        )}
      </div>
      {company && (
        <p className={DASHBOARD_TABLE_CELL_MUTED_CLS}>{company}</p>
      )}
    </div>
  );
}

/** Card shell with direction-based border + background. */
export function DirectionCard({ fields, text, children, className = '', plain = false, ...rest }) {
  const badge = getDirectionBadge(text != null ? text : fields);
  const styles = getDirectionClassName(badge.direction);
  const bgCls = plain ? COMPARISON_SURFACE_BG : styles.bg;
  return (
    <div
      {...rest}
      dir="rtl"
      className={`rounded-lg border-2 ${styles.border} ${bgCls} px-3 py-2.5 text-right group ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Market Regime row: label (right) + value (left) on one line, RTL.
 * Presentation only — no data / extraction changes.
 */
export function RegimeRow({ label, value, isLast = false, columnVariant }) {
  const displayValue = String(value || '').trim();
  if (!displayValue && !label) return null;

  const rowCtx = { indicator: label, description: displayValue };
  const display = displayValue ? getMacroFieldDisplay(displayValue, rowCtx) : null;

  return (
    <div dir="rtl" className={`${DASHBOARD_ITEM_ROW_CLS} text-right`} data-regime-item>
      <div className="flex items-start gap-x-3 min-w-0">
        <span className={`shrink-0 w-[38%] max-w-[10.5rem] ${DASHBOARD_TABLE_CELL_PRIMARY_CLS}`}>
          {label}
        </span>
        <span className="flex-1 min-w-0 text-right break-words [overflow-wrap:anywhere]">
          {display ? (
            <NumericChangeSpan display={display} />
          ) : (
            <span className={DASHBOARD_TABLE_CELL_BODY_CLS}>{displayValue || '—'}</span>
          )}
        </span>
      </div>
      {!isLast && (
        <div className="mt-2.5 border-b border-slate-200/70 dark:border-zinc-700/50" aria-hidden />
      )}
    </div>
  );
}

export function RegimeCard({ label, value, isLast = false, columnVariant }) {
  return (
    <RegimeRow
      label={translateDisplayLabel(label)}
      value={value}
      isLast={isLast}
      columnVariant={columnVariant}
    />
  );
}

// ── Sector metadata: Hebrew labels + representative ETF tickers ────────────
const SECTOR_METADATA = {
  'Materials':                              { he: 'חומרי גלם',                          etf: 'XLB'  },
  'Basic Materials':                        { he: 'חומרי גלם',                          etf: 'XLB'  },
  'Consumer Staples':                       { he: 'צריכה בסיסית',                        etf: 'XLP'  },
  'Consumer Defensive':                     { he: 'צריכה בסיסית',                        etf: 'XLP'  },
  'Technology':                             { he: 'טכנולוגיה',                           etf: 'XLK'  },
  'Technology / Mega Caps':                 { he: 'טכנולוגיה / מניות ענק',               etf: 'QQQ'  },
  'Software':                               { he: 'תוכנה',                               etf: 'IGV'  },
  'Semiconductors':                         { he: 'מוליכים למחצה',                       etf: 'SMH'  },
  'Semiconductors (SMH)':                   { he: 'מוליכים למחצה',                       etf: 'SMH'  },
  'Retail':                                 { he: 'קמעונאות',                            etf: 'XRT'  },
  'Airlines':                               { he: 'חברות תעופה',                         etf: 'JETS' },
  'Airlines (JETS)':                        { he: 'חברות תעופה',                         etf: 'JETS' },
  'Energy':                                 { he: 'אנרגיה',                              etf: 'XLE'  },
  'Solar':                                  { he: 'אנרגיה סולארית',                      etf: 'TAN'  },
  'Financials':                             { he: 'פיננסים',                             etf: 'XLF'  },
  'Regional Banks':                         { he: 'בנקים אזוריים',                       etf: 'KRE'  },
  'Homebuilders':                           { he: 'קבלני בתים',                          etf: 'XHB'  },
  'REITs':                                  { he: 'ריטים',                               etf: 'VNQ'  },
  'Healthcare':                             { he: 'בריאות',                              etf: 'XLV'  },
  'Industrials':                            { he: 'תעשייה',                              etf: 'XLI'  },
  'Utilities':                              { he: 'תשתיות',                              etf: 'XLU'  },
  'Real Estate':                            { he: 'נדל"ן',                               etf: 'XLRE' },
  'Communication Services':                 { he: 'תקשורת',                              etf: 'XLC'  },
  'Consumer Discretionary':                 { he: 'צריכה מחזורית',                        etf: 'XLY'  },
  'Regional Banks / Homebuilders / REITs':  { he: 'בנקים אזוריים / קבלני בתים / ריטים', etf: 'KRE'  },
};

function _normSectorKey(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const _SECTOR_META_BY_KEY = Object.fromEntries(
  Object.entries(SECTOR_METADATA).map(([k, v]) => [_normSectorKey(k), v])
);

function _etfUrl(ticker) {
  return `https://finviz.com/quote.ashx?t=${encodeURIComponent(ticker)}`;
}

function getSectorMeta(name) {
  const key = _normSectorKey(name);
  const direct = _SECTOR_META_BY_KEY[key];
  if (direct) return { he: direct.he, etf: direct.etf, finvizUrl: _etfUrl(direct.etf) };

  // Fallback: extract ticker from parentheses, e.g. "XYZ Sector (ETF)"
  const parenMatch = String(name).match(/\(([A-Z]{2,6})\)/);
  if (parenMatch) {
    const etf = parenMatch[1];
    const baseName = String(name).replace(/\s*\([^)]+\)\s*/g, '').trim();
    const baseMeta = _SECTOR_META_BY_KEY[_normSectorKey(baseName)];
    return { he: baseMeta?.he ?? null, etf, finvizUrl: _etfUrl(etf) };
  }

  return null;
}

function buildSectorStatusParts(direction, relativeStrength) {
  const ctx = [direction, relativeStrength].filter(Boolean).join(' ');
  const parts = [];
  const seen = new Set();

  for (const val of [direction, relativeStrength]) {
    const raw = String(val ?? '').trim();
    if (!raw) continue;

    const formatted = formatMarketChange(raw, ctx);
    if (formatted?.kind === 'percent' || formatted?.kind === 'neutral') {
      const key = formatted.text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      parts.push(formatted);
      continue;
    }

    if (isDuplicateDirectionLabel(raw)) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push({ kind: 'text', text: raw, tone: resolveTone(raw) });
  }

  return parts;
}

/**
 * Sector row: name (right) + status (left), RTL. No inner card borders.
 */
export function SectorRow({
  sector,
  direction,
  relativeStrength,
  isLast = false,
  columnVariant,
}) {
  const sectorName = String(sector || '').trim();
  const statusParts = buildSectorStatusParts(direction, relativeStrength);
  const meta = getSectorMeta(sectorName);

  if (!sectorName && statusParts.length === 0) return null;

  return (
    <div dir="rtl" className={`${DASHBOARD_ITEM_ROW_CLS} text-right`} data-sector-item>
      <div className="flex items-start gap-x-3 min-w-0">
        <div className="shrink-0 w-[55%] min-w-0">
          {meta?.finvizUrl ? (
            <a
              href={meta.finvizUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="פתח ETF ב-Finviz ↗"
              className={`${DASHBOARD_TABLE_CELL_PRIMARY_CLS} hover:underline`}
            >
              {sectorName}
            </a>
          ) : (
            <span className={DASHBOARD_TABLE_CELL_PRIMARY_CLS}>{sectorName}</span>
          )}
          {meta?.he && (
            <>
              <span className="text-slate-400 dark:text-zinc-500 mx-1.5 select-none" aria-hidden>—</span>
              <span className={DASHBOARD_TABLE_CELL_MUTED_CLS}>{meta.he}</span>
            </>
          )}
        </div>
        {statusParts.length > 0 && (
          <span className="flex-1 min-w-0 text-right inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 justify-end">
            {statusParts.map((part, idx) => (
              <NumericChangeSpan key={`sector-status-${idx}`} display={part} />
            ))}
          </span>
        )}
      </div>
      {!isLast && (
        <div className="mt-2.5 border-b border-slate-200/70 dark:border-zinc-700/50" aria-hidden />
      )}
    </div>
  );
}

export function SectorCard({
  sector,
  direction,
  relativeStrength,
  isLast = false,
  columnVariant,
}) {
  return (
    <SectorRow
      sector={sector}
      direction={direction}
      relativeStrength={relativeStrength}
      isLast={isLast}
      columnVariant={columnVariant}
    />
  );
}
