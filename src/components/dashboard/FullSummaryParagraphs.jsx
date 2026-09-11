/**
 * Display-only renderer for the "📖 סיכום מלא" card body.
 * Breaks fullSummary text into readable paragraphs without editing the text
 * itself, and isolates embedded Latin/number runs so Hebrew RTL bidi
 * ordering does not scramble them (e.g. "P/E", "revenue growth", "24.05.2026").
 * Scoped to this one card only — does not touch SUMMARY_LEAD_CLASS or
 * CollapsibleFullSummary, which the מבזק בוקר/ערב briefing views rely on.
 */

// Splits text into paragraph strings. Existing newlines win; otherwise
// sentences are grouped 1-2 at a time. No word is added, removed, or reordered.
function splitIntoParagraphs(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];

  if (trimmed.includes('\n')) {
    return trimmed
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  const sentences = trimmed
    .split(/(?<=[.!?])\s+(?=\S)/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 2) return [trimmed];

  const paragraphs = [];
  for (let i = 0; i < sentences.length; i += 2) {
    paragraphs.push(sentences.slice(i, i + 2).join(' '));
  }
  return paragraphs;
}

// Matches runs of Latin letters/digits, allowing inline connectors (. , / % - : ( ) $ &)
// only *between* two alnum characters (e.g. "P/E", "24.05.2026") — never trailing —
// so a connector glued to a following Hebrew word (e.g. "Allocation-ו") is left outside
// the isolated run instead of being swallowed into it.
const LATIN_TOKEN = '[A-Za-z0-9]+(?:[%$.,/&()+:_-][A-Za-z0-9]+)*';
const LATIN_RUN_REGEX = new RegExp(`${LATIN_TOKEN}(?:[ \\t]+${LATIN_TOKEN})*`, 'g');

// Wraps each Latin/number run in <bdi dir="ltr"> (native bidi isolation) so it
// renders in the correct internal order regardless of the surrounding Hebrew text.
function renderWithBidiIsolation(paragraph, keyPrefix) {
  const nodes = [];
  let lastIndex = 0;
  let idx = 0;
  let match;
  LATIN_RUN_REGEX.lastIndex = 0;
  while ((match = LATIN_RUN_REGEX.exec(paragraph)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(paragraph.slice(lastIndex, match.index));
    }
    nodes.push(
      <bdi key={`${keyPrefix}-${idx++}`} dir="ltr">
        {match[0]}
      </bdi>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < paragraph.length) {
    nodes.push(paragraph.slice(lastIndex));
  }
  return nodes;
}

const PARAGRAPH_CLASS =
  'text-base sm:text-[1.05rem] font-medium leading-[1.8] text-slate-900 dark:text-zinc-100 text-right max-w-[70ch]';

export function FullSummaryParagraphs({ text, dataSectionContent }) {
  const paragraphs = splitIntoParagraphs(text);
  if (paragraphs.length === 0) return null;

  return (
    <div className="space-y-4" data-section-content={dataSectionContent}>
      {paragraphs.map((paragraph, i) => (
        <p key={i} className={PARAGRAPH_CLASS}>
          {renderWithBidiIsolation(paragraph, `p${i}`)}
        </p>
      ))}
    </div>
  );
}
