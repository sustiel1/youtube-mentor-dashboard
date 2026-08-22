const FEAR_GREED_STATUS_LABELS = Object.freeze({
  idle: 'ממתין לחיבור מקור חי',
  loading: 'טוען נתון חי…',
  ready: 'הנתון התקבל',
  stale: 'הנתון אינו עדכני',
  unavailable: 'המדד אינו זמין כרגע',
});

const PROVIDER_RATING_LABELS = Object.freeze({
  'Extreme Fear': 'פחד קיצוני',
  Fear: 'פחד',
  Neutral: 'ניטרלי',
  Greed: 'תאווה',
  'Extreme Greed': 'תאווה קיצונית',
});

export const FEAR_GREED_ZONES = Object.freeze([
  { min: 0, max: 24, label: 'פחד קיצוני', color: 'bg-red-500' },
  { min: 25, max: 44, label: 'פחד', color: 'bg-orange-400' },
  { min: 45, max: 55, label: 'ניטרלי', color: 'bg-amber-300' },
  { min: 56, max: 75, label: 'תאווה', color: 'bg-lime-400' },
  { min: 76, max: 100, label: 'תאווה קיצונית', color: 'bg-emerald-500' },
]);

export function normalizeFearGreedScore(score) {
  return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100
    ? score
    : null;
}

export function getFearGreedHebrewRating(score) {
  const validScore = normalizeFearGreedScore(score);
  if (validScore == null) return null;
  return FEAR_GREED_ZONES.find((zone) => validScore >= zone.min && validScore <= zone.max)?.label ?? null;
}

function getDisplayRating(score, rating) {
  const providerRating = typeof rating === 'string' ? rating.trim() : '';
  if (providerRating) return PROVIDER_RATING_LABELS[providerRating] || providerRating;
  return getFearGreedHebrewRating(score);
}

function getUpdateLabel(updatedAt) {
  const value = typeof updatedAt === 'string' ? updatedAt.trim() : '';
  return value ? `עודכן ${value}` : 'טרם עודכן';
}

export function FearGreedScoreCard({
  score = null,
  rating = null,
  updatedAt = null,
  status = 'idle',
  sourceUrl,
}) {
  const validScore = normalizeFearGreedScore(score);
  const hasScore = validScore != null;
  const safeStatus = Object.hasOwn(FEAR_GREED_STATUS_LABELS, status) ? status : 'idle';
  const displayStatus = hasScore && (safeStatus === 'ready' || safeStatus === 'stale')
    ? getDisplayRating(validScore, rating)
    : FEAR_GREED_STATUS_LABELS[
      !hasScore && (safeStatus === 'ready' || safeStatus === 'stale') ? 'idle' : safeStatus
    ];
  const activeZoneIndex = hasScore
    ? FEAR_GREED_ZONES.findIndex((zone) => validScore >= zone.min && validScore <= zone.max)
    : -1;

  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="פתיחת מדד הפחד והתאווה של CNN באתר חיצוני"
      title="פתיחת מדד הפחד והתאווה של CNN"
      className="group flex h-full w-full min-w-0 cursor-pointer flex-col rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-right shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/20 dark:focus-visible:ring-offset-zinc-900"
      dir="rtl"
      data-fear-greed-score-card
      data-score={hasScore ? validScore : undefined}
      data-status={safeStatus}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-2xl font-bold tabular-nums text-slate-800 dark:bg-zinc-800 dark:text-zinc-100">
          {hasScore ? validScore : '—'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center justify-between gap-2">
            <span className="truncate text-sm font-bold text-slate-900 group-hover:text-indigo-700 dark:text-zinc-100 dark:group-hover:text-indigo-300">
              מדד פחד ותאווה
            </span>
            <span className="shrink-0 text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
              CNN ↗
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs font-medium text-slate-600 dark:text-zinc-300" data-fear-greed-status>
            {displayStatus}
          </span>
          <span className="mt-0.5 block text-[10px] text-slate-400 dark:text-zinc-500">
            {getUpdateLabel(updatedAt)}
          </span>
        </span>
      </div>

      <span
        className="mt-auto grid grid-cols-5 gap-1 pt-2"
        aria-label="טווח המדד: פחד קיצוני, פחד, ניטרלי, תאווה, תאווה קיצונית"
        data-fear-greed-scale
      >
        {FEAR_GREED_ZONES.map((zone, index) => {
          const active = index === activeZoneIndex;
          return (
            <span
              key={zone.label}
              className={`h-1.5 rounded-full ${zone.color} ${active ? 'opacity-100 ring-1 ring-slate-700 ring-offset-1 dark:ring-zinc-200 dark:ring-offset-zinc-900' : 'opacity-30'}`}
              title={zone.label}
              aria-label={zone.label}
              data-active={active ? 'true' : undefined}
            />
          );
        })}
      </span>
    </a>
  );
}
