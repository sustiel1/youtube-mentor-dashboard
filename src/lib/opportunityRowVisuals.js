/**
 * Pill presentation for SavedOpportunityRowsTable — reuses the shared
 * PILL_CLS container class from stockRowVisuals.js and adds the three
 * trade-plan tone classes (entry/stop/timeframe) this table needs.
 */
export { PILL_CLS } from '@/lib/stockRowVisuals';

export const ENTRY_PILL_CLS =
  'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';
export const STOP_PILL_CLS =
  'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300';
export const TIMEFRAME_PILL_CLS =
  'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300';
