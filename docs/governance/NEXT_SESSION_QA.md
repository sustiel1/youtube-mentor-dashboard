# Next Session QA Checklist

Baseline:
cleanup-baseline-2026-06-17

## Purpose

This document defines the next manual QA tasks after the repository cleanup baseline.

Do not start refactors from this checklist.
Do not perform repository cleanup from this checklist.
Use this only to validate real product behavior.

## Priority 1 — Validate fixes from the cleanup session

### QA Markdown Export

Steps:

1. Open a video with notes.
2. Export Markdown.
3. Open the downloaded `.md` file.

Expected:

* The file must not contain `[object Object]`.
* Video notes must appear correctly.
* Exported content should be readable Markdown.

Result:

* Pass / Fail:
* Notes:

### QA Brain Saved Indicator

Steps:

1. Open any tab with saveable knowledge items.
2. Save one item to Brain.
3. Verify the item state immediately after save.
4. Refresh the page.
5. Verify the saved state again.

Expected:

* The 🧠 action should change to `✓ נשמר`.
* The saved state should persist after refresh.

Result:

* Pass / Fail:
* Notes:

## Priority 2 — Validate previously suspected persistence/data issues

### QA Morning Brief Persistence

Steps:

1. Open at least 3 Morning Brief videos.
2. Generate or load Morning Brief analysis data.
3. Refresh the page.
4. Reopen the same videos.
5. Verify the Morning Brief data is still available.

Expected:

* Morning Brief data should persist after refresh.
* Data should load consistently by both video id and YouTube id when available.

Result:

* Pass / Fail:
* Notes:

### QA Chapters Timestamps

Steps:

1. Run a real GEM analysis that produces chapters.
2. Open the Chapters tab.
3. Check whether timestamps are displayed.
4. Compare displayed timestamps against the raw GEM output if available.

Expected:

* Chapters should display timestamps when GEM output includes timestamp fields.
* If timestamps are missing, capture the raw GEM chapter object shape.

Result:

* Pass / Fail:
* Notes:

## Product Decision

### SaveStatusPopover

Decision needed:

* Wire into BrainSelectableItem
* Wire into VideoDetailPanel
* Leave dormant for future use

Decision:

* Selected option:
* Reason:

## Success Criteria

This QA pass is complete when:

* Markdown export passes.
* Brain saved indicator passes.
* Morning Brief persistence is verified.
* Chapters timestamps are verified or the missing GEM data shape is captured.
* SaveStatusPopover decision is recorded.

Rules:

* If a test fails, document exact steps, expected behavior, actual behavior, screenshots if relevant, and suspected root cause.
* Do not fix code during the QA pass unless explicitly starting a new bug-fix batch.
* Keep changes minimal and documentation-only.
