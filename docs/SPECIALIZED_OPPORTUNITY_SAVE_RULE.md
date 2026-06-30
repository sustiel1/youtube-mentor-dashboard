# Specialized Tab — Opportunity Card Save Rule

**תאריך:** 2026-06-30

---

## Problem

כרטיסי הזדמנויות בלשונית Specialized (מבזק בוקר) לא ניתנים לבחירה ולשמירה.

**שורש הבעיה (טכני):**
`formatOpportunityText` ב-`morningBriefBulkSections.js` בנה טקסט ללא prefix של ticker:
```
"כניסה לאחר דוחות חזקים — עלתה ב-27%-30%..."
```

הכרטיס הוויזואלי (`OpportunitiesRisksDashboard`) בנה `saveText` עם ticker prefix:
```
"AVAV · כניסה לאחר דוחות חזקים — עלתה ב-27%-30%..."
```

`MorningBriefBulkCheckbox` → `resolveMorningBriefBulkId` לא מצא התאמה → `id = null` → הצ'קבוקס לא רונדר.

---

## What should be saveable

- כרטיסי הזדמנויות עם תוכן אמיתי (ticker + title + detail/rationale)
- דוגמה: `AVAV · כניסה לאחר דוחות חזקים — עלתה ב-27%-30% אבל רחוקה מההתנגדות ב-224`

**לא ישמר:**
- slot ריק (placeholder) — `MacroStyleEmptyInsightCard`

---

## Selection behavior

1. צ'קבוקס מופיע על כל כרטיס הזדמנות עם תוכן
2. לחיצה מוסיפה את הפריט ל-`multiSelected`
3. Toolbar בחירה מופיע
4. Select All כולל את פריטי ההזדמנויות פעם אחת (דרך `TabBulkItemsRegistrar`)
5. כרטיסי סיכון ממשיכים לעבוד ללא שינוי

---

## Save behavior

- **Save to Brain:** הטקסט הנשמר כולל ticker prefix + title + rationale
  `"AVAV · כניסה לאחר דוחות חזקים — עלתה ב-27%-30%..."`
- **Analyze with AI:** הפריט נכלל בטקסט המנותח
- **Copy/Export:** הפריט נכלל פעם אחת
- **Card header checkbox** (משולב הזדמנויות+סיכונים): עדיין עובד כבעבר

---

## QA checklist

בסביבת Base44 Production, לאחר Pull:

- [ ] כרטיס AVAV מציג צ'קבוקס
- [ ] לחיצה על צ'קבוקס → toolbar בחירה מופיע
- [ ] Save to Brain שומר: `AVAV · כניסה לאחר דוחות חזקים — עלתה ב-27%-30%...`
- [ ] Analyze with AI כולל את פריט ה-AVAV
- [ ] Copy selected כולל את הפריט פעם אחת
- [ ] Select All כולל את הפריט פעם אחת (לא 1:2)
- [ ] כרטיסי סיכון עובדים כבעבר
- [ ] מניות, מאקרו, סקטורים, חדשות עובדים כבעבר
- [ ] Build עובר ללא שגיאות

---

## Rollback strategy

שינוי יחיד ב-`src/lib/morningBriefBulkSections.js` → `formatOpportunityText`.

לחזרה לגרסה הקודמת:
```js
function formatOpportunityText(idea) {
  const title = String(idea.title || '').trim();
  const detail = String(idea.detail || '').trim();
  const description = detail && detail !== title ? detail : '';
  return [title, description].filter(Boolean).join(' — ');
}
```

---

## File changed

- `src/lib/morningBriefBulkSections.js` → `formatOpportunityText` — הוסף ticker prefix
