/**
 * Real merge QA — vault file on disk after each sequential save (not localStorage).
 * Run: npx playwright test e2e/obsidian-merge-vault.qa.spec.js
 *
 * Requires OBSIDIAN_VAULT_PATH (or VITE_OBSIDIAN_VAULT_PATH) pointing to a real vault.
 */
import { test, expect } from '@playwright/test';
import { loadEnv } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  MERGE_QA_ROW_A,
  MERGE_QA_ROW_B,
  MERGE_QA_ROW_C,
  MERGE_QA_ROW_D,
  MERGE_QA_ROW_E,
  MERGE_QA_MANUAL_LINE,
  countSubstring,
  resolveVaultConfig,
  runObsidianMergeVaultQa,
} from '../scripts/lib/obsidianMergeVaultQa.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = loadEnv('development', ROOT, '');
// Isolated temp vault — reads real markdown from disk, no localStorage.
const { vaultPath, vaultName } = resolveVaultConfig(env, { useTempVault: true });

test.describe('Obsidian merge vault QA (disk verification)', () => {
  test('sequential A → B → C appends; re-save B does not duplicate', async ({ baseURL }) => {
    const { passed, failed, content, vaultFile, relativePath } = await runObsidianMergeVaultQa({
      baseUrl: baseURL,
      vaultPath,
      vaultName,
      log: () => {},
      error: () => {},
    });

    expect(failed, `merge QA failures (${passed} passed)`).toBe(0);
    expect(content, `vault file missing: ${vaultFile}`).toBeTruthy();
    expect(content).toContain(MERGE_QA_ROW_A);
    expect(content).toContain(MERGE_QA_ROW_B);
    expect(content).toContain(MERGE_QA_ROW_C);
    expect(content).toContain(MERGE_QA_ROW_D);
    expect(content).toContain(MERGE_QA_ROW_E);
    expect(content).toContain(MERGE_QA_MANUAL_LINE);
    expect(countSubstring(content, MERGE_QA_ROW_B)).toBe(1);

    test.info().annotations.push({ type: 'vaultFile', description: vaultFile || '' });
    test.info().annotations.push({ type: 'relativePath', description: relativePath || '' });
    test.info().annotations.push({ type: 'rowACount', description: String(countSubstring(content, MERGE_QA_ROW_A)) });
    test.info().annotations.push({ type: 'rowBCount', description: String(countSubstring(content, MERGE_QA_ROW_B)) });
    test.info().annotations.push({ type: 'rowCCount', description: String(countSubstring(content, MERGE_QA_ROW_C)) });
  });
});
