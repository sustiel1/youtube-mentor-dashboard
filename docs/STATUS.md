# Project Status — Verified State

**Verified:** 2026-07-26/27, via `git status`, `git log`, and direct static inspection (grep/read,
no live browser QA) of `origin/main`. This file describes only what is verifiably true on `main` at
integration time. It does not carry forward assumptions from older status docs, and it does not
describe the separately-tracked feature work (Workspace redesign, macro-mapping fixes) that is
intentionally excluded from this documentation/governance/permissions integration — see
`docs/DOCUMENTATION_MIGRATION_PLAN.md`'s selective integration note for why.

This replaces the "current live status" role of `PROJECT_STATUS.md` (root, dated 2026-06-17) and
`docs/governance/CURRENT_STATE_JUNE_2026.md` (dated June 11, 2026) — both are now confirmed stale
and remain unchanged at their original paths pending a later archive phase.

---

## Repository state (verified at integration time)

| Item | Value |
|---|---|
| Base branch | `main` |
| Integration branch | `integration/docs-governance-cleanup`, built directly from `origin/main` in a clean worktree |
| Working tree at time of check | Clean — no uncommitted changes |
| Scope of this integration | Documentation, governance, architecture-decision-record, repository Claude permissions, and one verified historical archive move only. No application source, package, or runtime configuration file is part of this branch. |

## What this integration deliberately excludes

A separately-run dependency audit found that 12 earlier commits present on the original audit
branch (Workspace filters/redesign/navigation, macro-mapping fixes, a deleted-video recovery
option, and a Perplexity space selector) are unrelated to this documentation/governance/permissions
cleanup and must not be folded in here. They remain pending a separate, explicitly-approved,
QA-gated feature pull request. Four release gates associated with that work
(chapter timestamps, a reported `DirectionChip` crash, Summary/Specialized fallback behavior after
reload, and Morning Brief persistence across multiple videos) are still unverified live and are
not evaluated by this document — that verification belongs with the feature work's own integration,
not this one.

## Known documentation-vs-code drift (verified on `main`, independent of the excluded feature work)

`CLAUDE.md` documents `max_tokens: 8192` as the approved Claude API setting ("a lower value causes
truncated JSON"). Static inspection of `backend/analyze-video.function.js` on `main` shows
`CLAUDE_MAX_TOKENS = 3_000` — a real discrepancy between the documented and actual value, reported
here for visibility, not fixed as part of this integration (fixing it is an application-code change,
out of scope for a documentation-only branch).

## Route registry

`src/pages.config.js` on `main` currently registers 15 pages, including `WorkspaceLibrary`. The
root-level `ROUTES_AUDIT_REPORT.md` (2026-06-01, 14 routes) predates this and has no direct
successor document — noted as a pre-existing, non-blocking documentation gap.

## Not evaluated by this document

- Live/browser QA of any UI behavior — this is a static, documentation-only pass.
- Anything specific to the 12 excluded feature commits or `docs/workspace-session-handoff.md` (not
  part of this branch's tree).
- Application code correctness beyond the single drift noted above.
