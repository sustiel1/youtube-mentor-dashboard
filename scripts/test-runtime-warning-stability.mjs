import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const { retainEquivalentEditableDraft } = await vite.ssrLoadModule(
    '/src/components/dashboard/BriefSectionManualEdit.jsx',
  );

  const currentDraft = [{ value: 0, active: false, label: 'חדשות' }];
  for (let index = 0; index < 100; index += 1) {
    const equivalentDraft = [{ value: 0, active: false, label: 'חדשות' }];
    assert.equal(
      retainEquivalentEditableDraft(currentDraft, equivalentDraft),
      currentDraft,
      'equivalent drafts must preserve state identity',
    );
  }
  const changedDraft = [{ value: 1, active: false, label: 'חדשות' }];
  assert.equal(
    retainEquivalentEditableDraft(currentDraft, changedDraft),
    changedDraft,
    'changed drafts must replace state',
  );

  const panelsSource = fs.readFileSync(
    path.join(root, 'src', 'components', 'dashboard', 'MorningBriefPanels.jsx'),
    'utf8',
  );
  assert.match(panelsSource, /const EMPTY_MARKET_BRIEF_DATA = Object\.freeze\(\{\}\);/);
  assert.match(panelsSource, /marketBriefData: marketBriefData \|\| EMPTY_MARKET_BRIEF_DATA/);
  assert.doesNotMatch(panelsSource, /marketBriefData: marketBriefData \|\| \{\}/);

  const editSource = fs.readFileSync(
    path.join(root, 'src', 'components', 'dashboard', 'BriefSectionManualEdit.jsx'),
    'utf8',
  );
  assert.match(editSource, /retainEquivalentEditableDraft\(currentDraft, nextDraft\)/);

  const modalSource = fs.readFileSync(
    path.join(root, 'src', 'components', 'dashboard', 'AiMappingModal.jsx'),
    'utf8',
  );
  assert.match(modalSource, /<DialogPrimitive\.Description/);
  assert.match(modalSource, /<DialogPrimitive\.Title/);

  console.log(JSON.stringify({
    status: 'passed',
    equivalentDraftWrites: 0,
    changedDraftWrites: 1,
    preservesZeroAndFalse: true,
    stableEmptyMarketBriefFallback: true,
    accessibleDialogDescription: true,
  }, null, 2));
} finally {
  await vite.close();
}
