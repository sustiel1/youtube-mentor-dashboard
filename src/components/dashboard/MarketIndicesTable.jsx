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
    return { emoji: '🟢', label: 'עלייה', cls: 'text-emerald-600 dark:text-emerald-400', rowCls: 'bg-emerald-50/40 dark:bg-emerald-950/10' };
  if (d === 'down' || d === 'bearish' || d === 'negative')
    return { emoji: '🔴', label: 'ירידה', cls: 'text-red-500 dark:text-red-400', rowCls: 'bg-red-50/40 dark:bg-red-950/10' };
  if (d === 'flat' || d === 'neutral' || d === 'unchanged')
    return { emoji: '⚪', label: 'ניטרלי', cls: 'text-slate-400 dark:text-zinc-500', rowCls: '' };
  return { emoji: null, label: dir || '—', cls: 'text-slate-500 dark:text-zinc-400', rowCls: '' };
}

function changeColor(change, direction) {
  const c = String(change || '');
  const d = (direction || '').toLowerCase();
  if (c.startsWith('+') || (!c.startsWith('-') && (d === 'up' || d === 'bullish' || d === 'positive')))
    return 'text-emerald-600 dark:text-emerald-400';
  if (c.startsWith('-') || d === 'down' || d === 'bearish' || d === 'negative')
    return 'text-red-500 dark:text-red-400';
  return 'text-slate-600 dark:text-zinc-400';
}

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
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-zinc-700 bg-slate-50/80 dark:bg-zinc-900/50">
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 dark:text-zinc-400">נכס</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 dark:text-zinc-400">מגמה</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 dark:text-zinc-400">שינוי</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 dark:text-zinc-400">רמה</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 dark:text-zinc-400">תובנה</th>
              {onSaveToBrain && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const dir = dirInfo(row.direction);
              const cc  = changeColor(row.change, row.direction);
              return (
                <tr
                  key={i}
                  className={`border-b border-slate-100 dark:border-zinc-800/60 hover:brightness-95 transition-colors group ${dir.rowCls}`}
                >
                  <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-zinc-100 text-xs tracking-wide whitespace-nowrap">
                    {row.name || '—'}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {row.direction ? (
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${dir.cls}`}>
                        {dir.emoji && <span className="leading-none">{dir.emoji}</span>}
                        <span>{dir.label}</span>
                      </span>
                    ) : <span className="text-slate-300 dark:text-zinc-600 text-xs">—</span>}
                  </td>
                  <td className={`px-3 py-2.5 font-mono text-xs font-semibold whitespace-nowrap ${row.change ? cc : 'text-slate-300 dark:text-zinc-600'}`}>
                    {row.change || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-zinc-300 font-mono whitespace-nowrap">
                    {row.level || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                    {row.note || <span className="text-slate-300 dark:text-zinc-600">—</span>}
                  </td>
                  {onSaveToBrain && (
                    <td className="px-2 py-2.5">
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
      <div className="sm:hidden space-y-2">
        {rows.map((row, i) => {
          const dir = dirInfo(row.direction);
          const cc  = changeColor(row.change, row.direction);
          return (
            <div
              key={i}
              className={`rounded-xl border border-slate-200 dark:border-zinc-800 px-3 py-2.5 ${dir.rowCls || 'bg-white dark:bg-zinc-900'}`}
              dir="rtl"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-bold text-xs tracking-wide text-slate-800 dark:text-zinc-100">{row.name || '—'}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {row.direction && (
                    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${dir.cls}`}>
                      {dir.emoji} {dir.label}
                    </span>
                  )}
                  {row.change && (
                    <span className={`font-mono text-xs font-semibold ${cc}`}>{row.change}</span>
                  )}
                  {row.level && (
                    <span className="font-mono text-xs text-slate-500 dark:text-zinc-400">{row.level}</span>
                  )}
                </div>
              </div>
              {row.note && (
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-zinc-400">{row.note}</p>
              )}
              {onSaveToBrain && (
                <button
                  type="button"
                  onClick={() => {
                    const text = [row.name, row.change, dir.label, row.note].filter(Boolean).join(' · ');
                    onSaveToBrain(text);
                  }}
                  className="mt-1 text-[10px] text-indigo-400 hover:text-indigo-600"
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
