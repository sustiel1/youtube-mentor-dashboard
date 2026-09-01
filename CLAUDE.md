# Base44 + Claude Code Workflow

מטרת הקובץ:
לעבוד בצורה מסודרת, קבועה ובטוחה בכל פרויקט Base44.

---

## עקרונות עבודה קבועים

1. כל שינוי נעשה דרך קבצי הפרויקט.
2. לא עובדים דרך DevTools Console אם אפשר להימנע מזה.
3. כל secrets נשמרים מחוץ לקוד.
4. מכינים את הפרויקט ל-Git מההתחלה.
5. בקבצי `.env.example` שומרים רק placeholders.
6. עובדים עם GitHub כמקור אמת לקוד.
7. מסנכרנים ל-Base44 דרך Git → Pull.
8. מפרסמים רק כשמוכן.

---

## כללים מחייבים

### קוד
- כל שינוי צריך להיות מיוצג בקבצים אמיתיים בפרויקט.
- לא להשאיר לוגיקה חשובה רק בתוך Base44 אם אפשר לייצג אותה בקוד.
- לא לבצע שינויים ידניים אקראיים בלי תיעוד.

### Console
- לא להציע עבודה דרך Console אם אפשר לפתור דרך:
  - קובץ
  - סקריפט
  - כפתור DEV
  - פונקציה
- אם פעולה ידנית הכרחית, לציין רק את המינימום הנדרש.

### Secrets
- לא לשים API keys, tokens או סיסמאות בקוד.
- לא לשים secrets ב-Git.
- להשתמש רק ב-placeholders בקבצי `.env.example`.
- את הערכים האמיתיים להגדיר רק דרך:
  - Base44 Environment Variables
  - או קובצי env מקומיים שלא נכנסים ל-Git

### Git
- כל פרויקט צריך להיות מוכן ל-Git מההתחלה.
- כל שינוי משמעותי צריך להישמר ב-commit.
- GitHub הוא מקור האמת של הקוד.

---

## Workflow קבוע

### בתחילת פרויקט
1. להקים מבנה פרויקט מסודר.
2. להכין `.gitignore`
3. להכין `.env.example`
4. לוודא שאין secrets בקוד
5. להגדיר workflow ברור מול Base44

### במהלך העבודה
1. עובדים מקומית / דרך Claude Code
2. שומרים שינויים בקבצים
3. לא מסתמכים על Console
4. יוצרים scripts מסודרים אם צריך
5. בודקים שכל מה שחשוב מיוצג בקבצים

### בסוף כל שינוי משמעותי
- 📦 commit
- ⬆️ push
- 🔄 Base44 → Git → Pull
- 🚀 Publish (אם רלוונטי)

---

## Base44

### תפקיד Base44 בפרויקט
Base44 משמש ל:
- Entities
- Backend Functions
- Environment Variables
- Preview
- Publish
- Git Pull מהקוד המעודכן

### מה לא לעשות ב-Base44
- לא לשמור secrets בתוך קוד
- לא לעבוד ידנית בבלגן בלי Git
- לא להניח שהקוד מסתנכרן אוטומטית מ-GitHub

---

## GitHub

### מקור אמת
GitHub הוא מקור האמת של הקוד.

### שיטת עבודה מומלצת
- לפתח מקומית / עם Claude Code
- לעשות Commit + Push
- ואז ב-Base44 לעשות Pull

---

## עיבוד קבצים עם Ollama

### כלל
- קבצים מעל 500 שורות — שלח ל-Ollama על `localhost:11434` עם המודל `qwen2.5-coder:7b` לקריאה וסיכום.
- קבצים עד 500 שורות — עבד ישירות ללא Ollama.

### דוגמה לשליחה ל-Ollama
```bash
curl http://localhost:11434/api/generate -d '{
  "model": "qwen2.5-coder:7b",
  "prompt": "Summarize this file:\n<file content here>",
  "stream": false
}'
```

---

## Environment Variables

### כלל
- ב-Git שומרים רק placeholders
- את הערכים האמיתיים מגדירים ב-Base44 או env מקומי

### דוגמה
```env
VITE_BASE44_APP_ID=your_base44_app_id
VITE_BASE44_APP_BASE_URL=https://your-app-name.base44.app
GEMINI_API_KEY=your_gemini_api_key
BASE44_TOKEN=your_base44_token
```

---

## הגדרות AI מאושרות — אל תשנה בלי אישור מפורש

הגדרות אלה נבדקו ותוקנו ידנית. שינוי שלהן עלול לשבור את זרימת הניתוח.

### Claude API (vite.config.js)

| הגדרה | ערך | סיבה |
|---|---|---|
| `max_tokens` | `8192` | ערך נמוך יותר גורם ל-JSON חתוך (Unterminated string) |
| `ANTHROPIC_MESSAGE_MS` | `600_000` | timeout של 600 שניות — transcript ארוך דורש זמן |
| `server.httpServer.timeout` | `620_000` | חייב להיות גדול מ-ANTHROPIC_MESSAGE_MS |
| `CHUNK_THRESHOLD` | `15_000` | transcripts מעל 15K תווים מחולקים ל-2 chunks |
| chunk split point | `~10_000` תווים | מחפש `.` הכי קרוב ל-10,500 כדי לפצל במשפט שלם |

### Gemini / transcript (vite.config.js + VideoDetailPanel.jsx)

| הגדרה | ערך | סיבה |
|---|---|---|
| transcript threshold | `300` תווים | transcripts קצרים מ-300 תווים לא עוברים לניתוח |
| `GEMINI_MOCK` | `false` | mock מחזיר טקסט מלאכותי שעובר quality gate לא נכון |
| transcript localStorage origins | `http://127.0.0.1:5184` + `http://localhost:5184` | `AUTHORIZED_TRANSCRIPT_LOCAL_STORAGE_ORIGINS` ב-`transcriptLocalStorageStore.js` — שני origins של loopback מורשים בכוונה לשמירת תמלול ב-localStorage (Vite מגיש כברירת מחדל על localhost) |

### Environment Variables נדרשים

```env
ANTHROPIC_API_KEY=sk-ant-api03-...   # server-side only, ללא VITE_ prefix
GEMINI_API_KEY=...
GEMINI_MOCK=false
```

> **שים לב:** `ANTHROPIC_API_KEY` ללא prefix של `VITE_` — זה בכוונה. המפתח נחשף רק ב-vite.config.js (server-side), לא ב-client bundle.

---

## Bounded Self-Improvement and Verification Workflow

For every implementation task:

1. Understand the request and inspect the relevant code before making changes.

2. Define explicit acceptance criteria.

3. Check the working tree and identify pre-existing modified or untracked files.
   - Preserve unrelated user changes.
   - Do not overwrite or include unrelated work.

4. Implement the smallest safe and backward-compatible change.

5. Review the result critically:
   - Does it fully satisfy the acceptance criteria?
   - Are there logic errors, regressions, missing edge cases, or unnecessary changes?
   - Does it follow the repository architecture and existing conventions?
   - Were any unrelated files changed?

6. Run all relevant verification available for the affected scope:
   - Build
   - Tests
   - Lint
   - Type-check
   - Focused runtime or UI verification
   - Review of the final diff

7. If verification fails or the review identifies a concrete issue:
   - Identify and document the root cause.
   - Apply the smallest safe correction.
   - Repeat the review and relevant verification.

8. Stop after a maximum of 3 improvement iterations.

9. Do not perform speculative rewrites, architecture changes, dependency upgrades, or unrelated refactors.

10. Do not hide, weaken, skip, rewrite, or delete tests merely to obtain a passing result.

11. If the task cannot be verified after 3 iterations, stop and report:
    - What remains unresolved
    - Root cause, if known
    - Evidence collected
    - Verification commands and results
    - Files changed
    - Safest recommended next step

12. Do not commit, push, publish, deploy, merge, or modify production data unless explicitly requested.

13. Before any commit, provide:
    - Concise change summary
    - Files changed
    - Verification results
    - Known limitations or remaining risks
    - Rollback strategy
    - Proposed commit message

### Claude Code Environment Diagnostics

Use `/doctor` only when one or more of the following conditions apply:
- Claude Code installation or configuration appears broken.
- Tools, hooks, skills, plugins, permissions, or integrations are not working as expected.
- An unexpected environment-level error prevents normal work.
- The user explicitly requests an environment diagnostic.

Do not run `/doctor` automatically for ordinary implementation tasks.

When `/doctor` is used:
- Report the relevant findings.
- Distinguish environment problems from application-code problems.
- Do not change project code merely to work around a Claude Code installation problem.

### Completion Report

At the end of every implementation task, report:
- Acceptance criteria status
- Files changed
- Verification performed
- Improvement iterations used
- Remaining risks or limitations
- Commit status
- Recommended next step

**Open Items Ledger requirement:** any unresolved gap, known limitation, or deferred
decision left at the end of a task must also be **appended as a row in
`docs/open-items-ledger.md`** — not just mentioned in the final report. This applies
to every agent (not only `backlog-tracker`, which maintains and re-verifies the file
but does not generate the gaps itself):

- If the agent has `Write` access: append the row directly, following the file's
  existing table format (`WORK-ID | description | status | last-checked | owning
  agent`) — additive only, never rewrite or remove another agent's rows, never touch
  any file in the ledger beyond that one append.
- If the agent is review-only (no `Write` — e.g. `architect-reviewer`, `cto`,
  `macro-sector-context-engineer`, `qa-release-reviewer`,
  `security-secrets-auditor`): **propose** the exact row text in the final report
  instead, and say plainly that it was not written to the file.
- A task with zero unresolved gaps does not need a row — do not invent one to satisfy
  this rule.
- Invoke `backlog-tracker` (or ask the user to) when the ledger needs a full
  re-verification pass, not on every routine append.
