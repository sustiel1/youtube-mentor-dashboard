import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Maximize2 } from 'lucide-react';
import { FearGreedScoreCard } from './FearGreedScoreCard';
import { FearGreedIndicatorsGrid } from './FearGreedIndicatorsGrid';
import { FearGreedFullScreenModal } from './FearGreedFullScreenModal';
import { FearGreedScoreInfoTooltip } from './FearGreedScoreInfoTooltip';
import { CNN_FEAR_GREED_URL } from '@/lib/sentimentSourceLinks';
import {
  FEAR_GREED_API_PATH,
  FEAR_GREED_QUERY_STALE_TIME_MS,
  normalizeCnnFearGreedPayload,
  formatFearGreedUpdatedAt,
  formatFearGreedCheckedAtTime,
} from '@/lib/fearGreed';
import { readFearGreedCache, writeFearGreedCache } from '@/lib/persistence/fearGreedStore';

async function fetchLiveFearGreed() {
  const response = await fetch(FEAR_GREED_API_PATH);
  if (!response.ok) {
    throw new Error(`Fear & Greed proxy returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  const normalized = normalizeCnnFearGreedPayload(payload);
  if (!normalized) {
    throw new Error('Fear & Greed proxy returned an invalid payload');
  }
  // When the app itself checked — distinct from normalized.updatedAt, which
  // is CNN's own index timestamp and only changes when CNN recalculates it.
  return { ...normalized, fetchedAt: new Date().toISOString() };
}

// Presentational FearGreedScoreCard only ever receives score/updatedAt/status
// props (see scripts/fear-greed-score-card-qa.mjs) — this container owns the
// live fetch, the last-verified-value cache, and the idle/loading/ready/
// stale/unavailable state derivation, mirroring how
// AAIIWeeklySentimentCardContainer wraps AAIIWeeklySentimentCard.
export function FearGreedScoreCardContainer() {
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);

  const cacheQuery = useQuery({
    queryKey: ['fear-greed-cache'],
    queryFn: readFearGreedCache,
    staleTime: Infinity,
  });

  const liveQuery = useQuery({
    queryKey: ['fear-greed-live'],
    queryFn: fetchLiveFearGreed,
    staleTime: FEAR_GREED_QUERY_STALE_TIME_MS,
    retry: 1,
  });

  useEffect(() => {
    if (liveQuery.data) {
      writeFearGreedCache(liveQuery.data).catch(() => {
        // Cache is a best-effort convenience for reload/offline display; a
        // failed write must not affect the live value already on screen.
      });
    }
  }, [liveQuery.data]);

  const cached = cacheQuery.data;
  const live = liveQuery.data;

  // Score, updatedAt and the 7 indicators always come from the same
  // record (either the fresh live response or the cached fallback) so a
  // refresh/reload never mixes an old score with new indicators or vice versa.
  let status = 'idle';
  let activeRecord = null;

  if (live) {
    status = 'ready';
    activeRecord = live;
  } else if (liveQuery.isError && cached) {
    status = 'stale';
    activeRecord = cached;
  } else if (liveQuery.isError) {
    status = 'unavailable';
  } else if (cached) {
    // Paint the last verified value immediately while the live check runs.
    status = 'ready';
    activeRecord = cached;
  } else if (liveQuery.isLoading) {
    status = 'loading';
  }

  return (
    <>
    <FearGreedScoreCard
      sourceUrl={CNN_FEAR_GREED_URL}
      score={activeRecord?.score ?? null}
      updatedAt={formatFearGreedUpdatedAt(activeRecord?.updatedAt)}
      checkedAt={formatFearGreedCheckedAtTime(activeRecord?.fetchedAt)}
      status={status}
      indicatorsSlot={activeRecord?.indicators ? (
        <FearGreedIndicatorsGrid indicators={activeRecord.indicators} />
      ) : null}
      scoreInfoSlot={<FearGreedScoreInfoTooltip score={activeRecord?.score ?? null} />}
      refreshSlot={(
        <button
          type="button"
          onClick={() => liveQuery.refetch()}
          disabled={liveQuery.isFetching}
          aria-label="רענון נתוני מדד הפחד והתאווה מ-CNN"
          title="רענון נתוני מדד הפחד והתאווה מ-CNN"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-indigo-300"
          data-fear-greed-refresh
        >
          <RefreshCw className={`h-3.5 w-3.5 ${liveQuery.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
      )}
      expandSlot={(
        <button
          type="button"
          onClick={() => setIsFullScreenOpen(true)}
          aria-label="פתיחת תצוגה מלאה של מדד הפחד והתאווה"
          title="תצוגה מלאה"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-indigo-300"
          data-fear-greed-expand
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    />
    <FearGreedFullScreenModal
      open={isFullScreenOpen}
      onOpenChange={setIsFullScreenOpen}
      record={activeRecord}
      sourceUrl={CNN_FEAR_GREED_URL}
    />
    </>
  );
}
