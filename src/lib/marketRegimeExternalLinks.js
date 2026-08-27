export const FINVIZ_MARKET_MAP_LINK = Object.freeze({
  id: 'market-map',
  url: 'https://finviz.com/map',
  ariaLabel: 'פתיחת מפת השוק של Finviz',
});

const FINVIZ_HOME_URL = 'https://finviz.com/';

const MARKET_REGIME_LINKS_BY_KEY = Object.freeze({
  summary: {
    id: 'market-summary',
    url: FINVIZ_HOME_URL,
    ariaLabel: 'פתיחת סיכום מצב השוק ב־Finviz',
  },
  breadth: {
    id: 'market-breadth',
    url: FINVIZ_HOME_URL,
    ariaLabel: 'פתיחת נתוני רוחב השוק ב־Finviz',
  },
  generalmood: {
    id: 'general-mood',
    url: 'https://finviz.com/stock?t=SPY',
    ariaLabel: 'פתיחת מצב השוק הכללי של SPY ב־Finviz',
  },
});

const KEY_ALIASES = Object.freeze({
  summary: 'summary',
  marketsummary: 'summary',
  briefsummary: 'summary',
  executivesummary: 'summary',
  breadth: 'breadth',
  marketbreadth: 'breadth',
  breadthindicator: 'breadth',
  generalmood: 'generalmood',
  overallmood: 'generalmood',
});

const LABEL_ALIASES = Object.freeze({
  'סיכום מצב השוק': 'summary',
  'רוחב שוק': 'breadth',
  'מצב רוח כללי': 'generalmood',
  'general mood': 'generalmood',
});

function compactKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Presentation-only resolver. Stable source keys win; labels support legacy cards. */
export function resolveMarketRegimeRowLink(card) {
  const stableKey = KEY_ALIASES[compactKey(card?.key)];
  const labelKey = LABEL_ALIASES[String(card?.label || '').trim().toLowerCase()];
  return MARKET_REGIME_LINKS_BY_KEY[stableKey || labelKey] || null;
}
