import React, { useMemo, useState, useCallback } from "react";
import { extractRows } from "@/lib/rowExtraction";
import {
  createLocalStorageStore,
  saveAnnotations,
  deleteAnnotationsForVideo,
  indexAnnotationsForVideo,
  createRowTimestampResolver,
  ROW_TIMESTAMP_RESULT_STATUS,
} from "@/lib/rowTimestampSidecar";
import { buildStaticYouTubeTimestampLink, resolveStaticVideoTimestamp } from "@/lib/staticVideoTimestamp";
import { normalizeTimedNarrativeItem } from "@/ai/gemini/validators/timedNarrative";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TAB_LABELS = {
  summary: "סיכום",
  insights: "תובנות",
  "useful-knowledge": "ידע שימושי",
  specialized: "תוכן ייעודי",
};

const SECTION_LABELS = {
  keyPoints: "נקודות מפתח",
  keyInsights: "תובנות מרכזיות",
  rules: "כללים",
  actionItems: "פעולות לביצוע",
  mistakesToAvoid: "טעויות שכדאי להימנע מהן",
};

const STATUS_LABELS = {
  [ROW_TIMESTAMP_RESULT_STATUS.MAPPED]: "שויך",
  [ROW_TIMESTAMP_RESULT_STATUS.STALE]: "הטקסט השתנה",
  [ROW_TIMESTAMP_RESULT_STATUS.UNMATCHED]: "לא נמצא זמן אמין",
  [ROW_TIMESTAMP_RESULT_STATUS.ORPHAN]: "אין שורת תצוגה תואמת",
};

/**
 * Opt-in, per-video row-timestamp generator (WORK-ID YMD-ONDEMAND-ROW-TIMES).
 *
 * Deliberately self-contained: performs no network I/O itself. `generateFn`
 * is injected — in production it calls the dedicated
 * GenerateRowTimestamps Base44 function; in isolated QA it resolves a
 * canned fixture. This keeps the component testable without ever making a
 * real external call from inside this file.
 *
 * `store` defaults to the real localStorage-backed sidecar
 * (createLocalStorageStore) — pass a memory store for tests/previews.
 */
export default function RowTimestampGenerator({
  video,
  recordId: explicitRecordId = null,
  youtubeId,
  transcriptText,
  loadTranscriptFn,
  analysis,
  rowDescriptors = null,
  generateFn,
  store,
  onAnnotationsChanged,
  disabledReason = null,
}) {
  const sidecarStore = useMemo(() => store || createLocalStorageStore(), [store]);
  const recordId = explicitRecordId || video?.id || video?._id || null;

  const [status, setStatus] = useState("idle"); // idle | confirming | loading_transcript | loading | preview | no_evidence | error
  const [error, setError] = useState(null);
  const [previewRows, setPreviewRows] = useState([]); // [{...accepted, checked}]
  const [rejectedRows, setRejectedRows] = useState([]);
  const [coverage, setCoverage] = useState(null);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [storeVersion, setStoreVersion] = useState(0); // bumped after save/delete so existingCount re-reads the store
  const requestInFlightRef = React.useRef(false);
  const operationControllerRef = React.useRef(null);
  const resultsTriggerRef = React.useRef(null);
  const resultsCloseRef = React.useRef(null);

  const annotationIndex = useMemo(() => {
    if (!recordId) return new Map();
    return indexAnnotationsForVideo(sidecarStore, recordId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidecarStore, recordId, storeVersion]);

  const allRows = useMemo(() => {
    if (Array.isArray(rowDescriptors)) return rowDescriptors;
    return extractRows(analysis || {}).map((row) => ({
      ...row,
      legacyRowPath: row.rowPath,
      canonicalSourceText: row.text,
      renderable: true,
    }));
  }, [analysis, rowDescriptors]);
  const resolver = useMemo(
    () => createRowTimestampResolver(allRows, annotationIndex),
    [allRows, annotationIndex],
  );
  const resultRows = useMemo(
    () => resolver.classify(allRows),
    [resolver, allRows],
  );
  const rows = useMemo(
    () => resultRows.filter((row) => row.status !== ROW_TIMESTAMP_RESULT_STATUS.ORPHAN),
    [resultRows],
  );
  const mappedCount = resultRows.filter((row) => row.status === ROW_TIMESTAMP_RESULT_STATUS.MAPPED).length;
  const remainingCount = Math.max(0, rows.length - mappedCount);
  const existingCount = annotationIndex.size;

  const startConfirm = useCallback(() => {
    if (disabledReason) return;
    setError(null);
    setStatus("confirming");
  }, [disabledReason]);

  const cancelConfirm = useCallback(() => {
    setStatus("idle");
  }, []);

  const runGeneration = useCallback(async () => {
    if (disabledReason || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    const controller = new AbortController();
    operationControllerRef.current = controller;
    setError(null);
    try {
      let activeTranscript = typeof transcriptText === "string" ? transcriptText.trim() : "";
      if (!activeTranscript) {
        if (typeof loadTranscriptFn !== "function") {
          throw new Error("טעינת התמלול אינה זמינה כרגע. נסה שוב.");
        }
        setStatus("loading_transcript");
        const loaded = await loadTranscriptFn({
          video,
          youtubeId,
          signal: controller.signal,
        });
        activeTranscript = typeof loaded?.transcript === "string" ? loaded.transcript.trim() : "";
        if (!activeTranscript) {
          throw new Error("התמלול שהתקבל אינו מכיל זמנים אמינים. נסה שוב.");
        }
      }
      if (controller.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      setStatus("loading");
      const result = await generateFn({
        transcript: activeTranscript,
        rows: rows.map((r) => ({ rowPath: r.rowPath, text: r.text })),
        durationSeconds: video?.durationSeconds || 0,
        signal: controller.signal,
      });
      const accepted = Array.isArray(result?.accepted) ? result.accepted : [];
      const rejected = Array.isArray(result?.rejected) ? result.rejected : [];
      if (accepted.length === 0) {
        setPreviewRows([]);
        setRejectedRows(rejected);
        setCoverage(result?.staticTimeCoverage || null);
        setStatus("no_evidence");
        return;
      }
      setPreviewRows(accepted.map((a) => ({ ...a, checked: true })));
      setRejectedRows(rejected);
      setCoverage(result?.staticTimeCoverage || null);
      setStatus("preview");
    } catch (err) {
      setError(err?.name === "AbortError"
        ? "הפעולה בוטלה. אפשר לנסות שוב."
        : err?.message || "שגיאה לא ידועה");
      setStatus("error");
    } finally {
      requestInFlightRef.current = false;
      operationControllerRef.current = null;
    }
  }, [disabledReason, generateFn, loadTranscriptFn, transcriptText, rows, video, youtubeId]);

  const cancelOperation = useCallback(() => {
    operationControllerRef.current?.abort();
  }, []);

  const toggleRow = useCallback((rowPath) => {
    setPreviewRows((prev) => prev.map((r) => (r.rowPath === rowPath ? { ...r, checked: !r.checked } : r)));
  }, []);

  const savePreview = useCallback(() => {
    const currentRows = new Map(rows.map((row) => [row.rowPath, row]));
    const checked = previewRows.filter((annotation) => {
      const current = currentRows.get(annotation.rowPath);
      return annotation.checked && current?.fingerprint === annotation.fingerprint;
    });
    if (checked.length === 0) {
      setPreviewRows([]);
      setStatus("no_evidence");
      return;
    }
    saveAnnotations(sidecarStore, recordId, checked);
    setStatus("idle");
    setPreviewRows([]);
    setStoreVersion((v) => v + 1);
    onAnnotationsChanged?.();
  }, [previewRows, rows, sidecarStore, recordId, onAnnotationsChanged]);

  const cancelPreview = useCallback(() => {
    // Preview was never persisted (saveAnnotations was never called) —
    // discarding local state is the entire "cancel" operation.
    setStatus("idle");
    setPreviewRows([]);
    setRejectedRows([]);
  }, []);

  const deleteGenerated = useCallback(() => {
    deleteAnnotationsForVideo(sidecarStore, recordId);
    setResultsOpen(false);
    setStoreVersion((v) => v + 1);
    onAnnotationsChanged?.();
  }, [sidecarStore, recordId, onAnnotationsChanged]);

  const buttonLabel =
    status === "loading" ? "מכין זמנים…"
    : status === "preview" ? `נמצאו זמנים ל-${previewRows.length} מתוך ${rows.length} שורות`
    : existingCount > 0 ? "🕒 רענן זמנים"
    : "🕒 צור זמנים לשורות";

  const displayButtonLabel =
    status === "loading_transcript" ? "טוען תמלול…"
    : status === "loading" ? "יוצר זמנים..."
    : status === "preview" ? buttonLabel
    : existingCount > 0 ? "צור מחדש"
    : "🕒 צור זמנים לשורות";

  return (
    <div dir="rtl" data-testid="row-timestamp-generator" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="row-timestamp-trigger"
          aria-label={displayButtonLabel}
          aria-describedby={disabledReason ? "row-timestamp-disabled-reason" : undefined}
          disabled={status === "loading_transcript" || status === "loading" || rows.length === 0 || Boolean(disabledReason)}
          onClick={startConfirm}
          className="text-xs px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
        >
          {displayButtonLabel}
        </button>
        {existingCount > 0 && status === "idle" && (
          <button
            ref={resultsTriggerRef}
            type="button"
            data-testid="row-timestamp-results-trigger"
            aria-label={`הצג תוצאות שיוך זמנים: ${mappedCount} מתוך ${rows.length}`}
            onClick={() => setResultsOpen(true)}
            className="text-xs px-2 py-1.5 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            הצג זמנים · {mappedCount}/{rows.length}
          </button>
        )}
        {existingCount > 0 && status === "idle" && (
          <button
            type="button"
            data-testid="row-timestamp-delete"
            aria-label="מחק זמנים שנוצרו"
            onClick={deleteGenerated}
            className="text-xs px-2 py-1.5 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            מחק זמנים שנוצרו
          </button>
        )}
        {(status === "loading_transcript" || status === "loading") && (
          <button
            type="button"
            data-testid="row-timestamp-cancel-operation"
            aria-label="בטל טעינת תמלול ויצירת זמנים"
            onClick={cancelOperation}
            className="rounded border border-slate-300 px-2 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
          >
            ביטול
          </button>
        )}
      </div>

      <p data-testid="row-timestamp-association-summary" className="text-[11px] leading-snug text-slate-500 dark:text-zinc-400">
        שויכו {mappedCount} מתוך {rows.length} · נותרו {remainingCount}
      </p>

      {disabledReason && status === "idle" && (
        <p
          id="row-timestamp-disabled-reason"
          data-testid="row-timestamp-disabled-reason"
          className="text-[11px] leading-snug text-slate-500 dark:text-zinc-400"
        >
          {disabledReason}
        </p>
      )}

      {status === "confirming" && (
        <div data-testid="row-timestamp-confirm" role="alertdialog" aria-label="אישור יצירת זמנים" className="text-xs border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 rounded-md p-3 space-y-2">
          <p>רק הסרטון הנוכחי יעובד.</p>
          <p>הפעולה תשלח בקשת AI אחת ל-Claude/Anthropic ועשויה להיות בתשלום ולצרוך מכסת Base44. שליפת התמלול עצמה אינה משתמשת ב-AI.</p>
          <p>התוכן הקיים לא יוחלף.</p>
          <p>שורות ללא ראיה אמינה יישארו ללא קישור.</p>
          <div className="flex gap-2 pt-1">
            <button type="button" data-testid="row-timestamp-confirm-yes" onClick={runGeneration} className="px-2 py-1 rounded bg-amber-600 text-white">
              המשך
            </button>
            <button type="button" data-testid="row-timestamp-confirm-no" onClick={cancelConfirm} className="px-2 py-1 rounded border border-slate-300">
              ביטול
            </button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
          <p data-testid="row-timestamp-error">{error}</p>
          <button type="button" data-testid="row-timestamp-retry" onClick={startConfirm} className="rounded border border-red-300 px-2 py-1 font-semibold">
            נסה שוב
          </button>
        </div>
      )}

      {status === "no_evidence" && (
        <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
          <p data-testid="row-timestamp-no-evidence">לא נמצאו זמנים אמינים מספיק</p>
          <button type="button" data-testid="row-timestamp-no-evidence-retry" onClick={startConfirm} className="rounded border border-amber-300 px-2 py-1 font-semibold">
            נסה שוב
          </button>
        </div>
      )}

      {status === "preview" && (
        <div data-testid="row-timestamp-preview" className="text-xs border border-slate-200 dark:border-slate-700 rounded-md p-3 space-y-2 max-h-96 overflow-y-auto">
          {coverage && (
            <p data-testid="row-timestamp-coverage" className="text-slate-500">
              כיסוי תמלול: {coverage.analyzedSegments}/{coverage.totalSegments} ({coverage.status})
            </p>
          )}
          {previewRows.map((row) => {
            // Accepted annotation objects deliberately never carry a `text`
            // field (see rowTimestampAnnotation.js) — normalizeTimedNarrativeItem
            // needs one, so supply the row's own original text just for
            // this preview-link computation.
            const link = resolveStaticVideoTimestamp(normalizeTimedNarrativeItem({ ...row, text: row.rowText }));
            return (
              <label key={row.rowPath} data-testid="row-timestamp-preview-item" className="flex items-start gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <input
                  type="checkbox"
                  checked={row.checked}
                  onChange={() => toggleRow(row.rowPath)}
                  aria-label={`אשר זמן לשורה: ${row.rowText}`}
                />
                <span className="flex-1">
                  <span className="block text-slate-500">{row.tab}</span>
                  <span className="block">{row.rowText}</span>
                  <span className="block text-emerald-600 dark:text-emerald-400">
                    {link ? `▶ ≈${link.label}` : "אין ראיה מספקת"}
                  </span>
                  <span className="block text-slate-400 italic">"{row.sourceQuote}"</span>
                </span>
              </label>
            );
          })}
          {rejectedRows.length > 0 && (
            <p data-testid="row-timestamp-rejected-count" className="text-slate-400">
              {rejectedRows.length} שורות ללא ראיה מספקת לא הוצגו.
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" data-testid="row-timestamp-save" onClick={savePreview} className="px-2 py-1 rounded bg-emerald-600 text-white">
              שמור זמנים מאושרים
            </button>
            <button type="button" data-testid="row-timestamp-cancel" onClick={cancelPreview} className="px-2 py-1 rounded border border-slate-300">
              ביטול
            </button>
          </div>
        </div>
      )}

      <Dialog open={resultsOpen} onOpenChange={setResultsOpen}>
        <DialogContent
          dir="rtl"
          data-testid="row-timestamp-results-dialog"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            resultsCloseRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            resultsTriggerRef.current?.focus();
          }}
          className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden p-0 text-right"
        >
          <DialogHeader className="shrink-0 pl-12">
            <DialogTitle>תוצאות שיוך זמנים</DialogTitle>
            <DialogDescription data-testid="row-timestamp-results-summary">
              שויכו {mappedCount} מתוך {rows.length} · נותרו {remainingCount}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-4 py-3 sm:px-6">
            {resultRows.map((row) => {
              const mapped = row.status === ROW_TIMESTAMP_RESULT_STATUS.MAPPED;
              const link = mapped
                ? buildStaticYouTubeTimestampLink(youtubeId, {
                    estimatedStartSeconds: row.annotation.estimatedStartSeconds,
                    timestampKind: "estimated",
                  })
                : null;
              return (
                <article
                  key={row.rowPath}
                  data-testid="row-timestamp-result-row"
                  data-row-timestamp-status={row.status}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/70"
                >
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                        {TAB_LABELS[row.tab] || row.tab} · {SECTION_LABELS[row.field] || row.field}
                      </p>
                      <p className="mt-1 break-words text-sm leading-6 text-slate-800 dark:text-zinc-100">{row.text}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <span
                        data-testid="row-timestamp-result-status"
                        className={mapped
                          ? "text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                          : row.status === ROW_TIMESTAMP_RESULT_STATUS.STALE
                            ? "text-xs font-semibold text-amber-700 dark:text-amber-300"
                            : "text-xs font-semibold text-slate-500 dark:text-zinc-400"}
                      >
                        {STATUS_LABELS[row.status]}
                      </span>
                      {link ? (
                        <a
                          href={link.href}
                          target={link.target}
                          rel={link.rel}
                          aria-label={`שויך. ${link.ariaLabel}`}
                          data-testid="row-timestamp-result-link"
                          data-static-video-time="estimated"
                          dir="ltr"
                          className="inline-flex min-h-9 items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-xs font-semibold text-emerald-700 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                        >
                          ✓ {link.visibleLabel}
                        </a>
                      ) : null}
                    </div>
                  </div>
                  {row.annotation?.sourceQuote ? (
                    <details className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                      <summary className="cursor-pointer rounded-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">ציטוט מקור</summary>
                      <p className="mt-1 break-words italic">“{row.annotation.sourceQuote}”</p>
                    </details>
                  ) : null}
                </article>
              );
            })}
          </div>
          <div className="shrink-0 border-t border-slate-200 px-4 py-3 dark:border-zinc-800 sm:px-6">
            <DialogClose asChild>
              <button
                ref={resultsCloseRef}
                type="button"
                data-testid="row-timestamp-results-close"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-zinc-700 dark:text-zinc-200"
              >
                סגור
              </button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
