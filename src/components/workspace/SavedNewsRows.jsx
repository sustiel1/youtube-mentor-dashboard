import { useMemo, useState } from 'react';
import { findMarketEntityLinksInText } from '@/lib/marketEntityLinkResolver';
import { deriveNewsTone, deriveNewsTopic, NEWS_TONE_META, NEWS_TOPIC_LABELS } from '@/lib/newsRowVisuals';
import { translateSentimentValue } from '@/lib/sentimentDisplayI18n';
import { UniversalTabCheckbox } from '@/components/shared/UniversalTabSelectRow';
import { rowSelectionProps } from '@/lib/workspaceRowSelection';
import { cn } from '@/lib/utils';
import {
  getWorkspaceRecordRevealState,
  useWorkspaceRecordRevealIds,
  WORKSPACE_RECORD_REVEAL_CLASS,
} from '@/context/WorkspaceRecordRevealContext';

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

function normalizedSourceLinks(links = []) {
  const seen = new Set();
  return (Array.isArray(links) ? links : []).flatMap((link, index) => {
    const url = typeof link === 'string' ? link.trim() : String(link?.url || link?.href || link?.link || '').trim();
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{
      url,
      label: typeof link === 'object'
        ? String(link.label || link.title || link.name || `מקור ${index + 1}`).trim()
        : `מקור ${index + 1}`,
    }];
  });
}

function sourceMetadataText(sourceMetadata = {}) {
  if (!sourceMetadata || typeof sourceMetadata !== 'object') return '';
  return [
    sourceMetadata.source,
    sourceMetadata.sourceName,
    sourceMetadata.publisher,
    sourceMetadata.author,
    sourceMetadata.publishedAt || sourceMetadata.date,
  ].map(value => String(value || '').trim()).filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(' · ');
}

/** One row: primary news content first; sentiment and source data remain supporting metadata. */
export function NewsStyleTextRow({
  topic,
  entityLinks,
  text,
  headline = '',
  description = '',
  sentiment = '',
  impact = '',
  links = [],
  sourceMetadata = {},
  structuredNews = false,
  recordIds,
  selectedIds,
  onToggleGroup,
}) {
  const revealIds = useWorkspaceRecordRevealIds();
  const tone = deriveNewsTone([sentiment, headline, description, impact, text].filter(Boolean).join(' '));
  const toneMeta = NEWS_TONE_META[tone];
  const sentimentLabel = translateSentimentValue(sentiment);
  const sourceText = sourceMetadataText(sourceMetadata);
  const sourceLinks = normalizedSourceLinks([
    ...(Array.isArray(links) ? links : []),
    ...(sourceMetadata?.url ? [{ url: sourceMetadata.url, label: 'מקור' }] : []),
  ]);
  const selection = rowSelectionProps({ recordIds, selectedIds, onToggleGroup, ariaLabel: `בחר את השורה: ${text}` });
  const reveal = getWorkspaceRecordRevealState(recordIds, revealIds);
  return (
    <div
      dir="rtl"
      {...reveal.attributes}
      className={cn(`flex items-start gap-2 rounded-l-xl rounded-r-none border border-r-[3px] border-slate-200 dark:border-zinc-700/60 ${toneMeta.borderClass} bg-white dark:bg-zinc-900 px-3 py-2.5 transition-colors`, reveal.highlighted && WORKSPACE_RECORD_REVEAL_CLASS)}
      data-news-style-row
      data-news-row-tone={tone}
    >
      {selection && (
        <span className="shrink-0 pt-1">
          <UniversalTabCheckbox {...selection} />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
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
        {sourceLinks.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
            data-news-source-link
          >
            {link.label}
          </a>
        ))}
      </div>
      {structuredNews ? (
        <>
          <h4 className="text-sm font-extrabold leading-snug text-slate-900 dark:text-zinc-100 break-words" data-news-headline>{headline}</h4>
          <p className="text-[13px] leading-relaxed text-slate-700 dark:text-zinc-300 break-words [overflow-wrap:anywhere]" data-news-description>{description}</p>
          {(sentimentLabel || impact || sourceText) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-zinc-400" data-news-metadata>
              {sentimentLabel && <span data-news-sentiment><span className="font-semibold">סנטימנט:</span> {sentimentLabel}</span>}
              {impact && <span data-news-impact><span className="font-semibold">השפעה:</span> {impact}</span>}
              {sourceText && <span data-news-source><span className="font-semibold">מקור:</span> {sourceText}</span>}
            </div>
          )}
        </>
      ) : (
        <p className="text-[13px] leading-snug text-slate-700 dark:text-zinc-300 break-words [overflow-wrap:anywhere]">
          {text}
        </p>
      )}
      </div>
    </div>
  );
}

export function SavedNewsRows({ entries = [], selectedIds, onToggleGroup }) {
  const [activeTopic, setActiveTopic] = useState('all');

  const rows = useMemo(() => entries.map((entry) => {
    const text = typeof entry === 'string' ? entry : entry?.text;
    const safeText = String(text || '').trim();
    if (!safeText) return null;
    const recordIds = typeof entry === 'object' ? entry?.recordIds : null;
    const headline = typeof entry === 'object' ? String(entry?.headline || '').trim() : '';
    const description = typeof entry === 'object' ? String(entry?.description || '').trim() : '';
    const sentiment = typeof entry === 'object' ? String(entry?.sentiment || '').trim() : '';
    const impact = typeof entry === 'object' ? String(entry?.impact || '').trim() : '';
    const symbols = typeof entry === 'object' && Array.isArray(entry?.symbols) ? entry.symbols : [];
    const entityText = [headline, description, impact, symbols.join(' '), safeText].filter(Boolean).join(' ');
    const entityLinks = findMarketEntityLinksInText(entityText);
    const topic = deriveNewsTopic(entityText, entityLinks);
    return {
      text: safeText,
      headline,
      description,
      sentiment,
      impact,
      links: typeof entry === 'object' ? entry?.links : [],
      sourceMetadata: typeof entry === 'object' ? entry?.sourceMetadata : {},
      structuredNews: Boolean(typeof entry === 'object' && entry?.structuredNews),
      recordIds,
      entityLinks,
      topic,
    };
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
          <NewsStyleTextRow
            key={`${row.text}-${i}`}
            topic={row.topic}
            entityLinks={row.entityLinks}
            text={row.text}
            headline={row.headline}
            description={row.description}
            sentiment={row.sentiment}
            impact={row.impact}
            links={row.links}
            sourceMetadata={row.sourceMetadata}
            structuredNews={row.structuredNews}
            recordIds={row.recordIds}
            selectedIds={selectedIds}
            onToggleGroup={onToggleGroup}
          />
        ))}
      </div>
    </div>
  );
}
