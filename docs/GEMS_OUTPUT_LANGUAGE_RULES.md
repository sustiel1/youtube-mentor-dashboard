# GEMS Output Language Rules

> כללי שפה לפלט של GEM prompts ו-JSON schemas.
> עדכון אחרון: 2026-06-30

---

## Rule Summary

| Element | Language | Example |
|---|---|---|
| JSON keys | English | `contentType`, `recommendedGem`, `reason`, `chapters` |
| User-facing text values | Hebrew | `"reason": "כותרת מבזק לייב פתיחה"` |
| Summary / insights / chapters text | Hebrew | `"shortSummary": "שוק ניסה לפרוץ..."` |
| Ticker symbols | English (as-is) | `"stocksMentioned": ["NVDA", "SPY"]` |
| Technical terms | English or Hebrew transliteration | `"RSI", "MACD", "VIX"` or `"פריצה"` |
| Dates and numbers | Format from transcript | `"2026-06-29"`, `"18.0"` |
| Classification labels (contentType values) | English camelCase | `"marketBrief"`, `"dailyTrading"`, `"fundamental"` |
| Gem keys (recommendedGem values) | English camelCase | `"news"`, `"macro"`, `"technical"` |

---

## GEM Prompt Output Language Rules

### Required: Hebrew for all user-facing text

All text that will be displayed to the user must be in Hebrew:

```json
{
  "shortSummary": "השוק נפתח עם ירידות קלות לאחר נאום הפד...",
  "chapters": [
    { "title": "VIX מעל 20 — שינוי גישה", "summary": "מדד הפחד עלה..." }
  ],
  "insights": ["כשהפד מדבר, המניות עוצרות לנשום — זהו כלל שוק."]
}
```

### Required: English for all JSON keys

Never translate JSON keys to Hebrew:

```json
// CORRECT
{ "contentType": "marketBrief", "recommendedGem": "news" }

// WRONG — never do this
{ "סוגתוכן": "מבזקבוקר", "גםמומלץ": "חדשות" }
```

### Required: English for classification values

`contentType`, `recommendedGem`, `source` values must always be English:

```json
{
  "contentType": "marketBrief",
  "recommendedGem": "news",
  "source": "titleOverride",
  "reason": "כותרת מכילה מבזק לייב פתיחה"
}
```

---

## metadata.contentClassification Schema

When `resolveContentClassification()` is called (from `src/ai/gemini/gemContentRouter.js`), it returns:

```json
{
  "contentType":    "marketBrief | macro | dailyTrading | fundamental | general | political",
  "recommendedGem": "news | macro | technical | fundamental | general | political",
  "confidence":     "high | medium | low",
  "confidencePct":  97,
  "reason":         "string in Hebrew",
  "source":         "titleOverride | titleKeywords | transcriptRules | fallback"
}
```

When stored via `wrapAsMetadataClassification()`, this is wrapped as:

```json
{
  "metadata": {
    "contentClassification": {
      "contentType": "marketBrief",
      "recommendedGem": "news",
      "confidence": "high",
      "confidencePct": 97,
      "reason": "כותרת מבזק לייב פתיחה",
      "source": "titleOverride",
      "classifiedAt": "2026-06-30T00:00:00.000Z"
    }
  }
}
```

---

## GEM Prompt Output Schema — Universal Keys

All GEM prompts should return these top-level keys:

| Key | Type | Language | Required |
|---|---|---|---|
| `contentType` | string | English | Yes |
| `shortSummary` | string | Hebrew | Yes |
| `fullSummary` | string | Hebrew | Yes |
| `chapters` | array | keys English, text Hebrew | Yes (or []) |
| `keyPoints` | string[] | Hebrew | Yes |
| `mainLesson` | string | Hebrew | No |
| `tags` | string[] | Hebrew or English | No |
| `universalTabs` | object | keys English, text Hebrew | For market briefs |

---

## GEM Prompt Output Schema — Morning Brief / Market Brief

For `contentType = 'marketBrief'`, the GEM should additionally return:

```json
{
  "universalTabs": {
    "summary": ["string in Hebrew"],
    "chapters": [{ "title": "...", "startSeconds": 0, "summary": "..." }],
    "insights": ["string in Hebrew"],
    "specialized": {
      "indices": [{ "name": "S&P 500", "level": "5,280", "change": "+0.3%" }],
      "marketNews": ["string in Hebrew"],
      "stocksMentioned": [{ "symbol": "NVDA", "reason": "...", "importance": "high" }],
      "macroFactors": [{ "name": "VIX", "value": "18.0", "trend": "...", "notes": "..." }],
      "watchlistLevels": [{ "symbol": "...", "level": "...", "type": "Support|Resistance" }],
      "sectorRotation": [{ "sector": "Technology", "trend": "חיובי", "notes": "..." }],
      "tradingOpportunities": [{ "symbol": "...", "setup": "...", "stopLoss": "..." }],
      "economicCalendar": [{ "event": "...", "importance": "critical|high|medium|low" }],
      "risks": [{ "riskFactor": "string in Hebrew" }],
      "sentiment": [{ "scope": "Market", "status": "Bullish", "details": "..." }]
    }
  }
}
```

---

## What to Avoid in GEM Prompts

| Avoid | Use instead |
|---|---|
| Generic placeholder values | Empty arrays `[]` |
| `"מדומה"`, `"placeholder"`, `"example"` | Only real transcript content |
| Repeating the same idea in different fields | De-duplicate; one idea per item |
| Translating JSON keys | Keep keys English always |
| Writing English summaries | All summaries must be Hebrew |

---

## Files

| File | Role |
|---|---|
| `src/ai/gemini/gemContentRouter.js` | Classification + mapping source-of-truth |
| `src/ai/gemini/prompts/marketPrompt.js` | Market prompt builder |
| `src/ai/gemini/prompts/generalPrompt.js` | General prompt builder |
| `src/ai/gemini/prompts/politicalPrompt.js` | Political prompt builder |
| `src/ai/gemini/schemas/morningBriefSchema.js` | Morning brief schema example |
| `src/ai/gemini/schemas/marketSchema.js` | Market schema example |
| `src/ai/gemini/schemas/generalSchema.js` | General schema example |
| `src/ai/gemini/validators/validateMarket.js` | Market normalizer/validator |
| `src/ai/gemini/validators/validateGeneral.js` | General normalizer/validator |
| `src/ai/gemini/validators/validatePolitical.js` | Political normalizer/validator |
