import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  FINVIZ_MARKET_MAP_LINK,
  resolveMarketRegimeRowLink,
} from '../src/lib/marketRegimeExternalLinks.js';
import { translateIndicatorStatusDisplay } from '../src/lib/indicatorEnumDisplay.js';

assert.deepEqual(FINVIZ_MARKET_MAP_LINK, {
  id: 'market-map',
  url: 'https://finviz.com/map',
  ariaLabel: 'פתיחת מפת השוק של Finviz',
});

const cases = [
  [{ key: 'summary', label: 'ignored' }, 'https://finviz.com/', 'פתיחת סיכום מצב השוק ב־Finviz'],
  [{ key: 'marketSummary', label: 'ignored' }, 'https://finviz.com/', 'פתיחת סיכום מצב השוק ב־Finviz'],
  [{ key: 'breadth', label: 'ignored' }, 'https://finviz.com/', 'פתיחת נתוני רוחב השוק ב־Finviz'],
  [{ key: 'marketBreadth', label: 'ignored' }, 'https://finviz.com/', 'פתיחת נתוני רוחב השוק ב־Finviz'],
  [{ key: 'generalMood', label: 'ignored' }, 'https://finviz.com/stock?t=SPY', 'פתיחת מצב השוק הכללי של SPY ב־Finviz'],
  [{ key: 'legacy', label: 'סיכום מצב השוק' }, 'https://finviz.com/', 'פתיחת סיכום מצב השוק ב־Finviz'],
  [{ key: 'legacy', label: 'רוחב שוק' }, 'https://finviz.com/', 'פתיחת נתוני רוחב השוק ב־Finviz'],
  [{ key: 'legacy', label: 'מצב רוח כללי' }, 'https://finviz.com/stock?t=SPY', 'פתיחת מצב השוק הכללי של SPY ב־Finviz'],
];

for (const [card, expectedUrl, expectedLabel] of cases) {
  const before = JSON.stringify(card);
  const link = resolveMarketRegimeRowLink(card);
  assert.equal(link?.url, expectedUrl);
  assert.equal(link?.ariaLabel, expectedLabel);
  assert.equal(JSON.stringify(card), before, 'source card remains unchanged');
}

assert.equal(resolveMarketRegimeRowLink({ key: 'volatility', label: 'סביבת תנודתיות' }), null);
assert.equal(resolveMarketRegimeRowLink(null), null);

assert.equal(translateIndicatorStatusDisplay('bullish'), 'שורי');
assert.equal(translateIndicatorStatusDisplay('bearish'), 'דובי');
assert.equal(translateIndicatorStatusDisplay('neutral'), 'ניטרלי');
assert.equal(translateIndicatorStatusDisplay('unknown'), 'לא ידוע');
assert.equal(translateIndicatorStatusDisplay('bullish ↑'), 'שורי ↑');
assert.equal(translateIndicatorStatusDisplay('טקסט חופשי'), 'טקסט חופשי');

const panelSource = readFileSync(
  new URL('../src/components/dashboard/MorningBriefPanels.jsx', import.meta.url),
  'utf8',
);
assert.ok(panelSource.includes('href={FINVIZ_MARKET_MAP_LINK.url}'));
assert.ok(panelSource.includes('data-market-regime-heading-link'));
assert.ok(panelSource.includes('data-market-regime-link={externalLink.id}'));
assert.ok(panelSource.includes('title="פתיחה באתר חיצוני"'));
assert.ok(panelSource.includes('target="_blank"'));
assert.ok(panelSource.includes('rel="noopener noreferrer"'));
assert.ok(panelSource.includes('cursor-pointer'));
assert.ok(panelSource.includes('focus-visible:ring-2'));
assert.ok(panelSource.includes('onClick={(event) => event.stopPropagation()}'));
assert.ok(panelSource.includes('<MorningBriefBulkCheckbox'));
assert.ok(panelSource.includes('translateIndicatorEnums />'));

console.log(`market regime external links QA: ${cases.length * 3 + 20} assertions passed`);
