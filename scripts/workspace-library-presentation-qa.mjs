#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createWorkspaceLibraryPresentation, getWorkspaceCollectionId } from '../src/utils/workspaceLibraryPresentation.js';

const items = [
  { id: 'legacy', videoTitle: 'Legacy title', notes: 'special note', ticker: 'ABC', source: 'mentor' },
  { id: 'snapshot', itemType: 'structured-snapshot', structuredSnapshot: { stocks: [{ symbol: 'NVDA' }] } },
  { id: 'insight', sourceTab: 'insights' },
  { id: 'knowledge', itemType: 'checklist' },
  { id: 'app', sourceTab: 'app-builder', appPayload: { name: 'X' } },
  { id: 'title-only', title: 'תובנות חשובות' },
];

const view = createWorkspaceLibraryPresentation(items);
assert.deepEqual(view.select('all').map(item => item.id), items.map(item => item.id));
assert.equal(new Set(view.ids).size, items.length);
assert.equal(view.counts.all, items.length);
assert.equal(view.counts.specialized, 1, 'Snapshot is presented through Targeted Content');
assert.equal(view.counts.insights, 1);
assert.equal(view.counts.knowledge, 1);
assert.equal(view.counts.apps, 1);
assert.deepEqual(view.select('unclassified').map(item => item.id).sort(), ['legacy', 'title-only']);
assert.equal(getWorkspaceCollectionId(items[5]), 'unclassified', 'title text must not classify an item');
assert.equal(view.search('Legacy').length, 1);
assert.equal(view.search('special note').length, 1);
assert.equal(view.search('ABC').length, 1);
assert.equal(view.search('mentor').length, 1);
assert.equal(view.search('NVDA').length, 1);
assert.equal(Object.values(view.byCollection).reduce((sum, group) => sum + group.length, 0), items.length);
console.log('Workspace Library presentation QA: 15 assertions passed');
