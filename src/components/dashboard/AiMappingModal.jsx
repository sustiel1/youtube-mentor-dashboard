import { useMemo, useState, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogPortal } from "@/components/ui/dialog";
import { X, ClipboardList, Download, Copy, ArrowRight } from "lucide-react";
import { extractVideoTabItems, detectGEMSchemaType } from "@/config/videoTabsConfig";
import { getKnowledgeItems } from "@/lib/localKnowledgeItemStore";
import { toast } from "sonner";

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
  // universalTabs schema — single key spanning all 7 tabs
  universalTabs:        "summary",
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
  "insights":            "תובנות",
  "useful-knowledge":    "ידע שימושי",
  "app-builder":         "APP",
  "topics-subtopics":    "מיפוי ל-Obsidian",
  "specialized":         "תוכן ייעודי",
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

// ── Diagnostic Report Builder ─────────────────────────────────────────────────

const SPECIALIZED_RENDERER_TAB_REGISTRY = {
  "fundamental-analysis": [
    "financial-metrics", "valuation", "analysis-frameworks",
    "investment-checklist", "mistakes", "checklists",
  ],
  "technical-analysis": [
    "indicators", "setups", "patterns", "checklists", "mistakes",
  ],
  "morning-brief": [
    "market-news", "indices", "brief-macro", "brief-sentiment",
    "brief-calendar", "stocks-mentioned", "brief-opportunities", "brief-risks",
  ],
  "evening-brief": [
    "market-news", "indices", "brief-macro", "brief-sentiment",
    "brief-sectors", "brief-changes", "brief-tomorrow", "brief-calendar",
    "stocks-mentioned", "brief-opportunities", "brief-risks",
  ],
  "weekly-brief": [
    "brief-highlights", "market-news", "indices", "brief-macro",
    "brief-winners", "brief-losers", "brief-sentiment", "brief-calendar",
    "brief-outlook", "stocks-mentioned", "brief-opportunities", "brief-risks",
  ],
  "earnings-brief": [
    "financial-metrics", "earnings-guidance", "earnings-commentary",
    "brief-macro", "brief-sentiment", "brief-calendar", "market-news",
    "indices", "stocks-mentioned", "brief-opportunities", "brief-risks",
  ],
  "macro": [
    "brief-macro", "indices", "brief-opportunities",
  ],
  "political": [
    "political-players", "political-for", "political-against",
    "political-slogans", "political-debates", "political-ideology",
    "political-theology", "political-liberal", "political-reusable",
  ],
  "default": [
    "trading-brain", "indicators", "setups", "patterns", "checklists",
    "mistakes", "valuation", "financial-metrics", "cause-effect", "market-impact",
  ],
};

const TRACE_REQUIRED_FIELDS = [
  {
    tabKey: "brief-sentiment",
    sourcePaths: [
      "marketBriefData.sentiment",
      "marketBriefData.marketSentiment",
      "marketBriefData.sentimentAnalysis",
      "marketBriefData.marketMood",
      "marketBriefData.fearGreed",
    ],
  },
  {
    tabKey: "brief-calendar",
    sourcePaths: [
      "marketBriefData.calendar",
      "marketBriefData.economicCalendar",
      "marketBriefData.events",
      "marketBriefData.upcomingEvents",
      "marketBriefData.schedule",
    ],
  },
  { tabKey: "brief-sectors", sourcePaths: ["video.sectorPerformance", "video.sectors"] },
  { tabKey: "brief-changes", sourcePaths: ["video.marketChanges", "video.changes"] },
  { tabKey: "brief-tomorrow", sourcePaths: ["video.tomorrowEvents", "video.nextEvents"] },
  { tabKey: "brief-highlights", sourcePaths: ["video.weeklyHighlights", "video.highlights", "video.marketConditions"] },
  { tabKey: "brief-winners", sourcePaths: ["video.winners", "video.topGainers"] },
  { tabKey: "brief-losers", sourcePaths: ["video.losers", "video.topLosers"] },
  { tabKey: "brief-outlook", sourcePaths: ["video.weeklyOutlook", "video.outlook", "video.nextWeekOutlook"] },
  { tabKey: "earnings-guidance", sourcePaths: ["video.guidance", "video.earningsGuidance"] },
  { tabKey: "earnings-commentary", sourcePaths: ["video.managementCommentary", "video.commentary"] },
  { tabKey: "financial-metrics", sourcePaths: ["video.financialMetrics", "video.analysis.financialMetrics"] },
];

const TRACE_FIELDS_BY_TAB = Object.fromEntries(
  TRACE_REQUIRED_FIELDS.map((entry) => [entry.tabKey, entry.sourcePaths])
);

const ALL_SPECIALIZED_RENDERER_TAB_KEYS = new Set(
  Object.values(SPECIALIZED_RENDERER_TAB_REGISTRY).flat()
);

const SAFE_TAB_DATA_MAPPINGS = [
  // ── Summary ───────────────────────────────────────────────────────────
  { tabKey: "summary", expectedField: "summary→aiSummary",  sourcePath: "marketBriefData.summary",      targetPath: "video.aiSummary"    },
  { tabKey: "summary", expectedField: "shortSummary",        sourcePath: "marketBriefData.shortSummary", targetPath: "video.shortSummary" },
  { tabKey: "summary", expectedField: "fullSummary",         sourcePath: "marketBriefData.fullSummary",  targetPath: "video.fullSummary"  },
  { tabKey: "summary", expectedField: "mainLesson",          sourcePath: "marketBriefData.mainLesson",   targetPath: "video.mainLesson"   },
  // ── Chapters ──────────────────────────────────────────────────────────
  { tabKey: "chapters", expectedField: "aiChapters",         sourcePath: "marketBriefData.chapters",     targetPath: "video.aiChapters"   },
  // ── Insights ──────────────────────────────────────────────────────────
  { tabKey: "insights", expectedField: "top5Insights",       sourcePath: "marketBriefData.top5Insights",     targetPath: "video.top5Insights"     },
  { tabKey: "insights", expectedField: "learningInsights",   sourcePath: "marketBriefData.learningInsights", targetPath: "video.learningInsights" },
  { tabKey: "insights", expectedField: "conclusions",        sourcePath: "marketBriefData.conclusions",      targetPath: "video.conclusions"      },
  // ── Useful Knowledge ──────────────────────────────────────────────────
  { tabKey: "useful-knowledge", expectedField: "reusableKnowledge", sourcePath: "marketBriefData.reusableKnowledge", targetPath: "video.reusableKnowledge" },
  { tabKey: "useful-knowledge", expectedField: "keyTakeaways",      sourcePath: "marketBriefData.keyTakeaways",      targetPath: "video.keyTakeaways"      },
  { tabKey: "useful-knowledge", expectedField: "actionChecklist",   sourcePath: "marketBriefData.actionChecklist",   targetPath: "video.actionChecklist"   },
  // ── Specialized ───────────────────────────────────────────────────────
  { tabKey: "specialized", expectedField: "indices",
    sourcePath: "marketBriefData.indices",
    sourcePaths: ["marketBriefData.indices","marketBriefData.indexPerformance","marketBriefData.indexData","marketBriefData.keyLevels","marketBriefData.sectorRotation"],
    targetPath: "video.indices" },
  { tabKey: "specialized", expectedField: "marketNews",
    sourcePath: "marketBriefData.marketNews",
    sourcePaths: ["marketBriefData.marketNews","marketBriefData.headlines","marketBriefData.news","marketBriefData.topStories","marketBriefData.catalysts"],
    targetPath: "video.marketNews" },
  { tabKey: "specialized", expectedField: "macroFactors",
    sourcePath: "marketBriefData.macroFactors",
    sourcePaths: ["marketBriefData.macroFactors","marketBriefData.macro","marketBriefData.macroEvents","marketBriefData.macroHighlights","marketBriefData.economicEvents"],
    targetPath: "video.macroFactors" },
  { tabKey: "specialized", expectedField: "stocksMentioned",
    sourcePath: "marketBriefData.stocksMentioned",
    sourcePaths: ["marketBriefData.stocksMentioned","marketBriefData.stocks","marketBriefData.watchlist","marketBriefData.tickers"],
    targetPath: "video.stocksMentioned" },
  { tabKey: "specialized", expectedField: "opportunities",
    sourcePath: "marketBriefData.opportunities",
    sourcePaths: ["marketBriefData.opportunities","marketBriefData.tradingOpportunities","marketBriefData.trades"],
    targetPath: "video.opportunities" },
  { tabKey: "specialized", expectedField: "risks",
    sourcePath: "marketBriefData.risks",
    sourcePaths: ["marketBriefData.risks","marketBriefData.riskFactors","marketBriefData.warnings"],
    targetPath: "video.risks" },
  // ── Topics & Subtopics ────────────────────────────────────────────────
  { tabKey: "topics-subtopics", expectedField: "tags",           sourcePath: "marketBriefData.tags",          targetPath: "video.tags"          },
  { tabKey: "topics-subtopics", expectedField: "obsidianTopics", sourcePath: "marketBriefData.obsidianTopics",targetPath: "video.obsidianTopics"},
  // ── App Builder ───────────────────────────────────────────────────────
  { tabKey: "app-builder", expectedField: "appBuilding", sourcePath: "marketBriefData.appBuilding", targetPath: "video.analysis.appBuilding" },
];

const UNIVERSAL_TAB_KEYS = ['summary', 'chapters', 'insights', 'useful-knowledge', 'app-builder', 'topics-subtopics', 'specialized'];
const UNIVERSAL_TAB_DISPLAY_KEY = {
  'summary':         'summary',
  'chapters':        'chapters',
  'insights':        'insights',
  'useful-knowledge':'usefulKnowledge',
  'app-builder':     'appBuilder',
  'topics-subtopics':'topics',
  'specialized':     'specialized',
};

function buildDiagnosticReport({ v, videoType, normalizedSubCategory, selectedTabsConfigKey, gemRec, marketBriefData, userConfirmedSubCategory, confirmedAt }) {
  const a  = v.analysis || {};
  const transcriptSegs  = Array.isArray(v.transcriptSegments) ? v.transcriptSegments : [];
  const transcriptText  = typeof v.transcript === 'string' ? v.transcript : '';
  const transcriptLen   = transcriptText.length ||
    transcriptSegs.reduce((s, seg) => s + (String(seg?.text || '').length), 0);

  const youtubeChaps = Array.isArray(v.chapters)
    ? v.chapters.filter(c => c.timeSource === 'real' || c.chapterSource === 'description_timestamp' || c.chapterSource === 'native_chapters').length
    : 0;
  const aiChaps      = Array.isArray(v.aiChapters) ? v.aiChapters.length : 0;
  const analysisChaps= Array.isArray(a.chapters) ? a.chapters.length : 0;
  const finalChaps   = youtubeChaps || aiChaps || analysisChaps;

  const hasSummary   = !!(v.shortSummary || v.fullSummary || a.contentType);

  const tabs = {};
  for (const tabValue of UNIVERSAL_TAB_KEYS) {
    const displayKey = UNIVERSAL_TAB_DISPLAY_KEY[tabValue];
    const items = tabValue === 'chapters'
      ? finalChaps
      : extractVideoTabItems(v, tabValue, marketBriefData).length;

    const sources = [];
    if (tabValue === 'summary') {
      if (v.shortSummary) sources.push('video.shortSummary');
      if (v.fullSummary)  sources.push('video.fullSummary');
      if (v.gemSummary)   sources.push('video.gemSummary');
    } else if (tabValue === 'chapters') {
      if (youtubeChaps) sources.push('video.chapters (youtube)');
      if (aiChaps)      sources.push('video.aiChapters');
      if (analysisChaps)sources.push('analysis.chapters');
    } else if (tabValue === 'insights') {
      if (Array.isArray(v.keyInsights)         && v.keyInsights.length)          sources.push('video.keyInsights');
      if (Array.isArray(v.brainHighlights)     && v.brainHighlights.length)      sources.push('video.brainHighlights');
      if (Array.isArray(v.tradingPrinciples)   && v.tradingPrinciples.length)    sources.push('video.tradingPrinciples');
      if (Array.isArray(v.top5Insights)        && v.top5Insights.length)         sources.push('video.top5Insights');
      if (v.mainLesson)                                                           sources.push('video.mainLesson');
    } else if (tabValue === 'useful-knowledge') {
      if (Array.isArray(v.actionItems)         && v.actionItems.length)          sources.push('video.actionItems');
      if (Array.isArray(v.usefulKnowledge)     && v.usefulKnowledge.length)      sources.push('video.usefulKnowledge');
      if (Array.isArray(v.definitions)         && v.definitions.length)          sources.push('video.definitions');
      if (Array.isArray(v.checklists)          && v.checklists.length)           sources.push('video.checklists');
    }
    tabs[displayKey] = { items, sources };
  }

  const warnings = [];
  if (transcriptLen < 100 && transcriptSegs.length === 0) warnings.push('Missing transcript');
  if (!hasSummary)                                          warnings.push('Missing AI analysis');
  if (finalChaps === 0)                                     warnings.push('No chapters');
  if ((tabs.specialized?.items ?? 0) === 0)                 warnings.push('No specialized content');
  if (!normalizedSubCategory)                               warnings.push('No subCategory — falling back to keyword detection');
  if (!v.category)                                          warnings.push('Missing category');

  return {
    video: {
      id:          v.id          || v.videoId || '',
      title:       v.title       || '',
      youtubeId:   v.youtubeId   || v.videoId || '',
      channel:     v.channelName || v.mentorName || '',
      category:    v.category    || '',
      subCategory: v.subCategory || '',
      contentType: v.contentType || a.contentType || '',
      videoType:   videoType     || '',
      tabsKey:     selectedTabsConfigKey || '',
      userConfirmed: !!userConfirmedSubCategory,
      confirmedSubCategory: v.confirmedSubCategory || null,
      confirmedAt: confirmedAt || null,
      analysisFlow: ANALYSIS_FLOW_MAP[normalizedSubCategory] || 'General',
    },
    transcript: {
      exists:   transcriptLen >= 100 || transcriptSegs.length > 0,
      length:   transcriptLen,
      segments: transcriptSegs.length,
      source:   v.transcriptSource || v.transcriptStatus || '',
    },
    chapters: {
      youtubeChapters: youtubeChaps,
      aiChapters:      aiChaps,
      finalChapters:   finalChaps,
      source: youtubeChaps > 0 ? 'youtube' : aiChaps > 0 ? 'ai' : finalChaps > 0 ? 'analysis' : 'none',
    },
    analysis: {
      exists:      hasSummary,
      gemType:     gemRec?.gemKey  || v.analysisProvider || '',
      confidence:  Math.round(gemRec?.confidencePct || 0),
      generatedAt: a.savedAt || v.analysisSavedAt || '',
    },
    tabs,
    routing: {
      obsidianCategory:    v.category    || '',
      obsidianSubCategory: v.subCategory || '',
      obsidianPath:        v.obsidianTopic || '',
    },
    warnings,
  };
}

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

function PipelineBadge({ badge }) {
  const toneClasses = {
    rendered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    empty: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    lost: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    dead: "bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300",
    unknown: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${toneClasses[badge?.tone] || toneClasses.unknown}`}>
      {badge?.label || "Unknown / needs code trace"}
    </span>
  );
}

function PipelineFacts({ trace }) {
  const boolText = (value) => value === true ? "yes" : value === false ? "no" : "Unknown / needs code trace";
  const textTone = (value) => value === true
    ? "text-emerald-600 dark:text-emerald-400"
    : value === false
      ? "text-red-500 dark:text-red-400"
      : "text-sky-600 dark:text-sky-400";

  return (
    <div className="space-y-1 text-[11px] leading-5">
      <PipelineBadge badge={trace.badge} />
      <div className="text-slate-500 dark:text-zinc-400">
        Data Found:
        {" "}
        <span className={textTone(trace.dataFound)}>{boolText(trace.dataFound)}</span>
      </div>
      <div className="text-slate-500 dark:text-zinc-400">
        Extractor Exists:
        {" "}
        <span className={textTone(trace.extractorExists)}>{boolText(trace.extractorExists)}</span>
      </div>
      <div className="text-slate-500 dark:text-zinc-400">
        Extractor Returned Items:
        {" "}
        <span className="font-mono text-slate-700 dark:text-zinc-200">{trace.extractorReturnedItems}</span>
      </div>
      <div className="text-slate-500 dark:text-zinc-400">
        Renderer Exists:
        {" "}
        <span className={textTone(trace.rendererExists)}>{boolText(trace.rendererExists)}</span>
      </div>
      <div className="text-slate-500 dark:text-zinc-400">
        UI Rendered:
        {" "}
        <span className={textTone(trace.uiRendered === true ? true : trace.uiRendered === false ? false : null)}>
          {boolText(trace.uiRendered)}
        </span>
      </div>
    </div>
  );
}

function countArr(obj, key) {
  const v = obj?.[key];
  return Array.isArray(v) ? v.length : (typeof v === 'string' && v.trim() ? 1 : 0);
}

function getPathValue({ video, marketBriefData }, path) {
  const [root, ...segments] = String(path || "").split(".");
  const base = root === "video" ? video : root === "marketBriefData" ? marketBriefData : undefined;
  return segments.reduce((acc, key) => (acc == null ? undefined : acc[key]), base);
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map((item) => cloneValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, cloneValue(val)]));
  }
  return value;
}

function valueCount(value) {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "string") return value.trim() ? 1 : 0;
  if (value && typeof value === "object") return Object.keys(value).length;
  return value == null ? 0 : 1;
}

function hasValue(value) {
  return valueCount(value) > 0;
}

function getTargetField(path) {
  const parts = String(path || "").split(".");
  return parts[0] === "video" ? parts.slice(1).join(".") : null;
}

function buildFixPreview(mapping, { video, marketBriefData }) {
  const context = { video, marketBriefData };

  // Resolve source: check sourcePaths aliases first, fall back to sourcePath
  const pathsToCheck = mapping.sourcePaths || [mapping.sourcePath];
  let sourceValue, effectiveSourcePath;
  for (const path of pathsToCheck) {
    const v = getPathValue(context, path);
    if (hasValue(v)) { sourceValue = v; effectiveSourcePath = path; break; }
  }
  if (!effectiveSourcePath) {
    sourceValue = getPathValue(context, mapping.sourcePath);
    effectiveSourcePath = mapping.sourcePath;
  }

  const targetValue = getPathValue(context, mapping.targetPath);
  const sourceExists = hasValue(sourceValue);
  const targetExists = hasValue(targetValue);
  const oldCount = valueCount(targetValue);
  const newCount = sourceExists ? valueCount(sourceValue) : oldCount;

  let reason = "ready";
  if (!sourceExists) reason = "source-missing";
  else if (targetExists) reason = "target-has-data";

  return {
    ...mapping,
    sourcePath: effectiveSourcePath,
    tabLabel: TAB_LABEL[mapping.tabKey] || mapping.tabKey,
    sourceValue,
    targetValue,
    sourceExists,
    targetExists,
    oldCount,
    newCount,
    canApply: sourceExists && !targetExists,
    reason,
  };
}

function getRendererTrace(tabKey, normalizedSubCategory) {
  if (UNIVERSAL_TAB_KEYS.includes(tabKey)) {
    return {
      rendererExists: true,
      rendererLabel: "VideoDetailPanel universal tab",
      reachableAnywhere: true,
      reachableInCurrentView: true,
    };
  }

  const routeKeys = SPECIALIZED_RENDERER_TAB_REGISTRY[normalizedSubCategory]
    || SPECIALIZED_RENDERER_TAB_REGISTRY.default
    || [];
  const reachableInCurrentView = routeKeys.includes(tabKey);
  const reachableAnywhere = ALL_SPECIALIZED_RENDERER_TAB_KEYS.has(tabKey);

  return {
    rendererExists: reachableInCurrentView,
    rendererLabel: reachableInCurrentView
      ? `SpecializedContentRenderer ${normalizedSubCategory || "default"}`
      : reachableAnywhere
        ? "SpecializedContentRenderer (other flow)"
        : "SpecializedContentRenderer",
    reachableAnywhere,
    reachableInCurrentView,
  };
}

function getTabSourcePaths(tabKey, mappingRows = []) {
  const mappingPaths = mappingRows
    .filter((row) => row.tabKey === tabKey)
    .map((row) => row.sourcePath)
    .filter(Boolean);
  if (mappingPaths.length > 0) return mappingPaths;
  return TRACE_FIELDS_BY_TAB[tabKey] || [];
}

function getSourceTrace(context, sourcePaths = []) {
  const matches = sourcePaths
    .map((path) => ({ path, value: getPathValue(context, path) }))
    .filter(({ value }) => hasValue(value));

  return {
    dataFound: matches.length > 0,
    matchedPaths: matches.map(({ path }) => path),
    totalItems: matches.reduce((sum, { value }) => sum + valueCount(value), 0),
  };
}

function derivePipelineBadge({ deadConfig, dataFound, extractorReturnedItems, rendererExists, uiRendered }) {
  if (deadConfig) {
    return {
      tone: "dead",
      label: "Dead Config",
      detail: "Tab/config is not reachable from UNIVERSAL_TABS or SpecializedContentRenderer",
    };
  }
  if (!dataFound) {
    return {
      tone: "empty",
      label: "Empty",
      detail: "Mapping exists, but source data is empty",
    };
  }
  if (extractorReturnedItems > 0 && !rendererExists) {
    return {
      tone: "lost",
      label: "Lost Field",
      detail: "Data exists and extractor works, but renderer is missing",
    };
  }
  if (extractorReturnedItems > 0 && uiRendered === true) {
    return {
      tone: "rendered",
      label: "Rendered",
      detail: "Data exists, extractor works, and renderer uses it",
    };
  }
  return {
    tone: "unknown",
    label: "Unknown / needs code trace",
    detail: "Runtime detection is uncertain for this field",
  };
}

function buildPipelineTrace({ tabKey, label, video, marketBriefData, normalizedSubCategory, sourcePaths = [], mappingRows = [] }) {
  const context = { video, marketBriefData };
  const resolvedSourcePaths = sourcePaths.length > 0 ? sourcePaths : getTabSourcePaths(tabKey, mappingRows);
  const sourceTrace = getSourceTrace(context, resolvedSourcePaths);
  const extractorReturnedItems = extractVideoTabItems(video, tabKey, marketBriefData).length;
  const rendererTrace = getRendererTrace(tabKey, normalizedSubCategory);
  const extractorExists = rendererTrace.reachableAnywhere || UNIVERSAL_TAB_KEYS.includes(tabKey);
  const uiRendered = rendererTrace.rendererExists
    ? (extractorReturnedItems > 0 ? true : false)
    : rendererTrace.reachableAnywhere
      ? "Unknown / needs code trace"
      : false;
  const deadConfig = !rendererTrace.reachableAnywhere && !UNIVERSAL_TAB_KEYS.includes(tabKey);
  const badge = derivePipelineBadge({
    deadConfig,
    dataFound: sourceTrace.dataFound,
    extractorReturnedItems,
    rendererExists: rendererTrace.rendererExists,
    uiRendered,
  });

  return {
    tabKey,
    label: label || TAB_LABEL[tabKey] || tabKey,
    sourcePaths: resolvedSourcePaths,
    dataFound: sourceTrace.dataFound,
    matchedSourcePaths: sourceTrace.matchedPaths,
    sourceItemCount: sourceTrace.totalItems,
    extractorExists,
    extractorReturnedItems,
    rendererExists: rendererTrace.rendererExists,
    rendererReachableAnywhere: rendererTrace.reachableAnywhere,
    rendererLabel: rendererTrace.rendererLabel,
    uiRendered,
    deadConfig,
    badge,
    lines: [
      {
        label: "Source",
        text: resolvedSourcePaths.length > 0
          ? `${resolvedSourcePaths.join(" | ")} ${sourceTrace.dataFound ? `found (${sourceTrace.totalItems})` : "not found"}`
          : "Unknown / needs code trace",
        ok: sourceTrace.dataFound,
      },
      {
        label: "Extractor",
        text: extractorExists
          ? `extractVideoTabItems("${tabKey}") returned ${extractorReturnedItems} items`
          : `extractVideoTabItems("${tabKey}") is not traceable from config`,
        ok: extractorExists && extractorReturnedItems > 0,
      },
      {
        label: "Renderer",
        text: rendererTrace.rendererExists
          ? `${rendererTrace.rendererLabel} used`
          : rendererTrace.reachableAnywhere
            ? `${rendererTrace.rendererLabel} exists, but not in the current flow`
            : `${rendererTrace.rendererLabel} not referenced`,
        ok: rendererTrace.rendererExists,
      },
      {
        label: "UI",
        text: uiRendered === true
          ? "rendered"
          : uiRendered === false
            ? "not rendered"
            : "Unknown / needs code trace",
        ok: uiRendered === true,
      },
    ],
  };
}

// ── Local Diagnostic Fallback ──────────────────────────────────────────────────

const FALLBACK_REASON_LABEL = {
  'key-missing':    'מפתח Gemini API חסר',
  'quota-exceeded': 'מכסת Gemini חרגה (429)',
  'network-error':  'שגיאת רשת',
  'invalid-key':    'מפתח API לא תקף',
  'unknown':        'שגיאה לא ידועה',
};

function parseGeminiErrorReason(fetchError, data) {
  if (data?.error === 'GEMINI_API_KEY_MISSING') return 'key-missing';
  const msg = (data?.message || fetchError?.message || '').toLowerCase();
  if (msg.includes('429') || msg.includes('quota') || msg.includes('too many requests')) return 'quota-exceeded';
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('networkerror')) return 'network-error';
  if (msg.includes('api key') || msg.includes('invalid key')) return 'invalid-key';
  return 'unknown';
}

function buildLocalDiagResult(report, { droppedFields }) {
  const working = [];
  const issues = [];
  const missingData = [];
  const unmappedData = [];

  if (report.transcript.exists) working.push(`תמלול קיים — ${report.transcript.length} תווים, ${report.transcript.segments} קטעים`);
  if (report.analysis.exists) working.push('ניתוח AI קיים');
  if (report.chapters.finalChapters > 0) working.push(`פרקים: ${report.chapters.finalChapters} (${report.chapters.source})`);
  for (const [key, data] of Object.entries(report.tabs || {})) {
    if ((data.items ?? 0) > 0) working.push(`טאב ${key}: ${data.items} פריטים`);
  }

  for (const w of report.warnings) {
    issues.push({ area: 'warnings', problem: w, severity: 'high', recommendedFix: null });
  }
  for (const [key, data] of Object.entries(report.tabs || {})) {
    if ((data.items ?? 0) === 0) {
      issues.push({ area: `tab:${key}`, problem: `טאב "${key}" ריק`, evidence: 'items=0', severity: 'medium', recommendedFix: `בדוק מיפוי שדות ל-${key}` });
    }
  }

  if (!report.transcript.exists) missingData.push('transcript');
  if (!report.analysis.exists) missingData.push('analysis');
  for (const f of (droppedFields || [])) unmappedData.push(`${f.field} (${f.count} items)`);

  const emptyTabs = Object.entries(report.tabs || {}).filter(([, d]) => (d.items ?? 0) === 0).map(([k]) => k);

  const fixPromptForClaudeCode = [
    `Problem:`,
    `Universal tabs are empty after video load or GEM paste.`,
    ``,
    `Evidence:`,
    `- Video: ${report.video.title || report.video.id}`,
    `- Category: ${report.video.category} / ${report.video.subCategory}`,
    `- tabsKey: ${report.video.tabsKey}`,
    `- analysisFlow: ${report.video.analysisFlow}`,
    `- Analysis exists: ${report.analysis.exists}`,
    `- Transcript: ${report.transcript.exists ? `${report.transcript.length} chars` : 'MISSING'}`,
    `- Empty tabs: ${emptyTabs.length > 0 ? emptyTabs.join(', ') : 'none'}`,
    `- Warnings: ${report.warnings.length > 0 ? report.warnings.join('; ') : 'none'}`,
    droppedFields?.length > 0 ? `- Unmapped fields: ${droppedFields.map(f => f.field).join(', ')}` : '',
    ``,
    `Files likely involved:`,
    `- src/components/dashboard/VideoDetailPanel.jsx`,
    `- src/config/videoTabsConfig.js`,
    ``,
    `Recommended fix:`,
    `1. Ensure effectiveVideo useMemo includes marketBriefData in deps`,
    `2. Ensure extractVideoTabItems reads from marketBriefData for empty tabs`,
    `3. Reset activeTab to 'summary' when normalizedSubCategory changes`,
    ``,
    `Acceptance criteria:`,
    `- All 7 universal tabs show items when analysis/GEM data exists`,
    `- Tab content updates immediately after GEM paste`,
    `- Build passes with EXIT=0`,
  ].filter(Boolean).join('\n');

  return { working, issues, missingData, unmappedData, fixPromptForClaudeCode };
}

/**
 * DEV-only modal: shows how AI/GEM output was extracted and mapped into UI tabs.
 */
const ANALYSIS_FLOW_MAP = {
  'morning-brief':   'Market Brief Analysis (GEM מבזק בוקר)',
  'evening-brief':   'Market Brief Analysis (GEM מבזק ערב)',
  'weekly-brief':    'Market Brief Analysis (GEM מבזק שבועי)',
  'earnings-brief':  'Market Brief Analysis (GEM מבזק דוחות)',
  'technical-analysis':   'Technical Analysis (GEM טכני)',
  'fundamental-analysis': 'Fundamental Analysis (GEM פונדמנטלי)',
  'macro':           'Macro Analysis (GEM מאקרו)',
  'political':       'Political Analysis (GEM פוליטי)',
};

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
  userConfirmedSubCategory = false,
  confirmedSubCategory = null,
  analysisExists = false,
  hasTranscript = false,
  confirmedAt = null,
  onSaveVideoFields,
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

  const gemSchemaType = useMemo(() => detectGEMSchemaType(marketBriefData), [marketBriefData]);

  const totalTabItems  = tabMapping.reduce((s, r) => s + r.count, 0);
  const activeLearning = learningFieldMapping.filter(r => r.count > 0).length;
  const activeBrief    = briefFieldMapping.length;
  const totalActive    = activeLearning + activeBrief;

  // ── §7 Debug Report ─────────────────────────────────────────────────────────
  const [showReport, setShowReport] = useState(false);
  const [selectedFixPreview, setSelectedFixPreview] = useState(null);
  const [selectedTraceTab, setSelectedTraceTab] = useState(null);
  const [isApplyingFix, setIsApplyingFix] = useState(false);
  const [showAiDiag, setShowAiDiag] = useState(false);
  const [isRunningAiDiag, setIsRunningAiDiag] = useState(false);
  const [aiDiagResult, setAiDiagResult] = useState(null);
  const [aiDiagError, setAiDiagError] = useState(null);
  const [aiDiagMode, setAiDiagMode] = useState('idle'); // 'idle' | 'gemini' | 'local'
  const [aiDiagFallbackReason, setAiDiagFallbackReason] = useState(null);

  const report = useMemo(() => buildDiagnosticReport({
    v, videoType, normalizedSubCategory, selectedTabsConfigKey, gemRec, marketBriefData,
    userConfirmedSubCategory, confirmedAt,
  }), [v, videoType, normalizedSubCategory, selectedTabsConfigKey, gemRec, marketBriefData, userConfirmedSubCategory, confirmedAt]);

  const reportJson = useMemo(() => JSON.stringify(report, null, 2), [report]);

  const tabPipelineTraces = useMemo(() => (
    tabMapping.map((tab) => buildPipelineTrace({
      tabKey: tab.value,
      label: tab.label,
      video: v,
      marketBriefData,
      normalizedSubCategory,
      mappingRows: SAFE_TAB_DATA_MAPPINGS,
    }))
  ), [tabMapping, v, marketBriefData, normalizedSubCategory]);

  const handleCopyReport = useCallback(() => {
    navigator.clipboard.writeText(reportJson)
      .then(() => toast.success('✅ הדוח הועתק ללוח'))
      .catch(() => toast.error('שגיאה בהעתקה'));
  }, [reportJson]);

  const handleCopyForChatGPT = useCallback(() => {
    const prompt = `Below is a diagnostic report for a YouTube video analysis app. Please analyze it and identify issues:\n\n\`\`\`json\n${reportJson}\n\`\`\`\n\nKey questions:\n1. Why are some tabs empty?\n2. What data is missing?\n3. What should be fixed?`;
    navigator.clipboard.writeText(prompt)
      .then(() => toast.success('✅ פרומפט לChatGPT הועתק'))
      .catch(() => toast.error('שגיאה בהעתקה'));
  }, [reportJson]);

  const handleDownloadJson = useCallback(() => {
    const blob = new Blob([reportJson], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `diagnostic-${v.id || v.videoId || 'video'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [reportJson, v]);

  const safeTabDataMappings = useMemo(() =>
    SAFE_TAB_DATA_MAPPINGS.map((mapping) => {
      const preview = buildFixPreview(mapping, { video: v, marketBriefData });
      return {
        ...preview,
        pipelineTrace: buildPipelineTrace({
          tabKey: mapping.tabKey,
          label: TAB_LABEL[mapping.tabKey] || mapping.tabKey,
          video: v,
          marketBriefData,
          normalizedSubCategory,
          sourcePaths: preview.sourcePath ? [preview.sourcePath] : getTabSourcePaths(mapping.tabKey, SAFE_TAB_DATA_MAPPINGS),
          mappingRows: SAFE_TAB_DATA_MAPPINGS,
        }),
      };
    }),
  [v, marketBriefData, normalizedSubCategory]);

  const orphanLostFields = useMemo(() => (
    TRACE_REQUIRED_FIELDS.map((fieldTrace) => buildPipelineTrace({
      tabKey: fieldTrace.tabKey,
      label: TAB_LABEL[fieldTrace.tabKey] || fieldTrace.tabKey,
      video: v,
      marketBriefData,
      normalizedSubCategory,
      sourcePaths: fieldTrace.sourcePaths,
      mappingRows: SAFE_TAB_DATA_MAPPINGS,
    }))
  ), [v, marketBriefData, normalizedSubCategory]);

  const selectedTrace = useMemo(() => (
    selectedTraceTab
      ? tabPipelineTraces.find((trace) => trace.tabKey === selectedTraceTab) || null
      : null
  ), [selectedTraceTab, tabPipelineTraces]);

  const logMappingFix = useCallback((preview, applied, reason) => {
    console.log("[AiMappingFix]", {
      sourcePath: preview.sourcePath,
      targetPath: preview.targetPath,
      oldValueCount: preview.oldCount,
      newValueCount: preview.newCount,
      applied,
      reason,
    });
  }, []);

  const handlePreviewFix = useCallback((preview) => {
    setSelectedFixPreview(preview);
    logMappingFix(preview, false, `preview:${preview.reason}`);
  }, [logMappingFix]);

  const applyFixes = useCallback(async (previews) => {
    if (typeof onSaveVideoFields !== "function") {
      toast.error("Fix Mapping unavailable: save callback missing");
      return;
    }

    const applicable = previews.filter((preview) => preview.canApply);
    const blocked = previews.filter((preview) => !preview.canApply);
    blocked.forEach((preview) => logMappingFix(preview, false, preview.reason));

    if (applicable.length === 0) {
      toast.info("No safe mapping fixes available");
      return;
    }

    const shouldApply = window.confirm(
      applicable.length === 1
        ? `Apply safe fix from ${applicable[0].sourcePath} to ${applicable[0].targetPath}?`
        : `Apply ${applicable.length} safe mapping fixes? Existing target data will not be overwritten.`
    );
    if (!shouldApply) {
      applicable.forEach((preview) => logMappingFix(preview, false, "cancelled"));
      return;
    }

    const updates = {};
    applicable.forEach((preview) => {
      const targetField = getTargetField(preview.targetPath);
      if (!targetField) {
        logMappingFix(preview, false, "invalid-target-path");
        return;
      }
      const dotIdx = targetField.indexOf(".");
      if (dotIdx !== -1) {
        // Nested path (e.g. "analysis.appBuilding") — preserve sibling keys via spread
        const parent = targetField.slice(0, dotIdx);
        const child  = targetField.slice(dotIdx + 1);
        if (!updates[parent]) updates[parent] = { ...(v[parent] || {}) };
        updates[parent][child] = cloneValue(preview.sourceValue);
      } else {
        updates[targetField] = cloneValue(preview.sourceValue);
      }
    });

    if (Object.keys(updates).length === 0) {
      toast.info("No valid fixes to apply");
      return;
    }

    setIsApplyingFix(true);
    try {
      await onSaveVideoFields(updates);
      applicable.forEach((preview) => logMappingFix(preview, true, "applied"));
      toast.success(
        applicable.length === 1
          ? `Applied fix for ${applicable[0].tabLabel}`
          : `Applied ${applicable.length} safe mapping fixes`
      );
      setSelectedFixPreview(null);
    } catch (error) {
      applicable.forEach((preview) => logMappingFix(preview, false, `save-failed:${error?.message || "unknown-error"}`));
      toast.error("Failed to apply mapping fix");
    } finally {
      setIsApplyingFix(false);
    }
  }, [logMappingFix, onSaveVideoFields]);

  const handleApplySingleFix = useCallback(async () => {
    if (!selectedFixPreview) return;
    await applyFixes([selectedFixPreview]);
  }, [applyFixes, selectedFixPreview]);

  const handleApplyAllSafeFixes = useCallback(async () => {
    await applyFixes(safeTabDataMappings);
  }, [applyFixes, safeTabDataMappings]);

  const handleRunAiDiagnosis = useCallback(async () => {
    setIsRunningAiDiag(true);
    setAiDiagError(null);
    setAiDiagResult(null);
    setAiDiagMode('idle');
    setAiDiagFallbackReason(null);
    setShowAiDiag(true);
    setShowReport(false);
    console.log('[AIMapping] mode=gemini');
    let fetchError = null;
    let data = {};
    try {
      const payload = {
        ...report,
        rawBriefFields: rawBriefFields.slice(0, 30),
        rawVideoFields: rawVideoFields.slice(0, 30),
        droppedFields,
        tabMapping,
        briefFieldMapping,
        learningFieldMapping: learningFieldMapping.filter(r => r.count > 0),
      };
      const res = await fetch('/api/gemini-ai-mapping-diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnosticReport: payload }),
      });
      data = await res.json().catch(() => ({}));
    } catch (err) {
      fetchError = err;
    }

    const geminiOk = !fetchError && data.ok && !data.error;
    if (geminiOk) {
      setAiDiagMode('gemini');
      setAiDiagResult(data.result);
    } else {
      const reason = parseGeminiErrorReason(fetchError, data);
      console.log('[AIMapping] fallback=local');
      console.log(`[AIMapping] reason=${reason}`);
      const localResult = buildLocalDiagResult(report, { droppedFields });
      setAiDiagMode('local');
      setAiDiagFallbackReason(reason);
      setAiDiagResult(localResult);
    }
    setIsRunningAiDiag(false);
  }, [report, rawBriefFields, rawVideoFields, droppedFields, tabMapping, briefFieldMapping, learningFieldMapping]);

  const handleCopyAiReport = useCallback(() => {
    if (!aiDiagResult) return;
    navigator.clipboard.writeText(JSON.stringify(aiDiagResult, null, 2))
      .then(() => toast.success('✅ דוח AI הועתק'))
      .catch(() => toast.error('שגיאה בהעתקה'));
  }, [aiDiagResult]);

  const handleCopyFixPrompt = useCallback(() => {
    const text = aiDiagResult?.fixPromptForClaudeCode;
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => toast.success('✅ פרומפט הועתק ל-Claude Code'))
      .catch(() => toast.error('שגיאה בהעתקה'));
  }, [aiDiagResult]);

  const handleDownloadAiReport = useCallback(() => {
    if (!aiDiagResult) return;
    const blob = new Blob([JSON.stringify(aiDiagResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-diagnosis-${v.id || v.videoId || 'video'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [aiDiagResult, v]);

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
            <div className="flex items-center gap-3">
              {(showReport || showAiDiag) && (
                <button type="button" onClick={() => { setShowReport(false); setShowAiDiag(false); }} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                  <ArrowRight className="h-3.5 w-3.5" />
                  חזרה
                </button>
              )}
              <div>
                <DialogPrimitive.Title className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  {showReport ? '📋 Export Debug Report' : showAiDiag ? '🤖 AI Mapping Diagnosis' : '🗺️ AI Mapping'}
                </DialogPrimitive.Title>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-500">
                  {showReport
                    ? `${report.warnings.length} אזהרות · JSON מוכן לשליחה`
                    : showAiDiag
                      ? (isRunningAiDiag ? 'מנתח...' : aiDiagMode === 'local' ? `מצב מקומי · ${(aiDiagResult?.issues || []).length} בעיות זוהו` : aiDiagResult ? `${(aiDiagResult.issues || []).length} בעיות זוהו` : aiDiagError ? 'ניתוח נכשל' : '')
                      : <>{totalActive} שדות פעילים · {totalTabItems} פריטים בסך הכל{marketBriefData && <span className="mr-2 rounded-full bg-sky-50 px-2 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">📈 Market Brief</span>}{gemSchemaType === 'universal' && <span className="mr-1 rounded-full bg-emerald-50 px-2 text-[10px] font-medium text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">✦ universalTabs</span>}{gemSchemaType === 'mixed' && <span className="mr-1 rounded-full bg-amber-50 px-2 text-[10px] font-medium text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">◐ mixed schema</span>}{gemSchemaType === 'legacy' && <span className="mr-1 rounded-full bg-slate-100 px-2 text-[10px] font-medium text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">▤ legacy schema</span>}</>
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!showReport && !showAiDiag && (
                <>
                  <button
                    type="button"
                    onClick={handleRunAiDiagnosis}
                    className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 hover:border-violet-300 transition-colors dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300"
                  >
                    🤖 אבחן מיפוי עם AI
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReport(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white hover:border-slate-300 transition-colors dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    📋 Export Debug Report
                  </button>
                </>
              )}
              <DialogPrimitive.Close className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
          </div>

          <div className="overflow-y-auto px-6 py-5 space-y-7">

            {/* ── Report View ── */}
            {showReport && (
              <>
                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pb-1" dir="rtl">
                  <button type="button" onClick={handleCopyReport}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors">
                    <Copy className="h-3.5 w-3.5" />
                    Copy Report
                  </button>
                  <button type="button" onClick={handleCopyForChatGPT}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors">
                    <Copy className="h-3.5 w-3.5" />
                    Copy for ChatGPT
                  </button>
                  <button type="button" onClick={handleDownloadJson}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                    <Download className="h-3.5 w-3.5" />
                    Download JSON
                  </button>
                </div>

                {/* Warnings summary */}
                {report.warnings.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                    <p className="mb-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">⚠️ אזהרות ({report.warnings.length})</p>
                    <ul className="space-y-0.5">
                      {report.warnings.map((w, i) => (
                        <li key={i} className="text-xs text-amber-700 dark:text-amber-400">• {w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* JSON report */}
                <div className="relative">
                  <pre dir="ltr" className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 px-4 py-4 text-[11px] leading-relaxed text-slate-100 dark:border-zinc-700 dark:bg-zinc-950 whitespace-pre-wrap break-all">
                    {reportJson}
                  </pre>
                  <button
                    type="button"
                    onClick={handleCopyReport}
                    className="absolute left-3 top-3 rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    <Copy className="h-3 w-3 inline mr-1" />
                    Copy
                  </button>
                </div>
              </>
            )}

            {/* ── AI Diagnosis View ── */}
            {showAiDiag && (
              <>
                {isRunningAiDiag && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
                    <p className="text-sm text-slate-500 dark:text-zinc-400">מנתח מיפוי עם AI...</p>
                  </div>
                )}
                {!isRunningAiDiag && aiDiagMode === 'local' && aiDiagFallbackReason && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-900/40 dark:bg-amber-950/20" dir="rtl">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">⚠️ AI Mapping AI unavailable</p>
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      סיבה: {FALLBACK_REASON_LABEL[aiDiagFallbackReason] || aiDiagFallbackReason}
                    </p>
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                      המערכת עברה אוטומטית ל-Local Diagnostic Mode.
                    </p>
                  </div>
                )}
                {!isRunningAiDiag && aiDiagResult && (
                  <>
                    <div className="flex flex-wrap gap-2 pb-1" dir="rtl">
                      <button type="button" onClick={handleCopyAiReport}
                        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors">
                        <Copy className="h-3.5 w-3.5" />
                        Copy AI Report
                      </button>
                      {aiDiagResult.fixPromptForClaudeCode && (
                        <button type="button" onClick={handleCopyFixPrompt}
                          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition-colors">
                          <Copy className="h-3.5 w-3.5" />
                          Copy Fix Prompt for Claude Code
                        </button>
                      )}
                      <button type="button" onClick={handleDownloadAiReport}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                        <Download className="h-3.5 w-3.5" />
                        Download JSON
                      </button>
                    </div>

                    {Array.isArray(aiDiagResult.working) && aiDiagResult.working.length > 0 && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                        <p className="mb-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">✅ עובד ({aiDiagResult.working.length})</p>
                        <ul className="space-y-0.5">
                          {aiDiagResult.working.map((w, i) => (
                            <li key={i} className="text-xs text-emerald-700 dark:text-emerald-400">• {w}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {Array.isArray(aiDiagResult.issues) && aiDiagResult.issues.length > 0 && (
                      <section>
                        <SectionHeader>🔴 בעיות שזוהו ({aiDiagResult.issues.length})</SectionHeader>
                        <div className="space-y-3">
                          {aiDiagResult.issues.map((issue, i) => {
                            const sev = issue.severity;
                            const colors = sev === 'high'
                              ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20'
                              : sev === 'medium'
                                ? 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20'
                                : 'border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900';
                            const textColor = sev === 'high'
                              ? 'text-red-800 dark:text-red-300'
                              : sev === 'medium' ? 'text-amber-800 dark:text-amber-300' : 'text-slate-700 dark:text-zinc-300';
                            return (
                              <div key={i} className={`rounded-xl border px-4 py-3 ${colors}`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-xs font-bold uppercase ${textColor}`}>{sev}</span>
                                  <span className="font-mono text-xs text-slate-500 dark:text-zinc-500">{issue.area}</span>
                                </div>
                                <p className={`text-sm font-semibold ${textColor}`}>{issue.problem}</p>
                                {issue.evidence && <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">עדות: {issue.evidence}</p>}
                                {issue.recommendedFix && <p className="mt-1 text-xs font-medium text-slate-700 dark:text-zinc-300">תיקון: {issue.recommendedFix}</p>}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      {Array.isArray(aiDiagResult.missingData) && aiDiagResult.missingData.length > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
                          <p className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300">❌ נתונים חסרים</p>
                          <ul className="space-y-0.5">
                            {aiDiagResult.missingData.map((m, i) => (
                              <li key={i} className="font-mono text-[11px] text-slate-500 dark:text-zinc-500">• {m}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(aiDiagResult.unmappedData) && aiDiagResult.unmappedData.length > 0 && (
                        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 dark:border-amber-900/30 dark:bg-amber-950/20">
                          <p className="mb-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">⚠️ נתונים ללא מיפוי</p>
                          <ul className="space-y-0.5">
                            {aiDiagResult.unmappedData.map((m, i) => (
                              <li key={i} className="font-mono text-[11px] text-amber-700 dark:text-amber-400">• {m}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {aiDiagResult.tabMappingPlan && Object.keys(aiDiagResult.tabMappingPlan).length > 0 && (
                      <section>
                        <SectionHeader>📑 תוכנית מיפוי מומלצת</SectionHeader>
                        <DataTable
                          headers={["טאב", "שדות מומלצים"]}
                          rows={Object.entries(aiDiagResult.tabMappingPlan).map(([tab, fields]) => [
                            <span className="font-semibold text-slate-700 dark:text-zinc-300">{tab}</span>,
                            <span className="text-xs text-slate-500 dark:text-zinc-500">{Array.isArray(fields) ? fields.join(', ') || '—' : '—'}</span>,
                          ])}
                        />
                      </section>
                    )}

                    {aiDiagResult.fixPromptForClaudeCode && (
                      <section>
                        <div className="flex items-center justify-between mb-2">
                          <SectionHeader>🤖 פרומפט לתיקון — Claude Code</SectionHeader>
                          <button type="button" onClick={handleCopyFixPrompt}
                            className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300">
                            <Copy className="h-3 w-3" />
                            Copy
                          </button>
                        </div>
                        <pre dir="ltr" className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 px-4 py-4 text-[11px] leading-relaxed text-slate-100 dark:border-zinc-700 dark:bg-zinc-950 whitespace-pre-wrap break-all">
                          {aiDiagResult.fixPromptForClaudeCode}
                        </pre>
                      </section>
                    )}
                  </>
                )}
              </>
            )}

            {/* ── Main mapping view (hidden when showReport or showAiDiag) ── */}
            {!showReport && !showAiDiag && (<>

            {/* §0 Classification */}
            <section>
              <SectionHeader>🏷️ סיווג הסרטון</SectionHeader>
              <div className="rounded-xl border border-slate-100 px-4 py-2 dark:border-zinc-800">
                <MetaRow label="קטגוריה" value={category} />
                <MetaRow label="תת-קטגוריה (effectiveSubCategory)" value={subCategory} />
                <MetaRow label="userConfirmed" value={
                  userConfirmedSubCategory
                    ? `✅ כן${confirmedAt ? ` · ${new Date(confirmedAt).toLocaleDateString('he-IL')}` : ''}`
                    : '❌ לא — מונחה ע"י AI בלבד'
                } />
                <MetaRow label="confirmedSubCategory" value={confirmedSubCategory || '—'} />
                <MetaRow label="תת-קטגוריה מנורמלת" value={normalizedSubCategory} />
                <MetaRow label="selectedAnalysisFlow" value={
                  ANALYSIS_FLOW_MAP[normalizedSubCategory] || (videoType === 'political' ? 'Political Analysis' : 'General — Claude + Gemini')
                } />
                <MetaRow label="analysisExists" value={analysisExists ? '✅ כן' : '❌ לא'} />
                <MetaRow label="missingAnalysisReason" value={
                  analysisExists ? '—' :
                  !hasTranscript ? 'אין תמלול — נדרש ייבוא תמלול' :
                  !userConfirmedSubCategory ? 'subCategory לא אושר — בחר ואשר תת-נושא' :
                  marketBriefData ? 'marketBriefData קיים אך אין summary' :
                  'נדרש ניתוח — לחץ "הרץ ניתוח" או הדבק GEM JSON'
                } />
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
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <SectionHeader>🛠️ Tab → Data Mapping</SectionHeader>
                <button
                  type="button"
                  onClick={handleApplyAllSafeFixes}
                  disabled={isApplyingFix}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400"
                >
                  Apply All Safe Fixes
                </button>
              </div>
              <DataTable
                headers={["Tab", "Key", "Expected Field", "Source Path", "Target Path", "Pipeline Status", "Source?", "Target?", "Count", "Actions"]}
                rows={safeTabDataMappings.map((mapping) => {
                  const previewSelected =
                    selectedFixPreview?.sourcePath === mapping.sourcePath &&
                    selectedFixPreview?.targetPath === mapping.targetPath;

                  return [
                    <span className="font-medium text-slate-800 dark:text-zinc-200">{mapping.tabLabel}</span>,
                    <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">{mapping.tabKey}</span>,
                    <span className="font-mono text-[11px] text-slate-700 dark:text-zinc-300">{mapping.expectedField}</span>,
                    <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">{mapping.sourcePath}</span>,
                    <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">{mapping.targetPath}</span>,
                    <PipelineFacts trace={mapping.pipelineTrace} />,
                    <span className={mapping.sourceExists ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-zinc-500"}>
                      {mapping.sourceExists ? "Yes" : "No"}
                    </span>,
                    <span className={mapping.targetExists ? "text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-zinc-500"}>
                      {mapping.targetExists ? "Yes" : "No"}
                    </span>,
                    <span className="font-mono text-sm text-slate-700 dark:text-zinc-300">{mapping.newCount}</span>,
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePreviewFix(mapping)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Preview Fix
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFixes([mapping])}
                        disabled={isApplyingFix || !mapping.canApply || !previewSelected}
                        className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-300"
                      >
                        Fix Mapping
                      </button>
                    </div>,
                  ];
                })}
              />

              {selectedFixPreview && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Preview Fix</p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">{selectedFixPreview.tabLabel} · {selectedFixPreview.expectedField}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleApplySingleFix}
                      disabled={isApplyingFix || !selectedFixPreview.canApply}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-300"
                    >
                      Apply Fix
                    </button>
                  </div>
                  <div className="space-y-1 text-sm">
                    <MetaRow label="source path" value={selectedFixPreview.sourcePath} />
                    <MetaRow label="target path" value={selectedFixPreview.targetPath} />
                    <MetaRow label="old count" value={String(selectedFixPreview.oldCount)} />
                    <MetaRow label="new count" value={String(selectedFixPreview.newCount)} />
                    <MetaRow
                      label="status"
                      value={
                        selectedFixPreview.canApply
                          ? "Safe to apply"
                          : selectedFixPreview.reason === "target-has-data"
                            ? "Skipped: target already has data"
                            : "Skipped: source missing"
                      }
                    />
                  </div>
                </div>
              )}
            </section>

            <section>
              <SectionHeader>Trace Pipeline</SectionHeader>
              <DataTable
                headers={["Tab", "Key", "Items", "Pipeline Status", "Trace"]}
                rows={tabPipelineTraces.map((trace) => [
                  <span className="font-medium text-slate-800 dark:text-zinc-200">{trace.label}</span>,
                  <span className="font-mono text-xs text-slate-400 dark:text-zinc-500">{trace.tabKey}</span>,
                  <StatusPill count={trace.extractorReturnedItems} />,
                  <PipelineFacts trace={trace} />,
                  <button
                    type="button"
                    onClick={() => setSelectedTraceTab((current) => current === trace.tabKey ? null : trace.tabKey)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Trace Tab
                  </button>,
                ])}
              />
              {selectedTrace && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{selectedTrace.label}</p>
                      <p className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">{selectedTrace.tabKey}</p>
                    </div>
                    <PipelineBadge badge={selectedTrace.badge} />
                  </div>
                  <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-950/50">
                    {selectedTrace.lines.map((line) => (
                      <div key={line.label} className="flex items-start gap-2 text-right">
                        <span className="mt-0.5 text-slate-400 dark:text-zinc-500">├─</span>
                        <div>
                          <span className="font-semibold text-slate-700 dark:text-zinc-300">{line.label}:</span>
                          {" "}
                          <span className="text-slate-600 dark:text-zinc-400">{line.text}</span>
                          {" "}
                          <span className={line.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}>
                            {line.ok ? "✓" : "✗"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section>
              <SectionHeader>Orphan / Lost Fields</SectionHeader>
              <DataTable
                borderColor="border-red-100 dark:border-red-900/30"
                headBg="bg-red-50 dark:bg-red-950/20"
                dividerColor="divide-red-50 dark:divide-red-900/20"
                headers={["Field", "Key", "Pipeline Status", "Renderer", "Items"]}
                rows={orphanLostFields.map((trace) => [
                  <span className="font-medium text-slate-800 dark:text-zinc-200">{trace.label}</span>,
                  <span className="font-mono text-xs text-slate-400 dark:text-zinc-500">{trace.tabKey}</span>,
                  <PipelineFacts trace={trace} />,
                  <span className="text-xs text-slate-500 dark:text-zinc-400">{trace.rendererLabel}</span>,
                  <span className="font-mono text-sm text-slate-700 dark:text-zinc-300">{trace.extractorReturnedItems}</span>,
                ])}
              />
            </section>

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

            </>)}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
