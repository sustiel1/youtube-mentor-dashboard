/**
 * JSON schema example for general/educational content analysis.
 * Extracted from vite.config.js geminiFullAnalysisJsonSchemaExample.
 */
export function getGeneralSchemaExample() {
  return JSON.stringify({
    shortSummary: '...',
    fullSummary: '...',
    keyPoints: ['...'],
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
    keyInsights: ['...'],
    rules: ['...'],
    actionItems: ['...'],
    mistakesToAvoid: ['...'],
    strategyOrMethod: '...',
    tags: ['...'],
    usefulKnowledge: ['...'],
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
