# Archive

This directory was created in Phase 1 of `docs/DOCUMENTATION_MIGRATION_PLAN.md` to define policy
ahead of time. As of Phase 5A, it holds the first archived file (below); all other moves are
scoped to later migration phases, each requiring separate explicit approval.

## Archived files

- **`session-closures/SESSION_CLOSURE_PUSH_2026-07-02.md`** (originally
  `docs/session-closures/SESSION_CLOSURE_PUSH_2026-07-02.md`) — archived in Phase 5A. Reason:
  fully closed push summary with zero remaining open items and zero inbound Markdown links found
  repo-wide (one plain-text mention of its path exists in the protected `docs/STATUS.md`, left
  unchanged).

## What belongs here

A Markdown file belongs in `docs/archive/` when it is:

- **A closed, point-in-time report** with no remaining open action items (a resolved bug audit, a
  completed milestone record, a superseded design proposal) — value is historical only.
- **Superseded by a specific, named replacement** — the file that replaces it must be identified
  before archiving, so a reader can find the current version.
- **Confirmed to contain no still-open items.** If a "closed" report contains even one unresolved
  finding (see, for example, the P7/P8/P10 items noted against
  `MORNING_BRIEF_SPECIALIZED_OUTPUT_AUDIT.md` in the documentation audit), that open item must be
  copied into a live tracking doc (`docs/STATUS.md` or a future `docs/OPEN_ISSUES.md`) *before* the
  report is archived — archiving must never be the only place an open item is recorded.

## What does NOT belong here

- Anything still cited as a rule other code or docs depend on.
- Anything with an unresolved "needs verification" note, until that note is resolved or copied
  forward.
- Session-handoff files still tracking unpushed commits or in-progress work (see
  `docs/workspace-session-handoff.md`) — these move to `session-closures/` (not archive) only once
  every item in them is confirmed closed.

## How files get archived

1. Confirm the file has no open items (see above).
2. Move the file with `git mv` (preserves history) into a dated subdirectory, e.g.
   `docs/archive/2026-06-audit-artifacts/`.
3. Update `docs/INDEX.md` to point at the new location.
4. Record the move in `docs/DOCUMENTATION_MIGRATION_PLAN.md`'s changelog.

Rollback: since moves use `git mv`, `git revert` of the archiving commit fully restores the original
path.
