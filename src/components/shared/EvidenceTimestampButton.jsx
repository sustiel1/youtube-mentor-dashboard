import { formatEvidenceTimestamp } from '@/lib/evidenceTimestamp';

export function EvidenceTimestampButton({ timing, onSeek, itemType = 'התובנה' }) {
  const label = formatEvidenceTimestamp(timing?.startSeconds);
  if (!label || typeof onSeek !== 'function') return null;
  return (
    <button
      type="button"
      dir="ltr"
      aria-label={`עבור לזמן ${label} בסרטון עבור ${itemType}`}
      title={`עבור לרגע בסרטון שממנו נלקחה ${itemType}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSeek(timing.startSeconds);
      }}
      className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200"
    >
      {label}
    </button>
  );
}
