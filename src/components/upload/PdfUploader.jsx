// ── PdfUploader ──────────────────────────────────────────────────────────────
// Renders a single "📄 העלה PDF" button.
// When clicked: opens file picker → extracts text with pdfjs-dist →
// calls onDocumentCreated(doc) with a video-schema-compatible object.
//
// pdfjs-dist is loaded lazily (dynamic import) only when the user clicks the
// button — so it does NOT bloat the initial bundle.

import { useRef, useState } from "react";
import { toast } from "sonner";

// ── Lazy loader ──────────────────────────────────────────────────────────────
// Imports pdfjs-dist dynamically on first use. Subsequent calls reuse the
// already-loaded module (import() is cached by the browser/bundler).
async function getPdfjsLib() {
  const pdfjsLib = await import("pdfjs-dist");
  // Worker URL must match the installed version to avoid API mismatch errors
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  return pdfjsLib;
}

// ── Text extraction ──────────────────────────────────────────────────────────
// Reads all pages and joins their text into a single string.
// Returns { text: string, pageCount: number }
async function extractPdfText(file) {
  const pdfjsLib = await getPdfjsLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;
  const pages = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Each item.str is a text fragment; join with space, collapse whitespace
    const pageText = content.items
      .map((item) => item.str)
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (pageText) pages.push(pageText);
  }

  return { text: pages.join("\n\n"), pageCount };
}

// ── Record builder ───────────────────────────────────────────────────────────
// Creates an object that looks like a video to VideoDetailPanel and localVideoStore.
// contentType:"pdf" is the only new field — everything else reuses existing fields.
function buildDocumentRecord(file, text, pageCount) {
  const title = file.name
    .replace(/\.pdf$/i, "")   // strip extension
    .replace(/[_-]+/g, " ")   // underscores/dashes → spaces
    .trim();
  const now = new Date().toISOString();

  return {
    id: `pdf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,

    // NEW field — tells the app this is a document, not a YouTube video
    contentType: "pdf",

    title,
    originalFileName: file.name,   // kept for display in VideoDetailPanel (Phase 3)

    // Fake URL — used for dedup in the store; must be unique per upload
    url: `pdf://local/${encodeURIComponent(file.name)}_${Date.now()}`,

    pdfPages: pageCount,   // shown in VideoDetailPanel (Phase 3)

    // Store extracted text as "transcript" — feeds directly into AI analysis
    transcript: text,
    manualTranscript: text,

    fetchedAt: now,
    addedAt: now,
    addedManually: true,
    isPermanent: false,
    analysisStatus: "not_analyzed",
  };
}

// ── Component ────────────────────────────────────────────────────────────────
// Props:
//   onDocumentCreated(doc) — called with the built record after successful parse
export function PdfUploader({ onDocumentCreated }) {
  const inputRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFile = async (file) => {
    if (!file || file.type !== "application/pdf") {
      toast.error("יש לבחור קובץ PDF בלבד");
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading(`מעבד ${file.name}…`);

    try {
      const { text, pageCount } = await extractPdfText(file);

      // Guard: scanned-image PDFs have no extractable text
      if (!text || text.trim().length < 50) {
        toast.dismiss(toastId);
        toast.warning(
          "ה-PDF לא מכיל טקסט שניתן לחלץ — ייתכן שמדובר ב-PDF סרוק עם תמונות בלבד"
        );
        setIsProcessing(false);
        return;
      }

      const doc = buildDocumentRecord(file, text, pageCount);

      toast.dismiss(toastId);
      toast.success(
        `PDF נטען — ${pageCount} עמודים, ${Math.round(text.length / 1000)}K תווים`
      );
      onDocumentCreated?.(doc);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(`שגיאה בטעינת ה-PDF: ${err.message || "שגיאה לא ידועה"}`);
      console.error("[PdfUploader]", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Hidden file input — triggered programmatically */}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          // Reset value so re-uploading the same file works
          e.target.value = "";
        }}
      />

      {/* Visible button — same visual language as "הוסף סרטון" */}
      <button
        type="button"
        disabled={isProcessing}
        onClick={() => inputRef.current?.click()}
        title="העלה מסמך PDF — הטקסט יחולץ ויוצג כ-transcript לניתוח AI"
        className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300 dark:hover:bg-orange-500/20"
      >
        <span>{isProcessing ? "⏳" : "📄"}</span>
        <span className="whitespace-nowrap">
          {isProcessing ? "מעבד…" : "העלה PDF"}
        </span>
      </button>
    </>
  );
}
