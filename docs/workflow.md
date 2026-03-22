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
