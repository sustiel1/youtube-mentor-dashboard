# USER PRODUCT INTENT AND FUTURE VISION

```
SOURCE OF TRUTH

Future development must follow this document.

If implementation and documentation differ,
report the contradiction before modifying code.
```

**Project:** YouTube Mentor Dashboard  
**Document type:** Strategic intent — not implementation  
**Audience:** The user (product owner), future developers, and AI agents  
**Last updated:** June 2026

---

## What This Document Is

This document preserves **why the project exists** and **where it is going** — not how it is currently coded.

Implementation details live in other governance docs. This document captures the user's intent, priorities, and non-negotiables so that future work serves the vision rather than drifting toward feature churn or visual polish.

**Read this before proposing architectural changes, refactors, or new features.**

---

## 1. Why the Project Exists

### The Problem

The user consumes large volumes of YouTube mentor content across multiple domains — stock market, politics, AI/technology, health, and more. This content is:

- **Ephemeral** — watched once, then forgotten
- **Unstructured** — insights buried in long videos
- **Non-actionable** — knowledge does not convert to decisions or tools
- **Non-compounding** — each video starts from zero; nothing builds on prior learning

### The Solution

A **personal knowledge operating system** that:

1. Captures mentor video content as structured, reusable knowledge
2. Organizes it by topic hierarchy in a permanent vault (Obsidian)
3. Enables selective saving — only what matters, not everything
4. Compounds knowledge across videos, mentors, and time
5. Transforms accumulated expertise into product ideas and applications

### The Deeper Motivation

> Learning from mentors should not end at consumption.  
> It should become a growing asset — searchable, linkable, and eventually **buildable**.

The project exists to close the gap between **watching smart people** and **building smart things**.

---

## 2. What Success Looks Like

### Short-Term Success (Working System)

| Signal | Meaning |
|--------|---------|
| Open any analyzed video | 7 Universal Tabs populate consistently |
| Select insights | Save to Brain, Obsidian, or Workspace in one click |
| Reload the app | Saved knowledge persists; nothing lost |
| Open Obsidian vault | Video knowledge appears in correct topic folders |
| Morning Brief video | 10-section dashboard renders with real data |
| Bulk save 5 items | All 5 merge into vault without overwriting prior saves |

### Medium-Term Success (Compounding Knowledge)

| Signal | Meaning |
|--------|---------|
| Search Obsidian | Find insights across 50+ videos on same topic |
| Open APP Builder | Ideas from multiple videos merge into one project spec |
| Export PRD | Claude/Cursor receives structured prompt, builds working app |
| New mentor added | Same workflow — no new learning curve |
| Political video | Opponent View saved separately, ideology preserved distinctly |

### Long-Term Success (North Star — see §10)

| Signal | Meaning |
|--------|---------|
| Content consumption → knowledge asset | Every video watched adds permanent value |
| Knowledge → decisions | Morning brief insights inform real trading decisions |
| Knowledge → applications | APP Builder specs become deployed Base44 apps |
| Cross-domain linking | Political macro insight connects to market brief |
| Zero knowledge loss | Years of mentor content searchable and actionable |

### What Success Is NOT

- A prettier dashboard with empty tabs
- Automatic saves the user did not review
- AI-generated content that replaces mentor expertise
- A closed system that only works inside Base44
- Feature count — success is **knowledge retention and reusability**

---

## 3. The User's Ideal Workflow

This is the canonical pipeline every feature must serve:

```
YouTube Video
      ↓
Analysis (GEM paste-back / future: automated pipeline)
      ↓
7 Universal Tabs (review + selective selection)
      ↓
Brain (fast access)  /  Obsidian (permanent vault)
      ↓
Knowledge Base (compounding markdown library)
      ↓
APP Builder (consumes knowledge → product spec)
      ↓
PRD (requirements, screens, logic, tasks, dev prompt)
      ↓
Claude / Cursor / Codex (implementation)
      ↓
Base44 (deploy + publish)
      ↓
Application (real tool the user operates)
```

### Workflow Principles

| Step | User Intent |
|------|-------------|
| **YouTube Video** | RSS auto-ingest or manual add; transcript available |
| **Analysis** | External GEM produces structured JSON; user reviews before commit |
| **Universal Tabs** | Same navigation every video; scan fast, save selectively |
| **Brain / Obsidian** | Brain = quick recall; Obsidian = permanent archive |
| **Knowledge Base** | Fixed evergreen files (מושגים, כללים) + per-video notes compound |
| **APP Builder** | Reads saved knowledge; does NOT re-analyze the video |
| **PRD** | Structured enough that AI can build without re-watching the video |
| **Claude / Cursor** | Receives PRD + vault context; implements in code |
| **Application** | Deployed tool that operationalizes mentor expertise |

### What Breaks the Workflow

- Skipping review (auto-save without user selection)
- Losing data on reload (localStorage-only persistence)
- Overwriting Obsidian notes on re-save (merge required)
- APP Builder generating analysis instead of consuming it
- Changing tab structure per video type (breaks muscle memory)
- English UI labels in a Hebrew-first system

---

## 4. Long-Term Vision by Category

### 📈 Stock Market (שוק ההון)

**Intent:** Transform daily mentor briefings and educational content into a **personal trading intelligence system**.

| Horizon | Vision |
|---------|--------|
| Near | Morning/Evening/Weekly briefs render reliably; watchlist levels saved and searchable |
| Medium | Cross-video watchlist compounding — same ticker tracked across 20 briefs |
| Long | APP Builder generates: Stock Scanner, Trading Dashboard, Earnings Analyzer, Swing Trade Checklist |
| Ultimate | Real-time decision support: "What did my mentors say about NVDA this month?" → instant answer from vault |

**Sub-domains:** Technical analysis, fundamental analysis, macro, earnings, daily briefs, watchlists.

**Never sacrifice:** Merge-based Obsidian saves for watchlist items; presentation layer must not alter GEM schema.

---

### 🏛️ Politics (פוליטיקה)

**Intent:** Build a **structured political knowledge base** that separates ideology, opponent arguments, and liberal Judaism — without conflating perspectives.

| Horizon | Vision |
|---------|--------|
| Near | Opponent View (⚔️) gated to politics only; saved as `perspective: opponent_view` |
| Medium | Argument maps across videos — track how positions evolve over time |
| Long | APP Builder generates: Political Analysis Tools, Argument Maps, Rhetoric Pattern Detectors |
| Ultimate | "What did Channel X argue about judicial reform in 2025?" → structured timeline from vault |

**Sub-domains:** Ideology, economy, security, elections, media, liberal Judaism, global politics.

**Never sacrifice:** Opponent View isolation; liberal Judaism as separate knowledge layer (`פוליטיקה/יהדות ליברלית/`).

---

### 🤖 AI / Technology (טכנולוגיה ו-AI)

**Intent:** Capture tool workflows, prompts, and automation patterns from AI mentor content — and turn them into **reusable AI systems**.

| Horizon | Vision |
|---------|--------|
| Near | Tool-based organization (Claude Code, Cursor, Codex, Gemini, n8n, Base44) |
| Medium | Cross-video prompt library compounding in Obsidian |
| Long | APP Builder generates: AI Agents, Research Systems, LLM Workflows, RAG Knowledge Systems |
| Ultimate | "Build me the workflow Channel Y demonstrated" → PRD from vault → deployed automation |

**Sub-domains:** Coding assistants, prompt engineering, automation, RAG, local LLMs, Base44 development.

**Never sacrifice:** APP Builder stores under `App Ideas/AI & Technology/` — never mixed with video topic folders.

---

### 🥗 Health & Nutrition (בריאות ותזונה)

**Intent:** Convert health mentor content into **actionable protocols and tracking systems** — not just notes.

| Horizon | Vision |
|---------|--------|
| Near | Keto, diabetes, metabolic health content organized by SubBrain |
| Medium | Protocol builders from accumulated rules and checklists |
| Long | APP Builder generates: Tracking Tools, Protocol Builders, Meal Planners |
| Ultimate | Personal health knowledge base that informs daily decisions |

**Sub-domains:** Keto, diabetes, low-carb nutrition, recipes, supplements, exercise, lab tracking.

---

### 📦 Other Categories (Current + Future)

| Category | Intent | APP Builder Path |
|----------|--------|------------------|
| דרופשיפינג | Product research, suppliers, ad performance → ecommerce tools | `App Ideas/Dropshipping & Ecommerce/` |
| ידע אישי | Personal ideas, tasks, decisions, career — private knowledge layer | `App Ideas/Knowledge Management/` |
| Marketing | Campaign patterns, copy frameworks → marketing tools | `App Ideas/Marketing/` |
| Future topics | Same pipeline: Universal Tabs → save → vault → APP Builder | `App Ideas/Future Projects/` |

**Rule for all categories:** Same 7 Universal Tabs, same save system, same Obsidian merge behavior. Only Tab 7 (specialized) and vault paths differ.

---

## 5. What Should Never Be Sacrificed

These are **non-negotiable invariants**. No feature, refactor, or visual redesign may violate them without explicit user approval and governance doc update.

### Knowledge Retention

- Saved knowledge must survive page reload, browser restart, and Git pull.
- DB is authoritative for video metadata; Obsidian vault is authoritative for exported knowledge.
- Merge, not overwrite — re-saving must never destroy prior saves.
- Dedupe markers (`<!-- obsidian-item:{identityKey} -->`) must remain stable.

### Reusability

- Knowledge must be searchable across videos, not locked inside one video modal.
- APP Builder ideas must merge across videos into long-term project knowledge.
- Fixed library pages (`שוק ההון/ספריית ידע/`) accumulate evergreen concepts.
- Human-readable markdown — not proprietary JSON blobs — is the durable format.

### Obsidian-First Architecture

- Obsidian vault is the permanent brain; in-app Brain is a fast-access layer.
- All save paths must resolve to valid vault folder hierarchies.
- Knowledge must be portable outside the app (no vendor lock-in).
- Topic hierarchy (3 levels max) must map to Obsidian folder structure.

### Universal Tabs

- Exactly 7 tabs, fixed order, every video — no exceptions.
- Tab 7 (specialized) is the only category-specific surface.
- Bulk selection and save must work identically across tabs 1–6.
- Changing tab count or order requires governance doc update + user approval.

### Human-Readable Outputs

- All vault files are markdown with Hebrew content.
- Saved items are bullets and sections — not opaque IDs.
- PRD sections are plain-language requirements Claude/Cursor can execute.
- UI labels are Hebrew; code and paths may be English.

---

## 6. What Is More Important Than Visual Polish

When trade-offs arise, prioritize in this order:

| Priority | What | Why |
|----------|------|-----|
| **1** | Data persists after reload | Knowledge loss is irreversible |
| **2** | Save flows work correctly | Core product value |
| **3** | Universal Tabs populate | User cannot review empty tabs |
| **4** | Obsidian merge integrity | Overwrite destroys accumulated knowledge |
| **5** | Topic routing accuracy | Wrong folder = lost knowledge |
| **6** | Bulk selection reliability | Power-user workflow |
| **7** | GEM mapping correctness | Garbage in = garbage out |
| **8** | Hebrew RTL correctness | Accessibility and usability |
| **9** | Visual hierarchy clarity | Scannability matters |
| **10** | Animations, gradients, micro-interactions | Nice to have — last |

### Explicitly Deprioritized (Unless Blocking)

- Green/red arrow polish on market tables (MB UX backlog)
- H/M/L badge styling extensions
- Inline pill editing in Obsidian Mapping tab
- Dark theme fine-tuning
- Mobile layout perfection
- Component library unification

**Rule:** Ship knowledge integrity before visual refinement.

---

## 7. What Future AI Agents Should Optimize For

When an AI agent (Claude, Cursor, Codex, GPT) works on this project, optimize for:

### Knowledge Compounding

- Every change should make it **easier to save, find, and reuse** knowledge.
- Prefer merge/add over replace/delete.
- Extend extraction coverage (more GEM fields → more tabs) over new UI chrome.

### Workflow Continuity

- The 10-step pipeline (§3) must remain unbroken.
- New features plug into existing save/tab/vault flows — not parallel systems.
- One `VideoDetailPanel` serves all categories — no new page-per-type patterns.

### Selective Saving

- User reviews before commit — never auto-save analysis output.
- Draft-first for AI recommendations (Obsidian Mapping model).
- Bulk save filters already-saved items — no duplicate writes.

### Traceability

- Every APP Builder idea links back to source video knowledge.
- Obsidian markers preserve item identity across saves.
- Git commits document why, not just what.

### Portability

- Markdown outputs readable in any editor.
- No secrets in code; env-only configuration.
- GitHub = code truth; Base44 = runtime.

### Incremental Delivery

- Small, safe diffs over large refactors.
- Fix release gates (CH-1, MB-2/3/4) before new features.
- Update governance docs when invariants change.

---

## 8. What Future AI Agents Should Never Break

### Hard Stops — Do Not Proceed Without User Approval

| # | Invariant | Consequence if Broken |
|---|-----------|----------------------|
| 1 | 7 Universal Tabs — fixed order | User muscle memory destroyed |
| 2 | Obsidian merge (not overwrite) for per-item saves | Knowledge loss |
| 3 | GEM paste-back only — no GEM API | Breaks approved AI workflow |
| 4 | APP Builder consumes — does not generate analysis | Duplicates GEM, wastes tokens |
| 5 | Opponent View — politics only | Wrong perspective tagging |
| 6 | 3-level topic hierarchy max | Vault folder chaos |
| 7 | Hebrew UI, RTL layout | Product unusable for primary user |
| 8 | DB authoritative — localStorage temporary | Silent data loss |
| 9 | Draft-first Obsidian Mapping | Accidental overwrites |
| 10 | Approved AI settings in `CLAUDE.md` | JSON truncation, timeout failures |
| 11 | GitHub → Base44 Pull workflow | Code drift, undeployable state |
| 12 | Secrets outside Git | Security breach |

### Soft Stops — Warn User Before Proceeding

| # | Area | Risk |
|---|------|------|
| 1 | Changing GEM schema or prompts | Affects all analyzed videos |
| 2 | Renaming vault folder paths | Breaks existing Obsidian links |
| 3 | Removing legacy tab arrays | May break extraction fallbacks |
| 4 | Replacing `UniversalTabSelectionBar` with new component | Save workflow regression |
| 5 | Adding 8th universal tab | Architectural invariant violation |
| 6 | Auto-save without user action | Violates selective saving principle |
| 7 | Large refactors touching `VideoDetailPanel.jsx` | High regression surface |

---

## 9. User Development Philosophy

### Core Principles

```
Additive changes.
Preserve knowledge.
Preserve workflows.
Avoid destructive refactors.
```

### Additive Changes

- Add new sections, extractors, save paths — do not remove working ones.
- New categories plug into Tab 7 (specialized) — do not create new tab bars.
- Extend `brainStructure.js` SubBrains — do not rename existing folders.
- New governance docs supplement — do not delete prior decisions without recording why.

### Preserve Knowledge

- Never delete vault files programmatically.
- Never overwrite Obsidian notes without explicit user confirm.
- Migration scripts must copy, not move — until user verifies.
- localStorage keys have dual-key fallbacks (e.g., `market_brief_${id}` + `market_brief_${youtubeId}`).

### Preserve Workflows

- Per-row save (🧠🔮⭐) must always work alongside bulk save.
- Tab change clears selection — but never clears saved state indicators.
- GEM paste-back flow unchanged — user copies, pastes, reviews, saves.
- Git → commit → push → Base44 Pull — never skip Git.

### Avoid Destructive Refactors

- Do not rewrite `VideoDetailPanel.jsx` wholesale — it is the orchestrator.
- Do not merge Brain and Obsidian into one save destination — they serve different speeds.
- Do not replace Obsidian with in-app-only storage — portability is the point.
- Do not "simplify" by removing Universal Tabs — consistency is the point.
- If a refactor is necessary: document in `PROJECT_DECISIONS_HISTORY.md` first, get approval, migrate incrementally.

### Commit Philosophy

- Commit governance docs and source together when both change.
- Never commit secrets, dev artifacts, or `.playwright-mcp/` logs.
- WIP commits are acceptable; release commits require passing all 4 gates.
- `PROJECT_STATUS.md` and governance docs are safe checkpoint commits anytime.

---

## 10. Future North Star

> **Transform content consumption into a reusable knowledge system that generates insights, decisions, and applications.**

### The Full Loop

```
Watch  →  Structure  →  Save  →  Compound  →  Decide  →  Build  →  Operate
```

| Stage | Today | North Star |
|-------|-------|------------|
| **Watch** | Manual YouTube + RSS | Auto-ingest with transcript |
| **Structure** | GEM paste-back | Reliable automated analysis pipeline |
| **Save** | Per-item merge to Obsidian | Zero-friction selective save |
| **Compound** | Per-topic vault folders | Cross-video knowledge graphs |
| **Decide** | Manual review of briefs | "What do my mentors think about X?" queries |
| **Build** | APP Builder → PRD → Claude | One-click PRD → deployed Base44 app |
| **Operate** | External tools | Integrated apps powered by vault knowledge |

### The Ultimate Question This System Answers

> "I watched 200 hours of mentor content this year. What do I **know**, what can I **decide**, and what can I **build**?"

### What the North Star Is NOT

- A YouTube clone or video player
- A generic note-taking app
- An AI chatbot that replaces mentors
- A social platform for sharing videos
- A Bloomberg terminal (though stock briefs inform decisions)

### Measuring Progress Toward North Star

| Milestone | Indicator |
|-----------|-----------|
| M1: Reliable capture | 100 videos analyzed, all tabs populate, all saves persist |
| M2: Searchable vault | Find any insight across all videos in < 30 seconds |
| M3: First PRD → App | One APP Builder spec becomes a deployed Base44 application |
| M4: Cross-video compounding | Watchlist item tracked across 10+ briefs automatically |
| M5: Decision support | User makes real trading/political decision informed by vault |
| M6: Knowledge graph | Obsidian links connect insights across domains |
| M7: Autonomous pipeline | Video ingested → analyzed → structured → saved with minimal user action |

---

## Relationship to Other Governance Docs

| This Document (Intent) | Other Docs (Implementation) |
|------------------------|----------------------------|
| Why 7 tabs exist | `PROJECT_DECISIONS_HISTORY.md` §1–2 |
| Ideal workflow | `SAVE_SYSTEM_ARCHITECTURE.md` |
| Stock market vision | `STOCK_ANALYSIS_SCREEN_BIBLE.md` |
| What works today | `CURRENT_STATE_JUNE_2026.md` |
| UX rules | `DESIGN_SYSTEM_AND_UX_RULES.md` |
| Full index | `MASTER_PROJECT_BIBLE.md` |

**This document wins on intent.** If implementation drifts from vision, fix implementation — not vision — unless the user explicitly revises this document.

---

## Revision Protocol

When the user's strategic intent changes:

1. Update this document first.
2. Note the change in `PROJECT_DECISIONS_HISTORY.md`.
3. Then modify implementation.
4. Never change code first and document later.

---

*This document was created June 2026 to preserve product intent across development breaks. The user's vision outlives any single implementation session.*
