import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panelsSource = readFileSync(
  new URL('../src/components/dashboard/MorningBriefPanels.jsx', import.meta.url),
  'utf8',
);
const primitivesSource = readFileSync(
  new URL('../src/components/dashboard/MorningBriefVisualPrimitives.jsx', import.meta.url),
  'utf8',
);

const investingUrl = 'https://il.investing.com/news';
const reutersUrl = 'https://www.reuters.com/markets/';
const linksBlockStart = panelsSource.indexOf('const NEWS_EXTERNAL_SOURCES');
const newsSectionStart = panelsSource.indexOf('export function NewsSection', linksBlockStart);
const nextSectionStart = panelsSource.indexOf('function mergeMacroDisplayRows', newsSectionStart);
const newsLinksSource = panelsSource.slice(linksBlockStart, newsSectionStart);
const newsSectionSource = panelsSource.slice(newsSectionStart, nextSectionStart);

assert.ok(panelsSource.includes(`url: '${investingUrl}'`));
assert.ok(panelsSource.includes(`url: '${reutersUrl}'`));
assert.equal(panelsSource.includes('utm_'), false);
assert.ok(panelsSource.includes("visibleLabel: 'חדשות בעברית'"));
assert.ok(panelsSource.includes("sourceLabel: 'Investing ישראל'"));
assert.ok(panelsSource.includes("visibleLabel: 'חדשות מהעולם'"));
assert.ok(panelsSource.includes("sourceLabel: 'Reuters'"));
assert.ok(panelsSource.includes("ariaLabel: 'פתיחת חדשות כלכלה ושוק ההון באתר Investing.com ישראל'"));
assert.ok(panelsSource.includes("ariaLabel: 'פתיחת חדשות השווקים בעולם באתר Reuters'"));
assert.equal(newsLinksSource.match(/<a/g)?.length, 2);
assert.equal(newsLinksSource.match(/target="_blank"/g)?.length, 2);
assert.equal(newsLinksSource.match(/rel="noopener noreferrer"/g)?.length, 2);
assert.equal(newsLinksSource.match(/onClick=\{\(event\) => event\.stopPropagation\(\)\}/g)?.length, 2);
assert.ok(newsLinksSource.includes('href={NEWS_EXTERNAL_SOURCES[0].url}'));
assert.ok(panelsSource.includes('data-news-heading-link'));
assert.ok(panelsSource.includes('data-news-source-links'));
assert.ok(panelsSource.includes('data-news-source={source.key}'));
assert.ok(newsSectionSource.includes('title={<NewsSectionHeadingLink />}'));
assert.ok(newsSectionSource.includes('headerLinks={<NewsExternalSourceLinks />}'));
assert.ok(panelsSource.includes('flex min-w-0 flex-wrap items-center gap-2'));
assert.ok(panelsSource.includes('focus-visible:ring-2'));
assert.ok(panelsSource.includes('dark:hover:bg-indigo-950/30'));

assert.ok(primitivesSource.includes('headerLinks,'));
assert.ok(primitivesSource.includes("'flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-x-3'"));
assert.ok(primitivesSource.includes("'flex min-w-0 flex-wrap items-center justify-between gap-2 md:shrink-0 md:justify-start'"));
assert.ok(primitivesSource.includes('{headerLinks}'));

assert.ok(newsSectionSource.includes("sectionSelectAllItems={!edit.editing ? resolveMorningBriefSectionChildItems(bulkSections, 'news') : null}"));
assert.ok(newsSectionSource.includes('headerActions={edit.headerActions}'));
assert.ok(newsSectionSource.includes('<MorningBriefNewsSection'));

console.log('news source links QA: 29 assertions passed');
