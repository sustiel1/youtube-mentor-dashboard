import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const { default: ChapterItem } = await vite.ssrLoadModule('/src/components/dashboard/ChapterItem.jsx');
  const sources = [
    'description_timestamp',
    'gem',
    'ai_generated',
    'manual_transcript',
    'saved',
    'legacy',
  ];

  for (const source of sources) {
    const chapter = {
      id: `chapter-${source}`,
      title: `כותרת ${source}`,
      description: `תיאור ארוך שאסור להציג ${source}`,
      summary: `סיכום שאסור להציג ${source}`,
      keyPoints: [`נקודת מפתח שאסור להציג ${source}`],
      transcriptText: `קטע תמלול שאסור להציג ${source}`,
      transcriptSegmentCount: 4,
      confidence: 0.87,
      chapterSource: source,
      startSeconds: 0.56,
      timestampSource: 'verified',
    };
    const snapshot = structuredClone(chapter);
    const html = renderToStaticMarkup(React.createElement(ChapterItem, {
      variant: 'row',
      section: chapter,
      playerRef: { current: { seekTo() {}, playVideo() {} } },
      videoUrl: 'https://www.youtube.com/watch?v=test',
    }));

    assert.match(html, new RegExp(`כותרת ${source}`));
    assert.match(html, /00:00/);
    assert.doesNotMatch(html, /תיאור ארוך/);
    assert.doesNotMatch(html, /סיכום שאסור/);
    assert.doesNotMatch(html, /נקודת מפתח/);
    assert.doesNotMatch(html, /קטע תמלול/);
    assert.doesNotMatch(html, /confidence/);
    assert.deepEqual(chapter, snapshot, `rendering must not mutate ${source} chapter metadata`);
  }

  const untimed = {
    title: 'פרק ללא תזמון',
    description: 'המידע נשמר באובייקט אך אינו מוצג',
    transcriptText: 'תמלול נסתר',
  };
  const untimedHtml = renderToStaticMarkup(React.createElement(ChapterItem, {
    variant: 'row',
    section: untimed,
    playerRef: { current: { seekTo() { throw new Error('untimed chapter must not seek'); } } },
    videoUrl: 'https://www.youtube.com/watch?v=test',
  }));
  assert.match(untimedHtml, /אין זמן זמין/);
  assert.doesNotMatch(untimedHtml, /<button/);
  assert.equal(untimed.description, 'המידע נשמר באובייקט אך אינו מוצג');
  assert.equal(untimed.transcriptText, 'תמלול נסתר');

  const decimalHtml = renderToStaticMarkup(React.createElement(ChapterItem, {
    variant: 'row',
    section: { title: 'תזמון עשרוני', startSeconds: 0.56 },
    playerRef: { current: { seekTo() {}, playVideo() {} } },
  }));
  assert.match(decimalHtml, /00:00/);
  assert.match(decimalHtml, /<button/);

  const zeroHtml = renderToStaticMarkup(React.createElement(ChapterItem, {
    variant: 'row',
    section: { title: 'תזמון אפס', startSeconds: 0 },
    playerRef: { current: { seekTo() {}, playVideo() {} } },
  }));
  assert.match(zeroHtml, /00:00/);
  assert.match(zeroHtml, /<button/);

  console.log(JSON.stringify({
    status: 'passed',
    sources: sources.length,
    visibleFields: ['checkbox-shell', 'title', 'timestamp-state'],
    hiddenMetadataPreserved: true,
    timedNavigation: true,
    untimedNavigation: false,
  }, null, 2));
} finally {
  await vite.close();
}
