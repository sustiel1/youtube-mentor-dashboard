# Rescue copy — 2026-09-07 (TRADINGBRAIN-WIP-CLOSEOUT-PRECLEAN)

Untracked source files found sitting in two stale worktrees under
`C:/Users/11/Desktop/Workspace/new-project/projects/`, with no copy anywhere
else in git history. Copied here verbatim as a safety net; **the original
worktrees were left untouched** (not deleted, not pruned).

## Sources

- `src/lib/marketAssetDescriptions.js`, `src/lib/sectorTablePresentation.js`
  — from worktree `ymd-build-missing-assets-verify-20260827-01`
  (`git worktree list` shows it detached at `37a4a30`).
- `prototype-daily-snapshot/` (5 files) — from worktree
  `ymd-tradingbrain-daily-snapshot-design`
  (branch `prototype/tradingbrain-daily-snapshot-design`, tip `2888f7a`).

## What each file is

- **`marketAssetDescriptions.js`** (33 lines) — a small, finished lookup
  module: a frozen `MARKET_ASSET_DESCRIPTIONS` map giving a one-line Hebrew
  description for market assets (RSP, ETH, SPX, NASDAQ, DOW, RUSSELL, VIX,
  OIL, DOLLAR, BITCOIN, BONDS10Y), an alias table (`BTC`→`BITCOIN`,
  `US10Y`→`BONDS10Y`, etc.), and a `getMarketAssetDescription()` getter with
  an "no description available" fallback. Self-contained, no external deps.
- **`sectorTablePresentation.js`** (88 lines) — a sector-label → sector-ETF
  Finviz-link resolver: exact Hebrew alias map plus a fuzzy multi-alias
  matcher (`resolveSectorTableEtfTicker`) with Hebrew-aware normalization,
  producing a `{ ticker, url }` Finviz quote link via
  `resolveSectorTableFinvizLink()`. Self-contained, no external deps. Looks
  like a sibling/alternative to the already-committed
  `src/lib/sectorFinvizLinks.js` / `stockSectorEnrichment.js` — worth
  comparing before wiring in, to avoid a second competing sector→ETF map.
- **`prototype-daily-snapshot/`** (691 lines, 5 files, ~57KB) — a complete,
  standalone Vite-less React prototype (`index.html` + `main.jsx` +
  `DailySnapshot.jsx` + `dailySnapshot.fixture.js` + `styles.css`) for a
  Hebrew-RTL "Daily Snapshot" trading-risk dashboard screen: status row,
  daily invalidation rule + risk limits, today's macro events table, a
  focus-assets panel, a lockable daily-plan form, and a pending-reviews
  queue. Well-structured, accessible (`aria-label`s throughout), uses
  `lucide-react` icons, ships its own fixture data — reads as a finished,
  polished design prototype, not a rough sketch.

## Status

Not reviewed for wiring into the live app. Not committed as part of the app
build (`prototype-daily-snapshot/` is a standalone prototype, not meant to be
imported). Kept here only so the source files are not lost if the two
worktrees are ever pruned.
