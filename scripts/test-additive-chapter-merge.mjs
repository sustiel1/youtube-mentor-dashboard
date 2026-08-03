import assert from 'node:assert/strict';
import { prepareAdditiveChapterMerge } from '../src/lib/additiveChapterMerge.js';

const existing = Array.from({ length: 3 }, (_, index) => ({
  id: `existing-${index}`,
  title: `Existing chapter ${index}`,
  startSeconds: index * 100,
  endSeconds: index * 100 + 90,
  manuallyEdited: true,
  legacyField: `preserve-${index}`,
}));
const merged = prepareAdditiveChapterMerge(existing, [
  { id: 'new-timed', title: 'New timed chapter', startSeconds: 150.56, endSeconds: 175.25 },
  { id: 'new-untimed', title: 'New untimed chapter' },
]);
assert.equal(merged.ok, true);
assert.equal(merged.addedCount, 2);
assert.deepEqual(merged.chapters.filter(({ id }) => id.startsWith('existing-')), existing);
assert.equal(merged.chapters.at(-1).id, 'new-untimed');

const duplicate = prepareAdditiveChapterMerge(existing, [{ id: 'existing-1', title: 'Replacement', startSeconds: 100 }]);
assert.equal(duplicate.duplicateCount, 1);
assert.strictEqual(duplicate.chapters[1], existing[1]);

const uncertain = prepareAdditiveChapterMerge(existing, [{ title: 'Different title', startSeconds: 100.5, endSeconds: 120 }]);
assert.equal(uncertain.uncertainCount, 1);
assert.equal(uncertain.addedCount, 0);

const zero = prepareAdditiveChapterMerge([], [{ title: 'Zero', startSeconds: 0, endSeconds: 0.56 }]);
assert.equal(zero.chapters[0].startSeconds, 0);
for (const invalid of [
  { title: 'Negative', startSeconds: -1 },
  { title: 'Bad end', startSeconds: 10, endSeconds: 10 },
  { title: '', startSeconds: 10 },
]) {
  const result = prepareAdditiveChapterMerge(existing, [invalid]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.chapters, existing);
}

console.log(JSON.stringify({ status: 'passed', existingPreserved: 3, added: 2, uiWiring: false }, null, 2));
