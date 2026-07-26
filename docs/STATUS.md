# Project Status — Verified State

**Verified:** 2026-07-26, via `git status`, `git log`, and direct inspection of
`docs/workspace-session-handoff.md`. This file only states what was directly checked on that date —
it does not carry forward assumptions from older status docs. Where something is relevant but was
not independently re-verified, it is marked **unverified** rather than asserted.

This replaces the "current live status" role of `PROJECT_STATUS.md` (root, dated 2026-06-17) and
`docs/governance/CURRENT_STATE_JUNE_2026.md` (dated June 11, 2026) — both are now confirmed stale
(≈6 weeks behind) and remain unchanged at their original paths pending a later archive phase.

---

## Repository state (verified 2026-07-26)

| Item | Value |
|---|---|
| Base branch | `main` |
| `main` vs `origin/main` | **12 local commits not pushed** (`bd11421` … `9af9a6f`) |
| Working tree at time of check | 7 uncommitted `src/` files + `.claude/settings.json` + 2 `docs/*.md` files modified; 8 untracked files (6 screenshots + 2 docs files) |
| This cleanup's branch | `docs/markdown-governance-cleanup`, created from `main` at the commit above — does not touch any of the pending uncommitted work |

### Unpushed local commits (verified via `git log`)

```
9af9a6f docs: add workspace session handoff
20b2faa feat: add perplexity space selector with stock routing
72e1130 fix: restore specialized news and sector content mapping
06968a7 fix: use multiSelectClear() instead of undefined setMultiSelected
53e5887 fix: add fresh analysis option to deleted video recovery
e2be09b docs: document specialized macro mapping audit
6b242e1 fix: stop dropping/truncating Specialized-tab macro factors
c1febb8 test: add regression fixture for Specialized-tab macro mapping bug
7fb02b0 refactor: simplify workspace navigation and filters
a3cd53d style: make workspace item actions visible
46f1f72 feat: redesign workspace layout and add configurable tab rows
bd11421 feat: add advanced workspace market filters
```

### Uncommitted working-tree changes (verified via `git status`, 2026-07-26)

**Modified:**
- `.claude/settings.json`
- `docs/SECTION_HEADER_COUNT_RULE.md`
- `docs/workspace-session-handoff.md`
- `src/components/dashboard/MorningBriefPanels.jsx`
- `src/components/dashboard/MorningBriefVisualPrimitives.jsx`
- `src/components/workspace/WorkspaceSaveReviewOverlay.jsx`
- `src/lib/morningBriefBulkSections.js`
- `src/lib/morningBriefPresentation.js`
- `src/pages/WorkspaceLibrary.jsx`
- `src/utils/workspaceVirtualTaxonomy.js`

**Untracked:**
- `after-click.png`, `after-thumb.png`, `app-home.png`, `scroll-down.png`, `workspace-library-check.png`, `workspace-library-menu.png`
- `docs/SESSION_CLOSURE_NOTES_2026_07_01_HEBREW_MARKET_STATUS_LABELS.md`
- `docs/workspace-session-handoff-delete-all.md`

Per `docs/workspace-session-handoff.md`, this uncommitted work belongs to at least 3 concurrent
Claude Code sessions (Workspace Bulk Action Bar + Morning Brief section select-all + specialized
dedup fixes). **None of it was touched, committed, or reviewed as part of this documentation
cleanup** — this status file only records that it exists.

---

## Open items carried forward from `docs/workspace-session-handoff.md` (not independently re-verified)

These are the handoff doc's own "needs verification" / "not pushed" / "unfixed" items, restated
here so they're visible without opening a 630-line file. Status of each is **as last documented in
the handoff file**, not re-checked during this documentation cleanup:

1. Commits `c1febb8`, `6b242e1`, `e2be09b` (macro-mapping fix) — documented as not pushed; confirmed still true (all 3 are among the 12 unpushed commits above).
2. Commits `53e5887`, `06968a7` — made after `e2be09b` by a different session; the handoff doc says they were never reviewed by the session that wrote the macro-mapping fix.
3. `src/config/videoTabsConfig.js` has uncommitted extensions (news/sectors union helpers) beyond its last commit — no regression fixture exists for them yet, per the handoff doc.
4. GEM ticker mis-mapping (`BUG`/`CRDL`/`WDF`/`S1`) — documented as unfixed; requires a change to the external Gemini Gem prompt, not a code change.
5. Two small uncommitted follow-up fixes in Workspace (stock-view label/default, subtopic tab order) — documented as pending a decision on whether to commit.

## Items this cleanup phase explicitly did NOT verify

The following are referenced in older docs but were **not** checked against the live app or codebase
during this pass — do not treat them as confirmed either open or resolved:

- The 4 "release gates" (chapters timestamps, DirectionChip error, Summary/Specialized refresh, Morning Brief persistence) from the old `PROJECT_STATUS.md` / `CURRENT_STATE_JUNE_2026.md`.
- Whether `CHAPTER_ENGINE_ROOT_CAUSE_REPORT.md`'s chapters-timestamp bug is still present.
- Whether `gemContentRouter.js` is genuinely unimported dead code (flagged in `docs/session-closures/SESSION_CLOSURE_PUSH_2026-07-02.md`).

Resolving these is out of scope for Phase 1 (see `docs/DOCUMENTATION_MIGRATION_PLAN.md`, Phase 0).
