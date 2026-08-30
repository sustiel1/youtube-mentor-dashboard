/**
 * Best-effort parser for individually-saved "🏭 סקטורים" rows.
 *
 * Saved text shape — from MarketSectorTable.jsx's normalizeSectorTableRow(),
 * the ONE row-normalizer shared by both real producers
 * (MacroGemDashboard.jsx's MacroSectorsSection and MorningBriefPanels.jsx):
 *   noteText = [note, reason].filter(Boolean).join(' · ')
 *   rowText  = [sector, sentimentLabel, noteText].filter(Boolean).join(' · ')
 *
 * Unlike indices (several independent producers, genuinely ambiguous segment
 * order — see marketRowText.js) and stocks (embedded label:value tags, a
 * sentiment-inference substring bug — see stockRowText.js), sectors have a
 * single shared normalizer and a fixed segment order. There is no ordering
 * ambiguity to resolve, so this parser always treats segment 0 as the sector
 * name and never returns null for non-empty text — a "does this look like a
 * sector" gate would only add false rejections, not safety, here.
 *
 * (A row that turns out not to be sector-shaped at all — e.g. an unrelated
 * saved item sharing this section's heading text by coincidence — still
 * renders coherently: its first segment just won't resolve to a known ETF via
 * resolveSectorTableFinvizLink, and the sector cell falls back to plain text,
 * exactly like the live table does for an unmapped sector name.)
 */
export function parseSectorRowFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const parts = text.split('·').map((segment) => segment.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const [sector, sentimentRaw = null, ...rest] = parts;
  const note = rest.join(' · ') || null;

  return { sector, sentimentRaw, note };
}
