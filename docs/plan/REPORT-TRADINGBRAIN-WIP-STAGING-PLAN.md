# REPORT — TRADINGBRAIN-WIP-STAGING-PLAN

**Date:** 2026-09-03
**Branch:** `feat/saved-market-rows-table`, HEAD `7348809894b2ff518902383c9dd724be55ac4e7c` (after the Phase 1 commit of this session — see STAGE C report for that commit's own details).
**Scope:** Phase 2, read-only audit. No code edits, no git write operations performed while producing this report. Covers every file still uncommitted (`M`/`??`) after Phase 1's commit landed.

Files audited (from `git status --porcelain` immediately after Phase 1):
```
 M .claude/settings.json
 M docs/open-items-ledger.md
 M scripts/brief-gem-selector-qa.mjs
 M scripts/pinned-recent-video-card-qa.mjs
 M src/ai/gemini/gemContentRouter.js
 M src/components/dashboard/ExternalVideoModal.jsx
 M src/components/dashboard/GemRecommendationCard.jsx
 M src/components/dashboard/GemSelectionModal.jsx
 M src/components/dashboard/VideoDetailPanel.jsx
 M src/components/workspace/WorkspaceCollectionTiles.jsx
 M src/lib/gemRecommender.js
?? docs/plan/REPORT-TRADINGBRAIN-AAII-SENTIMENT-SAVE-DATALOSS.md
?? docs/plan/REPORT-TRADINGBRAIN-SAVEDROW-STALE-TAG-ROOTCAUSE.md
?? scripts/publish-date-header-coverage-qa.mjs
```

---

## Group 1 — TRADINGBRAIN-GEMPICKER-COMPACT-SCORING
**Owning agent:** `gemini-integration-engineer`

**Files:** `src/lib/gemRecommender.js`, `src/components/dashboard/GemSelectionModal.jsx`, `src/components/dashboard/GemRecommendationCard.jsx`, `src/ai/gemini/gemContentRouter.js`, `scripts/brief-gem-selector-qa.mjs`, plus a portion of `src/components/dashboard/VideoDetailPanel.jsx` (see the entanglement flag below — not counted as self-contained to this group).

**What it does:** Compact GEM picker layout, an `unclassified`/"ממתין לסיווג" pending-state string convention, and confidence badges on the recommended GEM.

**Self-contained vs. entangled:** All files except `VideoDetailPanel.jsx` are single-owner (only this WORK-ID's `git status` membership touches them). `VideoDetailPanel.jsx` is entangled with Group 2 — see the flag section below.

**Builds standalone:** `scripts/brief-gem-selector-qa.mjs` re-run fresh this pass — **passes** ("brief GEM selector QA: mapping, selection, clipboard and safe-open assertions passed"). The existing ledger row also cites `gems-link-import-routing-qa.mjs` and `test-morning-brief-routing.mjs` (88/88) plus a clean `npm run build` as previously passing — not re-run independently this pass since those scripts weren't touched or in scope for this audit's fresh checks. A full handoff report already exists: `docs/plan/REPORT-TRADINGBRAIN-GEMPICKER-COMPACT-SCORING.md`, headed **"UNTESTED BY THE USER. NOT COMMITTED."**

**Proposed staging (once the `VideoDetailPanel.jsx` split below is resolved):**
```
src/lib/gemRecommender.js
src/components/dashboard/GemSelectionModal.jsx
src/components/dashboard/GemRecommendationCard.jsx
src/ai/gemini/gemContentRouter.js
scripts/brief-gem-selector-qa.mjs
<VideoDetailPanel.jsx GEMPICKER-tagged hunks, via git add -p>
```

**Proposed commit message (draft):**
```
feat(gems): compact GEM picker layout with confidence badges

- redesign the GEM selector into a compact top-row layout
- introduce a single unclassified/"ממתין לסיווג" pending-state convention
- show classifier confidence badges on the recommended GEM

WORK-ID: TRADINGBRAIN-GEMPICKER-COMPACT-SCORING
```

**Known open decisions blocking a confident land (per ledger, all `needs-user-decision`, not re-litigated this pass):**
- Whether the brief's top row should show its confidence % ("AI מומלץ 97%") — an unapproved UI change.
- `gemContentRouter.js`'s entire exported API has zero import sites in `src/` — dead code, wire it in / fix the stale header comment / leave as-is.
- `TJS_GEM_KEYWORDS.dayTrading` contains generic technical-analysis Hebrew words, causing false-positive dayTrading classifications.
- No Hebrew spelling-variant tolerance (e.g. "פנדמנטלי" without the ו).
- Duplicate `unclassified`-state implementation vs. the separate `feat/gems-phase0-1` branch — that branch is explicitly **not** confirmed abandoned by a real user decision (see "Abandoned/unowned" section below).

---

## Group 2 — TRADINGBRAIN-FRESHIMPORT-COST-GUARD
**Owning agent:** unassigned (per ledger)

**Files:** `src/components/dashboard/VideoDetailPanel.jsx` only — a subset of its dirty lines (ledger estimates ~65 lines tagged `COST-GUARD`), entangled with Group 1's lines in the same file.

**What it does:** Adds a Hebrew confirmation dialog before "ייבא מחדש מאפס" (reimport from scratch) triggers a real, paid Claude analysis call, replacing an auto-run that previously fired with no confirmation. Also fixes a real bug found while building the cancel handler: `forceUpsertVideo`'s object-spread persistence silently ignores a `delete`d key, so only an explicit `pendingFreshImport:false` actually clears the flag through that path.

**Self-contained vs. entangled:** Entangled with Group 1 in the same file — see the flag section below.

**Builds standalone:** Per the ledger (not re-verified live this pass, since doing so would require the interleaved lines to be split first): `npm run build` reported clean (run twice), `return-to-analysis-deeplink-qa.mjs` 13/13, and 6 scenarios live-verified in a real browser (dialog-then-cancel, reload-after-cancel, fresh-confirm-exactly-one-call, reload-while-unanswered, reopen-after-reload re-shows dialog, Escape-equals-cancel). Full report: `docs/plan/REPORT-TRADINGBRAIN-FRESHIMPORT-COST-GUARD.md`. Explicitly needs the user's own manual QA (checklist in the report) before commit.

**Proposed staging:** `VideoDetailPanel.jsx`'s `COST-GUARD`-tagged hunks only, via `git add -p`, once the user has done the manual QA and reviewed the split.

**Proposed commit message (draft):**
```
fix(video-panel): confirm before a paid reimport-from-scratch analysis

- gate the auto-run fresh-import pipeline behind an explicit Hebrew
  confirmation dialog instead of firing the paid analysis call directly
- fix pendingFreshImport not actually clearing on cancel: forceUpsertVideo's
  object-spread persistence silently drops a deleted key, so cancel now
  writes an explicit false instead

WORK-ID: TRADINGBRAIN-FRESHIMPORT-COST-GUARD
```

**Known open, out-of-scope gap (not fixed by this WORK-ID):** the pipeline's own two `pendingFreshImport` clear sites (`VideoDetailPanel.jsx:8034,8100`) have the same delete-based-clear defect — a confirmed run whose transcript fetch fails/returns empty can leave the flag stuck `true` (UX dead-end, not a cost risk, since the ref-token guard prevents the dialog reappearing for that same request).

---

## Entanglement flag — `src/components/dashboard/VideoDetailPanel.jsx`

Two WORK-IDs (Group 1 and Group 2 above) share this file's currently-uncommitted diff on the same lines. This is already tracked as its own ledger row, `TRADINGBRAIN-VIDEODETAILPANEL-INTERLEAVED-STAGING`.

Freshly re-measured this pass:
- Raw: **408 lines changed (251 insertions, 157 deletions)**
- Ignoring whitespace: **124 lines changed (109 insertions, 15 deletions)**

Both counts have **drifted** since the ledger's last recorded measurement (398 lines / 251 ins / 147 del raw; 134 lines / 119 ins / 15 del ignoring whitespace) — confirming a concurrent session is still actively editing this file. This is a live-fire shared-worktree situation, not a stale reading.

Exact hunk ranges were **not** independently re-derived this pass — walking `git add -p` interactively to map hunk boundaries is a write-adjacent operation and out of scope for a read-only audit. The most detailed line-range source currently available is the ledger's own account: Group 2's report cites "5 blocks tagged `COST-GUARD`, ~65 of the file's dirty lines — the rest is another concurrent session's [Group 1's] unrelated uncommitted work, not touched." Recommend whichever of the two groups lands second run its own `git add -p` pass immediately before committing, re-confirming against HEAD at that moment (the file may have moved again).

---

## Group 3 — TRADINGBRAIN-PINNED-CARD-QA-BROKEN-BY-CONCURRENT-EDIT
**Owning agent:** `frontend-rtl-developer` (status: blocked)

**File:** `scripts/pinned-recent-video-card-qa.mjs`

**What it does:** QA script for the pinned-recent-video-card feature. Currently carries two independent stale assertions (both already documented in this session's STAGE B report and the corresponding backlog-tracker ledger update): one expects JSX (`showClearFocus={false}`) that was intentionally removed by `TRADINGBRAIN-WORKSPACE-TILES-PLACEMENT`; a separate, unrelated one expects `showClearFocus = true,` to be immediately followed by `}) {` in `WorkspaceFocusedVideoCard.jsx`'s signature, which no longer holds after new destructured params were inserted between them.

**Self-contained:** Yes — single file, no entanglement with any other group.

**Builds standalone:** No — fails on the first of the two stale assertions (`showClearFocus={false}`), confirmed by a fresh run this pass, unchanged from STAGE B.

**Proposed staging:** None until an owner fixes both stale assertions and confirms no further reasons for failure remain.

**Note for backlog-tracker (see hand-off below):** this file was accidentally reverted to HEAD via `git checkout --` during STAGE B (discarding ~37 lines of pre-existing uncommitted WIP along with the intended edit-undo), then hand-restored from the STAGE B session's own in-context copy of the file. The restore matches the pre-incident `git diff --stat` (41 insertions / 2 deletions) but was **never proven byte-identical** — no checksum was taken of the file before the incident occurred, so an exact-match claim cannot be verified after the fact. Flagged for its owner to do a full content review before trusting this file's current state as authoritative.

---

## Group 4 — TRADINGBRAIN-NIGHT-VERIFY-HARDEN / TRADINGBRAIN-SAVEDROWS-NEWS-FRESHNESS
**Owning agent:** unassigned (per ledger)

**File:** `scripts/publish-date-header-coverage-qa.mjs` (untracked)

**What it does:** Coverage-verification script for the already-committed `a7536c0` publish-date-header feature — checks timezone handling, which saved-section types get the header, and documents a known confirmed gap (the default "כל הסרטונים" view never shows a publish-date header, because it renders `WorkspaceVideoGroupCard.jsx`, which never calls `buildSectionMetadataLine`).

**New finding this pass:** the script now **fails**, on the exact assertion documenting that gap. Root cause: `WorkspaceVideoGroupCard.jsx` has **zero** uncommitted diff (it doesn't appear anywhere in `git status` — it's clean against HEAD), meaning the gap this script was written to prove has since been closed by a change **already committed to HEAD**, unrelated to any file in today's session or in Groups 1–3. The script itself has simply gone stale relative to current `HEAD` — this is not a regression caused by anything in this session's work.

**Self-contained:** Yes, standalone script — but currently incorrect against reality.

**Builds standalone:** Fails as-is. Would need its assertion direction reconsidered (the gap it documents as `doesNotMatch` may now need to be a `match`, or the whole check retired) once someone confirms exactly which commit closed the gap and what the new coverage actually is.

**Proposed staging:** None until reconciled. Recommend folding this into whoever picks up `TRADINGBRAIN-SAVEDROWS-NEWS-FRESHNESS`'s still-open decision ("extend coverage to `SnapshotSection` and the default view, or leave as intentional scope limitation") — that decision may already be moot if the default view now has coverage.

---

## Not grouped under any WORK-ID

**`docs/open-items-ledger.md`** — the shared tracking file itself, continuously appended by many sessions/agents (including this one, via backlog-tracker in STAGE B). Not a feature's code. Recommend it continue to follow its own established convention — committed periodically on its own cadence, not folded into any feature-landing commit above.

**`.claude/settings.json`** — local tooling/permission-allowlist entries (Chrome remote-debugging-port curl commands, a `node --check` convenience entry) accumulated from interactive debugging across sessions. Not tied to any WORK-ID. Recommend either leaving it as uncommitted local convenience config, or a trivial standalone `chore:` commit if the user wants it version-controlled. No risk either way.

**`src/components/workspace/WorkspaceCollectionTiles.jsx`** — false-positive `M`. Re-confirmed this pass (as it was in STAGE A/B): byte-identical to HEAD, zero-line diff, matching byte counts on both sides. Not a real WIP item — nothing to stage, no action needed. Likely a stat-cache/mtime artifact.

**`docs/plan/REPORT-TRADINGBRAIN-AAII-SENTIMENT-SAVE-DATALOSS.md`** — self-contained. Documents a WORK-ID that is **already fully committed** (`bf48c6f`, present in this branch's own commit history, already moved to "Recently resolved" in the ledger). This report file was simply never committed alongside its code fix. Proposed staging: its own trivial docs-only commit whenever convenient (`docs: add closure report for TRADINGBRAIN-AAII-SENTIMENT-SAVE-DATALOSS`) — carries zero code risk.

**`docs/plan/REPORT-TRADINGBRAIN-SAVEDROW-STALE-TAG-ROOTCAUSE.md`** — self-contained. Documents a **negative finding**: no live, storage-backed proof of the reported bug was found; the investigation was blocked by an environment limitation (no available automation profile has completed the governance-gated IndexedDB activation needed for a real round-trip test). No code changes accompany it. Proposed staging: its own docs-only commit, whenever convenient.

---

## Anything that looks abandoned or unowned

- **`feat/gems-phase0-1` branch** (separate worktree, tip `f9586f0`) — a prior session/report claimed this branch is "abandoned by explicit user decision," but the ledger itself flags that claim as **never traceable to an actual commit, doc, or user message**, and a prior `backlog-tracker` pass already had to reinstate this exact row once for the same reason. Do not treat as abandoned without a real, citable user decision.
- **`TRADINGBRAIN-FRESHIMPORT-COST-GUARD`** (Group 2) — substantially complete and tested (clean build, 13/13 QA, 6 live-verified scenarios) but sits with `owner: unassigned` in the ledger. Reads as ready-to-land-soon, not abandoned — just needs someone to own the `git add -p` split and the user's manual QA pass.
- **`scripts/publish-date-header-coverage-qa.mjs`** (Group 4) — `owner: unassigned`, and per this session's fresh finding, now actively incorrect against current HEAD. Reads as drifted/unmaintained rather than actively owned.
- **`.claude/settings.json`** — nobody "owns" this file; it silently accretes debugging-convenience permission entries across many unrelated sessions. Not urgent, but worth naming as an ownerless accumulation pattern if it keeps growing.

No code was staged, committed, or edited while producing this report.
