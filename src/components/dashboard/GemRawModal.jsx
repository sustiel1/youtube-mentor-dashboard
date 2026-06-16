import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

// ── helpers ────────────────────────────────────────────────────────────────

function safeStr(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v, null, 2);
}

function countItems(v) {
  if (v == null) return 0;
  if (Array.isArray(v)) return v.length;
  if (typeof v === "object") return Object.keys(v).length;
  if (typeof v === "string") return v.trim() ? 1 : 0;
  return v ? 1 : 0;
}

function isEmpty(v) {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v).length === 0;
  if (typeof v === "string") return !v.trim();
  return false;
}

function renderValue(v) {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.length ? v : null;
  if (typeof v === "object") return Object.keys(v).length ? v : null;
  return null;
}

// ── copy helpers ─────────────────────────────────────────────────────────

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast.success("הועתק")).catch(() => toast.error("שגיאת העתקה"));
}

function sectionToMarkdown(section) {
  const lines = [`## ${section.emoji} ${section.label}`];
  if (section.sourcePath) lines.push(`_מקור: \`${section.sourcePath}\`_`);
  if (section.items && section.items.length > 0) {
    lines.push(`**${section.items.length} פריטים:**`);
    section.items.forEach((item, i) => {
      lines.push(`${i + 1}. ${safeStr(item)}`);
    });
  } else if (section.raw != null) {
    lines.push(safeStr(section.raw));
  }
  return lines.join("\n");
}

// ── field extraction ──────────────────────────────────────────────────────

function getDeep(obj, path) {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((acc, key) => (acc != null ? acc[key] : undefined), obj);
}

function pickFirst(sources, paths) {
  for (const path of paths) {
    for (const src of sources) {
      const v = getDeep(src, path);
      if (v != null && !isEmpty(v)) return { value: v, path };
    }
  }
  return null;
}

// ── GEM section definitions ───────────────────────────────────────────────

const SECTION_DEFS = [
  {
    key: "summary",
    emoji: "📝",
    label: "Summary",
    paths: [
      "summary", "shortSummary", "fullSummary", "aiSummary",
      "gemSummary", "briefSummary", "executiveSummary",
    ],
  },
  {
    key: "insights",
    emoji: "💡",
    label: "Insights",
    paths: [
      "top5Insights", "learningInsights", "keyInsights", "insights",
      "conclusions", "keyTakeaways", "findings",
    ],
  },
  {
    key: "knowledge",
    emoji: "🧠",
    label: "Knowledge",
    paths: [
      "reusableKnowledge", "keyPoints", "mainPoints", "knowledgePoints",
      "atomicKnowledge", "fundamentalKnowledge",
    ],
  },
  {
    key: "marketOverview",
    emoji: "📈",
    label: "Market Overview",
    paths: [
      "marketOverview", "overview", "marketSummary", "spx", "nasdaq",
    ],
  },
  {
    key: "news",
    emoji: "📰",
    label: "News / Headlines",
    paths: [
      "marketNews", "headlines", "news", "topStories", "catalysts",
    ],
  },
  {
    key: "indices",
    emoji: "📊",
    label: "Indices / Markets",
    paths: [
      "indices", "indexPerformance", "indexData", "keyLevels", "sectorRotation",
    ],
  },
  {
    key: "macro",
    emoji: "🌍",
    label: "Macro",
    paths: [
      "macroFactors", "macro", "macroEvents", "macroHighlights", "economicEvents",
    ],
  },
  {
    key: "watchlist",
    emoji: "🎯",
    label: "Watchlist / Stocks",
    paths: [
      "stocksMentioned", "watchlist", "stocksToWatch", "topStocks", "stockPicks",
    ],
  },
  {
    key: "risks",
    emoji: "⚠️",
    label: "Risks",
    paths: [
      "risks", "riskFactors", "warnings", "redFlags", "weakPoints",
    ],
  },
  {
    key: "opportunities",
    emoji: "💡",
    label: "Opportunities",
    paths: [
      "opportunities", "tradingOpportunities", "buyOpportunities",
    ],
  },
  {
    key: "calendar",
    emoji: "📅",
    label: "Calendar / Events",
    paths: [
      "calendar", "economicCalendar", "events", "upcomingEvents", "schedule",
    ],
  },
  {
    key: "sentiment",
    emoji: "😊",
    label: "Sentiment",
    paths: [
      "sentiment", "marketSentiment", "sentimentAnalysis", "marketMood", "fearGreed",
    ],
  },
  {
    key: "app",
    emoji: "🚀",
    label: "APP Builder",
    paths: [
      "appBuilding", "dashboardIdeas", "newIndicators", "components",
    ],
  },
  {
    key: "topics",
    emoji: "🏷️",
    label: "Topics / Tags",
    paths: [
      "topics", "tags", "categories", "keywords", "mainTopic",
    ],
  },
];

// ── build sections from data ──────────────────────────────────────────────

function buildSections(sources, rawParsedGems) {
  const builtSections = [];
  const coveredPaths = new Set();

  for (const def of SECTION_DEFS) {
    const result = pickFirst(sources, def.paths);
    if (result) {
      coveredPaths.add(result.path);
      const v = result.value;
      builtSections.push({
        ...def,
        sourcePath: result.path,
        raw: v,
        items: Array.isArray(v) ? v : (typeof v === "object" ? Object.entries(v).map(([k, val]) => `${k}: ${safeStr(val)}`) : [safeStr(v)]),
        count: countItems(v),
        populated: !isEmpty(v),
      });
    } else {
      builtSections.push({
        ...def,
        sourcePath: null,
        raw: null,
        items: [],
        count: 0,
        populated: false,
      });
    }
  }

  // ── find unmapped fields ───────────────────────────────────────────────
  const allKnownPaths = new Set(SECTION_DEFS.flatMap((d) => d.paths));
  const unmappedFields = {};
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    for (const [k, v] of Object.entries(src)) {
      if (!allKnownPaths.has(k) && !coveredPaths.has(k) && !isEmpty(v)) {
        if (!(k in unmappedFields)) unmappedFields[k] = v;
      }
    }
  }
  if (Object.keys(unmappedFields).length > 0) {
    builtSections.push({
      key: "unmapped",
      emoji: "🔓",
      label: "Unmapped Fields",
      sourcePath: "(לא ממופה)",
      raw: unmappedFields,
      items: Object.entries(unmappedFields).map(([k, v]) => `${k}: ${safeStr(v)}`),
      count: Object.keys(unmappedFields).length,
      populated: true,
    });
  }

  // ── raw JSON section ──────────────────────────────────────────────────
  if (rawParsedGems) {
    builtSections.push({
      key: "rawJson",
      emoji: "🧾",
      label: "Raw JSON",
      sourcePath: "parsedGemsJson",
      raw: rawParsedGems,
      items: [],
      count: Object.keys(rawParsedGems).length,
      populated: true,
      isRawJson: true,
    });
  }

  return builtSections;
}

// ── SectionRow ────────────────────────────────────────────────────────────

function SectionRow({ section }) {
  const [open, setOpen] = useState(false);

  const handleCopy = () => {
    copyText(sectionToMarkdown(section));
  };

  const badgeCls = section.populated
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
    : "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500";

  return (
    <div className="border border-slate-200 dark:border-zinc-700/80 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">{section.emoji}</span>
          <span className="text-sm font-semibold text-slate-800 dark:text-zinc-100 truncate">{section.label}</span>
          {section.sourcePath && (
            <code className="text-[10px] text-slate-400 dark:text-zinc-500 truncate hidden sm:inline">
              {section.sourcePath}
            </code>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeCls}`}>
            {section.populated ? section.count : "—"}
          </span>
          {section.populated && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleCopy(); }}
              title="העתק סקציה"
              className="text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors text-xs px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700 hover:border-slate-400"
            >
              📋
            </button>
          )}
          <span className="text-slate-400 text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-zinc-800 px-4 py-3 bg-slate-50/60 dark:bg-zinc-900/40">
          {!section.populated && (
            <p className="text-xs text-slate-400 dark:text-zinc-500 text-right">⚪ שדה ריק / לא נמצא</p>
          )}
          {section.populated && section.isRawJson && (
            <pre className="text-[11px] text-slate-700 dark:text-zinc-300 whitespace-pre-wrap break-all leading-5 max-h-80 overflow-y-auto">
              {JSON.stringify(section.raw, null, 2)}
            </pre>
          )}
          {section.populated && !section.isRawJson && section.items.length > 0 && (
            <ul className="space-y-1.5 text-right" dir="rtl">
              {section.items.map((item, i) => (
                <li key={i} className="text-sm text-slate-700 dark:text-zinc-200 leading-relaxed border-r-2 border-slate-200 dark:border-zinc-700 pr-3">
                  {typeof item === "object" ? JSON.stringify(item, null, 2) : String(item)}
                </li>
              ))}
            </ul>
          )}
          {section.populated && !section.isRawJson && section.items.length === 0 && section.raw != null && (
            <pre className="text-[11px] text-slate-700 dark:text-zinc-300 whitespace-pre-wrap break-all leading-5">
              {safeStr(section.raw)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ── GemRawModal ───────────────────────────────────────────────────────────

export function GemRawModal({ open, onClose, video, marketBriefData }) {
  const [filterEmpty, setFilterEmpty] = useState(true);

  const rawParsedGems = useMemo(() => {
    if (!video?.id) return null;
    const stored = localStorage.getItem(`gems-paste-${video.id}`);
    if (!stored) return null;
    try { return JSON.parse(stored); } catch { return null; }
  }, [video?.id, open]);

  const sources = useMemo(() => {
    const list = [];
    if (marketBriefData && typeof marketBriefData === "object") list.push(marketBriefData);
    if (video?.marketBriefData && typeof video.marketBriefData === "object" && video.marketBriefData !== marketBriefData) list.push(video.marketBriefData);
    if (video?.analysis && typeof video.analysis === "object") list.push(video.analysis);
    if (rawParsedGems && typeof rawParsedGems === "object") list.push(rawParsedGems);
    if (video && typeof video === "object") list.push(video);
    return list;
  }, [marketBriefData, video, rawParsedGems]);

  const sections = useMemo(() => buildSections(sources, rawParsedGems), [sources, rawParsedGems]);

  const totalFields = sections.length;
  const populatedFields = sections.filter((s) => s.populated).length;
  const emptyFields = totalFields - populatedFields;

  const displayed = filterEmpty ? sections.filter((s) => s.populated) : sections;

  const handleCopyAll = () => {
    const md = sections.filter((s) => s.populated).map(sectionToMarkdown).join("\n\n---\n\n");
    copyText(md);
  };

  const handleExportMarkdown = () => {
    const lines = [
      `# GEM RAW — ${video?.title || "ללא כותרת"}`,
      `_${new Date().toLocaleString("he-IL")}_`,
      "",
      "---",
      "",
    ];
    sections.filter((s) => s.populated).forEach((s) => {
      lines.push(sectionToMarkdown(s));
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gem-raw-${video?.id || "video"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const out = {};
    sections.filter((s) => s.populated && !s.isRawJson).forEach((s) => {
      out[s.key] = s.raw;
    });
    if (rawParsedGems) out._rawGems = rawParsedGems;
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gem-raw-${video?.id || "video"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full p-0 gap-0 overflow-hidden" dir="rtl">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-200 dark:border-zinc-700/80">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
              <span>🔬</span>
              <span>GEM RAW — נתונים מחולצים</span>
            </DialogTitle>
          </div>
          {/* Stats bar */}
          <div className="mt-2 flex flex-wrap gap-3 text-xs" dir="rtl">
            <span className="rounded-full bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 font-semibold text-slate-600 dark:text-zinc-300">
              סה"כ שדות: <strong>{totalFields}</strong>
            </span>
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-1 font-semibold text-emerald-700 dark:text-emerald-300">
              ✅ מאוכלסים: <strong>{populatedFields}</strong>
            </span>
            <span className="rounded-full bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 font-semibold text-slate-400 dark:text-zinc-500">
              ⚪ ריקים: <strong>{emptyFields}</strong>
            </span>
            {rawParsedGems && (
              <span className="rounded-full bg-violet-100 dark:bg-violet-900/40 px-2.5 py-1 font-semibold text-violet-700 dark:text-violet-300">
                💎 GEMS JSON נטען
              </span>
            )}
          </div>
          {/* Action buttons */}
          <div className="mt-3 flex flex-wrap gap-2 items-center" dir="rtl">
            <button
              type="button"
              onClick={handleCopyAll}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              📋 העתק הכל
            </button>
            <button
              type="button"
              onClick={handleExportMarkdown}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 dark:bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-zinc-600 transition-colors"
            >
              📄 Export Markdown
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              📦 Export JSON
            </button>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 cursor-pointer select-none mr-auto">
              <input
                type="checkbox"
                checked={filterEmpty}
                onChange={(e) => setFilterEmpty(e.target.checked)}
                className="rounded"
              />
              הסתר ריקים
            </label>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="px-4 py-4 space-y-2">
            {displayed.length === 0 && (
              <div className="flex min-h-[120px] items-center justify-center text-sm text-slate-400 dark:text-zinc-500">
                אין נתוני GEM זמינים עבור הסרטון הזה
              </div>
            )}
            {displayed.map((section) => (
              <SectionRow key={section.key} section={section} />
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
