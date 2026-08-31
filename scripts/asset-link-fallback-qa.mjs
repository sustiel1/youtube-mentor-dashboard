// QA for the "Asset link resolution — provider fallback rule" documented in
// .claude/agents/frontend-rtl-developer.md: Finviz default for individual
// equities, il.investing.com fallback (specific page or site-search) for
// everything else — never a guessed slug, never unlinked plain text.
//
// Covers src/utils/finvizLinks.js's getExternalSymbolUrl(), the only piece
// of this rule that exists on `main` today (analysisTickerLinks.js /
// AnalysisTickerLink.jsx / marketEntityLinkResolver.js do not exist on this
// branch yet — see the WORK-ID TRADINGBRAIN-LINKS-INVESTING-FALLBACK report).
//
//   node scripts/asset-link-fallback-qa.mjs

import assert from 'node:assert/strict';
import { getExternalSymbolUrl } from '../src/utils/finvizLinks.js';

let count = 0;
const check = (name, fn) => { fn(); count += 1; console.log(`  ok  ${name}`); };

// ── Individual equities still go to Finviz ───────────────────────────────────
check('a real US equity ticker resolves to Finviz', () => {
  assert.equal(getExternalSymbolUrl('NVDA'), 'https://finviz.com/quote.ashx?t=NVDA');
});

check('a known sector/index ETF ticker resolves to Finviz', () => {
  assert.equal(getExternalSymbolUrl('XLK'), 'https://finviz.com/quote.ashx?t=XLK');
  assert.equal(getExternalSymbolUrl('SPY'), 'https://finviz.com/quote.ashx?t=SPY');
});

check('index cash tickers still route to their existing Finviz ETF proxy (unchanged design)', () => {
  assert.equal(getExternalSymbolUrl('SPX'), 'https://finviz.com/quote.ashx?t=SPY');
  assert.equal(getExternalSymbolUrl('NDX'), 'https://finviz.com/quote.ashx?t=QQQ');
});

// ── REGRESSION: bare non-equity codes must not slip through resolveFinvizTicker's
// generic "1-6 uppercase letters = a valid ticker" rule and produce a broken
// Finviz page before ever reaching the il.investing.com fallback. ──────────────
for (const [symbol, expectedUrl] of [
  ['DXY', 'https://il.investing.com/indices/usdollar'],
  ['BTC', 'https://il.investing.com/crypto/bitcoin/btc'],
  ['ETH', 'https://il.investing.com/crypto/ethereum/eth-usd'],
  ['VIX', 'https://il.investing.com/indices/volatility-s-p-500'],
]) {
  check(`REGRESSION: bare uppercase "${symbol}" routes to il.investing.com, not a broken Finviz page`, () => {
    assert.equal(getExternalSymbolUrl(symbol), expectedUrl);
  });
  check(`lowercase "${symbol.toLowerCase()}" resolves the same as the bare uppercase form`, () => {
    assert.equal(getExternalSymbolUrl(symbol.toLowerCase()), expectedUrl);
  });
}

check('a full descriptive phrase for a mapped macro instrument also resolves to its il.investing.com page', () => {
  assert.equal(getExternalSymbolUrl('US Dollar Index'), 'https://il.investing.com/indices/usdollar');
  assert.equal(getExternalSymbolUrl('bonds10y'), 'https://il.investing.com/rates-bonds/u.s.-10-year-bond-yield');
});

// ── Macro indicators named directly in the fallback rule text ────────────────
for (const code of ['PPI', 'CPI', 'PCE', 'NFP', 'GDP', 'FOMC', 'FED']) {
  check(`macro indicator code "${code}" never produces a broken Finviz link, resolves to il.investing.com search`, () => {
    const url = getExternalSymbolUrl(code);
    assert.ok(url.startsWith('https://il.investing.com/'), `${code} -> ${url}`);
    assert.equal(url, `https://il.investing.com/search/?q=${code}`);
  });
}

// ── Fear & Greed: the one explicit, documented exception to the rule ────────
check('Fear & Greed keeps its exact real CNN landing page (no il.investing.com equivalent exists)', () => {
  assert.equal(getExternalSymbolUrl('fear & greed'), 'https://edition.cnn.com/markets/fear-and-greed');
  assert.equal(getExternalSymbolUrl('fear and greed'), 'https://edition.cnn.com/markets/fear-and-greed');
});

// ── Never unlinked for non-empty input ───────────────────────────────────────
check('an arbitrary unmapped macro-sounding phrase still resolves to a real il.investing.com search URL, never null', () => {
  const url = getExternalSymbolUrl('some unmapped macro concept');
  assert.ok(url && url.startsWith('https://il.investing.com/search/?q='), url);
});

check('empty input returns null (nothing to link), not a broken URL', () => {
  assert.equal(getExternalSymbolUrl(''), null);
  assert.equal(getExternalSymbolUrl(null), null);
});

console.log(`\nasset link fallback QA: ${count} checks passed`);
