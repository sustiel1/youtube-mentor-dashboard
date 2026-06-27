import { formatMarketChange } from '@/lib/morningBriefVisuals';
import { NumericChangeSpan } from './MorningBriefVisualPrimitives';
import { getExternalSymbolUrl } from '@/utils/finvizLinks';

function parseIndexItem(raw) {
  if (!raw) return null;

  let name = '', direction = '', change = '', level = '', note = '';

  if (typeof raw === 'object') {
    name      = raw.name || raw.asset || raw.ticker || raw.symbol || raw.metric || raw.index || '';
    direction = raw.direction || raw.trend || '';
    change    = raw.change || raw.pct || raw.changePercent || '';
    level     = String(raw.level || raw.price || raw.value || '');
    const condition = String(raw.condition || '').trim();
    const conditionIsTrend = ['up', 'down', 'bullish', 'bearish', 'neutral', 'flat', 'positive', 'negative']
      .includes(condition.toLowerCase());
    if (!direction && conditionIsTrend) direction = condition;
    note      = raw.note || raw.insight || raw.description || raw.comment ||
      (!conditionIsTrend && condition ? condition : '');
  } else if (typeof raw === 'string') {
    const ci = raw.indexOf(':');
    if (ci === -1) return { name: raw.trim().toUpperCase(), direction: '', change: '', level: '', note: '' };
    name = raw.slice(0, ci).trim();
    const rest = raw.slice(ci + 1).trim();
    const parts = rest.split(/\s*\|\s*/);
    const obj = {};
    parts.forEach(part => {
      const ki = part.indexOf(':');
      if (ki !== -1) {
        obj[part.slice(0, ki).trim().toLowerCase()] = part.slice(ki + 1).trim();
      }
    });
    direction = obj.direction || obj.trend || '';
    change    = obj.change || obj.pct || '';
    level     = obj.level || obj.price || obj.value || '';
    note      = obj.note || obj.insight || obj.description || '';
  } else {
    return null;
  }

  name = String(name || '').trim();
  if (!name && !direction && !change && !level && !note) return null;
  return { name: name ? name.toUpperCase() : '', direction, change, level, note };
}

function isStructuredRow(row) {
  if (!row) return false;
  const hasName = !!row.name;
  const hasMetricData = !!(row.level || row.change || row.direction || row.note);
  return hasName && hasMetricData;
}

function dirInfo(dir) {
  const d = (dir || '').toLowerCase();
  if (d === 'up' || d === 'bullish' || d === 'positive')
    return { emoji: '🟢', label: 'עלייה', badgeCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', rowCls: 'bg-emerald-50/60 dark:bg-emerald-950/15' };
  if (d === 'down' || d === 'bearish' || d === 'negative')
    return { emoji: '🔴', label: 'ירידה', badgeCls: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300', rowCls: 'bg-red-50/60 dark:bg-red-950/15' };
  if (d === 'flat' || d === 'neutral' || d === 'unchanged')
    return { emoji: '⚪', label: 'ניטרלי', badgeCls: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400', rowCls: 'bg-slate-50/40 dark:bg-zinc-900/20' };
  return { emoji: null, label: dir || null, badgeCls: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400', rowCls: '' };
}

function renderChangeCell(change, direction) {
  const ctx = [direction, change].filter(Boolean).join(' ');
  const display = formatMarketChange(change, ctx);
  if (display) return <NumericChangeSpan display={display} className="text-base" />;
  return null;
}

function formatKvValue(val) {
  if (val == null) return '';
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return val.map(formatKvValue).filter(Boolean).join(', ');
  return JSON.stringify(val);
}

function KeyValueFallback({ items = [], onSaveToBrain }) {
  return (
    <div className="space-y-2" dir="rtl">
      {items.map((raw, i) => {
        if (typeof raw === 'string') {
          const text = raw.trim();
          if (!text) return null;
          return (
            <div key={i} className="rounded-lg border border-slate-200 dark:border-zinc-700 px-3 py-2 text-sm text-slate-700 dark:text-zinc-300 text-right">
              {text}
            </div>
          );
        }
        if (!raw || typeof raw !== 'object') return null;
        const entries = Object.entries(raw).filter(([, v]) => formatKvValue(v));
        if (entries.length === 0) return null;
        const summary = entries.map(([k, v]) => `${k}: ${formatKvValue(v)}`).join(' · ');
        return (
          <div key={i} className="rounded-lg border border-slate-200 dark:border-zinc-700 px-3 py-2 text-right group">
            <dl className="space-y-1">
              {entries.map(([k, v]) => (
                <div key={k} className="flex flex-wrap gap-x-2 justify-end text-sm">
                  <dt className="text-slate-400 dark:text-zinc-500 shrink-0">{k}:</dt>
                  <dd className="text-slate-700 dark:text-zinc-300">{formatKvValue(v)}</dd>
                </div>
              ))}
            </dl>
            {onSaveToBrain && (
              <button
                type="button"
                onClick={() => onSaveToBrain(summary)}
                className="mt-1.5 text-xs text-indigo-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                🧠 שמור
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

const TABLE_COLS = [
  { key: 'name', label: 'נכס / מדד', pick: (r) => r.name },
  { key: 'level', label: 'ערך', pick: (r) => r.level },
  { key: 'change', label: 'שינוי', pick: (r) => r.change, isChange: true },
  { key: 'direction', label: 'מגמה', pick: (r) => r.direction, isTrend: true },
  { key: 'note', label: 'הערה', pick: (r) => r.note },
];

export function MarketIndicesTable({ items = [], onSaveToBrain }) {
  const rows = items.map(parseIndexItem).filter(Boolean);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-zinc-500" dir="rtl">
        <span className="text-3xl mb-2 opacity-30">📊</span>
        <p className="text-sm">אין נתוני שווקים</p>
      </div>
    );
  }

  const structuredRows = rows.filter(isStructuredRow);
  if (structuredRows.length === 0) {
    return <KeyValueFallback items={items} onSaveToBrain={onSaveToBrain} />;
  }

  const activeCols = TABLE_COLS.filter((col) => {
    if (col.key === 'name') return true;
    return structuredRows.some((row) => {
      const v = col.pick(row);
      return v != null && String(v).trim() !== '';
    });
  });

  if (activeCols.length <= 1) {
    return <KeyValueFallback items={items} onSaveToBrain={onSaveToBrain} />;
  }

  return (
    <div dir="rtl">
      {/* ── Desktop: table ── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-200 dark:border-zinc-700 bg-slate-100/80 dark:bg-zinc-800/60">
              {activeCols.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2.5 text-right text-xs font-bold text-slate-600 dark:text-zinc-300 uppercase tracking-wide"
                >
                  {col.label}
                </th>
              ))}
              {onSaveToBrain && <th style={{ width: 36 }} />}
            </tr>
          </thead>
          <tbody>
            {structuredRows.map((row, i) => {
              const dir = dirInfo(row.direction);
              const isEven = i % 2 === 0;
              const zebraCls = dir.rowCls || (isEven ? 'bg-white dark:bg-zinc-900' : 'bg-slate-50/60 dark:bg-zinc-800/30');
              return (
                <tr
                  key={i}
                  className={`border-b border-slate-100 dark:border-zinc-800/60 hover:brightness-[0.97] dark:hover:brightness-110 transition-colors group ${zebraCls}`}
                >
                  {activeCols.map((col) => {
                    const val = col.pick(row);
                    if (col.isTrend) {
                      return (
                        <td key={col.key} className="px-3 py-3 whitespace-nowrap">
                          {dir.label ? (
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ${dir.badgeCls}`}>
                              {dir.emoji && <span className="text-base leading-none">{dir.emoji}</span>}
                              <span>{dir.label}</span>
                            </span>
                          ) : null}
                        </td>
                      );
                    }
                    if (col.isChange) {
                      return (
                        <td key={col.key} className="px-3 py-3 whitespace-nowrap">
                          {renderChangeCell(val, row.direction)}
                        </td>
                      );
                    }
                    const cellCls = col.key === 'name'
                      ? 'font-bold text-sm text-slate-900 dark:text-zinc-50 tracking-wide whitespace-nowrap'
                      : col.key === 'level'
                        ? 'font-mono text-sm text-slate-700 dark:text-zinc-200 whitespace-nowrap'
                        : 'text-sm text-slate-600 dark:text-zinc-400 leading-relaxed';
                    if (col.key === 'name' && val) {
                      const nameUrl = getExternalSymbolUrl(val);
                      return (
                        <td key={col.key} className={`px-3 py-3 ${cellCls}`}>
                          {nameUrl ? (
                            <a
                              href={nameUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`פתח ${val} ↗`}
                              className="hover:underline cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {val}
                            </a>
                          ) : val}
                        </td>
                      );
                    }
                    return (
                      <td key={col.key} className={`px-3 py-3 ${cellCls}`}>
                        {val || null}
                      </td>
                    );
                  })}
                  {onSaveToBrain && (
                    <td style={{ width: 36 }} className="px-2 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          const text = [row.name, row.level, row.change, dir.label, row.note].filter(Boolean).join(' · ');
                          onSaveToBrain(text);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-sm leading-none transition-all"
                        title="שמור למוח"
                      >
                        🧠
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile: stacked cards ── */}
      <div className="sm:hidden space-y-2.5">
        {structuredRows.map((row, i) => {
          const dir = dirInfo(row.direction);
          return (
            <div
              key={i}
              className={`rounded-xl border border-slate-200 dark:border-zinc-700 px-4 py-3 shadow-sm ${dir.rowCls || 'bg-white dark:bg-zinc-900'}`}
              dir="rtl"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                {row.name && (() => {
                  const mobileUrl = getExternalSymbolUrl(row.name);
                  return mobileUrl ? (
                    <a
                      href={mobileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`פתח ${row.name} ↗`}
                      className="font-bold text-sm tracking-wide text-slate-900 dark:text-zinc-50 hover:underline cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.name}
                    </a>
                  ) : (
                    <span className="font-bold text-sm tracking-wide text-slate-900 dark:text-zinc-50">{row.name}</span>
                  );
                })()}
                <div className="flex items-center gap-2 shrink-0">
                  {dir.label && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${dir.badgeCls}`}>
                      {dir.emoji} {dir.label}
                    </span>
                  )}
                  {renderChangeCell(row.change, row.direction)}
                </div>
              </div>
              {row.level && (
                <p className="text-xs font-mono text-slate-500 dark:text-zinc-400 mb-1">ערך: {row.level}</p>
              )}
              {row.note && (
                <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">{row.note}</p>
              )}
              {onSaveToBrain && (
                <button
                  type="button"
                  onClick={() => {
                    const text = [row.name, row.level, row.change, dir.label, row.note].filter(Boolean).join(' · ');
                    onSaveToBrain(text);
                  }}
                  className="mt-1.5 text-xs text-indigo-400 hover:text-indigo-600 transition-colors"
                >
                  🧠 שמור
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
