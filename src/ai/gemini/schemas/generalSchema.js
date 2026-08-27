/**
 * JSON schema example for general/educational content analysis.
 * Extracted from vite.config.js geminiFullAnalysisJsonSchemaExample.
 */
export function getGeneralSchemaExample() {
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
  return JSON.stringify({
    shortSummary: '...',
    fullSummary: '...',
    keyPoints: [timedNarrativeItem],
    chapters: [
      {
        title: '...',
        startSeconds: 0,
        endSeconds: 120,
        summary: '...',
        keyPoints: ['...'],
      },
    ],
    mainLesson: '...',
    keyInsights: [timedNarrativeItem],
    rules: ['...'],
    actionItems: [timedNarrativeItem],
    mistakesToAvoid: ['...'],
    strategyOrMethod: '...',
    tags: ['...'],
    usefulKnowledge: [timedNarrativeItem],
    insights: ['...'],
    keyTakeaways: ['...'],
    sentiment: 'תיאור קצר של סנטימנט הדוברים/תוכן (חיובי, ניטרלי, ביקורתי, מעורר השראה, וכו׳)',
    tone: 'תיאור קצר של טון הדיבור (מקצועי, שיחתי, הומוריסטי, טכני, וכו׳)',
    actionableIdeas: ['...'],
    checklists: ['...'],
    warnings: ['...'],
    frameworks: ['...'],
    concepts: ['...'],
    thesis: ['...'],
    questions: ['...'],
  }, null, 2);
}
