// Pure display helper for WorkspaceTabRow tab labels.
// Kept in its own plain-JS file (no JSX) so it can be unit-tested with
// plain `node` — WorkspaceTabRow.jsx can't be imported directly by a
// Node script since Node can't parse the JSX in the rest of that file.

// Returns the "(N)" suffix for a tab count, including "(0)" — count
// visibility must not depend on whether the count is non-zero.
export function getCountBadgeSuffix(count) {
  return typeof count === 'number' ? ` (${count})` : '';
}
