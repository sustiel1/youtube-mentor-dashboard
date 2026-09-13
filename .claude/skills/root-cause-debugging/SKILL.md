---
name: root-cause-debugging
description: Use before proposing or making any fix for a bug, regression, failing check, or unexpected behavior anywhere in this repo. Enforces root-cause analysis over symptom patching, adapted to this project's own workflow rules (docs/open-items-ledger.md, canonical dev URL http://localhost:5184, no-Console/no-secrets rules).
---

# Root-Cause Debugging

## Iron Rule

No fix may be proposed or written until:
1. The root cause is identified and written down in one sentence.
2. Measurable acceptance criteria are stated.

A symptom-level patch (silencing an error, adding a null-check that hides the
real defect, retrying until it passes) is a **failure**, not a shortcut. If a
fix is proposed before both items above exist, stop and go back to Phase 1.

---

## Phase 1 — Evidence

Do this before forming any theory:

- Read the actual error text (stack trace, console output, failing assertion) —
  do not paraphrase from memory.
- Confirm the exact repo path, worktree, branch, and HEAD commit (`git status`,
  `git rev-parse HEAD`), and confirm the running dev server (process, port, URL)
  actually serves that same worktree. This project's canonical local URL is
  `http://localhost:5184` (see project CLAUDE.md) — if the app under test is on
  a different port or worktree, say so before continuing.
- Identify recent changes in the affected area (`git log -p` / `git blame` on
  the relevant file(s)).
- Reproduce the problem reliably (steps, inputs, or a failing test/command).
- State explicitly: what is observed vs. what was expected.

**Checklist to exit Phase 1:**
- [ ] Raw error text captured (not summarized)
- [ ] Repo/worktree/branch/HEAD confirmed, and matched against the running server
- [ ] Recent relevant changes identified
- [ ] Reproduction steps confirmed reliable
- [ ] Observed vs. expected stated in writing

---

## Phase 2 — Localization

- Trace the data flow across component/module boundaries from input to output.
- Find the exact point where correct input becomes incorrect output.
- If a working analogous example exists elsewhere in this repo (similar
  component, similar API call, similar persistence path), compare against it.
- Name the single failing component and file (not "somewhere in the pipeline").

**Checklist to exit Phase 2:**
- [ ] Data flow traced end-to-end across the relevant boundaries
- [ ] Exact point of divergence (correct in → incorrect out) identified
- [ ] Compared against a working example, if one exists
- [ ] One specific file/component named as the failure site

---

## Phase 3 — Hypothesis

- State the root cause in exactly one sentence.
- State what evidence would disprove it (a falsifiable check, not a vague
  intuition).
- Verify the hypothesis minimally (a log line, a debugger breakpoint, a
  targeted test) **before** writing the fix.

**Checklist to exit Phase 3:**
- [ ] Root cause stated in one sentence
- [ ] A disproving observation was defined in advance
- [ ] Hypothesis verified minimally, with the verification result recorded

---

## Phase 4 — Fix

- The fix must be minimal, additive, and backward-compatible.
- No unrelated refactoring, no dependency upgrades, no "while I'm here" cleanup.
- Preserve all unrelated in-progress or uncommitted work in the working tree.
- The fix must map directly to the root cause from Phase 3 — if it doesn't,
  the hypothesis was wrong; return to Phase 2 or 3.

**Checklist to exit Phase 4:**
- [ ] Fix addresses the stated root cause, nothing else
- [ ] No unrelated files touched
- [ ] No refactor/upgrade/cleanup bundled in

---

## Verification

- Review the full diff before calling anything done.
- Run whatever checks actually exist for the affected scope in this repo:
  tests, lint, type-check, build, runtime/dev-server check, persistence
  (IndexedDB/localStorage) check, reload check, UI check.
- Confirm the fixed behavior survives a page reload, not just the first load.
- If a check fails: identify the root cause of *that* failure, apply the
  smallest safe correction, and recheck.
- **Stop after 3 failed correction rounds.** Report the blocker, the evidence
  gathered, and the safest next step instead of continuing to iterate.

---

## Hard Stops

This skill must never, on its own:

- Commit, amend, push, merge, deploy, publish, or edit production data.
- Switch branch, worktree, or server, or run `reset`, `clean`, `checkout --force`,
  or delete files.
- Dispatch sub-agents — routing to other agents belongs to the session that
  invoked this skill, not to the skill itself.
- Treat "recorded in a report" or "reported to the user" as equivalent to
  "verified" — verification means a check actually ran and its result was
  observed.

---

## Reporting Shape

Every use of this skill ends with a report containing exactly these fields:

1. **Root cause** — one sentence.
2. **Acceptance criteria** — each one listed, with met/not-met.
3. **Files changed** — exact paths.
4. **Checks run** — which ones, and their actual results.
5. **Correction rounds used** — a number, 0–3.
6. **Risks and rollback** — what could still be wrong, how to revert.
7. **Manual QA checklist** — numbered, concrete steps a human runs in the
   browser at this project's canonical local URL (`http://localhost:5184`),
   not a generic "test manually" line.
8. **Git state** — what is committed, staged, unstaged, or untracked.
   Uncommitted work is never described as "saved."

---

## Common Rationalizations

| The tempting thought | The reality |
|---|---|
| "It's an obvious one-line fix." | Obvious fixes for non-obvious bugs are how symptom patches ship. Do Phase 1–3 anyway; it takes minutes and either confirms or kills the assumption. |
| "I'll find the root cause after the fix works." | If the fix "works" without a confirmed cause, you don't know it fixed the bug — you know it changed behavior. Those are different claims. |
| "The test passed, so it's fixed." | A passing test confirms the test's assertion, not the absence of the bug. Confirm the test actually exercises the failing path from Phase 2. |
| "It works on my branch." | This repo runs many parallel worktrees/branches at once. Confirm the branch, worktree, and dev server port match what will actually be reviewed or shipped. |
| "I'll clean up this nearby code while I'm here." | Bundled cleanup hides the actual fix in the diff and violates the additive/backward-compatible rule in Phase 4. Open a separate task for it. |
| "Three rounds failed but the next one will work." | Three failed rounds means the hypothesis (Phase 3) is probably wrong, not that the fix needs one more tweak. Stop and report. |
