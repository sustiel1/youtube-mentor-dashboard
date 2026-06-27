# GEM Chapter Timestamp Reliability

## Overview

Chapters shown in the Chapters tab may originate from different sources. Understanding
the difference between **chapter quality** (title accuracy) and **timestamp reliability**
is essential for correct display and future improvements.

---

## Chapter Sources

| `chapterSource` | Origin | Badge shown |
|---|---|---|
| `gem` | Gemini AI analysis (`universalTabs.chapters`) | 🔵 AI / GEM |
| `gemini` / `gems_analysis` | Gemini saved analysis | 🔵 AI |
| `transcript` / `saved` | Claude AI saved analysis | 🔵 AI |
| `transcript_topic_heuristic` | Local heuristic (topic boundary detection) | 🟠 משוער |
| `transcript_heuristic` | Local heuristic (equal-chunk fallback) | 🟠 משוער |
| `description_timestamp` | YouTube description timestamps | 🟢 זמן מדויק |

The AI/GEM badge represents **chapter source**, not timestamp reliability.
A chapter may have an accurate title but an estimated timestamp.

---

## `isEstimated` — Timestamp Reliability Flag

`isEstimated: true` means the timestamp shown may not reflect the exact moment
the speaker transitions to that topic in the video. The title may still be accurate.

`isEstimated: false` means the timestamp was either read directly from the transcript
or came from a verified source.

---

## `timestampSource` Values

| Value | Meaning |
|---|---|
| `gem` | Timestamp was provided by Gemini in the GEM output and appears reliable |
| `missing` | No timestamp was provided; chapter has no `startSeconds` |
| `estimated_proportional` | All GEM timestamps are evenly spaced — likely AI-estimated, not transcript-based |
| `transcript_matched` | (future) Timestamp was refined by matching chapter to actual transcript segment |

---

## Even-Spacing Detection (`markEstimatedIfEvenlySpaced`)

When Gemini generates chapters without access to a timed transcript, it sometimes
assigns timestamps proportionally (e.g. equal time per chapter). This is detectable:

- Collect all valid `startSeconds` from GEM chapters.
- Calculate gaps between chapters.
- If **all** gaps are within 8% of the average gap and there are ≥4 timestamps,
  mark the entire set as `isEstimated: true, timestampSource: 'estimated_proportional'`.

**Conservative threshold:** a 70s vs 120s gap variation (as seen in real topic-change
videos) will NOT be marked as evenly spaced. Only truly uniform distributions trigger this.

---

## Missing Timestamp Refinement (`matchChaptersToTranscript`)

When GEM chapters are missing `startSeconds` (`timestampSource: 'missing'`) and
transcript segments are available on the video object, `matchChaptersToTranscript`
is applied to assign real timestamps from the closest matching transcript line.

This runs at display time — it does not modify stored data.

---

## What This Fix Does NOT Do

- Does not regenerate or rewrite chapter titles.
- Does not change the `displayChapters` priority order.
- Does not modify the AI/GEM badge (it remains accurate — it represents source, not reliability).
- Does not affect YouTube description timestamp chapters.
- Does not affect local heuristic chapters.

---

## Implementation Location

- `markEstimatedIfEvenlySpaced()` — `VideoDetailPanel.jsx` (before `normalizeGemChapters`)
- `normalizeGemChapters()` — sets `isEstimated` and `timestampSource` per chapter
- `gemChapters` useMemo — applies `matchChaptersToTranscript` for missing timestamps
- `ChapterItem.jsx` — displays `~משוער` indicator when `isEstimated: true`
