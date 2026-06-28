# Chapter Source Priority Rule

## Goal
Use the most reliable chapter source by default.

## Source Priority

1. YouTube description timestamps
2. Manually triggered transcript chunk chapters
3. GEM / Gemini chapters
4. Saved AI analysis chapters
5. Transcript fallback chapters
6. Base chapters

## Rule
If valid timestamps exist in the YouTube description, they should be used as the default Chapters tab content.

## Why
Description timestamps are usually manually written or intentionally structured by the video creator, so they are often more accurate than AI-generated chapter boundaries.

## Requirements
- Description timestamps should be detected automatically when video metadata is available.
- The user should not need to click a manual detection button.
- GEM chapters should remain available as fallback.
- Source badge must accurately reflect the active chapter source.
- Do not show AI/GEM badge for YouTube description chapters.

## Valid Description Chapter Set
A valid description chapter set should:
- include at least 2 timestamps
- use increasing timestamps
- include usable chapter text
- avoid random isolated timestamps

## Non-goals
- Do not regenerate GEM titles.
- Do not delete AI chapters.
- Do not change unrelated tab behavior.
