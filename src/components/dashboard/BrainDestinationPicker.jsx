import { useState, useEffect } from "react";
import { FolderOpen, ChevronDown, Sparkles, Info, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTopics } from "@/hooks/useTopics";
import { cn } from "@/lib/utils";
import { getBrainSaveButtonLabel, hasObsidianSavedStatus } from "@/lib/obsidianSavedStatus";
import { normalizeCategoryName } from "@/lib/gemRecommender";

// ─── Storage keys ─────────────────────────────────────────────────────────────
const LAST_SUBS_KEY = "brain_dest_subs_v1";
const CUSTOM_DESTS_KEY = "brain_custom_dests_v1";
const NEW_BRAIN_SENTINEL = "__NEW_BRAIN__";
const NEW_SUB_SENTINEL = "__NEW_SUB__";
const INVALID_PATH_CHARS = /[\\/:*?"<>|]/;

// ─── Custom destinations store ────────────────────────────────────────────────

function loadCustomDests() {
  try {
    const raw = localStorage.getItem(CUSTOM_DESTS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed.mains) && typeof parsed.subs === "object") {
      return parsed;
    }
  } catch {}
  return { mains: [], subs: {} };
}

function persistCustomMain(name) {
  const store = loadCustomDests();
  const trimmed = name.trim();
  const existing = store.mains.find(
    (m) => m.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (existing) return existing.id;
  const id = `custom_main_${Date.now()}`;
  store.mains.push({ id, name: trimmed });
  localStorage.setItem(CUSTOM_DESTS_KEY, JSON.stringify(store));
  return id;
}

function persistCustomSub(parentId, name) {
  const store = loadCustomDests();
  const trimmed = name.trim();
  if (!store.subs[parentId]) store.subs[parentId] = [];
  const existing = store.subs[parentId].find(
    (s) => s.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (existing) return existing.id;
  const id = `custom_sub_${Date.now()}`;
  store.subs[parentId].push({ id, name: trimmed });
  localStorage.setItem(CUSTOM_DESTS_KEY, JSON.stringify(store));
  return id;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeValue(value) {
  return String(value || "").trim().toLowerCase();
}

function getMainNameFromPath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.split("/")[0]?.trim() || "";
}

function readLastSubs() {
  try {
    const raw = localStorage.getItem(LAST_SUBS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLastSub(brainId, subBrainId) {
  try {
    const map = readLastSubs();
    map[brainId] = subBrainId || null;
    localStorage.setItem(LAST_SUBS_KEY, JSON.stringify(map));
  } catch {}
}

function validateFolderName(name, existingNames = []) {
  const trimmed = name.trim();
  if (!trimmed) return "שם לא יכול להיות ריק";
  if (INVALID_PATH_CHARS.test(trimmed)) return 'שם מכיל תווים לא חוקיים: \\ / : * ? " < > |';
  if (trimmed.length > 100) return "שם ארוך מדי";
  if (existingNames.some((n) => normalizeValue(n) === normalizeValue(trimmed))) {
    return `"${trimmed}" כבר קיים`;
  }
  return null;
}

function sanitizeFilename(title) {
  if (!title) return "";
  return String(title)
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

// ─── Video-to-brain detection helpers ─────────────────────────────────────────

function detectBrainFromVideo(video, topics) {
  const explicitSubTopicId = String(video?.subTopicId || "").trim();
  if (explicitSubTopicId) {
    const subTopic = topics.find((topic) => topic.id === explicitSubTopicId);
    if (subTopic?.parentId) return subTopic.parentId;
    if (subTopic && (!subTopic.parentId || subTopic.isMainCategory)) return subTopic.id;
  }

  const ids = Array.isArray(video?.topicIds) ? video.topicIds : [];
  for (const tid of ids) {
    const t = topics.find((topic) => topic.id === tid);
    if (!t) continue;
    if (!t.parentId || t.isMainCategory) return t.id;
    if (t.parentId) return t.parentId;
  }

  const candidateNames = [
    normalizeCategoryName(video?.category),
    getMainNameFromPath(video?.obsidianTopic),
    video?.contentType === "political" ? "פוליטיקה" : "",
  ]
    .map(normalizeValue)
    .filter(Boolean);

  for (const candidate of candidateNames) {
    const match = topics.find((topic) => {
      if (topic.parentId && !topic.isMainCategory) return false;
      return normalizeValue(topic.name) === candidate;
    });
    if (match) return match.id;
  }

  return null;
}

function detectSubBrainFromVideo(brainId, video, topics) {
  if (!brainId) return null;

  const explicitSubTopicId = String(video?.subTopicId || "").trim();
  if (explicitSubTopicId) {
    const explicitSubTopic = topics.find((topic) => topic.id === explicitSubTopicId);
    if (explicitSubTopic?.parentId === brainId) return explicitSubTopic.id;
  }

  const ids = Array.isArray(video?.topicIds) ? video.topicIds : [];
  const directSubTopic = ids
    .map((tid) => topics.find((topic) => topic.id === tid))
    .find((topic) => topic?.parentId === brainId);
  if (directSubTopic) return directSubTopic.id;

  const subTopics = topics.filter((topic) => topic.parentId === brainId);
  const candidateNames = [video?.subTopic, video?.subCategory]
    .map(normalizeValue)
    .filter(Boolean);

  for (const candidate of candidateNames) {
    const match = subTopics.find((topic) => normalizeValue(topic.name) === candidate);
    if (match) return match.id;
  }

  return null;
}

function suggestSubBrain(brainId, video) {
  const tags = [
    ...(Array.isArray(video?.tags) ? video.tags : []),
    ...(Array.isArray(video?.videoTopics) ? video.videoTopics : []),
    video?.category || "",
    video?.channelTitle || "",
    video?.title || "",
  ]
    .map((tag) => String(tag).toLowerCase().trim())
    .filter(Boolean);

  const has = (...keywords) =>
    keywords.some((keyword) => tags.some((tag) => tag.includes(keyword.toLowerCase())));

  if (brainId === "t2") {
    if (has("sequence trading", "שיטת הרצפים")) return "sb_sm_sequence";
    if (has("strategy", "strategies", "setup", "playbook")) return "sb_sm_strategies";
    if (has("macro", "tariff", "fed", "inflation")) return "sb_sm_macro";
    if (has("trump", "djt", "tariffs")) return "sb_sm_trump";
    if (has("swing trading")) return "sb_sm_swing";
    if (has("options", "calls", "puts", "greeks")) return "sb_sm_options";
    if (has("technical analysis", "chart", "rsi", "macd")) return "sb_sm_ta";
    if (has("earnings", "revenue", "guidance")) return "sb_sm_earnings";
    if (has("risk management", "stop loss")) return "sb_sm_risk";
    if (has("nvda", "amd", "nvidia", "ai stock")) return "sb_sm_ai_stocks";
    if (has("long term", "value investing", "dividend")) return "sb_sm_longterm";
    return null;
  }
  if (brainId === "t1") {
    if (has("claude", "anthropic")) return "sb_ai_claude";
    if (has("codex")) return "sb_ai_codex";
    if (has("cursor")) return "sb_ai_cursor";
    if (has("chatgpt", "gpt-4", "openai")) return "sb_ai_chatgpt";
    if (has("gemini")) return "sb_ai_gemini";
    if (has("ollama")) return "sb_ai_ollama";
    if (has("n8n")) return "sb_ai_n8n";
    if (has("obsidian", "pkm")) return "sb_ai_obsidian";
    if (has("prompt engineering")) return "sb_ai_prompt";
    if (has("automation", "workflow", "agent")) return "sb_ai_workflows";
    if (has("react")) return "sb_ai_react";
    if (has("backend", "node", "api", "database")) return "sb_ai_backend";
    if (has("frontend", "css", "ui", "ux")) return "sb_ai_frontend";
    if (has("rag", "vector")) return "sb_ai_rag";
    return null;
  }
  if (brainId === "t_pol") {
    if (has("israel", "netanyahu", "knesset", "ישראל")) return "sb_pol_israel";
    if (has("haredi", "haredim", "חרדים")) return "sb_pol_haredim";
    if (has("halacha", "הלכה")) return "sb_pol_theocracy";
    if (has("geopolitics", "nato", "iran", "גיאופוליטיקה")) return "sb_pol_geo";
    if (has("congress", "senate", "usa")) return "sb_pol_usa";
    if (has("trump", "maga")) return "sb_pol_trump";
    if (has("democracy", "judiciary", "בית משפט")) return "sb_pol_democracy";
    if (has("corruption", "שחיתות")) return "sb_pol_corruption";
    if (has("protest", "מחאה")) return "sb_pol_protest";
    if (has("election", "בחירות")) return "sb_pol_elections";
    if (has("occupation", "כיבוש")) return "sb_pol_occupation";
    return null;
  }
  if (brainId === "t_health") {
    if (has("keto", "קיטו")) return "sb_ht_keto";
    if (has("diabetes", "סכרת")) return "sb_ht_diabetes";
    if (has("low carb", "lchf")) return "sb_ht_lowcarb";
    return null;
  }
  if (brainId === "t_personal") {
    if (has("idea", "רעיון")) return "sb_pk_ideas";
    if (has("decision", "החלטה")) return "sb_pk_decisions";
    if (has("plan", "תוכנית")) return "sb_pk_plans";
    if (has("insight", "lesson", "תובנה")) return "sb_pk_insights";
    if (has("summary", "סיכום")) return "sb_pk_summaries";
    return null;
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BrainDestinationPicker({ open, onOpenChange, video, onConfirm }) {
  const [brainId, setBrainId] = useState("");
  const [subBrainId, setSubBrainId] = useState("");
  const [changingBrain, setChangingBrain] = useState(false);
  const [suggestedSubId, setSuggestedSubId] = useState(null);

  const [isNewBrain, setIsNewBrain] = useState(false);
  const [newBrainName, setNewBrainName] = useState("");
  const [isNewSub, setIsNewSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [validationError, setValidationError] = useState("");

  // Custom destinations persisted in localStorage
  const [customDests, setCustomDests] = useState(() => loadCustomDests());

  const { data: topics = [] } = useTopics();

  // Merge system topics with custom destinations
  const systemMainBrains = topics.filter((topic) => !topic.parentId || topic.isMainCategory);
  const customMainBrains = (customDests.mains || []).map((m) => ({
    id: m.id,
    name: m.name,
    parentId: null,
    isCustom: true,
  }));
  const allMainBrains = [...systemMainBrains, ...customMainBrains];

  const systemSubBrains = brainId ? topics.filter((topic) => topic.parentId === brainId) : [];
  const customSubBrains = brainId
    ? (customDests.subs?.[brainId] || []).map((s) => ({
        id: s.id,
        name: s.name,
        parentId: brainId,
        isCustom: true,
      }))
    : [];
  const allSubBrains = [...systemSubBrains, ...customSubBrains];

  const selectedBrain = allMainBrains.find((topic) => topic.id === brainId);
  const selectedSub = allSubBrains.find((topic) => topic.id === subBrainId);
  const suggestedSub = suggestedSubId
    ? allSubBrains.find((topic) => topic.id === suggestedSubId)
    : null;

  // Resolved display names for path building
  const effectiveBrainName = isNewBrain
    ? newBrainName.trim()
    : selectedBrain?.isCustom
    ? selectedBrain.name
    : selectedBrain?.name ?? "";

  const effectiveSubName = isNewSub
    ? newSubName.trim()
    : selectedSub?.isCustom
    ? selectedSub.name
    : selectedSub?.name ?? "";

  // Video filename preview
  const videoFileName = sanitizeFilename(video?.title || "");

  // Full path preview: MainCategory/SubCategory/filename.md
  const pathParts = [
    effectiveBrainName || null,
    effectiveSubName || null,
    videoFileName ? `${videoFileName}.md` : null,
  ].filter(Boolean);
  const pathPreview = pathParts.length > 0 ? pathParts.join("/") : null;

  useEffect(() => {
    if (!open || topics.length === 0) return;

    setIsNewBrain(false);
    setNewBrainName("");
    setIsNewSub(false);
    setNewSubName("");
    setValidationError("");

    const freshDests = loadCustomDests();
    setCustomDests(freshDests);

    const detected = detectBrainFromVideo(video, topics) || "";
    const systemExplicitSub = detected ? detectSubBrainFromVideo(detected, video, topics) : "";
    setBrainId(detected);
    setChangingBrain(!detected);

    if (!detected) {
      setSubBrainId("");
      setSuggestedSubId(null);
      return;
    }

    // Also check custom destinations by name (vault-only subtopics not in system topics)
    let resolvedSub = systemExplicitSub;
    if (!resolvedSub) {
      const videoSubName = (video?.subCategory || video?.subTopic || "").trim();
      if (videoSubName) {
        const customSubs = freshDests.subs?.[detected] || [];
        const customMatch = customSubs.find(s => normalizeValue(s.name) === normalizeValue(videoSubName));
        if (customMatch) resolvedSub = customMatch.id;
      }
    }

    const suggested = suggestSubBrain(detected, video);
    const lastSubs = readLastSubs();
    const lastSub = lastSubs[detected] || "";
    const videoSubName = (video?.subCategory || video?.subTopic || "").trim();
    const isGenericSub = !videoSubName || videoSubName === 'כללי';

    if (resolvedSub) {
      setSubBrainId(resolvedSub);
      setSuggestedSubId(suggested && suggested !== resolvedSub ? suggested : null);
    } else if (!isGenericSub) {
      // subCategory is set (approved recommendation) but not found in any topic list →
      // pre-fill "new sub" so the user can confirm creating this vault folder
      setIsNewSub(true);
      setNewSubName(videoSubName);
      setSubBrainId("");
      setSuggestedSubId(null);
    } else if (lastSub) {
      setSubBrainId(lastSub);
      setSuggestedSubId(suggested && suggested !== lastSub ? suggested : null);
    } else if (suggested) {
      setSubBrainId(suggested);
      setSuggestedSubId(null);
    } else {
      setSubBrainId("");
      setSuggestedSubId(null);
    }
  }, [open, video?.id, video?.subTopicId, video?.subTopic, video?.subCategory, video?.obsidianTopic, video?.category, video?.contentType, topics]);

  function handleBrainChange(id) {
    setValidationError("");
    if (id === NEW_BRAIN_SENTINEL) {
      setIsNewBrain(true);
      setBrainId("");
      setSubBrainId("");
      setIsNewSub(false);
      setNewSubName("");
      setSuggestedSubId(null);
      setChangingBrain(false);
      return;
    }
    setIsNewBrain(false);
    setNewBrainName("");
    setBrainId(id);
    setSubBrainId("");
    setIsNewSub(false);
    setNewSubName("");
    setSuggestedSubId(null);
    setChangingBrain(false);
  }

  function handleSubChange(id) {
    setValidationError("");
    if (id === NEW_SUB_SENTINEL) {
      setIsNewSub(true);
      setSubBrainId("");
      return;
    }
    setIsNewSub(false);
    setNewSubName("");
    setSubBrainId(id);
  }

  function cancelNewBrain() {
    setIsNewBrain(false);
    setNewBrainName("");
    setValidationError("");
    setChangingBrain(true);
  }

  function cancelNewSub() {
    setIsNewSub(false);
    setNewSubName("");
    setValidationError("");
  }

  function applySuggestion() {
    if (!suggestedSubId) return;
    setSubBrainId(suggestedSubId);
    setSuggestedSubId(null);
  }

  function handleConfirm() {
    setValidationError("");

    // Validate new brain name
    if (isNewBrain) {
      const existingNames = allMainBrains.map((t) => t.name);
      const err = validateFolderName(newBrainName, existingNames);
      if (err) { setValidationError(err); return; }
    } else if (!brainId) {
      return;
    }

    // Validate new sub name
    if (isNewSub) {
      const existingNames = allSubBrains.map((t) => t.name);
      const err = validateFolderName(newSubName, existingNames);
      if (err) { setValidationError(err); return; }
    }

    // Persist new custom destinations and resolve final IDs / names
    let resolvedBrainId = isNewBrain ? null : brainId;
    let resolvedSubBrainId = subBrainId || null;
    let customBrainName = null;
    let customSubName = null;

    if (isNewBrain) {
      // Save the new main category and use its ID going forward
      const savedMainId = persistCustomMain(newBrainName);
      resolvedBrainId = savedMainId;
      customBrainName = newBrainName.trim();
      if (isNewSub) {
        // Save the new sub under the freshly created main
        const savedSubId = persistCustomSub(savedMainId, newSubName);
        resolvedSubBrainId = savedSubId;
        customSubName = newSubName.trim();
      } else {
        resolvedSubBrainId = null;
      }
      setCustomDests(loadCustomDests());
    } else {
      // Existing main — check if it's a custom one (need to pass its name)
      const customMain = (customDests.mains || []).find((m) => m.id === brainId);
      if (customMain) customBrainName = customMain.name;

      if (isNewSub) {
        // Save new sub under the existing main and use its ID
        const savedSubId = persistCustomSub(brainId, newSubName);
        resolvedSubBrainId = savedSubId;
        customSubName = newSubName.trim();
        setCustomDests(loadCustomDests());
      } else if (subBrainId) {
        // Selected sub — pass its name if it's a custom one (not in topicsById)
        const customSub = (customDests.subs?.[brainId] || []).find((s) => s.id === subBrainId);
        if (customSub) customSubName = customSub.name;
      }
    }

    // Persist last-used destination so it's pre-selected next time
    if (resolvedBrainId) {
      writeLastSub(resolvedBrainId, resolvedSubBrainId);
    }

    onConfirm({
      brainId: resolvedBrainId,
      subBrainId: resolvedSubBrainId,
      customBrainName,
      customSubName,
    });
    onOpenChange(false);
  }

  const inputCls =
    "w-full rounded-2xl border border-violet-200 bg-white px-4 py-4 text-base text-slate-800 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-violet-800/60 dark:bg-zinc-950 dark:text-zinc-100";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="w-[min(92vw,880px)] max-w-2xl border-violet-100 bg-white/95 p-0 shadow-[0_24px_80px_rgba(79,70,229,0.18)] backdrop-blur dark:border-violet-900/40 dark:bg-zinc-950/95"
        aria-describedby={undefined}
      >
        <DialogHeader className="border-b border-slate-200/80 px-7 py-6 dark:border-zinc-800 sm:px-9 sm:py-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/25">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-1 text-right">
              <DialogTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
                שמור למוח
              </DialogTitle>
              <p className="text-sm leading-6 text-slate-500 dark:text-zinc-400">
                בחר לאן לשמור את המידע במערכת הידע שלך.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-7 px-7 py-7 sm:px-9 sm:py-8">
          {suggestedSub && (
            <button
              type="button"
              onClick={applySuggestion}
              className="group flex w-full items-center gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-fuchsia-50 to-white px-4 py-4 text-right transition-all hover:border-violet-300 hover:shadow-sm dark:border-violet-700/60 dark:from-violet-950/40 dark:via-fuchsia-950/20 dark:to-zinc-950 dark:hover:bg-violet-900/30"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="flex-1 space-y-1">
                <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-violet-500 dark:text-violet-300">
                  הצעה חכמה
                </span>
                <span className="block text-sm font-semibold text-violet-800 dark:text-violet-100">
                  {suggestedSub.name}
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-violet-500 transition-colors group-hover:text-violet-700 dark:text-violet-300">
                החל הצעה
              </span>
            </button>
          )}

          {/* ── Main category ── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-zinc-100">
              <FolderOpen className="h-4 w-4 text-violet-500" />
              <span>בחר קטגוריה ראשית</span>
            </div>

            {isNewBrain ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={newBrainName}
                    onChange={(e) => { setNewBrainName(e.target.value); setValidationError(""); }}
                    placeholder="שם קטגוריה ראשית חדשה..."
                    className={cn(inputCls, "flex-1")}
                    onKeyDown={(e) => e.key === "Escape" && cancelNewBrain()}
                  />
                  <button
                    type="button"
                    onClick={cancelNewBrain}
                    className="flex h-[58px] w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
                    title="ביטול"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="px-1 text-xs text-violet-600 dark:text-violet-300">
                  תיקייה חדשה תיווצר אוטומטית ב-Obsidian
                </p>
              </div>
            ) : changingBrain ? (
              <select
                value={brainId}
                onChange={(e) => handleBrainChange(e.target.value)}
                autoFocus
                className={inputCls}
              >
                <option value="">בחר קטגוריה...</option>
                {allMainBrains.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}{topic.isCustom ? " ✦" : ""}
                  </option>
                ))}
                <option value={NEW_BRAIN_SENTINEL}>+ קטגוריה ראשית חדשה</option>
              </select>
            ) : (
              <div className="flex items-center justify-between rounded-2xl border border-violet-200/80 bg-white px-4 py-4 shadow-sm dark:border-violet-800/50 dark:bg-zinc-950">
                <span
                  className={cn(
                    "text-base font-semibold",
                    selectedBrain ? "text-slate-800 dark:text-zinc-100" : "text-slate-400 dark:text-zinc-500"
                  )}
                >
                  {selectedBrain?.name ?? "לא זוהתה קטגוריה"}
                  {selectedBrain?.isCustom && (
                    <span className="mr-1.5 text-xs font-normal text-violet-500">מותאם אישית</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setChangingBrain(true)}
                  className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-violet-600 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:text-violet-300 dark:hover:bg-violet-900/30 dark:hover:text-violet-100"
                >
                  שנה <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            )}

            {!isNewBrain && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-center text-sm leading-6 text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
                הקטגוריה מזוהה אוטומטית על סמך תוכן הסרטון,
                <br />
                ניתן לשנות בבחירת הצורך
              </div>
            )}
          </section>

          {/* ── Sub-category / target folder ── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-zinc-100">
              <FolderOpen className="h-4 w-4 text-violet-500" />
              <span>תיקיית יעד (תת-קטגוריה)</span>
            </div>

            {isNewSub ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={newSubName}
                    onChange={(e) => { setNewSubName(e.target.value); setValidationError(""); }}
                    placeholder="שם תיקיית יעד חדשה..."
                    className={cn(inputCls, "flex-1")}
                    onKeyDown={(e) => e.key === "Escape" && cancelNewSub()}
                  />
                  <button
                    type="button"
                    onClick={cancelNewSub}
                    className="flex h-[58px] w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
                    title="ביטול"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="px-1 text-xs text-violet-600 dark:text-violet-300">
                  תיקייה חדשה תיווצר אוטומטית ב-Obsidian
                </p>
              </div>
            ) : isNewBrain ? (
              // When main is brand new, no existing subs — offer optional sub creation
              <button
                type="button"
                onClick={() => setIsNewSub(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 px-4 py-3 text-sm font-semibold text-violet-600 transition-colors hover:border-violet-400 hover:bg-violet-100/60 dark:border-violet-700/60 dark:bg-violet-950/20 dark:text-violet-300 dark:hover:bg-violet-950/40"
              >
                <Plus className="h-4 w-4" />
                הוסף תיקיית יעד (אופציונלי)
              </button>
            ) : allSubBrains.length > 0 ? (
              <select
                value={subBrainId}
                onChange={(e) => handleSubChange(e.target.value)}
                className={inputCls}
              >
                <option value="">בחר תיקייה...</option>
                {allSubBrains.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}{topic.isCustom ? " ✦" : ""}
                  </option>
                ))}
                <option value={NEW_SUB_SENTINEL}>+ תיקיית יעד חדשה</option>
              </select>
            ) : brainId ? (
              // Existing main but no subs yet — button to create first one
              <button
                type="button"
                onClick={() => setIsNewSub(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 px-4 py-3 text-sm font-semibold text-violet-600 transition-colors hover:border-violet-400 hover:bg-violet-100/60 dark:border-violet-700/60 dark:bg-violet-950/20 dark:text-violet-300"
              >
                <Plus className="h-4 w-4" />
                + תיקיית יעד חדשה
              </button>
            ) : null}

            {!isNewSub && !isNewBrain && (
              <p className="px-1 text-sm text-slate-500 dark:text-zinc-400">
                יוצגו רק תיקיות תחת הקטגוריה הנבחרת
              </p>
            )}
          </section>

          {/* ── Validation error ── */}
          {validationError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800/60 dark:bg-red-950/30 dark:text-red-300">
              {validationError}
            </div>
          )}

          {/* ── Live path preview ── */}
          {pathPreview && (
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/80">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
                <Info className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
                  נתיב שמירה סופי ב-Obsidian
                </p>
                <p className="break-all font-mono text-sm leading-6 text-slate-700 dark:text-zinc-200">
                  {pathPreview}
                </p>
                {(isNewBrain || isNewSub) && (
                  <p className="mt-1 text-xs text-violet-500 dark:text-violet-400">
                    תיקיות חסרות יווצרו אוטומטית
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 dark:border-zinc-800 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!brainId && !isNewBrain}
              className={cn(
                "order-1 flex-1 rounded-2xl px-6 py-4 text-base font-bold text-white shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-40",
                hasObsidianSavedStatus(video)
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700"
                  : "bg-gradient-to-r from-violet-600 to-indigo-600 shadow-violet-500/20 hover:from-violet-700 hover:to-indigo-700"
              )}
            >
              {getBrainSaveButtonLabel(video)}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="order-2 rounded-2xl border border-violet-200 px-6 py-4 text-base font-semibold text-violet-600 transition-colors hover:bg-violet-50 dark:border-violet-800/60 dark:text-violet-300 dark:hover:bg-violet-900/20"
            >
              ביטול
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
