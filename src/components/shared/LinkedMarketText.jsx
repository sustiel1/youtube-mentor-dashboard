import { segmentMarketLinkText } from '@/lib/marketLinkText';

/**
 * Renders only registry-verified market identities as external links.
 * Unknown or ambiguous text remains unchanged, and aliases are matched only at
 * Unicode letter/number boundaries.
 */
export function renderLinkedMarketText(text) {
  if (typeof text !== 'string' || text.length === 0) return text;
  const segments = segmentMarketLinkText(text);
  if (!segments.some((segment) => segment.type === 'link')) return text;

  return segments.map((segment, index) => {
    if (segment.type !== 'link') return segment.text;
    const { destination } = segment;
    const ltr = /^[A-Z0-9./& -]+$/i.test(segment.text);
    return (
      <a
        key={`market-link-${index}`}
        href={destination.url}
        target="_blank"
        rel="noopener noreferrer"
        dir={ltr ? 'ltr' : undefined}
        title={`פתח ${destination.destinationSymbol} ב-${destination.provider}`}
        className="font-semibold underline decoration-dotted hover:decoration-solid"
        onClick={(event) => event.stopPropagation()}
        data-market-link={destination.destinationSymbol}
      >
        {segment.text}
      </a>
    );
  });
}
