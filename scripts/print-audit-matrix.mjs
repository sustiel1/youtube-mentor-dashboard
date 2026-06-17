/**
 * Prints audit matrix (vite-node). Invoked by scripts/runtime-tabs-audit.mjs after Playwright DOM pass.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { buildAuditMatrix } from '../src/lib/runtimeTabsAudit.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/universal-tabs-audit.fixture.json'), 'utf8'),
);

const VIDEO_ID = 'runtime-audit-video-001';
const video = {
  id: VIDEO_ID,
  category: 'שוק ההון',
  subCategory: 'מבזק בוקר',
  confirmedSubCategory: 'morning-brief',
  userConfirmedSubCategory: true,
};

const domByTab = process.env.AUDIT_DOM_BY_TAB
  ? JSON.parse(process.env.AUDIT_DOM_BY_TAB)
  : {};

const ctx = {
  effectiveVideo: video,
  video,
  enrichedVideo: video,
  marketBriefData: fixture,
  baseChapters: [],
  normalizedSubCategory: 'morning-brief',
};

const matrix = buildAuditMatrix(ctx, domByTab, { log: true });
console.log('\n=== RUNTIME TABS AUDIT MATRIX ===\n');
console.table(matrix);
