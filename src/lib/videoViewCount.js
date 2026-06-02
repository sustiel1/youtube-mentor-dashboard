export function formatViewCount(viewCount) {
  const value = Number(viewCount);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}M צפיות`;
  if (value >= 1_000) return `${+(value / 1_000).toFixed(1)}K צפיות`;
  return `${Math.round(value).toLocaleString()} צפיות`;
}
