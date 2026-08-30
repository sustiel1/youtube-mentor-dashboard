import { useMemo, useState } from 'react';
import { findMarketEntityLinksInText } from '@/lib/marketEntityLinkResolver';
import { deriveNewsTone, deriveNewsTopic, NEWS_TONE_META, NEWS_TOPIC_LABELS } from '@/lib/newsRowVisuals';

/**
 * Row list for individually-saved "📰 חדשות" rows AND (per approved Phase 2
 * scope) the Layer-2 fallback for "🎯 הזדמנויות" rows that don't match the
 * Layer-1 " · "-with-Hebrew-prefixes shape (see opportunityRowText.js).
 * News text is inherently free-form (title/summary/impact joined with
 * ' — ') and would produce mostly "—" cells in a table, so both surfaces
 * render as rows instead: a topic chip, one chip per identified ticker/
 * macro term (never plain unlinked text — see marketEntityLinkResolver.js),
 * then the row's full saved text at 13px, with a tone-colored right border.
 */

function FilterChip({ label, count, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
        isActive
          ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
          : 'border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800'
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums opacity-70">· {count}</span>
    </button>
  );
}

/** One row: topic chip + entity chips + full text, tone border on the visual right edge. */
export function NewsStyleTextRow({ topic, entityLinks, text }) {
  const tone = deriveNewsTone(text);
  const toneMeta = NEWS_TONE_META[tone];
  return (
    <div
      dir="rtl"
      className={`flex flex-col gap-1.5 rounded-l-xl rounded-r-none border border-r-[3px] border-slate-200 dark:border-zinc-700/60 ${toneMeta.borderClass} bg-white dark:bg-zinc-900 px-3 py-2.5`}
      data-news-style-row
      data-news-row-tone={tone}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
          data-news-topic-chip
        >
          {topic}
        </span>
        {entityLinks.map((link) => (
          <a
            key={link.display}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
            onClick={(event) => event.stopPropagation()}
            title={link.provider === 'finviz' ? `פתיחת ${link.display} ב־Finviz` : `פתיחת ${link.display} ב־Investing.com`}
            aria-label={link.provider === 'finviz' ? `פתיחת ${link.display} ב־Finviz` : `פתיחת ${link.display} ב־Investing.com`}
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200/80 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 dark:hover:bg-zinc-700 transition-colors"
            data-entity-chip={link.display}
          >
            {link.display}
          </a>
        ))}
      </div>
      <p className="text-[13px] leading-snug text-slate-700 dark:text-zinc-300 break-words [overflow-wrap:anywhere]">
        {text}
      </p>
    </div>
  );
}

export function SavedNewsRows({ entries = [] }) {
  const [activeTopic, setActiveTopic] = useState('all');

  const rows = useMemo(() => entries.map((entry) => {
    const text = typeof entry === 'string' ? entry : entry?.text;
    const safeText = String(text || '').trim();
    if (!safeText) return null;
    const entityLinks = findMarketEntityLinksInText(safeText);
    const topic = deriveNewsTopic(safeText, entityLinks);
    return { text: safeText, entityLinks, topic };
  }).filter(Boolean), [entries]);

  const { counts, filtered } = useMemo(() => {
    const c = {};
    for (const label of NEWS_TOPIC_LABELS) c[label] = 0;
    for (const row of rows) c[row.topic] = (c[row.topic] || 0) + 1;
    const f = activeTopic === 'all' ? rows : rows.filter((row) => row.topic === activeTopic);
    return { counts: c, filtered: f };
  }, [rows, activeTopic]);

  if (rows.length === 0) return null;

  return (
    <div data-saved-news-rows>
      <div className="mb-2 flex flex-wrap items-center gap-1.5" dir="rtl" data-news-topic-filter>
        <FilterChip label="הכל" count={rows.length} isActive={activeTopic === 'all'} onClick={() => setActiveTopic('all')} />
        {NEWS_TOPIC_LABELS.filter((label) => counts[label] > 0).map((label) => (
          <FilterChip
            key={label}
            label={label}
            count={counts[label]}
            isActive={activeTopic === label}
            onClick={() => setActiveTopic(label)}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {filtered.map((row, i) => (
          <NewsStyleTextRow key={`${row.text}-${i}`} topic={row.topic} entityLinks={row.entityLinks} text={row.text} />
        ))}
      </div>
    </div>
  );
}
