# TRADINGBRAIN-GEMPICKER-COMPACT-SCORING — Overnight Handoff Report

> Written unattended, without user QA. **Nothing in this document should be read as
> "verified working" from a human's perspective** — every claim below is backed by
> automated checks (build, QA scripts, direct function-level tests against the real
> source) or by direct code reading, never by a human clicking through the UI. The
> user must run the manual QA checklist at the bottom before trusting this in the
> browser.
>
> Status: **UNTESTED BY THE USER. NOT COMMITTED.** See "Git state" below for why.
> This document now covers two overnight rounds — the original one below (Steps A-D,
> the always-compact picker + unclassified string state), and a second round appended
> at the bottom (Step 1: the periodic-summary-misclassified-as-brief fix). Both rounds
> are uncommitted. Read top to bottom; the second round's "Git state" supersedes the
> first's for current status.

WORK-ID: `TRADINGBRAIN-GEMPICKER-COMPACT-SCORING`
Branch: `feat/saved-market-rows-table` (shared worktree)
Written: 2026-09-01 (round 1), updated 2026-09-01 later the same night (round 2)

---

## 0. Pre-flight (before any edit this round)

- Repo/branch/HEAD confirmed: `feat/saved-market-rows-table` @ `46fc6e0` (moved forward from `7f15917` earlier this session via a legitimate human commit, `docs(ledger): retire work-ledger.md, correct Phase 3/4 status` — unrelated to this task, did not touch any file this task owns).
- Dev server on port 5184 confirmed serving this exact worktree (PID 10380, same `vite.js` process observed at the start of every round this session).
- Other sessions confirmed actively editing `VideoDetailPanel.jsx` (session `youtube-mentor-dashboard-c0`, `videoPublishedAt` lines, effort `TRADINGBRAIN-SAVEDROWS-NEWS-FRESHNESS`) and `CLAUDE.md`/`.claude/agents/*` (now committed by the human user in `46fc6e0`, no longer a live concern). None of that was touched.

---

## Step A — compact picker always opens (layout only)

**What changed**: `src/components/dashboard/GemSelectionModal.jsx`. The compact/expanded branch is gone — every video now renders the same structure: recommended GEM (or "ממתין לסיווג") pinned at top via a new `renderCompactTopRow()`, "אפשרויות נוספות" collapsed one click away. The dead "Section 2" expanded-only amber card (which could only ever render when NOT compact) was removed since compact is now unconditional.

**`CLEAR_WINNER_CONFIDENCE_THRESHOLD` (=70)**: repurposed, not retired. It no longer gates layout — it now only decides the confidence badge's styling on the top row (amber "confident" vs. muted-gray "weak match"), via `hasClearWinner()` called from `renderSingleRow`'s new `{ showConfidence }` option.

**Unclassified case**: `renderCompactTopRow()` checks `!recommendedGem` (the `allGems.find()` lookup, which returns `undefined` for a gemKey with no matching row) and renders a distinct, non-interactive placeholder (dashed border, `⏳`, "ממתין לסיווג", "בחר GEM למטה") instead of a button — confirmed by direct reasoning through the render path, not by opening a browser.

**Acceptance criteria — status**:
- Compact opens for every video, every confidence level — met (layout no longer branches on confidence at all).
- Confidence % shown next to the top row — met, via `renderSingleRow`'s badge.
- Unclassified renders sensibly, not empty/broken — met (placeholder row, verified via code trace, not visually).
- **Known, deliberate deviation from "briefs behave exactly as before"**: brief's top row will now show its confidence % too (e.g. "AI מומלץ 97%") since briefs go through the same `renderCompactTopRow()` path and the instruction says "for every video, at every confidence level." This was flagged to the user in the prior turn (before this unattended session began) and never got a live answer. **Needs your eyes in QA step 4 below.**

---

## Step B — `gemKey` becomes the string `"unclassified"`

**What changed**: `src/lib/gemRecommender.js` — new export `UNCLASSIFIED_GEM_KEY = "unclassified"` (single source of truth); `classifyVideoForGem()`'s zero-signal branch now returns `gemKey: UNCLASSIFIED_GEM_KEY` instead of `null`; `resolveWorkflowGemSelection()` now explicitly treats `UNCLASSIFIED_GEM_KEY` as non-selectable and falls through to `"general"` for the *internal* `selected` state, exactly as `null` used to — **this was a real, newly-discovered bug specific to the string swap**: without this fix, `selected` would have been initialized to the literal string `"unclassified"`, which matches no real row, leaving nothing visually highlighted in the expanded options list even though the bottom detail panel showed "כללי" (via a different fallback). Caught during the re-audit, not by the user.

**Consumer re-audit** (every place I'd previously traced for `gemKey`, re-checked against a truthy string instead of falsy `null`):

| Consumer | Behavior with `gemKey=null` (before) | Behavior with `gemKey="unclassified"` (unpatched) | Fix applied? |
|---|---|---|---|
| `GemRecommendationCard`'s `if (!recommendation?.gemKey) return null` | Card hidden | **Card would render** — a fake "GEM מומלץ" card with a "פתח GEM מומלץ" button that tries to open a GEM that doesn't exist | **Yes** — guard now also checks `=== UNCLASSIFIED_GEM_KEY` |
| `handleOpenRecommendedGem`'s `if (!gemKey) return` | No-op | **Would proceed** — copies transcript, calls `getGemUrl("unclassified")` (empty), pops the GEMS settings modal asking the user to configure a URL for a GEM that doesn't exist | **Yes** — same additional check |
| `handleApplyRecommendation`'s `if (!gemRec) return` | Ran, saved `category: null` | Would still run (fields unaffected by the string swap) | **Yes, defensively** — but see note below: **this button has no UI trigger anywhere in the codebase** (verified via repo-wide grep — only a stale comment in `obsidianExport.js` references it). Guard added for whoever eventually wires it up; zero live impact today. |
| `resolveWorkflowGemSelection` | Fell through to `"general"` | **Would select the phantom `"unclassified"` key** (bug described above) | **Yes** |
| `GemSelectionModal`'s `recommendedGem = allGems.find(...)` / `renderCompactTopRow` | `undefined` → placeholder | `undefined` → placeholder (no gem in `allGems` has key `"unclassified"`) | **No fix needed** — already robust by construction |
| `getMarketSubTopicCandidates(gemKey, ...)` | Falls through to default branch | Falls through to same default branch (no branch checks for null/unclassified specifically) | No fix needed — unchanged output |
| `getGemUrl(effectiveGemInfo.gemKey)` (status badge) | `getGemConfigSnapshot()[null]` → falsy | `getGemConfigSnapshot()["unclassified"]` → falsy | No fix needed — same effective outcome |
| Two GEM-indicator badges (`VideoDetailPanel.jsx` ~11398, ~12878) | Show `gemLabel`/`gemIcon` (unaffected by gemKey value) | Same | No fix needed |
| TranscriptGuard market/politics mode forcing | `!MARKET_GEM_KEYS.has(null)` → true, forces fundamental/political | `!MARKET_GEM_KEYS.has("unclassified")` → true, same | No fix needed |
| `subTopicRec.source` diagnostic field | `null` | `"unclassified"` | Cosmetic only, not fixed (diagnostic field, no action taken on it) |

**Least-surprising choice for "Apply recommendation"**: guarded as a no-op for unclassified (matches its existing no-op-for-missing-gemRec behavior) rather than disabled-in-UI or made to save the marker — because there is no UI to disable; this is pure defensive future-proofing.

---

## Step C — same pending state in `gemContentRouter.js`

**What changed**: `src/ai/gemini/gemContentRouter.js`'s `resolveContentClassification()` Phase 4 ("General fallback") now returns `{ contentType: UNCLASSIFIED_GEM_KEY, recommendedGem: UNCLASSIFIED_GEM_KEY, confidence: 'none', confidencePct: 0, source: 'unclassified' }`, importing `UNCLASSIFIED_GEM_KEY` from `gemRecommender.js` (same source of truth as Step B).

**Important, verified finding — read before treating this as "done" in any user-facing sense**: `resolveContentClassification()` (and this entire file's exported API — `CONTENT_TYPE_TO_GEM`, `GEM_PROMPT_CONFIG_TABLE`, `getGeminiDispatchType`, `getGemPromptConfig`, `wrapAsMetadataClassification`, `validateStoredClassification`) has **zero import sites anywhere in `src/`** — repo-wide grep confirms this, and the file's own header comment claiming it's "Used by vite.config.js server handler and analyzeVideoWithGemini.js" is **stale/inaccurate** (`vite.config.js` has no reference to it at all). `scripts/test-morning-brief-routing.mjs` has its own independent hand-copied "minimal" reimplementation, not an import of the real file. **This fix is source-correct but currently affects zero live user-facing behavior.** Logged as a new open ledger item (`needs-user-decision`, owner `gemini-integration-engineer`) rather than silently treated as fully resolved.

No boost-ordering issue existed in this file to fix (unlike `gemRecommender.js`) — `resolveContentClassification()` has no explicit-category-boost step; Phase 2/3 already require a real keyword match before returning, so Phase 4 was already reached only on genuine zero signal. Only the *value* returned needed correcting, not the *order* of checks.

---

## Step D — `feat/gems-phase0-1` abandoned

Cross-session coordination (this session queried `youtube-mentor-dashboard-78` directly, isolated worktree) confirmed a duplicate decision-14 implementation at commit `b8a8d40` on `feat/gems-phase0-1`. Verified independently:
- `git merge-base --is-ancestor b8a8d40 <this-branch|main|origin/main>` → false against all three (diverged base, common ancestor `2888f7a`).
- `git show b8a8d40 -- src/lib/gemRecommender.js` confirms its zero-signal check (`if (top.score === 0)`) runs **after** the category boost — the exact ordering bug this branch's `hadRealKeywordSignal` fixes. Reproduced the consequence against two real videos this session (trading-psychology title, misspelled "פנדמנטלי" title) — that branch's version would still misclassify both.
- Both branches independently converged on the same `gemKey: "unclassified"` string convention — not contradictory, just superseded.

Per instruction: not merged, not rebased, not cherry-picked, not deleted — left alone entirely. Recorded in `docs/open-items-ledger.md`'s "Recently resolved" section so no future session mistakes it for still-relevant unmerged work.

---

## Checks run (all steps, cumulative)

- `node --import ./scripts/register-src-aliases.mjs scripts/brief-gem-selector-qa.mjs` — **pass** (re-verified independently after a false-negative report from an intermediate `backlog-tracker` check — see "Self-correction" below)
- `node --import ./scripts/register-src-aliases.mjs scripts/gems-link-import-routing-qa.mjs` — pass
- `node --import ./scripts/register-src-aliases.mjs scripts/test-morning-brief-routing.mjs` — 88/88 pass
- `npm run build` — clean, exit 0, run after every step
- Direct function-level verification against the real (not mocked) `classifyVideoForGem`, `recommendTjsGemFromTranscript`, `resolveWorkflowGemSelection` for all 5 real cases:

| Case | `gemKey` | `confidencePct` | `recommendedGemKey` reaching the modal |
|---|---|---|---|
| "ניתוח טכני 25" | `technical` | 79 | `technical` |
| Fundamental, correct spelling | `fundamental` | 75 | `fundamental` |
| Psychology video | `macro` | 79 | `macro` |
| Misspelled "פנדמנטלי" | `unclassified` | 0 | `unclassified` |
| Brief | `marketBrief` | 97 | `marketBrief` |
| `resolveWorkflowGemSelection` for unclassified, no saved key | — | — | falls through to `"general"` (fixed bug, see Step B) |
| `resolveWorkflowGemSelection` for unclassified, saved="political" | — | — | `"political"` (saved key still wins) |

**What this table does NOT prove**: none of this was run in a browser. No screenshot exists. No human clicked anything. These are Node-level function calls against the real source files via the project's existing `scripts/register-src-aliases.mjs` loader — the same technique the project's own `*-qa.mjs` scripts use, but it is not equivalent to opening `localhost:5184` and looking at the modal.

## Correction rounds
- Step B/C: 0 code-defect correction rounds (all fixes were found via proactive re-audit before running anything, not via a failing check).
- **1 process-integrity correction**: a `backlog-tracker` invocation reported `scripts/brief-gem-selector-qa.mjs` as failing against stale/superseded assertions. I re-ran the exact command myself immediately and got a clean pass, re-invoked `backlog-tracker` with that direct evidence, it independently re-verified and confirmed my result, and removed its own incorrect ledger row (logged under "Recently resolved" as *removed*, not "resolved", since the row was never accurate). No code was affected by this — it was a ledger-accuracy issue only, but is recorded here because it directly bears on whether you can trust anything else in the ledger from this session without spot-checking.

## Risks
1. **Brief's new confidence-% badge** — flagged twice now, never confirmed by a human. See QA step 4.
2. **`gemContentRouter.js` fix has no live consumer** — correct in isolation, doesn't change any real user-facing behavior today. If something is later wired to it, that's the point it starts mattering.
3. **Two previously-logged, still-open, not-fixed gaps** (unchanged from before this round): `TJS_GEM_KEYWORDS.dayTrading`'s bare Hebrew words remain a systematic false-winner risk for the TJS accordion's own score display (separate from the `recommendedGemKey` arbitration, which is fixed); Hebrew spelling variants (e.g. `פנדמנטלי`/`פונדמנטלי`) are still unhandled — a differently-misspelled title will still land on `unclassified` rather than the correct GEM. Both `needs-user-decision`, logged in the ledger.
4. **Everything above is unverified by a human.** Restating this because it's the single most important caveat in this document.

## Git state

**Before this round**: `git status --short` showed my 6 files (`gemRecommender.js`, `GemSelectionModal.jsx`, `brief-gem-selector-qa.mjs`, `docs/open-items-ledger.md`, plus this round's new touches to `gemContentRouter.js` and `GemRecommendationCard.jsx`) alongside `VideoDetailPanel.jsx` (shared) and a cluster of files belonging to `TRADINGBRAIN-SAVEDROWS-NEWS-FRESHNESS` (`package.json`, `SaveToWorkspaceDialog.jsx`, `WorkspaceFocusedVideoCard.jsx`, `WorkspaceSaveReviewOverlay.jsx`, `WorkspaceLibrary.jsx`, `workspaceSavedAnalysis.js`, two `*-qa.mjs` scripts) and `.claude/settings.json` (pre-existing, unrelated to anyone this session).

**Commit attempt**: staged the 6 unambiguously-mine files with one explicit `git add <file> <file> ...` (no wildcards, no `-A`, no `-u`, no `.`). **`git status` immediately after showed every other session's file staged too** — `package.json`, all the `workspace/*` files, both extra `*-qa.mjs` scripts — none of which I listed. This repo has no `git add` alias and no active hooks (checked `.git/hooks/`, only `.sample` files present), ruling out a local misconfiguration explanation. The only remaining explanation is a concurrent `git add` from another session on this same shared worktree (this worktree has one `.git/index` shared by every session working in this directory — a `git add` from any of them mutates the same file my `git add` was reading/writing at the same moment) landing in the same window as mine.

**Action taken**: `git reset` immediately (index-only operation, confirmed via `git status` afterward that every file reverted to exactly its pre-staging state — nothing was lost, nothing was committed, no one's work was touched).

**Decision: did not commit.** Per your explicit instruction, this is the correct outcome when clean hunk-level (or even clean whole-file) staging can't be guaranteed safe — and this session just produced direct, reproducible proof that it can't be guaranteed right now, on this worktree, while other sessions are active. Retrying carries the same risk again, possibly at a worse moment (mid-`git add -p`, or between staging and the `commit` call itself, which git also can't make atomic against a concurrently-mutated index). **All work described in this report is uncommitted, unpushed, sitting in the working tree only.**

**Update, after this report was first written**: `youtube-mentor-dashboard-94` committed the `TRADINGBRAIN-SAVEDROWS-NEWS-FRESHNESS` work as `a7536c0` (on top of `46fc6e0`), using a manually-built `git apply --cached` patch (not `git add -p`) because one hunk was too interleaved for a normal split. HEAD is now `a7536c0`. Verified independently after their commit:
- `git log --oneline -3` → `a7536c0` → `46fc6e0` → `7f15917`, confirming the commit landed on this same branch/worktree.
- Their 8 files (`package.json`, both `*-qa.mjs` scripts, all 4 `workspace/*` files, `WorkspaceLibrary.jsx`, `workspaceSavedAnalysis.js`) no longer show as modified/untracked.
- `git diff --ignore-all-space --ignore-blank-lines -- VideoDetailPanel.jsx` now shows **zero** occurrences of `videoPublishedAt` — their 3 lines are committed, mine are not swept in.
- My 5 fully-mine files still show the **exact same diff size** as before their commit (207 insertions / 107 deletions total, unchanged) — nothing of mine was lost, altered, or absorbed.
- Re-ran `npm run build` and `brief-gem-selector-qa.mjs` against the new HEAD — both still pass.

**No rebase was needed or performed**: I have zero local commits on this branch — everything of mine is uncommitted working-tree changes, which `git diff`/`git status` already compare against whatever HEAD currently is. There was nothing to replay.

**Current status** (paste-verified after `a7536c0` landed):
```
 M .claude/settings.json                              ← not mine, pre-existing
 M docs/open-items-ledger.md                           ← mine (via backlog-tracker)
 M scripts/brief-gem-selector-qa.mjs                   ← mine
 M src/ai/gemini/gemContentRouter.js                   ← mine
 M src/components/dashboard/GemRecommendationCard.jsx  ← mine
 M src/components/dashboard/GemSelectionModal.jsx      ← mine
 M src/components/dashboard/VideoDetailPanel.jsx       ← now entirely mine (their videoPublishedAt lines are committed, no longer part of this diff)
 M src/lib/gemRecommender.js                           ← mine
?? docs/plan/REPORT-TRADINGBRAIN-GEMPICKER-COMPACT-SCORING.md ← this file
```
**This is now a materially simpler staging situation than when the failed attempt happened**: `VideoDetailPanel.jsx` is no longer shared — every remaining modified file in the working tree is mine except `.claude/settings.json` (pre-existing, unrelated, leave alone). A future staging attempt (human, or a session confirmed to have exclusive git-index access at that moment) could reasonably stage every file above **except** `.claude/settings.json` as a single clean commit — still worth doing one `git status` immediately before and after to confirm no other session has started concurrent work in the meantime.

## Rollback

Nothing to roll back — nothing was committed. If the *working-tree* changes need discarding: `git diff -- <file>` per file listed as "mine" above isolates exactly this session's changes; `git checkout -- <file>` reverts one at a time. Do **not** run any blanket discard command (`git checkout .`, `git clean`) on this shared worktree — it would destroy other sessions' uncommitted work too.

## Next step

1. A human (or a session with confirmed exclusive access to this worktree's git index) needs to re-attempt staging — by hunk for `VideoDetailPanel.jsx`, whole-file for the other 6 — when no concurrent `git add`/`commit` activity is happening elsewhere on this worktree.
2. Run the manual QA checklist below in a real browser first — this report is not a substitute for that.
3. Resolve the brief-badge-percentage question (risk #1) before or during that QA pass.
4. The three still-open, `needs-user-decision` ledger items (dayTrading false-winner, Hebrew spelling variants, `gemContentRouter.js` dead code) are unaffected by any of tonight's work and remain for a future session.

---

---

# Round 2 (later the same night) — periodic summary misclassified as brief

> Same caveat as round 1: **nothing below was seen by a human**. Build/QA/direct
> function-level verification only.

## What changed

**File**: `src/lib/gemRecommender.js` only — `GEM_RULES.news` and `GEM_RULES.macro`, plus a small new generic mechanism (`rule.titlePatterns`, an array of regexes scored alongside the existing plain-keyword lists). No layout, compact-picker, 60%-arbitration, or unclassified-state code touched, per instruction.

**Root cause** (verified empirically, not just by inspection — see "before/after scores" below): `GEM_RULES.news.transcriptKeywords` duplicated a large chunk of `GEM_RULES.macro`'s own vocabulary — `fed`, `interest rate`, `inflation`, `gdp`, `cpi`, `macro`, `economic data`, `jobs report`, `unemployment`, `consumer price` all appeared in *both* rules' lists (`news.topicKeywords` also had a bare `"macro"` entry). Any macro-topic-heavy content — including a periodic (monthly/quarterly/annual) retrospective — scored on both rules almost equally, and news's own recap-framing words (`market recap`, `market wrap`, `today in markets`) tipped the balance toward "news" (a daily brief label) even for content that was never daily.

**Fix, two parts**:
1. Removed the 10 macro-topic duplicate words from `news.transcriptKeywords` and the bare `"macro"` from `news.topicKeywords`. What's left in `news` is purely cadence/format language (`morning brief`, `daily update`, `premarket`, `this week`, `market recap`, `today in markets`, `market wrap`) — a daily brief should win on *when/how often*, not on *what economic topic it discusses*, since macro already owns that topic.
2. Added periodic-retrospective coverage to `macro`: Hebrew phrases for monthly/quarterly/annual summaries (`סיכום חודש/חודשי`, `סיכום רבעון/רבעוני`, `סיכום שנתי/שנה`, `מבט לחודש/לשנה`) in both `titleKeywords` and `transcriptKeywords`, plus a new `titlePatterns: [/\d+\s*שנ(ה|ים)\s*ל/]` regex on the `macro` rule specifically, wired into the scoring loop generically (any rule can declare `titlePatterns`, only macro does today) — this covers "N שנה/שנים ל..." anniversary-retrospective titles ("50 שנה לסנפ 500", "10 שנים למשבר") generically rather than only the one exact title from the bug report, per instruction.

## Acceptance criteria — status

| Criterion | Status |
|---|---|
| Monthly-summary video → macro | **Met** — verified via direct function call, both title-only and with a realistic transcript |
| Genuine morning/evening briefs unaffected | **Met** — they resolve via `preGemClassifier`'s title-override path (97%, unconditional), which never reaches `GEM_RULES.news` scoring at all, so this fix cannot touch them structurally |
| GEM_RULES.news's *own* scoring (for daily-brief-like content that doesn't hit title-override) still wins comfortably | **Met** — verified with a synthetic but representative daily-brief transcript, see table below |
| Technical/fundamental/psychology/signal-free unaffected | **Met** — all four re-verified, identical scores to before tonight's change |
| Monthly/quarterly/annual/"N years to X" retrospectives generalize beyond the one reported title | **Met** — keyword phrases for monthly/quarterly/annual, plus a regex for the N-years-to-X pattern, not just the literal reported phrasing |

## Before/after scores (direct function-level verification, `classifyVideoForGem`)

| Case | Before tonight | After tonight |
|---|---|---|
| Monthly S&P 500 anniversary/summary video, title only | `news` / **69%** (reported bug; my own repro with a synthetic transcript got 75%, close enough to confirm the mechanism) | `macro` / **75%** |
| Same video, with a realistic transcript | `news` / 75% (my repro) | `macro` / **76%** |
| Genuine "מבזק בוקר 15.8.26" (title-override path) | `marketBrief` / 97% | `marketBrief` / **97% — unchanged** |
| Genuine "מבזק ערב 15.8.26" (title-override path) | `marketBrief` / 97% | `marketBrief` / **97% — unchanged** |
| Daily-brief-like content *without* an override-pattern title, realistic daily transcript (tests `GEM_RULES.news` scoring directly, not the title-override shortcut) | not tested before tonight | `news` / **75%** — still a clear, comfortable win |
| "ניתוח טכני 25" | `technical` / 79% | `technical` / **79% — unchanged** |
| Fundamental, correct spelling | `fundamental` / 75% | `fundamental` / **75% — unchanged** |
| Psychology video | `macro` / 79% | `macro` / **79% — unchanged** |
| Signal-free | `unclassified` / 0% | `unclassified` / **0% — unchanged** |

I could not test against the *real* stored transcript for the actual reported video (no database access from this session) — the 69%→75% starting-point gap above is my synthetic transcript vs. whatever the real one contains. The mechanism (macro-topic word duplication between `news` and `macro`) is confirmed structurally, not just numerically, so this should hold for the real transcript too, but the exact percentage may differ slightly.

## Checks run (round 2)
- `node --import ./scripts/register-src-aliases.mjs scripts/brief-gem-selector-qa.mjs` — pass
- `node --import ./scripts/register-src-aliases.mjs scripts/gems-link-import-routing-qa.mjs` — pass
- `node --import ./scripts/register-src-aliases.mjs scripts/test-morning-brief-routing.mjs` — 88/88 pass
- `npm run build` — clean, exit 0
- Direct function-level verification script against the real `classifyVideoForGem`/`preGemClassifier`/`isMarketBriefWorkflowVideo` for all 8 rows in the table above

## Correction rounds
0. The fix worked on the first attempt and passed every check without needing adjustment.

## Risks (round 2, additive to round 1's risks — all of which still stand, unaffected)
- The `titlePatterns` regex is new scoring infrastructure (small, generic, but new) — low risk given only one rule uses it and it's narrowly scoped (requires a digit + שנה/שנים + ל), but worth knowing it exists.
- I could not verify against the real video's actual stored transcript (see note above) — the fix is verified structurally and against realistic synthetic content, not the exact real-world data point from the bug report.
- `news`'s remaining keyword set is now smaller — if a genuine daily brief's real content relies heavily on macro-topic words (fed/inflation/gdp) *and* weakly on the remaining cadence words, its score could be somewhat lower than before for that one video, even though the tested representative case still wins comfortably (75%). Worth watching in QA.

## Git state (round 2 — supersedes round 1's git-state section for "what's committed")

**Step 3 (commit attempt) result: did not commit.** Per instruction, before staging I re-ran `git status` and compared against the round-2 baseline snapshot taken at the start of tonight's work. It showed `src/pages/Dashboard.jsx` newly modified (not in the baseline) and the round-1 debug `.txt` dump files gone — clear signs of live concurrent activity (session `youtube-mentor-dashboard-dc`, working on an unrelated deep-link regression fix, per their own cross-session message earlier tonight). Per instruction ("wait, retry once later, and if it is still moving, do not commit"), I waited 90 seconds via a monitored check and re-compared: **still changing** — a new untracked file (`scripts/return-to-analysis-deeplink-qa.mjs`) had appeared in that window. I did not attempt a third check or push further; per instruction, this means: **do not commit.**

**Current `git status --porcelain=v1`** (at the end of round 2, HEAD still `a7536c0`, unchanged all night):
```
 M .claude/settings.json                              ← not mine, pre-existing
 M docs/open-items-ledger.md                           ← mine (via backlog-tracker)
 M scripts/brief-gem-selector-qa.mjs                   ← mine
 M src/ai/gemini/gemContentRouter.js                   ← mine
 M src/components/dashboard/GemRecommendationCard.jsx  ← mine
 M src/components/dashboard/GemSelectionModal.jsx      ← mine
 M src/components/dashboard/VideoDetailPanel.jsx       ← mine
 M src/components/workspace/WorkspaceFocusedVideoCard.jsx ← not mine (session -dc, active tonight)
 M src/lib/gemRecommender.js                           ← mine (round 1 + round 2 combined)
 M src/pages/Dashboard.jsx                              ← not mine (session -dc, active tonight)
 M src/pages/WorkspaceLibrary.jsx                       ← not mine (session -dc)
?? docs/plan/REPORT-TRADINGBRAIN-GEMPICKER-COMPACT-SCORING.md ← this file
?? docs/plan/REPORT-UNATTENDED-SAFETY-SWEEP.md          ← not mine (another session's own overnight report)
?? docs/qa/                                              ← not mine
?? scripts/pinned-recent-video-card-qa.mjs               ← not mine
?? scripts/publish-date-header-coverage-qa.mjs           ← not mine
?? scripts/return-to-analysis-deeplink-qa.mjs            ← not mine
```
**No commit SHA was created tonight.** HEAD is still `a7536c0`, exactly where round 1 left it. All of round 1 and round 2's work remains uncommitted, in the working tree only.

## Rollback (round 2)
Nothing to roll back — nothing committed. `git diff -- src/lib/gemRecommender.js` isolates all of tonight's (round 1 + round 2) changes to that one file; the round-2-only hunks are the `GEM_RULES.news`/`GEM_RULES.macro` blocks and the `titlePatterns` scoring-loop addition, easily distinguishable in the diff by the comments explaining them.

## Next step
1. Same as round 1's next step — needs a human, or a session confirmed to have exclusive git-index access at that moment, to stage and commit. Given tonight's evidence, that moment clearly wasn't overnight while multiple sessions were active — check in daylight when the worktree is quieter.
2. Run the updated manual QA checklist below in a real browser.
3. Everything from round 1's "Next step" list still applies unchanged (brief-badge-percentage question, the three still-open ledger items).
4. New ledger item from tonight (Step 4): the two-incomparable-scoring-systems UI-clarity issue (classifier % in the top row vs. TJS recommender % in the accordion) — `needs-user-decision`, owner `frontend-rtl-developer`. Not fixed, per instruction.

---

## Manual QA checklist — localhost:5184 (do this before trusting anything above — covers both rounds)

1. וידאו **סיכום חודשי/רבעוני/שנתי או "N שנה ל..."** (כמו "חמישים שנה לסנפ 500 וסיכום חודש אוגוסט") → ודא שהוא נופל תחת **"מאקרו ושוק"**, לא "מבזק בוקר".
2. וידאו **מבזק בוקר אמיתי** (עם "מבזק בוקר" בכותרת) → ודא שהוא עדיין נופל תחת "מבזק בוקר/ערב" בביטחון גבוה (97% אם האחוז מוצג — ראה סעיף 5 למטה).
3. וידאו **מבזק ערב אמיתי** → אותו דבר.
4. וידאו טכני מובהק ("ניתוח טכני 25" או דומה) → מצומצם, "טכני" למעלה, ~79%+.
5. וידאו פונדמנטלי עם איות תקין → מצומצם, "פונדמנטלי" למעלה, ~75%+.
6. וידאו ללא שום אות סיווג (כותרת ותמלול גנריים) → "ממתין לסיווג", ללא preselection, לא קריסה.
7. **קריטי (מסבב 1, עדיין פתוח)** — בווידאו המבזק מסעיף 2/3: בדוק אם "97%" מופיע ליד "AI מומלץ" בשורה העליונה — תוספת חדשה שטרם אושרה; אם מפריעה, יש לדווח.
8. וידאו רגיל לא-שוק-הון (בריאות/פוליטי) → ללא רגרסיה.
9. פתח את ה-Console ובדוק שאין שגיאות JS חדשות סביב פתיחת/סגירת חלון בחירת GEM.
10. אם יש גישה ל-Git — ודא ש-`git status` נראה בדיוק כמו ברשימה בסעיף "Git state" (round 2) למעלה לפני כל staging/commit עתידי, ובדוק שוב לפני, כי סשנים אחרים היו פעילים כל הלילה.
