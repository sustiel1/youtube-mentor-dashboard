// QA for LinkedMarketText.jsx's renderLinkedMarketText(): free-text
// linkification must follow the "Asset link resolution — provider fallback
// rule" (.claude/agents/frontend-rtl-developer.md) — Finviz for equities,
// il.investing.com for indices/macro/commodities/FX, real jargon (CEO, ROI,
// US, ...) stays correctly unlinked, and no other term is ever left as
// unlinked plain text.
//
// Uses Vite's SSR module loader + react-dom/server so the real JSX component
// is exercised end-to-end, not a source-text grep.
//
//   node scripts/linked-market-text-fallback-qa.mjs

import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let count = 0;
const check = (name, fn) => { fn(); count += 1; console.log(`  ok  ${name}`); };

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});
try {
  const { renderLinkedMarketText } = await server.ssrLoadModule(
    '/src/components/shared/LinkedMarketText.jsx',
  );
  const render = (text) => renderToStaticMarkup(React.createElement('div', null, renderLinkedMarketText(text)));

  check('a real US equity ticker still links to Finviz', () => {
    const markup = render('NVDA is up today');
    assert.ok(markup.includes('href="https://finviz.com/quote.ashx?t=NVDA"'), markup);
  });

  check('REGRESSION: a macro indicator mentioned in free text is no longer left unlinked', () => {
    for (const code of ['CPI', 'PCE', 'GDP', 'NFP', 'FOMC', 'FED']) {
      const markup = render(`Today's ${code} print moved the market`);
      assert.ok(markup.includes('<a '), `${code} should be wrapped in a link — markup: ${markup}`);
      assert.ok(markup.includes('href="https://il.investing.com/'), `${code} should link to il.investing.com — markup: ${markup}`);
    }
  });

  check('REGRESSION: DXY/BTC/ETH/VIX mentioned in free text resolve to il.investing.com, not a broken Finviz link', () => {
    for (const [code, expectedFragment] of [
      ['DXY', 'indices/usdollar'],
      ['BTC', 'crypto/bitcoin/btc'],
      ['ETH', 'crypto/ethereum/eth-usd'],
      ['VIX', 'indices/volatility-s-p-500'],
    ]) {
      const markup = render(`Watching ${code} closely`);
      assert.ok(markup.includes(`https://il.investing.com/${expectedFragment}`), `${code} -> ${markup}`);
      assert.ok(!markup.includes(`https://finviz.com/quote.ashx?t=${code}`), `${code} must not get a broken Finviz link`);
    }
  });

  check('pure jargon terms stay unlinked exactly as before (not real market entities)', () => {
    for (const term of ['CEO', 'ROI', 'US', 'EU', 'DJ', 'VC', 'TA', 'ETF', 'AI', 'USD', 'ILS']) {
      const markup = render(`The ${term} said something`);
      assert.ok(!markup.includes('<a '), `${term} should stay plain text — markup: ${markup}`);
      assert.ok(markup.includes(`>${term}`) || markup.includes(`${term}<`) || markup.includes(term), `${term} text preserved`);
    }
  });

  check('Hebrew company alias still links to the correct Finviz ticker (unaffected by this fix)', () => {
    const markup = render('מטה פרסמה תוצאות');
    assert.ok(markup.includes('https://finviz.com/quote.ashx?t=META'), markup);
  });

  check('plain text with no linkable terms is returned unchanged', () => {
    const markup = render('שוק המניות נסחר במגמה חיובית היום');
    assert.equal(markup, '<div>שוק המניות נסחר במגמה חיובית היום</div>');
  });

  check('SPX (index cash ticker) keeps its existing Finviz ETF-proxy link, unaffected by this fix', () => {
    const markup = render('SPX closed higher');
    assert.ok(markup.includes('https://finviz.com/quote.ashx?t=SPY'), markup);
  });
} finally {
  await server.close();
}

console.log(`\nLinkedMarketText fallback QA: ${count} checks passed`);
