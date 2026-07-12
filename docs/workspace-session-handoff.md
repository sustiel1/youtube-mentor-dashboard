# Session Handoff — 2026-07-12

> This file aggregates handoff notes from **multiple concurrent Claude Code sessions/windows** open on 2026-07-12. Each session's notes are kept as a separate dated section below so closing any one window doesn't lose the others' context. Newest session is added at the bottom of this index; read the section matching what you're resuming.

**Sessions in this file:**
- [Session A — Perplexity Space Selector + GEMS JSON Repair](#session-a--perplexity-space-selector--gems-json-repair)
- [Session B — Workspace Library Navigation Redesign](#session-b--workspace-library-navigation-redesign)
- [Session C — Workspace Bulk Action Bar + Morning Brief Section Select-All + Dedup Fixes](#session-c--workspace-bulk-action-bar--morning-brief-section-select-all--dedup-fixes) *(index entry found pre-existing; no matching section body was present in this file as of Session D's edit — needs verification, possibly still being written by another window)*
- [Session D — Specialized Tab Macro Mapping Audit & Fix](#session-d--specialized-tab-macro-mapping-audit--fix)

---

## Session A — Perplexity Space Selector + GEMS JSON Repair

### Session Summary

This session covered two main topics:
1. Perplexity Space selector feature inside the "שאלות לפי כותרת" dialog
2. Recurring GEMS JSON repair errors (gershayim in market brief content)

---

### 1. What Was Implemented

**Perplexity Space Selector (FixedQuestionsPanel)**

**Files changed:**
- `src/lib/perplexitySpaces.js` — created (new file)
- `src/components/shared/FixedQuestionsPanel.jsx` — updated

**What was built:**

`perplexitySpaces.js` — single source of truth for Perplexity Spaces:
- `PERPLEXITY_SPACES` dict with two entries: `marketBrief`, `stockFastDecision`
- `SELECTABLE_SPACES` — `Object.values(PERPLEXITY_SPACES)` for rendering
- `getPerplexitySpaceByKey(key)` — returns Space or fallback to marketBrief
- `isStockRelatedQuestionSection(sectionTitleOrKey)` — keyword-based detection
- `getDefaultPerplexitySpaceForQuestionSection(sectionTitleOrKey)` — returns default Space key
- `getDefaultPerplexitySpaceForSection` — backward-compat alias
- `STOCK_FAST_DECISION_QUESTIONS` — 12 Hebrew questions for stock decisions

`FixedQuestionsPanel.jsx` — updated behavior:
- `selectedSpaceKey` state — auto-initialized on dialog open from section label
- `openSelectedPerplexitySpace()` — shared handler used by pill and footer button
- Space selector pills: active (blue) pill click → opens Space; inactive pill click → switches only
- Active pill: `title="פתח את ה־Space"`, `↗` indicator, Enter key support
- Footer Perplexity button: `<a>` when URL exists; `<span>` with disabled style + tooltip when URL missing
- Questions reset when Space switches

**Commit already made (from prior session):**
- `feat: route title questions to market brief space` — staged only `perplexitySpaces.js` + `FixedQuestionsPanel.jsx`

**Current git status (uncommitted, at time of Session A's handoff):**
- `src/lib/perplexitySpaces.js` — has additional changes (PERPLEXITY_SPACES dict, helpers, STOCK_FAST_DECISION_QUESTIONS) beyond what was committed
- `src/components/shared/FixedQuestionsPanel.jsx` — has Space selector UI changes beyond what was committed
- `src/ai/quickCopyPrompts.js` — gershayim fix (see below)
- `src/ai/gemini/prompts/marketPrompt.js` — gershayim fix (see below)

---

### 2. What Was Audited but NOT Implemented

- `src/lib/fixedQuestionBank.js` — read for context, not modified
- `src/ai/gemini/schemas/morningBriefSchema.js` — read for context, not modified
- `src/ai/gemini/schemas/marketSchema.js` — read for context, not modified
- `src/lib/gemsConfig.js` — read for context, not modified
- `src/ai/gemini/gemContentRouter.js` — read for context, not modified
- `vite.config.js` — read for context, not modified

---

### 3. Bugs Found and Fixed

**GEMS JSON Gershayim Bug**

**Root cause:** Gemini Gem (external, at gemini.google.com) generates Hebrew market text with gershayim characters (e.g., `הנאסד"ק`, `האג"ח`) inside JSON string values, breaking JSON.parse.

**What was fixed in code:**

| File | Line | Change |
|---|---|---|
| `src/ai/quickCopyPrompts.js` | 175 | Gershayim rule expanded to include market terms: `נאסדק`, `אגח`, `תא` |
| `src/ai/gemini/prompts/marketPrompt.js` | 41–43 | Same expansion + stronger truncation rule |

**Important finding:** `marketPrompt.js` is NOT imported anywhere in the codebase. It's dead code. The actual active prompt is `buildGeminiNewsQuickPrompt` in `quickCopyPrompts.js`. The fix to `marketPrompt.js` is safe but has no runtime effect.

**What these fixes do NOT fix:**
- The `rawData` format JSON from the external Gem (gemini.google.com/gem/0e687d497bd3)
- JSON truncation from the Gem (the `"name":` cut-off at end of `stocksMentioned`)
- `Source: Deterministic Fallback` — this means Gemini API repair failed; check `GEMINI_API_KEY` in Base44

**The deterministic repair (client-side) already works** — it escapes gershayim via regex at `VideoDetailPanel.jsx:1720`. The gershayim fix in the prompts prevents it from happening in the first place for future API calls.

---

### 4. Current Status

| Item | Status |
|---|---|
| Space selector UI in FixedQuestionsPanel | ✅ Implemented, build passes |
| perplexitySpaces.js constants/helpers | ✅ Implemented |
| 12 Stock Fast Decision questions | ✅ Implemented |
| gershayim fix in quickCopyPrompts.js | ✅ Implemented |
| gershayim fix in marketPrompt.js | ✅ Implemented (unused file) |
| Commit for Space selector changes | ❌ NOT committed yet |
| External Gem gershayim fix | ❌ Requires manual update on gemini.google.com |
| JSON truncation fix | ❌ Requires Gem settings change (Max output tokens → 8192) |

---

### 5. Files Changed (Uncommitted, as of Session A)

```
M src/ai/gemini/prompts/marketPrompt.js      ← gershayim fix (unused file)
M src/ai/quickCopyPrompts.js                  ← gershayim fix (active fix)
M src/components/shared/FixedQuestionsPanel.jsx ← Space selector UI
M src/lib/perplexitySpaces.js                  ← constants + helpers
```

Other modified files (Morning Brief, Morning Brief Panels, etc.) — NOT touched in Session A. Pre-existing uncommitted state from before that session (which turned out to belong to Session B's Workspace work being open concurrently — see Session B below; **needs verification** which files belong to which session at merge time).

---

### 6. Important UX / Product Decisions

- **Stock sections auto-detect to Stock Fast Decision Space** — keywords: `מניות שהוזכרו`, `מניות`, `טיקר`, `טיקרים`, `stocks mentioned`, `ticker`, `tickers`
- **Active pill click = open Space** (not just indicate active state)
- **Inactive pill click = switch only** (does not open Space)
- **Questions reset on Space switch** — `selectedQIds` cleared in `handleSpaceChange`
- **Disabled Perplexity button** when Space has no URL — `<span>` with `cursor-not-allowed` + tooltip
- **Stock Fast Decision Space URL** is stored as a constant but exposed in UI (both Spaces visible)

---

### 7. Things That Must NOT Be Changed

- `src/lib/fixedQuestionBank.js` — section question mapping must not be touched
- `ANTHROPIC_API_KEY` must NOT have `VITE_` prefix (server-side only)
- `max_tokens: 8192` in Claude API settings (CLAUDE.md)
- `ANTHROPIC_MESSAGE_MS: 600_000` timeout
- `CHUNK_THRESHOLD: 15_000` for transcript chunking
- The `getDefaultPerplexitySpaceForSection` export alias in `perplexitySpaces.js` — backward compat

---

### 8. Open Issues / Next Steps

**Immediate**
1. **Commit the Space selector changes** — suggested message: `feat: add perplexity space selector with stock routing`
   - Stage only: `src/lib/perplexitySpaces.js` + `src/components/shared/FixedQuestionsPanel.jsx`
   - Do NOT stage: `marketPrompt.js`, `quickCopyPrompts.js`, Morning Brief files, `.claude/settings.json`
2. **Commit the gershayim fix** — suggested message: `fix: expand gershayim rule with market terms in quickCopyPrompts`
   - Stage only: `src/ai/quickCopyPrompts.js`
   - Optional: also stage `src/ai/gemini/prompts/marketPrompt.js` (safe but unused)
3. **Push to origin/main** → Base44 Pull → Verify in Production

**External (Gemini.com — cannot be done from code)**
4. Open the News Gem at `gemini.google.com/gem/0e687d497bd3`
5. Add to Gem system prompt:
   ```
   כלל חובה: אסור מרכאות (") בתוך ערכי מחרוזת.
   כתוב: נאסדק (לא נאסד"ק), אגח (לא אג"ח), תא (לא ת"א).
   חייב לסיים את כל ה-JSON — אסור לקטוע באמצע.
   ```
6. In Gem Settings → increase Max output tokens to 8192

**Verification Needed**
7. Check if `GEMINI_API_KEY` is set correctly in Base44 env vars — `Source: Deterministic Fallback` suggests AI repair is failing
8. Verify that `marketPrompt.js` is truly unused — grep for `buildMarketAnalysisPrompt` found no callers

---

### 9. Manual QA Checklist (after Base44 Pull)

Test "שאלות לפי כותרת" dialog:
- [ ] Open from "מניות שהוזכרו" → Stock Fast Decision selected by default, 12 stock questions visible
- [ ] Open from "חדשות" → Market Brief selected by default, news questions visible
- [ ] Click active (blue) pill → opens Perplexity Space in new tab
- [ ] Click inactive pill → switches questions, does NOT open Space
- [ ] Switch Space → selected questions reset to empty
- [ ] Footer Perplexity button → opens correct Space (whichever is active)
- [ ] Press Enter on active pill → opens Space

---

### 10. Handoff Summary (Session A)

**What's ready to commit:**
1. `src/lib/perplexitySpaces.js` + `src/components/shared/FixedQuestionsPanel.jsx` → Space selector feature
2. `src/ai/quickCopyPrompts.js` → gershayim fix

**Recurring GEMS JSON error:** The `הנאסד"ק`/`האג"ח` gershayim bug comes from the external Gemini News Gem. The app's deterministic repair already handles it (gershayim gets escaped), but the `stocksMentioned` data is lost due to truncation. Fix requires updating the Gem's system prompt on gemini.google.com — not solvable from code.

**Other open files** (Morning Brief, WorkspaceSaveReviewOverlay, etc.) have pre-existing uncommitted changes from before this session — verify their status before committing anything. (Resolved by Session B below: those Workspace files belong to a separate, concurrent Workspace redesign session.)

---

## Session B — Workspace Library Navigation Redesign

### 1. What was discussed in this session

A long, multi-phase engagement on the **Workspace Library** feature (React, Base44 platform, Hebrew RTL UI), run concurrently with Session A in a different window:

- UI audit comparing current Workspace Library screens to target designs
- Reuse `StockWatchlistView` inside `WorkspaceSaveReviewOverlay` for שוק ההון > מניות
- Visual redesign of the overlay layout (`WorkspaceContentCard`)
- Canonical virtual→real topic mapping for the draft-save default
- Multiple QA passes
- `StockWatchlistView` table polish (columns, typography, sentiment, source links)
- RTL alignment audit + fix for the stock symbol cell
- Full navigation redesign in phases 0–6 (tab-row reduction, compact filters, active filter chips, final visual polish)
- Two small follow-up UX fixes after phase 6 (see below)

### 2. What was implemented

**Phases 0–3 — navigation simplification**
- Reduced Workspace nav from 4 stacked tab rows to 2 real tab rows: Row 1 (main topic) and Row 2 (subtopic), both using the shared `WorkspaceTabRow` component.
- Converted "status" and "view mode" from tab rows into compact `<select>` elements.

**Phases 4–5 — filters**
- Added a compact filter bar: search, status (stocks only), source, view mode.
- Added active-filter chips, individually removable, plus "נקה הכל" (clear all).

**Phase 6 — visual polish**
- Merged what were two separately-bordered stacked control rows into one unified filter bar (spacing/typography/hierarchy pass).
- Kept "נקה סינון" (clears topic/subtopic nav) and "נקה הכל" (clears content filters) as two separate buttons after initially over-merging them (self-corrected — see §4).

**Follow-up fix A — stock-view label/default**
- In `WorkspaceSaveReviewOverlay.jsx`, the "topics" view option is labeled **"טבלת מניות"** instead of "לפי נושאים" whenever `isStocksView` is true (שוק ההון > מניות). Elsewhere it still reads "לפי נושאים".
- Added a `useEffect` keyed on the false→true transition of `isStocksView` that auto-selects the `'topics'` view (the one that renders the stock table) the moment the user navigates into שוק ההון > מניות, so they land on the table instead of whatever view (draft/recent/dates) was previously active. Manually switching to "לפי תאריכים" afterwards still works and sticks.

**Follow-up fix B — subtopic tab order**
- Reordered the `vt-markets` `subtopics` array in `workspaceVirtualTaxonomy.js` to: מניות, סקטורים, מאקרו, מסחר טכני, ניהול סיכונים, ETF/מדדים, קריפטו, סקירת שוק יומית, סנטימנט שוק.
- Moved the "כולם" (all) tab from being prepended to being appended, in both `WorkspaceLibrary.jsx` and `WorkspaceSaveReviewOverlay.jsx`, so it now renders last instead of first.
- No IDs changed, no data/localStorage/filtering-logic changes.

**Supporting infra (built earlier in the engagement, present in the committed batch)**
- `ConfirmDialog.jsx`, `EditWorkspaceItemModal.jsx`, `WorkspaceBulkActionBar.jsx`, `WorkspaceContentCard.jsx` (new files).
- Bulk operations added to the store/hook: `deleteWorkspaceItems`, `deleteAllWorkspaceItems`, `updateWorkspaceItemsBulk`, `archiveWorkspaceItems` (in `workspaceLibraryStore.js` / `useWorkspaceLibrary.js`).
- `StockDetailDrawer.jsx` gained inline edit/archive actions wired to the above.

### 3. What was audited but not implemented

- The original UX audit proposed a broader redesign; only phases 0–6 plus the two follow-up fixes were actually implemented. Anything discussed beyond that in the audit stage but not built — **needs verification** if a separate audit doc exists elsewhere (none found under `docs/`).
- A "sector" filter and additional advanced filters were mentioned as *possible* Phase 4 candidates but were **not** added — current filter bar only has search / status / source / view mode.

### 4. Bugs found and fixed

1. **White-screen crash on opening Workspace** — root cause: a "reset on open" `useEffect` in `WorkspaceSaveReviewOverlay.jsx` called setter functions (`setShowAddTab`, `setNewTabName`, `setNewTabEmoji`) that had been removed from scope during the Row 1 → `WorkspaceTabRow` migration, causing an uncaught `ReferenceError` on every dialog open. Fixed by deleting the 3 dangling lines. Verified live via Playwright (multiple entry paths, zero console errors after fix).
2. **RTL symbol-cell misalignment in `StockWatchlistView`** — an explicit `dir="ltr"` on the outer `<td>` was fighting the correct RTL `items-start` alignment. Fixed by removing the `dir="ltr"` from the outer cell and scoping it only to the ticker text itself.
3. **Sentiment regex never matched Hebrew** — `\b` word-boundary assertions in `BEARISH_RE`/`BULLISH_RE` never match around Hebrew letters (JS `\w` is `[A-Za-z0-9_]` only). Fixed by removing `\b` from the regexes (`workspaceStockItems.js`).
4. **`parseStockFromText` misclassified 2-part text** — "TICKER · note" was wrongly treated as "TICKER · companyName", duplicating the note as a fake company subtitle. Fixed by requiring 3+ parts before treating the second part as a company name.
5. **Fake "מניות" sector chip** — `sector` computation fell back to `item.category` (the Workspace *topic* name, not a market sector), showing a misleading chip under every symbol. Fixed by removing that fallback.
6. **`WorkspaceTabRow` add-button size regression** — the "+" trigger button was hardcoded small regardless of the `size` prop after the Row 1/Row 2 migration. Fixed by adding `addBtnSizeClass`.
7. **Phase 6 filter-bar visual fragmentation** — status/view-mode row and search/source/clear row were two separately-bordered stacked blocks, contradicting the "filter bar = one unit" goal. Merged into one unified container.
8. **Phase 6 scope over-reach (self-corrected, not a "found" bug)** — an initial edit merged "נקה סינון" and "נקה הכל" into one button, which was a behavior change beyond visual polish. Reverted to two separate buttons before reporting completion.

### 5. Current status

- **Committed:** commit `7fb02b0` — "refactor: simplify workspace navigation and filters" — contains phases 0–6 (nav/filter redesign, stock table polish, bulk-action infra, new dialogs).
- **Uncommitted (working tree):** the two follow-up fixes (stock-view label/default, subtopic tab order) are applied to:
  - `src/components/workspace/WorkspaceSaveReviewOverlay.jsx` (+14/-2 lines vs. `7fb02b0`)
  - `src/pages/WorkspaceLibrary.jsx` (+8/-4 lines)
  - `src/utils/workspaceVirtualTaxonomy.js` (+6/-2 lines)
  - These have **not** been committed yet — no commit was requested for them.
- **Other parallel session activity detected:** `git log` shows commits after `7fb02b0` (`c1febb8`, `6b242e1`, `e2be09b`, `53e5887`, `06968a7`) touching macro-mapping/specialized-tab logic and unrelated modules (`MacroGemDashboard.jsx`, `videoTabsConfig.js`) — made by yet another session/window, not Session A or B. Their content was not reviewed here — **needs verification** before assuming they don't interact with Workspace code.
- Last verified `npm run build` for the Workspace changes: **exit code 0**, no errors.
- Last verified live (Playwright) console check: **zero errors** across open/navigate/filter/fullscreen/stock-table flows.

### 6. Files changed or relevant files

Core Workspace navigation/filter files:
- `src/components/workspace/WorkspaceSaveReviewOverlay.jsx`
- `src/pages/WorkspaceLibrary.jsx`
- `src/components/workspace/WorkspaceTabRow.jsx`
- `src/components/workspace/WorkspaceContentCard.jsx` (new)
- `src/utils/workspaceVirtualTaxonomy.js`

Stock table / stock data:
- `src/components/workspace/StockWatchlistView.jsx`
- `src/components/workspace/StockDetailDrawer.jsx`
- `src/utils/workspaceStockItems.js`

Bulk actions / data layer:
- `src/hooks/useWorkspaceLibrary.js`
- `src/lib/workspaceLibraryStore.js`
- `src/components/workspace/ConfirmDialog.jsx` (new)
- `src/components/workspace/EditWorkspaceItemModal.jsx` (new)
- `src/components/workspace/WorkspaceBulkActionBar.jsx` (new)

Entry point to the Workspace Library page (**needs verification if unfamiliar**): the sidebar "Workspace" link opens a *different* page (`src/pages/Workspace.jsx`, the Brain-topics grid). The actual Workspace Library / stock table UI is reached from there via the "ספריית הסרטונים" button (`navigateTo("WorkspaceLibrary")`), or via the "⭐ Workspace" quick-save button from a video's selection/analysis flow (opens `WorkspaceSaveReviewOverlay`).

### 7. Important UX/product decisions

- **Two real tab rows only**: Row 1 = main topic, Row 2 = subtopic. Status and view mode are intentionally compact selectors, not tab rows — do not reintroduce them as tabs.
- **Filter bar is one unified visual unit** (status + view mode + search + source + clear), not stacked separately-bordered blocks.
- **"נקה סינון" and "נקה הכל" are deliberately separate actions** — נקה סינון clears topic/subtopic navigation, נקה הכל clears content filters (search/status/source). They were briefly merged into one button during Phase 6 polish and explicitly reverted back to two buttons — do not re-merge them without the user asking.
- **RTL flex quirk (important for anyone touching this layout again):** under `dir="rtl"`, for `flex-direction: row`, the *first DOM child renders rightmost*. For `flex-direction: column`, `items-start`/`items-end` (Tailwind) are direction-aware logical properties — `items-start` aligns right, `items-end` aligns left under RTL. This was verified empirically via Playwright bounding-box measurement, not assumed.
- **"טבלת מניות" is the stock-view-only label** for the same "topics" view key — the underlying view key (`'topics'`) and its behavior are unchanged; only the display label and default-selection timing changed.
- **"כולם" tab is now last** for every main topic's subtopic row (not just שוק ההון) — this was applied consistently across both `WorkspaceLibrary.jsx` and `WorkspaceSaveReviewOverlay.jsx` since they share one `WorkspaceTabRow` rendering pattern, rather than special-casing שוק ההון only.

### 8. Things that must not be changed (explicit user constraints across this session)

- Do not change `localStorage` keys: `workspace_library_v1`, `workspace_topics_v1`, `workspace_tab_preferences_v1`.
- Do not migrate data.
- Do not touch Brain / KnowledgeItems / `SaveToBrainModal`.
- Do not change save/delete/archive/edit handlers' behavior.
- Do not change `StockWatchlistView` internal logic (only its container/label context was touched elsewhere).
- Do not change topic/subtopic/tab IDs.
- Do not reintroduce extra tab rows for status or view mode.
- Keep changes scoped to exactly what's requested per phase — this session repeatedly self-corrected scope creep rather than bundling unrelated improvements.

### 9. Open issues / next recommended steps

- **Decide whether to commit the two follow-up fixes** (stock-view label/default + subtopic order) — currently uncommitted in the working tree. No commit message was requested yet.
- **Review the other parallel session's commits** (`c1febb8` → `06968a7`) for any overlap with Workspace files before doing further Workspace work — **needs verification**.
- **Untracked screenshots and a stray session-notes doc** sit at the repo root/`docs/` (`after-click.png`, `after-thumb.png`, `app-home.png`, `scroll-down.png`, `workspace-library-check.png`, `workspace-library-menu.png`, `docs/SESSION_CLOSURE_NOTES_2026_07_01_HEBREW_MARKET_STATUS_LABELS.md`) — unclear if these should be committed, deleted, or left as-is; **needs user decision**, not deleted here since deletion requires explicit permission.
- **Unrelated uncommitted Morning Brief / Perplexity changes** in the working tree belong to Session A (see above) — do not assume they're safe to discard; they represent separate, still-pending work.
- No further Workspace navigation phases are currently planned; the user has not requested anything beyond the two follow-up fixes documented here.

### 10. Final short handoff summary for the next Claude Code session

Workspace Library navigation was redesigned (phases 0–6, committed at `7fb02b0`) to use 2 tab rows + one unified compact filter bar + active filter chips, with the white-screen crash and several stock-table bugs fixed along the way. Two small uncommitted follow-up fixes are sitting in the working tree: (1) the stock view now shows/label defaults to "טבלת מניות" and auto-opens on entering שוק ההון > מניות, and (2) the שוק ההון subtopic tabs are reordered with "כולם" moved to last. Build is clean, live QA showed no console errors. Before continuing: check whether to commit the two pending fixes, and review the other parallel session's commits (`c1febb8`–`06968a7`) for any overlap. Do not touch localStorage keys, Brain/KnowledgeItems, or `StockWatchlistView` internals without a fresh explicit request. Note this repo currently has **at least 3 concurrent sessions'** uncommitted work interleaved in the working tree (Session A's Perplexity/GEMS fixes, Session B's Workspace fixes, and a third session's macro-mapping commits) — reconcile carefully before any bulk commit or `git clean`.
