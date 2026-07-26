# Project Status — Verified State

**Verified:** 2026-07-26 (Phase 1: git/repo state; Phase 2: codebase cross-check against documented
settings and open bugs), via `git status`, `git log`, direct grep of the current source tree, and
inspection of `docs/workspace-session-handoff.md`. This file only states what was directly
checked — it does not carry forward assumptions from older status docs. Where something is
relevant but was not independently verified, it is marked **unverified** rather than asserted.

This replaces the "current live status" role of `PROJECT_STATUS.md` (root, dated 2026-06-17) and
`docs/governance/CURRENT_STATE_JUNE_2026.md` (dated June 11, 2026) — both are now confirmed stale
(≈6 weeks behind) and carry a deprecation notice pointing here; their original content is otherwise
untouched.

---

## Phase 2 findings — documented settings vs. actual code (verified 2026-07-26)

`CLAUDE.md`'s "הגדרות AI מאושרות" table states these values live in `vite.config.js`. Checking the
current source tree directly (grep across the full repo, not just `vite.config.js`) found:

| Setting | Documented (`CLAUDE.md`) | Actual, as found in code | Verified location | Match? |
|---|---|---|---|---|
| `max_tokens` | `8192`, in `vite.config.js` | **`3_000`** (`CLAUDE_MAX_TOKENS`) | `backend/analyze-video.function.js:10,176` | ❌ **Mismatch** — value and file location both differ |
| `ANTHROPIC_MESSAGE_MS` | `600_000`, in `vite.config.js` | `600_000` (used as a timeout cap) | `src/services/claudeVideoAnalyzer.js:15` | ✅ Value matches; file location differs from documented |
| `server.httpServer.timeout` | `620_000`, in `vite.config.js` | **Not found anywhere in the repo** (`vite.config.js` has zero matches for `httpServer`, `timeout`, `620_000`, or `620000`) | — | ❌ **Not found** |
| `CHUNK_THRESHOLD` | `15_000`, in `vite.config.js` | `15000` (`TRANSCRIPT_SAFE_CHARS`) | `src/lib/geminiJsonDebugReport.js:12` (comment explicitly cites this CLAUDE.md rule) | ✅ Matches |
| `ANTHROPIC_API_KEY` — no `VITE_` prefix, "intentional" | Must never fall back to `VITE_ANTHROPIC_API_KEY` | Code reads `process.env.ANTHROPIC_API_KEY \|\| process.env.VITE_ANTHROPIC_API_KEY` | `backend/analyze-video.function.js:5,98` | ❌ **Contradicts the documented rule** — a `VITE_` fallback exists in code |

**`vite.config.js` itself (1,783 lines) contains no Claude/Anthropic API settings at all** — grepped
in full for `claude`/`anthropic` (case-insensitive); the only hits are an unrelated JSON schema field
named `fixPromptForClaudeCode`. The actual Claude-analysis logic now lives in
`backend/analyze-video.function.js` and `src/services/claudeVideoAnalyzer.js` — a Base44 backend
function, not the Vite dev/build config `CLAUDE.md` currently points to.

**This is reported as a verified fact, not fixed.** Modifying `CLAUDE.md` or any source file is out
of scope for this documentation-only phase. The `max_tokens: 3_000` value is notable because
`CLAUDE.md`'s own stated rationale for locking this setting at `8192` is "ערך נמוך יותר גורם ל-JSON
חתוך (Unterminated string)" — a lower value causes truncated JSON. Whether this is an intentional
change, a stale doc, or a regression was not determined here; it needs a decision from whoever owns
this code path before Phase 3+ touches anything downstream of it (e.g. `AI_DEVELOPMENT_GUIDE.md` or
`docs/governance/MASTER_PROJECT_BIBLE.md`, which repeat the same locked-settings claim).

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
the handoff file**, not re-checked during this documentation cleanup.

**Note on file length:** the committed version of `docs/workspace-session-handoff.md` (as pushed in
commit `6481db3`, and as checked out in this Phase 2 worktree) is 323 lines. The uncommitted working
copy in the original repo directory is 633 lines — it has ~310 additional lines (a full "Session C"
write-up) that were never committed. Both versions were read in full across Phase 1/Phase 2 of this
cleanup; the items below are drawn from the fuller, uncommitted version. The file itself was **not
modified, moved, condensed, or archived** at any point in this cleanup.

1. Commits `c1febb8`, `6b242e1`, `e2be09b` (macro-mapping fix) — documented as not pushed; confirmed still true (all 3 are among the 12 unpushed commits above).
2. Commits `53e5887`, `06968a7` — made after `e2be09b` by a different session; the handoff doc says they were never reviewed by the session that wrote the macro-mapping fix.
3. `src/config/videoTabsConfig.js` has uncommitted extensions (news/sectors union helpers) beyond its last commit — no regression fixture exists for them yet, per the handoff doc.
4. GEM ticker mis-mapping (`BUG`/`CRDL`/`WDF`/`S1`) — documented as unfixed; requires a change to the external Gemini Gem prompt, not a code change.
5. Two small uncommitted follow-up fixes in Workspace (stock-view label/default, subtopic tab order) — documented as pending a decision on whether to commit.

## The 4 old "release gates" — Phase 2 code-level check

The old `PROJECT_STATUS.md` (2026-06-17) listed 4 blocking gates. Static code inspection (grep/read,
**no live browser QA was performed** — this is a documentation phase, not a QA pass) found:

| Gate | 2026-06-17 claim | Phase 2 code-level finding | Verdict |
|---|---|---|---|
| CH-1 — chapters show titles but no timestamps | `resolveStartSeconds()` fails; `startSeconds` missing | `resolveStartSeconds()` exists in `ChapterItem.jsx:4` and is called at `:260`; `VideoDetailPanel.jsx` independently populates `startSeconds` via `parseTimestampToSeconds()` for real chapter timestamps (lines ~77, 107) | **Unverified** — code that should produce timestamps exists and looks functional; whether it actually renders correctly for a real video was not tested live |
| MB-2 — `DirectionChip is not defined` in `MorningBriefMarketsTable`/`MorningBriefPanels` | Crash reported, "fix applied, not confirmed live" | `DirectionChip` is defined/exported only in `MorningBriefVisualPrimitives.jsx:189`; grepped the full repo — **it is not referenced anywhere in `MorningBriefMarketsTable.jsx` or `MorningBriefPanels.jsx`** currently | **Unverified, but the specific reported crash path can no longer occur via that reference** — neither file currently calls an undefined `DirectionChip`. Not the same as confirming the screen renders correctly. |
| MB-3 — Summary/Specialized fallback after reload | Code fix landed, no refresh test | Requires exercising the running app (reload behavior, localStorage read timing) — not checkable via static grep | **Unverified — needs live QA** |
| MB-4 — Morning Brief persistence on ≥3 videos | Untested | Same — runtime/localStorage behavior | **Unverified — needs live QA** |

**`gemContentRouter.js`** (flagged in `docs/session-closures/SESSION_CLOSURE_PUSH_2026-07-02.md` as
"not currently imported anywhere") — **confirmed still true**: the file exists
(`src/ai/gemini/gemContentRouter.js`, 14,330 bytes) but a repo-wide grep for `gemContentRouter` finds
zero imports of it anywhere in `src/`.

**Route count** (not one of the 4 files this phase was scoped to compare, noted for context only):
`src/pages.config.js` currently registers **15 pages**, including `WorkspaceLibrary` — one more than
the 14 routes `ROUTES_AUDIT_REPORT.md` (2026-06-01) documented, confirming that report predates the
Workspace redesign work in `docs/workspace-session-handoff.md`.

## Items this phase still did NOT verify (require live app/browser QA, not static inspection)

- Whether chapters actually render correct timestamps for a real video (CH-1).
- Whether the Morning Brief / Specialized tab renders without console errors after the DirectionChip-area code paths run (MB-2).
- Summary/Specialized fallback behavior after a page reload (MB-3).
- Morning Brief persistence across ≥3 videos (MB-4).
- Whether the `max_tokens: 3_000` vs. documented `8192` discrepancy (above) is intentional or a regression.

Resolving/closing these requires running the app, which is out of scope for this documentation
phase — they should inform Phase 0 (verification) of `docs/DOCUMENTATION_MIGRATION_PLAN.md` before
any further status document is archived.
