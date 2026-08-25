const DASH_VARIANTS_RE = /[\u2010-\u2015\u2212]/g;
const SINGLE_QUOTE_VARIANTS_RE = /[\u2018\u2019\u201A\u201B\u2032\u05F3]/g;
const DOUBLE_QUOTE_VARIANTS_RE = /[\u201C\u201D\u201E\u201F\u2033\u05F4]/g;

export function normalizeVideoTitleSearchText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(DASH_VARIANTS_RE, "-")
    .replace(SINGLE_QUOTE_VARIANTS_RE, "'")
    .replace(DOUBLE_QUOTE_VARIANTS_RE, '"')
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesVideoTitleSearch(title, query) {
  const normalizedQuery = normalizeVideoTitleSearchText(query);
  if (!normalizedQuery) return true;
  return normalizeVideoTitleSearchText(title).includes(normalizedQuery);
}
