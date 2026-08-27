import React, { useState, useEffect, useCallback, useId, useMemo, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ExternalLink, Settings, Copy, Save, Check, AlertCircle, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogPortal } from "@/components/ui/dialog";
import {
  getGemUrl,
  isGeminiGemUrl,
  MARKET_BRIEF_GEM_KEY,
  MARKET_BRIEF_GEM_LABEL,
  openGeminiGemUrl,
  saveGemConfigSnapshot,
} from "@/lib/gemsConfig";
import {
  isMarketBriefWorkflowVideo,
  resolveWorkflowGemRecommendation,
  resolveWorkflowGemSelection,
} from "@/lib/gemRecommender";
import { GemsSettingsModal } from "./GemsSettingsModal";
import { cn } from "@/lib/utils";
import { loadTopics } from "@/services/topicStorage";

// ── Fixed GEM definitions ─────────────────────────────────────────────────────

const FIXED_GEMS_TOP = [
  { key: "general",   label: "כללי",   icon: "✨", description: "ניתוח כללי לכל תוכן — מתאים לסרטונים ללא קטגוריה ספציפית" },
  { key: "political", label: "פוליטי", icon: "🏛️", description: "ניתוח פוליטי, ביטחוני, אסטרטגי ודיפלומטי" },
];

// Daily market workflow GEMS — grouped under "GEMS TJS"
const TJS_GEMS = [
  { key: "news",       label: "מבזק בוקר", icon: "📰", description: "עיבוד מבזקי בוקר, סיכומי שוק ועדכוני יום" },
  { key: "macro",      label: "מאקרו",      icon: "🌐", description: "ניתוח מאקרו-כלכלי — ריבית, אינפלציה, מדיניות מוניטרית" },
  { key: "dayTrading", label: "מסחר יומי",  icon: "🗓️", description: "אסטרטגיות מסחר יומי, סקאלפינג ועסקאות קצרות טווח" },
  { key: "appBuilder", label: "AP Builder", icon: "🏗️", description: "פיתוח אפליקציות, קוד, React ובינה מלאכותית" },
];

const MARKET_BRIEF_GEM = {
  key: MARKET_BRIEF_GEM_KEY,
  label: MARKET_BRIEF_GEM_LABEL,
  icon: "📰",
  description: "Gem משותף למבזקי לייב, בוקר ולייט נייט",
};

// Learning / knowledge GEMS — rendered as individual rows outside GEMS TJS
const KNOWLEDGE_MARKET_GEMS = [
  { key: "technical",   label: "ניתוח טכני", icon: "📉", description: "ניתוח טכני של גרפים, מגמות ונקודות כניסה ויציאה" },
  { key: "fundamental", label: "פונדמנטלי",   icon: "📊", description: "ניתוח פונדמנטלי של חברות, מניות וביצועים פיננסיים" },
];

const TJS_GEM_KEYS = new Set(TJS_GEMS.map((g) => g.key));
const BRIEF_WORKFLOW_HIDDEN_LABELS = new Set(["מבזק בוקר", "מאקרו", "מסחר יומי", "AP Builder"]);
const ALL_FIXED_GEMS = [...FIXED_GEMS_TOP, MARKET_BRIEF_GEM, ...TJS_GEMS, ...KNOWLEDGE_MARKET_GEMS];

// Keys that use saveGemConfigSnapshot (vs. direct localStorage for dynamic topics)
const FIXED_GEM_KEYS = new Set(ALL_FIXED_GEMS.map((g) => g.key));

const shouldExpandAdditionalOptions = ({ isMarketBriefWorkflow, savedGemKey }) =>
  isMarketBriefWorkflow && Boolean(savedGemKey) && savedGemKey !== MARKET_BRIEF_GEM_KEY;

// Topic IDs already covered by fixed GEMs — excluded from dynamic list
const EXCLUDED_TOPIC_IDS = new Set(["t2", "t_pol"]);

// ── Topic emoji mapping ───────────────────────────────────────────────────────

const TOPIC_ID_TO_EMOJI = { t1: "🤖", t_health: "💚", t_personal: "💡" };
const TOPIC_COLOR_TO_EMOJI = { violet: "🔮", green: "🌿", amber: "✨", blue: "💙", red: "❤️", cyan: "🌊" };

function getTopicEmoji(topic) {
  return TOPIC_ID_TO_EMOJI[topic.id] || TOPIC_COLOR_TO_EMOJI[topic.color] || "🏷️";
}

// ── URL helpers ───────────────────────────────────────────────────────────────

function validateUrl(raw) {
  const v = raw.trim();
  if (!v) return "יש להזין כתובת URL";
  if (!v.startsWith("https://")) return "ה-URL חייב להתחיל ב-https://";
  if (!isGeminiGemUrl(v)) return "יש להזין URL תקין של Gemini GEM בפורמט https://gemini.google.com/gem/...";
  return null;
}

function readAnyGemUrl(key) {
  if (FIXED_GEM_KEYS.has(key)) return getGemUrl(key);
  try {
    const individual = localStorage.getItem(`gemUrl.${key}`) || "";
    if (individual) return individual;
    const blob = JSON.parse(localStorage.getItem("gems_config") || "{}");
    return blob[key] || "";
  } catch { return ""; }
}

function saveAnyGemUrl(key, url) {
  const v = url.trim();
  if (FIXED_GEM_KEYS.has(key)) { saveGemConfigSnapshot({ [key]: v }); return; }
  try { localStorage.setItem(`gemUrl.${key}`, v); } catch {}
  try {
    const blob = JSON.parse(localStorage.getItem("gems_config") || "{}");
    blob[key] = v;
    localStorage.setItem("gems_config", JSON.stringify(blob));
  } catch {}
}

// ── Category logic ────────────────────────────────────────────────────────────

function getCategoryForKey(key, dynamicGems) {
  if (key === "political") return "political";
  if (key === "general") return "general";
  if (TJS_GEM_KEYS.has(key)) return "tjs";
  if (dynamicGems.some((g) => g.key === key)) return key;
  return "general";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GemSelectionModal({
  open,
  onOpenChange,
  video,
  topics = [],
  recommendedGemKey,
  savedGemKey,
  onSave,
  fullTranscriptText = "",
  onGemOpened = null,
  onGemSummaryPaste = null,
  tjsRecommendation = null,
}) {
  const isMarketBriefWorkflow = isMarketBriefWorkflowVideo(video);
  const workflowRecommendedGemKey = resolveWorkflowGemRecommendation(video, recommendedGemKey);
  const initialSelection = resolveWorkflowGemSelection({ video, savedGemKey, recommendedGemKey });
  const additionalOptionsId = useId();
  const [selected, setSelected]                 = useState(initialSelection);
  const [gemUrls, setGemUrls]                   = useState(() => {
    const urls = {};
    ALL_FIXED_GEMS.forEach((g) => { urls[g.key] = readAnyGemUrl(g.key); });
    return urls;
  });
  const [isConfiguringUrl, setIsConfiguringUrl] = useState(false);
  const [urlDraft, setUrlDraft]                 = useState("");
  const [urlError, setUrlError]                 = useState("");
  const [justSaved, setJustSaved]               = useState(false);
  const [showAllGems, setShowAllGems]           = useState(false);
  const [dynamicTopicGems, setDynamicTopicGems] = useState([]);
  const [gemWaiting, setGemWaiting]             = useState(false);
  const [summaryReceived, setSummaryReceived]   = useState(() => Boolean(video?.gemSummary));
  const [isSummaryPasteOpen, setIsSummaryPasteOpen] = useState(false);
  const [summaryDraft, setSummaryDraft]         = useState('');
  const [summaryError, setSummaryError]         = useState('');
  const [showAdditionalOptions, setShowAdditionalOptions] = useState(() =>
    shouldExpandAdditionalOptions({ isMarketBriefWorkflow, savedGemKey })
  );
  const wasOpenRef = useRef(false);
  const [expandedCategory, setExpandedCategory] = useState(() =>
    getCategoryForKey(initialSelection, [])
  );

  // Load dynamic topic-based GEMs
  useEffect(() => {
    try {
      const allTopics = loadTopics();
      const dynamic = allTopics
        .filter((t) => t.isMainCategory && t.parentId === null && !EXCLUDED_TOPIC_IDS.has(t.id))
        .map((t) => ({
          key: `topic_${t.id}`,
          label: t.name,
          icon: getTopicEmoji(t),
          description: t.description || `ניתוח תוכן בנושא ${t.name}`,
        }));
      setDynamicTopicGems(dynamic);
      if (dynamic.length > 0) {
        setGemUrls((prev) => {
          const urls = { ...prev };
          dynamic.forEach((g) => { urls[g.key] = readAnyGemUrl(g.key); });
          return urls;
        });
      }
    } catch {}
  }, []);

  const refreshUrls = useCallback(() => {
    setGemUrls(() => {
      const urls = {};
      ALL_FIXED_GEMS.forEach((g) => { urls[g.key] = readAnyGemUrl(g.key); });
      dynamicTopicGems.forEach((g) => { urls[g.key] = readAnyGemUrl(g.key); });
      return urls;
    });
  }, [dynamicTopicGems]);

  // Reset state when modal opens
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (justOpened) {
      const initialKey = resolveWorkflowGemSelection({ video, savedGemKey, recommendedGemKey });
      setSelected(initialKey);
      setIsConfiguringUrl(false);
      setUrlDraft("");
      setUrlError("");
      setJustSaved(false);
      refreshUrls();
      setExpandedCategory(getCategoryForKey(initialKey, dynamicTopicGems));
      setShowAdditionalOptions(
        shouldExpandAdditionalOptions({ isMarketBriefWorkflow, savedGemKey })
      );
      const vid = video?.id;
      const alreadyHasSummary = Boolean(video?.gemSummary);
      setSummaryReceived(alreadyHasSummary);
      setGemWaiting(!alreadyHasSummary && (vid ? localStorage.getItem(`gem-summary-waiting-${vid}`) === 'true' : false));
      setIsSummaryPasteOpen(false);
      setSummaryDraft('');
      setSummaryError('');
    }
  }, [open, savedGemKey, recommendedGemKey, refreshUrls, video]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isConfiguringUrl) {
      setUrlDraft(gemUrls[selected] || "");
      setUrlError("");
    }
  }, [selected, isConfiguringUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const allGems        = useMemo(() => [...ALL_FIXED_GEMS, ...dynamicTopicGems], [dynamicTopicGems]);
  const visibleDynamicTopicGems = isMarketBriefWorkflow
    ? dynamicTopicGems.filter((gem) => !BRIEF_WORKFLOW_HIDDEN_LABELS.has(gem.label))
    : dynamicTopicGems;
  const selectedGem    = allGems.find((g) => g.key === selected) || FIXED_GEMS_TOP[0];
  const selectedGemUrl = getGemUrl(selected) || gemUrls[selected] || "";
  const isAiRec        = selected === workflowRecommendedGemKey;
  const isSavedSel     = selected === savedGemKey;
  const hasUnsaved     = selected !== initialSelection;
  const category       = topics[0]?.name || video?.category || "";
  const subCategory    = topics[1]?.name || video?.subCategory || "";
  const recommendedGem = allGems.find((g) => g.key === workflowRecommendedGemKey);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelect = (key) => {
    setSelected(key);
    setIsConfiguringUrl(false);
    setUrlError("");
  };

  const handleOpenGem = async () => {
    const resolvedGemUrl = getGemUrl(selected) || gemUrls[selected] || "";
    if (!resolvedGemUrl || !isGeminiGemUrl(resolvedGemUrl)) {
      setIsConfiguringUrl(true);
      toast.error(`לא מוגדר URL ל-GEM ${selectedGem.label}. פתח ניהול GEMS והוסף קישור.`);
      return;
    }
    if (!fullTranscriptText) {
      if (!openGeminiGemUrl(resolvedGemUrl)) {
        toast.error(`לא ניתן לפתוח את ה-GEM ${selectedGem.label}.`);
        return;
      }
      toast.error("אין תמלול להעתקה — ה-GEM נפתח ללא תוכן");
      return;
    }
    const payload = [
      `Title: ${video?.title || ""}`,
      `Channel: ${video?.channelTitle || video?.channelName || ""}`,
      `Category: ${category}`,
      `SubCategory: ${subCategory}`,
      "",
      "JSON output requirements:",
      'Return one complete strict JSON object. Escape every ASCII double quote inside a string value as \\".',
      "Include every required comma between adjacent JSON properties and array items.",
      "",
      "Transcript:",
      fullTranscriptText,
    ].join("\n");
    // Start both privileged browser operations synchronously from the click.
    // Awaiting clipboard first can consume transient user activation and cause
    // the subsequent window.open call to be blocked as a popup.
    let clipboardPromise = null;
    try {
      clipboardPromise = navigator.clipboard.writeText(payload);
    } catch { /* Keep opening the selected GEM and report the copy failure below. */ }
    const gemOpened = openGeminiGemUrl(resolvedGemUrl);
    if (!gemOpened) {
      if (clipboardPromise) await clipboardPromise.catch(() => {});
      toast.error(`לא ניתן לפתוח את ה-GEM ${selectedGem.label}.`);
      return;
    }
    console.log("[MorningBriefing] GEM opened:", selected);
    try {
      if (!clipboardPromise) throw new Error("Clipboard unavailable");
      await clipboardPromise;
      toast.success("✓ ה-GEM נפתח והתמלול הועתק — הדבק עם Ctrl+V");
    } catch {
      toast.error("ה-GEM נפתח, אך לא ניתן להעתיק ללוח — השתמש בכפתור ההעתקה הנפרד");
    }
    onGemOpened?.(selected);
    if (!summaryReceived) {
      setGemWaiting(true);
      if (video?.id) localStorage.setItem(`gem-summary-waiting-${video.id}`, 'true');
    }
  };

  const handleSaveGem = async () => {
    if (!onSave) return;
    await onSave(selected);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  };

  const handleSaveUrl = () => {
    const err = validateUrl(urlDraft);
    if (err) { setUrlError(err); return; }
    saveAnyGemUrl(selected, urlDraft.trim());
    setIsConfiguringUrl(false);
    setUrlError("");
    refreshUrls();
    toast.success(`URL עודכן ל-${selectedGem.label}`);
  };

  const handleCancelUrl = () => { setIsConfiguringUrl(false); setUrlDraft(""); setUrlError(""); };

  const handleCopyOnly = async () => {
    if (!fullTranscriptText) { toast.error("אין תמלול"); return; }
    try { await navigator.clipboard.writeText(fullTranscriptText); toast.success("התמלול הועתק"); }
    catch { toast.error("לא ניתן להעתיק"); }
  };

  const handleManageAll  = () => { setIsConfiguringUrl(false); setShowAllGems(true); };
  const handleAllGemsClose = (v) => { setShowAllGems(v); if (!v) refreshUrls(); };

  const toggleCategory = (id) => setExpandedCategory((prev) => prev === id ? null : id);

  // ── Child gem row (inside accordion) ─────────────────────────────────────

  const renderChildRow = (gem) => {
    const isSel    = gem.key === selected;
    const isRec    = gem.key === workflowRecommendedGemKey;
    const isSavedK = gem.key === savedGemKey;
    const hasUrl   = isGeminiGemUrl(gemUrls[gem.key] || getGemUrl(gem.key) || "");
    const tjsScore = tjsRecommendation?.scores?.[gem.key];
    const showScore = tjsScore != null && tjsScore > 0;
    return (
      <button
        key={gem.key}
        type="button"
        onClick={() => handleSelect(gem.key)}
        className={cn(
          "w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-right transition-all",
          isSel
            ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
            : isRec
            ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-200"
            : "border-slate-100 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/60 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300"
        )}
      >
        <span className="text-sm leading-none shrink-0">{gem.icon}</span>
        <span className="text-xs font-semibold flex-1 text-right">{gem.label}</span>
        {isRec && (
          <span className="rounded-full bg-amber-400 text-[8px] font-bold text-white px-1.5 py-0.5 shrink-0">
            AI מומלץ{showScore ? ` ${tjsScore}%` : ''}
          </span>
        )}
        {!isRec && showScore && (
          <span className={cn(
            "rounded-full text-[8px] font-semibold px-1.5 py-0.5 shrink-0",
            isSel ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
          )}>
            {tjsScore}%
          </span>
        )}
        {isSavedK && !isSel && <span className="rounded-full bg-emerald-500 text-[8px] font-bold text-white px-1.5 py-0.5 shrink-0">✓</span>}
        {!hasUrl && <span className="text-[9px] opacity-50 shrink-0" title="אין URL">⚠</span>}
      </button>
    );
  };

  // ── Accordion rows ────────────────────────────────────────────────────────

  const renderSingleRow = (gem, icon) => {
    const isSel    = gem.key === selected;
    const isRec    = gem.key === workflowRecommendedGemKey;
    const isSavedK = gem.key === savedGemKey;
    const hasUrl   = isGeminiGemUrl(gemUrls[gem.key] || getGemUrl(gem.key) || "");
    return (
      <button
        key={gem.key}
        type="button"
        onClick={() => handleSelect(gem.key)}
        className={cn(
          "w-full flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-right transition-all",
          isSel
            ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
            : isRec
            ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-200"
            : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        )}
      >
        <span className="text-base leading-none shrink-0">{icon || gem.icon}</span>
        <span className="text-sm font-semibold flex-1">{gem.label}</span>
        {isRec && <span className="rounded-full bg-amber-400 text-[9px] font-bold text-white px-1.5 py-0.5 shrink-0">AI מומלץ</span>}
        {isSavedK && !isSel && <span className="rounded-full bg-emerald-500 text-[9px] font-bold text-white px-1.5 py-0.5 shrink-0">✓ נשמר</span>}
        {isSel && <span className="text-[10px] opacity-70 shrink-0">✓ נבחר</span>}
        {!hasUrl && <span className="text-[10px] opacity-50 shrink-0" title="אין URL">⚠</span>}
      </button>
    );
  };

  const renderTJSAccordion = () => {
    const isExpanded  = expandedCategory === "tjs";
    const anySelected = TJS_GEMS.some((g) => g.key === selected);
    const anyRec      = TJS_GEMS.some((g) => g.key === workflowRecommendedGemKey);
    const recScore    = anyRec && tjsRecommendation?.scores?.[workflowRecommendedGemKey];
    return (
      <div key="tjs">
        <button
          type="button"
          onClick={() => toggleCategory("tjs")}
          className={cn(
            "w-full flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all",
            anySelected
              ? "border-cyan-400 bg-cyan-50 text-cyan-800 dark:border-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-200"
              : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:bg-cyan-50/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          )}
        >
          <span className="text-base leading-none shrink-0">📊</span>
          <span className="text-sm font-semibold flex-1 text-right">GEMS TJS</span>
          {anyRec && !isExpanded && (
            <span className="rounded-full bg-amber-400 text-[9px] font-bold text-white px-1.5 py-0.5 shrink-0">
              AI מומלץ{recScore ? ` ${recScore}%` : ''}
            </span>
          )}
          {anySelected && !isExpanded && (
            <span className="text-[10px] opacity-60 shrink-0 truncate max-w-[80px]">· {selectedGem.label}</span>
          )}
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", isExpanded && "-rotate-180")} />
        </button>
        {isExpanded && (
          <div className="mt-1.5 mr-2 border-r-2 border-cyan-200 pr-2 dark:border-cyan-800 space-y-1">
            {TJS_GEMS.map(renderChildRow)}
          </div>
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPortal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[340] bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            dir="rtl"
            aria-describedby="gem-modal-desc"
            className="fixed left-[50%] top-[50%] z-[350] flex flex-col w-full max-w-[520px] max-h-[90vh] translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 overflow-hidden"
          >
            <DialogPrimitive.Title className="sr-only">בחירת GEM</DialogPrimitive.Title>
            <p id="gem-modal-desc" className="sr-only">בחר GEM ושלח אליו את התמלול</p>

            <DialogPrimitive.Close className="absolute left-4 top-4 z-10 rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>

            {/* ── Scrollable body ─────────────────────────────────────────── */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">

              {/* ── 1. Video info ─────────────────────────── */}
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 leading-snug line-clamp-2 pl-8">
                  {video?.title || "בחירת GEM"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {category && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
                      📂 {category}
                    </span>
                  )}
                  {subCategory && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                      📁 {subCategory}
                    </span>
                  )}
                </div>
              </div>

              {/* ── 2. Recommended GEM card ───────────────── */}
              {recommendedGem && !isMarketBriefWorkflow && (
                <button
                  type="button"
                  onClick={() => handleSelect(recommendedGem.key)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-right transition-all",
                    selected === recommendedGem.key
                      ? "border-amber-400 bg-amber-500 text-white shadow-md"
                      : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200 dark:hover:bg-amber-900/30"
                  )}
                >
                  <span className="text-xl leading-none shrink-0">{recommendedGem.icon}</span>
                  <div className="flex-1 min-w-0 text-right">
                    <div className="text-sm font-bold leading-snug">{recommendedGem.label}</div>
                    <div className="text-[10px] opacity-70 leading-snug line-clamp-1">{recommendedGem.description}</div>
                  </div>
                  <span className={cn(
                    "rounded-full text-[9px] font-bold px-2 py-0.5 shrink-0",
                    selected === recommendedGem.key
                      ? "bg-white/25 text-white"
                      : "bg-amber-200 text-amber-800 dark:bg-amber-800/40 dark:text-amber-300"
                  )}>
                    ⭐ AI מומלץ
                  </span>
                </button>
              )}

              {/* ── 3. Accordion category list ────────────── */}
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">בחר GEM</span>
                  <button type="button" onClick={handleManageAll} className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline">
                    <Settings className="h-3 w-3" />
                    ניהול כל ה-GEMS
                  </button>
                </div>

                <div className="space-y-1.5">
                  {isMarketBriefWorkflow ? (
                    <>
                      {renderSingleRow(MARKET_BRIEF_GEM)}
                      <button
                        type="button"
                        aria-expanded={showAdditionalOptions}
                        aria-controls={additionalOptionsId}
                        onClick={() => setShowAdditionalOptions((isExpanded) => !isExpanded)}
                        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-zinc-950"
                      >
                        <span>אפשרויות נוספות</span>
                        <ChevronDown
                          aria-hidden="true"
                          className={cn(
                            "h-4 w-4 shrink-0 transition-transform duration-200",
                            showAdditionalOptions && "rotate-180"
                          )}
                        />
                      </button>
                      <div
                        id={additionalOptionsId}
                        hidden={!showAdditionalOptions}
                        className="space-y-1.5 border-r-2 border-indigo-100 pr-2 dark:border-indigo-900/60"
                      >
                        {renderSingleRow(FIXED_GEMS_TOP.find((g) => g.key === "political"))}
                        {renderSingleRow(KNOWLEDGE_MARKET_GEMS.find((g) => g.key === "technical"))}
                        {renderSingleRow(KNOWLEDGE_MARKET_GEMS.find((g) => g.key === "fundamental"))}
                        {renderSingleRow(FIXED_GEMS_TOP.find((g) => g.key === "general"))}
                        {visibleDynamicTopicGems.map((gem) => renderSingleRow(gem))}
                      </div>
                    </>
                  ) : (
                    <>
                      {renderSingleRow(FIXED_GEMS_TOP.find((g) => g.key === "political"))}
                      {renderTJSAccordion()}
                      {renderSingleRow(KNOWLEDGE_MARKET_GEMS.find((g) => g.key === "technical"))}
                      {renderSingleRow(KNOWLEDGE_MARKET_GEMS.find((g) => g.key === "fundamental"))}
                      {renderSingleRow(FIXED_GEMS_TOP.find((g) => g.key === "general"))}
                      {dynamicTopicGems.map((gem) => renderSingleRow(gem))}
                    </>
                  )}
                </div>
              </div>

              {/* ── 4. Selected GEM details + URL ─────────── */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-3 dark:border-zinc-700 dark:bg-zinc-900">
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none">{selectedGem.icon}</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-100">{selectedGem.label}</span>
                  <div className="flex items-center gap-1.5 mr-auto">
                    {isAiRec && <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">⭐ AI מומלץ</span>}
                    {isSavedSel && <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">✓ נשמר</span>}
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">{selectedGem.description}</p>

                {!isConfiguringUrl && (
                  <div className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2",
                    selectedGemUrl
                      ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/40"
                      : "bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800/40"
                  )}>
                    <div className="flex items-center gap-2 text-[11px]">
                      {selectedGemUrl ? (
                        <><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /><span className="text-emerald-700 dark:text-emerald-400 font-medium">URL מוגדר</span></>
                      ) : (
                        <><AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" /><span className="text-red-600 dark:text-red-400 font-semibold">חסר URL — לא ניתן לפתוח GEM</span></>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsConfiguringUrl(true)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors border",
                        selectedGemUrl
                          ? "border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                          : "border-red-300 bg-white text-red-600 hover:bg-red-100 dark:border-red-700 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-900/30"
                      )}
                    >
                      <Settings className="h-3 w-3" />
                      {selectedGemUrl ? "ערוך URL" : "הגדר URL"}
                    </button>
                  </div>
                )}

                {isConfiguringUrl && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
                      URL עבור <span className="text-indigo-600 dark:text-indigo-400">{selectedGem.label}</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={urlDraft}
                        onChange={(e) => { setUrlDraft(e.target.value); if (urlError) setUrlError(""); }}
                        placeholder="https://gemini.google.com/gem/..."
                        dir="ltr"
                        autoFocus
                        className={cn(
                          "flex-1 rounded-lg border px-3 py-2 text-[11px] text-slate-800 dark:text-zinc-100 dark:bg-zinc-800 focus:outline-none focus:ring-1",
                          urlError
                            ? "border-red-400 bg-red-50 focus:ring-red-400 dark:border-red-700 dark:bg-red-950/20"
                            : "border-slate-200 bg-white focus:ring-indigo-400 dark:border-zinc-700"
                        )}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveUrl(); if (e.key === "Escape") handleCancelUrl(); }}
                      />
                      <button type="button" onClick={handleSaveUrl} className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-2 text-xs font-semibold text-white transition-colors shrink-0">שמור</button>
                      <button type="button" onClick={handleCancelUrl} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors shrink-0 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800">ביטול</button>
                    </div>
                    {urlError && (
                      <p className="flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
                        <AlertCircle className="h-3 w-3 shrink-0" />{urlError}
                      </p>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* ── GEM summary status bar ──────────────────────────────────── */}
            {(gemWaiting || summaryReceived) && !isSummaryPasteOpen && (
              <div className="shrink-0 flex items-center gap-2 px-5 py-2.5 border-t border-amber-100 dark:border-amber-900/30 bg-amber-50/70 dark:bg-amber-950/20">
                {summaryReceived ? (
                  <span className="flex-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">🟢 סיכום התקבל</span>
                ) : (
                  <>
                    <span className="flex-1 text-xs font-semibold text-amber-700 dark:text-amber-300">⏳ ממתין לסיכום מה-GEM</span>
                    <button
                      type="button"
                      onClick={() => { setIsSummaryPasteOpen(true); setSummaryDraft(''); setSummaryError(''); }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors shrink-0"
                    >
                      הדבק סיכום מה-GEM
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ── Inline paste form ───────────────────────────────────────── */}
            {isSummaryPasteOpen && (
              <div className="shrink-0 border-t border-amber-200 dark:border-amber-800/40 bg-amber-50/80 dark:bg-amber-950/20 px-5 py-4 space-y-2">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-200">הדבק את הסיכום שקיבלת מה-GEM:</div>
                <textarea
                  autoFocus
                  value={summaryDraft}
                  onChange={e => { setSummaryDraft(e.target.value); if (summaryError) setSummaryError(''); }}
                  placeholder="הדבק כאן את הסיכום מה-GEM..."
                  rows={5}
                  dir="rtl"
                  className="w-full rounded-lg border border-amber-200 dark:border-amber-800/50 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-right placeholder:text-amber-300 dark:placeholder:text-amber-700 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
                />
                {summaryError && (
                  <p className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="h-3 w-3 shrink-0" /> {summaryError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const text = summaryDraft.trim();
                      if (!text) { setSummaryError('יש להדביק תוכן לפני השמירה'); return; }
                      onGemSummaryPaste?.(text);
                      if (video?.id) {
                        localStorage.setItem(`gem-summary-${video.id}`, text);
                        localStorage.removeItem(`gem-summary-waiting-${video.id}`);
                      }
                      setSummaryReceived(true);
                      setGemWaiting(false);
                      setIsSummaryPasteOpen(false);
                      toast.success('✓ הסיכום נשמר');
                    }}
                    className="rounded-xl bg-amber-500 hover:bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors"
                  >
                    שמור סיכום
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSummaryPasteOpen(false)}
                    className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}

            {/* ── Sticky footer ───────────────────────────────────────────── */}
            <div className="shrink-0 flex gap-2 border-t border-slate-100 dark:border-zinc-800 px-5 py-4 bg-white dark:bg-zinc-950">
              <button
                type="button"
                data-testid="gem-open-copy-transcript"
                onClick={handleOpenGem}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
              >
                <ExternalLink className="h-4 w-4 shrink-0" />
                פתח GEM + העתק תמלול
              </button>

              <button
                type="button"
                onClick={handleSaveGem}
                disabled={!onSave || (!hasUnsaved && !justSaved)}
                title={hasUnsaved ? "שמור בחירת GEM לסרטון זה" : "הבחירה כבר נשמרה"}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-xl border px-4 py-3 text-sm font-semibold transition-all shrink-0",
                  justSaved
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : hasUnsaved
                    ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                    : "border-slate-200 bg-white text-slate-400 cursor-default dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500"
                )}
              >
                {justSaved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {justSaved ? "נשמר!" : "שמור"}
              </button>

              <button
                type="button"
                onClick={handleCopyOnly}
                disabled={!fullTranscriptText}
                title="העתק תמלול בלבד"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 shrink-0"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>

          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>

      <GemsSettingsModal
        open={showAllGems}
        onOpenChange={handleAllGemsClose}
        focusKey={FIXED_GEM_KEYS.has(selected) ? selected : null}
      />
    </>
  );
}
