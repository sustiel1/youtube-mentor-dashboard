# ADR: Title-Override Source of Truth

**Status:** Accepted
**Date:** 2026-07-26
**Decision scope:** Documentation only — no source code, test code, or runtime behavior changed by
this ADR or the commit that introduces it.

---

## Context

Two modules independently define a `TITLE_OVERRIDE_RULES` array that maps specific Hebrew video
titles (`"מבזק לייב פתיחה"`, `"מבזק בוקר"`) to a forced classification, bypassing normal
keyword/transcript scoring:

- `src/lib/gemRecommender.js` (`TITLE_OVERRIDE_RULES`, line 8)
- `src/ai/gemini/gemContentRouter.js` (`TITLE_OVERRIDE_RULES`, line 68)

Project documentation (`docs/GEM_CONTENT_CLASSIFICATION_RULES.md`,
`docs/GEMS_TAB_MAPPING_REGRESSION_RULES.md`) described both as active and stated they must be kept
"aligned." A Phase 3C architecture audit (2026-07-26, read-only, performed in an isolated worktree)
traced the actual runtime call graph to verify which module — if either — is authoritative before
any documentation or code consolidation proceeds.

## Verified runtime facts

All of the following were confirmed directly against the source tree (grep + file reads), not
assumed:

1. **`VideoDetailPanel.jsx:131`** imports `preGemClassifier` (and others) from
   `@/lib/gemRecommender`. **`VideoDetailPanel.jsx:2622-2628`**'s `gemRec` `useMemo` calls
   `preGemClassifier(effectiveVideo, '')` — this is the sole call site that reaches
   `TITLE_OVERRIDE_RULES` in a live, user-facing path.
2. **`src/ai/gemini/gemContentRouter.js` is not imported anywhere** in `src/`, `scripts/`, or
   `e2e/` — confirmed by a repo-wide grep with zero matches outside the file's own internal
   references and its own comments.
3. **`gemContentRouter.js`'s own header comment (line 43)** claims it is *"Used by `vite.config.js`
   server handler and `analyzeVideoWithGemini.js`"* — both parts of this claim are false:
   - `vite.config.js` contains no reference to `gemContentRouter`.
   - `src/ai/gemini/analyzeVideoWithGemini.js` does not import `gemContentRouter.js`, and is
     itself unimported anywhere in `src/` — it is independently dead code.
4. **The real, live AI-analysis dispatch path** is `VideoDetailPanel.jsx:3900,7797` →
   `fetchGeminiVideoContent()` (`src/services/geminiVideoContent.js:41`) → `POST
   /api/gemini-video-content`. This call sends no `contentType` field at all — so
   `gemContentRouter.js`'s `resolveContentClassification`, `GEM_PROMPT_CONFIG_TABLE`, and
   `getGemPromptConfig` have no live consumer, direct or indirect.
5. **`scripts/test-morning-brief-routing.mjs`** — the script referenced by both documentation
   files as a "regression fixture" — imports neither `gemRecommender.js` nor
   `gemContentRouter.js`. It contains three separate hand-written "Minimal copy of X from Y.js"
   reimplementations (its own comments, lines 15, 113, 181) and validates only those copies. A
   passing run does not prove the real source files behave as specified.
6. **The two `TITLE_OVERRIDE_RULES` arrays share the same 2 patterns** but differ: field names
   (`gemKey`/`gemLabel`/`gemIcon` vs. `recommendedGem`), and the `contentType` value itself
   (`'morningBrief'` in `gemRecommender.js` vs. `'marketBrief'` in `gemContentRouter.js`). This
   divergence currently has **no observable runtime effect** — `gemRecommender.js`'s
   `contentType` field, though returned by `preGemClassifier`, is never read by any consumer
   (`VideoDetailPanel.jsx`'s own `.contentType` checks concern an unrelated field: the GEM JSON
   output's `contentType`, not `preGemClassifier`'s return value).
7. **`gemRecommender.js`'s live behavior is more elaborate than the 2-rule array alone**: a
   Phase-4 validation fallback (`preGemClassifier`, lines 572-589) using a broader 6-phrase
   `MORNING_BRIEF_TITLE_SIGNALS` list forces `gemKey='news'` even when the title doesn't exactly
   match one of the 2 deterministic patterns but does match a broader morning-brief signal.
   `gemContentRouter.js` has no equivalent fallback tied to its own `TITLE_OVERRIDE_RULES`.

## Decision

1. **`src/lib/gemRecommender.js` is the authoritative source of truth for the currently active
   runtime title-override behavior.** Its `TITLE_OVERRIDE_RULES`, `preGemClassifier`, and
   `classifyVideoForGem` are what real users' GEM recommendations, save-category routing, and
   confidence scoring are actually computed from.
2. **`src/ai/gemini/gemContentRouter.js` is dormant legacy/scaffolding code.** It is not deleted,
   not treated as authoritative, and its differing `TITLE_OVERRIDE_RULES` copy is not synchronized
   with the active one in this phase. Its disposition (delete, revive, or leave dormant
   indefinitely) is deferred to a separate, explicitly-approved lifecycle decision.
3. **No production-code change is required** to correct the duplication for the active runtime
   path — the duplication currently has zero live behavioral effect.
4. **Documentation is corrected** (`docs/GEM_CONTENT_CLASSIFICATION_RULES.md`,
   `docs/GEMS_TAB_MAPPING_REGRESSION_RULES.md`) to state the above as verified fact instead of
   asserting both modules are active and must stay "aligned."

## Alternatives considered

- **Extract one shared title-rule module, both consumers import it.** Rejected for this phase:
  would require editing the *live* `gemRecommender.js`, carrying real regression risk to a
  user-facing feature, for a benefit (preventing pattern drift) that only matters if the dormant
  module becomes live again. Not ruled out permanently — revisit if `gemContentRouter.js` is ever
  revived.
- **Restore `gemContentRouter.js` as the canonical routing layer** (wire it into the real
  dispatch). Rejected: this would be a genuine behavior change to the most operationally sensitive
  part of the app (AI-analysis dispatch), requires understanding `vite.config.js`'s current
  server-side classification logic (not audited in this pass — out of scope), and carries
  disproportionate risk relative to a documentation-accuracy problem.
- **Keep both rule sets with no clarification** (status quo). Rejected: leaves the false "must stay
  aligned" claim and the untethered regression-test claim in place, which actively misleads future
  work on this area.

## Consequences

- Future work on GEM classification / title-override behavior should treat `gemRecommender.js` as
  the only file that needs to change to affect real behavior.
- `gemContentRouter.js` remains in the repository, unimported, until a separate decision is made.
  Anyone extending it should know it currently has zero live effect.
- The two documentation files no longer claim the two modules must be kept in sync — reducing the
  risk of a future contributor "fixing" one file to match the other under a false assumption of
  parity.
- The regression-test-coverage gap (`scripts/test-morning-brief-routing.mjs` not importing real
  source) is now documented but **not fixed** — real production changes to `gemRecommender.js`
  could still regress without this script catching it.

## Deferred work (not part of this phase, tracked for future decision)

1. Whether `gemContentRouter.js` is abandoned scaffolding or intentional future architecture —
   undetermined; nothing in the repository states an intent either way.
2. Whether to correct `gemContentRouter.js:43`'s false "used by..." comment — a zero-risk,
   comment-only change, but touches a `src/` file and requires its own separate approval gate per
   this project's established practice.
3. Whether `scripts/test-morning-brief-routing.mjs` should be rewritten to import real production
   code instead of hand-copied logic — a genuine testing-architecture gap, separately scoped from
   this ADR's title-override question.
4. Whether the independently-discovered dead `src/ai/gemini/analyzeVideoWithGemini.js` (and its own
   unrelated third `CONTENT_TYPES` taxonomy) warrants its own audit.

## Verification requirements

- `node scripts/test-morning-brief-routing.mjs` — expected to produce identical output
  before/after this documentation change (no source file it exercises was modified).
- `npm run build` — not required for this phase (Markdown-only change); would be expected to pass
  unaffected if run, since no file in the build graph changed.
- Manual QA: not required for this phase (no runtime behavior changed). If a future phase corrects
  `gemContentRouter.js`'s header comment or otherwise touches `src/`, re-verify with representative
  titles (see the Phase 3C audit's §8 QA table for concrete examples and expected outcomes).

## Rollback considerations

This ADR and its accompanying documentation corrections are additive/corrective text changes only.
`git revert` on the commit that introduces them fully restores the prior (less accurate) wording in
both affected files and removes this ADR file. No source code, test code, or data is affected by
rollback.
