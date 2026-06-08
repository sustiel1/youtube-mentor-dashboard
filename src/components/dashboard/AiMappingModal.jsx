import { useMemo } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogPortal } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { extractVideoTabItems } from "@/config/videoTabsConfig";
import { getKnowledgeItems } from "@/lib/localKnowledgeItemStore";

// ── Learning fields → target tab ──────────────────────────────────────────────
const LEARNING_FIELD_TO_TAB = {
  definitions:       "definitions",
  concepts:          "definitions",
  indicators:        "indicators",
  setups:            "setups",
  tradingSetups:     "setups",
  patterns:          "patterns",
  tradingPatterns:   "patterns",
  checklists:        "checklists",
  mistakesToAvoid:   "mistakes",
  warnings:          "mistakes",
  riskRules:         "mistakes",
  brainHighlights:   "trading-brain",
  tradingPrinciples: "trading-brain",
  mentalModels:      "trading-brain",
  keyInsights:       "trading-brain",
  mainLesson:        "trading-brain",
  usefulKnowledge:   "useful-knowledge",
  keyTakeaways:      "useful-knowledge",
  actionItems:       "useful-knowledge",
};

// ── Market brief fields → target tab ────────────────────────────────────────
const BRIEF_FIELD_TO_TAB = {
  // market-news
  marketNews:           "market-news",
  headlines:            "market-news",
  news:                 "market-news",
  topStories:           "market-news",
  snapshot:             "market-news",
  marketOverview:       "market-news",  // object → flattened to strings
  catalysts:            "market-news",
  // indices
  indices:              "indices",
  indexPerformance:     "indices",
  indexData:            "indices",
  keyLevels:            "indices",
  sectorRotation:       "indices",
  // brief-macro
  macro:                "brief-macro",
  macroEvents:          "brief-macro",
  macroHighlights:      "brief-macro",
  macroContext:         "brief-macro",
  economicContext:      "brief-macro",
  economicEvents:       "brief-macro",
  macroFactors:         "brief-macro",
  // brief-sentiment
  sentiment:            "brief-sentiment",
  marketSentiment:      "brief-sentiment",
  sentimentAnalysis:    "brief-sentiment",
  marketMood:           "brief-sentiment",
  fearGreed:            "brief-sentiment",
  // brief-calendar
  calendar:             "brief-calendar",
  economicCalendar:     "brief-calendar",
  events:               "brief-calendar",
  upcomingEvents:       "brief-calendar",
  schedule:             "brief-calendar",
  // stocks-mentioned
  stocks:               "stocks-mentioned",
  stocksMentioned:      "stocks-mentioned",
  watchlist:            "stocks-mentioned",
  tickers:              "stocks-mentioned",
  watchlistLevels:      "stocks-mentioned",
  // brief-risks
  risks:                "brief-risks",
  warnings:             "brief-risks",
  riskFactors:          "brief-risks",
  // brief-opportunities
  opportunities:        "brief-opportunities",
  tradingOpportunities: "brief-opportunities",
  trades:               "brief-opportunities",
  // brief-conclusions
  reusableKnowledge:    "brief-conclusions",
  actionChecklist:      "brief-conclusions",
  conclusions:          "brief-conclusions",
  keyTakeaways:         "brief-conclusions",
  top5Insights:         "brief-conclusions",
  learningInsights:     "brief-conclusions",
  // chapters (shown in chapters tab if exists)
  chapters:             "chapters",
  // obsidian / meta — useful-knowledge is the best tab
  obsidianTopics:       "useful-knowledge",
};

const ALL_KNOWN_FIELDS = new Set([
  ...Object.keys(LEARNING_FIELD_TO_TAB),
  ...Object.keys(BRIEF_FIELD_TO_TAB),
]);

const INTERNAL_SKIP = new Set([
  "topicIds","transcriptSegments","attachedDocuments","videoTopics","topics",
  "analysisChunks","quotes","slogans","debateResponses","politicalSlogans",
  "viralQuotes","stocksMentioned","marketConditions","keyLevels",
  "opportunities","risks","chapters","videoTopicsRaw",
]);

const TAB_LABEL = {
  "summary":             "סיכום",
  "chapters":            "פרקים",
  "useful-knowledge":    "ידע שימושי",
  "definitions":         "מושגים",
  "indicators":          "אינדיקטורים",
  "setups":              "סטאפים",
  "patterns":            "פטרנים",
  "checklists":          "צ'קליסטים",
  "mistakes":            "טעויות",
  "trading-brain":       "מוח המסחר",
  "ai-analysis":         "ניתוח AI",
  "market-news":         "כותרות",
  "indices":             "שווקים",
  "brief-macro":         "אירועי מאקרו",
  "brief-sentiment":     "סנטימנט שוק",
  "brief-calendar":      "לוח כלכלי",
  "stocks-mentioned":    "רשימת מעקב",
  "brief-risks":         "סיכונים",
  "brief-opportunities": "הזדמנויות",
  "brief-conclusions":   "מסקנות למסחר",
  "political":           "פוליטי",
};

// ── Shared UI components ───────────────────────────────────────────────────────

function SectionHeader({ children }) {
  return (
    <h3 className="mb-3 border-b border-slate-100 pb-1.5 text-sm font-semibold text-slate-800 dark:border-zinc-800 dark:text-zinc-200">
      {children}
    </h3>
  );
}

function StatusPill({ count }) {
  return count > 0 ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
      ✓ {count}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-400 dark:bg-zinc-800 dark:text-zinc-500">
      ריק
    </span>
  );
}

function MetaRow({ label, value }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-slate-50 py-1 last:border-0 dark:border-zinc-800/60">
      <span className="w-48 shrink-0 text-xs text-slate-400 dark:text-zinc-500">{label}</span>
      <span className="break-all text-sm text-slate-800 dark:text-zinc-200">{value || "—"}</span>
    </div>
  );
}

function DataTable({ headers, rows, borderColor = "border-slate-100 dark:border-zinc-800", headBg = "bg-slate-50 dark:bg-zinc-900", dividerColor = "divide-slate-50 dark:divide-zinc-800/60" }) {
  return (
    <div className={`overflow-hidden rounded-xl border ${borderColor}`}>
      <table className="w-full text-sm">
        <thead className={headBg}>
          <tr className="text-right">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-2.5 font-semibold text-slate-600 dark:text-zinc-400 first:pr-4 last:pl-4">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className={`divide-y ${dividerColor}`}>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-2.5 align-top first:pr-4 last:pl-4">{cell}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="px-4 py-3 text-center text-sm italic text-slate-400 dark:text-zinc-500">אין נתונים</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function countArr(obj, key) {
  const v = obj?.[key];
  return Array.isArray(v) ? v.length : (typeof v === 'string' && v.trim() ? 1 : 0);
}

/**
 * DEV-only modal: shows how AI/GEM output was extracted and mapped into UI tabs.
 */
export function AiMappingModal({
  open,
  onOpenChange,
  video,
  videoType,
  visibleTabDefinitions,
  category,
  subCategory,
  normalizedSubCategory,
  selectedTabsConfigKey,
  gemRec,
  marketBriefData,
}) {
  const v  = video || {};
  const a  = v.analysis || {};
  const al = a.learning || {};

  // ── §1 Tab Mapping ──────────────────────────────────────────────────────
  const tabMapping = useMemo(() => {
    if (!Array.isArray(visibleTabDefinitions)) return [];
    return visibleTabDefinitions.map(tab => {
      const items = extractVideoTabItems(v, tab.value, marketBriefData);
      return { value: tab.value, label: tab.label || TAB_LABEL[tab.value] || tab.value, count: items.length };
    });
  }, [v, visibleTabDefinitions, marketBriefData]);

  // ── §2a Learning field mapping ──────────────────────────────────────────
  const learningFieldMapping = useMemo(() =>
    Object.entries(LEARNING_FIELD_TO_TAB).map(([field, targetTab]) => {
      const flat  = countArr(v, field);
      const ana   = countArr(a, field);
      const learn = countArr(al, field);
      const count = flat || ana || learn;
      const source = flat   > 0 ? "video"
                   : ana   > 0 ? "analysis"
                   : learn > 0 ? "analysis.learning"
                   : null;
      return { field, count, source, targetLabel: TAB_LABEL[targetTab] || targetTab };
    }),
  [v, a, al]);

  // ── §2b Market brief field mapping ─────────────────────────────────────
  const briefFieldMapping = useMemo(() => {
    if (!marketBriefData) return [];
    return Object.entries(BRIEF_FIELD_TO_TAB).map(([field, targetTab]) => {
      const count = countArr(marketBriefData, field);
      return { field, count, targetLabel: TAB_LABEL[targetTab] || targetTab };
    }).filter(r => r.count > 0);
  }, [marketBriefData]);

  // ── §3 Raw video field scanner ─────────────────────────────────────────
  const rawVideoFields = useMemo(() => {
    const found = [];
    const scan = (obj, prefix) => {
      Object.entries(obj || {}).forEach(([key, val]) => {
        if (Array.isArray(val) && val.length > 0) {
          found.push({ key: `${prefix}${key}`, count: val.length, mapped: ALL_KNOWN_FIELDS.has(key) });
        }
      });
    };
    scan(v, "");
    scan(a, "analysis.");
    scan(al, "analysis.learning.");
    return found.sort((a, b) => b.count - a.count);
  }, [v, a, al]);

  // ── §4 Market brief data raw keys ──────────────────────────────────────
  const rawBriefFields = useMemo(() => {
    if (!marketBriefData) return [];
    return Object.entries(marketBriefData).map(([key, val]) => ({
      key,
      count: Array.isArray(val) ? val.length : (val && typeof val === 'object' ? Object.keys(val).length : (val ? 1 : 0)),
      isArray: Array.isArray(val),
      mapped: key in BRIEF_FIELD_TO_TAB,
    })).filter(r => r.count > 0).sort((a, b) => b.count - a.count);
  }, [marketBriefData]);

  // ── §5 Unmapped fields ──────────────────────────────────────────────────
  const droppedFields = useMemo(() => {
    const dropped = [];
    const scan = (obj, prefix) => {
      Object.entries(obj || {}).forEach(([key, val]) => {
        if (Array.isArray(val) && val.length > 0 && !ALL_KNOWN_FIELDS.has(key) && !INTERNAL_SKIP.has(key)) {
          dropped.push({ field: `${prefix}${key}`, count: val.length });
        }
      });
    };
    scan(v, "");
    scan(a, "analysis.");
    scan(al, "analysis.learning.");
    return dropped;
  }, [v, a, al]);

  // ── §6 Brain items ──────────────────────────────────────────────────────
  const brainItems = useMemo(() => {
    const vid = v.id || v.videoId;
    if (!vid) return [];
    try { return getKnowledgeItems().filter(i => i.videoId === vid || i.sourceId === vid); }
    catch { return []; }
  }, [v]);

  const totalTabItems  = tabMapping.reduce((s, r) => s + r.count, 0);
  const activeLearning = learningFieldMapping.filter(r => r.count > 0).length;
  const activeBrief    = briefFieldMapping.length;
  const totalActive    = activeLearning + activeBrief;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[360] bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          dir="rtl"
          onPointerDownOutside={e => e.preventDefault()}
          className="fixed left-[50%] top-[50%] z-[370] flex max-h-[90vh] w-full max-w-[800px] translate-x-[-50%] translate-y-[-50%] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-zinc-800">
            <div>
              <DialogPrimitive.Title className="text-base font-bold text-slate-900 dark:text-zinc-100">
                🗺️ AI Mapping
              </DialogPrimitive.Title>
              <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-500">
                {totalActive} שדות פעילים · {totalTabItems} פריטים בסך הכל
                {marketBriefData && <span className="mr-2 rounded-full bg-sky-50 px-2 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">📈 Market Brief</span>}
              </p>
            </div>
            <DialogPrimitive.Close className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="overflow-y-auto px-6 py-5 space-y-7">

            {/* §0 Classification */}
            <section>
              <SectionHeader>🏷️ סיווג הסרטון</SectionHeader>
              <div className="rounded-xl border border-slate-100 px-4 py-2 dark:border-zinc-800">
                <MetaRow label="קטגוריה" value={category} />
                <MetaRow label="תת-קטגוריה" value={subCategory} />
                <MetaRow label="תת-קטגוריה מנורמלת" value={normalizedSubCategory} />
                <MetaRow label="contentType" value={v.contentType || a.contentType} />
                <MetaRow label="סוג סרטון (detected)" value={videoType} />
                <MetaRow label="מפתח טאבים (tabsKey)" value={selectedTabsConfigKey} />
                <MetaRow label="ספק AI" value={v.analysisProvider} />
                <MetaRow label="Market Brief בזיכרון?" value={marketBriefData ? `✅ כן — contentType: ${marketBriefData.contentType || '—'}` : "❌ לא"} />
                <MetaRow label="GEM מומלץ" value={gemRec ? `${gemRec.gemIcon || ""} ${gemRec.gemLabel || gemRec.gemKey || "—"} · ${Math.round(gemRec.confidencePct || 0)}% ביטחון` : undefined} />
              </div>
            </section>

            {/* §1 Tab Mapping */}
            <section>
              <SectionHeader>📑 מיפוי טאבים — מה כל טאב מציג</SectionHeader>
              <DataTable
                headers={["שם טאב", "key", "פריטים"]}
                rows={tabMapping.map(r => [
                  <span className="font-medium text-slate-800 dark:text-zinc-200">{r.label}</span>,
                  <span className="font-mono text-xs text-slate-400 dark:text-zinc-500">{r.value}</span>,
                  <StatusPill count={r.count} />,
                ])}
              />
            </section>

            {/* §2a Learning field mapping — only when data present */}
            {activeLearning > 0 && (
              <section>
                <SectionHeader>📚 שדות AI — ניתוח לימוד (video.*)</SectionHeader>
                <DataTable
                  headers={["שדה", "מקור", "כמות", "טאב יעד"]}
                  rows={learningFieldMapping.filter(r => r.count > 0).map(r => [
                    <span className="font-mono text-[12px] text-slate-700 dark:text-zinc-300">{r.field}</span>,
                    <span className="font-mono text-[11px] text-slate-400 dark:text-zinc-500">{r.source}</span>,
                    <StatusPill count={r.count} />,
                    <span className="text-slate-600 dark:text-zinc-400">{r.targetLabel}</span>,
                  ])}
                />
              </section>
            )}

            {/* §2b Market brief field mapping — when marketBriefData exists */}
            {marketBriefData && (
              <section>
                <SectionHeader>📈 שדות Market Brief (marketBriefData.*)</SectionHeader>
                {briefFieldMapping.length > 0 ? (
                  <DataTable
                    headers={["שדה", "כמות", "טאב יעד"]}
                    rows={briefFieldMapping.map(r => [
                      <span className="font-mono text-[12px] text-slate-700 dark:text-zinc-300">{r.field}</span>,
                      <StatusPill count={r.count} />,
                      <span className="text-slate-600 dark:text-zinc-400">{r.targetLabel}</span>,
                    ])}
                  />
                ) : (
                  <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400">
                    ⚠️ marketBriefData קיים אבל אף שדה לא מוכר — ראה סריקת שדות גולמיים למטה
                  </p>
                )}
              </section>
            )}

            {/* §3 Raw Market Brief keys — diagnostic */}
            {marketBriefData && rawBriefFields.length > 0 && (
              <section>
                <SectionHeader>🔬 סריקת marketBriefData — כל המפתחות</SectionHeader>
                <DataTable
                  headers={["מפתח", "ערך / כמות", "סוג", "ממופה?"]}
                  rows={rawBriefFields.map(r => [
                    <span className="font-mono text-[12px] text-slate-700 dark:text-zinc-300">{r.key}</span>,
                    <span className="font-mono text-sm font-semibold text-slate-700 dark:text-zinc-300">{r.count}</span>,
                    <span className="text-xs text-slate-400 dark:text-zinc-500">{r.isArray ? 'array' : 'object'}</span>,
                    r.mapped
                      ? <span className="text-xs text-emerald-600 dark:text-emerald-400">✅ {TAB_LABEL[BRIEF_FIELD_TO_TAB[r.key]] || BRIEF_FIELD_TO_TAB[r.key]}</span>
                      : <span className="text-xs text-amber-500">⚠️ לא ממופה</span>,
                  ])}
                />
              </section>
            )}

            {/* §4 Raw video fields scanner */}
            {rawVideoFields.length > 0 && (
              <section>
                <SectionHeader>🔬 סריקת video.* — כל השדות עם נתונים</SectionHeader>
                <DataTable
                  headers={["שדה", "כמות", "ממופה?"]}
                  rows={rawVideoFields.map(r => [
                    <span className="font-mono text-[12px] text-slate-700 dark:text-zinc-300">{r.key}</span>,
                    <span className="font-mono text-sm font-semibold text-slate-700 dark:text-zinc-300">{r.count}</span>,
                    r.mapped
                      ? <span className="text-xs text-emerald-600 dark:text-emerald-400">✅ ממופה</span>
                      : <span className="text-xs text-slate-400 dark:text-zinc-500">— לא ממופה</span>,
                  ])}
                />
              </section>
            )}

            {/* §5 Unmapped fields */}
            {droppedFields.length > 0 && (
              <section>
                <SectionHeader>⚠️ שדות ללא מיפוי ({droppedFields.length})</SectionHeader>
                <DataTable
                  borderColor="border-amber-100 dark:border-amber-900/30"
                  headBg="bg-amber-50 dark:bg-amber-950/20"
                  dividerColor="divide-amber-50 dark:divide-amber-900/20"
                  headers={["שדה", "פריטים", "הערה"]}
                  rows={droppedFields.map(r => [
                    <span className="font-mono text-[12px] text-amber-800 dark:text-amber-400">{r.field}</span>,
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40">{r.count}</span>,
                    <span className="text-slate-500 dark:text-zinc-500">לא מוגדר ב-FIELD_TO_TAB</span>,
                  ])}
                />
              </section>
            )}

            {/* §6 Brain items */}
            <section>
              <SectionHeader>🧠 Brain — פריטים שמורים ({brainItems.length})</SectionHeader>
              {brainItems.length === 0 ? (
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
                  אין פריטים שמורים ל-Brain עבור סרטון זה.
                </p>
              ) : (
                <DataTable
                  headers={["כותרת", "סוג", "נתיב"]}
                  rows={brainItems.map(item => [
                    <span className="line-clamp-1 font-medium text-slate-800 dark:text-zinc-200">{item.title || "—"}</span>,
                    <span className="text-slate-500 dark:text-zinc-400">{item.kind || "—"}</span>,
                    <span className="line-clamp-1 font-mono text-[10px] text-slate-400 dark:text-zinc-500">{item.workspacePath || "—"}</span>,
                  ])}
                />
              )}
            </section>

          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
