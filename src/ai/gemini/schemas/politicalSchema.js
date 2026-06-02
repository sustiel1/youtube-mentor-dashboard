/**
 * JSON schema example for political content analysis.
 * Extracted from vite.config.js geminiPoliticalJsonSchemaExample.
 */
export function getPoliticalSchemaExample({ chaptersTarget = 4 } = {}) {
  const chapters = Array.from({ length: Math.min(chaptersTarget, 3) }, (_, i) => ({
    title: '...',
    startSeconds: i * 120,
    endSeconds: (i + 1) * 120,
    summary: '...',
  }));
  return JSON.stringify({
    contentType: 'political',
    shortSummary: '...',
    mainClaim: '...',
    speakerPosition: '...',
    arguments: ['...'],
    weakPoints: ['...'],
    counterArguments: ['...'],
    socialMediaReplies: ['...'],
    keyPoints: ['...'],
    tags: ['...'],
    networkSlogans: [
      { text: '...', tone: 'חד/אירוני/רגשי/ענייני/מחאתי', useCase: 'תגובה קצרה/פוסט/כותרת/תגובת נגד', sourceIdea: '...' },
    ],
    politicalSlogans: [
      { text: '...', tone: 'רגשי/חד/מחאתי/ענייני/אירוני', confidence: 94, sourceIdea: '...' },
    ],
    viralQuotes: ['...'],
    debateResponses: ['...'],
    commentBank: ['...'],
    chapters,
  }, null, 2);
}
