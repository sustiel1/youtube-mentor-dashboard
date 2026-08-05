# Session Handoff — 2026-07-12

> This file aggregates handoff notes from **multiple concurrent Claude Code sessions/windows** open on 2026-07-12. Each session's notes are kept as a separate dated section below so closing any one window doesn't lose the others' context. Newest session is added at the bottom of this index; read the section matching what you're resuming.

**Sessions in this file:**
- [Session A — Perplexity Space Selector + GEMS JSON Repair](#session-a--perplexity-space-selector--gems-json-repair)
- [Session B — Workspace Library Navigation Redesign](#session-b--workspace-library-navigation-redesign)
- [Session C — Workspace Bulk Action Bar + Morning Brief Section Select-All + Dedup Fixes](#session-c--workspace-bulk-action-bar--morning-brief-section-select-all--dedup-fixes) *(index entry found pre-existing; no matching section body was present in this file as of Session D's edit — needs verification, possibly still being written by another window)*
- [Session D — Specialized Tab Macro Mapping Audit & Fix](#session-d--specialized-tab-macro-mapping-audit--fix)
- [Session E — Foundational WorkspaceTabRow + workspaceTabPreferences + WorkspaceLibrary Redesign + Full GEMS JSON Safety](#session-e--foundational-workspacetabrow--workspacetabpreferences--workspacelibrary-redesign--full-gems-json-safety)

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

---

## Session C — Workspace Bulk Action Bar + Morning Brief Section Select-All + Dedup Fixes

### 1. What Was Discussed

**Part A — QA Pass (no code changes):**
Focused audit of "always-visible action buttons" across WorkspaceLibrary cards, WorkspaceSaveReviewOverlay rows/cards, StockWatchlistView rows, HistoryMentionCard. All 12 checklist items passed. No bugs found.

**Part B — Workspace Bulk Action Bar:**
Add a bottom selection bar to WorkspaceLibrary (fixed) and WorkspaceSaveReviewOverlay (dialog). Dark `bg-zinc-900` style matching `UniversalTabSelectionBar`. Actions: copy, archive, delete (ConfirmDialog), clear selection, CSV export. Explicitly excluded: AI questions, TradingView, Brain.

Also implemented (inferred from git diff — likely parallel work in same window):
- Morning Brief section-level "בחר הכל" button per section
- Specialized news/sector dedup helpers (same shallow-merge failure as macroFactors fix)
- MacroGemDashboard `sectorRotation` fallback
- `morningBriefNewsNormalize` `event` field fix

---

### 2. What Was Implemented

**`src/components/workspace/WorkspaceBulkActionBar.jsx`** (tracked — was created in Session B infra)
- `formatWorkspaceItemsForCopy(items)` — readable Hebrew text (📈 stocks / 📹 videos)
- `exportWorkspaceItemsToCsv(items, filename)` — 8-column CSV with UTF-8 BOM
- `WorkspaceBulkActionBar` component — hidden when `count===0`; `fixed` prop controls placement

**`src/pages/WorkspaceLibrary.jsx`**
- `handleCopySelected` + `handleExportCsvSelected` handlers
- Replaced old inline blue/indigo bulk bar with `<WorkspaceBulkActionBar fixed />`
- `pb-20` on `<main>` during selection
- "כולם" tab moved to last position (Session B follow-up)

**`src/components/workspace/WorkspaceSaveReviewOverlay.jsx`**
- `selectedOverlayIds` (Set) + `confirmBulkDeleteOverlay` state
- Checkboxes on `LibraryItemCard` (compact + non-compact) — first DOM child in RTL flex
- All 4 `LibraryItemCard` + 4 `FolderGroup` callsites updated
- `<WorkspaceBulkActionBar>` (no `fixed`) as flex-shrink-0 sibling in `DialogContent`
- `<ConfirmDialog>` for bulk delete — explicitly says Brain/KnowledgeItems unaffected
- Auto-switch to `topics` view on first entry to stocks (Session B follow-up)
- `topics` tab label → "טבלת מניות" when `isStocksView` (Session B follow-up)
- "כולם" tab moved to last (Session B follow-up)

**`src/lib/morningBriefBulkSections.js`**
- `resolveMorningBriefSectionChildItems(sections, sectionKey)` — items as `{id, text, sectionLabel, type, tabScope}`
- `resolveMorningBriefCombinedSectionChildItems(sections, sectionKeys)`

**`src/components/dashboard/MorningBriefVisualPrimitives.jsx`**
- New `SectionSelectAllButton` — "בחר הכל / נקה" pill
- `SectionCard` accepts `sectionSelectAllItems` + `bulkSelection` props

**`src/components/dashboard/MorningBriefPanels.jsx`**
- `sectionSelectAllItems` + `bulkSelection` props wired to 5 sections: MarketRegime, Markets, SectorOverview, News, Macro

**`src/config/videoTabsConfig.js`**
- `resolveSpecializedNewsItems` + `resolveSpecializedSectorItems` exported resolvers
- Union helpers reading all known GEM JSON paths (prevents shallow-merge clobbering)

**`src/components/dashboard/MacroGemDashboard.jsx`**
- `sectors`: `get('sectors') || get('sectorRotation')` — fixes GEM JSON that uses `sectorRotation`

**`src/lib/morningBriefNewsNormalize.js`**
- `normalizeFromObject`: added `'event'` to title `pickString` fields

---

### 3. Bugs Found and Fixed

| File | Bug | Fix |
|---|---|---|
| `MacroGemDashboard.jsx` | Sectors empty when GEM uses `sectorRotation` key | `get('sectors') \|\| get('sectorRotation')` |
| `morningBriefNewsNormalize.js` | Items with `event` key had no title | Added `'event'` to `pickString` |
| `videoTabsConfig.js` | Specialized news/sectors clobbered by shallow merge | Union helpers reading all GEM JSON paths |

---

### 4. Safety Constraints (Must Not Violate)
- No localStorage key changes
- No Brain / KnowledgeItems / SaveToBrainModal changes
- `deleteItems(ids)` — only deletes `selectedOverlayIds` IDs; no aggregated row collateral
- No AI questions / TradingView / Brain actions on the bulk bar
- Dialog bar: no `fixed` prop — flex-shrink-0 inside dialog

---

### 5. UX Decisions
- Bar style: dark `bg-zinc-900`, management actions (archive/delete) not save actions
- Dialog bar: flex-shrink-0 AFTER scrollable div, BEFORE `</DialogContent>`
- Full-page bar: `fixed bottom-0 left-0 right-0` + `pb-20` on `<main>`
- RTL checkboxes: first DOM child = visual right; placed as first children in LibraryItemCard
- Section Select-All: only shows when `sectionSelectAllItems` non-empty AND handlers exist
- `selectedOverlayIds` fully separate from `StockWatchlistView.selectedIds`

---

### 6. Manual QA Checklist (after commit + Base44 Pull)
- [ ] WorkspaceLibrary: select → dark bar at page bottom → all actions work
- [ ] WorkspaceSaveReviewOverlay: checkboxes on all cards → bar at dialog bottom → actions work
- [ ] Confirm dialog mentions "לא משפיע על Brain"
- [ ] Stocks view: entering שוק ההון→מניות lands on "טבלת מניות" tab
- [ ] "כולם" tab appears last in subtopic row
- [ ] Morning Brief: "בחר הכל" pill appears in section headers during bulk mode

---

### 7. Final Handoff Summary (Session C)

Added Workspace Bulk Action Bar (copy/archive/delete/CSV in both WorkspaceLibrary and WorkspaceSaveReviewOverlay), Morning Brief section-level "בחר הכל" (5 sections), and specialized dedup fixes (sectorRotation fallback, event field in normalizer, union helpers for news/sectors). Session B's follow-up fixes (stocks auto-nav, "כולם" tab last) incorporated here. Build: EXIT:0. All changes uncommitted.

**Suggested commit:**
```
feat: workspace bulk action bar + section select-all + specialized dedup fixes
```
Stage: `src/components/workspace/`, `src/pages/WorkspaceLibrary.jsx`, `src/components/dashboard/`, `src/lib/morningBriefBulkSections.js`, `src/config/videoTabsConfig.js`, `src/utils/workspaceVirtualTaxonomy.js`

---

## Session E — Foundational WorkspaceTabRow + workspaceTabPreferences + WorkspaceLibrary Redesign + Full GEMS JSON Safety

**Commit:** `46f1f72` — feat: redesign workspace layout and add configurable tab rows (2026-07-11 13:13)
**Note:** This session laid the foundation that Sessions B and others subsequently extended.

### 1. What was discussed

Two tracks, run in one session:

**Track A — GEMS JSON Repair Prevention**
User shared a "GEMS JSON Repair Report" showing that Gemini-generated `marketBrief` JSON was corrupted by:
- Hebrew gershayim (`"` / `"`) in abbreviations like `אג"ח`, `ח"כ`, `ז"ל` breaking JSON string delimiters
- JSON truncated mid-value (e.g., `"notes": "משילה 10.` — INTC notes cut off)
- Embedded raw JSON injected inside a string value
- Missing closing brackets `}}`

**Track B — Workspace Library Redesign**
User provided a spec to redesign Workspace Library with:
- Modern card-based layout (gradient bg, rounded-2xl cards, soft shadows, RTL)
- `+ הוסף טאב` button in all 3 tab rows
- Reusable `WorkspaceTabRow.jsx` component (3 sizes × 3 accent colors)
- Improved filter card with tags row and source row

**Safety constraints (must be preserved in all future sessions):**
- Do not change `workspace_tab_preferences_v1` localStorage key
- Do not migrate existing data
- Do not touch Brain / KnowledgeItems / SaveToBrainModal
- Keep all changes additive and backward-compatible

### 2. What was implemented

**GEMS JSON safety rules added to all 4 prompt files:**

| File | Lines added |
|---|---|
| `src/ai/gemini/prompts/generalPrompt.js` | 2 — gershayim ban + truncation ban |
| `src/ai/gemini/prompts/marketPrompt.js` | 3 — gershayim ban + truncation ban + embedded-JSON ban |
| `src/ai/gemini/prompts/politicalPrompt.js` | 2 — gershayim ban (ח"כ/מ"מ/ז"ל specific) + truncation ban |
| `src/ai/quickCopyPrompts.js` | 5 — full JSON safety block in `buildGeminiNewsQuickPrompt` (active Gems prompt) |

Rule injected: `אסור מרכאות (") בתוך ערכי מחרוזת. כתוב: אגח, חכ, זל. סיים את כל ה-JSON כולל הסגריות. אסור JSON גולמי בתוך ערך מחרוזת.`

**New file: `src/components/workspace/WorkspaceTabRow.jsx`**
Reusable tab strip component. Props: `tabs`, `activeValue`, `onSelect`, `onAddTab`, `size` (lg/md/sm), `accentColor` (indigo/violet/teal), `addLabel`. Includes inline add-tab form with autoFocus, Enter/Escape. Later modified by Session B (`7fb02b0`).

**Extended: `src/utils/workspaceTabPreferences.js`**
- `defaultPrefs()` gains: `customSubtopics: {}`, `customWorkflowTabs: []` (backward-compatible spread)
- `workspace_tab_preferences_v1` key unchanged
- New exports: `getCustomSubtopics`, `addCustomSubtopic`, `removeCustomSubtopic`, `getCustomWorkflowTabs`, `addCustomWorkflowTab`, `removeCustomWorkflowTab`

**Redesigned: `src/pages/WorkspaceLibrary.jsx`** (later extended by `a3cd53d` and `7fb02b0`)
- Modern sticky header (X, ⭐, item count badge, "ניהול נושאים", ⋮ menu)
- White navigation card containing 3 tab rows:
  - Row 1 (lg, indigo): built-in + custom tabs with emoji picker, "⚙ ערוך טאבים" manage panel
  - Row 2 (md, violet): `WorkspaceTabRow` for subtopics, `onAddTab={handleAddCustomSubtopic}`, shown when main topic selected
  - Row 3 (sm, teal): `WorkspaceTabRow` for workflow/status, `onAddTab={handleAddCustomWorkflowTab}`, shown only for `vt-markets > vts-stocks`
- Filter card with search, flag toggles (⭐/🔴/🔁), archive toggle, sort select
- Tags row, source tabs row
- Empty state, StockWatchlistView, card grid

### 3. Bugs found and fixed

| Bug | Fix |
|---|---|
| `אג"ח`/`ח"כ` in Gemini output breaks `JSON.parse` | Added gershayim ban rule to all 4 prompts |
| Gemini truncates JSON mid-value | Added "close all brackets" rule |
| Gemini embeds raw JSON inside a string value | Added embedded-JSON ban rule |

### 4. Things that must not be changed

- `workspace_tab_preferences_v1` localStorage key — never rename
- `{ ...defaultPrefs(), ...JSON.parse(raw) }` spread pattern — ensures backward compat with older stored prefs
- `VIRTUAL_TAXONOMY` IDs (`vt-markets`, `vts-stocks`, etc.) — hardcoded in filter logic
- AI prompt JSON safety rules — removing them re-introduces the gershayim corruption bug
- `ANTHROPIC_API_KEY` without `VITE_` prefix — server-side only (project CLAUDE.md)
- `max_tokens: 8192` and `ANTHROPIC_MESSAGE_MS: 600_000` in vite.config.js

### 5. Current status at session close

- Build: ✅ exit code 0, `dist/` updated (JS 2485KB, CSS 217KB, PDF chunk 461KB)
- Commit `46f1f72`: ✅ pushed to main
- This session's changes were subsequently extended by `a3cd53d` (visible card actions) and `7fb02b0` (full nav refactor, Sessions B's work)
- Uncommitted working tree at close: 14 files modified (see Session B §5 for current list — it includes this session's unpushed MorningBrief/perplexitySpaces changes from Session A which were open concurrently)

### 6. Short handoff summary

This session created the building blocks (`WorkspaceTabRow.jsx`, extended `workspaceTabPreferences.js`) and the initial modern redesign of `WorkspaceLibrary.jsx` (3-row tab hierarchy, card layout, filter row). It also added Hebrew gershayim + JSON truncation prevention rules to all 4 Gemini prompt files. All changes were committed in `46f1f72`. Sessions B subsequently extended the work significantly (nav simplification, stock table polish, bulk actions). The GEMS JSON fix is prompt-only; the deterministic fallback in `VideoDetailPanel.jsx:1720` still handles corrupt output defensively and was not changed. Needs QA: verify gershayim no longer appears in Gemini Gems output, and that the 3-row tab UI renders correctly in Base44 Production after a Git Pull.

---

## Session D — Specialized Tab Macro Mapping Audit & Fix

*(This is likely the "third session's macro-mapping commits" referenced elsewhere in this file. A "Session C" index entry also points at "Workspace Bulk Action Bar + Morning Brief Section Select-All + Dedup Fixes" — as of this edit, no matching Session C body existed yet in this file; it may still be mid-write in another window.)*

### Session Summary

Audit and fix of the data-mapping pipeline feeding the **Specialized** tab's **Macro** section. A morning-brief GEM JSON (10.7.26 fixture) contained 3 macro factors in `rawData.macroFactors`, but the rendered UI showed only a fraction of them, with the crypto factor (Bitcoin + Ethereum) missing entirely and the Fed item losing its explanatory detail. Full audit findings, root-cause detail, and before/after evidence live in [docs/MACRO_SPECIALIZED_MAPPING_AUDIT.md](MACRO_SPECIALIZED_MAPPING_AUDIT.md) — not duplicated here.

### 1. What Was Discussed

- A 12-point audit request covering: where GEM JSON is normalized, where `rawData`/`universalTabs.specialized` are read, whether `metadata.mappingHints.specializedSources` filters anything, where category classification happens, whether ticker detection reclassifies macro items into Stocks/Markets, whether dedup removes items across categories, and why the pipeline produced 3 raw → 2 specialized → only 1 rendered macro item.
- Also asked to check suspicious GEM ticker outputs (`BUG` for SK Hynix, `CRDL` for Circle, `WDF` for WD-40, `S1` for SentinelOne) without blindly "fixing" aliases.

### 2. What Was Implemented

Commits on `main`, in order:

1. **`c1febb8`** — `test: add regression fixture for Specialized-tab macro mapping bug`
   - `scripts/fixtures/macro-specialized-regression.fixture.mjs` (new)
   - `scripts/test-macro-specialized-regression.mjs` (new) — 11 assertions, 3 macro items required
   - `scripts/test-macro-mapping-compat.mjs` (new) — backward-compat smoke test
   - `scripts/register-src-aliases.mjs` + `scripts/src-alias-loader.mjs` (new) — Node ESM `'@/'` → `src/` resolve hook so these scripts import the real `src/lib/*` modules directly instead of hand-copying logic

2. **`6b242e1`** — `fix: stop dropping/truncating Specialized-tab macro factors`
   - `src/lib/morningBriefDisplay.js` — full file
   - `src/config/videoTabsConfig.js` — full file (at the time of this commit; has since gained further uncommitted changes from another window — see §5)
   - `src/components/dashboard/MorningBriefPanels.jsx` — **only** the macro-related hunk (import + `mergeMacroDisplayRows`), not the whole file — the select-all work already in this same file was deliberately left uncommitted and untouched
   - `src/lib/morningBriefBulkSections.js` — **only** the macro-related hunk, not the whole file — same care taken

3. **`e2be09b`** — `docs: document specialized macro mapping audit`
   - `docs/MACRO_SPECIALIZED_MAPPING_AUDIT.md` (new) — full audit writeup

**Fix summary** (full detail in the audit doc): three independent bugs compounded —
1. `normalizeMacroIndicatorRow()` didn't recognize the `factor` field (only `name/symbol/indicator/ticker/stock`) → indicator fell back to `'—'` → `_isMalformedIndicatorName()` silently deleted the whole item, including its `note` text. This is why the crypto factor (no specialized counterpart) vanished completely.
2. `resolveSpecialized()` in `videoTabsConfig.js` does a shallow `{ ...rawData, ...specialized }` spread — `specialized.macroFactors` silently *replaces* (not merges with) `rawData.macroFactors`.
3. `formatMacroItem()` (also `videoTabsConfig.js`) never read `status`/`note` — only `event/title/name` for the heading and `impact/...` for the body — so even surviving items rendered as a bare headline.

Fix: recognize `factor` as an indicator field; dedup by a **semantic topic key** (`macroSemanticKey` — fed-policy / credit-rating / crypto-market / dollar / oil / inflation / jobs / volatility / bond-yield, else first two significant words) instead of exact-string match, keeping the richer (`macroRowRichness`) row; explicit union of `rawData.macroFactors` + `specialized.macroFactors` in the `brief-macro` case; `formatMacroItem` now reads `factor`/`status`/`note`/`comment`. All additive — no GEM schema change, no data migration.

### 3. What Was Audited but NOT Implemented

- **GEM ticker mis-mapping** (`BUG`, `CRDL`, `WDF`, `S1`) — verified no alias-map exists in the codebase (`finvizLinks.js` and related files checked) that produces these; they come from the GEM/AI's own output. **Not fixed** — would require a GEM prompt change, out of scope.
- **`metadata.mappingHints.specializedSources`** — verified it is dead metadata: grepped the whole `src/` tree, the only reference is a diagnostic string-match in `VideoDetailPanel.jsx` (detecting JSON-repair leakage), not an actual filter. Not extended, since doing so would have zero effect on the bug.
- **Full architectural unification** of the two parallel merge implementations (`mergeMorningBriefSpecializedSource` in `morningBriefDisplay.js` vs. `resolveSpecialized` in `videoTabsConfig.js`) — only the `macroFactors` case was fixed. A broader unification was not attempted (not proven necessary for this bug).

### 4. Bugs Found and Fixed

See §2 above and the full table/detail in `docs/MACRO_SPECIALIZED_MAPPING_AUDIT.md`. Also clarified: the appearance that "Oracle moved to Stocks" / "Bitcoin moved to Markets" is an **illusion** — `extractUnifiedStocks`/`extractMarketDashboardRows`/`extractKeyLevelRows` read independently from `stocksMentioned`/`indices`/`keyLevels` and were never affected; the Macro section simply lost its own copy of that information. No cross-category "consume once" logic exists or was added.

### 5. Current Status

- All 3 commits above are on `main`, **not pushed**.
- `scripts/test-macro-specialized-regression.mjs` and `scripts/test-macro-mapping-compat.mjs` — re-verified **PASS** at the end of this session (re-run after other uncommitted changes accumulated in `videoTabsConfig.js` — see below — confirmed no interference).
- `scripts/test-morning-brief-routing.mjs` (pre-existing, 88 checks) — still PASS.
- `npm run build` — passed (exit 0) during this session.
- **needs verification** — two commits landed on `main` *after* `e2be09b`, apparently from another session/window: `53e5887` (`fix: add fresh analysis option to deleted video recovery`) and `06968a7` (`fix: use multiSelectClear() instead of undefined setMultiSelected`). Not reviewed in this session — verify before push.
- **needs verification** — `src/config/videoTabsConfig.js` has **additional uncommitted changes** beyond the committed fix, added by another window: `collectSpecializedArrayLayers`, `unionByIdentityPreferRicher`, `resolveSpecializedNewsItems`, `resolveSpecializedSectorItems`, `formatNewsItem`, `formatSectorItem`. Per an inline comment in that code ("Same failure mode as the macroFactorsUnion fix above"), this extends the *same fix pattern* from this session's macro work to `marketNews` and `sectorRotation`. **Not written or reviewed in this session** — no regression fixture exists for it yet.

### 6. Files Changed / Relevant Files

**Changed by this session (committed):**
- `src/lib/morningBriefDisplay.js`
- `src/config/videoTabsConfig.js` (as of commit `6b242e1` — see §5 for changes made *since*, by another window)
- `src/components/dashboard/MorningBriefPanels.jsx` (macro hunk only)
- `src/lib/morningBriefBulkSections.js` (macro hunk only)
- `scripts/fixtures/macro-specialized-regression.fixture.mjs`, `scripts/test-macro-specialized-regression.mjs`, `scripts/test-macro-mapping-compat.mjs`, `scripts/register-src-aliases.mjs`, `scripts/src-alias-loader.mjs`
- `docs/MACRO_SPECIALIZED_MAPPING_AUDIT.md`

**Relevant background reading (not changed this session):**
- `docs/MORNING_BRIEF_SPECIALIZED_OUTPUT_AUDIT.md`, `docs/MORNING_BRIEF_SPECIALIZED_OUTPUT_FIXES.md` — an earlier (2026-06-30) audit/fix pass on the same tab, different symptoms (card/row duplication, sentiment label leakage, Dixie/US10Y dedup).
- `docs/GEMS_TAB_MAPPING_REGRESSION_RULES.md` — source-of-truth reference for the GEM→Universal Tabs data hierarchy.

**Uncommitted at end of session (not touched by this session; belongs to another session/window — do not assume ownership):**
`.claude/settings.json`, `docs/SECTION_HEADER_COUNT_RULE.md`, `src/components/dashboard/MacroGemDashboard.jsx`, `src/components/dashboard/MorningBriefPanels.jsx` (the non-macro "select-all" hunks), `src/components/dashboard/MorningBriefVisualPrimitives.jsx`, `src/components/shared/FixedQuestionsPanel.jsx`, `src/components/workspace/WorkspaceSaveReviewOverlay.jsx`, `src/lib/morningBriefBulkSections.js` (the non-macro "select-all" hunks), `src/lib/morningBriefNewsNormalize.js`, `src/lib/morningBriefPresentation.js`, `src/lib/perplexitySpaces.js`, `src/pages/WorkspaceLibrary.jsx`, `src/utils/workspaceVirtualTaxonomy.js`, and — as of the end of this session — additional hunks in `src/config/videoTabsConfig.js` (see §5).

### 7. Important UX / Product Decisions

- **Cross-category duplication is intentional**: the same event (e.g. Oracle, Bitcoin) may legitimately appear under Macro *and* Stocks/Markets. Never remove information from one category just because it also appears in another.
- **Dedup only within the same category**, and only when content is semantically equivalent — not exact-string equivalent (rawData and specialized often paraphrase the same event differently).
- **Always prefer the richer/more detailed version** when merging a semantic duplicate between `rawData` and `universalTabs.specialized` — never silently downgrade to a shorter version.
- **Don't touch ticker values** without first verifying which layer produced them (GEM output vs. mapping code) — see §3.

### 8. Things That Must NOT Be Changed

- Morning Brief Title Override rules (`TITLE_OVERRIDE_RULES` in `gemRecommender.js`, `MORNING_BRIEF_KEYWORDS` in `videoTabsConfig.js`) — documented as a "Hard Rule" in `docs/GEMS_TAB_MAPPING_REGRESSION_RULES.md`.
- `filterDiagnosticItems`/`isDiagnosticItem` — must stay applied everywhere GEM arrays are extracted, to prevent repair-diagnostic text from leaking into the UI.
- The approved AI settings in `vite.config.js` (`max_tokens: 8192`, `ANTHROPIC_MESSAGE_MS: 600_000`, `CHUNK_THRESHOLD: 15_000`, etc.) — documented in the project `CLAUDE.md` as manually verified; not touched this session, do not change without explicit approval.
- The pre-existing uncommitted "select-all" feature work in `MorningBriefPanels.jsx`/`morningBriefBulkSections.js` (`resolveMorningBriefSectionChildItems`, `sectionSelectAllItems`) — deliberately left untouched; belongs to another session (possibly the promised "Session C").

### 9. Open Issues / Next Recommended Steps

1. **needs verification** — review the uncommitted `videoTabsConfig.js` extension (news/sectors union-by-identity, §5) before it's lost or before building on top of it; consider a regression fixture for it similar to the macro one.
2. **needs verification** — confirm commits `53e5887` and `06968a7` (from another session) are intentional and correct before pushing `main`.
3. **needs verification** — locate or reconstruct the "Session C" content promised in this file's index (Workspace Bulk Action Bar + Morning Brief Section Select-All + Dedup Fixes) — no matching section body existed in this file as of this edit.
4. **Not pushed** — `c1febb8`, `6b242e1`, `e2be09b` are local-only; decide on push timing (likely after items 1–3 are resolved).
5. GEM ticker mis-mapping (`BUG`/`CRDL`/`WDF`/`S1`) remains unfixed — requires a GEM prompt change, not a code change.
6. Before closing any other open window/session, confirm nothing in its working tree would be lost — none of it was touched here, but none of it is safely committed either.

### 10. Final Short Handoff Summary

Fixed a 3-bug pipeline issue that dropped/truncated macro factors in the Specialized tab (full detail: `docs/MACRO_SPECIALIZED_MAPPING_AUDIT.md`). Fix + regression tests + docs are committed (`c1febb8`, `6b242e1`, `e2be09b`) but **not pushed**. Ticker mis-mapping and `mappingHints` were investigated and intentionally left unchanged (out of scope / dead code respectively). **Before continuing:** `videoTabsConfig.js` has further uncommitted changes (apparently from another window) extending the same fix pattern to news/sectors — review those before building on top of them; confirm the two newer `main` commits from another session are intentional before pushing; and this file's index currently references a "Session C" whose body wasn't found here — reconcile with whichever window owns that work before editing this file further.
