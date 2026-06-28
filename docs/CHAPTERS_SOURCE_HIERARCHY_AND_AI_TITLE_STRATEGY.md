# Chapters Source Hierarchy and AI Title Strategy

**Status:** Final project rule — do not deviate without explicit team decision.
**Last updated:** 2026-06-28

---

## Purpose

This document defines the authoritative source hierarchy for the Chapters tab, the metadata model for each source, the behavior of every chapter-related button, and the rules that govern AI title enhancement.

The core product decision is:

> **Creator-provided YouTube description chapters are the most trusted source and must always be the highest priority when they exist.**

AI may improve chapter titles only — it must never replace creator-provided timestamps, chapter order, or source attribution.

---

## Final Hierarchy

| Priority | Source | Description | Badge |
|---|---|---|---|
| **1** | YouTube description (creator-provided) | Timestamp chapters explicitly written by the video creator/mentor in the YouTube description | `YouTube / תיאור הסרטון` |
| **2** | Full-text description block | Full description text available through the full-text block, not direct YouTube metadata. Must parse identical timestamp format. | `תיאור הסרטון` |
| **3** | Transcript-based chapters | Real topic transitions extracted from the timed transcript. Not equal slicing. | `תמלול` |
| **4** | GEM / Gemini chapters | AI-generated chapters from Gemini analysis. May have estimated timestamps. | `🔵 AI / GEM` |
| **5** | Base / fallback chapters | Last resort — equal-chunk fallback or minimal placeholder structure. | `🟠 משוער` |

---

## Decision Tree

```
Are valid creator-provided YouTube description chapters available?
│
├─ YES → Use as active chapters.
│        chapterSource: 'youtube_description'
│        Badge: YouTube / תיאור הסרטון
│        Button state: filled green
│        Stop here.
│
└─ NO → Continue.
         │
         Are valid timestamp chapters in a full-text description block?
         │
         ├─ YES → Use as active chapters.
         │        chapterSource: 'description_block'
         │        Badge: תיאור הסרטון
         │        Stop here.
         │
         └─ NO → Continue.
                  │
                  Can the transcript produce real topic-based chapters (not equal slices)?
                  │
                  ├─ YES → Use transcript chapters.
                  │        chapterSource: 'transcript'
                  │        isEstimated: false
                  │        Stop here.
                  │
                  └─ NO → Continue.
                           │
                           Do GEM / AI chapters exist?
                           │
                           ├─ YES → Use GEM chapters.
                           │        chapterSource: 'gem'
                           │        isEstimated: per chapter
                           │        Stop here.
                           │
                           └─ NO → Use base fallback chapters.
                                   chapterSource: 'base'
                                   isEstimated: true
```

---

## Metadata Model

### 1. Creator-provided YouTube description chapters

```js
{
  chapterSource: 'youtube_description',
  timestampSource: 'youtube_description',
  titleSource: 'creator_description',
  isEstimated: false,
  timeSource: 'real',
}
```

### 2. AI-enhanced titles on top of YouTube timestamps

When the user clicks "צור כותרות דרך AI" and YouTube description chapters are the active source:

```js
{
  chapterSource: 'youtube_description',      // unchanged — still creator-provided
  timestampSource: 'youtube_description',    // unchanged — timestamps not touched
  titleSource: 'ai_enhanced',
  originalTitleSource: 'creator_description',
  isEstimated: false,                        // timestamps remain real
  timeSource: 'real',
}
```

Badges in this state:
- Main badge: `YouTube / תיאור הסרטון`
- Secondary note: `כותרות שופרו עם AI`

**AI must not change:** `startSeconds`, chapter order, `chapterSource`, `timestampSource`, or `isEstimated`.

### 3. Full-text description block chapters

```js
{
  chapterSource: 'description_block',
  timestampSource: 'description_block',
  titleSource: 'description_block',
  isEstimated: false,
  timeSource: 'real',
}
```

### 4. Transcript chapters

```js
{
  chapterSource: 'transcript',
  timestampSource: 'transcript',
  titleSource: 'transcript_topic',
  isEstimated: false,   // true if equal-slice fallback was used
  timeSource: 'real',
}
```

### 5. GEM / Gemini chapters

```js
{
  chapterSource: 'gem',
  timestampSource: 'gem' | 'estimated_proportional' | 'missing',
  titleSource: 'gem',
  isEstimated: boolean,  // true if timestampSource === 'estimated_proportional'
  timeSource: 'real' | undefined,
}
```

### 6. Base / fallback

```js
{
  chapterSource: 'base',
  timestampSource: 'estimated',
  titleSource: 'base',
  isEstimated: true,
  timeSource: 'estimated',
}
```

---

## Validation Rules for Creator-Provided Timestamps

A valid creator-provided timestamp chapter set must satisfy all of the following:

- Has at least **2** timestamp rows.
- Timestamps are **strictly increasing** (each row is later than the previous).
- Each row has a usable title (not empty after trimming).
- Timestamps in disclaimers, ads, affiliate links, or legal boilerplate must be **ignored** (detection heuristic: label text contains "אין ייעוץ פיננסי", "Disclaimer", "Sponsored", "http", etc.).
- Supports **Hebrew / RTL** titles without corruption.
- Supports all common timestamp formats:

| Format | Example |
|---|---|
| `M:SS Title` | `0:22 מייקל ברי חיסל חצי שורט` |
| `MM:SS Title` | `09:05 ניתוח מניות` |
| `H:MM:SS Title` | `1:23:45 סיכום` |
| `0:00 Title` (zero anchor) | `0:00 פתיחה` |
| `• M:SS Title` | `• 4:42 נושא נוסף` |
| `Title - M:SS` | `פתיחה - 0:00` |
| `Title M:SS` | `פתיחה 0:00` |

Regex must handle all variants above. A timestamp-only row without a title (e.g., a bare `0:00`) may be included if at least 2 other rows in the same block have titles.

---

## Button Behavior

### Button: `📋 פרקי YouTube`

- **Action:** Pull creator-provided timestamp chapters from the YouTube description.
  - Step 1: Check `video.description`, `videoProp.description`, `youtubeChapterCache`.
  - Step 2 (if no local description): Auto-fetch from YouTube via the dev proxy (`/api/youtube-video-metadata`), extract `shortDescription`, cache result.
  - Step 3: Parse timestamps using the validation rules above.
- **On success:**
  - Save chapters with `chapterSource: 'youtube_description'`.
  - Make them the active chapter source (overrides GEM/transcript).
  - Fill the button with solid green (active/loaded state).
  - Show badge: `YouTube / תיאור הסרטון`.
  - Toast: `הפרקים מהתיאור נטענו בהצלחה (N פרקים)`.
- **On failure (no description found):**
  - Toast: `לא נמצא תיאור מלא לסרטון`.
- **On failure (description found, no valid timestamps):**
  - Toast: `נמצא תיאור, אבל לא נמצאו פרקי זמן תקינים`.
- **Button state when already loaded:** Filled green, label stays `📋 פרקי YouTube`.

### Button: `בדוק פרקים אוטומטית`

- **Action:** Check all reliable non-AI sources in priority order.
- **Rules:**
  - Must check YouTube description timestamps **first** (priority 1).
  - Must **not** prefer GEM over creator-provided timestamps.
  - If YouTube description chapters exist and are valid → use them and stop.
  - Otherwise cascade through the decision tree above.
- **Badge:** Reflects the winning source.

### Button: `צור כותרות דרך AI`

- **Action:** Generate or improve chapter titles using AI.
- **Critical rule:** If YouTube description timestamps exist as the active source:
  - AI must **preserve** all `startSeconds` values exactly.
  - AI must **preserve** chapter order exactly.
  - AI must **not** change `chapterSource`, `timestampSource`, or `isEstimated`.
  - AI output is a **title enhancement only**.
  - `titleSource` is updated to `'ai_enhanced'`.
  - `originalTitleSource` is set to `'creator_description'`.
- **Badge after AI enhancement:**
  - Main badge: `YouTube / תיאור הסרטון` (unchanged)
  - Secondary note: `כותרות שופרו עם AI`
- **When no YouTube description timestamps exist:** AI may generate full chapters normally, including timestamps.

---

## AI Title Enhancement Rules

| Rule | Detail |
|---|---|
| Preserve timestamps | `startSeconds` must be identical before and after enhancement |
| Preserve order | Chapter sequence must not change |
| Improve clarity | Hebrew titles may be cleaned, shortened, or made more accurate |
| No source override | `chapterSource` and `timestampSource` remain `'youtube_description'` |
| No badge change | Main badge stays `YouTube / תיאור הסרטון`, not `AI` |
| Secondary label | Add `כותרות שופרו עם AI` as a small secondary note |

**Example:**

```
Original:   0:22 — מייקל ברי חיסל חצי שורט על פלנטיר
AI output:  0:22 — מייקל ברי מצמצם שורט על פלנטיר

✅ Timestamp preserved: 0:22
✅ Order preserved
✅ Title improved (more precise Hebrew)
✅ Source stays: YouTube / תיאור הסרטון
```

---

## Badge Behavior Reference

| Chapter state | Main badge | Secondary note |
|---|---|---|
| YouTube description (creator, no AI) | `YouTube / תיאור הסרטון` | — |
| YouTube description + AI-enhanced titles | `YouTube / תיאור הסרטון` | `כותרות שופרו עם AI` |
| Full-text description block | `תיאור הסרטון` | — |
| Transcript chapters | `תמלול` | — |
| GEM chapters (real timestamps) | `🔵 GEM` | — |
| GEM chapters (estimated timestamps) | `🔵 GEM` | `~משוער` per chapter |
| Base / fallback | `🟠 משוער` | — |

---

## Debug Requirements

The chapter debug area (`showDebug` mode) must display:

| Field | Value shown |
|---|---|
| `activeChapterSource` | The winning `chapterSource` value |
| `timestampSource` | e.g., `youtube_description`, `gem`, `estimated_proportional` |
| `titleSource` | e.g., `creator_description`, `ai_enhanced`, `gem` |
| `titlesAiEnhanced` | `true` / `false` |
| `descriptionField` | Which field was used: `video.description` / `videoProp.description` / `cache` / `proxy` |
| `candidatesFound` | Number of raw timestamp rows found before validation |
| `validChapters` | Number of chapters after validation |
| `rejectionReason` | If validation failed: the specific reason (e.g., `"only 1 row"`, `"timestamps not increasing"`) |
| `ytId` | YouTube video ID used for proxy fetch |
| `cacheHit` | `true` if description came from `youtubeChapterCache` |

---

## Acceptance Criteria

- [ ] This document clearly states YouTube description chapters are priority #1.
- [ ] AI title generation is documented as title enhancement only when real timestamps exist.
- [ ] AI must preserve real timestamps — this is a hard rule, not a suggestion.
- [ ] GEM/AI remains fallback, not primary, when creator timestamps exist.
- [ ] Button behavior (all 3 buttons) is unambiguous.
- [ ] Source badges remain accurate after AI enhancement.
- [ ] Green filled state for "📋 פרקי YouTube" when chapters are successfully loaded.
- [ ] Secondary `כותרות שופרו עם AI` note does not replace the main badge.
- [ ] Debug section exposes all required fields.
- [ ] Validation rules handle all 7 timestamp formats listed.

---

## Architecture Concerns

1. **`AUTO_STRIP_FIELDS` strips `video.description` from localStorage.** This means description is not available on re-open unless it was cached in `youtubeChapterCache` or fetched fresh via the dev proxy. The dev proxy now returns `shortDescription` extracted from the YouTube page HTML — verify this works for private/age-restricted/live videos where HTML may differ.

2. **`shortDescription` may be truncated by YouTube for very long descriptions.** If a description exceeds YouTube's internal display limit, the `ytInitialPlayerResponse` may contain only the first portion. A future mitigation is to also check the `ytinitialdata` JSON blob in the same HTML for the expanded description.

3. **`fetchVideoDescription` cold path requires network.** If the user is offline or the proxy is unavailable, the "📋 פרקי YouTube" button will fail. The cache (24h TTL) is the offline fallback — it is only populated after the first successful fetch.

4. **Parser needs all 7 timestamp formats.** The current `extractTimestampsFromDescription` regex was designed for `M:SS Title`. It must be audited to confirm it handles `Title - M:SS` and `• M:SS Title` variants before these are documented as supported.

5. **Disclaimer timestamps.** A description may contain timestamps in a legal disclaimer section (e.g., "אין ייעוץ פיננסי 0:00"). The parser currently has no heuristic to exclude these. A future filter should reject rows whose label matches a known disclaimer pattern.

---

## Future Implementation Phases

| Phase | Scope |
|---|---|
| **Phase 1 (current)** | `shortDescription` extraction via dev proxy. "📋 פרקי YouTube" button with cache and fetch fallback. `chapterSource: 'youtube_description'` metadata. |
| **Phase 2** | Validate and extend timestamp parser to all 7 formats. Add disclaimer-row filter. |
| **Phase 3** | `titleSource: 'ai_enhanced'` — wire "צור כותרות דרך AI" to preserve timestamps when `chapterSource === 'youtube_description'`. Add secondary badge `כותרות שופרו עם AI`. |
| **Phase 4** | Debug section exposes all 9 required fields. |
| **Phase 5** | Handle `ytinitialdata` fallback for truncated `shortDescription`. Offline-mode UX for failed proxy fetch. |

---

## Rollback Strategy

If the dev proxy description extraction breaks:
- The `"📋 פרקי YouTube"` button will show `"לא נמצא תיאור מלא לסרטון"`.
- GEM chapters (priority 4) remain active — no regression in display.
- Rollback: revert the `shortDescription` extraction block in `vite.config.js` (`makeYouTubeVideoMetadataPlugin`).
- The `youtubeChapterCache` is unaffected and still serves cached descriptions.

If the chapter parser produces wrong chapters:
- The `descriptionChapters` field can be cleared by setting it to `[]` on the video entity.
- The fallback cascade will then use GEM or transcript chapters.
- No data loss — the YouTube description text is never modified by the parser.

---

## Related Documents

- [GEM Chapter Timestamp Reliability](GEM_CHAPTER_TIMESTAMP_RELIABILITY.md) — `isEstimated`, `timestampSource`, even-spacing detection.
- [AI Badge Rendering Rule](AI_BADGE_RENDERING_RULE.md) — badge display logic per source.
