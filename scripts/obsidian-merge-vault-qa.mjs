#!/usr/bin/env node
/**
 * Real merge QA — reads actual vault markdown after each save (not localStorage).
 *
 * Prerequisites:
 *   1. npm run dev   (port 5184)
 *   2. OBSIDIAN_VAULT_PATH or VITE_OBSIDIAN_VAULT_PATH in .env.local
 *
 * Run:
 *   node scripts/obsidian-merge-vault-qa.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadEnv } from 'vite';
import {
  resolveVaultConfig,
  runObsidianMergeVaultQa,
  waitForDevServer,
} from './lib/obsidianMergeVaultQa.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = loadEnv('development', ROOT, '');
const useTemp = process.env.MERGE_QA_USE_ENV_VAULT !== '1';
const { vaultPath, vaultName, isTempVault } = resolveVaultConfig(env, { useTempVault: useTemp });
const BASE_URL = process.env.MERGE_QA_BASE_URL || 'http://localhost:5184';

async function main() {
  console.log('Obsidian merge vault QA');
  console.log(`  server: ${BASE_URL}`);
  console.log(`  vault:  ${vaultPath}${isTempVault ? ' (temp)' : ''}`);
  console.log(`  name:   ${vaultName}\n`);

  const up = await waitForDevServer(BASE_URL);
  if (!up) {
    console.error('ERROR: Dev server not reachable. Start with: npm run dev');
    process.exit(1);
  }

  const { passed, failed, vaultFile } = await runObsidianMergeVaultQa({
    baseUrl: BASE_URL,
    vaultPath,
    vaultName,
  });

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  if (vaultFile) console.log(`Inspect: ${vaultFile}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
