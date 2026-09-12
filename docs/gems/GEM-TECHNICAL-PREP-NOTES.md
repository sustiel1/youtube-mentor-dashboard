# GEM-TECHNICAL-PREP-NOTES

**WORK-ID (today, this doc):** TRADINGBRAIN-GEM-FUNDAMENTAL-SCHEMA
**WORK-ID (tomorrow, the actual build):** TRADINGBRAIN-GEM-TECHNICAL-SCHEMA (proposed, see ledger row)
**מטרת הקובץ:** נקודת פתיחה לסשן קר שיבנה מחר את ה-GEM הטכני, על אותו עיקרון של ה-GEM הפונדמנטלי. **מסמך תיעוד בלבד — לא בוצע שום שינוי קוד טכני בסבב הזה, ולא נכתב טקסט הוראות ל-GEM הטכני.** כל מה שלמטה נגזר מקריאת קוד בפועל (file:line), לא מהעתקת ההנחות של `GEM-FUNDAMENTAL-SCHEMA.md`/`GEM-FUNDAMENTAL-INSTRUCTIONS.md` — כמה מהנחות היסוד שם התבררו כלא-מדויקות לגבי הנתיב הטכני, ראו סעיף 3.

**⚠️ הערת-מצב-עבודה קריטית לסשן הקר של מחר:** רוב הקבצים המצוטטים כאן (`VideoDetailPanel.jsx`, `SpecializedContentRenderer.jsx`, `videoTabsConfig.js`, `gemsJsonRepair.js`, ועוד) הם **modified, לא commit** בענף `feat/saved-market-rows-table` נכון לכתיבת מסמך זה (2026-09-11). מספרי השורות כאן מדויקים למצב הזה **ברגע הכתיבה**. לפני שמתחילים לבנות מחר — הריצו `git status`/`git diff HEAD --stat` ווודאו שהקבצים האלה עדיין באותו מצב (לא בוצע `git reset --hard`/`stash` על ידי סשן מקביל בין הלילה) לפני שסומכים על מספרי שורה ספציפיים. אם שונה — אמתו מחדש, אל תניחו.

---

## 1. מה כבר ניתן לשימוש חוזר כמו שהוא (ללא שינוי קוד, ללא שינוי הוראות)

כל 6 הפריטים הבאים הם **מנגנון-קוד גנרי** — לא בדוקים לשם השדה או למשפחת ה-GEM, ולכן פועלים זהה עבור GEM טכני בלי לגעת בהם:

| # | מנגנון | file:line | הערה |
|---|---|---|---|
| 1 | **חוזה ה-JSON השטוח** — שער-הקבלה (`_applyParsedGems`) בודק `contentType`/`universalTabs` ברמת השורש, לא תוכן ספציפי | `VideoDetailPanel.jsx:6531` (`_applyParsedGems`), 4 הענפים: `:6541` (marketBrief) → `:6600` (appBuilder) → `:6628` (macro/universalTabs) → `:6673` (`normalizeAiAnalysisResult(parsed)`, הנתיב שלנו) | `canonicalizeGemsPayloadForPersistence` (`gemsJsonRepair.js:153`) מחזיר ערך ללא שינוי כש-`universalTabs` נעדר — GEM טכני שטוח ינתב לאותו נתיב 4, בדיוק כמו הפונדמנטלי |
| 2 | **תבנית הפריט הקבועה** (`מושג: X · הגדרה קצרה: Y · ... · מקור: Z`) — פרסור גנרי, לא תלוי שם-שדה | `LearningTabContent.jsx:78-91` (`parseTemplateItem`) | מפצל על `' · '`, מפרש כל segment כ-`label: value` — יעבוד זהה על פריט `indicators`/`setups`/`patterns` שיעקוב אחרי אותה תבנית |
| 3 | **סימן ה-🧠 להמלצת-שמירה** — `"🧠 מומלץ לשמור למוח · סיבה: <reason>"` כ-suffix בטקסט הפריט, מזוהה ומוצג כ-badge נפרד | `LearningTabContent.jsx:53` (`BRAIN_BADGE_RE`), `:55-60` (`extractBrainBadge`) | Regex גנרי לגמרי על כל מחרוזת פריט, בכל שדה |
| 4 | **צורת-האובייקט של זמן+ציטוט-מקור** (`{text, estimatedStartSeconds, timestampKind, sourceQuote}`) | `normalizeLearningArray`/`normalizeLearningItem` (`videoAnalytics.js:619-673`) → `normalizeTimedNarrativeItem` (`src/ai/gemini/validators/timedNarrative.js:39-74`) | **כבר מחובר גם ל-`indicators`/`setups`/`patterns` היום** — שלושתם עוברים דרך `normalizeLearningArray` בדיוק כמו `frameworks`/`financialMetrics` (ר' טבלה בסעיף 3 למטה). אין צורך בשום שינוי כדי לקבל קישור-זמן לחיצתי על פריטי טכני |
| 5 | **כללי-השפה/JSON הקפדניים** (בלי גרשיים בעברית, בלי לחתוך JSON, `\n` לא שורה חדשה, וכו') | `GEM-FUNDAMENTAL-INSTRUCTIONS.md`, סעיף "כללי JSON קפדניים" (שורות 32-40) | טקסט הוראות בלבד, לא קוד — ניתן להעתיק מילה במילה לתוך הוראות ה-GEM הטכני מחר, בלי לשנות דבר |
| 6 | **הפיצול הדו-מצבי (flat/analysis-legacy מול universal-tabs)** — `validateGemsJsonValue` (`gemsJsonRepair.js:281-334`) מחזיר `schema: 'analysis-legacy'` לכל payload שטוח, `'universal-tabs'` רק כש-`universalTabs` הוא object | `gemsJsonRepair.js:281-334` | זהה בדיוק למנגנון שה-SCHEMA.md הפונדמנטלי מתעד (§1-2 שם) — לא נגע השינוי היום בהתנהגות הזו |

---

## 2. מה ספציפי-לפונדמנטלי וצריך תחליף לטכני

| רכיב פונדמנטלי | שם שדה בקוד | תחליף לטכני? |
|---|---|---|
| מפת 26 ה-KPI (5 שכבות: רווחיות/תמחור/תזרים/מאזן/הנהלה) | `financialMetrics` + `valuation` + `investmentChecklist` | **לא רלוונטי לטכני כלל** — תוכן דומיננטי-דוחות-כספיים. הטכני כבר קיים לו שדה ייעודי משלו (`indicators`, ר' סעיף 3) — לא צריך "שם שדה חדש", רק תוכן-דומיין אחר (אילו אינדיקטורים/מדדים טכניים, ייקבע מחר לפי התמלול בפועל) |
| 4 דשבורדי-העל (Foundation/Momentum/Valuation History/Capital Allocation) | כל דשבורד = פריט `frameworks` נפרד | `frameworks` הוא **שם שדה גנרי בקוד** (`videoAnalytics.js:1204-1206` פשוט קוראת `merged.frameworks`, לא בודקת משפחת-GEM) — **ניתן לשימוש חוזר כמות-שהוא** אם לתמלול הטכני יש דשבורדים/מסגרות-ריכוז מקבילות. אם אין דשבורדים כאלה בתוכן הטכני — פשוט לא ממלאים את השדה, אין צורך בתחליף |
| סעיף תבניות פרומפט (Perplexity Finance) | `promptTemplates` | **שם שדה גנרי, ניתן לשימוש חוזר כמות-שהוא** (`videoAnalytics.js:1210`, `videoTabsConfig.js:951-955` case `'prompt-templates'`) — אם התמלול הטכני מלמד תבנית-פרומפט דומה לכלי AI חיצוני, אותו שדה בדיוק |
| 4 שדות הלמידה החדשים (`financialMetrics`/`valuation`/`investmentChecklist`/`promptTemplates`) | — | **`financialMetrics`/`valuation`/`investmentChecklist`**: לא רלוונטיים לטכני, לדלג. **`promptTemplates`**: כן רלוונטי אם יש תבנית-פרומפט בתמלול, ר' לעיל |
| בדיקת-צפיפות (`densityWarnings`) על summarization-לא-מספק | `gemsJsonRepair.js:11-38` (`computeDensityWarnings`) | **פער אמיתי, לא סימטרי** — הפונקציה גייטת במפורש על `hasFundamentalShape` (`value.frameworks && value.checklists && value.mistakesToAvoid` הכל-כאחד, `gemsJsonRepair.js:20-24`) ומחזירה `[]` לכל payload אחר, כולל טכני. **החלטה למחר**: אם רוצים אותה הגנה (התראה על שדה עם פריט יחיד בלבד) ל-`indicators`/`setups`/`patterns`, נדרש שינוי קוד קטן (gate מקביל על shape טכני) — **לא בוצע כאן, לא בהיקף המשימה הזו** |

---

## 3. אילו שדות הנתיב הטכני קורא בפועל היום — עם file:line

**⚠️ תיקון-דיוק חשוב:** `GEM-FUNDAMENTAL-SCHEMA.md` §7 (שנכתב 2026-09-10, בהקשר פונדמנטלי בלבד) קובע בטעות ש-`indicators` **לא** ממופה ע"י `normalizeAiAnalysisResult` ("...אף אחד מהם לא ממופה"). **זה שגוי** — אומת ישירות עכשיו נגד הקוד (הקוד באזור הזה לא השתנה מ-HEAD, כלומר זו הייתה טעות גם ב-2026-09-10, לא רגרסיה חדשה):

| שדה JSON | ממופה ב-`normalizeAiAnalysisResult`? | file:line | Alias-ים נתמכים |
|---|---|---|---|
| `indicators` | ✅ **כן** | `videoAnalytics.js:1223` | `merged.indicators \|\| nested.indicators \|\| learning.indicators \|\| specB.macroConditions` |
| `setups` | ✅ **כן** | `videoAnalytics.js:1224` | `merged.setups \|\| merged.tradingSetups \|\| nested.setups \|\| nested.tradingSetups \|\| learning.setups \|\| specB.opportunities` |
| `patterns` | ✅ **כן** | `videoAnalytics.js:1225` | `merged.patterns \|\| merged.tradingPatterns \|\| nested.patterns \|\| learning.patterns` |
| `checklists` | ✅ כן (משותף עם פונדמנטלי) | `videoAnalytics.js:1198-1200` | — |
| `mistakesToAvoid` | ✅ כן (משותף עם פונדמנטלי) | `videoAnalytics.js:1184-1186` | — |
| `promptTemplates` | ✅ כן (גנרי, ר' סעיף 2) | `videoAnalytics.js:1210` | — |

**השכבה הבאה — `extractVideoTabItems()` (`src/config/videoTabsConfig.js`) — גם קוראת את שלושת השדות, עם `case` ייעודי לכל אחד:**

| `case` | file:line | מקורות (ממוזגים, לא "ראשון-מנצח" בין המקורות עצמם) |
|---|---|---|
| `'indicators'` | `videoTabsConfig.js:758-763` | `pickArray(video,'indicators')` + `pickArray(al,'indicators')` + `pickArray(a,'indicators')` |
| `'setups'` | `videoTabsConfig.js:765-770` | `pickArray(video,'setups','tradingSetups')` + `pickArray(al,'setups')` + `pickArray(a,'setups','tradingSetups')` |
| `'patterns'` | `videoTabsConfig.js:772-777` | `pickArray(video,'patterns','tradingPatterns')` + `pickArray(al,'patterns')` + `pickArray(a,'patterns','tradingPatterns')` |

**מסקנה:** בניגוד להנחה שאולי הייתה קיימת (בהשראת §7 השגוי ב-SCHEMA.md הפונדמנטלי) — `indicators`/`setups`/`patterns` **אינם שדות חדשים שצריך להוסיף**. הם קיימים, ממופים, וממוקדים בקוד **מזמן** (לא נוצרו בסבב הנוכחי — אומת ב-`git diff HEAD` על שני הקבצים: אפס שינוי בשורות האלה).

---

## 4. החוב הפתוח שתואר במשימה — כבר נסגר חלקית ב-working tree הלא-commit-ה של היום, לא "הפתעה למחר"

**המשימה תיארה הנחה**: "כשטאב 7 רוקן לענף הטכני, indicators/setups/patterns איבדו את בית-התצוגה שלהם ומעולם לא הועברו לטאבים 3/4." **בדיקה נגד הקוד הנוכחי (working tree, לא commit) מראה שזה כבר לא נכון** — הפער הזה **נסגר היום, לפני המשימה הזו**, כחלק משינוי לא-קשור באותו סבב עבודה:

- **תאב 4 ("ידע שימושי") — `VideoDetailPanel.jsx`'s `useful-knowledge` `TabsContent`** (`:12445` ואילך) כולל כעת סעיפים ייעודיים ל-3 השדות, **בדיוק כמו** `financial-metrics`/`valuation`/`analysis-frameworks`/`investment-checklist`/`prompt-templates` הפונדמנטליים לידם באותו מערך:
  - `{ key: 'indicators', label: '📈 אינדיקטורים', items: extractVideoTabItems(effectiveVideo, 'indicators', marketBriefData), tabKey: 'indicators' }` — `VideoDetailPanel.jsx:12560-12565`
  - `{ key: 'setups', ... }` — `VideoDetailPanel.jsx:12566-12571`
  - `{ key: 'patterns', ... }` — `VideoDetailPanel.jsx:12572-12577`
  - **אומת ב-`git diff HEAD`**: שלושת ה-`case`-ים האלה הם **תוספת חדשה, לא-commit-ת** (`+` בדיף) — כלומר זהו תיקון שנעשה מוקדם יותר היום באותו worktree, לא חלק היסטורי. **לא נעשה על ידי המשימה הזו, ולא בוצע שום שינוי עליו כאן.**
  - המערך הזה **אינו מותנה ב-subCategory** — הוא רץ לכל וידאו, ומסנן לפי `populated = sections.filter(s => s.items.length > 0 || s.alwaysShow)` (`:12604`). כלומר: וידאו טכני עם `video.indicators`/`video.setups`/`video.patterns` מלאים **כבר יציג אותם בטאב 4 היום**, בלי שום שינוי נוסף.
- **טאב 7 (`SpecializedContentRenderer.jsx:140-157`)** — שני ה-slug-ים `fundamental-analysis`/`technical-analysis` (וגם וידאו בלי slug שה-`looksLikeFundamentalOrTechnical()` מזהה, `:44-46`) מנותבים כעת ל**אותו ענף בדיוק**, שמרנדר `MorningBriefDashboard`/`buildMorningBriefBulkSections` — **גם זו תוספת חדשה, לא-commit-ת** (אומת ב-`git diff HEAD`, שני ה-`if`-ים הנפרדים הישנים של fundamental/technical הוחלפו ב-`if` מאוחד). בפועל: ל-GEM טכני שטוח (בלי `marketBriefData`) הדשבורד הזה **עדיין יציג ריק** — `buildMorningBriefBulkSections` (`src/lib/morningBriefBulkSections.js:211+`) בונה סעיפים רק מ-`market-news`/`market-regime`/`brief-sectors`/`brief-opportunities`/`brief-risks`/מניות, אף אחד מהם לא שדה שה-GEM הטכני (השטוח) ממלא. **אין רגרסיה — טאב 7 עדיין ריק לוידאו טכני שטוח, כצפוי** (`indicators`/`setups`/`patterns` לא מופיעים ברשימת הסעיפים של `buildMorningBriefBulkSections` בכלל — הם לא "חוזרים" לטאב 7 בטעות).

**מה עדיין באמת פתוח (לא הפתעה — ידוע ומתועד כאן במפורש):**
1. **`GEM-FUNDAMENTAL-SCHEMA.md` §5 (טבלת השורה האחרונה, "תוכן ייעודי (7)") ו-§8 מתארים מנגנון-ריקון ישן (empty-state קבוע) שכבר לא קיים בקוד** — הוחלף היום ב-`MorningBriefDashboard` (התנהגות נצפית זהה — ריק — אבל המנגנון שונה). **מסמכי הפונדמנטלי לא עודכנו בהתאם** — אם בונים את הטכני מחר לפי אותם מסמכים מילה במילה, יש לצפות לאי-דיוק הזה, לא לבלבול.
2. **מנגנון `densityWarnings` (סעיף 2 לעיל) לא קיים לטכני** — אם רוצים "אל תסכם, מנה" לאינדיקטורים/סטאפים/פטרנים, נדרש שינוי קוד ב-`gemsJsonRepair.js` — לא בוצע.
3. **שני הקבצים העיקריים (`VideoDetailPanel.jsx`, `SpecializedContentRenderer.jsx`) עדיין uncommitted** — ר' אזהרה בראש המסמך. אם מישהו יריץ `git checkout -- .`/`git reset --hard` על הענף לפני מחר, החוב הזה **יחזור** (הוא ייסגר שוב רק אם עושים commit). **מומלץ ל-commit את שני השינויים האלה (או לפחות לוודא שהם עדיין קיימים) לפני שמתחילים לבנות את ה-GEM הטכני מחר** — לא בוצע כאן (מחוץ להיקף: "אל תשני קוד טכני בסבב הזה" התפרש כ"אל תיצרי/תערכי", לא כ-commit של עבודה קיימת של אחר; ההחלטה אם ל-commit נשארת למשתמש).

---

## 5. הבדלים מבניים אמיתיים בין הנתיב הטכני לפונדמנטלי — לא לשער סימטריה

- **מערך-טאבים מקביל, מת, קיים לשני הצדדים באותה מידה — לא לבלבל איתו.** `TECHNICAL_TABS` (`videoTabsConfig.js:186-197`, 10 טאבים) ו-`FUNDAMENTAL_TABS` (`:199-211`, 11 טאבים) מוגדרים דרך `getTabsBySubTopic()` (`:286-299`) ← `getTabsForVideo()` (`:305-...`) — **אך `getTabsForVideo` לא נקרא משום מקום אחר בקוד כולו** (אומת ב-grep מלא על `src/`). ה-UI האמיתי משתמש תמיד ב-`UNIVERSAL_TABS` (7 טאבים קבועים, `VideoDetailPanel.jsx:3042,10341`). **אל תניחו ש-`TECHNICAL_TABS`/`FUNDAMENTAL_TABS` משקפים את מבנה הטאבים בפועל — הם קוד מת, סימטרי לשני הצדדים.**
- **שדות-הסימן (signal fields) לצ'יפ cross-content וגם ל-`looksLikeFundamentalOrTechnical` שונים במכוון בין הצדדים**: `FUNDAMENTAL_SIGNAL_FIELDS = ['frameworks','analysisFrameworks','financialMetrics','valuation','investmentChecklist']` מול `TECHNICAL_SIGNAL_FIELDS = ['indicators','setups','tradingSetups','patterns','tradingPatterns']` (`SpecializedContentRenderer.jsx:39-40`). **`checklists`/`mistakesToAvoid` במכוון לא ברשימה של אף צד** (הם משותפים, לא בלעדיים) — אם מוסיפים שדה-סימן טכני חדש מחר, יש לעדכן את `TECHNICAL_SIGNAL_FIELDS` (וגם את הבדיקה המקבילה סביב `VideoDetailPanel.jsx:9605-9620`, הצ'יפ בכותרת) — שני מקומות, לא אחד.
- **אין (ולא היה אף פעם) שלישיית מסמכים `GEM-TECHNICAL-*`** — אומת גם ב-`git log --all` (אין אפילו קובץ שנמחק בעבר). מתחילים לגמרי מאפס מחר, לא "משחזרים" משהו.
- **`densityWarnings` אסימטרי** (ר' סעיף 2/4) — קיים רק לפונדמנטלי.
- **אין עדיין אף שדה טכני "חדש" מקביל ל-4 השדות הפונדמנטליים החדשים** (`financialMetrics`/`valuation`/`investmentChecklist`/`promptTemplates`) — כי `indicators`/`setups`/`patterns` **כבר היו קיימים לפני כן** (לא נוספו באותו סבב כמו הפונדמנטליים). המשמעות המעשית: ל-GEM הטכני יש כבר "3 שדות משלו" ותיקים ופעילים — השאלה למחר היא רק אם 26-ה-KPI-המקביל של הטכני (מדדים/אינדיקטורים ספציפיים שהתמלול מלמד) נכנס תחת אותם 3 שדות קיימים, או דורש שדה/שדות נוספים (למשל אם יש הפרדה בין "אינדיקטור" ל"תבנית-מחיר" ל"סטאפ-מסחר" שלא מתאימה ל-3 הקטגוריות הקיימות) — **החלטת-תוכן, לא הוכרעה כאן בכוונה**.

---

## הערות סגירה

- לא נכתב טקסט הוראות ל-GEM הטכני, לא נוצרו קבצי `GEM-TECHNICAL-SCHEMA.md`/`GEM-TECHNICAL-INSTRUCTIONS.md`/`GEM-TECHNICAL-EXAMPLE.json`, ולא בוצע שום שינוי קוד. כל המידע כאן נועד לחסוך לסשן של מחר את שלב "לקרוא מחדש את כל הקוד מאפס".
- ראו שורה חדשה ב-`docs/open-items-ledger.md` לתזכורת פורמלית (WORK-ID מוצע: `TRADINGBRAIN-GEM-TECHNICAL-SCHEMA`, סטטוס `not-started`).
