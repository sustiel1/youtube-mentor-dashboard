# Market Brief GEM Routing Source of Truth

## Canonical GEM

- Key: `morning-evening-market-brief`
- Label: `מבזק בוקר / ערב`
- URL: `https://gemini.google.com/gem/1CN2KyVNHZalbhNR6rqCcztivoHcl4ySx?usp=sharing`
- Supported video types: `morningBrief`, `eveningBrief`
- Supported content type: `marketBrief`

Morning and Evening Briefs use this single GEM. The GEM structures only the supplied transcript and timing evidence; it is not a source of live market data.

Strong opening aliases (`מבזק לייב פתיחה`, `מבזק פתיחה`, `מבזק בוקר`, `פתיחת מסחר`, `morning brief`, `market open`, `opening bell`) and closing aliases (`לייט נייט`, `לייטנייט`, `מבזק ערב`, `סיכום מסחר`, `סיכום יום המסחר`, `נעילת מסחר`, `אחרי המסחר`, `after market`, `after hours`, `market close`, `closing brief`, `late night`) belong to this same canonical family and URL.

These specific aliases are evaluated before broad market/day-trading keywords. A genuine day-trading title remains on its existing route. An explicit user-confirmed non-brief subcategory retains priority over title inference.

## Session classification precedence

1. Explicit saved `briefType`, `marketSession`, or compatible legacy metadata.
2. Optional structured GEMS `briefType` or `marketSession`.
3. Existing canonical `videoType` routing.
4. Strong title keywords for opening or closing briefs.
5. `unknown` when evidence is insufficient.

Publication time and mentor identity never determine the session. Explicit metadata is never overwritten by title inference.

## Compatibility

The optional JSON fields are:

- `briefType`: `morning | evening | unknown`
- `marketSession`: `before-market | after-market | unknown`

Legacy payloads without these fields remain valid. Existing stored videos are not rewritten. Unknown videos display `מבזק בוקר / ערב` with `מועד המסחר לא זוהה` until the user chooses a session for the current launcher interaction.

## Regression requirements

Tests must cover the exact canonical URL, both session types, explicit-over-title precedence, unknown state, mentor independence, transcript copy-once behavior, legacy payload compatibility, and unchanged tab/Specialized routing.
