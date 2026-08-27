import { createContext, useContext } from 'react';
import { buildStaticYouTubeTimestampLink } from '@/lib/staticVideoTimestamp';
import { rowTextOf } from '@/lib/rowExtraction';

const SUPPORTED_ROW_TIMESTAMP_TABS = new Set(['summary', 'insights', 'useful-knowledge', 'specialized']);
const RowTimestampContext = createContext(null);

export function StaticVideoTimestampProvider({ youtubeId = null, videoId = null, activeTab, resolver = null, children }) {
  const canonicalYoutubeId = youtubeId || videoId;
  return (
    <RowTimestampContext.Provider value={{ youtubeId: canonicalYoutubeId, activeTab, resolver }}>
      {children}
    </RowTimestampContext.Provider>
  );
}

function withSidecarTimestamp(videoId, items, context, identity = {}) {
  const candidates = (Array.isArray(items) ? items : [items]).filter(Boolean);
  const youtubeId = videoId || context?.youtubeId || null;
  const fallbackItem = candidates.length === 1 ? candidates[0] : null;
  if (!context || !youtubeId || context.youtubeId !== youtubeId || !SUPPORTED_ROW_TIMESTAMP_TABS.has(context.activeTab)) {
    return { item: fallbackItem, youtubeId, mapped: false };
  }

  const matches = candidates.map((item, index) => {
    const canonicalSourceText = candidates.length === 1 && identity.canonicalSourceText
      ? identity.canonicalSourceText
      : rowTextOf(item).trim();
    if (!canonicalSourceText) return null;
    const resolved = context.resolver?.resolve({
      tab: context.activeTab,
      section: identity.section,
      productionRowId: identity.productionRowId ? `${identity.productionRowId}${candidates.length > 1 ? `:${index}` : ''}` : null,
      legacyRowPath: identity.legacyRowPath,
      sourceItem: item,
      canonicalSourceText,
      displayText: identity.displayText || rowTextOf(item).trim(),
    });
    return resolved ? { item, ...resolved } : null;
  }).filter(Boolean);
  const uniqueMatches = [...new Map(matches.map((match) => [match.descriptor.legacyRowPath, match])).values()];
  if (uniqueMatches.length !== 1) return { item: fallbackItem, youtubeId, mapped: false };

  const [{ item, annotation }] = uniqueMatches;
  const source = typeof item === 'string' ? { text: item } : { ...item };
  return {
    item: {
      ...source,
      estimatedStartSeconds: annotation.estimatedStartSeconds,
      estimatedEndSeconds: annotation.estimatedEndSeconds ?? null,
      timestampKind: 'estimated',
      timestampSource: 'row-timestamp-opt-in',
      timestampConfidence: annotation.timestampConfidence ?? null,
      sourceQuote: annotation.sourceQuote,
    },
    youtubeId,
    mapped: true,
  };
}

function TimestampAnchor({ link, mapped = false }) {
  return (
    <a
      href={link.href}
      target={link.target}
      rel={link.rel}
      aria-label={link.ariaLabel}
      title={link.ariaLabel}
      data-static-video-time={link.estimated ? 'estimated' : 'exact'}
      data-row-timestamp-mapped={mapped ? 'true' : undefined}
      dir="ltr"
      onClick={(event) => event.stopPropagation()}
      className="inline-flex min-h-9 max-w-full shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs font-semibold leading-none text-slate-500 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-400 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
    >
      {mapped ? `✓ ${link.visibleLabel}` : link.visibleLabel}
    </a>
  );
}

export function StaticVideoTimestampLink({ videoId = null, item = null, items = null, ...identity }) {
  const context = useContext(RowTimestampContext);
  const resolved = withSidecarTimestamp(videoId, items || item, context, identity);
  const link = buildStaticYouTubeTimestampLink(resolved.youtubeId, resolved.item);
  if (!link) return null;
  return <TimestampAnchor link={link} mapped={resolved.mapped} />;
}

export function StaticVideoTimestampActions({ videoId = null, item = null, items = null, children = null, ...identity }) {
  const context = useContext(RowTimestampContext);
  const resolved = withSidecarTimestamp(videoId, items || item, context, identity);
  const link = buildStaticYouTubeTimestampLink(resolved.youtubeId, resolved.item);
  if (!link && !children) return null;

  return (
    <div className="flex items-center gap-1">
      {link ? <TimestampAnchor link={link} mapped={resolved.mapped} /> : null}
      {children}
    </div>
  );
}
