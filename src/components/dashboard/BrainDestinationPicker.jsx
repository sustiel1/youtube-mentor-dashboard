import { useState, useEffect, useMemo } from "react";
import { FolderOpen, ChevronDown, Sparkles, Info, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTopics } from "@/hooks/useTopics";
import { cn } from "@/lib/utils";
import {
  getBrainSaveButtonLabel,
  getObsidianPickerButtonLabel,
  getObsidianPickerHeaderLabel,
  hasObsidianSavedStatus,
} from "@/lib/obsidianSavedStatus";
import { resolveObsidianBulkItemStatus } from "@/lib/obsidianItemSaveStore";
import { ObsidianIcon } from "@/components/shared/ObsidianIcon";
import { normalizeCategoryName, GEM_CATEGORY_MAP } from "@/lib/gemRecommender";
import { getObsidianSettings } from "@/lib/obsidianVaultConfig";

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

// ─── Subtitle auto-detection ─────────────────────────────────────────────────

function detectSubtitle(video) {
  if (video?.customSubtitle?.trim()) return video.customSubtitle.trim();
  const title = video?.title || "";
  let candidate = title;
  if (title.includes(" | ")) candidate = title.split(" | ")[0].trim();
  else if (title.includes(" - ")) candidate = title.split(" - ")[0].trim();
  const words = candidate.split(/\s+/).filter(Boolean);
  return words.length <= 8 ? candidate : words.slice(0, 7).join(" ");
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

/** @param {'brain' | 'obsidian'} variant — UI identity only; routing/save logic unchanged */
export function BrainDestinationPicker({
  open,
  onOpenChange,
  video,
  onConfirm,
  onOpenSaved,
  obsidianSaveContext,
  obsidianPackagePreview = null,
  gemKey,
  variant = "brain",
  allowReplaceExisting = true,
}) {
  const isObsidianFlow = variant === "obsidian";
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);
  const [brainId, setBrainId] = useState("");
  const [subBrainId, setSubBrainId] = useState("");
  const [changingBrain, setChangingBrain] = useState(false);
  const [suggestedSubId, setSuggestedSubId] = useState(null);

  const [isNewBrain, setIsNewBrain] = useState(false);
  const [newBrainName, setNewBrainName] = useState("");
  const [isNewSub, setIsNewSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [validationError, setValidationError] = useState("");
  const [subtitleDraft, setSubtitleDraft] = useState("");
  const [filenameDraft, setFilenameDraft] = useState("");
  const [isFilenameEditing, setIsFilenameEditing] = useState(false);

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

  // Effective filename (user-edited or derived from title)
  const effectiveFilename = (filenameDraft || sanitizeFilename(video?.title || "") || "ידע").slice(0, 80);

  // Full path preview: MainCategory/SubCategory/filename.md
  const pathParts = [
    effectiveBrainName || null,
    effectiveSubName || null,
    effectiveFilename ? `${effectiveFilename}.md` : null,
  ].filter(Boolean);
  const pathPreview = pathParts.length > 0 ? pathParts.join("/") : null;
  const vaultDisplayName = getObsidianSettings().vaultName || "Knowledge-Base";

  const obsidianItemStatus = useMemo(() => {
    if (!isObsidianFlow || !obsidianSaveContext?.items?.length) return null;
    return resolveObsidianBulkItemStatus(obsidianSaveContext.items, {
      videoId: obsidianSaveContext.videoId,
      destinationPath: pathPreview,
      videoSavedPath: video?.obsidianSavedStatus?.savedPath || null,
    });
  }, [isObsidianFlow, obsidianSaveContext, pathPreview, video?.obsidianSavedStatus?.savedPath]);

  const obsidianPickerHeader = obsidianItemStatus
    ? getObsidianPickerHeaderLabel({
      allSaved: obsidianItemStatus.allSaved,
      mixed: obsidianItemStatus.mixed,
    })
    : null;

  const obsidianPickerButton = obsidianItemStatus
    ? getObsidianPickerButtonLabel({
      allSaved: obsidianItemStatus.allSaved,
      mixed: obsidianItemStatus.mixed,
    })
    : null;

  useEffect(() => {
    if (!open || topics.length === 0) return;

    setIsNewBrain(false);
    setNewBrainName("");
    setIsNewSub(false);
    setNewSubName("");
    setValidationError("");
    setSubtitleDraft(detectSubtitle(video));
    setFilenameDraft(sanitizeFilename(video?.title || ""));
    setIsFilenameEditing(false);

    const freshDests = loadCustomDests();
    setCustomDests(freshDests);

    let detected = detectBrainFromVideo(video, topics) || "";

    // Fallback: direct category name match (handles mismatched IDs / unindexed topics)
    if (!detected && video?.category) {
      const catLower = String(video.category).trim().toLowerCase();
      const mainTopics = topics.filter(t => !t.parentId || t.isMainCategory);
      const allMains = [
        ...mainTopics,
        ...(freshDests.mains || []).map(m => ({ id: m.id, name: m.name })),
      ];
      const directMatch = allMains.find(t =>
        String(t.name || '').trim().toLowerCase() === catLower
      );
      if (directMatch) detected = directMatch.id;
    }

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
        // 1. Try custom destinations
        const customSubs = freshDests.subs?.[detected] || [];
        const customMatch = customSubs.find(s => normalizeValue(s.name) === normalizeValue(videoSubName));
        if (customMatch) resolvedSub = customMatch.id;

        // 2. Fallback: direct name match in system topics
        if (!resolvedSub) {
          const subTopics = topics.filter(t => t.parentId === detected);
          const directSubMatch = subTopics.find(t =>
            String(t.name || '').trim().toLowerCase() === String(videoSubName).toLowerCase()
          );
          if (directSubMatch) resolvedSub = directSubMatch.id;
        }
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

  function buildConfirmPayload(replaceExisting = false) {
    // Validate new brain name
    if (isNewBrain) {
      const existingNames = allMainBrains.map((t) => t.name);
      const err = validateFolderName(newBrainName, existingNames);
      if (err) { setValidationError(err); return null; }
    } else if (!brainId) {
      return null;
    }

    // Validate new sub name
    if (isNewSub) {
      const existingNames = allSubBrains.map((t) => t.name);
      const err = validateFolderName(newSubName, existingNames);
      if (err) { setValidationError(err); return null; }
    }

    // Persist new custom destinations and resolve final IDs / names
    let resolvedBrainId = isNewBrain ? null : brainId;
    let resolvedSubBrainId = subBrainId || null;
    let customBrainName = null;
    let customSubName = null;

    if (isNewBrain) {
      const savedMainId = persistCustomMain(newBrainName);
      resolvedBrainId = savedMainId;
      customBrainName = newBrainName.trim();
      if (isNewSub) {
        const savedSubId = persistCustomSub(savedMainId, newSubName);
        resolvedSubBrainId = savedSubId;
        customSubName = newSubName.trim();
      } else {
        resolvedSubBrainId = null;
      }
      setCustomDests(loadCustomDests());
    } else {
      const customMain = (customDests.mains || []).find((m) => m.id === brainId);
      if (customMain) customBrainName = customMain.name;

      if (isNewSub) {
        const savedSubId = persistCustomSub(brainId, newSubName);
        resolvedSubBrainId = savedSubId;
        customSubName = newSubName.trim();
        setCustomDests(loadCustomDests());
      } else if (subBrainId) {
        const customSub = (customDests.subs?.[brainId] || []).find((s) => s.id === subBrainId);
        if (customSub) customSubName = customSub.name;
      }
    }

    if (resolvedBrainId) {
      writeLastSub(resolvedBrainId, resolvedSubBrainId);
    }

    return {
      brainId: resolvedBrainId,
      subBrainId: resolvedSubBrainId,
      customBrainName,
      customSubName,
      subtitle: subtitleDraft.trim(),
      filename: effectiveFilename,
      path: pathPreview,
      replaceExisting,
    };
  }

  function handleConfirm() {
    setValidationError("");

    if (isObsidianFlow && obsidianItemStatus?.allSaved) {
      const openPath = obsidianItemStatus.openPath || pathPreview;
      if (openPath && onOpenSaved) {
        onOpenSaved(openPath);
      }
      onOpenChange(false);
      return;
    }

    const payload = buildConfirmPayload(false);
    if (!payload) return;
    onConfirm(payload);
    onOpenChange(false);
  }

  function handleReplaceConfirm() {
    setValidationError("");
    const payload = buildConfirmPayload(true);
    if (!payload) return;
    setReplaceConfirmOpen(false);
    onConfirm(payload);
    onOpenChange(false);
  }

  const inputCls =
    "w-full rounded-2xl border border-violet-200 bg-white px-4 py-4 text-base text-slate-800 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-violet-800/60 dark:bg-zinc-950 dark:text-zinc-100";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="flex flex-col w-[min(92vw,880px)] max-w-2xl max-h-[90vh] border-violet-100 bg-white/95 p-0 shadow-[0_24px_80px_rgba(79,70,229,0.18)] backdrop-blur dark:border-violet-900/40 dark:bg-zinc-950/95"
        aria-describedby={undefined}
      >
        <DialogHeader className="shrink-0 border-b border-slate-200/80 px-7 py-6 dark:border-zinc-800 sm:px-9 sm:py-7">
          <div className="flex items-center gap-3">
            {isObsidianFlow ? (
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white shadow-lg shadow-violet-500/25">
                <ObsidianIcon className="h-6 w-6 text-white" title="Obsidian" />
              </div>
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/25">
                <Sparkles className="h-5 w-5" />
              </div>
            )}
            <div className="space-y-1 text-right">
              <DialogTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
                {isObsidianFlow
                  ? (obsidianPickerHeader || "שמור ל-Obsidian")
                  : "שמור למוח"}
              </DialogTitle>
              <p className="text-sm leading-6 text-slate-500 dark:text-zinc-400">
                {isObsidianFlow
                  ? (obsidianItemStatus?.fileExistsButItemUnsaved
                    ? "קיים קובץ בנתיב הזה, אבל הפריט הזה עדיין לא נשמר."
                    : "בחר היכן לשמור את הידע בכספת ה-Obsidian שלך")
                  : "בחר לאן לשמור את המידע במערכת הידע שלך."}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-7 px-7 py-7 sm:px-9 sm:py-8">
          {isObsidianFlow && obsidianPackagePreview && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/50 px-4 py-4 dark:border-violet-800/50 dark:bg-violet-950/20 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">
                מה יישמר
              </p>
              {obsidianPackagePreview.sections?.length > 0 ? (
                <ul className="space-y-1.5">
                  {obsidianPackagePreview.sections.map((sec) => (
                    <li
                      key={sec.key}
                      className="flex items-center justify-between gap-3 text-sm text-slate-700 dark:text-zinc-200"
                    >
                      <span className="font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                        {sec.count}
                      </span>
                      <span className="flex-1 text-right">{sec.label}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 shrink-0">☑</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 dark:text-zinc-400 text-right">
                  אין פריטים זמינים לשמירה
                </p>
              )}
              <div className="border-t border-violet-200/80 dark:border-violet-800/40 pt-2 flex justify-between text-sm font-bold">
                <span className="text-violet-700 dark:text-violet-300 tabular-nums">
                  {obsidianPackagePreview.totalItems || 0}
                </span>
                <span className="text-slate-500 dark:text-zinc-400">סה״כ פריטים</span>
              </div>
              {typeof obsidianPackagePreview.onToggleSaveEntireVideo === 'function' && (
                <label className="flex items-center justify-end gap-2.5 cursor-pointer pt-1">
                  <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
                    שמור את כל תוכן הסרטון
                  </span>
                  <input
                    type="checkbox"
                    checked={!!obsidianPackagePreview.saveEntireVideo}
                    onChange={(e) => obsidianPackagePreview.onToggleSaveEntireVideo(e.target.checked)}
                    className="h-4 w-4 rounded border-violet-300 text-violet-600 focus:ring-violet-500"
                  />
                </label>
              )}
              {obsidianPackagePreview.selectedCount > 0 && !obsidianPackagePreview.saveEntireVideo && (
                <p className="text-xs text-slate-500 dark:text-zinc-400 text-right">
                  יישמרו {obsidianPackagePreview.selectedCount} פריטים נבחרים בלבד
                </p>
              )}
            </div>
          )}

          {isObsidianFlow && obsidianItemStatus && obsidianItemStatus.total > 0 && !obsidianPackagePreview && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/80 space-y-3">
              {obsidianItemStatus.savedItems.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">כבר נשמר:</p>
                  <ul className="space-y-1">
                    {obsidianItemStatus.savedItems.map((item, idx) => (
                      <li key={`saved-${idx}`} className="text-sm text-slate-700 dark:text-zinc-200 truncate">
                        ✓ {item.preview}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {obsidianItemStatus.unsavedItems.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">עדיין לא נשמר:</p>
                  <ul className="space-y-1">
                    {obsidianItemStatus.unsavedItems.map((item, idx) => (
                      <li key={`unsaved-${idx}`} className="text-sm text-slate-600 dark:text-zinc-300 truncate">
                        ○ {item.preview}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

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

          {/* ── Subtitle field ── */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-zinc-100">
              <span className="text-base">📝</span>
              <span>תת-כותרת</span>
              <span className="text-xs font-normal text-slate-400 dark:text-zinc-500">(תופיע בתוכן הקובץ)</span>
            </div>
            <input
              type="text"
              value={subtitleDraft}
              onChange={(e) => setSubtitleDraft(e.target.value)}
              placeholder="תיאור קצר של הסרטון..."
              dir="rtl"
              className={cn(inputCls, "text-sm py-3")}
            />
          </section>

          {/* ── Filename field ── */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-zinc-100">
                <span className="text-base">📄</span>
                <span>שם הקובץ</span>
              </div>
              {!isFilenameEditing && (
                <button type="button" onClick={() => setIsFilenameEditing(true)}
                  className="text-xs font-semibold text-violet-600 hover:text-violet-800 dark:text-violet-300 px-2 py-1 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/30">
                  ✏️ ערוך
                </button>
              )}
            </div>
            {isFilenameEditing ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={filenameDraft}
                  onChange={(e) => setFilenameDraft(sanitizeFilename(e.target.value))}
                  placeholder="שם הקובץ (ללא .md)"
                  dir="rtl"
                  autoFocus
                  className={cn(inputCls, "flex-1 text-sm py-3")}
                  onKeyDown={(e) => { if (e.key === "Escape") { setIsFilenameEditing(false); } if (e.key === "Enter") { setIsFilenameEditing(false); } }}
                />
                <button type="button" onClick={() => setIsFilenameEditing(false)}
                  className="flex h-[50px] w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/80">
                <span className="font-mono text-sm text-slate-700 dark:text-zinc-200 truncate flex-1">{effectiveFilename}.md</span>
              </div>
            )}
          </section>

          {/* ── Validation error ── */}
          {validationError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800/60 dark:bg-red-950/30 dark:text-red-300">
              {validationError}
            </div>
          )}

          {/* ── Live path preview (tree format) ── */}
          {pathPreview && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/80">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500 flex items-center gap-2">
                <Info className="h-3.5 w-3.5" />
                נתיב שמירה ב-Obsidian
              </p>
              <div className="font-mono text-sm text-slate-700 dark:text-zinc-200 space-y-0.5" dir="rtl">
                <div className="text-slate-600 dark:text-zinc-300 font-semibold">{vaultDisplayName}</div>
                {effectiveBrainName && (
                  <div className="pr-0">└── {effectiveBrainName}</div>
                )}
                {effectiveSubName && (
                  <div className="pr-4">└── {effectiveSubName}</div>
                )}
                {effectiveFilename && (
                  <div className="pr-8 text-violet-700 dark:text-violet-300 font-semibold">
                    └── {effectiveFilename}.md
                  </div>
                )}
              </div>
              {isObsidianFlow && obsidianPackagePreview && (
                <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400 text-right">
                  {obsidianPackagePreview.totalItems > 0
                    ? `${obsidianPackagePreview.totalItems} פריטים יישמרו לקובץ אחד`
                    : 'הערה תיווצר לפי הנתיב למעלה'}
                </p>
              )}
              {(isNewBrain || isNewSub) && (
                <p className="mt-2 text-xs text-violet-500 dark:text-violet-400">תיקיות חסרות יווצרו אוטומטית</p>
              )}
            </div>
          )}

        </div>

        {/* ── Sticky footer (actions) ── */}
        <div className="shrink-0 flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-7 py-5 dark:border-zinc-800 dark:bg-zinc-950/95 sm:px-9">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!brainId && !isNewBrain}
              className={cn(
                "order-1 flex-1 rounded-2xl px-6 py-4 text-base font-bold text-white shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-40",
                isObsidianFlow
                  ? (obsidianItemStatus?.allSaved
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700"
                    : "bg-gradient-to-r from-violet-600 to-indigo-600 shadow-violet-500/20 hover:from-violet-700 hover:to-indigo-700")
                  : (hasObsidianSavedStatus(video)
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700"
                    : "bg-gradient-to-r from-violet-600 to-indigo-600 shadow-violet-500/20 hover:from-violet-700 hover:to-indigo-700")
              )}
            >
              {isObsidianFlow
                ? (obsidianPackagePreview
                  ? (obsidianItemStatus?.allSaved ? 'פתח ב-Obsidian' : 'אשר ושמור ל-Obsidian')
                  : (obsidianPickerButton || "שמור ל-Obsidian"))
                : getBrainSaveButtonLabel(video)}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="order-2 rounded-2xl border border-violet-200 px-6 py-4 text-base font-semibold text-violet-600 transition-colors hover:bg-violet-50 dark:border-violet-800/60 dark:text-violet-300 dark:hover:bg-violet-900/20"
            >
              ביטול
            </button>
          </div>
          {allowReplaceExisting && !(isObsidianFlow && obsidianItemStatus?.allSaved) && (
            <button
              type="button"
              onClick={() => setReplaceConfirmOpen(true)}
              disabled={!brainId && !isNewBrain}
              className="w-full rounded-2xl border border-red-300 bg-red-50 px-6 py-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-800/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
            >
              החלף קובץ קיים
            </button>
          )}
        </div>
      </DialogContent>

      <Dialog open={replaceConfirmOpen} onOpenChange={setReplaceConfirmOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-lg font-bold text-red-700 dark:text-red-300">
              להחליף את הקובץ הקיים?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-zinc-400 text-right leading-relaxed">
            פעולה זו תמחק את תוכן הקובץ הנוכחי ב-Obsidian ותחליף אותו במלואו.
            שמירות קודמות ועריכות ידניות בקובץ יאבדו. לא ניתן לבטל.
          </p>
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => setReplaceConfirmOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={handleReplaceConfirm}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              החלף קובץ קיים
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
