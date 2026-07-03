# PROJECT_MD_INDEX — YouTube Mentor Dashboard
> אינדקס מלא של כל קבצי ה-Markdown בפרויקט
> **נוצר:** 2026-07-01 | **סה"כ קבצים:** 69 | **קבצים ייחודיים (ללא e2e artifacts):** 64

---

## כיצד להשתמש באינדקס הזה עם Claude Code

### שלב 1 — פתח session חדש
תמיד תתחיל עם:
```
Read docs/START_HERE.md first, then open the relevant document from this index.
```

### שלב 2 — מצא את הקובץ הנכון
השתמש בטבלה למטה:
- **לפני שינוי UI** → `AI_DEVELOPMENT_GUIDE.md` + `MARKET_DASHBOARD_UI_GUIDE.md`
- **לפני שינוי save flow** → `docs/governance/SAVE_SYSTEM_ARCHITECTURE.md`
- **לפני שינוי GEMS** → `docs/GEMS_TAB_MAPPING_REGRESSION_RULES.md` + `docs/GEM_CONTENT_CLASSIFICATION_RULES.md`
- **לפני שינוי Morning Brief** → `docs/MORNING_BRIEF_DEDICATED_CONTENT_UI_STANDARD.md`
- **לפני publish** → `docs/governance/CURRENT_STATE_JUNE_2026.md`
- **כשיש conflict בין מסמכים** → `docs/governance/MASTER_PROJECT_BIBLE.md`

### שלב 3 — הוסף כהוראה ל-Claude
```
Read docs/FILE_NAME.md before making changes to this area.
```

### קטגוריות קיימות
| קטגוריה | תיאור |
|---|---|
| Architecture | ארכיטקטורה מרכזית וdata model |
| Governance | כללים מחייבים שלא ניתן לשנות |
| QA | בדיקות, audits, release gates |
| Git Safety | Git workflow ו-Base44 sync |
| UI/UX | כללי עיצוב ויזואלי |
| Prompt Rules | כללים לפרומפטים ו-GEM output |
| Base44 | הגדרות Base44 |
| Workflow | תהליכי עבודה |
| Data Model | מיפויי נתונים |
| Bug Fix | תיקוני באגים ו-root cause |
| Commit | רשומות session ו-milestones |
| Rollback | היסטוריית החלטות |
| Documentation | תיעוד ואינדקסים |
| Unknown / Needs Review | לבדיקה ידנית |

---

## 📊 טבלת אינדקס ראשית

| # | File | Path | Category | Summary | When to Use | Importance |
|---|---|---|---|---|---|---|
| 1 | AGENTS.md | AGENTS.md | Workflow | כללים מחייבים לעבודה עם Base44 וגיט | תחילת כל session עם Base44 | **High** |
| 2 | AI_DEVELOPMENT_GUIDE.md | AI_DEVELOPMENT_GUIDE.md | Architecture | חוקת הפרויקט §1–§34: UI, Save, Brain, Obsidian, GEMS | לפני כל שינוי UI, save-flow, topic | **High** |
| 3 | CHAPTER_ENGINE_ROOT_CAUSE_REPORT.md | CHAPTER_ENGINE_ROOT_CAUSE_REPORT.md | Bug Fix | ניתוח שורש: 7 מקורות chapters, priority, title generation | לפני שינוי בטאב Chapters | **Medium** |
| 4 | CLAUDE.md | CLAUDE.md | Governance | הגדרות AI מאושרות: max_tokens, timeouts, chunk thresholds | לפני שינוי AI configuration | **High** |
| 5 | MARKET_DASHBOARD_UI_GUIDE.md | MARKET_DASHBOARD_UI_GUIDE.md | UI/UX | Blueprint מאקרו טאב — 12 סקשנים, component map | לפני שינוי Macro sections | **High** |
| 6 | PROJECT_STATUS.md | PROJECT_STATUS.md | QA | סנפשוט פרויקט: build status, release gates, commits | לפני publish ב-Base44 | **Medium** |
| 7 | PROMPTS.md | PROMPTS.md | Prompt Rules | פרומפטים מוכנים לעבודה עם Base44 | תחילת session חדש | **Low** |
| 8 | README.md | README.md | Documentation | סקירת הפרויקט: Features, Stack, Base44 integration | כניסה ראשונה לפרויקט | **Medium** |
| 9 | ROUTES_AUDIT_REPORT.md | ROUTES_AUDIT_REPORT.md | QA | Audit routes: pages.config.js, מה קיים | לפני הוספת/הסרת routes | **Low** |
| 10 | SKILL.md | SKILL.md | Architecture | זהות הפרויקט: Core Concept, 2 זרמים (Manual/AI) | לפני הוספת feature חדש | **High** |
| 11 | docs/AI_ANALYSIS_LINK_ROUTING_PLAN.md | docs/AI_ANALYSIS_LINK_ROUTING_PLAN.md | Architecture | תכנון routing "נתח עם AI" לפי entity type | לפני implement AI analysis routing | **Medium** |
| 12 | docs/AI_ANALYZE_OPPORTUNITY_RISK_PROMPT_RULE.md | docs/AI_ANALYZE_OPPORTUNITY_RISK_PROMPT_RULE.md | Prompt Rules | כלל לפרומפט AI analysis על opportunities/risks | לפני שינוי AI analysis prompt | **Medium** |
| 13 | docs/AI_BADGE_RENDERING_RULE.md | docs/AI_BADGE_RENDERING_RULE.md | UI/UX | מקור אמת לרינדור badge (🤖 AI / ✏️ Manual) | לפני שינוי section header badges | **Medium** |
| 14 | docs/CHAPTERS_SOURCE_HIERARCHY_AND_AI_TITLE_STRATEGY.md | docs/CHAPTERS_SOURCE_HIERARCHY_AND_AI_TITLE_STRATEGY.md | Architecture | כלל סופי: היררכיית chapter sources + AI title strategy | לפני שינוי chapters logic | **High** |
| 15 | docs/CHAPTER_SOURCE_PRIORITY_RULE.md | docs/CHAPTER_SOURCE_PRIORITY_RULE.md | Governance | כלל קצר: description > gem > AI fallback | לפני שינוי chapter source defaults | **Medium** |
| 16 | docs/DEPLOYMENT_TARGET_RULE.md | docs/DEPLOYMENT_TARGET_RULE.md | Base44 | כלל: לאשר deployment target לפני deploy | לפני כל publish ב-Base44 | **Medium** |
| 17 | docs/FINVIZ_LINK_BEHAVIOR_RULE.md | docs/FINVIZ_LINK_BEHAVIOR_RULE.md | UI/UX | כל symbol/ticker/sector תקין — חייב קישור Finviz | לפני שינוי market symbol rendering | **High** |
| 18 | docs/GEMS_OUTPUT_LANGUAGE_RULES.md | docs/GEMS_OUTPUT_LANGUAGE_RULES.md | Prompt Rules | כללי שפה לפלט GEM — JSON schemas, language mix | לפני שינוי GEM output format | **High** |
| 19 | docs/GEMS_TAB_MAPPING_REGRESSION_RULES.md | docs/GEMS_TAB_MAPPING_REGRESSION_RULES.md | Architecture | מקור אמת: mapping GEM JSON → Universal Tabs | לפני שינוי GEM-to-tab mapping | **High** |
| 20 | docs/GEM_CHAPTER_TIMESTAMP_RELIABILITY.md | docs/GEM_CHAPTER_TIMESTAMP_RELIABILITY.md | Architecture | chapter quality vs timestamp reliability — שני ממדים | לפני שינוי chapter metadata | **Medium** |
| 21 | docs/GEM_CONTENT_CLASSIFICATION_RULES.md | docs/GEM_CONTENT_CLASSIFICATION_RULES.md | Architecture | כללי סיווג GEM: Macro/Technical/Fundamental | לפני שינוי GEM classification | **High** |
| 22 | docs/HEBREW_DOCUMENTATION_CATALOG.md | docs/HEBREW_DOCUMENTATION_CATALOG.md | Documentation | קטלוג תיעוד עברי — 26 מסמכים, מה לקרוא ראשון | ניווט תיעוד | **Medium** |
| 23 | docs/HEBREW_FIRST_MARKET_STATUS_LABELS.md | docs/HEBREW_FIRST_MARKET_STATUS_LABELS.md | Bug Fix | תיקון: Market Status labels → עברית-ראשונה | לפני שינוי Market Status table | **High** |
| 24 | docs/HEBREW_FIRST_UI_LABELS_RULE.md | docs/HEBREW_FIRST_UI_LABELS_RULE.md | Governance | כלל ליבה: כל caption → עברית-ראשונה | לפני כל שינוי label ב-UI | **High** |
| 25 | docs/MACRO_INDICATOR_INVESTING_LINKS.md | docs/MACRO_INDICATOR_INVESTING_LINKS.md | UI/UX | קישורי il.investing.com לכל macro indicator | לפני שינוי macro indicators table | **Medium** |
| 26 | docs/MARKET_ENTITY_ANALYSIS_ROUTING.md | docs/MARKET_ENTITY_ANALYSIS_ROUTING.md | Architecture | market entities → routing לPerplexity/TradingView/Finviz | לפני שינוי "נתח עם AI" כפתורים | **High** |
| 27 | docs/MORNING_BRIEF_DEDICATED_CONTENT_UI_STANDARD.md | docs/MORNING_BRIEF_DEDICATED_CONTENT_UI_STANDARD.md | UI/UX | מקור אמת ויזואלי: Morning Brief + Dedicated Content | לפני שינוי Morning Brief | **High** |
| 28 | docs/MORNING_BRIEF_GEMS_ROUTING.md | docs/MORNING_BRIEF_GEMS_ROUTING.md | Architecture | כלל: live brief videos → morning brief tab | לפני שינוי live brief routing | **High** |
| 29 | docs/MORNING_BRIEF_SPECIALIZED_OUTPUT_AUDIT.md | docs/MORNING_BRIEF_SPECIALIZED_OUTPUT_AUDIT.md | QA | Audit: 53 פריטים → ~27 ייחודיים, בעיות dup | לפני תיקון specialized tab | **Medium** |
| 30 | docs/MORNING_BRIEF_SPECIALIZED_OUTPUT_FIXES.md | docs/MORNING_BRIEF_SPECIALIZED_OUTPUT_FIXES.md | Bug Fix | תיקונים שיושמו ל-specialized output (2026-06-30) | לוודא מה כבר תוקן | **Medium** |
| 31 | docs/OBSIDIAN_PERSONAL_BRAIN_PHASE.md | docs/OBSIDIAN_PERSONAL_BRAIN_PHASE.md | Architecture | Phase checkpoint: Obsidian export + brainHighlights | לפני שינוי Obsidian export | **Medium** |
| 32 | docs/OPPORTUNITIES_RISKS_DESIGN_RULE.md | docs/OPPORTUNITIES_RISKS_DESIGN_RULE.md | UI/UX | כלל: Macro/Specialized = reference לopportunities/risks | לפני שינוי opportunity/risk cards | **Medium** |
| 33 | docs/PERPLEXITY_AI_ANALYSIS_WORKFLOW.md | docs/PERPLEXITY_AI_ANALYSIS_WORKFLOW.md | Architecture | Workflow לניתוח AI דרך Perplexity — entity-aware | לפני שינוי Perplexity flow | **Medium** |
| 34 | docs/PERPLEXITY_AI_RESEARCH_PATTERN.md | docs/PERPLEXITY_AI_RESEARCH_PATTERN.md | UI/UX | Design pattern לכפתור Perplexity research (pre-impl) | לפני implement Perplexity buttons | **Low** |
| 35 | docs/PROJECT_DOCUMENTATION_AUDIT.md | docs/PROJECT_DOCUMENTATION_AUDIT.md | Documentation | Audit כל קבצי MD (2026-06-22) | חיפוש מסמך שאולי חסר | **Low** |
| 36 | docs/PROJECT_DOCUMENTATION_INDEX.md | docs/PROJECT_DOCUMENTATION_INDEX.md | Documentation | Registry מרכזי: hierarchy, איזה מסמך גובר | ניווט וresolution conflicts | **High** |
| 37 | docs/PROJECT_MARKDOWN_FILE_INDEX.md | docs/PROJECT_MARKDOWN_FILE_INDEX.md | Documentation | אינדקס MD ישן (2026-06-22, 25 קבצים) — גרסה קודמת | השוואה היסטורית בלבד | **Low** |
| 38 | docs/SECTION_HEADER_COUNT_RULE.md | docs/SECTION_HEADER_COUNT_RULE.md | Governance | כלל: Morning Brief חייב לעקוב אחרי ספירת headers של מאקרו | לפני שינוי section headers | **Medium** |
| 39 | docs/SECTORS_DESIGN_RULE.md | docs/SECTORS_DESIGN_RULE.md | Governance | כלל enforced: כל sectors section — פורמט אחיד | לפני שינוי sectors sections | **Medium** |
| 40 | docs/SECTOR_FINVIZ_LINKS.md | docs/SECTOR_FINVIZ_LINKS.md | Data Model | מקור אמת: sector → Finviz ETF link mapping | לפני הוספת sector חדש | **Medium** |
| 41 | docs/SECTOR_FINVIZ_LINK_MAPPING.md | docs/SECTOR_FINVIZ_LINK_MAPPING.md | Data Model | טבלת mapping סקטור/תמה → ETF Finviz | לפני הוספת/תיקון sector links | **High** |
| 42 | docs/SELECTION_TOOLBAR_WORKFLOW.md | docs/SELECTION_TOOLBAR_WORKFLOW.md | UI/UX | הכלה השחורה בתחתית — מקור אמת לבulk actions | לפני שינוי selection toolbar | **High** |
| 43 | docs/SESSION_CLOSURE_NOTES_2026_07_01_HEBREW_MARKET_STATUS_LABELS.md | docs/SESSION_CLOSURE_NOTES_2026_07_01_HEBREW_MARKET_STATUS_LABELS.md | Commit | סיכום session 2026-07-01: Hebrew labels ב-Market Status | עיון בהיסטוריה | **Low** |
| 44 | docs/SPECIALIZED_OPPORTUNITY_SAVE_RULE.md | docs/SPECIALIZED_OPPORTUNITY_SAVE_RULE.md | Governance | כלל: specialized opportunity cards ניתנות לשמירה | לפני שינוי save ב-specialized | **Medium** |
| 45 | docs/SPECIALIZED_SELECT_ALL_DEDUP_RULE.md | docs/SPECIALIZED_SELECT_ALL_DEDUP_RULE.md | Bug Fix | כלל: Select All בspecialized → 27 ייחודיים, לא 53 dup | לפני שינוי select-all בspecialized | **High** |
| 46 | docs/START_HERE.md | docs/START_HERE.md | Documentation | נקודת כניסה: מה לקרוא ראשון בכל session | תחילת כל session | **High** |
| 47 | docs/SYMBOL_ARROW_PLACEMENT_RULE.md | docs/SYMBOL_ARROW_PLACEMENT_RULE.md | UI/UX | חצים כיווניים ליד שם הסימול, לא בעמודת המספר | לפני שינוי financial tables | **Medium** |
| 48 | docs/TRADINGVIEW_STOCK_SYMBOL_RESOLVER.md | docs/TRADINGVIEW_STOCK_SYMBOL_RESOLVER.md | Architecture | TradingView symbol resolution → URL mapping | לפני שינוי TradingView links | **Medium** |
| 49 | docs/UNIVERSAL_SECTION_SELECT_ALL_AND_EXPORT_RULE.md | docs/UNIVERSAL_SECTION_SELECT_ALL_AND_EXPORT_RULE.md | Governance | כלל: Select All + CSV export לכל 7 טאבים universal | לפני שינוי selection/export | **High** |
| 50 | docs/WATCH_TODAY_FINVIZ_LINKS.md | docs/WATCH_TODAY_FINVIZ_LINKS.md | Bug Fix | תיקון: "מה לעקוב היום" + tickers + Finviz links | לפני שינוי watch-today section | **Medium** |
| 51 | docs/base44-checklist.md | docs/base44-checklist.md | Base44 | צ'קליסט חיבור Base44 + GitHub | בהגדרת חיבור Base44 חדש | **Medium** |
| 52 | docs/workflow.md | docs/workflow.md | Workflow | Base44 + Claude Code workflow (duplicate של AGENTS.md) | ראה AGENTS.md | **Low** |
| 53 | docs/governance/CLAUDE_CODE_GOVERNANCE_MODE.md | docs/governance/CLAUDE_CODE_GOVERNANCE_MODE.md | Governance | מדיניות פעילה: איך Claude Code מחליט על שינויים | לפני שינוי ארכיטקטוראלי גדול | **High** |
| 54 | docs/governance/CURRENT_STATE_JUNE_2026.md | docs/governance/CURRENT_STATE_JUNE_2026.md | QA | מצב נוכחי: מה עובד, מה שבור, 4 gates פתוחים | לפני publish | **High** |
| 55 | docs/governance/DESIGN_SYSTEM_AND_UX_RULES.md | docs/governance/DESIGN_SYSTEM_AND_UX_RULES.md | UI/UX | Design system source of truth — UX rules, visual language | לפני כל שינוי ויזואלי | **High** |
| 56 | docs/governance/MASTER_PROJECT_BIBLE.md | docs/governance/MASTER_PROJECT_BIBLE.md | Governance | Bible המסמכים: מה הפרויקט עושה, איזה מסמך גובר | כשיש conflict בין מסמכים | **High** |
| 57 | docs/governance/MILESTONE_MORNING_BRIEF_DASHBOARD_CLUSTER.md | docs/governance/MILESTONE_MORNING_BRIEF_DASHBOARD_CLUSTER.md | Commit | Milestone record: Morning Brief Cleanup (2026-06-16) | היסטוריה של Morning Brief | **Low** |
| 58 | docs/governance/NEXT_SESSION_QA.md | docs/governance/NEXT_SESSION_QA.md | QA | רשימת QA tasks לsession הבא | תחילת session לQA | **Medium** |
| 59 | docs/governance/PROJECT_DECISIONS_HISTORY.md | docs/governance/PROJECT_DECISIONS_HISTORY.md | Rollback | היסטוריית החלטות ארכיטקטוראליות | לפני ביטול החלטה ישנה | **High** |
| 60 | docs/governance/SAVE_SYSTEM_ARCHITECTURE.md | docs/governance/SAVE_SYSTEM_ARCHITECTURE.md | Architecture | ארכיטקטורה של Save System — source of truth | לפני שינוי save flow | **High** |
| 61 | docs/governance/STOCK_ANALYSIS_SCREEN_BIBLE.md | docs/governance/STOCK_ANALYSIS_SCREEN_BIBLE.md | Architecture | Bible לStock Analysis screen | לפני שינוי stock analysis | **High** |
| 62 | docs/governance/USER_PRODUCT_INTENT_AND_FUTURE_VISION.md | docs/governance/USER_PRODUCT_INTENT_AND_FUTURE_VISION.md | Architecture | Product vision: goals, intent, future roadmap | לפני הוספת feature חדש | **High** |
| 63 | docs/session-closures/2026-07-01-finviz-ticker-links-calendar-dedup.md | docs/session-closures/2026-07-01-finviz-ticker-links-calendar-dedup.md | Commit | Session closure: Finviz links + calendar dedup | reference בלבד | **Low** |
| 64 | docs/session-closures/2026-07-01-hebrew-market-status-labels.md | docs/session-closures/2026-07-01-hebrew-market-status-labels.md | Commit | Session closure: Hebrew labels ב-Market Status | reference בלבד | **Low** |
| 65 | e2e/.tmp-fallback-test/QA/fallback-test/note.md | e2e/.tmp-fallback-test/QA/fallback-test/note.md | QA | E2E QA artifact — fallback test note | בדיקת e2e בלבד | **Low** |
| 66 | e2e/.tmp-fallback-test2/QA/fallback-test2/note.md | e2e/.tmp-fallback-test2/QA/fallback-test2/note.md | QA | E2E QA artifact — fallback test2 note | בדיקת e2e בלבד | **Low** |
| 67 | e2e/.tmp-fallback-test3/QA/fallback-test3/note.md | e2e/.tmp-fallback-test3/QA/fallback-test3/note.md | QA | E2E QA artifact — fallback test3 note | בדיקת e2e בלבד | **Low** |
| 68 | e2e/.tmp-merge-vault/QA/obsidian-merge-qa/obsidian-merge-vault-qa.md | e2e/.tmp-merge-vault/QA/obsidian-merge-qa/obsidian-merge-vault-qa.md | QA | E2E QA artifact — Obsidian merge vault test | בדיקת e2e בלבד | **Low** |
| 69 | e2e/.tmp-ui-row-merge-vault/QA/proxy-test.md | e2e/.tmp-ui-row-merge-vault/QA/proxy-test.md | QA | E2E QA artifact — UI row merge proxy test | בדיקת e2e בלבד | **Low** |

---

## 🏷️ הוראות Claude מומלצות לפי אזור

### UI / Morning Brief
```
Read docs/MORNING_BRIEF_DEDICATED_CONTENT_UI_STANDARD.md before changing Morning Brief UI.
Read MARKET_DASHBOARD_UI_GUIDE.md before editing macro sections.
Read docs/HEBREW_FIRST_UI_LABELS_RULE.md before adding or changing any UI label.
```

### GEMS / GEM Analysis
```
Read docs/GEMS_TAB_MAPPING_REGRESSION_RULES.md before changing GEM-to-tab mapping.
Read docs/GEM_CONTENT_CLASSIFICATION_RULES.md before changing GEM classification.
Read docs/GEMS_OUTPUT_LANGUAGE_RULES.md before changing GEM output format.
```

### Save System
```
Read docs/governance/SAVE_SYSTEM_ARCHITECTURE.md before changing any save flow.
Read docs/UNIVERSAL_SECTION_SELECT_ALL_AND_EXPORT_RULE.md before changing selection or export.
```

### Market / Finviz Links
```
Read docs/FINVIZ_LINK_BEHAVIOR_RULE.md before modifying any market symbol display.
Read docs/SECTOR_FINVIZ_LINK_MAPPING.md before adding or fixing sector links.
```

### Chapters
```
Read docs/CHAPTERS_SOURCE_HIERARCHY_AND_AI_TITLE_STRATEGY.md before changing chapter sources.
Read CHAPTER_ENGINE_ROOT_CAUSE_REPORT.md before modifying chapter display.
```

### AI Analysis
```
Read docs/MARKET_ENTITY_ANALYSIS_ROUTING.md before modifying AI analysis routing.
Read docs/PERPLEXITY_AI_ANALYSIS_WORKFLOW.md before modifying Perplexity AI analysis.
```

---

## 📁 קבצים לבדיקה ידנית (Unknown / Needs Review)

| קובץ | סיבה |
|---|---|
| docs/workflow.md | תוכן זהה ל-AGENTS.md — שקול מחיקה או עדכון |
| docs/PROJECT_MARKDOWN_FILE_INDEX.md | גרסה ישנה של אינדקס זה — עדכן לפי PROJECT_MD_INDEX.md |
| docs/PROJECT_DOCUMENTATION_AUDIT.md | audit ישן (2026-06-22) — שקול עדכון |
| docs/PROJECT_DOCUMENTATION_INDEX.md | יש overlap עם PROJECT_MD_INDEX.md — בדוק consolidation |

---

## 📊 סיכום קטגוריות

| קטגוריה | מספר קבצים | חשיבות ממוצעת |
|---|---|---|
| Architecture | 15 | High |
| Governance | 9 | High |
| UI/UX | 12 | High/Medium |
| QA | 8 | Medium |
| Documentation | 6 | Medium |
| Bug Fix | 5 | Medium/High |
| Prompt Rules | 3 | High |
| Commit | 4 | Low |
| Workflow | 3 | Medium/Low |
| Data Model | 2 | Medium |
| Base44 | 2 | Medium |
| Rollback | 1 | High |

---

## 📬 שדות מוצעים ל-Base44 Entity

```json
{
  "id": "number (auto)",
  "file_name": "string",
  "relative_path": "string",
  "folder": "string (root | docs | docs/governance | docs/session-closures | e2e)",
  "project_area": "string",
  "category": "select (Architecture | Governance | QA | UI/UX | Prompt Rules | Base44 | Workflow | Data Model | Bug Fix | Commit | Rollback | Documentation)",
  "short_summary": "string (max 200 chars)",
  "what_this_file_controls": "string",
  "when_to_use_this_file": "string",
  "recommended_claude_instruction": "string",
  "importance": "select (High | Medium | Low)",
  "last_updated_from_git": "date",
  "related_code_files": "string",
  "related_docs": "string"
}
```

---

## 🚀 פרומפט מוצע להמשך — ייבוא ל-Base44

```
I have a JSON file at docs/project-md-index.json with 69 markdown file records.
Create a Base44 entity called "ProjectDocument" with these fields:
file_name (string), relative_path (string), folder (string), project_area (string),
category (select), short_summary (text), what_this_file_controls (text),
when_to_use_this_file (text), recommended_claude_instruction (text),
importance (select: High/Medium/Low), last_updated_from_git (date),
related_code_files (string), related_docs (string).
Then import the JSON as seed data.
```

---

*נוצר אוטומטית על ידי Claude Code — 2026-07-01*
