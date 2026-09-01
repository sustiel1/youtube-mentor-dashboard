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
| YMD-BRIEF-PERMANENCE-SPLIT | Live-stream market brief permanent-vs-daily knowledge split (`docs/LIVE_STREAM_BRIEF_PERMANENCE_SCHEME.md`). Phase 1 (design) closed. Phase 2 (additive `permanence`/`expiry`/`ymd-meta` schema fields) implemented and committed on branch `feat/brief-permanence-split @ 2b4633a` (worktree `C:/tmp/ymd-brief-permanence-split`) — **not merged into `main` or the current branch**; `docs/work-ledger.md` recording this only exists on that branch. Phase 3 (mapping/UI toggle) and Phase 4 (DEV-button archive/expiry scan) not started; each requires a separate explicit user approval per the plan doc §7. | awaiting-push | 2026-09-01 | obsidian-sync-engineer |
| TRADINGBRAIN-GEMS-TABS-MAPPING-PLAN | 4-GEM tabs-mapping plan (`docs/plan/TRADINGBRAIN-GEMS-TABS-MAPPING-PLAN.md`), planning-only, no code changed. Decisions 1–16 closed as of the 2026-09-01 (4th) update. Two open questions from §8 ("שאלות פתוחות חדשות", items 3–4) remain undecided by the user. | needs-user-decision | 2026-09-01 | unassigned |
| YMD-NEXT-SESSION-QA-BASELINE | `docs/governance/NEXT_SESSION_QA.md` (baseline `cleanup-baseline-2026-06-17`) lists 5 manual QA items (Markdown export, Brain saved indicator, Morning Brief persistence, Chapters timestamps, SaveStatusPopover product decision) with every Pass/Fail + Decision field still blank in the file. ~15 feature/fix commits have landed since that baseline, including at least one (`2a1610d` "stop saved news/opportunity rows from silently disappearing") that plausibly touches the same persistence surface. Not verified whether these 5 items are still relevant, already covered by later fixes, or genuinely still open — the checklist itself is stale (>24h, in fact >2 months) and needs a real re-verification pass before being trusted. | open | 2026-09-01 | unassigned |
| YMD-SETTINGS-UNCOMMITTED | `.claude/settings.json` has an uncommitted modification (`git status --porcelain`: ` M .claude/settings.json`, `git diff --stat`: 2 insertions, 1 deletion) on branch `feat/saved-market-rows-table`. Not yet committed or pushed; content of the change not inspected by `backlog-tracker` (out of its investigation scope — content review belongs to whoever made the change or `qa-release-reviewer`). | open | 2026-09-01 | unassigned |

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
