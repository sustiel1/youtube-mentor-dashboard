# Claude Code Governance Guide

**Adopted:** 2026-06-17
**Rewritten:** 2026-07-26 (Phase 4-CC-B — see `docs/DOCUMENTATION_MIGRATION_PLAN.md`)

This file does not activate itself. If you were not explicitly told to apply it, treat everything below as reference material only.

---

## Status

- **Optional.** This is a reference guide, not a standing policy.
- **Explicitly invoked.** Its checklist section applies only when a task calls for it or someone asks for it by name.
- **Not automatically loaded.** Nothing imports or opens this file at session start.
- **Not enforced by hooks, CI, linting, or `.claude/rules/`.** No such mechanism exists in this repo referencing this document.
- **`CLAUDE.md` and `AGENTS.md` remain the active primary instruction sources.** This guide supplements them and never overrides either one.

---

## When to Use This Guide

Reach for this guide's checklist for work like:

- Architecture changes
- Migrations
- Broad refactors
- Multi-agent work
- Risky Git operations
- Changes spanning several subsystems

It is normally **unnecessary** for:

- Read-only audits
- Trivial wording changes
- Small isolated fixes
- Routine build or status checks

---

## Standing Recommendations

These apply as general good practice, with or without invoking the checklist below:

- **Critical feedback.** If a requested change looks like a poor architectural choice, adds unnecessary complexity or coupling, or creates a future maintenance risk — say so, explain why, and suggest a safer alternative before proceeding.
- **Architecture protection.** Before a major change, check whether it duplicates something that already exists. If it does, say so before implementing.
- **Additive and backward-compatible changes.** Prefer additive changes, backward compatibility, and staged rollouts over large rewrites unless a rewrite is clearly justified.
- **Avoid unrelated edits.** Keep changes scoped to what was asked; don't fold in unrelated cleanup.

---

## Explicitly Invoked Checklist

Use this checklist only when this guide has been explicitly invoked (see **Activation** below) for a task in one of the categories listed under **When to Use This Guide**.

- [ ] **Overlap and duplication review** — does this already exist elsewhere in the codebase or docs?
- [ ] **Affected files and protected files** — list what changes, and confirm nothing protected (config, source, settings) is touched unintentionally.
- [ ] **Build and QA plan** — how will the change be verified before merge?
- [ ] **Commit boundaries** — is this one focused commit, or does it need splitting?
- [ ] **Rollback strategy** — what's the exact command to undo this if needed?
- [ ] **Review before merge** — has the diff been shown and approved before committing?

---

## Relationship to Other Documents

- **`CLAUDE.md`** — Claude-specific active project instructions, auto-loaded every session.
- **`AGENTS.md`** — canonical cross-agent workflow document for this project.
- **This file** — an optional governance guide only. It does not get auto-loaded, and it does not supersede either document above.

---

## Activation

To apply the checklist above to a task, say so explicitly, for example:

> Apply the optional Claude Code governance checklist to this task.

Without an instruction like this, this guide is not considered active.
