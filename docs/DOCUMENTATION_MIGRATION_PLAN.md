# Documentation Migration Plan

Tracks the six-phase Markdown cleanup proposed in the repo-wide documentation audit. Each phase
requires **separate, explicit approval** before it begins — completing one phase is not
authorization to start the next.

**Source audit:** full file-by-file findings (69 files, duplication map, per-file risk ratings)
were produced before this plan and are not duplicated here. This document tracks phase status,
approvals, and rollback notes only.

---

## Phase status

> **Naming note:** the original 6-phase plan below already uses "Phase 4" for
> `AI_DEVELOPMENT_GUIDE.md` condensation (row `4`). A separate, later audit of Claude Code
> rules/governance/memory/skills/commands/hooks was also informally called "Phase 4" when
> requested — to avoid colliding with the row below, it is tracked here as **`4-CC`** (Claude Code)
> with sub-items `4-CC-A`/`4-CC-B`/`4-CC-C`. The original row `4` is unrelated and unchanged.
>
> The same collision recurs at "Phase 5": row `5` below is the original small-rule-consolidation
> item. A separate, later request for a full Markdown archive-eligibility audit was also informally
> called "Phase 5" — to avoid collision it is tracked here as **`5-ARCH`**, with implementation
> sub-item **`5-ARCH-A`**. The original row `5` is unrelated and unchanged.

| Phase | Description | Status | Approved on |
|---|---|---|---|
| 0 | Verification — confirm which "closed" bugs/reports are actually resolved in the live app before archiving them | Partially covered by Phase 2's code-level (non-live) checks; live-app QA still not started | — |
| 1 | Additive only: `docs/INDEX.md`, `docs/STATUS.md`, `docs/archive/README.md`, this file, one-line addition to `START_HERE.md`. No deletions, moves, merges, or edits to existing rule content. | **Completed** — commit `6481db3` on `docs/markdown-governance-cleanup`, pushed to `origin/docs/markdown-governance-cleanup` | 2026-07-26 |
| **2** | **Verify & refresh status docs: cross-check `docs/STATUS.md` / `PROJECT_STATUS.md` / `docs/governance/CURRENT_STATE_JUNE_2026.md` / `docs/workspace-session-handoff.md` against the actual codebase; refresh `docs/STATUS.md` with verified findings; add deprecation notices (not archiving) to the two stale status files, content otherwise preserved.** | **Completed** (this scope only — archiving the two stale files is deferred to a future phase/decision, not done here) | 2026-07-26 |
| **3** | **Duplicated active documentation & governance rules** — broader in scope than originally previewed below: covers `AGENTS.md`/`docs/workflow.md` duplication, the GEM "title override" rule (restated in 2 files, plus a non-identical code-level duplication), the 5 legacy documentation indexes, and `CLAUDE_CODE_GOVERNANCE_MODE.md`'s enforcement gap. | **Audit completed** 2026-07-26 (read-only, no files changed). Split into sub-phases below for implementation. | — |
| 3A | Consolidate documentation entry points — deprecation notices on the 5 legacy indexes + `START_HERE.md` rewrite | **Completed** | 2026-07-26 |
| 3B | `AGENTS.md` / `docs/workflow.md` consolidation — `AGENTS.md` established as canonical cross-agent workflow document; `docs/workflow.md` retained as deprecated historical reference | **Completed** | 2026-07-26 |
| 3C | GEM "title override" architecture audit — determine the source of truth between `gemRecommender.js` and `gemContentRouter.js` before touching code or docs | **Completed — architecture decision and documentation.** `gemRecommender.js` is authoritative/active; `gemContentRouter.js` is dormant, retained, not deleted. See `docs/adr/ADR_TITLE_OVERRIDE_SOURCE_OF_TRUTH.md`. | 2026-07-26 |
| 3C-1 | Document the verified title-override architecture — correct the 2 rule docs, add the ADR, no code touched | **Completed** | 2026-07-26 |
| 3C-2 | *(optional, separately gated)* Correct the stale "used by..." claim in `gemContentRouter.js`'s header comment | Not started — optional source-comment correction requiring a separate approval gate | — |
| 4 | `AI_DEVELOPMENT_GUIDE.md` condensation — remove self-declared-obsolete §24/§26/§29 fragments, template repeated per-category boilerplate | Proposed, not approved | — |
| 5 | Small-rule consolidation — merge remaining overlapping pairs (Chapters-priority, Sector-Finviz, Perplexity-routing, Morning-Brief sub-rules, 3-way "title override" restatement) into `.claude/rules/` | Proposed, not approved | — |
| **4-CC** | **Claude Code rules/governance/memory/skills/commands/hooks audit** — determined only `.claude/settings.json` has real enforcement; `CLAUDE_CODE_GOVERNANCE_MODE.md` confirmed still unenforced; only `SKILL.md` in the repo is in an unrecognized location; found `MASTER_PROJECT_BIBLE.md` still referenced the now-deprecated `docs/workflow.md` as active. | **Audit completed** 2026-07-26 (read-only, no files changed). Split into sub-items below. | 2026-07-26 |
| 4-CC-A | Correct the stale canonical-workflow reference in `docs/governance/MASTER_PROJECT_BIBLE.md` | **Completed** | 2026-07-26 |
| 4-CC-B | Governance-mode rewrite — `docs/governance/CLAUDE_CODE_GOVERNANCE_MODE.md` reframed in place as an optional, explicitly-invoked governance guide; no longer claims to be automatically active or enforced | **Completed** — audit + implementation, commit pending on `docs/phase4cc-b-governance-mode-rewrite` | 2026-07-26 |
| 4-CC-C | First `.claude/rules/` extraction pilot (candidate: GEM classification/routing, given its fresh ADR from Phase 3C) | Not started — separate approval gate | — |
| — | Settings/permissions hardening (3 wildcard `Bash` patterns, blanket `git commit`/`git stash` allow, `additionalDirectories` scope) — flagged by the 4-CC audit, not a numbered sub-phase | Not started — separate approval gate, no specific change recommended yet | — |
| **5-ARCH** | **Documentation archive-eligibility audit** — classified all 72 repo Markdown files into 6 categories (Safe to archive / Archive after verification / Keep active / Keep as historical evidence / Phase 6 deletion candidate / Protected). Read-only; ran in an isolated worktree on branch `audit/phase5-documentation-archive`, based on verified commit `d526b1e`. | **Audit completed** 2026-07-26 (read-only, no files changed). Result: 1 file safe to archive now, 13 files deferred pending verification (see audit artifact for the per-file list), 0 approved deletion candidates. | 2026-07-26 |
| 5-ARCH-A | Archive the single approved "safe to archive now" file (`docs/session-closures/SESSION_CLOSURE_PUSH_2026-07-02.md`) only — the 13 deferred candidates are explicitly out of scope for this sub-phase and remain pending their listed verification steps. | **Completed** — commit pending on `docs/phase5a-single-safe-archive` (worktree, based on `origin/chore/claude-permissions-hardening` @ `d526b1e`) | 2026-07-26 |
| 6 | Deletion of confirmed-redundant documents (candidates identified by 5-ARCH's audit) | **Not started.** 5-ARCH's audit approved zero deletion candidates — every near-duplicate examined retained some unique historical value or an active reference. Phase 6 has no approved scope yet. | — |

---

## Phase 1 — what this phase does and does not do

**Does:**
- Adds `docs/INDEX.md` (new canonical index, informational only — flags known duplicates without resolving them).
- Adds `docs/STATUS.md` (verified git/repo state as of 2026-07-26 — see file for exact verification method).
- Adds `docs/archive/README.md` (policy for a currently-empty directory).
- Adds this file.
- Adds one line to `docs/START_HERE.md` linking to `docs/INDEX.md`.

**Does not:**
- Delete, move, rename, merge, condense, or archive any existing Markdown file.
- Modify `CLAUDE.md`, `AGENTS.md`, `SKILL.md`, or any file under `docs/governance/`.
- Touch any application source, config, or package file.
- Resolve the "title override" rule triple-duplication.
- Create any `@import` or new `.claude/rules/*` file.

**Pre-flight check performed before this phase:** working tree contained unrelated, uncommitted
application-code changes (7 `src/` files) belonging to concurrent sessions documented in
`docs/workspace-session-handoff.md`, plus 12 unpushed local commits. Per explicit user instruction,
this was flagged and confirmed before proceeding — see `docs/STATUS.md` for the full inventory.
This phase's branch and commit touch only the 5 files listed above; the pending `src/` changes are
untouched and remain uncommitted exactly as found.

**Risk:** Low. All changes are new files or a single-line addition to an existing file; nothing
that other code or sessions currently depend on is altered.

**Rollback:** `git revert` the Phase 1 commit, or `git branch -D docs/markdown-governance-cleanup`
before merge — no other branch or file depends on this branch's existence.

---

## Phase 2 — what this phase did and did not do

Executed in an isolated worktree (`docs/phase2-status-refresh`, branched from the pushed
`origin/docs/markdown-governance-cleanup`), never touching the original repo's dirty working
directory.

**Did:**
- Cross-checked `docs/STATUS.md`, `PROJECT_STATUS.md`, `docs/governance/CURRENT_STATE_JUNE_2026.md`,
  and `docs/workspace-session-handoff.md` against `package.json`, `src/pages.config.js`, and a
  targeted grep of the source tree (see `docs/STATUS.md` "Phase 2 findings" section for the full
  settings-drift table and the 4-gate code-level check).
- Refreshed `docs/STATUS.md` with those verified findings, clearly separating "verified", "code
  evidence but not live-QA'd", and "not verified — needs live app testing."
- Added a short deprecation notice (pointer to `docs/STATUS.md`) to the top of `PROJECT_STATUS.md`
  and `docs/governance/CURRENT_STATE_JUNE_2026.md`. All original content in both files is preserved
  unchanged below the notice.
- Read `docs/workspace-session-handoff.md` in full (both the 323-line committed version in this
  worktree and the fuller 633-line uncommitted version from the original directory) without
  modifying, moving, condensing, or archiving it.

**Did not:**
- Archive, move, delete, or merge `PROJECT_STATUS.md` or `CURRENT_STATE_JUNE_2026.md` — only a
  notice was added; the original "archive the two originals" idea from this plan's first draft is
  deferred to a later, separately-approved step.
- Run the app or a browser — the 4 old release gates (CH-1/MB-2/MB-3/MB-4) are only checked at the
  static-code level; live behavior remains unverified (see `docs/STATUS.md`).
- Modify `CLAUDE.md`, `AGENTS.md`, source code, config, or package files, even though a concrete
  settings discrepancy was found in `backend/analyze-video.function.js` (see `docs/STATUS.md`) —
  reported only, not fixed.
- Touch any file belonging to the concurrent sessions' uncommitted work in the original directory —
  this phase ran entirely in a separate worktree that never had that working tree state.

**Risk:** Low. Two files gained a short notice at the top with all other content byte-for-byte
preserved below it; `docs/STATUS.md` gained new sections, no deletions.

**Rollback:** `git revert` the Phase 2 commit — fully restores `PROJECT_STATUS.md` and
`CURRENT_STATE_JUNE_2026.md` to their pre-notice state and `docs/STATUS.md` to its Phase-1 content.

## Phase 3 — audit findings and sub-phase breakdown

Full duplication matrix, exact file:line quotes, and per-topic risk ratings live in the Phase 3
audit report (produced 2026-07-26, read-only, in worktree `docs/phase3-duplication-audit`). Summary:

1. **`AGENTS.md` ≡ `docs/workflow.md`** — confirmed byte-identical (117 lines, zero `diff` output).
   Both are stale subsets of `CLAUDE.md` (missing its Ollama-processing and locked-AI-settings
   sections). Recommendation is asymmetric: `AGENTS.md` is kept as a distinct file because its
   filename is a recognized convention for non-Claude-Code tools; `docs/workflow.md` has no such
   justification. → **Phase 3B** (see below).
2. **GEM "title override" rule** — fully restated (not just referenced) in exactly 2 files:
   `docs/GEM_CONTENT_CLASSIFICATION_RULES.md` (canonical candidate) and
   `docs/GEMS_TAB_MAPPING_REGRESSION_RULES.md`. A **code-level** duplication was also found:
   `TITLE_OVERRIDE_RULES` is independently defined (non-identically) in `src/lib/gemRecommender.js`
   (active) and `src/ai/gemini/gemContentRouter.js` (exported, confirmed unimported anywhere). The
   documentation asserted the two must stay "aligned," which had no runtime effect while one copy
   is dead code. → **Resolved by the Phase 3C architecture audit**: `gemRecommender.js` is the
   verified active/authoritative implementation; `gemContentRouter.js` is verified dormant (not
   imported anywhere, and its own header comment's claim of being used by `vite.config.js` /
   `analyzeVideoWithGemini.js` is false — see the ADR for the full call-graph evidence). Documented
   in Phase 3C-1; no source-code change made or required for the active path.
3. **5 legacy documentation indexes** (`PROJECT_DOCUMENTATION_AUDIT.md`, `PROJECT_DOCUMENTATION_INDEX.md`,
   `PROJECT_MARKDOWN_FILE_INDEX.md`, `PROJECT_MD_INDEX.md`, `HEBREW_DOCUMENTATION_CATALOG.md`) plus
   `docs/START_HERE.md` presenting two competing entry points. → **Phase 3A**, this pass.
4. **`docs/governance/CLAUDE_CODE_GOVERNANCE_MODE.md`** — declares itself "active at all times" with
   no actual loading mechanism (no `@import`, not in `.claude/rules/`, absent from
   `MASTER_PROJECT_BIBLE.md`'s own governance index). Three resolution options identified (fold into
   `CLAUDE.md`, reframe as opt-in, or build real enforcement) — **no sub-phase started**; needs your
   decision first, since folding it into `CLAUDE.md` changes what loads every session.

### Phase 3A — consolidate documentation entry points (this commit)

**Does:** adds a short, non-destructive deprecation notice (pointing to `docs/INDEX.md`) to the top
of each of the 5 legacy index files, with all original content preserved unchanged below; rewrites
`docs/START_HERE.md`'s top section so `docs/INDEX.md` is the sole stated entry point instead of two
competing ones, correcting the links inside that rewritten section to resolve correctly from
`docs/START_HERE.md`'s actual location.

**Does not:** touch `AGENTS.md`, `docs/workflow.md`, any title-override documentation,
`docs/governance/CLAUDE_CODE_GOVERNANCE_MODE.md`, `CLAUDE.md`, or any file outside the 7 listed above.
Does not delete, archive, rename, or move any file. `docs/START_HERE.md`'s topic-shortcut sections
(Morning Brief / Chapters / Obsidian / Brain / UI / Architecture) were left untouched — their
pre-existing broken relative links predate this phase and fixing them was out of this phase's scope.

**Risk:** Low. Every legacy-index change is a short prepended notice; `START_HERE.md`'s change
replaces one small block (the old "חובה לקרוא" list) rather than the whole file.

**Rollback:** `git restore` the exact 6 changed files listed in the commit before commit; `git revert`
the Phase 3A commit after.

### Phase 3B — establish the canonical agent workflow document (this commit)

Re-verified before editing: `AGENTS.md` and `docs/workflow.md` are still byte-identical (117 lines,
zero `diff` output) — unchanged since the Phase 3 audit.

**Does:** keeps `AGENTS.md` as the canonical cross-agent workflow document (no edit made to it);
adds a short deprecation notice to the top of `docs/workflow.md` pointing to `../AGENTS.md`, with all
existing content preserved unchanged below; updates `docs/INDEX.md`'s "Workflow / setup" section (and
aligns its "Root-level reports" `AGENTS.md` entry) so active workflow guidance points to `AGENTS.md`.

**Does not:** modify `AGENTS.md` or `CLAUDE.md`; touch title-override documentation/code,
`docs/governance/CLAUDE_CODE_GOVERNANCE_MODE.md`, `.claude/rules/`, application code, or config;
delete, move, rename, or archive any file.

**Risk:** Low. `docs/workflow.md` gains a short prepended notice, all prior content preserved below
it; `docs/INDEX.md` gains a new line plus a short wording adjustment to one existing line.

**Rollback:** `git restore` the exact files changed in this commit; `git revert` the Phase 3B commit
after.

### Phase 3C — title-override architecture audit (completed, read-only) + Phase 3C-1 (this commit)

**Audit (completed 2026-07-26, read-only, zero files changed):** traced the full runtime call graph
for GEM title-override classification. Verified `src/lib/gemRecommender.js`'s `preGemClassifier`
(called from `VideoDetailPanel.jsx`'s `gemRec` useMemo) is the sole active path. Verified
`src/ai/gemini/gemContentRouter.js` is unimported anywhere — and that its own header comment's claim
of being used by `vite.config.js` and `analyzeVideoWithGemini.js` is false on both counts (neither
imports it; `analyzeVideoWithGemini.js` is itself dead code). Verified
`scripts/test-morning-brief-routing.mjs` imports neither real file, validating hand-copied
reimplementations instead. Full findings, rule-by-rule comparison, and 4 architecture options are in
the standalone audit report (not committed to the repo).

**Decision approved:** Option A — `gemRecommender.js` is authoritative/active;
`gemContentRouter.js` is dormant legacy/scaffolding, retained (not deleted), pending a separate
lifecycle decision. No source-code change required or made for the active runtime path.

**Phase 3C-1 (this commit) does:** corrects `docs/GEM_CONTENT_CLASSIFICATION_RULES.md` and
`docs/GEMS_TAB_MAPPING_REGRESSION_RULES.md` to state the verified active/dormant split instead of
claiming both modules are active and must stay synchronized; corrects the claim that
`scripts/test-morning-brief-routing.mjs` verifies production behavior; adds
`docs/adr/ADR_TITLE_OVERRIDE_SOURCE_OF_TRUTH.md` recording the decision, verified facts,
alternatives considered, consequences, deferred work, and rollback considerations; adds one link to
the ADR in `docs/INDEX.md`.

**Phase 3C-1 does not:** modify any file under `src/` (including `gemContentRouter.js`'s stale header
comment — tracked separately as Phase 3C-2, its own approval gate), `scripts/test-morning-brief-routing.mjs`,
`CLAUDE.md`, `AGENTS.md`, `docs/workflow.md`, `.claude/rules/`, the actual title-override rule arrays,
or any runtime behavior. Does not delete, rename, move, or archive `gemContentRouter.js` or any other
file.

**Risk:** Low. Markdown-only; the two rule-doc edits add corrective context and preserve the
underlying technical reference content (reframed, not deleted); the ADR and index link are new
additions.

**Rollback:** `git restore` the two modified existing files; `git clean -f --
docs/adr/ADR_TITLE_OVERRIDE_SOURCE_OF_TRUTH.md` to remove the new ADR (or `git revert` the commit as
a whole once made).

### Phase 4-CC — Claude Code rules/governance audit (completed, read-only) + 4-CC-A (this commit)

**Audit (completed 2026-07-26, read-only, zero files changed):** confirmed this repo has no
`.claude/rules/`, `.claude/skills/`, `.claude/commands/`, `CLAUDE.local.md`, or
`.claude/settings.local.json` — `.claude/` contains only `settings.json`. Confirmed the only
mechanically-enforced item in the whole repo is `settings.json`'s `permissions.allow` list; every
Markdown rule/standard (including `CLAUDE_CODE_GOVERNANCE_MODE.md`) is advisory only, with no lint,
hook, or CI check behind it (`.github/workflows/e2e.yml` runs Playwright tests only). Reconfirmed
`CLAUDE_CODE_GOVERNANCE_MODE.md` is still unloaded and still absent from
`MASTER_PROJECT_BIBLE.md`'s own governance index. Confirmed the repo's only `SKILL.md` remains at
the root, not in a location the skill loader recognizes. **New finding:** `MASTER_PROJECT_BIBLE.md`
still listed `docs/workflow.md` as the active workflow reference, unaware of the Phase 3B decision.
Also flagged (not fixed): 3 wildcard `Bash` permission patterns and a blanket `git commit`/`git
stash` allow broader than this engagement's own approval-gated practice; an `additionalDirectories`
entry reaching outside the project. Full findings in the standalone audit report (not committed to
the repo).

**Phase 4-CC-A (this commit) does:** corrects `docs/governance/MASTER_PROJECT_BIBLE.md`'s "External
References" table so `AGENTS.md` is stated as the active canonical cross-agent workflow document and
`docs/workflow.md` is clearly marked a deprecated historical reference, consistent with the
completed Phase 3B decision. No other file needed a matching correction — `docs/INDEX.md` already
reflects this state correctly from Phase 3B/3A and was left untouched.

**Phase 4-CC-A does not:** modify `CLAUDE.md`, `AGENTS.md`, `docs/workflow.md`,
`.claude/settings.json`, any `.claude/rules/` (none exist), any `SKILL.md`, application code,
configuration, or governance-mode behavior. Does not add the 3 orphaned governance documents to
`docs/INDEX.md` (deferred pending their own active/historical status decision). Does not change
permissions or create Claude rules.

**Risk:** Low. Single table-cell-level correction in one file, plus a status/tracking update in this
plan.

**Rollback:** `git restore docs/governance/MASTER_PROJECT_BIBLE.md docs/DOCUMENTATION_MIGRATION_PLAN.md`
before commit; `git revert` the Phase 4-CC-A commit after.

### Phase 4-CC-B — governance mode reframed as an optional checklist (this commit)

**Audit (completed 2026-07-26, read-only, zero files changed):** confirmed
`docs/governance/CLAUDE_CODE_GOVERNANCE_MODE.md` declared itself "Active Project Policy," "not
suggestions... active policy," and "active in this project at all times," while no mechanism in the
repo (no `@import`, no `.claude/rules/`, no reference from `CLAUDE.md` or `AGENTS.md`, no hook or CI
step) actually loads or enforces it — consistent with the Phase 4-CC finding that only
`settings.json`'s permission list has real enforcement. Found 3 of its 6 rules (Critical Feedback,
Architecture Protection, Refactor) already match how this entire engagement has actually been run,
worth keeping; found 2 (the `MD_UPDATE_RECOMMENDED`/`MD_UPDATE_REQUIRED` token ritual, and a mandatory
multi-field report before every commit regardless of size) impose friction with no technical backing
and sit in tension with the "short and concise" preference. Confirmed `docs/INDEX.md`'s existing
one-line description of this document ("not auto-loaded; open explicitly") was already accurate —
left unchanged.

**Decision approved:** rewrite `docs/governance/CLAUDE_CODE_GOVERNANCE_MODE.md` in place (not a
deprecation notice over preserved legacy text, since git history already preserves the prior
version). Reframed as `Claude Code Governance Guide` — an optional reference for standing
recommendations plus an explicitly-invoked checklist for high-risk/architectural/migration/
multi-agent/broad-refactor work, never active by default.

**Phase 4-CC-B (this commit) does:** rewrites `docs/governance/CLAUDE_CODE_GOVERNANCE_MODE.md`
in place — new Status/When-to-Use/Standing-Recommendations/Explicitly-Invoked-Checklist/
Relationship-to-Other-Documents/Activation structure; drops the `MD_UPDATE_RECOMMENDED`/
`MD_UPDATE_REQUIRED` token ritual and the universal per-commit report requirement; keeps the
critical-feedback, architecture-overlap, and prefer-additive guidance as standing recommendations;
states plainly that `CLAUDE.md` and `AGENTS.md` remain the active primary instruction sources and
that this guide does not activate itself. Also corrects this plan's own stale Phase 4-CC-A
changelog entry (below), which still read "in progress... pending approval" after that commit
(`fb8d579`) had already been made and pushed.

**Phase 4-CC-B does not:** modify `CLAUDE.md`, `AGENTS.md`, `docs/workflow.md`,
`.claude/settings.json`, or `docs/INDEX.md` (its existing description was already accurate). Does
not create `.claude/rules/`, hooks, commands, skills, or imports. Does not change permissions,
application code, configuration, or package files. Does not delete, rename, move, or archive any
file — the filename and path of the governance guide are unchanged. Does not begin Phase 4-CC-C,
permissions hardening, Phase 5, or Phase 6.

**Risk:** Low-medium. Unlike prior phases' additions/notices, this is the first phase to rewrite an
existing file's live text in place rather than only prepending a notice above preserved content —
the prior version remains fully available via `git log`/`git show`.

**Rollback:** `git restore docs/governance/CLAUDE_CODE_GOVERNANCE_MODE.md
docs/DOCUMENTATION_MIGRATION_PLAN.md` before commit; `git revert` the Phase 4-CC-B commit after —
fully restores the pre-rewrite text.

## Phase 4 preview — `AI_DEVELOPMENT_GUIDE.md` condensation

**Risk:** High. This is the most-read rules file in the repo (README.md mandates reading it before
UI/save/topic changes). Removing §24/§26/§29 must only happen after confirming §30 is genuinely the
sole current architecture in the live app — do as its own dedicated, reviewed task, not folded into
a general docs pass.

**Rollback:** single commit, full diff review required before merge; revert restores the full
pre-condensation text.

## Phase 5 preview — small-rule consolidation

**Risk:** Low-Medium. The "title override" rule item is now fully handled by **Phase 3C/3C-1**
(see above) — the architecture decision is made and the 2 documentation files
(`GEM_CONTENT_CLASSIFICATION_RULES.md`, `GEMS_TAB_MAPPING_REGRESSION_RULES.md`) are corrected, not
merely merged. Remaining Phase 5 scope: Chapters-priority, Sector-Finviz, and Perplexity-routing
consolidation only.

**Rollback:** one commit per merged pair, independently revertable.

---

## Changelog

- **2026-07-26** — Phase 1 completed: commit `6481db3` on `docs/markdown-governance-cleanup`,
  pushed to `origin/docs/markdown-governance-cleanup`.
- **2026-07-26** — Phase 2 completed: commit `19e74fa` on `docs/phase2-status-refresh`, pushed to
  `origin/docs/phase2-status-refresh`.
- **2026-07-26** — Phase 3 audit completed (read-only): duplication matrix covering `AGENTS.md`/
  `docs/workflow.md`, the GEM title-override rule (docs + a code-level finding), the 5 legacy
  indexes, and `CLAUDE_CODE_GOVERNANCE_MODE.md`'s enforcement gap. Split into Phase 3A/3B/3C above.
- **2026-07-26** — Phase 3A completed: commit `112f723` on `docs/phase3-duplication-audit`, pushed to
  `origin/docs/phase3-duplication-audit`.
- **2026-07-26** — Phase 3B completed: commit `6cf8857` on `docs/phase3b-agent-workflow`, pushed to
  `origin/docs/phase3b-agent-workflow`.
- **2026-07-26** — Phase 3C architecture audit completed (read-only): verified `gemRecommender.js` is
  the sole active title-override path; verified `gemContentRouter.js` is fully dormant, including
  that its own header comment's claimed usage is false. Option A approved as the decision.
- **2026-07-26** — Phase 3C-1 completed: commit `a31aba3` on `docs/phase3c-title-override-architecture`,
  pushed to `origin/docs/phase3c-title-override-architecture`. Phase 3C-2 (comment fix in
  `gemContentRouter.js`) remains a separate, not-yet-approved task.
- **2026-07-26** — Phase 4-CC audit completed (read-only): confirmed only `settings.json` has real
  enforcement in this repo; `CLAUDE_CODE_GOVERNANCE_MODE.md` still unenforced; the repo's only
  `SKILL.md` still in an unrecognized location; found `MASTER_PROJECT_BIBLE.md` still referencing
  the deprecated `docs/workflow.md` as active. Split into 4-CC-A/B/C above.
- **2026-07-26** — Phase 4-CC-A completed: commit `fb8d579` on `docs/phase4a-governance-reference-fix`,
  pushed to `origin/docs/phase4a-governance-reference-fix`. Corrected
  `docs/governance/MASTER_PROJECT_BIBLE.md`'s stale canonical-workflow reference.
- **2026-07-26** — Phase 4-CC-B audit completed (read-only): confirmed
  `CLAUDE_CODE_GOVERNANCE_MODE.md` claimed to be automatically active and enforced with no mechanism
  backing either claim; identified which of its 6 rules matched de facto practice (keep) versus which
  created friction with no technical backing (drop). Phase 4-CC-B implementation completed in the
  same pass: rewrote `docs/governance/CLAUDE_CODE_GOVERNANCE_MODE.md` in place as an optional,
  explicitly-invoked governance guide, on branch `docs/phase4cc-b-governance-mode-rewrite` (worktree,
  based on `origin/docs/phase4a-governance-reference-fix`). Commit proposed, pending approval.
- **2026-07-26** — Phase 5-ARCH audit completed (read-only): classified all 72 repo Markdown files
  for archive eligibility on branch `audit/phase5-documentation-archive` (worktree, based on verified
  commit `d526b1e`). Found exactly 1 file safe to archive now
  (`docs/session-closures/SESSION_CLOSURE_PUSH_2026-07-02.md`), 13 files deferred pending specific
  verification steps, 0 approved Phase 6 deletion candidates, and reconfirmed
  `docs/workspace-session-handoff.md` as protected (at least 3 of its tracked items independently
  verified still open).
- **2026-07-26** — Phase 5-ARCH-A completed: archived the single approved file via `git mv` to
  `docs/archive/session-closures/SESSION_CLOSURE_PUSH_2026-07-02.md`, added the corresponding entry
  to `docs/archive/README.md`, on branch `docs/phase5a-single-safe-archive` (worktree, based on
  `origin/chore/claude-permissions-hardening` @ `d526b1e`). `docs/INDEX.md` was **not** modified —
  it references the `session-closures/` directory as a whole under a "historical record" heading,
  not this file by name, so the link still resolves. One pre-existing plain-text mention of the old
  path remains in the protected `docs/STATUS.md` (line 128) and was intentionally left unchanged
  because `docs/STATUS.md` is protected; it may be corrected during a future verified status
  refresh (in the style of Phase 2), not as part of Phase 5A.
  Commit proposed, pending approval. The 13 deferred candidates and Phase 6 remain untouched.
