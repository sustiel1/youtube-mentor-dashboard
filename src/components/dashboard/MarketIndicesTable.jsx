function parseIndexItem(raw) {
  if (!raw) return null;

  let name = '', direction = '', change = '', level = '', note = '';

  if (typeof raw === 'object') {
    name      = raw.name || raw.asset || raw.ticker || raw.symbol || '';
    direction = raw.direction || raw.trend || '';
    change    = raw.change || raw.pct || raw.changePercent || '';
    level     = String(raw.level || raw.price || raw.value || '');
    note      = raw.note || raw.insight || raw.description || raw.comment || '';
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

  if (!name && !direction && !change) return null;
  return { name: name.toUpperCase(), direction, change, level, note };
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

function changeColor(change, direction) {
  const c = String(change || '');
  const d = (direction || '').toLowerCase();
  if (c.startsWith('+') || (!c.startsWith('-') && (d === 'up' || d === 'bullish' || d === 'positive')))
    return 'text-emerald-600 dark:text-emerald-400';
  if (c.startsWith('-') || d === 'down' || d === 'bearish' || d === 'negative')
    return 'text-red-600 dark:text-red-400';
  return 'text-slate-700 dark:text-zinc-300';
}

const DASH = <span className="text-slate-300 dark:text-zinc-600">—</span>;

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

  return (
    <div dir="rtl">
      {/* ── Desktop: table ── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-200 dark:border-zinc-700 bg-slate-100/80 dark:bg-zinc-800/60">
              <th style={{ width: 120, minWidth: 120 }} className="px-3 py-2.5 text-right text-xs font-bold text-slate-600 dark:text-zinc-300 uppercase tracking-wide">נכס</th>
              <th style={{ width: 120, minWidth: 120 }} className="px-3 py-2.5 text-right text-xs font-bold text-slate-600 dark:text-zinc-300 uppercase tracking-wide">מגמה</th>
              <th style={{ width: 140, minWidth: 140 }} className="px-3 py-2.5 text-right text-xs font-bold text-slate-600 dark:text-zinc-300 uppercase tracking-wide">שינוי</th>
              <th style={{ width: 140, minWidth: 140 }} className="px-3 py-2.5 text-right text-xs font-bold text-slate-600 dark:text-zinc-300 uppercase tracking-wide">רמה</th>
              <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-600 dark:text-zinc-300 uppercase tracking-wide">תובנה</th>
              {onSaveToBrain && <th style={{ width: 36 }} />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const dir = dirInfo(row.direction);
              const cc  = changeColor(row.change, row.direction);
              const isEven = i % 2 === 0;
              const zebraCls = dir.rowCls || (isEven ? 'bg-white dark:bg-zinc-900' : 'bg-slate-50/60 dark:bg-zinc-800/30');
              return (
                <tr
                  key={i}
                  className={`border-b border-slate-100 dark:border-zinc-800/60 hover:brightness-[0.97] dark:hover:brightness-110 transition-colors group ${zebraCls}`}
                >
                  {/* Asset */}
                  <td style={{ width: 120, minWidth: 120 }} className="px-3 py-3 font-bold text-sm text-slate-900 dark:text-zinc-50 tracking-wide whitespace-nowrap">
                    {row.name || DASH}
                  </td>

                  {/* Trend badge */}
                  <td style={{ width: 120, minWidth: 120 }} className="px-3 py-3 whitespace-nowrap">
                    {dir.label ? (
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ${dir.badgeCls}`}>
                        {dir.emoji && <span className="text-base leading-none">{dir.emoji}</span>}
                        <span>{dir.label}</span>
                      </span>
                    ) : DASH}
                  </td>

                  {/* Change — large & bold */}
                  <td style={{ width: 140, minWidth: 140 }} className="px-3 py-3 whitespace-nowrap">
                    {row.change ? (
                      <span className={`font-mono text-base font-bold ${cc}`}>{row.change}</span>
                    ) : DASH}
                  </td>

                  {/* Level */}
                  <td style={{ width: 140, minWidth: 140 }} className="px-3 py-3 font-mono text-sm text-slate-700 dark:text-zinc-200 whitespace-nowrap">
                    {row.level || DASH}
                  </td>

                  {/* Insight — flexible */}
                  <td className="px-3 py-3 text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                    {row.note || DASH}
                  </td>

                  {onSaveToBrain && (
                    <td style={{ width: 36 }} className="px-2 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          const text = [row.name, row.change, dir.label, row.note].filter(Boolean).join(' · ');
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
        {rows.map((row, i) => {
          const dir = dirInfo(row.direction);
          const cc  = changeColor(row.change, row.direction);
          return (
            <div
              key={i}
              className={`rounded-xl border border-slate-200 dark:border-zinc-700 px-4 py-3 shadow-sm ${dir.rowCls || 'bg-white dark:bg-zinc-900'}`}
              dir="rtl"
            >
              {/* Top row: asset + trend + change */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-bold text-sm tracking-wide text-slate-900 dark:text-zinc-50">{row.name || '—'}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {dir.label && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${dir.badgeCls}`}>
                      {dir.emoji} {dir.label}
                    </span>
                  )}
                  {row.change && (
                    <span className={`font-mono text-base font-bold ${cc}`}>{row.change}</span>
                  )}
                </div>
              </div>
              {/* Level */}
              {row.level && (
                <p className="text-xs font-mono text-slate-500 dark:text-zinc-400 mb-1">רמה: {row.level}</p>
              )}
              {/* Insight */}
              {row.note && (
                <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">{row.note}</p>
              )}
              {onSaveToBrain && (
                <button
                  type="button"
                  onClick={() => {
                    const text = [row.name, row.change, dir.label, row.note].filter(Boolean).join(' · ');
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
