# AI Development Guide — YouTube Mentor Knowledge Brain

> This file defines the permanent UX and architecture rules for this project.
> Every Claude / Codex task must read this file before making changes.

---

## 1. Product Vision

This app is a **YouTube Mentor Knowledge Brain**.

- Analyzes videos, transcripts, GEMS outputs, and AI summaries.
- Saves selected knowledge to: Brain, Obsidian, Workspace, Knowledge Library.
- UX goal: **fast review, selective saving, and consistent topic organization.**

---

## 2. Topic Hierarchy Rules

Use exactly **3 levels**:

1. Main Topic (e.g., פוליטיקה, שוק ההון)
2. Sub-Topic (e.g., כלכלה, אידיאולוגיה)
3. Optional Title / Sub-Sub-Topic

**Never create a fourth hierarchy level.**

- Main topic comes from Mentor/Channel Management by default.
- User can manually override.
- Any change must sync everywhere (see §12 — Global Sync Rules).

---

## 3. Source of Truth

| Data | Source of Truth |
|------|----------------|
| Main topic | Mentor/Channel Management (default) |
| Sub-topic | Mentor/Channel Management (default) |
| Default GEM | Mentor/Channel Management (default) |
| After user save/override | Video metadata wins |
| Storage | **DB is authoritative** |
| localStorage | Temporary UI state only — never primary storage |

---

## 4. Save System

Every tab and sub-tab must support:

- Select item
- Select all
- Clear selection
- Save to Brain
- Save to Obsidian
- Save to Workspace

Use the shared **BulkSelectionBar** component (see §22).
Show bottom status bar: `נבחרו X פריטים`.

> See **§22** for the complete Universal Bulk Selection & Save System.

---

## 5. Political Analysis Rules

- Opponent View exists **only** for political content.
- Show ⚔️ only when main topic is `פוליטיקה`.
- Opponent View = content that does not represent my opinion.
- Save separately as `perspective: opponent_view`.

> See **§27** for the complete Political Content Structure.

---

## 6. Market / Morning Brief Rules

- Market topic must be `שוק ההון`, not `Markets`.
- Morning Brief uses these tabs:
  1. Market Snapshot
  2. Opportunities
  3. Stocks & Tickers
  4. Stock of the Day
  5. Risks & Warnings
  6. What to Watch This Week
  7. Macro
  8. Reusable Knowledge
  9. Action Checklist

> See **§24** for the complete Stock Market Category Structure and **§25** for the Educational Stock Market Video Structure.

---

## 7. GEM Rules

- GEM pages are **external web pages** — no API access.
- The app cannot automatically read GEM output.
- Use **paste-back flow**:
  1. Open GEM
  2. Copy transcript/context
  3. Wait for user to paste result
  4. Save pasted result to DB

---

## 8. Dropdown / Modal Rules

- Video modal must **not** close on outside click or ESC.
- Only the X button closes the modal.
- Topic and sub-topic dropdowns must:
  - Be clickable
  - Be scrollable
  - Have a working X button
  - Use high z-index (≥ 9999)
  - Not be blocked by any overlay (Radix Dialog, ScrollArea, etc.)
- Fix pattern: always add `onPointerDownOutside={e => e.preventDefault()}` to the main DialogContent.
- Fix pattern: add `e.nativeEvent.stopImmediatePropagation()` to all dropdown button handlers.

---

## 9. Obsidian Rules

- Load existing sub-topics from Obsidian vault.
- Save paths must match the current topic hierarchy.
- No duplicate topic trees (e.g., `Markets` vs `שוק ההון`).
- Normalize all legacy English category names to Hebrew.

---

## 10. UI Style Rules

- Avoid visual clutter.
- Prefer compact badges and accordions over large blocks.
- Do not add large full-width buttons unless absolutely necessary.
- Reuse existing design language and component patterns.
- Keep screens clean and scannable.

---

## 11. QA Checklist

Every change must verify:

- [ ] Refresh persistence (values survive page reload)
- [ ] No localStorage-only saved data
- [ ] Topic sync across all surfaces
- [ ] Obsidian path sync
- [ ] Workspace sync
- [ ] Brain sync
- [ ] Select All works
- [ ] Dropdowns are clickable and scrollable
- [ ] No duplicate categories

---

## 12. Global Sync Rules

When the user changes any of the following:

- Main topic
- Sub-topic
- Title / Sub-Sub-Topic
- Mentor category
- Default GEM
- Opponent-view state

The change must sync **everywhere**:

- Video metadata (DB)
- Workspace Library
- Brain
- Obsidian
- Knowledge Library
- Filters / search indexes
- GEM recommendation
- Cached analysis objects

**No screen should show old values after save.**

Sync must happen immediately after save without requiring page refresh.

---

## 13. Delete / Reset Rules

Clearly separate these two actions:

### `מחק מלל` (Clear Text)
Deletes only:
- Pasted draft text
- Textarea content
- Auto-restore cache
- localStorage / sessionStorage draft keys

### `מחק ניתוח` (Delete Analysis)
Deletes all of:
- Summary
- Chapters
- AI analysis output
- Political analysis
- Market brief
- GEM summary
- Notes
- Slogans
- Saved JSON draft / cache
- Waiting flags
- Auto-recovery data
- Workspace analysis cache
- Brain analysis cache
- Topic recommendations
- GEM recommendations
- Generated slogans
- Generated reusable knowledge

**After deletion, old content must never auto-restore.**

---

## 14. Workspace Rules

- Workspace membership is **manual only**.
- Videos must not be automatically added to Workspace.
- Only explicit user action saves a video to Workspace.
- Workspace state must persist in DB (not just localStorage).
- Workspace cards must show clear **saved / not saved** status at all times.

---

## 15. Reusable Components Rule

Do not duplicate save/select/dropdown logic across tabs.

Shared components and hooks must be used for:

- Selectable items
- Select All / Clear
- Bottom save toolbar (BulkSelectionBar)
- Save status indicators
- Topic dropdown
- Sub-topic dropdown
- Copy / save row actions

---

## 16. Market Mentor Rules

Channels like Oliver Velez and Micha.Stocks must default to:

- Main topic: `שוק ההון`
- No ⚔️ opponent-view icon
- Market GEM / Morning Briefing GEM
- Market sub-topics from Obsidian

**Legacy category names like `Markets` must always normalize to `שוק ההון`.**

---

## 17. Political Opponent View Scope

Opponent View is available **only** when main topic is `פוליטיקה`.

For all other topics:

- Hide ⚔️ icon completely
- Hide opponent-view badge
- Do not allow saving as `opponent_view`
- Ignore and do not display any accidental `opponentView: true` flags on the video

---

## 18. GEM Summary Rules

- `video.gemSummary` in DB is the source of truth.
- localStorage may only store temporary waiting flags keyed by `video.id`.
- Status indicators:
  - ⏳ Waiting for GEM output
  - 🟢 Summary received and saved
- Never show success status without actual DB content.

---

## 19. Morning Brief Save Rules

Every Morning Brief tab item must support:

- Copy
- Save to Brain
- Save to Obsidian
- Save to Workspace
- Select All (via BulkSelectionBar)

Missing JSON fields must show **clean empty states** — never crash or throw errors.

---

## 20. Hebrew Naming Rule

All user-facing labels, UI text, and Obsidian paths use Hebrew:

| English (forbidden in UI) | Hebrew (correct) |
|---------------------------|-----------------|
| Markets | שוק ההון |
| Politics | פוליטיקה |
| Health | בריאות ותזונה |
| Technology / AI | טכנולוגיה ו-AI |

English internal variable/code names are allowed in source code. UI and Obsidian paths must be Hebrew.

---

## 21. No Dangerous Refactor Rule

- Do not perform broad refactors unless explicitly requested.
- Prefer small, targeted, minimal changes.
- Before changing any shared architecture, explain the impact and get explicit approval.

---

## 22. Universal Bulk Selection & Save System

### Goal

Every screen that displays knowledge items must support the same selection and save workflow.

### Applies To

- Summary
- Chapters
- Key Points
- Political Analysis
- Opponent View
- Morning Brief
- Quotes
- Slogans
- Questions & Answers
- GEM Summary
- Knowledge Library
- Workspace Library
- Any future knowledge screen

### Required Selection Features

Every supported screen must provide:

- Select single item
- Multi-select
- Select All
- Clear Selection

### Sticky Bottom Action Bar (`BulkSelectionBar`)

Shown whenever one or more items are selected:

| Element | Description |
|---------|-------------|
| Count | `נבחרו X פריטים` |
| 🧠 | Save to Brain |
| 📚 | Save to Workspace |
| 🟣 | Save to Obsidian |
| ❌ | Clear Selection |

### Shared Component Rule

Do not implement selection logic separately in each screen.

Use a single shared component: **`BulkSelectionBar`**
Use shared selection hooks/services across all screens.

All screens must use:
- The same component design
- The same button order
- The same selection behavior
- The same save flow

### Future Development Rule

Any new screen that contains selectable knowledge items must automatically support:

- Select All
- Clear Selection
- Bulk selection
- Bottom Save Bar (`BulkSelectionBar`)
- Save to Brain
- Save to Workspace
- Save to Obsidian

**No exceptions.**

---

## 23. User-Specific UX Rules

- The user is building knowledge — keep UI self-explanatory and transparent.
- Prefer visible state indicators over hidden states.
- Every action with a side-effect (save, delete, sync) must show feedback: toast, badge, or status change.
- Never silently fail.
- Avoid modal-within-modal patterns — keep depth flat.
- Confirmation dialogs only for destructive actions (delete analysis, reset).
- Prefer Select All functionality on every knowledge screen.
- Prefer BulkSelectionBar over screen-specific save actions.
- Every saveable knowledge item should support:
  - Copy
  - Save to Brain
  - Save to Workspace
  - Save to Obsidian
- Topic/Sub-topic selectors should load options from Obsidian whenever possible.
- Morning Brief and Market screens should prioritize actionable information over long analysis.

---

## 24. Stock Market Category Structure

**Purpose:** Define the official hierarchy and default tab architecture for Stock Market content.

### Main Topic

📈 שוק ההון

### Official Sub-Topics

- 📉 ניתוח טכני
- 📊 ניתוח פונדמנטלי
- 🌍 מאקרו
- 🌅 מבזק בוקר
- 🌙 מבזק ערב
- 📅 מבזק שבועי
- 📊 דוחות כספיים

### Common Rules

All Stock Market sub-topics must reuse shared components:

- BulkSelectionBar
- Save to Brain
- Save to Workspace
- Save to Obsidian
- Copy
- Select All

**Do not duplicate save systems.**

### ניתוח טכני — Default Tabs

1. Summary
2. Concepts
3. Strategies
4. Checklists
5. Mistakes & Warnings
6. Key Insights
7. Useful Knowledge
8. App Ideas

### ניתוח פונדמנטלי — Default Tabs

1. Summary
2. Concepts
3. Financial Metrics
4. Valuation
5. Analysis Frameworks
6. Mistakes & Warnings
7. Key Insights
8. Useful Knowledge
9. App Ideas

### מאקרו — Default Tabs

1. Summary
2. Concepts
3. Cause & Effect
4. Market Impact
5. Macro Checklists
6. Risks
7. Key Insights
8. Useful Knowledge
9. App Ideas

### מבזק בוקר — Default Tabs

1. Market Snapshot
2. Opportunities
3. Stocks & Tickers
4. Stock of the Day
5. Risks & Warnings
6. What to Watch This Week
7. Macro
8. Reusable Knowledge
9. Action Checklist

### מבזק ערב — Default Tabs

1. Daily Summary
2. Market Close Review
3. Macro Updates
4. Sector Performance
5. What Changed Today
6. Tomorrow Events
7. AI Conclusions

### מבזק שבועי — Default Tabs

1. Weekly Highlights
2. Market Performance
3. Macro Review
4. Winning Sectors
5. Losing Sectors
6. Next Week Outlook
7. AI Analysis

### דוחות כספיים — Default Tabs

1. Earnings Summary
2. Financial Metrics
3. Guidance
4. Management Commentary
5. Risks
6. Key Insights
7. Useful Knowledge
8. App Ideas

### App Ideas — Cross-Topic Knowledge

App Ideas are a cross-topic knowledge type saved separately under `App Ideas/{topic}/`.

> The folder structure below is outdated. See **§26** and **§30** for the current APP Builder architecture and authoritative folder structure.

---

## 25. Educational Stock Market Video Structure

### Purpose

All educational Stock Market videos should use a consistent tab structure regardless of sub-topic.

Applies to:
- Technical Analysis
- Fundamental Analysis
- Macro Economics
- Trading Education
- Investing Education
- Risk Management
- Market Psychology
- Any future educational market content

### Default Tabs

Every educational Stock Market analysis must contain:

1. **📝 Summary**
   - Short explanation of the video
   - Main message
   - Executive summary

2. **📚 Concepts**
   - Definitions
   - Terminology
   - Frameworks
   - Models

3. **💡 Key Insights**
   - Most important takeaways
   - Lessons
   - Actionable insights

4. **⚙️ Methods & Workflows**
   - Strategies
   - Processes
   - Trading/investing workflows
   - Decision frameworks

5. **📋 Checklists**
   - Practical checklists
   - Review lists
   - Execution steps

6. **⚠️ Mistakes & Warnings**
   - Common mistakes
   - Risks
   - Pitfalls
   - Things to avoid

7. **🧠 Useful Knowledge**
   - Reusable knowledge
   - Evergreen principles
   - Long-term learning content

8. **🗂️ Save to Brain**
   - Save selected knowledge items
   - Supports Select All
   - Supports BulkSelectionBar

### Consistency Rule

All educational Stock Market content uses this tab structure unless a specialized content type explicitly overrides it.

Specialized content types that define their own tab structures:
- מבזק בוקר (Morning Brief)
- מבזק ערב (Evening Brief)
- מבזק שבועי (Weekly Brief)
- דוחות כספיים (Earnings Brief)

---

## 26. APP Builder Knowledge Layer

### Purpose

Every educational video should include an additional tab:

**🏗️ APP Builder**

This tab is not for content analysis. Its purpose is to extract from the video:

- App ideas
- Automation ideas
- AI agents
- Dashboards
- Workflows
- Productivity tools
- Knowledge systems
- Business opportunities

### Default APP Builder Sections

1. **📝 Summary** — What can be built from this video?

2. **🎯 Requirements**
   - Inputs
   - Outputs
   - User goals

3. **🖥️ Screens**
   - Suggested UI screens
   - Dashboards
   - Pages

4. **⚙️ Logic**
   - Business rules
   - Calculations
   - Automation flow

5. **🐛 Risks & Challenges**
   - Technical risks
   - Data limitations
   - UX concerns

6. **📋 Tasks**
   - Development tasks
   - MVP scope
   - Future improvements

7. **🚀 Development Prompt**
   - Claude Code prompt
   - Codex prompt
   - Base44 implementation ideas

### Topic-Based Storage Structure

APP Builder content must NOT be stored in a single global folder.
APP Builder content must NOT be stored under the video's main topic folder (e.g., `שוק ההון/`).

Save under `App Ideas/` organized by topic:

```
App Ideas/
  ├── Stock Market/
  ├── AI & Technology/
  ├── Dropshipping & Ecommerce/
  ├── Marketing/
  ├── Politics/
  ├── Health & Nutrition/
  ├── Knowledge Management/
  ├── Taxi Business/
  └── Future Projects/
```

### Topic Assignment Rule

The APP Builder category automatically inherits the video's main topic.

| Video Topic | Obsidian Path | Example Outputs |
|-------------|--------------|-----------------|
| שוק ההון | `App Ideas/Stock Market/` | Stock Scanner, Trading Dashboard, Earnings Analyzer, Swing Trade Checklist |
| AI / טכנולוגיה | `App Ideas/AI & Technology/` | AI Agents, Research Systems, LLM Workflows |
| Dropshipping | `App Ideas/Dropshipping & Ecommerce/` | Product Research Tools, Competitor Tracking, Ad Performance |
| פוליטיקה | `App Ideas/Politics/` | Analysis Tools, Argument Maps |
| בריאות ותזונה | `App Ideas/Health & Nutrition/` | Tracking Tools, Protocol Builders |

### Knowledge Merge Rule

Multiple videos from the same topic may contribute to the same future project. The system must support:

- Merging ideas from multiple videos
- Appending new findings to existing projects
- Cross-linking related projects
- Building long-term project knowledge bases

### Reusability Rule

APP Builder ideas must remain:
- Searchable across all videos
- Reusable across projects
- Topic-organized
- Easy to expand over time

### Long-Term Goal

The purpose of APP Builder is to **transform learning into creation**.

Educational videos should not only generate knowledge — they should generate:

- Products
- Dashboards
- AI Agents
- Automations
- Internal Tools
- Business Opportunities
- Future Software Projects

organized by topic and accumulated over time.

---

## 27. Political Content Structure

**Purpose:** Define the official hierarchy, tab architecture, and storage rules for political content.

> For Opponent View scope rules, see §17.
> For political analysis save rules, see §5.

---

### Main Topic

🏛️ פוליטיקה

---

### Official Sub-Topics

- 🧠 אידיאולוגיה
- 💰 כלכלה פוליטית
- 🛡️ ביטחון ומדיניות חוץ
- 🗳️ בחירות ומערכת הממשל
- 📺 תקשורת ופרסום פוליטי
- ✡️ יהדות ליברלית
- 📜 היסטוריה פוליטית
- 🌐 פוליטיקה גלובלית

---

### Default Tab Structure — Political Video

Every political video must use this 8-tab structure:

1. **📝 Summary**
   - Short video summary
   - Main political message
   - Speaker / channel context

2. **🌍 Background & Context**
   - Historical context
   - Political background
   - Relevant events or conditions

3. **⚖️ Core Arguments**
   - Main claims made in the video
   - Supporting evidence presented
   - Logical structure of the argument

4. **🧠 Ideology**
   - Political worldview expressed
   - Ideological framework
   - Alignment: right / left / center / other
   - Key values and principles

5. **⚔️ Opponent View**
   - Counter-arguments from the opposing side
   - Content that does not represent my opinion
   - Saved separately as `perspective: opponent_view`
   - **Available only when main topic is `פוליטיקה`** — see §17

6. **✡️ Liberal Judaism**
   - Saved as a separate knowledge layer (see below)
   - Judaism-related political positions
   - Progressive / liberal Jewish perspectives
   - Intersections of religion and politics

7. **🧠 Reusable Knowledge**
   - Evergreen political principles
   - Rhetorical patterns
   - Argumentation frameworks
   - Concepts applicable across political topics

8. **🏗️ APP Builder**
   - App ideas derived from the video
   - Automation / analysis tools
   - Saved under `App Ideas/Politics/` — see §26

---

### Opponent View Rules

- The ⚔️ Opponent View tab is **only visible** when the video's main topic is `פוליטיקה`.
- Content saved in this tab must be tagged `perspective: opponent_view`.
- This content does **not** represent the user's position.
- For full scope rules, see **§17**.

---

### Liberal Judaism — Separate Knowledge Layer

Liberal Judaism content must be saved and organized as a distinct sub-layer under politics:

- **Obsidian path:** `פוליטיקה/יהדות ליברלית/`
- **Sub-topic tag:** `יהדות ליברלית`
- Must be selectable and saveable independently via BulkSelectionBar
- Supports: Save to Brain, Save to Obsidian, Save to Workspace
- Must **not** be mixed into general ideology notes

---

### Obsidian Path Rules

| Content Type | Obsidian Path |
|-------------|--------------|
| Summary | `פוליטיקה/{sub-topic}/{video-title}` |
| Core Arguments | `פוליטיקה/{sub-topic}/טענות` |
| Ideology | `פוליטיקה/אידיאולוגיה/` |
| Opponent View | `פוליטיקה/דעת האויב/` |
| Liberal Judaism | `פוליטיקה/יהדות ליברלית/` |
| Reusable Knowledge | `פוליטיקה/ידע לשימוש חוזר/` |
| APP Builder | `App Ideas/Politics/` |

---

### Save Rules

All political content tabs use **BulkSelectionBar** (see §22).

Every tab must support:

- Select single item
- Select All
- Clear Selection
- Save to Brain (🧠)
- Save to Obsidian (🟣)
- Save to Workspace (📚)
- Copy

**No tab may implement its own custom save toolbar** — use the shared BulkSelectionBar component.

---

### Common Rules

- All sub-topics use the shared BulkSelectionBar component.
- Do not duplicate save logic per tab.
- Opponent View content must always be clearly labeled — never mixed with neutral analysis.
- Liberal Judaism is always saved to its own Obsidian path, regardless of video sub-topic.

---

## 28. Universal Educational Knowledge Structure

**Purpose:** Define the default educational structure that should be reused across all knowledge categories unless a category explicitly overrides it.

> Save system: all tabs use §22 (BulkSelectionBar). No category-specific save systems.
> APP Builder tab: all categories use §26 (APP Builder Knowledge Layer).

### Applies To

This is the default structure for all educational content, including:

- Health & Nutrition
- Personal Knowledge
- AI & Technology
- Development
- Dropshipping
- Any future educational category

---

### Default Educational Tab Structure

All educational videos must use this 8-tab structure unless the category explicitly overrides it:

1. **📝 Summary**
   - Short video summary
   - Main message
   - Executive summary

2. **📚 Concepts / Context**
   - Definitions
   - Terminology
   - Frameworks
   - Background context

3. **💡 Key Insights**
   - Most important takeaways
   - Lessons
   - Actionable insights

4. **⚙️ Methods & Frameworks**
   - Strategies
   - Processes
   - Decision frameworks
   - Step-by-step workflows

5. **📋 Checklists / Actions**
   - Practical checklists
   - Action items
   - Execution steps
   - Review lists

6. **⚠️ Risks & Warnings**
   - Common mistakes
   - Risks
   - Pitfalls
   - Things to avoid

7. **🧠 Useful Knowledge**
   - Reusable knowledge
   - Evergreen principles
   - Long-term learning content

8. **🏗️ APP Builder**
   - App ideas from the video
   - Saved to topic-specific path — see §26

---

### Consistency Rule

New educational categories inherit this structure by default.

Only category-specific requirements may replace one or more middle tabs (tabs 2–7).

Tab 1 (Summary) and Tab 8 (APP Builder) are fixed across all educational categories.

### Override Examples

| Category | Replaced Tabs | Category-Specific Tabs |
|----------|--------------|----------------------|
| AI & Technology | Concepts, Methods | AI Tools, Prompts & Templates, Workflows |
| Health & Nutrition | Methods, Checklists | Nutrition, Supplements, Lifestyle |
| Development | Concepts, Methods | Requirements, Screens, Architecture |
| Dropshipping | Use Cases, Methods | Products, Marketing, Suppliers |
| Stock Market (Educational) | — | See §25 |
| Morning Brief | All | See §24 |
| Political | All | See §27 |

---

### Save Rules

All tabs must use the Universal Bulk Selection & Save System from **§22**.

Do not create category-specific save systems.

---

### Future Expansion Rule

After §28 is established, category-specific sections may be added individually:

- §29 — AI & Technology Structure
- §30 — Health & Nutrition Structure
- §31 — Personal Knowledge Structure
- §32 — Development Structure
- §33 — Dropshipping Structure

Each category section documents only its **overrides** relative to §28 — not the full tab structure.

---

## 29. AI & Technology Knowledge Structure

**Purpose:** Define the tab architecture, tool-based organization, and storage rules for AI & Technology content.

> Inherits default structure from §28. Documents overrides only.
> Save system: see §22 (BulkSelectionBar).
> APP Builder storage: see §26.

---

### Main Topic

🤖 AI & Technology

This category covers: AI tools, coding assistants, automations, research tools, AI agents, productivity systems, and technology workflows.

---

### Default Tab Structure — AI & Technology Video

Every AI & Technology video must use this 8-tab structure:

1. **📝 Summary**
   - Short video summary
   - Main tool or topic covered
   - Key takeaway

2. **🤖 AI Tools**
   - Which tools are featured
   - Tool capabilities and features
   - Best practices per tool

3. **⚙️ Workflows & Automations**
   - Step-by-step workflows
   - Automation pipelines
   - Integration patterns
   - Repeatable processes

4. **💡 Use Cases**
   - Practical applications
   - Real-world examples
   - Who benefits and how

5. **📋 Prompts & Templates**
   - Reusable prompts
   - Prompt patterns
   - Templates for recurring tasks
   - System prompts

6. **⚠️ Risks & Limitations**
   - Tool limitations
   - Failure modes
   - Cost / rate limit warnings
   - When not to use this tool

7. **🧠 Useful Knowledge**
   - Evergreen principles
   - Concepts applicable across tools
   - Long-term learning content

8. **🏗️ APP Builder**
   - App and automation ideas from the video
   - Saved under `App Ideas/AI & Technology/` — see §26

---

### Tool-Based Knowledge Organization

Organize knowledge by tool when relevant:

```text
AI & Technology/
├── ChatGPT
├── Claude
├── Claude Code
├── Codex
├── Cursor
├── GitHub
├── NotebookLM
├── Perplexity
├── Gemini
├── n8n
├── Base44
├── Obsidian
├── AI Agents
├── MCP
├── RAG
└── Future Tools
```

---

### Extraction Rules

When analyzing an AI & Technology video, extract:

- Which tool is being used
- Best practices
- Prompts
- Templates
- Workflows
- Automations
- Limitations
- Integrations
- Future app ideas

---

### Tool Knowledge Examples

| Tool | What to Extract |
|------|----------------|
| ChatGPT | Prompts, GPTs, memory, workflows |
| Claude | Projects, artifacts, reasoning workflows |
| Claude Code | Coding workflows, CLAUDE.md rules, project patterns |
| Cursor | IDE workflows, AI-assisted coding |
| GitHub | Repositories, version control, CI/CD |
| NotebookLM | Research workflows, notebook organization |
| Perplexity | Search strategies, research patterns |
| Gemini | GEMS, multimodal workflows |
| n8n | Automation flows, node patterns |
| Base44 | App building, entity design, environment variables |
| Obsidian | Knowledge management, vault structure, plugins |
| AI Agents | Autonomous workflows, agent design patterns |
| RAG | Retrieval systems, vector stores, chunking strategies |
| MCP | Model Context Protocol integrations |

---

### APP Builder Integration

AI & Technology videos support APP Builder when relevant.

APP Builder ideas from this category are saved under `App Ideas/AI & Technology/`.

> The folder structure in earlier drafts is outdated. See **§26** and **§30** for the current APP Builder architecture and authoritative folder structure.

---

### Save Rules

All AI & Technology tabs use **BulkSelectionBar** (see §22).

Every tab must support:

- Select single item
- Multi-select
- Select All
- Clear Selection
- Save to Brain (🧠)
- Save to Obsidian (🟣)
- Save to Workspace (📚)
- Copy

**Do not implement custom save logic per tab** — use the shared BulkSelectionBar component.

---

### Obsidian Path Rules

| Content Type | Obsidian Path |
|-------------|--------------|
| Summary | `AI & Technology/{tool}/{video-title}` |
| Prompts & Templates | `AI & Technology/{tool}/Prompts/` |
| Workflows | `AI & Technology/{tool}/Workflows/` |
| Useful Knowledge | `AI & Technology/Useful Knowledge/` |
| APP Builder | `App Ideas/AI & Technology/` — see §30 |

> **APP Builder path is governed by §30 — Master Obsidian Folder Architecture.**
> The path listed above is correct. The alternative structure shown in earlier §29 drafts is superseded by §30.

---

## 30. Master Obsidian Folder Architecture

**Purpose:** Single authoritative source of truth for all Obsidian folder paths in this project.

> This section supersedes any Obsidian path defined in §9, §24, §26, or §29 where there is a conflict.
> All future sections must use paths defined here. Do not define new top-level paths elsewhere.

---

### Conflict Resolution

The following conflicts existed before this section and are now resolved:

| Conflict | Old (superseded) | Correct (§30) |
|----------|-----------------|--------------|
| §24 App Ideas | `App Ideas/YouTube Mentor`, `Base44`, `AI Agents` | `App Ideas/{topic}/` — topic-based |
| §29 APP Builder | `App Ideas/AI Agents`, `Automations`, `Research Systems` | `App Ideas/AI & Technology/` |
| §26 (correct) | `App Ideas/Stock Market/`, `AI & Technology/`, etc. | ✅ Already correct — §30 adopts §26 |

**§26 is the source of truth for APP Builder paths. §30 extends it.**

---

### 1. Top-Level Obsidian Folder Structure

```text
Obsidian Vault Root/
│
├── שוק ההון/
├── פוליטיקה/
├── AI & Technology/
├── בריאות ותזונה/
├── ידע אישי/
├── פיתוח/
├── דרופשיפינג/
│
├── App Ideas/                ← APP Builder (all categories)
└── _Archive/                 ← Legacy notes, do not delete
```

**Rules:**
- All category folders use their Hebrew display name, except `AI & Technology` (mixed — established convention).
- `App Ideas/` is a cross-category folder — never stored inside a category folder.
- `_Archive/` preserves old notes — never delete, never reorganize without explicit approval.

---

### 2. Category Folder Mapping

#### 📈 שוק ההון

```text
שוק ההון/
├── ניתוח טכני/
├── ניתוח פונדמנטלי/
├── מאקרו/
├── מבזקי בוקר/
├── מבזקי ערב/
├── מבזקי שבועי/
├── דוחות כספיים/
└── ידע לשימוש חוזר/
```

| Content Type | Path |
|-------------|------|
| Video summary | `שוק ההון/{sub-topic}/{video-title}` |
| Reusable knowledge | `שוק ההון/ידע לשימוש חוזר/` |
| APP Builder | `App Ideas/Stock Market/` |
| Morning Brief | `שוק ההון/מבזקי בוקר/{date}` |

---

#### 🏛️ פוליטיקה

```text
פוליטיקה/
├── אידיאולוגיה/
├── כלכלה פוליטית/
├── ביטחון ומדיניות חוץ/
├── בחירות ומערכת הממשל/
├── תקשורת ופרסום פוליטי/
├── יהדות ליברלית/          ← separate knowledge layer
├── היסטוריה פוליטית/
├── פוליטיקה גלובלית/
├── דעת האויב/               ← Opponent View (perspective: opponent_view)
└── ידע לשימוש חוזר/
```

| Content Type | Path |
|-------------|------|
| Video summary | `פוליטיקה/{sub-topic}/{video-title}` |
| Opponent View | `פוליטיקה/דעת האויב/` |
| Liberal Judaism | `פוליטיקה/יהדות ליברלית/` |
| Reusable knowledge | `פוליטיקה/ידע לשימוש חוזר/` |
| APP Builder | `App Ideas/Politics/` |

---

#### 🤖 AI & Technology

```text
AI & Technology/
├── ChatGPT/
├── Claude/
├── Claude Code/
├── Codex/
├── Cursor/
├── GitHub/
├── NotebookLM/
├── Perplexity/
├── Gemini/
├── n8n/
├── Base44/
├── Obsidian/
├── AI Agents/
├── MCP/
├── RAG/
├── Useful Knowledge/
└── Future Tools/
```

| Content Type | Path |
|-------------|------|
| Video summary | `AI & Technology/{tool}/{video-title}` |
| Prompts & Templates | `AI & Technology/{tool}/Prompts/` |
| Workflows | `AI & Technology/{tool}/Workflows/` |
| Useful knowledge | `AI & Technology/Useful Knowledge/` |
| APP Builder | `App Ideas/AI & Technology/` |

---

#### 🥗 בריאות ותזונה

```text
בריאות ותזונה/
├── תזונה/
├── תוספי תזונה/
├── אורח חיים/
├── כושר ופעילות גופנית/
├── בריאות מנטלית/
├── סוכרת ובריאות מטבולית/
└── ידע לשימוש חוזר/
```

| Content Type | Path |
|-------------|------|
| Video summary | `בריאות ותזונה/{sub-topic}/{video-title}` |
| Reusable knowledge | `בריאות ותזונה/ידע לשימוש חוזר/` |
| APP Builder | `App Ideas/Health & Nutrition/` |

---

#### 📖 ידע אישי

```text
ידע אישי/
├── מיינדסט/
├── הרגלים/
├── פרודוקטיביות/
├── למידה/
├── תקשורת/
├── קריירה/
├── פיננסים אישיים/
└── ידע לשימוש חוזר/
```

| Content Type | Path |
|-------------|------|
| Video summary | `ידע אישי/{sub-topic}/{video-title}` |
| Reusable knowledge | `ידע אישי/ידע לשימוש חוזר/` |
| APP Builder | `App Ideas/Personal Knowledge/` |

---

#### 💻 פיתוח

```text
פיתוח/
├── React & Frontend/
├── Backend/
├── Base44/
├── Claude Code/
├── ארכיטקטורה/
├── CI/CD & DevOps/
└── ידע לשימוש חוזר/
```

| Content Type | Path |
|-------------|------|
| Video summary | `פיתוח/{sub-topic}/{video-title}` |
| Reusable knowledge | `פיתוח/ידע לשימוש חוזר/` |
| APP Builder | `App Ideas/Development/` |

---

#### 🛒 דרופשיפינג

```text
דרופשיפינג/
├── מחקר מוצרים ומגמות/
├── ספקים/
├── בניית חנות/
├── שיווק ופרסום/
├── תפעול ואוטומציה/
├── ניתוח מתחרים/
├── סקייל ומיטוב/
└── ידע לשימוש חוזר/
```

| Content Type | Path |
|-------------|------|
| Video summary | `דרופשיפינג/{sub-topic}/{video-title}` |
| Research Methods | `דרופשיפינג/מחקר מוצרים ומגמות/Methods/` |
| Ad Templates | `דרופשיפינג/שיווק ופרסום/Templates/` |
| Operational SOPs | `דרופשיפינג/תפעול ואוטומציה/SOPs/` |
| Reusable knowledge | `דרופשיפינג/ידע לשימוש חוזר/` |
| APP Builder | `App Ideas/Dropshipping & Ecommerce/` |

---

### 3. APP Builder — Single Authoritative Structure

All APP Builder content is stored under `App Ideas/` organized by topic.

**This is the only valid APP Builder storage structure. §24 and §29 contain outdated alternatives — ignore them.**

```text
App Ideas/
├── Stock Market/
├── AI & Technology/
├── Politics/
├── Health & Nutrition/
├── Personal Knowledge/
├── Development/
├── Dropshipping & Ecommerce/
├── Marketing/
├── Knowledge Management/
├── Taxi Business/
└── Future Projects/
```

**Rules:**
- APP Builder content is always saved under `App Ideas/{topic}/`, never inside the category folder itself.
- Topic maps automatically from the video's main topic (see §26 Topic Assignment Rule).
- `Future Projects/` is for ideas that don't fit any current topic.

---

### 4. Brain vs Workspace vs Obsidian Mapping

| Storage | Purpose | What belongs here |
|---------|---------|-------------------|
| 🧠 **Brain** | Curated personal knowledge | Concepts, insights, principles, key learnings, evergreen rules |
| 📚 **Workspace** | Active working items | Videos being processed, current projects, drafts, items under review |
| 🟣 **Obsidian** | Long-term reference base | Organized knowledge by topic, searchable permanent notes, prompts, frameworks |

**Rules:**
- Brain = personal curated learning (what I believe, what I've internalized)
- Workspace = temporary or active (what I'm working on now)
- Obsidian = structured reference (what I can search and reuse later)
- An item can be saved to all three simultaneously if relevant
- Never use localStorage as a substitute for any of the three

---

### 5. Future Expansion Rules

When a new knowledge category is added:

1. Add a top-level folder in the vault root (Hebrew name where applicable).
2. Add `{category}/ידע לשימוש חוזר/` as a default sub-folder.
3. Add `App Ideas/{Category}/` under the APP Builder section — never under the category folder.
4. Document the new folder structure in §30 (this section) before using it.
5. Do not create a path in a category-specific section (§31+) that conflicts with §30.

**§30 must be updated whenever a new top-level category or APP Builder path is added.**

---

### 6. Hebrew vs English Folder Names

| Category | Obsidian Folder Name | Reason |
|----------|---------------------|--------|
| Stock Market | `שוק ההון/` | Hebrew — established |
| Politics | `פוליטיקה/` | Hebrew — established |
| AI & Technology | `AI & Technology/` | English — mixed naming, tool names are English |
| Health & Nutrition | `בריאות ותזונה/` | Hebrew |
| Personal Knowledge | `ידע אישי/` | Hebrew |
| Development | `פיתוח/` | Hebrew |
| Dropshipping | `דרופשיפינג/` | Hebrew transliteration |
| App Ideas | `App Ideas/` | English — cross-category, tool-neutral |

**Rule:** When in doubt, use Hebrew for the folder name. Use English only when the content is inherently English (tool names, code, commands).

---

## 31. Health & Nutrition Structure

**Purpose:** Define the tab architecture and storage rules for Health & Nutrition content.

> Inherits default 8-tab structure from §28. Documents overrides only.
> Obsidian paths from §30 — do not redefine.
> Save system: §22 (BulkSelectionBar).
> APP Builder: §26 → `App Ideas/Health & Nutrition/`.

---

### Main Topic

🥗 בריאות ותזונה

---

### Official Sub-Topics

| תת-נושא | תיאור |
|---------|-------|
| תזונה | מאקרו, מיקרו, תזונה מאוזנת, תזונה פונקציונלית |
| תוספי תזונה | ויטמינים, מינרלים, חלבון, קריאטין, תוספים ספציפיים |
| אורח חיים | שינה, ניהול סטרס, הרגלים יומיומיים |
| כושר ופעילות גופנית | אימוני כוח, סיבולת, שיקום, תנועה |
| בריאות מנטלית | קשר נפש-גוף, תזונה ומוח, חרדה ודיכאון |
| סוכרת ובריאות מטבולית | עמידות לאינסולין, רמות סוכר, תזונה מטבולית, פרוטוקולי ניהול |

---

### Default Tab Structure — Health & Nutrition Video

Inherits from §28. Overrides tabs 2, 4, and 5.

| Tab | אייקון | שם | סטטוס |
|-----|--------|----|--------|
| 1 | 📝 | Summary | קבוע (§28) |
| 2 | 🔬 | Science & Concepts | **Override** |
| 3 | 💡 | Key Insights | ירוש מ-§28 |
| 4 | 🥗 | Protocols & Plans | **Override** |
| 5 | 💊 | Supplements & Nutrition Facts | **Override** |
| 6 | ⚠️ | Risks & Warnings | ירוש מ-§28 |
| 7 | 🧠 | Useful Knowledge | ירוש מ-§28 |
| 8 | 🏗️ | APP Builder | קבוע (§28) |

---

### Tab Definitions

**Tab 2 — 🔬 Science & Concepts**

- ביולוגיה בסיסית ומנגנונים תזונתיים
- מושגים: מאקרו, מיקרו, גליקמי, אינסולין, מטבוליזם
- מחקרים ומקורות רלוונטיים

**Tab 4 — 🥗 Protocols & Plans**

תוכניות ופרוטוקולים מעשיים מהסרטון:

- פרוטוקולי קטו (Keto)
- פרוטוקולי צום (Intermittent Fasting, extended fasting)
- תוכניות ניהול סוכר בדם
- תוכניות הרזיה
- תוכניות אימון
- תוכניות בניית הרגלים
- פרוטוקולי ניהול מחלות מטבוליות (סוכרת, עמידות לאינסולין)

**Tab 5 — 💊 Supplements & Nutrition Facts**

- שמות תוספים ספציפיים
- מינונים מומלצים
- תזמון נטילה
- מקורות תזונתיים טבעיים
- עובדות תזונתיות מפתח (ערכי מאקרו, מיקרו)

---

### Obsidian Folder Structure

מוגדר ב-§30. §31 מאמץ — לא מגדיר מחדש.

```text
בריאות ותזונה/
├── תזונה/
├── תוספי תזונה/
├── אורח חיים/
├── כושר ופעילות גופנית/
├── בריאות מנטלית/
├── סוכרת ובריאות מטבולית/
└── ידע לשימוש חוזר/
```

| סוג תוכן | Obsidian Path |
|----------|--------------|
| סיכום סרטון | `בריאות ותזונה/{sub-topic}/{video-title}` |
| פרוטוקולים | `בריאות ותזונה/{sub-topic}/Protocols/` |
| תוספים | `בריאות ותזונה/תוספי תזונה/` |
| סוכרת ומטבוליזם | `בריאות ותזונה/סוכרת ובריאות מטבולית/` |
| ידע לשימוש חוזר | `בריאות ותזונה/ידע לשימוש חוזר/` |
| APP Builder | `App Ideas/Health & Nutrition/` |

---

### APP Builder Opportunities

| רעיון | תיאור |
|-------|-------|
| Meal Planner | תכנון ארוחות לפי יעד (הרזיה, בניית שריר, סוכרת) |
| Supplement Tracker | מעקב נטילת תוספים ותזמון |
| Protocol Builder | בניית פרוטוקול צום / קטו / ניהול סוכר אישי |
| Progress Tracker | מעקב מדדי בריאות לאורך זמן |
| Nutrition Calculator | חישוב קלוריות, מאקרו, עומס גליקמי |

נשמר תחת `App Ideas/Health & Nutrition/` (§30).

---

### Save Rules

כל הtabs משתמשים ב-BulkSelectionBar (§22).

כל tab תומך ב:
- Select / Multi-Select / Select All / Clear
- Save to Brain (🧠)
- Save to Obsidian (🟣)
- Save to Workspace (📚)
- Copy

אין מערכת שמירה ייעודית לקטגוריה זו.

---

## 32. Development Structure

**Purpose:** Define the tab architecture and storage rules for Development content — building and maintaining existing projects.

> Inherits default 8-tab structure from §28. Documents overrides only.
> Obsidian paths from §30 — do not redefine.
> Save system: §22 (BulkSelectionBar).
> APP Builder: §26 → `App Ideas/Development/`.
> For learning about tools (capabilities, prompts, use cases) → see §29 AI & Technology.

---

### Main Topic

💻 פיתוח

**Core distinction:** Development = HOW to build (patterns, architecture, implementation). APP Builder = WHAT to build (new ideas). AI & Technology = WHAT tools can do (capabilities).

---

### Official Sub-Topics

| תת-נושא | תיאור |
|---------|-------|
| YouTube Mentor | הפרויקט הזה — ארכיטקטורה, קוד, Base44, שיפורים |
| Base44 | בניית אפליקציות ב-Base44 — entities, functions, environment |
| React & Frontend | React, Tailwind, Radix, Vite — קוד ופטרנים |
| Claude Code | שימוש ב-Claude Code לבנייה — CLAUDE.md, workflows, project rules |
| Automation & n8n | בניית automations ספציפיות — לא סקירת כלי |
| Obsidian Integration | פיתוח integration עם Obsidian vault API |
| AI Agents | בניית agents בקוד — architecture, tools, prompts כקוד |
| ידע לשימוש חוזר | עקרונות פיתוח אורך-חיים |

---

### Default Tab Structure — Development Video

Inherits from §28. Overrides tabs 2, 4, and 5.

| Tab | אייקון | שם | סטטוס |
|-----|--------|----|--------|
| 1 | 📝 | Summary | קבוע (§28) |
| 2 | 🗺️ | Architecture & Design | **Override** |
| 3 | 💡 | Key Insights | ירוש מ-§28 |
| 4 | ⚙️ | Implementation & Workflow | **Override** |
| 5 | 📋 | Reusable Patterns & Snippets | **Override** |
| 6 | ⚠️ | Risks & Warnings | ירוש מ-§28 |
| 7 | 🧠 | Useful Knowledge | ירוש מ-§28 |
| 8 | 🏗️ | APP Builder | קבוע (§28) |

---

### Tab Definitions

**Tab 2 — 🗺️ Architecture & Design**

- Design patterns (component hierarchy, separation of concerns)
- System design (data flow, API structure, state management)
- Data models and entity design
- Folder structure and project organization
- **Base44 Architecture** — entity design, backend functions, environment variables
- **React Architecture** — component tree, hooks patterns, context, routing
- **Integration Design** — Obsidian API, external services, webhook patterns

**Tab 4 — ⚙️ Implementation & Workflow**

- צעדי בנייה מפורטים
- Git workflow, branching strategy
- CI/CD and deployment steps
- Testing strategy
- Step-by-step implementation guides

**Tab 5 — 📋 Reusable Patterns & Snippets**

לא רק קוד — כל דבר שאפשר לשמור ולעשות בו שימוש חוזר:

- קטעי קוד לשימוש חוזר
- CLAUDE.md patterns and rules
- Prompts used for code generation
- Workflow templates
- Configuration examples (.env, vite.config, tailwind.config)
- Reusable implementation patterns across projects

---

### Classification: AI & Technology vs Development

| אם הסרטון מלמד... | → קטגוריה |
|-------------------|-----------|
| מה הכלי יכול לעשות (capabilities) | 🤖 AI & Technology (§29) |
| איך בונים עם הכלי (implementation) | 💻 Development (§32) |
| גם וגם | שתי קטגוריות — שמור בשתיהן |

| סרטון | קטגוריה |
|-------|---------|
| "Claude Code — מה הוא יכול" | AI & Technology |
| "בניית פרויקט עם Claude Code" | Development |
| "Base44 — features tour" | AI & Technology |
| "Base44 — בניית אפליקציה מ-A ל-Z" | Development |
| "React architecture patterns" | Development |
| "n8n — מה אפשר לאוטמט" | AI & Technology |
| "n8n — בניית workflow ספציפי" | Development |
| "Cursor + Claude Code ביחד" | שניהם |

---

### Obsidian Folder Structure

מוגדר ב-§30. §32 מאמץ — לא מגדיר מחדש.

```text
פיתוח/
├── YouTube Mentor/
├── Base44/
├── React & Frontend/
├── Claude Code/
├── Automation & n8n/
├── Obsidian Integration/
├── AI Agents/
└── ידע לשימוש חוזר/
```

| סוג תוכן | Obsidian Path |
|----------|--------------|
| סיכום סרטון | `פיתוח/{sub-topic}/{video-title}` |
| Reusable Patterns & Snippets | `פיתוח/{sub-topic}/Snippets/` |
| Workflow patterns | `פיתוח/{sub-topic}/Workflows/` |
| ידע לשימוש חוזר | `פיתוח/ידע לשימוש חוזר/` |
| APP Builder | `App Ideas/Development/` |

---

### APP Builder Opportunities

| רעיון | תיאור |
|-------|-------|
| Dev Workflow Generator | יצירת workflow מותאם אישית לפרויקט |
| CLAUDE.md Builder | כלי לבניית CLAUDE.md לפי סוג פרויקט |
| Base44 Entity Designer | UI לעיצוב entities וrelations |
| Code Pattern Library | ספריית patterns לשימוש חוזר |

נשמר תחת `App Ideas/Development/` (§30).

---

### Save Rules

כל הtabs משתמשים ב-BulkSelectionBar (§22).

כל tab תומך ב:
- Select / Multi-Select / Select All / Clear
- Save to Brain (🧠)
- Save to Obsidian (🟣)
- Save to Workspace (📚)
- Copy

אין מערכת שמירה ייעודית לקטגוריה זו.

---

## 33. Personal Knowledge Structure

**Purpose:** Define the tab architecture and storage rules for Personal Knowledge content — self-improvement, mindset, habits, learning systems, communication, and career.

> Inherits default 8-tab structure from §28. Documents overrides only.
> Obsidian paths from §30 — do not redefine.
> Save system: §22 (BulkSelectionBar).
> APP Builder: §26 → `App Ideas/Personal Knowledge/`.

---

### Main Topic

📖 ידע אישי

**Core scope:** Soft skills, personal systems, mindset, habits, learning, communication, career, and personal finance. Not physical health (§31). Not technical skills (§32).

---

### Official Sub-Topics

| תת-נושא | תיאור |
|---------|-------|
| מיינדסט | גישה מנטלית, growth mindset, שינוי תפיסה, mental models |
| הרגלים | בניית הרגלים, behavior change, habit stacks, Atomic Habits frameworks |
| פרודוקטיביות | ניהול זמן, מערכות, תעדוף, GTD, deep work |
| למידה | שיטות למידה, knowledge retention, note-taking, spaced repetition |
| תקשורת | כישורי שיחה, כתיבה, הצגה ברבים, השפעה, negotiation |
| קריירה | פיתוח מקצועי, networking, עבודה עצמאית, personal branding |
| פיננסים אישיים | תקציב, חיסכון, תכנון פיננסי אישי (לא השקעות — ראה שוק ההון) |
| ידע לשימוש חוזר | עקרונות אורך-חיים |

---

### Default Tab Structure — Personal Knowledge Video

Inherits from §28. Overrides tabs 2, 4, and 5.

| Tab | אייקון | שם | סטטוס |
|-----|--------|----|--------|
| 1 | 📝 | Summary | קבוע (§28) |
| 2 | 🧠 | Psychology & Mental Models | **Override** |
| 3 | 💡 | Key Insights | ירוש מ-§28 |
| 4 | ⚙️ | Systems & Habits | **Override** |
| 5 | 📋 | Action Plans & Exercises | **Override** |
| 6 | ⚠️ | Risks & Warnings | ירוש מ-§28 |
| 7 | 🧠 | Useful Knowledge | ירוש מ-§28 |
| 8 | 🏗️ | APP Builder | קבוע (§28) |

---

### Tab Definitions

**Tab 2 — 🧠 Psychology & Mental Models**

- מודלים מנטליים (Mental Models)
- מסגרות פסיכולוגיות (Cognitive Frameworks)
- עקרונות התנהגות ו-behavior change
- Cognitive biases ואיך להתמודד איתם
- מבוסס על ראיות — לא רק השראה

**Tab 4 — ⚙️ Systems & Habits**

- מערכות אישיות (habit stacks, daily routines, weekly reviews)
- שגרות בוקר / ערב / שבוע
- Frameworks לניהול זמן (GTD, time blocking, deep work)
- תוכניות הרגלים עם triggers ו-rewards
- כלים וסביבה תומכת

**Tab 5 — 📋 Action Plans & Exercises**

- תרגילים מעשיים שניתן לבצע מיד
- תוכניות פעולה עם שלבים ברורים
- Self-review checklists ו-reflection prompts
- Templates אישיים לשימוש חוזר
- 30-day challenges ו-habit trackers

---

### Category Boundaries

| אם הסרטון עוסק ב... | → קטגוריה |
|--------------------|-----------|
| מיינדסט, הרגלים, פרודוקטיביות | ✅ ידע אישי |
| מדיטציה לפרודוקטיביות / focus | ✅ ידע אישי (מיינדסט) |
| מדיטציה לחרדה / דיכאון קלינית | ✅ בריאות מנטלית (§31) |
| פיננסים אישיים — תקציב, חיסכון | ✅ ידע אישי (פיננסים אישיים) |
| השקעות, מניות, שוק ההון | ✅ שוק ההון (§24) |
| שיטות למידה | ✅ ידע אישי (למידה) |
| ללמוד להשתמש בכלי AI | ✅ AI & Technology (§29) |
| ניהול זמן עם Notion / Obsidian | שניהם — שמור בשתיהן |
| פיתוח מיומנויות קוד | ✅ Development (§32) |

---

### Personal Finance — הערה לעתיד

`פיננסים אישיים` נשמר כתת-נושא בתוך ידע אישי.

אם נפח הידע יגדל משמעותית, ניתן להפוך אותו לקטגוריה עצמאית עם תת-נושאים:

- תקציב וניהול הוצאות
- חיסכון ויעדים פיננסיים
- מסים
- ביטוחים
- פרישה ותכנון ארוך-טווח
- ניהול פיננסי אישי כולל

**כרגע:** שמור ב-`ידע אישי/פיננסים אישיים/`. אל תפצל עד שיש סיבה ממשית.

---

### Obsidian Folder Structure

מוגדר ב-§30. §33 מאמץ — לא מגדיר מחדש.

```text
ידע אישי/
├── מיינדסט/
├── הרגלים/
├── פרודוקטיביות/
├── למידה/
├── תקשורת/
├── קריירה/
├── פיננסים אישיים/
└── ידע לשימוש חוזר/
```

| סוג תוכן | Obsidian Path |
|----------|--------------|
| סיכום סרטון | `ידע אישי/{sub-topic}/{video-title}` |
| Systems & Habits | `ידע אישי/{sub-topic}/Systems/` |
| Action Plans | `ידע אישי/{sub-topic}/Actions/` |
| ידע לשימוש חוזר | `ידע אישי/ידע לשימוש חוזר/` |
| APP Builder | `App Ideas/Personal Knowledge/` |

---

### APP Builder Opportunities

| רעיון | תיאור |
|-------|-------|
| Habit Tracker | מעקב הרגלים יומי עם streak, analytics, reminders |
| Personal Knowledge Dashboard | מרכז לניהול כל הידע האישי |
| Learning Journal | יומן למידה עם spaced repetition |
| Career Planner | תכנון מקצועי עם goals, milestones, review |
| Personal Finance Tracker | מעקב תקציב ויעדים פיננסיים אישיים |
| Daily Review System | מערכת review יומי / שבועי / חודשי |

נשמר תחת `App Ideas/Personal Knowledge/` (§30).

---

### Save Rules

כל הtabs משתמשים ב-BulkSelectionBar (§22).

כל tab תומך ב:
- Select / Multi-Select / Select All / Clear
- Save to Brain (🧠)
- Save to Obsidian (🟣)
- Save to Workspace (📚)
- Copy

אין מערכת שמירה ייעודית לקטגוריה זו.

---

## 34. Dropshipping Structure

**Purpose:** Define the tab architecture and storage rules for Dropshipping & Ecommerce content — product research, suppliers, store building, marketing, operations, and scaling.

> Inherits default 8-tab structure from §28. Documents overrides only.
> Obsidian paths from §30 — do not redefine.
> Save system: §22 (BulkSelectionBar).
> APP Builder: §26 → `App Ideas/Dropshipping & Ecommerce/`.

---

### Main Topic

🛒 דרופשיפינג

**Core scope:** Running and growing an ecommerce business via dropshipping. Not software development (§32). Not AI tool learning (§29). Not personal finance (§33).

---

### Official Sub-Topics

| תת-נושא | תיאור |
|---------|-------|
| מחקר מוצרים ומגמות | מוצרים מנצחים, מגמות שוק, TikTok/Google Trends, הזדמנויות עונתיות |
| ספקים | AliExpress, CJ Dropshipping, agents, supplier evaluation, MOQ |
| בניית חנות | Shopify setup, product pages, branding, UX, CRO |
| שיווק ופרסום | Facebook Ads, TikTok Ads, Google Ads, creatives, copy, targeting |
| תפעול ואוטומציה | fulfillment, customer service, returns, DSers, n8n automations |
| ניתוח מתחרים | competitor stores, ad libraries, product spy tools (Minea, AdSpy) |
| סקייל ומיטוב | scaling winning ads, LTV, upsells, brand building, margin optimization |
| ידע לשימוש חוזר | עקרונות ecommerce אורך-חיים |

---

### Default Tab Structure — Dropshipping Video

Inherits from §28. Overrides tabs 2, 4, and 5.

| Tab | אייקון | שם | סטטוס |
|-----|--------|----|--------|
| 1 | 📝 | Summary | קבוע (§28) |
| 2 | 🏪 | Business Model & Strategy | **Override** |
| 3 | 💡 | Key Insights | ירוש מ-§28 |
| 4 | 🔍 | Research & Analysis | **Override** |
| 5 | 📋 | Operational Checklists | **Override** |
| 6 | ⚠️ | Risks & Warnings | ירוש מ-§28 |
| 7 | 🧠 | Useful Knowledge | ירוש מ-§28 |
| 8 | 🏗️ | APP Builder | קבוע (§28) |

---

### Tab Definitions

**Tab 2 — 🏪 Business Model & Strategy**

- מודל עסקי ובחירת niche
- מיצוב שוק ו-value proposition
- Pricing strategy ו-margin calculation
- Supplier models: AliExpress, CJ, agent, print-on-demand
- Brand vs generic strategy
- Market entry approach

**Tab 4 — 🔍 Research & Analysis**

- שיטות מחקר מוצרים (Minea, AdSpy, SaleSource, TikTok Creative Center)
- ניתוח מגמות שוק וצרכנים
- Google Trends, TikTok Trends, seasonal signals
- ניתוח מתחרים: חנויות, מודעות, creatives
- מדדי הצלחה: engagement, CTR, social proof signals
- Winning product criteria

**Tab 5 — 📋 Operational Checklists**

- Supplier evaluation checklist
- Store launch checklist
- Ad setup SOP
- Customer service flow
- Returns & refunds process
- Weekly / monthly review checklist
- Fulfillment quality control

---

### Category Boundaries

| אם הסרטון עוסק ב... | → קטגוריה |
|--------------------|-----------|
| מוצרים, ספקים, חנות, ads | ✅ דרופשיפינג |
| n8n automation לחנות | ✅ תפעול ואוטומציה | 🔸 אם הדגש הכלי → AI & Technology גם |
| בניית Shopify app בקוד | — | ✅ Development (§32) |
| SEO ו-content marketing | ✅ שיווק ופרסום | — |
| פסיכולוגיה של מכירות (soft-skill) | 🔸 Business Model | ✅ ידע אישי (תקשורת) |
| ניתוח מניות / ETF | — | ✅ שוק ההון (§24) |
| מחקר מוצרים עם ChatGPT | ✅ מחקר מוצרים | 🔸 AI & Technology אם הדגש ChatGPT |

---

### Obsidian Folder Structure

מוגדר ב-§30 (כולל התוספות). §34 מאמץ — לא מגדיר מחדש.

```text
דרופשיפינג/
├── מחקר מוצרים ומגמות/
├── ספקים/
├── בניית חנות/
├── שיווק ופרסום/
├── תפעול ואוטומציה/
├── ניתוח מתחרים/
├── סקייל ומיטוב/
└── ידע לשימוש חוזר/
```

| סוג תוכן | Obsidian Path |
|----------|--------------|
| סיכום סרטון | `דרופשיפינג/{sub-topic}/{video-title}` |
| Research Methods | `דרופשיפינג/מחקר מוצרים ומגמות/Methods/` |
| Ad Templates | `דרופשיפינג/שיווק ופרסום/Templates/` |
| Operational SOPs | `דרופשיפינג/תפעול ואוטומציה/SOPs/` |
| ידע לשימוש חוזר | `דרופשיפינג/ידע לשימוש חוזר/` |
| APP Builder | `App Ideas/Dropshipping & Ecommerce/` |

---

### APP Builder Opportunities

| רעיון | תיאור |
|-------|-------|
| Product Research Dashboard | ריכוז כלי מחקר, trending products, signal tracker |
| Competitor Tracker | מעקב אחרי מודעות ומוצרים של מתחרים |
| Ad Analysis System | ניתוח ביצועי מודעות, ROAS, creative performance |
| Supplier Management Tool | השוואת ספקים, מעקב זמני משלוח, הערכת איכות |
| Ecommerce Automation System | n8n / Zapier flow לתפעול אוטומטי |
| Store Launch Checklist App | SOP מובנה להשקת חנות חדשה |

נשמר תחת `App Ideas/Dropshipping & Ecommerce/` (§30).

---

### Save Rules

כל הtabs משתמשים ב-BulkSelectionBar (§22).

כל tab תומך ב:
- Select / Multi-Select / Select All / Clear
- Save to Brain (🧠)
- Save to Obsidian (🟣)
- Save to Workspace (📚)
- Copy

אין מערכת שמירה ייעודית לקטגוריה זו.
