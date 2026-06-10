# PROJECT DECISIONS HISTORY

```
SOURCE OF TRUTH

Future development must follow this document.

If implementation and documentation differ,
report the contradiction before modifying code.
```

**Project:** YouTube Mentor Dashboard  
**Purpose:** Record major architectural decisions and **WHY** they were made.  
**Audience:** Future developers, AI agents, and product owners resuming work after a break.

---

## How to Use This Document

When proposing a change that contradicts a decision below:

1. State which decision is affected.
2. Explain why the original rationale no longer holds.
3. Get explicit approval before modifying code.
4. Update this document after the decision is changed.

---

## 1. Why Universal Tabs Were Created

### Decision

Replace per-video-type tab arrays (learning tabs, brief tabs, political tabs) with a **single 7-tab bar** shown for every video regardless of category.

### Why

| Problem | Solution |
|---------|----------|
| One `VideoDetailPanel` served 5+ content types with different tab sets | Users had to learn different navigation per video type |
| GEM output schema was diverging per category | One `universalTabs.*` mapping surface for all categories |
| Tab extraction logic was duplicated across files | Centralized in `extractUniversalTabContent()` |
| New categories required new tab definitions | Tab 7 (specialized) delegates to sub-category renderer |

### Evidence

- `UNIVERSAL_TABS` comment: "shown for every video regardless of type" — `videoTabsConfig.js:141–145`
- `VideoDetailPanel.jsx` line 8414: "Universal 7-tab bar — same for every video (Phase 1)"
- `PROJECT_STATUS.md` §6 Dynamic Tabs → now superseded by universal tabs

### Trade-off Accepted

Legacy tab arrays (`TECHNICAL_TABS`, `MORNING_BRIEF_TABS`, etc.) remain for extraction, badges, and `AiMappingModal` — but UI shows only `UNIVERSAL_TABS`.

---

## 2. Why There Are Exactly 7 Tabs

### Decision

Fixed order: Summary → Chapters → Insights → Useful Knowledge → APP → Obsidian Mapping → Specialized Content.

### Why

| Rationale | Detail |
|-----------|--------|
| **Cognitive consistency** | User always knows where to find summary vs. specialized content |
| **GEM mapping alignment** | Maps 1:1 to `universalTabs.*` keys in GEM schema |
| **Separation of concerns** | Tabs 1–6 are universal; Tab 7 is the only category-specific surface |
| **Save system uniformity** | Bulk selection works identically across tabs 1–6 |
| **Obsidian mapping isolation** | Tab 6 is metadata/routing — not mixed with content tabs |

### What Was Rejected

- Per-type tab counts (9 tabs for morning brief, 11 for technical, etc.)
- Dynamic tab count based on available data
- Merging Obsidian mapping into Useful Knowledge tab

### Tab 5 (APP) Gating

APP Builder tab visible only for: `שוק ההון`, `פוליטיקה`, `טכנולוגיה ו-AI`, `בריאות ותזונה`.  
Rationale: APP Builder consumes domain knowledge — only topics with structured product potential get the tab.

---

## 3. Why Obsidian Is the Permanent Brain

### Decision

Obsidian vault is the **long-term knowledge store**. In-app "Brain" (localStorage) is a fast-access layer; Obsidian is the durable archive.

### Why

| Rationale | Detail |
|-----------|--------|
| **Portability** | Markdown files work outside the app forever |
| **Graph linking** | Obsidian's bidirectional links enable knowledge graphs |
| **No vendor lock-in** | Knowledge survives Base44/platform changes |
| **Merge-friendly** | HTML comment markers enable incremental saves without overwrite |
| **Folder taxonomy** | Matches 3-level topic hierarchy (category/subCategory/topics) |

### Evidence

- `docs/OBSIDIAN_PERSONAL_BRAIN_PHASE.md`: "Obsidian-first brain checkpoint"
- `obsidianRouting.js`: taxonomy-based folder resolution
- `knowledgeLibrary.js` line 1–2: "Parallel to Brain, not replacement"

### Trade-off Accepted

- Dev-only vault API (`/api/vault/*` in `vite.config.js`) — production needs equivalent backend
- Dual "Brain" terminology: per-item localStorage vs. full-video vault save

---

## 4. Why Merge Is Required Instead of Overwrite

### Decision

Per-item and bulk Obsidian saves use **merge** (insert bullets with dedupe markers). Full overwrite only on explicit user action (replace existing / new file).

### Why

| Problem with Overwrite | Merge Solution |
|------------------------|----------------|
| Re-saving one insight destroys previously saved items | Each item gets `<!-- obsidian-item:{identityKey} -->` marker |
| Bulk save of 3 items from 10 available would lose the other 7 | Only unsaved items are merged |
| User curates vault manually — app must not clobber | Markers survive; duplicates skipped |
| AI recommendations applied incrementally | `uniqueMerge()` for array fields (tags, topics) |

### Three Merge Contexts

| Context | Strategy | File |
|---------|----------|------|
| Per-item note save | Insert bullet under `## sectionLabel` with marker | `obsidianNoteMerge.js` |
| Obsidian Mapping arrays | `uniqueMerge()` — union add only | `ObsidianMappingTab.jsx` |
| Full video replace | Overwrite only after explicit confirm | `BrainDestinationPicker` allowReplaceExisting |

### Evidence

- `PROJECT_STATUS.md` §2: "Merge, Don't Overwrite (Array Fields)"
- E2E specs validate merge behavior: `e2e/obsidian-item-save.qa.spec.js`

### Exception: APP Builder Obsidian

`AppBuilderTab.handleSaveToObsidian` uses **overwrite** — intentional for draft documents, not incremental knowledge items. Documented as known risk in `SAVE_SYSTEM_ARCHITECTURE.md`.

---

## 5. Why APP Builder Consumes Knowledge Rather Than Generating Knowledge

### Decision

APP Builder tab **reads** extracted insights, opportunities, watchlist levels, and GEM `universalTabs.app` data. It does **not** run independent analysis or generate market content.

### Why

| Rationale | Detail |
|-----------|--------|
| **Single source of truth** | Video analysis happens once (GEM paste-back) |
| **No duplicate AI calls** | APP Builder is a productization layer, not an analysis engine |
| **Traceability** | Every app idea links back to source video knowledge |
| **Approved AI settings** | GEM prompts and timeouts are manually tuned — APP Builder must not alter them |

### Data Flow

```
GEM Analysis → universalTabs.app + specialized fields
                    ↓
            extractAppIdeas()
                    ↓
         APP_BUILDER_SECTIONS (summary, requirements, screens, logic, risks, tasks, prompt)
                    ↓
         Save to Brain / Obsidian (App Ideas/{topic}/)
```

### Evidence

- `AI_DEVELOPMENT_GUIDE.md` §26: "APP Builder Knowledge Layer"
- `extractAppIdeas.js`: reads from specialized + universalTabs
- `CLAUDE.md` approved settings: GEMINI_MOCK=false, chunk thresholds — must not change without approval

---

## 6. Why Opponent View Exists Only in Politics

### Decision

⚔️ Opponent View (דעת האויב) is gated to `effectiveGemInfo?.gemKey === 'political'` only. Hidden for all other topics including market mentors.

### Why

| Rationale | Detail |
|-----------|--------|
| **Conceptual fit** | Opponent view = content that does not represent the user's opinion — meaningful only in political discourse |
| **Market mentors explicitly excluded** | Oliver Velez / Micha.Stocks → `שוק ההון`, no opponent view |
| **Separate save destination** | `perspective: opponent_view` tag + `פוליטיקה/דעת הצד השני` Obsidian path |
| **Avoid UI clutter** | ⚔️ button on non-political content would confuse users |

### Evidence

- `AI_DEVELOPMENT_GUIDE.md` §5, §17, §27
- `VideoDetailPanel.jsx` ~8516: `isPoliticalVideo` gate
- `opponentSentenceStore.js`: per-sentence toggle/response

---

## 7. Why Knowledge Base Is the Main Vault

### Decision

`שוק ההון/ספריית ידע/` (Knowledge Library) is the canonical fixed vault tree with ~90 predefined `.md` files. Topic-rooted export (ZIP) is secondary.

### Why

| Rationale | Detail |
|-----------|--------|
| **Structured evergreen knowledge** | Definitions, rules, frameworks belong in fixed files — not per-video notes |
| **Section → file mapping** | `SECTION_FILE_MAP` routes content types to specific files (מושגים.md, כללים.md, etc.) |
| **Parallel to Brain** | Knowledge Library complements per-video Brain items |
| **Admin vault migration** | `Admin.jsx` vault-migration tab manages duplicates and conflicts |

### Evidence

- `knowledgeLibrary.js`: `FIXED_LIBRARY_PATHS`, `SECTION_FILE_MAP`
- `AI_DEVELOPMENT_GUIDE.md` §30: supersedes earlier path definitions
- `topicRules.js`: `TOPIC_RULES` = SSOT for Gem + Brain + Obsidian routing

### Known Tension

`docs/OBSIDIAN_PERSONAL_BRAIN_PHASE.md` describes ZIP export with topic-rooted structure. Knowledge Library uses fixed paths. Both coexist — report contradictions before unifying.

---

## 8. Draft-First, No Silent Save (Obsidian Mapping)

### Decision

AI recommendations in Obsidian Mapping tab apply to **local draft only**. Nothing writes to DB/localStorage automatically.

### Why

Aligns with product vision: "fast review, selective saving." Prevents accidental overwrites of manual curation. User must explicitly save via existing flows.

### Evidence

- `PROJECT_STATUS.md` §1
- `ObsidianMappingTab.jsx` footer note
- `AI_DEVELOPMENT_GUIDE.md` §4: selective saving

---

## 9. Presentation-Only Morning Brief Layer

### Decision

Morning Brief visual refactor (`morningBriefDisplay.js`, `MorningBriefDashboard.jsx`) does **not** change GEM schema or prompts.

### Why

- Approved AI settings in `CLAUDE.md` must not be altered without explicit approval
- GEM output varies; display layer handles merge/coercion at render time
- 10-section dashboard is always visible with empty states — predictable UX

### Evidence

- `PROJECT_STATUS.md` §4
- `morningBriefDisplay.js` header: presentation layer only

---

## 10. Dual-Key marketBrief Storage

### Decision

Load `market_brief_${videoId}` OR `market_brief_${youtubeId}` — whichever exists.

### Why

Historical inconsistency in how brief data was keyed in localStorage. Both keys must be checked to avoid data loss on reload.

### Evidence

- `PROJECT_STATUS.md` §5
- `VideoDetailPanel.jsx` dual-key load logic

---

## 11. DB Is Authoritative; localStorage Is Temporary

### Decision

| Data | Source of Truth |
|------|----------------|
| Video metadata, analysis | **DB** (Base44 entities) |
| UI draft state, selection | localStorage (temporary) |
| Brain per-item saves | localStorage (`yt_knowledge_items_v1`) — interim until backend sync |
| Obsidian per-item tracking | localStorage (`yt_obsidian_item_saves_v1`) + vault files |

### Why

Base44 is the platform. GitHub is code source of truth. localStorage must never be the only copy of critical data.

### Evidence

- `AI_DEVELOPMENT_GUIDE.md` §3
- `OBSIDIAN_PERSONAL_BRAIN_PHASE.md` §Known Limitations: "localStorage-first, no backend sync"

---

## 12. GEM Paste-Back Only (No API)

### Decision

GEM pages are external web pages with no API access. User must paste GEM output back into the app.

### Why

- GEM is a Google product outside app control
- Paste-back ensures user reviews AI output before commit
- Prevents automatic saves of unreviewed analysis

### Evidence

- `AI_DEVELOPMENT_GUIDE.md` §7

---

## 13. Hebrew-Only UI; English Code

### Decision

All UI text in Hebrew. RTL layout. Code, file names, and variable names in English. Legacy English category names (`Markets`) normalize to Hebrew (`שוק ההון`).

### Why

- Primary users are Hebrew speakers
- RTL is non-negotiable for UX quality
- English code follows standard development practice

### Evidence

- Workspace `CLAUDE.md` Language Preferences
- `AI_DEVELOPMENT_GUIDE.md` §20: forbidden English in UI

---

## 14. 3-Level Topic Hierarchy Maximum

### Decision

Exactly 3 levels: Main Topic → Sub-Topic → Optional Title/Sub-Sub-Topic. Never a fourth level.

### Why

- Obsidian folder depth must stay manageable
- Brain SubBrain structure maps to level 2
- Deeper hierarchies fragment knowledge

### Evidence

- `AI_DEVELOPMENT_GUIDE.md` §2
- `brainStructure.js`: Main → SubBrain (2 levels)

---

## 15. GitHub = Code Source of Truth; Base44 = Runtime

### Decision

All code changes via files → Git commit → GitHub push → Base44 Git Pull → Publish.

### Why

- Reproducible development
- No manual Base44 edits without Git sync
- Secrets only in env, never in code

### Evidence

- `CLAUDE.md`, `AGENTS.md`, `docs/workflow.md`

---

## 16. Confidence Display Is Informational Only

### Decision

Obsidian Mapping confidence badges (🟢 ≥90%, 🟡 70–89%, 🔴 <70%) are display-only. No gating logic blocks user actions based on confidence.

### Why

User retains full control. AI confidence is a hint, not a gate.

### Evidence

- `PROJECT_STATUS.md` §9

---

## 17. Prop Sync Guard (skipPropSyncRef)

### Decision

When Obsidian Mapping draft changes propagate to parent (`onDraftChange` → `setSubCategoryOverride`), a ref skips one prop-sync effect cycle to preserve Applied/Undo UI state.

### Why

Avoid feedback loop that resets badges immediately after Apply.

### Evidence

- `PROJECT_STATUS.md` §3
- `ObsidianMappingTab.jsx`

---

## Decision Log Template

When adding new decisions, use this format:

```markdown
## N. [Decision Title]

### Decision
[What was decided]

### Why
[Problem → Solution table or bullet rationale]

### Evidence
[File paths, commit hashes, doc sections]

### Trade-off Accepted
[What was given up]

### Status
Active | Superseded | Under Review
```

---

*This document captures decisions as of June 2026. For current implementation status see `CURRENT_STATE_JUNE_2026.md`. For save system details see `SAVE_SYSTEM_ARCHITECTURE.md`.*
