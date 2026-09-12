// Read-only WIP status report for the SessionStart hook.
// Only runs inspection commands (git status/branch/rev-parse/rev-list/worktree list,
// plus a local file read of docs/open-items-ledger.md). Never writes to the repo or
// network, and never throws/exits non-zero, so it can never block a session start.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const GIT_TIMEOUT_MS = 3000;

function safeGit(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: GIT_TIMEOUT_MS,
    }).trim();
  } catch {
    return null;
  }
}

function countOpenLedgerRows(ledgerPath) {
  const content = readFileSync(ledgerPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => l.trim() === '## Open items');
  if (startIdx === -1) return null;
  let endIdx = lines.findIndex((l, i) => i > startIdx && /^## /.test(l));
  if (endIdx === -1) endIdx = lines.length;
  const rows = lines
    .slice(startIdx + 1, endIdx)
    .filter((l) => l.trim().startsWith('|'))
    .filter((l) => !/^\|\s*-+\s*(\|\s*-+\s*)*\|?\s*$/.test(l.trim()))
    .filter((l) => !l.includes('WORK-ID'));
  return rows.length;
}

function main() {
  const warnings = [];
  const lines = [];

  const branch = safeGit(['branch', '--show-current'], REPO_ROOT);
  const headShort = safeGit(['rev-parse', '--short', 'HEAD'], REPO_ROOT);
  if (branch === null || headShort === null) warnings.push('git branch/HEAD נכשל');

  const statusOut = safeGit(['status', '--porcelain'], REPO_ROOT);
  let dirtyText = 'לא זמין';
  if (statusOut !== null) {
    dirtyText = String(statusOut === '' ? 0 : statusOut.split('\n').filter(Boolean).length);
  } else {
    warnings.push('git status נכשל');
  }

  let unpushedText = 'לא זמין';
  if (branch) {
    const remoteRef = `origin/${branch}`;
    const verified = safeGit(['rev-parse', '--verify', '--quiet', remoteRef], REPO_ROOT);
    if (verified) {
      const count = safeGit(['rev-list', '--count', `${remoteRef}..HEAD`], REPO_ROOT);
      unpushedText = count !== null ? count : 'שגיאה';
      if (count === null) warnings.push('ספירת קומיטים לא נדחפו נכשלה');
    } else {
      unpushedText = `אין ${remoteRef}`;
    }
  } else {
    unpushedText = 'לא זמין (detached HEAD?)';
  }

  let worktreeText = 'לא זמין';
  const wtOut = safeGit(['worktree', 'list', '--porcelain'], REPO_ROOT);
  if (wtOut !== null) {
    const worktreePaths = wtOut
      .split('\n')
      .filter((l) => l.startsWith('worktree '))
      .map((l) => l.slice('worktree '.length).trim());
    let dirty = 0;
    let clean = 0;
    let unreachable = 0;
    for (const wtPath of worktreePaths) {
      if (!existsSync(wtPath)) {
        unreachable += 1;
        continue;
      }
      const wtStatus = safeGit(['status', '--porcelain'], wtPath);
      if (wtStatus === null) {
        unreachable += 1;
        continue;
      }
      if (wtStatus === '') clean += 1;
      else dirty += 1;
    }
    worktreeText = `${worktreePaths.length} סה"כ (${dirty} מלוכלכים, ${clean} נקיים, ${unreachable} לא נגישים)`;
  } else {
    warnings.push('git worktree list נכשל');
  }

  let ledgerText = 'לא זמין';
  try {
    const count = countOpenLedgerRows(path.join(REPO_ROOT, 'docs', 'open-items-ledger.md'));
    ledgerText = count === null ? 'לא נמצא סעיף Open items' : String(count);
  } catch {
    warnings.push('קריאת open-items-ledger.md נכשלה');
  }

  lines.push('📋 דוח עבודה פתוחה — youtube-mentor-dashboard');
  lines.push(`ענף: ${branch ?? 'לא זמין'} | HEAD: ${headShort ?? 'לא זמין'}`);
  lines.push(`נתיב: ${REPO_ROOT}`);
  lines.push(`קבצים שהשתנו/לא במעקב: ${dirtyText}`);
  lines.push(`קומיטים מקומיים שלא נדחפו ל-origin: ${unpushedText}`);
  lines.push(`Worktrees: ${worktreeText}`);
  lines.push(`שורות פתוחות ב-open-items-ledger.md: ${ledgerText}`);
  if (warnings.length > 0) lines.push(`⚠ אזהרות: ${warnings.join('; ')}`);

  console.log(lines.join('\n'));
}

try {
  main();
} catch (err) {
  console.log('📋 דוח עבודה פתוחה — youtube-mentor-dashboard');
  console.log(`⚠ הדוח נכשל באופן לא צפוי: ${err?.message ?? err}`);
}
process.exit(0);
