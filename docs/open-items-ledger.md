# Open Items Ledger

> Single source of truth for every open/incomplete item in this project: bugs under
> investigation, partially-built features, unpushed branches/commits, and "documented
> gaps" other agents leave behind (in code comments, plan docs, or their own final
> reports). Maintained by the `backlog-tracker` sub-agent — see
> `.claude/agents/backlog-tracker.md`.
>
> **Every agent's Completion Report must append a row here for any unresolved gap,
> known limitation, or deferred decision it leaves behind** — not just mention it in
> the final report. See the "Completion Report" section in this project's `CLAUDE.md`.
>
> This file records **claims**, not proof. A row says "this was true as of
> last-checked" — it is not evidence that the item is still open today. Re-verify
> before acting on a row older than 24h.

**Last scanned:** 2026-09-01 (Asia/Jerusalem) — by `backlog-tracker`, full re-verification pass (branch `feat/saved-market-rows-table` @ `ca6beba`)

---

## Open items

| WORK-ID | description | status | last-checked | owning agent |
|---|---|---|---|---|
| YMD-BRIEF-PERMANENCE-SPLIT | Live-stream market brief permanent-vs-daily knowledge split (`docs/LIVE_STREAM_BRIEF_PERMANENCE_SCHEME.md`). Phase 1 (design) closed; Phase 2 committed `feat/brief-permanence-split @ 2b4633a`. **Correction 2026-09-01:** Phase 3 (`0cb34e2`) and Phase 4 (`00b5529`) are also committed and pushed — on `feat/brief-permanence-phase3-4`, origin matches local tip — contradicting this row's prior "not started" claim. Phase 3 wires producers + save-picker permanence toggle, but self-documents 2 gaps: 4/14 §1.2 keys have no producer (levels/top-insights/learning-insights/all-points), and `ticker` isn't threaded (deferred). Phase 4 adds scan/archive logic (`briefExpiryMaintenance.js`, copy+tombstone, zero-delete) but is explicitly **not wired to any UI button** — the plan's required two-step DEV trigger doesn't exist yet. QA scripts present (`brief-permanence-meta-qa.mjs` 57 checks, `brief-expiry-maintenance-qa.mjs` 28 checks), not re-run by this check. Neither commit is merged into `main` or the current branch (`git merge-base --is-ancestor` false both ways). That branch's own `docs/work-ledger.md` is stale (still says "phase-2-committed") — moot now: `docs/work-ledger.md` is retired project-wide (see `TRADINGBRAIN-LEDGER-CONSOLIDATE`). | awaiting-push | 2026-09-01 | obsidian-sync-engineer |
| TRADINGBRAIN-GEMS-TABS-MAPPING-PLAN | 4-GEM tabs-mapping plan (`docs/plan/TRADINGBRAIN-GEMS-TABS-MAPPING-PLAN.md`), planning-only, no code changed. Decisions 1–16 closed as of the 2026-09-01 (4th) update. Two open questions from §8 ("שאלות פתוחות חדשות", items 3–4) remain undecided by the user. | needs-user-decision | 2026-09-01 | unassigned |
| YMD-NEXT-SESSION-QA-BASELINE | `docs/governance/NEXT_SESSION_QA.md` (baseline `cleanup-baseline-2026-06-17`) lists 5 manual QA items (Markdown export, Brain saved indicator, Morning Brief persistence, Chapters timestamps, SaveStatusPopover product decision) with every Pass/Fail + Decision field still blank in the file. ~15 feature/fix commits have landed since that baseline, including at least one (`2a1610d` "stop saved news/opportunity rows from silently disappearing") that plausibly touches the same persistence surface. Not verified whether these 5 items are still relevant, already covered by later fixes, or genuinely still open — the checklist itself is stale (>24h, in fact >2 months) and needs a real re-verification pass before being trusted. | open | 2026-09-01 | unassigned |
| YMD-SETTINGS-UNCOMMITTED | `.claude/settings.json` has an uncommitted modification (`git status --porcelain`: ` M .claude/settings.json`, `git diff --stat`: 2 insertions, 1 deletion) on branch `feat/saved-market-rows-table`. Not yet committed or pushed; content of the change not inspected by `backlog-tracker` (out of its investigation scope — content review belongs to whoever made the change or `qa-release-reviewer`). | open | 2026-09-01 | unassigned |
| TRADINGBRAIN-GEMPICKER-COMPACT-SCORING | בעקבות decision 14 (`docs/plan/TRADINGBRAIN-GEMS-TABS-MAPPING-PLAN.md`), `src/lib/gemRecommender.js`'s `classifyVideoForGem()` עודכן (טרם committed, על branch `feat/saved-market-rows-table`) להחזיר מצב "ממתין לסיווג" (`gemKey: null`, `confidence: "none"`, `confidencePct: 0`) עבור וידאו ללא אות סיווג — אך הפונקציה המקבילה `resolveContentClassification()` ב-`src/ai/gemini/gemContentRouter.js` (Phase 4 "General fallback", שורות 259–267, אומת ידנית) **לא עודכנה** ועדיין מחזירה `contentType: 'general'` / `recommendedGem: 'general'` / `source: 'fallback'` ללא כל טיפול במצב ה-pending החדש. המשתמש הצהיר במפורש שזה out of scope למשימה הנוכחית ("declined to touch"). כתוצאה מכך שני ה-classifiers לא עקביים זה עם זה — וידאו עם אפס אותות עשוי לקבל pending state או fallback ל-'general', תלוי דרך הקוד. | needs-user-decision | 2026-09-01 | gemini-integration-engineer |
| TRADINGBRAIN-GEMPICKER-COMPACT-SCORING | Systematic false winner in `TJS_GEM_KEYWORDS.dayTrading` (`src/lib/gemRecommender.js`, lines 505–511, verified): the array contains bare short Hebrew TA words — `תמיכה`, `התנגדות`, `כניסה`, `יעד`, `סטופ`, `פריצה` — that are core general-technical-analysis vocabulary, not day-trading-specific. Any video genuinely about ניתוח טכני is likely to also trip this dayTrading bucket in `tjsRecommendation.scores`, so the GEMS TJS accordion can still display dayTrading as "AI מומלץ" even though the arbitration fix (`VideoDetailPanel.jsx` `tjsRecIsTrusted`, ~line 8661, and `GemSelectionModal` props, ~line 12937) now blocks dayTrading from winning `recommendedGemKey` once its confidence is below 60. Confirmed via two live test videos — a real, reusable false-positive pattern, not a one-off. Needs a user decision: narrow dayTrading's keyword list vs. widen technical's transcript coverage vs. leave as-is. Not fixed — explicitly deferred during debugging. | needs-user-decision | 2026-09-01 | decision-signal-engineer |
| TRADINGBRAIN-GEMPICKER-COMPACT-SCORING | Hebrew spelling variants not handled by keyword matching: a real video titled with "פנדמנטלי" (missing the ו/vav) does not match any of `GEM_RULES.fundamental`'s title/topic keywords in `src/lib/gemRecommender.js` (lines 67–88, verified) — all use the canonical "פונדמנטלי" (with vav), e.g. `titleKeywords` line 77 ("ניתוח פונדמנטלי") and `topicKeywords` line 78 ("פונדמנטלי"). Plain substring/`.includes()` matching has no fuzzy/spelling-variant tolerance. In the one traced case the video still ended up correctly classified as fundamental (confidencePct 70) purely as a side effect of the explicit-category-boost tie-break mechanism favoring whichever GEM_RULES entry is first in declaration order when tied at score 0 — not because the keyword actually matched. A fragile coincidence, not a real fix; a differently-misspelled title would not be so lucky. Needs a user decision: small Hebrew spelling-normalization/variant table vs. fuzzy-match tolerance vs. leave as-is (adding spelling variants was explicitly declined as a workaround for now). | needs-user-decision | 2026-09-01 | decision-signal-engineer |

*(Empty table body is a valid state — it means no known open items, not that none were checked. Never delete this section header.)*

---

## Recently resolved (audit trail — last 10 removals)

*(A row moves here, with a one-line reason and the evidence that closed it, when `backlog-tracker` verifies during a full pass that it is no longer open. Kept short; oldest entries drop off past 10.)*

- *(none yet)*

---

## Field reference

- **WORK-ID** — `YMD-<SLUG>` when the item already has one (from `docs/work-ledger.md`, a branch name, or a plan doc); otherwise `backlog-tracker` mints one in the same convention when it first records the item.
- **status** — exactly one of: `open` (known, not yet acted on) · `blocked` (cannot proceed without something external — a decision, a dependency, an environment fix) · `awaiting-push` (work exists — committed locally or on another branch/worktree — but is not merged/pushed to where it needs to be) · `needs-user-decision` (a concrete choice is on the table and only the user can make it).
- **last-checked** — `YYYY-MM-DD`, the date `backlog-tracker` (or the agent that filed the row) last confirmed the row's facts against real state (git, code, or the source doc). Not the date the item was first discovered.
- **owning agent** — the sub-agent whose domain the fix/decision belongs to, or `unassigned` if none fits or a human decision is required.
