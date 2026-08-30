# Codex Handoff — פיצול ידע מבזק — קבוע מול יומי — תכנון בלבד — YouTube Mentor Dashboard

משימה זו היא **תכנון/עיצוב בלבד**: לקחת את מסמך העיצוב הקיים `docs/LIVE_STREAM_BRIEF_PERMANENCE_SCHEME.md` (נוצר בסשן הזה) ולבצע עליו REVIEW, PRESSURE-TEST והשלמה — לא להתחיל מאפס ולא לגעת בקוד. המטרה: להפריד ידע **קבוע** (כללי מסחר חוזרים, דפוסי סיכון, תובנות שיטה) מתוכן **יומי/מתכלה** (מניות למעקב, סנטימנט היום) בסיכומי "מבזק לייב פתיחה", כדי שספריית ה-Obsidian לא תצבור רעש מיושן. ה-`cto` כבר קבע שזו **הרחבה** של ניתוב Obsidian קיים, לא קטגוריית ניתוב חדשה, ושהמימוש בפועל (בהמשך, אחרי אישור העיצוב) שייך ל-`obsidian-sync-engineer`. Codex מקבל כאן רק את שלב התכנון: לסגור את 5 השאלות הפתוחות בסעיף 5, לחתום על טבלת ברירות המחדל section→permanence, לחתום על מבנה פתק הפלייבוק ומנגנון התפוגה/ארכוב היומי, ולפרט את שינויי הסכמה והסמן (marker) המדויקים — הכול ברמת עיצוב, ללא קוד.

## Task Identity
- Project: YouTube Mentor Dashboard
- WORK-ID: YMD-BRIEF-PERMANENCE-SPLIT
- WORK-ID status: PROPOSED — requires user approval
- Session: SESSION-TITLE: פיצול ידע מבזק — קבוע מול יומי — תכנון בלבד — YouTube Mentor Dashboard
- Date: 2026-08-30
- Branch: docs/markdown-governance-cleanup
- HEAD: 4c981ec81dd4ba66a1237833ad2d036a3a66415c
- Worktree: C:/Users/11/Desktop/Workspace/new-project/projects/youtube-mentor-dashboard
- Working tree: 5 modified, 2 untracked — none owned by this task except the design doc.
  - M package-lock.json (unrelated WIP)
  - M package.json (unrelated WIP)
  - M scripts/market-asset-descriptions-qa.mjs (unrelated market-asset-links WIP)
  - M scripts/market-asset-provider-links-qa.mjs (unrelated market-asset-links WIP)
  - M src/components/workspace/StructuredSnapshotView.jsx (unrelated WIP)
  - ?? docs/LIVE_STREAM_BRIEF_PERMANENCE_SCHEME.md (THIS TASK's design doc — untracked draft)
  - ?? src/components/shared/MarketAssetLinksMenu.jsx (unrelated market-asset-links WIP — do not touch)

## Ready-to-Send Codex Request
Continue in the "YouTube Mentor Dashboard" project under WORK-ID YMD-BRIEF-PERMANENCE-SPLIT and session "SESSION-TITLE: פיצול ידע מבזק — קבוע מול יומי — תכנון בלבד — YouTube Mentor Dashboard". This is a design/planning task only: review, pressure-test and complete the existing design document `docs/LIVE_STREAM_BRIEF_PERMANENCE_SCHEME.md`. Resolve and close the 5 open questions in section 5; finalize the section→permanence default table (section 2.4); finalize the standing playbook note structure and the daily-note expiry/archive mechanism (sections 2–3); and specify the exact additive `obsidianItemSaveStore` schema fields and the additive `ymd-meta` marker line, tracing each new field through every consumer (the `includes()`-based dedupe in `obsidianNoteMerge.js`, the "saved" indicator in `obsidianItemSaveStore.js`, and the planned expiry sweep). Keep everything design-level — do not modify any application code, and do not add or change any `scripts/*-qa.mjs`. Preserve unrelated work, make only the smallest compatible change (edit only the design doc), and base your work on a new branch off `main`. Do not call paid AI/GEMS services. Do not commit, push, merge, deploy, publish, or run Base44 sync without explicit approval.

## Current State
- The Obsidian item-merge pipeline for "מבזק לייב פתיחה" is already active and verified in the design doc's audit: title containing `מבזק לייב פתיחה` classifies as `morningBrief`, routes to `שוק ההון`, and `buildMorningBriefBulkSections()` in `src/lib/morningBriefBulkSections.js` already emits the 7 task categories (Action Checklist, Risks, Key Insights, Watch Today, Market State, 30-Second Summary, Full Summary).
- Flow: `src/lib/morningBriefBulkSections.js` → `collectVideoObsidianMergeItems()` in `src/lib/obsidianVideoMergeItems.js` → `mergeItemsIntoObsidianNote()` in `src/lib/obsidianNoteMerge.js` → `src/lib/obsidianVaultMergeWrite.js` (`/api/vault/write?mode=merge`) → tracked in `src/lib/obsidianItemSaveStore.js` (`yt_obsidian_item_saves_v1`, localStorage).
- Per-item record today stores `videoId, tabKey, sectionKey, text, destinationPath, savedAt`; identity key = `videoId + tabKey + sectionKey + text-hash(60) [@ path]`. `date` / `source` / `channel` live only in note frontmatter, not per item.
- `docs/LIVE_STREAM_BRIEF_PERMANENCE_SCHEME.md` exists as an **untracked draft** with sections 1–7: audit (1), proposed extension (2), promotion/merge plan (3), constraints (4), 5 open questions (5), WORK-ID + proposed ledger row (6), phased plan (7).
- Unresolved in the draft: the 5 open questions in section 5 (single playbook vs note-per-category; permanence default vs always-ask; near-duplicate auto-merge vs manual queue; expiry sweep as script vs DEV button; whether "live stream market analysis" is the same format as `morningBrief` or a separate channel format). The section 2.4 default table and the marker/schema extension are drafted but not finalized.

## Already Decided / Already Done
- This is an **extension** of existing Obsidian item routing, **not** a new routing category. `morningBrief` already classifies and routes correctly. Do not reopen this.
- No new routing engine and no parallel store. The design must reuse `mergeItemsIntoObsidianNote`, `obsidianVaultMergeWrite`, `/api/vault/*`, `obsidianItemSaveStore`, and `OBSIDIAN_FOLDER_CATALOG`. Do not redesign around a new pipeline.
- `src/lib/obsidianRouting.js` (video-level `V-<slug>.md` taxonomy route) and `src/lib/obsidianExport.js` (keyword/catalog engine: `OBSIDIAN_FOLDER_CATALOG`, `resolvePrimaryTopic`) are identified as the correct loci: a new `שוק ההון/מבזקים` folder entry and the standing playbook (under the existing `צ'קליסטים`) are declared in `obsidianExport.js`'s catalog. `obsidianRouting.js` is NOT the item path.
- All new schema fields must be optional / backwards-compatible. The marker extension must be additive — a second `<!-- ymd-meta: ... -->` comment that the current `includes()`-based dedupe ignores.
- No new localStorage key. Introducing one would require `persistence-storage-engineer`, a `storageManifest` allowlist change, and explicit user approval — out of scope for this design.
- Implementation owner (later, after design approval): `obsidian-sync-engineer`.
- Draft already proposes WORK-ID `YMD-BRIEF-PERMANENCE-SPLIT` and a `feat/brief-permanence-split` branch off `main`. Keep the WORK-ID; the branch name is a suggestion.

## Authorized Scope
- Edit only: `docs/LIVE_STREAM_BRIEF_PERMANENCE_SCHEME.md` (the design document).
- Read-only reference (do not modify): `src/lib/morningBriefBulkSections.js`, `src/lib/obsidianVideoMergeItems.js`, `src/lib/obsidianNoteMerge.js`, `src/lib/obsidianVaultMergeWrite.js`, `src/lib/obsidianItemSaveStore.js`, `src/lib/obsidianExport.js`, `src/lib/obsidianRouting.js`, `docs/MORNING_BRIEF_GEMS_ROUTING.md`, `docs/SAVE_SYSTEM_ARCHITECTURE.md`, `docs/START_HERE.md`.
- Work on a new branch created from `main` (not from the current `docs/markdown-governance-cleanup`). Move the untracked design doc onto that branch.
- No application-code edits. No `scripts/*-qa.mjs` additions or edits (design-only deliverable).

## Approval Boundaries & Constraints
- Preserve all unrelated and uncommitted work; do not reset, stash, clean, or overwrite it. The working tree has unrelated market-asset-links WIP (`src/components/shared/MarketAssetLinksMenu.jsx`, `scripts/market-asset-descriptions-qa.mjs`, `scripts/market-asset-provider-links-qa.mjs`, `package.json`, `package-lock.json`, `src/components/workspace/StructuredSnapshotView.jsx`) — do not touch or include any of it.
- Smallest compatible change only: the single deliverable is the updated design document. No code, no schema code, no test files.
- Do not weaken or delete any existing assertion in any `scripts/*-qa.mjs`; do not add new ones in this task.
- No paid AI / GEMS API calls.
- No commit / push / merge / deploy / publish / Base44 sync without explicit approval.
- Approval-gated — do NOT change, and do NOT specify a design that requires changing, without explicit user sign-off: AI-pipeline params in `vite.config.js` and `src/components/dashboard/VideoDetailPanel.jsx` (Claude `max_tokens` 8192, `ANTHROPIC_MESSAGE_MS` 600_000, `server.httpServer.timeout` 620_000, `CHUNK_THRESHOLD` 15_000, chunk split ~10_000 chars, transcript threshold 300 chars, `GEMINI_MOCK` false); migration-governance files (`src/dev/ytmdbOriginMigrationController.js` verified constants, `src/dev/ytmdbOriginStorageManifest.js` allowlists, `src/lib/persistence/storageManifest.js` key-count asserts).
- No new localStorage key in the design. Reuse `yt_obsidian_item_saves_v1` with optional fields only; a new key is explicitly out of scope and would need separate approval.
- lessons.md (2026-07-28 "Preserve context when flattening structured data") — when the design maps structured brief items into the playbook note or any export text, it must require the item's identifying field (ticker / section identity) and must label enum/status values with their confirmed schema meaning; do not specify a flatten or auto-merge step that drops provenance or the human review gate for near-duplicates.
- lessons.md (2026-08-30 "Never rm -rf a repo-relative path without checking it is untracked first") — the daily expiry/archive mechanism must never specify deleting notes or bullets. Use additive tombstone markers only (e.g. `<!-- expired: moved to מבזקים/YYYY-MM-DD -->`); the dated note is the archive and nothing is removed. Any directory-level cleanup step in the design must assume the path is verified untracked/gitignored first.
- lessons.md (2026-08-28 "Read migration-governance files in full before touching their invariants") — do not propose edits to `ytmdbOriginMigrationController.js`, `ytmdbOriginStorageManifest.js`, or the `storageManifest.js` key-count asserts in this design. If the schema extension appears to need one, stop and flag it for explicit user sign-off instead of specifying the change.
- lessons.md (2026-08-19 "Trace discriminator gates through every consumer") — the final schema/marker spec must inventory every consumer of the new optional fields and the `ymd-meta` line (the `includes()`-based dedupe in `obsidianNoteMerge.js`, the "saved"/"expired" indicator in `obsidianItemSaveStore.js`, the planned expiry sweep, and the save-picker override) and state, per consumer, how it reads or ignores each new field. Testing a producer shape in isolation is not sufficient.

## Evidence
- `git rev-parse --abbrev-ref HEAD` → `docs/markdown-governance-cleanup`
- `git rev-parse HEAD` → `4c981ec81dd4ba66a1237833ad2d036a3a66415c`
- `git log -1 --format=%H%n%s` → `4c981ec81dd4ba66a1237833ad2d036a3a66415c` / `feat(workspace): add Workspace Day Obsidian export (Stage 3)`
- `git status --porcelain`:
  ```
   M package-lock.json
   M package.json
   M scripts/market-asset-descriptions-qa.mjs
   M scripts/market-asset-provider-links-qa.mjs
   M src/components/workspace/StructuredSnapshotView.jsx
  ?? docs/LIVE_STREAM_BRIEF_PERMANENCE_SCHEME.md
  ?? src/components/shared/MarketAssetLinksMenu.jsx
  ```
- `docs/work-ledger.md` — does not exist (checked this invocation).
- `docs/handoffs/` — did not exist before this handoff; created for this file.
- CTO routing outcome (essentials, provided as task input): extension of existing Obsidian routing, not a new category; active pipeline is `morningBriefBulkSections.js` → `obsidianVideoMergeItems.js` → `obsidianNoteMerge.js` → `obsidianVaultMergeWrite.js` → `obsidianItemSaveStore.js`; new folder entry + playbook declared in `obsidianExport.js`'s `OBSIDIAN_FOLDER_CATALOG`; all new fields optional/backwards-compatible; marker extension additive; no new store, no new localStorage key; implementation later by `obsidian-sync-engineer`.
- No secrets, GEMS payloads, transcripts, or credentials involved in this task.

## Relevant Files & QA Scripts
- `docs/LIVE_STREAM_BRIEF_PERMANENCE_SCHEME.md` — the design document to review and complete (the only file Codex edits).
- `src/lib/morningBriefBulkSections.js` — `buildMorningBriefBulkSections()`; source of the 7 categories and their `section key` / `sectionLabel` / `tabKey` mapping used by section 1.2 and 2.4 of the doc.
- `src/lib/obsidianVideoMergeItems.js` — `collectVideoObsidianMergeItems()`; where `summary` items are added and where per-item merge objects are built.
- `src/lib/obsidianNoteMerge.js` — `mergeItemsIntoObsidianNote()`; the `<!-- obsidian-item:{identityKey} -->` marker and `includes()`-based dedupe the additive `ymd-meta` line must not disturb.
- `src/lib/obsidianVaultMergeWrite.js` — `/api/vault/write?mode=merge` writer (dev-only Vault API).
- `src/lib/obsidianItemSaveStore.js` — `yt_obsidian_item_saves_v1` localStorage record; target for the optional `date` / `ticker` / `permanence` / `expiry` / `sourceChannel` fields.
- `src/lib/obsidianExport.js` — `OBSIDIAN_FOLDER_CATALOG`, `resolvePrimaryTopic`, `generateDailyNote()`; where `שוק ההון/מבזקים` and the standing playbook under `צ'קליסטים` are declared.
- `src/lib/obsidianRouting.js` — video-level `V-<slug>.md` taxonomy route; explicitly NOT the item path (do not design around it).
- `docs/MORNING_BRIEF_GEMS_ROUTING.md` — confirms `מבזק לייב פתיחה` → `morningBrief` → `שוק ההון`.
- `docs/SAVE_SYSTEM_ARCHITECTURE.md` — Risk #10: Vault API is dev-only; that constraint stays.
- QA: none in scope. This task adds and runs no `scripts/*-qa.mjs`; QA scripts (`scripts/obsidian-permanence-qa.mjs`, `scripts/obsidian-brief-expiry-sweep.mjs`) are named in the doc's phased plan as **future** implementation work, not part of this design deliverable.

## Required Tests
- None executable — the deliverable is a Markdown design document, not code. Do not run or add `scripts/*-qa.mjs`, `npm run lint`, or `npm run build` for this task.
- Verification is editorial review of `docs/LIVE_STREAM_BRIEF_PERMANENCE_SCHEME.md` against the Success Criteria below and against the 5 open questions in section 5.

## Success Criteria
- All 5 open questions in section 5 of `docs/LIVE_STREAM_BRIEF_PERMANENCE_SCHEME.md` are resolved: each has a stated decision, a one-line rationale, and any resulting change folded into the relevant section (1–4, 7). No question is left as "recommendation only".
- The section 2.4 `section key → permanence default` table is final: every `section key` emitted by `buildMorningBriefBulkSections()` (including `summary`) appears exactly once, with a `permanence` default (`permanent` | `daily`), a concrete destination note, and an `expiry` rule for `daily` rows. Any override behavior (save-picker toggle vs always-ask) is decided and consistent with question 2.
- The standing playbook note structure is final: single note vs note-per-category decided (question 1), exact note path(s) under the existing `צ'קליסטים` folder, exact stable H2 headings, the "recently added / not yet merged" holding section, and how `sectionLabel` maps to each H2.
- The daily expiry/archive mechanism is final: dated note path template, where `expiry` is persisted (`ymd-meta` + item store), sweep trigger decided (script vs DEV button, question 4), and an explicit statement that the mechanism is read-only-report-first and never deletes — tombstone markers only, playbook never touched.
- The additive schema is specified exactly: the new optional `obsidianItemSaveStore` fields with types and defaults, reusing `yt_obsidian_item_saves_v1` (no new key), plus the exact `<!-- ymd-meta: ... -->` marker line format and its position relative to the existing `<!-- obsidian-item:{identityKey} -->` marker and the bullet.
- Every new field and the `ymd-meta` line is traced through each consumer (dedupe, saved/expired indicator, expiry sweep, save-picker override) with a per-consumer statement of read/ignore behavior — satisfying lessons.md 2026-08-19.
- Question 5 is answered: whether "live stream market analysis" is the same `morningBrief` format or a separate channel format, and if separate, the doc states it still flows through the same pipeline via a new title-keyword entry (no new routing engine).
- The doc still asserts, unchanged: no new routing engine, no parallel store, no new localStorage key, Vault API stays dev-only, protected AI settings untouched, all UI text Hebrew RTL.
- No application code, schema code, or test file is modified anywhere in the change; `git status` shows only `docs/LIVE_STREAM_BRIEF_PERMANENCE_SCHEME.md` (plus the pre-existing unrelated WIP, untouched).

---
Privacy: full GEMS payloads, transcripts, repair candidates, credentials, and unrelated stored content are not included.
Transmission: this handoff is saved locally to docs/handoffs/ and shared only when the user chooses to.
