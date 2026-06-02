/**
 * JSON schema example for market/trading content analysis.
 */
export function getMarketSchemaExample({ chaptersTarget = 4 } = {}) {
  const chapters = Array.from({ length: Math.min(chaptersTarget, 3) }, (_, i) => ({
    title: '...',
    startSeconds: i * 150,
    endSeconds: (i + 1) * 150,
    summary: '...',
    keyPoints: ['...'],
  }));
  return JSON.stringify({
    contentType: 'market',
    shortSummary: '...',
    fullSummary: '...',
    keyPoints: ['...'],
    chapters,
    mainLesson: '...',
    stocksMentioned: ['AAPL', 'SPY'],
    tradingSetups: ['...'],
    tradingRules: ['...'],
    riskRules: ['...'],
    keyLevels: ['...'],
    indicators: ['...'],
    marketConditions: ['...'],
    actionItems: ['...'],
    warnings: ['...'],
    tags: ['...'],
  }, null, 2);
}
