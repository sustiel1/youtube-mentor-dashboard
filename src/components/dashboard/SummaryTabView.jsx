import { useState } from "react";
import {
  Brain,
  ChevronDown,
  Lightbulb,
  Sparkles,
  Target,
  TrendingUp,
  AlertTriangle,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BrainSaveToolbar,
  FundamentalKnowledgePanel,
  GeneralUsefulKnowledgePanel,
  PoliticalKnowledgePanel,
} from "./KnowledgeBrainSections";

/** Safe text for Summary tab — avoids [object Object] when items are structured. */
export function formatSummaryDisplayText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const raw =
      value.text ??
      value.title ??
      value.summary ??
      value.content ??
      value.point ??
      value.insight ??
      value.description ??
      "";
    if (typeof raw === "string") return raw.trim();
    if (raw != null && typeof raw !== "object") return String(raw).trim();
    if (value.insight && value.whyImportant) {
      return `${String(value.insight).trim()} — ${String(value.whyImportant).trim()}`.trim();
    }
  }
  return "";
}

const CALLOUT_TONES = {
  indigo: {
    border: "border-indigo-200/90 dark:border-indigo-500/35",
    bg: "bg-gradient-to-l from-indigo-50/95 via-white to-white dark:from-indigo-950/50 dark:via-zinc-950 dark:to-zinc-950",
    title: "text-indigo-800 dark:text-indigo-200",
    icon: Target,
  },
  violet: {
    border: "border-violet-200/90 dark:border-violet-500/35",
    bg: "bg-gradient-to-l from-violet-50/95 via-white to-white dark:from-violet-950/50 dark:via-zinc-950 dark:to-zinc-950",
    title: "text-violet-800 dark:text-violet-200",
    icon: Lightbulb,
  },
  amber: {
    border: "border-amber-200/90 dark:border-amber-500/35",
    bg: "bg-gradient-to-l from-amber-50/95 via-white to-white dark:from-amber-950/40 dark:via-zinc-950 dark:to-zinc-950",
    title: "text-amber-900 dark:text-amber-200",
    icon: AlertTriangle,
  },
  emerald: {
    border: "border-emerald-200/90 dark:border-emerald-500/35",
    bg: "bg-gradient-to-l from-emerald-50/95 via-white to-white dark:from-emerald-950/40 dark:via-zinc-950 dark:to-zinc-950",
    title: "text-emerald-800 dark:text-emerald-200",
    icon: TrendingUp,
  },
  sky: {
    border: "border-sky-200/90 dark:border-sky-500/35",
    bg: "bg-gradient-to-l from-sky-50/95 via-white to-white dark:from-sky-950/40 dark:via-zinc-950 dark:to-zinc-950",
    title: "text-sky-800 dark:text-sky-200",
    icon: Cpu,
  },
};

function buildInsightCallouts(video) {
  const out = [];
  const push = (title, text, tone) => {
    const t = formatSummaryDisplayText(text);
    if (!t) return;
    out.push({ title, text: t, tone });
  };

  if (video?.mainLesson) push("השיעור המרכזי", video.mainLesson, "indigo");
  const thesis = Array.isArray(video?.thesis) ? video.thesis.filter(Boolean) : [];
  if (thesis[0]) push("מה באמת חשוב כאן", thesis[0], "violet");
  const ki = Array.isArray(video?.keyInsights) ? video.keyInsights.filter(Boolean) : [];
  if (ki[0]) push("המשמעות למשקיעים", ki[0], "emerald");
  const mistakes = Array.isArray(video?.mistakesToAvoid) ? video.mistakesToAvoid.filter(Boolean) : [];
  if (mistakes[0]) push("הטעות שרוב האנשים עושים", mistakes[0], "amber");
  const concepts = Array.isArray(video?.concepts) ? video.concepts.filter(Boolean) : [];
  const aiHint = concepts.find((c) => /ai|בינה|עתיד|טכנול/i.test(formatSummaryDisplayText(c)));
  if (aiHint) push("למה זה חשוב בעתיד AI", aiHint, "sky");
  else if (concepts[0] && out.length < 4) push("למה זה חשוב בעתיד AI", concepts[0], "sky");

  return out.slice(0, 4);
}

function collectKeyTakeaways(video, brainHighlights, max = 6) {
  const seen = new Set();
  const items = [];
  const add = (text) => {
    const t = formatSummaryDisplayText(text);
    if (!t || seen.has(t)) return;
    seen.add(t);
    items.push(t);
  };

  if (video?.mainClaim) add(video.mainClaim);
  const keyPoints = Array.isArray(video?.keyPoints) ? video.keyPoints : [];
  keyPoints.forEach((p) => add(p));
  (brainHighlights || []).forEach((p) => add(p));
  const ki = Array.isArray(video?.keyInsights) ? video.keyInsights : [];
  ki.forEach((p) => add(p));

  return items.slice(0, max);
}

function SummaryBadge({ children, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        className
      )}
    >
      {children}
    </span>
  );
}

function HeroSummaryBlock({ eyebrow, title, body, badge }) {
  if (!body && !title) return null;
  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-bl from-indigo-50 via-white to-violet-50/40 px-5 py-6 text-right shadow-sm dark:border-indigo-500/25 dark:from-indigo-950/50 dark:via-zinc-950 dark:to-violet-950/20"
      dir="rtl"
    >
      <div className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full bg-indigo-400/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-violet-400/10 blur-2xl" />
      <div className="relative space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300">
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wide">{eyebrow}</span>
          </div>
          {badge}
        </div>
        {title && (
          <h3 className="text-lg font-bold leading-snug text-slate-900 dark:text-zinc-50 sm:text-xl">
            {title}
          </h3>
        )}
        {body && (
          <p className="text-base leading-relaxed text-slate-700 dark:text-zinc-200 sm:text-[1.05rem]">
            {body}
          </p>
        )}
      </div>
    </section>
  );
}

function KeyTakeawaysSection({ items }) {
  if (!items?.length) return null;
  return (
    <section className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" aria-hidden />
        <h4 className="text-base font-bold text-slate-900 dark:text-zinc-100">תובנות מרכזיות</h4>
      </div>
      <ul className="space-y-3">
        {items.map((point, i) => (
          <li
            key={i}
            className="flex gap-4 rounded-xl border border-slate-100/90 bg-white/90 px-4 py-4 text-right shadow-sm dark:border-zinc-800/80 dark:bg-zinc-950/50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
              {i + 1}
            </span>
            <p className="min-w-0 flex-1 text-[0.95rem] leading-relaxed text-slate-800 dark:text-zinc-100 sm:text-base">
              {point}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InsightCalloutsSection({ callouts }) {
  if (!callouts?.length) return null;
  return (
    <section className="space-y-3" dir="rtl">
      <h4 className="text-sm font-semibold text-slate-500 dark:text-zinc-400">זוויות ניתוח</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        {callouts.map((c, i) => {
          const tone = CALLOUT_TONES[c.tone] || CALLOUT_TONES.violet;
          const Icon = tone.icon;
          return (
            <div
              key={i}
              className={cn("rounded-xl border px-4 py-3.5 text-right", tone.border, tone.bg)}
            >
              <div className={cn("mb-2 flex items-center gap-2 text-sm font-bold", tone.title)}>
                <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                {c.title}
              </div>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-zinc-300">{c.text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function NarrativeBodySection({ summaryLong, summaryShort }) {
  const body = formatSummaryDisplayText(summaryLong) || formatSummaryDisplayText(summaryShort);
  if (!body) return null;
  const isLong = Boolean(summaryLong);
  return (
    <section className="space-y-3" dir="rtl">
      <h4 className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
        {isLong ? "ניתוח מורחב" : "המשך הניתוח"}
      </h4>
      <div className="rounded-xl border border-slate-100 bg-white/60 px-5 py-5 dark:border-zinc-800/80 dark:bg-zinc-950/30">
        <p className="whitespace-pre-line text-[0.95rem] leading-[1.85] text-slate-800 dark:text-zinc-200 sm:text-base">
          {body}
        </p>
      </div>
    </section>
  );
}

function CollapsibleBrainSave({ title, hint, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className="rounded-xl border border-dashed border-slate-200/90 bg-slate-50/40 dark:border-zinc-700/80 dark:bg-zinc-950/30"
      dir="rtl"
    >
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-900/50"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Brain className="h-4 w-4 shrink-0 text-violet-500" aria-hidden />
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-700 dark:text-zinc-300">{title}</div>
            <div className="text-xs text-slate-500 dark:text-zinc-500 truncate">{hint}</div>
          </div>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="border-t border-slate-200/80 px-3 pb-3 pt-2 dark:border-zinc-800">{children}</div>}
    </section>
  );
}

const POLITICAL_SECTION_COLORS = {
  rose: "border-rose-200/90 bg-rose-50/70 dark:border-rose-800/50 dark:bg-rose-950/25",
  amber: "border-amber-200/90 bg-amber-50/70 dark:border-amber-800/50 dark:bg-amber-950/25",
  blue: "border-blue-200/90 bg-blue-50/70 dark:border-blue-800/50 dark:bg-blue-950/25",
};

function PoliticalNarrativeSections({ video, skipMainClaim = false }) {
  const pArgs = Array.isArray(video.politicalArguments)
    ? video.politicalArguments.filter(Boolean).map(formatSummaryDisplayText).filter(Boolean)
    : [];
  const pWeak = Array.isArray(video.weakPoints)
    ? video.weakPoints.filter(Boolean).map(formatSummaryDisplayText).filter(Boolean)
    : [];
  const pCounter = Array.isArray(video.counterArguments)
    ? video.counterArguments.filter(Boolean).map(formatSummaryDisplayText).filter(Boolean)
    : [];
  const pSocial = Array.isArray(video.socialMediaReplies)
    ? video.socialMediaReplies.filter(Boolean).map(formatSummaryDisplayText).filter(Boolean)
    : [];

  const block = (title, items, color) => {
    if (!items?.length && !title) return null;
    const list = items || [];
    if (!list.length) return null;
    return (
      <div className={cn("rounded-xl border px-4 py-4 text-right", POLITICAL_SECTION_COLORS[color])}>
        <h4 className="mb-3 text-sm font-bold text-slate-900 dark:text-zinc-100">{title}</h4>
        <ul className="space-y-2.5">
          {list.map((item, i) => (
            <li
              key={i}
              className="text-sm leading-relaxed text-slate-800 dark:text-zinc-200 border-r-2 border-rose-300/60 pr-3 dark:border-rose-500/40"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const single = (title, text, color) => {
    if (!text) return null;
    return (
      <div className={cn("rounded-xl border px-4 py-4 text-right", POLITICAL_SECTION_COLORS[color])}>
        <h4 className="mb-2 text-sm font-bold text-slate-900 dark:text-zinc-100">{title}</h4>
        <p className="text-base leading-relaxed text-slate-800 dark:text-zinc-200">{text}</p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {!skipMainClaim &&
        single("הטענה המרכזית", formatSummaryDisplayText(video.mainClaim) || null, "rose")}
      {single("עמדת הדובר", formatSummaryDisplayText(video.speakerPosition) || null, "amber")}
      {block("טיעונים תומכים", pArgs, "blue")}
      {block("חולשות בטיעון", pWeak, "amber")}
      {block("טיעוני נגד", pCounter, "rose")}
      {block("תגובות לרשתות", pSocial, "blue")}
    </div>
  );
}

const MB_EXISTING_INDICATORS_SUMMARY = ["SPX", "Nasdaq", "VIX", "Dollar", "Bitcoin", "Dow", "Russell"];

const MB_LABEL_MAP = {
  critical: "קריטי", important: "חשוב", watch: "מעקב",
  earnings: "דוחות", upgrade: "שדרוג", contract: "חוזה",
  macro: "מאקרו", technical: "טכני", sector: "סקטור",
  geopolitical: "גיאו-פוליטי", ipo: "הנפקה",
  buy: "קנייה", sell: "מכירה", hold: "החזקה",
  avoid: "הימנע", intraday: "תוך יומי", swing: "סווינג",
  longterm: "לטווח ארוך", positive: "חיובי", negative: "שלילי",
  mixed: "מעורב", uncertain: "לא ברור", bullish: "שורי", bearish: "דובי",
  realtime: "זמן אמת", daily: "יומי", weekly: "שבועי",
  high: "גבוה", medium: "בינוני", low: "נמוך",
  above: "מעל", below: "מתחת", crosses: "חוצה",
  support: "תמיכה", resistance: "התנגדות", target: "יעד", stop: "סטופ",
  semiconductors: "שבבים", software: "תוכנה",
};
function translateLabel(val) {
  if (!val || typeof val !== "string") return val;
  return MB_LABEL_MAP[val.toLowerCase()] || MB_LABEL_MAP[val] || val;
}

function MarketBriefSummaryPanel({ video, onSaveSection }) {
  const analysis = video?.analysis || {};
  const { briefDate, marketSession, channelName, duration: dur } = analysis;
  const mo = analysis.marketOverview || {};
  const top5Insights = Array.isArray(analysis.top5Insights) ? analysis.top5Insights : [];
  const highStocks = (analysis.stocksMentioned || []).filter((s) => s?.priority === "high");
  const allMacros = analysis.macroFactors || [];
  const appBuilding = analysis.appBuilding || {};
  const allNewIndicators = (appBuilding.newIndicators || []).filter((ind) => ind?.isNew);
  const dashboardIdeas = Array.isArray(appBuilding.dashboardIdeas) ? appBuilding.dashboardIdeas : [];
  const existingIndicators = Array.isArray(appBuilding.existingIndicators)
    ? appBuilding.existingIndicators
    : MB_EXISTING_INDICATORS_SUMMARY;

  const [insightSels, setInsightSels] = useState(() =>
    Object.fromEntries(top5Insights.map((_, i) => [i, true]))
  );
  const [stockSels, setStockSels] = useState({});
  const [macroSels, setMacroSels] = useState({});
  const [appSels, setAppSels] = useState({});

  const toggle = (setter, key) => setter((p) => ({ ...p, [key]: !p[key] }));

  const marketItems = [
    { name: "SPX",      ...(mo.spx      || {}) },
    { name: "Nasdaq",   ...(mo.nasdaq   || {}) },
    { name: "Dow",      ...(mo.dow      || {}) },
    { name: "Russell",  ...(mo.russell  || {}) },
    { name: "VIX",      ...(mo.vix      || {}) },
    { name: "Dollar",   ...(mo.dollar   || {}) },
    { name: "Bitcoin",  ...(mo.bitcoin  || {}) },
    { name: "Oil",      ...(mo.oil      || {}) },
    { name: "אגח 10Y",  ...(mo.bonds10y || {}) },
  ].filter((item) => item.direction || item.change || item.level);

  const sessionLabel =
    marketSession === "premarket"   ? "📅 מבזק פתיחה" :
    marketSession === "close"       ? "📅 מבזק סגירה" :
    marketSession === "afterhours"  ? "🌙 לייט נייט"  :
                                      "📅 מבזק";

  const dirIcon = (dir) => (dir === "up" ? "🟢" : dir === "down" ? "🔴" : "🟡");
  const changeColor = (change) => {
    const s = String(change || "");
    if (!s) return "text-slate-600 dark:text-zinc-400";
    if (s.startsWith("+") || s.startsWith("▲")) return "text-emerald-600 dark:text-emerald-400";
    if (s.startsWith("-") || s.startsWith("▼")) return "text-red-600 dark:text-red-400";
    return "text-slate-600 dark:text-zinc-400";
  };
  const actionLabel = (a) => (a === "buy" ? "🟢 קנייה" : a === "sell" ? "🔴 מכירה" : "👁️ מעקב");
  const impactIcon = (imp) => (imp === "positive" ? "🟢" : imp === "negative" ? "🔴" : "🟡");
  const sigBadgeCls = (sig) =>
    sig === "critical"  ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" :
    sig === "important" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" :
                          "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300";

  const copyPrompt = (ind) => {
    const text = ind.claudeCodePrompt ||
      `Build a React component named ${ind.componentSuggestion || "IndicatorCard"} that displays ${ind.name || ""} (${ind.ticker || ""}) with RTL Hebrew UI. Show current value (${ind.value || "N/A"}), trend indicator, styled for a financial dashboard. Data source: ${ind.source || "N/A"}, update frequency: ${ind.updateFrequency || "N/A"}.`;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const handleSave = (items, title) => {
    if (onSaveSection) onSaveSection(items, title);
  };

  const SC  = "rounded-xl border border-slate-200 dark:border-zinc-700/80 overflow-hidden";
  const SH  = "px-4 py-3 bg-slate-50 dark:bg-zinc-900/50 border-b border-slate-200 dark:border-zinc-700";
  const TH  = "px-3 py-2 text-sm font-semibold text-slate-700 dark:text-zinc-200 border-b border-slate-200 dark:border-zinc-700 text-right bg-slate-50/80 dark:bg-zinc-900/40";
  const TD  = "px-3 py-2.5 text-[15px] text-right";
  const TR  = "even:bg-slate-50/70 dark:even:bg-zinc-900/30 hover:bg-slate-100/50 dark:hover:bg-zinc-800/30 transition-colors";
  const saveBtn = "mt-3 flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 transition-colors";
  const CB  = "h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer";
  const CBH = "w-10 px-3 py-2 border-b border-slate-200 dark:border-zinc-700 bg-slate-50/80 dark:bg-zinc-900/40";

  return (
    <div className="space-y-5" dir="rtl">
      {/* Section 1 — Header */}
      <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-bl from-amber-50 via-white to-white px-5 py-5 dark:border-amber-800/40 dark:from-amber-950/30 dark:via-zinc-950 dark:to-zinc-950">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">
          {sessionLabel}{briefDate ? ` — ${briefDate}` : ""}
        </h2>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600 dark:text-zinc-400">
          {channelName && <span>📺 {channelName}</span>}
          {dur && <span>⏱️ {dur}</span>}
        </div>
      </div>

      {/* Section 2 — מדדים (no checkboxes) */}
      {marketItems.length > 0 && (
        <div className={SC}>
          <div className={SH}>
            <span className="text-base font-bold text-slate-900 dark:text-zinc-100">📊 מדדים</span>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className={TH}>מדד</th>
                <th className={TH}>שינוי</th>
                <th className={TH}>רמה</th>
                <th className={TH}>מצב</th>
              </tr>
            </thead>
            <tbody>
              {marketItems.map((item, i) => (
                <tr key={i} className={TR}>
                  <td className={cn(TD, "font-semibold text-slate-900 dark:text-zinc-100")}>{item.name}</td>
                  <td className={cn(TD, changeColor(item.change))}>{item.change || "—"}</td>
                  <td className={TD}>{item.level || "—"}</td>
                  <td className={TD}>{dirIcon(item.direction)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Section 3 — ⭐ 5 תובנות למעקב */}
      {top5Insights.length > 0 && (
        <div className={SC}>
          <div className={SH}>
            <span className="text-base font-bold text-slate-900 dark:text-zinc-100">⭐ 5 תובנות למעקב</span>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className={CBH}></th>
                <th className={TH}>#</th>
                <th className={TH}>נכס</th>
                <th className={TH}>רמה</th>
                <th className={TH}>חשיבות</th>
                <th className={TH}>הערה</th>
              </tr>
            </thead>
            <tbody>
              {top5Insights.map((item, i) => (
                <tr key={i} className={TR}>
                  <td className="px-3 py-2.5 text-center">
                    <input type="checkbox" checked={!!insightSels[i]} onChange={() => toggle(setInsightSels, i)} className={CB} />
                  </td>
                  <td className={cn(TD, "text-slate-400 dark:text-zinc-500 text-[13px]")}>{item.rank || i + 1}</td>
                  <td className={cn(TD, "font-semibold text-slate-900 dark:text-zinc-100")}>
                    {item.ticker || item.asset || "—"}
                  </td>
                  <td className={TD}>{item.level || "—"}</td>
                  <td className={TD}>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", sigBadgeCls(item.significance))}>
                      {translateLabel(item.significance) || "—"}
                    </span>
                  </td>
                  <td className={cn(TD, "text-slate-600 dark:text-zinc-400 text-[13px] max-w-[200px]")}>{item.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-3">
            <button className={saveBtn} onClick={() => handleSave(top5Insights.filter((_, i) => insightSels[i]).map((item) => ({ ...item, _type: "level" })), "⭐ תובנות למעקב")}>
              💾 שמור נבחרים למוח
            </button>
          </div>
        </div>
      )}

      {/* Section 4 — 📈 מניות בולטות */}
      {highStocks.length > 0 && (
        <div className={SC}>
          <div className={SH}>
            <span className="text-base font-bold text-slate-900 dark:text-zinc-100">📈 מניות בולטות</span>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className={CBH}></th>
                <th className={TH}>טיקר</th>
                <th className={TH}>שינוי</th>
                <th className={TH}>פעולה</th>
                <th className={TH}>קטליסט</th>
                <th className={TH}>סיבה</th>
              </tr>
            </thead>
            <tbody>
              {highStocks.map((s, i) => (
                <tr key={i} className={TR}>
                  <td className="px-3 py-2.5 text-center">
                    <input type="checkbox" checked={!!stockSels[i]} onChange={() => toggle(setStockSels, i)} className={CB} />
                  </td>
                  <td className={cn(TD, "font-semibold text-slate-900 dark:text-zinc-100")}>
                    {s.ticker}
                    {s.nameHebrew && (
                      <span className="mr-1.5 text-xs font-normal text-slate-500 dark:text-zinc-400">{s.nameHebrew}</span>
                    )}
                  </td>
                  <td className={cn(TD, changeColor(s.change))}>{s.change || "—"}</td>
                  <td className={TD}>{actionLabel(s.action)}</td>
                  <td className={TD}>
                    {s.catalyst && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {translateLabel(s.catalyst)}
                      </span>
                    )}
                  </td>
                  <td className={cn(TD, "text-slate-600 dark:text-zinc-400 text-[13px] max-w-[180px]")}>{s.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-3">
            <button className={saveBtn} onClick={() => handleSave(highStocks.filter((_, i) => stockSels[i]).map((s) => ({ ...s, _type: "stock" })), "📈 מניות בולטות")}>
              💾 שמור נבחרים למוח
            </button>
          </div>
        </div>
      )}

      {/* Section 5 — 🌍 מאקרו */}
      {allMacros.length > 0 && (
        <div className={SC}>
          <div className={SH}>
            <span className="text-base font-bold text-slate-900 dark:text-zinc-100">🌍 מאקרו</span>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className={CBH}></th>
                <th className={TH}>גורם</th>
                <th className={TH}>סטטוס</th>
                <th className={TH}>השפעה</th>
                <th className={TH}>הערה</th>
              </tr>
            </thead>
            <tbody>
              {allMacros.map((m, i) => (
                <tr key={i} className={TR}>
                  <td className="px-3 py-2.5 text-center">
                    <input type="checkbox" checked={!!macroSels[i]} onChange={() => toggle(setMacroSels, i)} className={CB} />
                  </td>
                  <td className={cn(TD, "font-semibold text-slate-900 dark:text-zinc-100")}>{m.factor}</td>
                  <td className={cn(TD, "text-slate-600 dark:text-zinc-400")}>{m.status || "—"}</td>
                  <td className={TD}>{impactIcon(m.impact)}</td>
                  <td className={cn(TD, "text-[13px] text-slate-500 dark:text-zinc-500 max-w-[160px]")}>{m.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-3">
            <button className={saveBtn} onClick={() => handleSave(allMacros.filter((_, i) => macroSels[i]).map((m) => ({ ...m, _type: "macro" })), "🌍 גורמי מאקרו")}>
              💾 שמור נבחרים למוח
            </button>
          </div>
        </div>
      )}

      {/* Section 6 — 🏗️ לאפליקציה */}
      <div className={SC}>
        <div className={SH}>
          <span className="text-base font-bold text-slate-900 dark:text-zinc-100">🏗️ לאפליקציה</span>
        </div>

        {allNewIndicators.length > 0 ? (
          <>
            <table className="w-full">
              <thead>
                <tr>
                  <th className={CBH}></th>
                  <th className={TH}>מדד</th>
                  <th className={TH}>ערך</th>
                  <th className={TH}>למה שימושי</th>
                  <th className={TH}>קומפוננטה</th>
                </tr>
              </thead>
              <tbody>
                {allNewIndicators.map((ind, i) => (
                  <tr key={i} className={TR}>
                    <td className="px-3 py-2.5 text-center">
                      <input type="checkbox" checked={!!appSels[i]} onChange={() => toggle(setAppSels, i)} className={CB} />
                    </td>
                    <td className={cn(TD, "font-semibold text-slate-900 dark:text-zinc-100")}>
                      <div className="flex items-center gap-1.5">
                        <span>{ind.ticker}</span>
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          ✨ חדש
                        </span>
                      </div>
                    </td>
                    <td className={TD}>{ind.value || "—"}</td>
                    <td className={cn(TD, "text-[13px] text-slate-600 dark:text-zinc-400 max-w-[150px]")}>{ind.whyUseful || "—"}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-600 dark:text-zinc-400">{ind.componentSuggestion || "—"}</span>
                        <button
                          onClick={() => copyPrompt(ind)}
                          title="העתק פרומפט"
                          className="rounded p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
                        >
                          📋
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 pb-3">
              <button className={saveBtn} onClick={() => handleSave(allNewIndicators.filter((_, i) => appSels[i]).map((ind) => ({ ...ind, _type: "indicator" })), "🏗️ לאפליקציה")}>
                💾 שמור נבחרים למוח
              </button>
            </div>
          </>
        ) : (
          <div className="px-4 py-4 text-sm text-slate-400 dark:text-zinc-500">⚪ אין מדדים חדשים לאפליקציה בסרטון זה</div>
        )}

        {/* Dashboard ideas */}
        {dashboardIdeas.length > 0 && (
          <div className="border-t border-slate-200 dark:border-zinc-700 px-4 py-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">💡 רעיונות לדשבורד</h4>
            {dashboardIdeas.map((idea, i) => (
              <div key={i} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{idea.component}</p>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">{idea.idea}</p>
                    {idea.whyUseful && (
                      <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">{idea.whyUseful}</p>
                    )}
                  </div>
                  {idea.claudeCodePrompt && (
                    <button
                      onClick={() => navigator.clipboard.writeText(idea.claudeCodePrompt).catch(() => {})}
                      title="העתק פרומפט"
                      className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors text-sm"
                    >
                      📋 העתק פרומפט
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Existing indicators */}
        <div className="border-t border-slate-200 dark:border-zinc-700 px-4 py-3">
          <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-zinc-400">✅ כבר בדשבורד:</p>
          <div className="flex flex-wrap gap-1.5">
            {existingIndicators.map((name) => (
              <span key={name} className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FundamentalNarrativeSections({ video, summaryShort, skipMainLesson = false }) {
  const mainLessonText = formatSummaryDisplayText(video.mainLesson);
  const shortText = formatSummaryDisplayText(summaryShort);
  return (
    <div className="space-y-4">
      {mainLessonText && !skipMainLesson && (
        <div className="rounded-2xl border border-green-200/90 bg-gradient-to-bl from-green-50/90 to-white px-5 py-5 text-right dark:border-green-800/50 dark:from-green-950/40 dark:to-zinc-950">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-800 dark:text-green-300">
            השיעור המרכזי
          </h4>
          <p className="text-base leading-relaxed text-slate-800 dark:text-zinc-100">{mainLessonText}</p>
        </div>
      )}
      {shortText && (
        <p className="text-base leading-relaxed text-slate-800 dark:text-zinc-200 text-right">{shortText}</p>
      )}
    </div>
  );
}

/** Narrative AI-style Summary tab — presentation only; save logic stays in child panels. */
export function SummaryTabView({
  video,
  summaryShort,
  summaryLong,
  brainHighlights = [],
  analysisModeBadge = null,
  variant = "general",
  // general save
  selectedItems,
  persistSelectedItems,
  totalSelectedKnowledgeItems,
  onOpenBulkSave,
  // political
  politicalPanelProps = null,
  // fundamental
  fundamentalPanelProps = null,
  fundamentalSummaryShort = null,
  // marketBrief
  marketBriefSaveProps = null,
  footer = null,
}) {
  if (variant === "marketBrief") {
    return (
      <div className="mx-auto w-full max-w-[860px] space-y-5 pb-4" dir="rtl">
        <div className="flex justify-end">
          <SummaryBadge className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            📰 מבזק בוקר
          </SummaryBadge>
        </div>
        <MarketBriefSummaryPanel
          video={video}
          onSaveSection={marketBriefSaveProps?.onSaveSection}
        />
        {footer}
      </div>
    );
  }
  const callouts = buildInsightCallouts(video);
  const takeaways = collectKeyTakeaways(video, brainHighlights);
  const heroTitle =
    video?.title?.trim() ||
    (variant === "political" && video?.mainClaim ? "הטענה במרכז הדיון" : null) ||
    (variant === "fundamental" && video?.mainLesson ? "תמצית הניתוח" : null) ||
    "תמצית הניתוח";
  const heroBody =
    formatSummaryDisplayText(summaryShort) ||
    (variant === "political" && video?.mainClaim ? formatSummaryDisplayText(video.mainClaim) : null) ||
    (variant === "fundamental" && video?.mainLesson ? formatSummaryDisplayText(video.mainLesson) : null) ||
    takeaways[0] ||
    null;

  const showGeneralSave =
    variant === "general" &&
    (brainHighlights.length > 0 || (Array.isArray(video?.keyPoints) && video.keyPoints.length > 0));

  return (
    <div className="mx-auto w-full max-w-[820px] space-y-8 pb-4" dir="rtl">
      {variant === "political" && (
        <div className="flex justify-end">
          <SummaryBadge className="border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            ניתוח פוליטי
          </SummaryBadge>
        </div>
      )}
      {variant === "fundamental" && (
        <div className="flex justify-end">
          <SummaryBadge className="border-green-300 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300">
            ניתוח יסודות
          </SummaryBadge>
        </div>
      )}

      <HeroSummaryBlock
        eyebrow="ניתוח AI"
        title={heroTitle}
        body={heroBody}
        badge={analysisModeBadge}
      />

      {variant === "political" && (
        <PoliticalNarrativeSections
          video={video}
          skipMainClaim={Boolean(
            summaryShort ||
              (heroBody && video?.mainClaim && formatSummaryDisplayText(video.mainClaim) === heroBody)
          )}
        />
      )}
      {variant === "fundamental" && (
        <FundamentalNarrativeSections
          video={video}
          summaryShort={fundamentalSummaryShort || summaryShort}
          skipMainLesson={Boolean(
            video?.mainLesson &&
              (heroBody === formatSummaryDisplayText(video.mainLesson) ||
                (!summaryShort && !fundamentalSummaryShort))
          )}
        />
      )}

      {variant === "general" && <KeyTakeawaysSection items={takeaways} />}
      {variant === "general" && <InsightCalloutsSection callouts={callouts} />}
      {variant === "general" && (
        <NarrativeBodySection summaryLong={summaryLong} summaryShort={summaryShort && summaryLong ? null : summaryShort} />
      )}

      {(variant === "political" || variant === "fundamental") && summaryLong && (
        <NarrativeBodySection summaryLong={summaryLong} summaryShort={null} />
      )}

      {showGeneralSave && (
        <CollapsibleBrainSave
          title="שמירה למוח"
          hint="בחירת פריטים לשמירה — אופציונלי, לא חלק מהסיכום"
        >
          <GeneralUsefulKnowledgePanel
            video={video}
            brainHighlights={brainHighlights}
            selectedItems={selectedItems}
            persistSelectedItems={persistSelectedItems}
            totalSelectedKnowledgeItems={totalSelectedKnowledgeItems}
            onOpenBulkSave={onOpenBulkSave}
            showToolbar
          />
        </CollapsibleBrainSave>
      )}

      {variant === "political" && politicalPanelProps && (
        <CollapsibleBrainSave title="שמירה למוח" hint="סמן קטעים מהניתוח הפוליטי לשמירה">
          <PoliticalKnowledgePanel {...politicalPanelProps} showToolbar />
        </CollapsibleBrainSave>
      )}

      {variant === "fundamental" && fundamentalPanelProps && (
        <CollapsibleBrainSave title="שמירה למוח" hint="סמן ידע מובנה לשמירה">
          <FundamentalKnowledgePanel {...fundamentalPanelProps} showToolbar />
        </CollapsibleBrainSave>
      )}

      {footer}
    </div>
  );
}
