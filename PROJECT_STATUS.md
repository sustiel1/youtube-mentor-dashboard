# Project Status — YouTube Mentor Dashboard

**Last updated:** 2026-06-17 (end of repository cleanup session)
**Branch:** `main`
**Build status:** ✅ `npm run build` passes (exit 0)
**Release status:** ❌ **Not release-ready** — 4 release gates open (see below)

---

## Repository Health

| Metric | Value |
|--------|-------|
| Tracked-modified files | 0 |
| Staged files | 0 |
| Untracked files | 1 (this file, before commit) |
| Build | ✅ PASS — `npm run build` exit 0 |
| E2E tests | ⚠️ Specs committed — not run against dev server this session |

---

## Latest Commits (as of 2026-06-17)

```
211e5fc chore(scripts): add remaining QA and audit scripts
d5c6129 chore(repo): ignore temporary audit artifacts
c5f4757 chore(audit): add runtime tabs audit scripts
e1de719 test(obsidian): add bulk-save and note-merge QA coverage
0c478d2 docs: add AI development guide
cf49436 fix(test): add missing merge-vault QA helper
ca41efb feat(test): add merge-vault QA script and e2e spec
cca7126 feat(vault): add vault read API and merge-write mode
0a4e1f6 chore(repo): stop tracking generated log and build artifacts
795336e chore(gitignore): ignore generated QA and tooling artifacts
6e423c5 chore(devtools): add runtime tabs audit helper
feff5b2 feat(shared): add reusable save status popover
8d0b072 fix(ui): rename topics-subtopics tab label to Obsidian mapping
c7958f5 refactor(ui): unify Obsidian save controls with shared icon components
a6df4f5 fix(obsidian): replace hardcoded vault label with active settings
e50d95b feat(brain): add save-status helper and reusable selectable item row
0f6e794 feat(obsidian): add picker-aware saved labels
329c595 refactor(obsidian): centralize vault path sanitization
fac8a53 fix(obsidian): use taxonomy-first routing in full video export
fee51e5 fix(export): use video param instead of undefined v in buildVideoFullNote
```

---

## What Was Done in This Session (2026-06-17)

### Repository Cleanup (20 commits)

- Committed all remaining tracked-modified `src/` files (Obsidian save controls, vault config, routing, labels, Brain picker, selectable items)
- Committed `SaveStatusPopover.jsx` and `runtimeTabsAudit.js` (audited before commit)
- Added vault read API + merge-write mode (`cca7126`)
- Added E2E specs: `obsidian-bulk-save.qa.spec.js`, `obsidian-item-save.qa.spec.js`, `obsidian-merge-vault.qa.spec.js`
- Added QA/audit scripts: 12 Playwright + Node.js scripts under `scripts/`
- Expanded `.gitignore` to exclude playwright-mcp artifacts, codex logs, QA screenshots, build temp files
- Added `AI_DEVELOPMENT_GUIDE.md` documentation
- Adopted Claude Code Governance Mode (`docs/governance/CLAUDE_CODE_GOVERNANCE_MODE.md`)

### Audited Before Commit

Every staged file was verified for: missing imports, dependency gaps, deleted-file references, machine-specific paths, secrets. Build confirmed after each commit group.

---

## Open Risks

| Risk | Severity | File | Description |
|------|----------|------|-------------|
| Dead UI component | Medium | `src/components/shared/SaveStatusPopover.jsx` | Committed and complete but has zero callers in production `src/`. Remains dead code until wired into a parent component. |
| Dead export | Low | `src/lib/obsidianSavedStatus.js` | `getObsidianSaveButtonLabel` is exported but not imported anywhere. Will drift if the surrounding API evolves before it is wired. |
| E2E specs unverified | Low | `e2e/obsidian-*.qa.spec.js` (3 files) | Specs are committed but have not been run against a live dev server. Require Obsidian vault running locally to pass. |
| `scripts/tmp-live-audit.json` not in Git | Low | `scripts/run-live-audit-sim.mjs`, `scripts/run-sparse-audit.mjs` | Both scripts read a local data file excluded by `.gitignore` (`scripts/tmp-*.json`). Will fail on a fresh clone until the file is generated. Expected behavior for data-driven audit scripts. |

---

## Remaining Bugs

### Blocking (release gates)

| ID | Severity | Description | Location |
|----|----------|-------------|----------|
| CH-1 | **High** | Chapters tab shows titles but no timestamps — `resolveStartSeconds()` fails; `startSeconds` / `timestamp` missing from GEM or transcript normalization. | `ChapterItem.jsx`, `VideoDetailPanel.jsx` |
| MB-2 | **High** | `DirectionChip is not defined` — code fix applied in `MorningBriefMarketsTable`; browser regression not confirmed on live Specialized tab. | `MorningBriefMarketsTable.jsx`, `MorningBriefPanels.jsx` |
| MB-3 | **High** | Summary/Specialized fallback after page reload — dual-key `market_brief_*` load implemented; no live QA pass documented. | `VideoDetailPanel.jsx`, `morningBriefDisplay.js` |
| MB-4 | **High** | Morning Brief data persistence after reload — localStorage + DB sync untested on 3+ videos. | `VideoDetailPanel.jsx`, `videoStorage.js` |

### Non-blocking

| ID | Severity | Description | Location |
|----|----------|-------------|----------|
| OBS-1 | Low | `onOpenSaved` prop on `BrainDestinationPicker` has no default value — silent no-op if caller omits it in `allSaved` path. | `BrainDestinationPicker.jsx` |
| OBS-2 | Low | "החלף קובץ קיים" replace-confirmation dialog appears in Brain variant (`allowReplaceExisting = true`) — logic intended for Obsidian variant only. | `BrainDestinationPicker.jsx` |
| OBS-3 | Info | `getObsidianSaveButtonLabel` exported but uncalled — see Open Risks above. | `obsidianSavedStatus.js` |

---

## Release Readiness

| Gate | Status | Notes |
|------|--------|-------|
| 1. Chapters timestamps working | ❌ Open | Code analysis complete; root cause likely upstream data shape |
| 2. DirectionChip error fixed | ⚠️ Partial | Static fix applied; live browser QA not executed |
| 3. Summary/Specialized verified after refresh | ❌ Open | Code fix landed (`effectiveBriefSlug`, dual-key load); no refresh test |
| 4. Morning Brief tested on ≥ 3 videos | ❌ Open | Not executed |

**Verdict:** ❌ **Not release-ready.** Do not publish to Base44 until all four gates pass.

---

## Recommended Next Tasks

### 1. Wire `SaveStatusPopover.jsx` into UI (Medium priority)
Component is complete with all dependencies committed. Needs a caller — candidate: row-level save status icon in `BrainSelectableItem.jsx` or `VideoDetailPanel.jsx`.

### 2. Run E2E test suite against dev server (High priority)
```bash
npm run test:e2e
# or individually:
npx playwright test e2e/obsidian-merge-vault.qa.spec.js
npx playwright test e2e/obsidian-bulk-save.qa.spec.js
```
Requires local Obsidian vault running. Validates merge-vault, bulk-save, and item-save flows end-to-end.

### 3. Audit `vite.config.js` AI settings (High priority — governance)
Confirm the governance-locked settings survived the session commits:

| Setting | Required value |
|---------|---------------|
| `max_tokens` | `8192` |
| `ANTHROPIC_MESSAGE_MS` | `600_000` |
| `server.httpServer.timeout` | `620_000` |
| `CHUNK_THRESHOLD` | `15_000` |
| `GEMINI_MOCK` | `false` |

### 4. Close release gates CH-1 and MB-2 (High priority)
- **CH-1:** Debug `normalizeGemChapters` / `normalizeTranscriptBackedChapters` to ensure `startSeconds` is populated. Open a video with chapters in the browser; check `ChapterItem` props.
- **MB-2:** Open Specialized tab on a morning-brief video; confirm no console errors on Sentiment and Stocks Mentioned sections.

### 5. Fix `getObsidianSaveButtonLabel` dead export (Low priority)
Either wire it into a caller (video-level Obsidian button) or remove it to prevent drift. One-line change.

---

## Environment & Build

| Item | Status |
|------|--------|
| `npm run build` | ✅ Passes (exit 0) |
| `npm run dev` | Vite + Base44 proxy |
| Node | 20+ recommended |
| Key env vars | `VITE_BASE44_*`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` (server-side, no `VITE_` prefix) |
| E2E | Playwright configured — `npm run test:e2e` |
| Governance | `docs/governance/CLAUDE_CODE_GOVERNANCE_MODE.md` — active |

---

*Generated from codebase inspection, git log, build verification, and 2026-06-17 cleanup session audit.*
