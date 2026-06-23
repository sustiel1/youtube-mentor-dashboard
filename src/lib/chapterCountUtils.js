/**
 * Shared chapter-count computation.
 *
 * Ranges by video length × density mode:
 *   0–15 min  → Normal 4 | Detailed 5 | Maximum 6
 *  15–45 min  → Normal 7 | Detailed 9 | Maximum 10
 *  45–90 min  → Normal 11 | Detailed 13 | Maximum 15
 *   90+ min   → Normal 15 | Detailed 20 | Maximum 25
 */
export function computeTargetChapters(durationSeconds, densityMode = 'normal') {
  const d = Number(durationSeconds);
  if (!Number.isFinite(d) || d <= 0) return 6;

  if (d <= 15 * 60) {
    return densityMode === 'maximum' ? 6 : densityMode === 'detailed' ? 5 : 4;
  }
  if (d <= 45 * 60) {
    return densityMode === 'maximum' ? 10 : densityMode === 'detailed' ? 9 : 7;
  }
  if (d <= 90 * 60) {
    return densityMode === 'maximum' ? 15 : densityMode === 'detailed' ? 13 : 11;
  }
  return densityMode === 'maximum' ? 25 : densityMode === 'detailed' ? 20 : 15;
}
