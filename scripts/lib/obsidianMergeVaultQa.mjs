/**
 * Shared merge QA — writes via /api/vault/write mode=merge, verifies vault file on disk.
 * Does NOT use localStorage or item-save UI state.
 */
import { readFileSync, unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const QA_MODULE_DIR = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_TEMP_VAULT_PATH = join(QA_MODULE_DIR, '..', '..', 'e2e', '.tmp-merge-vault');

/** Mirrors src/lib/obsidianItemSaveStore.js — no @/ imports (Node-safe). */
function textDedupeKey(text) {
  return String(text || '').slice(0, 60).toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9א-ת-]/g, '') || 'item';
}

export function buildObsidianItemIdentityKey({ videoId, tabKey, sectionKey, text }) {
  const tab = tabKey || 'multi';
  const section = String(sectionKey || '').trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9א-ת-]/g, '')
    .slice(0, 60) || 'general';
  const textKey = textDedupeKey(text);
  return `obsidian-item:${videoId}:${tab}:${textKey}:${section}`;
}

export const MERGE_QA_VIDEO_ID = 'obsidian-merge-vault-qa';
export const MERGE_QA_VIDEO_TITLE = 'Obsidian Merge Vault QA';
export const MERGE_QA_SECTION = 'סיכונים מרכזיים';
export const MERGE_QA_TAB = 'useful-knowledge';

export const MERGE_QA_ROW_A = 'MERGE-QA sentence A — דילול מניות פתאומי במניות קטנות';
export const MERGE_QA_ROW_B = 'MERGE-QA sentence B — ירידה מתמשכת בביטקוין';
export const MERGE_QA_ROW_C = 'MERGE-QA sentence C — דגלים אדומים ויציאת כספים';
export const MERGE_QA_ROW_D = 'MERGE-QA sentence D — יציאת כספים לפי בנק אוף אמריקה';
export const MERGE_QA_ROW_E = 'MERGE-QA sentence E — סיכון חדש אחרי עריכה ידנית';
export const MERGE_QA_MANUAL_LINE = 'שורה ידנית שהמשתמש הוסיף ב-Obsidian';

export function resolveVaultConfig(env = {}, { useTempVault = false } = {}) {
  const fromEnv = String(
    env.OBSIDIAN_VAULT_PATH || env.VITE_OBSIDIAN_VAULT_PATH || '',
  ).trim();
  const vaultPath = useTempVault || !fromEnv ? DEFAULT_TEMP_VAULT_PATH : fromEnv;
  const vaultName = String(
    env.VITE_OBSIDIAN_VAULT_NAME || env.OBSIDIAN_VAULT_NAME || 'Knowledge-Base',
  ).trim();
  return { vaultPath, vaultName, isTempVault: useTempVault || !fromEnv };
}

export function mergeQaRelativePath(videoId = MERGE_QA_VIDEO_ID) {
  return `QA/obsidian-merge-qa/${videoId}.md`;
}

export function readVaultMarkdown(vaultPath, relativePath) {
  const abs = join(vaultPath, ...String(relativePath).split('/').filter(Boolean));
  if (!existsSync(abs)) return { abs, content: null };
  return { abs, content: readFileSync(abs, 'utf-8') };
}

export function countSubstring(content, needle) {
  if (!content || !needle) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = content.indexOf(needle, idx)) !== -1) {
    count += 1;
    idx += needle.length;
  }
  return count;
}

export function buildMergeItem({ videoId, tabKey, sectionLabel, text }) {
  return {
    text,
    sectionLabel,
    identityKey: buildObsidianItemIdentityKey({
      videoId,
      tabKey,
      sectionKey: sectionLabel,
      text,
    }),
  };
}

export async function postVaultMerge({
  baseUrl,
  relativePath,
  mergeItems,
  videoTitle,
  vaultPath,
  vaultName,
  footerLines = ['מקור: Obsidian merge QA test'],
}) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/vault/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: relativePath,
      mode: 'merge',
      mergeItems,
      footerLines,
      videoTitle,
      vaultPath,
      vaultName,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

export function cleanupVaultFile(vaultPath, relativePath) {
  const { abs } = readVaultMarkdown(vaultPath, relativePath);
  if (existsSync(abs)) unlinkSync(abs);
}

export async function waitForDevServer(baseUrl, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(baseUrl, { method: 'GET' });
      if (res.status < 500) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/**
 * Full sequential merge QA against a live dev server + real vault path.
 * @returns {{ passed: number, failed: number, results: Array }}
 */
export async function runObsidianMergeVaultQa({
  baseUrl = 'http://localhost:5184',
  vaultPath,
  vaultName,
  videoId = MERGE_QA_VIDEO_ID,
  videoTitle = MERGE_QA_VIDEO_TITLE,
  log = console.log,
  error = console.error,
}) {
  if (!vaultPath) {
    throw new Error('vaultPath is required');
  }

  const results = [];
  let passed = 0;
  let failed = 0;

  const check = (name, condition, detail = '') => {
    const ok = Boolean(condition);
    results.push({ name, ok, detail });
    if (ok) {
      passed += 1;
      log(`[PASS] ${name}${detail ? ` — ${detail}` : ''}`);
    } else {
      failed += 1;
      error(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
    }
    return ok;
  };

  const relativePath = mergeQaRelativePath(videoId);
  const rowA = buildMergeItem({
    videoId,
    tabKey: MERGE_QA_TAB,
    sectionLabel: MERGE_QA_SECTION,
    text: MERGE_QA_ROW_A,
  });
  const rowB = buildMergeItem({
    videoId,
    tabKey: MERGE_QA_TAB,
    sectionLabel: MERGE_QA_SECTION,
    text: MERGE_QA_ROW_B,
  });
  const rowC = buildMergeItem({
    videoId,
    tabKey: MERGE_QA_TAB,
    sectionLabel: MERGE_QA_SECTION,
    text: MERGE_QA_ROW_C,
  });
  const rowD = buildMergeItem({
    videoId,
    tabKey: MERGE_QA_TAB,
    sectionLabel: MERGE_QA_SECTION,
    text: MERGE_QA_ROW_D,
  });
  const rowE = buildMergeItem({
    videoId,
    tabKey: MERGE_QA_TAB,
    sectionLabel: MERGE_QA_SECTION,
    text: MERGE_QA_ROW_E,
  });

  const serverUp = await waitForDevServer(baseUrl, 5_000);
  check('dev-server-reachable', serverUp, baseUrl);
  if (!serverUp) return { passed, failed, results, relativePath };

  mkdirSync(vaultPath, { recursive: true });
  mkdirSync(join(vaultPath, 'QA', 'obsidian-merge-qa'), { recursive: true });
  cleanupVaultFile(vaultPath, relativePath);
  check('vault-file-clean-start', !readVaultMarkdown(vaultPath, relativePath).content, relativePath);

  let prevLen = 0;

  // Step 1–2: Save row A
  const saveA = await postVaultMerge({
    baseUrl,
    relativePath,
    mergeItems: [rowA],
    videoTitle,
    vaultPath,
    vaultName,
  });
  check('save-A-api-ok', saveA.data?.ok && saveA.data?.verified, JSON.stringify(saveA.data?.merge || {}));

  let file = readVaultMarkdown(vaultPath, relativePath);
  check('save-A-file-exists', file.content != null, file.abs);
  check('save-A-contains-A', countSubstring(file.content, MERGE_QA_ROW_A) >= 1);
  check('save-A-no-B', countSubstring(file.content, MERGE_QA_ROW_B) === 0);
  check('save-A-no-C', countSubstring(file.content, MERGE_QA_ROW_C) === 0);
  check('save-A-no-D', countSubstring(file.content, MERGE_QA_ROW_D) === 0);
  prevLen = file.content?.length || 0;

  // Step 3–4: Save row B — A must remain
  const saveB = await postVaultMerge({
    baseUrl,
    relativePath,
    mergeItems: [rowB],
    videoTitle,
    vaultPath,
    vaultName,
  });
  check('save-B-api-ok', saveB.data?.ok && saveB.data?.verified);

  file = readVaultMarkdown(vaultPath, relativePath);
  check('save-B-still-has-A', countSubstring(file.content, MERGE_QA_ROW_A) >= 1, 'row A disappeared after B');
  check('save-B-contains-B', countSubstring(file.content, MERGE_QA_ROW_B) >= 1);
  check('save-B-file-grew', (file.content?.length || 0) > prevLen, `len ${prevLen} → ${file.content?.length}`);
  prevLen = file.content?.length || 0;

  // Step 5–6: Batch save rows C + D together
  const saveBatchCD = await postVaultMerge({
    baseUrl,
    relativePath,
    mergeItems: [rowC, rowD],
    videoTitle,
    vaultPath,
    vaultName,
  });
  check('save-batch-CD-api-ok', saveBatchCD.data?.ok && saveBatchCD.data?.verified);
  file = readVaultMarkdown(vaultPath, relativePath);
  check('save-batch-CD-has-A', file.content?.includes(MERGE_QA_ROW_A), 'row A missing after batch CD');
  check('save-batch-CD-has-B', file.content?.includes(MERGE_QA_ROW_B), 'row B missing after batch CD');
  check('save-batch-CD-has-C', file.content?.includes(MERGE_QA_ROW_C), 'row C missing after batch CD');
  check('save-batch-CD-has-D', file.content?.includes(MERGE_QA_ROW_D), 'row D missing after batch CD');
  check('save-batch-CD-all-four', [MERGE_QA_ROW_A, MERGE_QA_ROW_B, MERGE_QA_ROW_C, MERGE_QA_ROW_D]
    .every((t) => file.content.includes(t)));
  const lenBeforeDup = file.content?.length || 0;

  // Step 7–8: Save row B again — no duplicate
  const saveBDup = await postVaultMerge({
    baseUrl,
    relativePath,
    mergeItems: [rowB],
    videoTitle,
    vaultPath,
    vaultName,
  });
  check('save-B-dup-api-ok', saveBDup.data?.ok && saveBDup.data?.verified);
  check('save-B-dup-skipped', saveBDup.data?.merge?.skipped >= 1 || saveBDup.data?.merge?.added === 0);

  file = readVaultMarkdown(vaultPath, relativePath);
  check('save-B-dup-count-1', countSubstring(file.content, MERGE_QA_ROW_B) === 1, `found ${countSubstring(file.content, MERGE_QA_ROW_B)}`);
  check('save-B-dup-still-has-A', countSubstring(file.content, MERGE_QA_ROW_A) >= 1);
  check('save-B-dup-still-has-C', countSubstring(file.content, MERGE_QA_ROW_C) >= 1);
  check('save-B-dup-still-has-D', countSubstring(file.content, MERGE_QA_ROW_D) >= 1);
  check('save-B-dup-no-shrink', (file.content?.length || 0) >= lenBeforeDup);

  // Step 9–10: Manual edit in Obsidian (simulate user edit on disk)
  const manualInjected = `${file.content.trimEnd()}\n${MERGE_QA_MANUAL_LINE}\n`;
  writeFileSync(file.abs, manualInjected, 'utf-8');
  check('manual-line-written', readVaultMarkdown(vaultPath, relativePath).content?.includes(MERGE_QA_MANUAL_LINE));

  // Step 11: Save row E — manual line must remain
  const saveE = await postVaultMerge({
    baseUrl,
    relativePath,
    mergeItems: [rowE],
    videoTitle,
    vaultPath,
    vaultName,
  });
  check('save-E-api-ok', saveE.data?.ok && saveE.data?.verified);
  file = readVaultMarkdown(vaultPath, relativePath);
  check('save-E-manual-preserved', file.content?.includes(MERGE_QA_MANUAL_LINE), 'manual line removed');
  check('save-E-contains-E', file.content?.includes(MERGE_QA_ROW_E));
  check('save-E-all-rows', [MERGE_QA_ROW_A, MERGE_QA_ROW_B, MERGE_QA_ROW_C, MERGE_QA_ROW_D, MERGE_QA_ROW_E]
    .every((t) => file.content.includes(t)));

  log(`\nVault file: ${file.abs}`);
  log(`--- file preview (first 800 chars) ---\n${(file.content || '').slice(0, 800)}\n---`);

  return { passed, failed, results, relativePath, vaultFile: file.abs, content: file.content };
}
