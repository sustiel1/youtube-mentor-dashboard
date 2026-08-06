# ADR — Manual Content Overrides and Source Precedence

Manual Morning Brief edits are stored non-destructively under `marketBriefData.manualOverrides`. The imported GEMS payload remains unchanged.

Resolution precedence is: explicit manual override, canonical structured GEMS value, compatible legacy structured value, text fallback, empty. Macro measured values use `actualValue`; `value` remains a legacy compatibility field and is not written in parallel.

Macro rows use the section key plus `macroSemanticKey(indicator)` as their UI identity. Manual rows record `manualOverrideFields` so numeric zero, negative values, decimals, and explicit clears retain ownership during semantic resolution.

Save writes the override to `market_brief_<videoId>`, invokes the existing video patch callback, reads the persisted section back, and exits edit mode only after equality verification. Failure preserves the previous in-memory state and displays a Hebrew error.

Re-analysis must preserve `manualOverrides`. Removing or replacing an override requires an explicit user action. Tests must cover reload persistence, source preservation, stable identity, exact field ownership, export parity, and failure preservation.
