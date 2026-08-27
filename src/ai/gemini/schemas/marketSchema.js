/**
 * JSON schema example for market/trading content analysis.
 */
export function getMarketSchemaExample({ chaptersTarget = 4 } = {}) {
  const timedNarrativeItem = {
    text: '...',
    timestampSeconds: null,
    estimatedStartSeconds: null,
    estimatedEndSeconds: null,
    timestampKind: null,
    timestampSource: null,
    timestampConfidence: null,
    sourceQuote: null,
  };
  const chapters = Array.from({ length: Math.min(chaptersTarget, 3) }, (_, i) => ({
    title: '...',
    startSeconds: i * 150,
    endSeconds: (i + 1) * 150,
    summary: '...',
    keyPoints: [timedNarrativeItem],
  }));
  return JSON.stringify({
    contentType: 'market',
    shortSummary: '...',
    fullSummary: '...',
    keyPoints: [timedNarrativeItem],
    chapters,
    mainLesson: '...',
    keyInsights: [timedNarrativeItem],
    usefulKnowledge: [timedNarrativeItem],
    stocksMentioned: ['AAPL', 'SPY'],
    tradingSetups: [timedNarrativeItem],
    tradingRules: [timedNarrativeItem],
    riskRules: [timedNarrativeItem],
    keyLevels: ['...'],
    indicators: ['...'],
    marketConditions: ['...'],
    actionItems: [timedNarrativeItem],
    warnings: [timedNarrativeItem],
    tags: ['...'],
  }, null, 2);
}
