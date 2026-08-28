# Secrets & Sensitive-Data Audit — 2026-08-28

Scope: full project (`src/**`, `backend/**`, `scripts/**`, `vite.config.js`, CI config,
env files, tracked log/artifact files, and untracked build/backup folders).
Method: read-only scan via `security-secrets-auditor` subagent (Read, Grep, Glob).

## Summary

**0 critical, 0 high, 1 medium, 7 low**

No secret is committed to a tracked source file. All real API keys live only in
git-ignored `.env` / `.env.local`. Every finding is either a real key sitting in a
(correctly ignored) plaintext file on disk, a template/prefix hygiene issue, or a
stale committed diagnostic artifact.

## Findings (sorted by severity)

### MEDIUM

| # | File / line | What was found | Fix |
|---|---|---|---|
| 1 | MEDIUM · Gemini key `AIzaSyA…DAsjw` | Live Google/Gemini key with a browser-exposable `VITE_` prefix, in a git-ignored + untracked env file. The var is unused in code, but the `VITE_` prefix means any future use bundles the key into the client. Contradicts the "AI keys are server-side only" convention. | Delete this unused line; rotate the key; if a browser-side Gemini key is ever needed, treat it as public and restrict it by HTTP referrer in Google Cloud. |

### LOW

| # | File / line | What was found | Fix |
|---|---|---|---|
| 2 | LOW · Anthropic key `sk-ant-api03-…AAA` | Live Anthropic key in a git-ignored env file (working tree only, not in git index). Correctly server-side (no `VITE_` prefix). Flagged only as a real active key in plaintext on disk. | Confirm it was never committed in earlier history; rotate if any doubt; keep it out of git as it is now. |
| 3 | LOW · Gemini key `AIzaSyC…B6EYo` | Live Google/Gemini key in a git-ignored env file (server-side name, untracked). Same caveat — real key in plaintext. | Verify not in past commits; rotate if unsure; restrict the key in Google Cloud console. |
| 4 | [.env.example:47](../../.env.example#L47) | Template has an uncommented `VITE_`-prefixed Anthropic entry: `VITE_ANTHROPIC_API_KEY=your_anthropic_api_key`. Value is a placeholder (fine), but offering a `VITE_`-prefixed Anthropic var invites users to set a real Claude key that Vite ships to the browser. | Comment out or remove the line; document only `ANTHROPIC_API_KEY` (no prefix) as supported. |
| 5 | [.playwright-mcp/console-2026-05-21T21-57-41-957Z.log:12-39](../../.playwright-mcp/console-2026-05-21T21-57-41-957Z.log#L12) | Committed browser-console capture contains `key=AIzaSyBWW…qIUk4` inside `signaler-pa.clients6.google.com` URLs. This is Google's own front-end GSI key (public, not owned by this project) — not a real leak — but ~180 committed `.playwright-mcp/console-*.log` files are a standing capture channel for future secret/PII leakage. | Stop committing `.playwright-mcp/console-*.log`; `git rm --cached` the existing ones (already in `.gitignore` line 36). |
| 6 | [.playwright-mcp/console-2026-07-03T14-33-50-102Z.log:2671](../../.playwright-mcp/console-2026-07-03T14-33-50-102Z.log#L2671) | Committed console log contains `ws://localhost:5184/?token=dwg…af6U` — a Vite HMR dev WebSocket token, ephemeral and localhost-only, no attacker value. Matches secret-shaped patterns. | Same as #5 — purge committed console logs from the tree. |
| 7 | [.codex-dev-4173.log](../../.codex-dev-4173.log) (+ `.codex-dev-4174..4179.log`, `.codex-dev-4173-escalated.log`, `.codex-dev-live.log`, `.codex-dev-runner.log`, `.codex-dev-runner-cmd.log`, `.codex-dev.log`) | ~10 dev-server logs tracked in git. Reviewed: only Vite startup errors, "port in use" stack traces, absolute local paths, and proxy request lines (public channel IDs, transcript char counts). No keys or PII. `.gitignore` lines 39-40 already exclude `.codex-*.log` — stale committed artifacts. | `git rm --cached` the `.codex-dev-*.log` files. |
| 8 | [debug.log:1](../../debug.log#L1) | Tracked (and currently modified) diagnostic file. Content is only Chromium/Electron GPU and DNS error lines — no secrets, no PII. Defense-in-depth: a committed, mutable `debug.log` is a common future leak site. | `git rm --cached debug.log` and add `debug.log` to `.gitignore`. |

## Recurring pattern

**Committed local diagnostic output despite `.gitignore` already listing it.**
`debug.log`, `.codex-dev-*.log`, and `.playwright-mcp/console-*.log` (and
`.codex-qa-artifacts/*.png`) are all tracked even though their paths are already in
`.gitignore`. None currently leak project secrets or PII, but browser-console and
dev-server logs are the highest-risk future leak vector in this repo. A single
cleanup pass — `git rm --cached` for the already-ignored artifacts — closes the
entire class of findings #5–#8.

A secondary theme in #1 and #4: `VITE_`-prefixed AI-key names keep appearing
(one live key, one template entry) even though the project convention is that
Anthropic/Gemini keys must stay server-side. Worth a lint/grep guard against
`VITE_.*(ANTHROPIC|GEMINI|CLAUDE).*KEY` in config and env templates.

## Checked and clean (non-findings)

- `.env` / `.env.local` / `.env.development.local` — correctly git-ignored, absent from the git index.
- `.env.example`, `.env.local.example` (both tracked) — placeholders only.
- `.env.development.local` — only `VITE_YTMDB_STORAGE_MODE=indexedDB`, no secret.
- `vite.config.js`, `backend/*.function.js`, `src/**` — all keys read from `env` / `process.env` / `import.meta.env`; no hardcoded values. `console.*` calls log status codes, video IDs, char counts — not keys, headers, or bodies.
- `src/lib/geminiJsonDebugReport.js`, `src/lib/gemsImportDiagnosticReport.js` — actively redact `sk-ant-…` and `AIza…` patterns before writing diagnostic reports.
- Untracked build artifact `.codex-build-stock-identity-20260801/assets/index-BB2vltGv.js` — env-var names and a redaction regex only, no key values.
- `.codex-backups/workspace-video-routing-backup-*.json` — no credential fields.
- `.github/workflows/e2e.yml` — no secrets, no `secrets.*` misuse.
- `scripts/test-gemini-json-debug-report.mjs:104-105` — `sk-ant-api03-abcdef…` / `AIzaSyD-abcdef…` are intentional fake fixtures for redaction tests.
