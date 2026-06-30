# Specialized Tab — Select All Deduplication Rule
**תאריך:** 2026-06-30

---

## הבעיה (P1)

לחיצה על "בחר הכל" בלשונית Specialized הפיקה **53 פריטים** כאשר הפריטים הייחודיים האמיתיים הם **~27 בלבד**.

### שורש הבעיה

ב-`renderBulkShell()` (`SpecializedContentRenderer.jsx`) — ה-bulk items שנרשמו ל-`TabBulkItemsRegistrar` היו:

```js
// לפני — שני מסלולים מקבילים:
const cardItems = buildCardBulkItemsFromSections(sectionDefs, 'specialized'); // card-level (8 פריטים)
const rowItems  = buildBulkItemsFromSections(sectionDefs, 'specialized');     // row-level (45 פריטים)
const bulkItems = [...cardItems, ...rowItems]; // 53 פריטים — כל תוכן מוכפל!
```

כל סעיף הופיע **פעמיים**:
- פריט card: `📊 מצב שוק — [bullet1] [bullet2] ...` (כרטיס-כולל)
- פריטים 11–15: `מצב שוק: ערך1`, `מצב שוק: ערך2`, ... (שורות בודדות)

---

## הפתרון

רישום **שורות בלבד** (row-level) ל-Select All. כרטיסי ה-card header ממשיכים לפעול עצמאית.

```js
// אחרי — רק row-level items:
const rowItems = bulkSelection ? buildBulkItemsFromSections(sectionDefs, 'specialized') : [];
// cardItems הוסרו מה-pool של Select All לחלוטין
```

### ויזואל vs. ייצוא

| מרכיב | לפני | אחרי |
|---|---|---|
| כרטיסי סעיף (ויזואל) | ✓ מוצגים | ✓ עדיין מוצגים |
| Checkbox של card header | ✓ עובד | ✓ עדיין עובד (עצמאי מה-pool) |
| "בחר הכל" — card items | ✓ נכלל | ✗ לא נכלל (פתרון P1) |
| "בחר הכל" — row items | ✓ נכלל | ✓ נכלל |
| ספירה לאחר "בחר הכל" | 53 | ~27 (ייחודיים בלבד) |

---

## קבצים ששונו

| קובץ | שינוי |
|---|---|
| `src/components/dashboard/SpecializedContentRenderer.jsx` | הסרת `cardItems` מה-pool של `TabBulkItemsRegistrar`; הסרת `buildMorningBriefCardBulkItems` מה-call site |

### Imports שהוסרו

```js
// הוסרו:
import { buildCardBulkItemsFromSections } from '@/lib/universalTabBulkItems';
import { buildMorningBriefCardBulkItems } from '@/lib/morningBriefBulkSections';
```

---

## כלל לעתיד

> בלשונית Specialized, **`TabBulkItemsRegistrar`** רושם **שורות בלבד** (leaf row items).
> Card header checkboxes פועלים עצמאית דרך `bulkSelection.onToggle()` ישירות.
> אין לרשום card-level items לאותו pool — זה יגרום לכפילות 1:2 בייצוא.

---

## בדיקת QA

לאחר Pull ב-Base44 Production:

- [ ] לחץ "בחר הכל" בלשונית Specialized → ספירה ~27 (לא 53)
- [ ] ייצוא ל-Clipboard / Brain → אין שורות כפולות
- [ ] Checkbox של כותרת סעיף (למשל 📊 מצב שוק) → עובד, בוחר את הסעיף כולו
- [ ] Brain Save + Analyze with AI → פועלים כרגיל
