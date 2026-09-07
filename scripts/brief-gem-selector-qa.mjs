import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  defaultGems,
  getGemConfigSnapshot,
  MARKET_BRIEF_GEM_KEY,
  MARKET_BRIEF_GEM_LABEL,
  MARKET_BRIEF_GEM_URL,
  openGeminiGemUrl,
  saveGemConfigSnapshot,
} from "../src/lib/gemsConfig.js";
import {
  isMarketBriefWorkflowVideo,
  preGemClassifier,
  resolveWorkflowGemRecommendation,
  resolveWorkflowGemSelection,
} from "../src/lib/gemRecommender.js";
import { detectVideoType, getBriefDisplayClassification } from "../src/config/videoTabsConfig.js";
import { getBriefContextDisplay } from "../src/lib/briefContextDisplay.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

globalThis.localStorage = new MemoryStorage();

const liveBrief = { title: "מבזק לייב פתיחה לתאריך 19.8.26", category: "שוק ההון" };
const liveOpeningBrief = { title: "לייב פתיחה לתאריך 21.8.26", category: "שוק ההון" };
const lateNight = { title: "לייט נייט דיווחים", category: "שוק ההון" };
const realLateNight = {
  title: "לייט נייט לתאריך 10.8.26 - דיווחים של ASTS RKLB",
  category: "שוק ההון",
  contentType: "marketBrief",
  subCategory: "מבזק בוקר",
};
const eveningBrief = { title: "מבזק ערב", category: "שוק ההון" };
const englishLateNight = { title: "late night", category: "שוק ההון" };
const unrelated = { title: "ניתוח טכני של S&P 500", category: "שוק ההון" };
const dailyTrading = { title: "אסטרטגיית מסחר יומי עם כניסה וסטופ", category: "שוק ההון" };

assert.equal(MARKET_BRIEF_GEM_KEY, "marketBrief");
assert.equal(MARKET_BRIEF_GEM_LABEL, "מבזק בוקר/ערב");
assert.equal(MARKET_BRIEF_GEM_URL, "https://gemini.google.com/gem/efb7637a12d6");
assert.equal(defaultGems.marketBrief, MARKET_BRIEF_GEM_URL);

assert.equal(isMarketBriefWorkflowVideo(liveBrief), true);
assert.equal(detectVideoType(liveOpeningBrief), "morningBrief");
assert.equal(detectVideoType(realLateNight), "eveningBrief");
assert.equal(detectVideoType(eveningBrief), "eveningBrief");
assert.equal(detectVideoType(englishLateNight), "eveningBrief");
assert.equal(isMarketBriefWorkflowVideo(liveOpeningBrief), true);
assert.equal(isMarketBriefWorkflowVideo(lateNight), true);
assert.equal(isMarketBriefWorkflowVideo(unrelated), false);
assert.equal(isMarketBriefWorkflowVideo(dailyTrading), false);
assert.equal(resolveWorkflowGemRecommendation(liveOpeningBrief, "dayTrading"), MARKET_BRIEF_GEM_KEY);
assert.equal(resolveWorkflowGemRecommendation(liveBrief, "macro"), MARKET_BRIEF_GEM_KEY);
assert.equal(resolveWorkflowGemRecommendation(lateNight, "dayTrading"), MARKET_BRIEF_GEM_KEY);
assert.equal(resolveWorkflowGemRecommendation(realLateNight, "dayTrading"), MARKET_BRIEF_GEM_KEY);
assert.equal(resolveWorkflowGemRecommendation(unrelated, "technical"), "technical");
assert.equal(resolveWorkflowGemRecommendation(dailyTrading, "dayTrading"), "dayTrading");

for (const savedGemKey of ["news", "macro", "dayTrading", "appBuilder"]) {
  assert.equal(
    resolveWorkflowGemSelection({ video: liveBrief, savedGemKey, recommendedGemKey: "macro" }),
    savedGemKey,
    `historical/manual ${savedGemKey} selection must win over the workflow recommendation`,
  );
}

assert.equal(
  resolveWorkflowGemSelection({ video: liveBrief, recommendedGemKey: "macro" }),
  MARKET_BRIEF_GEM_KEY,
);
assert.equal(
  resolveWorkflowGemSelection({ video: lateNight, recommendedGemKey: "dayTrading" }),
  MARKET_BRIEF_GEM_KEY,
);

const liveRecommendation = preGemClassifier(liveBrief);
const liveOpeningRecommendation = preGemClassifier(liveOpeningBrief);
const lateRecommendation = preGemClassifier(lateNight);
const realLateRecommendation = preGemClassifier(realLateNight);
for (const recommendation of [liveRecommendation, liveOpeningRecommendation, lateRecommendation, realLateRecommendation]) {
  assert.equal(recommendation.gemKey, MARKET_BRIEF_GEM_KEY);
  assert.equal(recommendation.gemLabel, MARKET_BRIEF_GEM_LABEL);
  assert.equal(recommendation.confidencePct, 97);
  assert.equal(recommendation.source, "titleOverride");
}
assert.equal(liveRecommendation.contentType, "morningBrief");
assert.equal(liveOpeningRecommendation.contentType, "morningBrief");
assert.equal(lateRecommendation.contentType, "eveningBrief");
assert.equal(realLateRecommendation.contentType, "eveningBrief");

for (const video of [realLateNight, eveningBrief, englishLateNight]) {
  assert.deepEqual(getBriefDisplayClassification(video), {
    videoType: "eveningBrief",
    subtype: "evening",
    slug: "evening-brief",
    label: "מבזק ערב",
  });
}
for (const video of [liveOpeningBrief, { title: "מבזק בוקר", category: "שוק ההון" }]) {
  assert.deepEqual(getBriefDisplayClassification(video), {
    videoType: "morningBrief",
    subtype: "morning",
    slug: "morning-brief",
    label: "מבזק בוקר",
  });
}
assert.equal(getBriefDisplayClassification(dailyTrading), null);
assert.equal(getBriefContextDisplay("evening-brief")?.title, "🌇 מבזק ערב");
assert.equal(getBriefContextDisplay("morning-brief")?.title, "🌅 מבזק בוקר");

const legacyConfig = {
  news: "https://gemini.google.com/gem/legacy-news",
  macro: "https://gemini.google.com/gem/legacy-macro",
  dayTrading: "https://gemini.google.com/gem/legacy-day-trading",
  appBuilder: "https://gemini.google.com/gem/legacy-app-builder",
};
localStorage.setItem("gems_config", JSON.stringify(legacyConfig));

const historicalSnapshot = getGemConfigSnapshot();
for (const [key, value] of Object.entries(legacyConfig)) {
  assert.equal(historicalSnapshot[key], value);
}
assert.equal(historicalSnapshot.marketBrief, MARKET_BRIEF_GEM_URL);

const savedSnapshot = saveGemConfigSnapshot({ marketBrief: MARKET_BRIEF_GEM_URL });
for (const [key, value] of Object.entries(legacyConfig)) {
  assert.equal(savedSnapshot[key], value);
}
assert.equal(savedSnapshot.marketBrief, MARKET_BRIEF_GEM_URL);

const openedTabs = [];
globalThis.window = {
  open(...args) {
    openedTabs.push(args);
    return null;
  },
};
assert.equal(openGeminiGemUrl(MARKET_BRIEF_GEM_URL), true);
assert.deepEqual(openedTabs, [[MARKET_BRIEF_GEM_URL, "_blank", "noopener,noreferrer"]]);
assert.equal(openGeminiGemUrl("https://example.com/not-a-gem"), false);
assert.equal(openedTabs.length, 1);
globalThis.window.open = () => { throw new Error("blocked"); };
assert.equal(openGeminiGemUrl(MARKET_BRIEF_GEM_URL), false);

const modalSource = readFileSync(
  new URL("../src/components/dashboard/GemSelectionModal.jsx", import.meta.url),
  "utf8",
);
const videoDetailSource = readFileSync(
  new URL("../src/components/dashboard/VideoDetailPanel.jsx", import.meta.url),
  "utf8",
);
assert.ok(modalSource.includes("clipboardPromise = navigator.clipboard.writeText(payload);"));
assert.ok(modalSource.includes("openGeminiGemUrl(resolvedGemUrl)"));
assert.ok(modalSource.includes('data-testid="gem-open-copy-transcript"'));
const openHandlerSource = modalSource.slice(
  modalSource.indexOf("const handleOpenGem = async () =>"),
  modalSource.indexOf("const handleSaveGem = async () =>"),
);
const clipboardStartIndex = openHandlerSource.indexOf("clipboardPromise = navigator.clipboard.writeText(payload)");
const synchronousOpenIndex = openHandlerSource.indexOf("const gemOpened = openGeminiGemUrl(resolvedGemUrl)");
const clipboardAwaitIndex = openHandlerSource.indexOf("await clipboardPromise");
assert.ok(clipboardStartIndex >= 0, "clipboard write must start directly from the click");
assert.ok(synchronousOpenIndex > clipboardStartIndex, "GEM open must start after initiating the clipboard write");
assert.ok(clipboardAwaitIndex > synchronousOpenIndex, "GEM open must happen before the first clipboard await");
assert.ok(modalSource.includes("const handleCopyOnly = async () =>"));
// The compact picker now opens unconditionally for every video (brief and
// non-brief, any confidence level, including "ממתין לסיווג" with no
// recommendation at all) — renderCompactTopRow() renders the generic
// `recommendedGem` lookup (which resolves to MARKET_BRIEF_GEM for brief
// videos — asserted behaviorally above via resolveWorkflowGemRecommendation)
// via renderSingleRow's showConfidence option, or a non-interactive
// "ממתין לסיווג" placeholder when there's no recommendation at all.
// CLEAR_WINNER_CONFIDENCE_THRESHOLD no longer gates the layout — it only
// styles the confidence badge (confident vs. weak match).
// See TRADINGBRAIN-GEMPICKER-COMPACT-SCORING.
assert.ok(modalSource.includes("renderCompactTopRow()"));
assert.equal((modalSource.match(/renderCompactTopRow\(\)/g) || []).length, 1);
assert.ok(modalSource.includes("return renderSingleRow(recommendedGem, null, { showConfidence: true });"));
assert.ok(modalSource.includes("ממתין לסיווג"));
assert.ok(modalSource.includes("CLEAR_WINNER_CONFIDENCE_THRESHOLD"));
assert.ok(modalSource.includes("hasClearWinner(gem.key, recommendedConfidencePct)"));
assert.doesNotMatch(modalSource, /isCompactPicker/);
assert.ok(modalSource.includes("BRIEF_WORKFLOW_HIDDEN_LABELS"));
assert.ok(modalSource.includes("visibleDynamicTopicGems.map((gem) => renderSingleRow(gem))"));
assert.ok(modalSource.includes("shouldExpandAdditionalOptions({ savedGemKey, workflowRecommendedGemKey })"));
assert.ok(modalSource.includes("savedGemKey !== workflowRecommendedGemKey"));
assert.ok(modalSource.includes("setShowAdditionalOptions("));
assert.ok(modalSource.includes("aria-expanded={showAdditionalOptions}"));
assert.ok(modalSource.includes("aria-controls={additionalOptionsId}"));
assert.ok(modalSource.includes("onClick={() => setShowAdditionalOptions((isExpanded) => !isExpanded)}"));
assert.ok(modalSource.includes("hidden={!showAdditionalOptions}"));
assert.ok(modalSource.includes("<span>אפשרויות נוספות</span>"));
assert.ok(modalSource.includes('type="button"'));
assert.ok(modalSource.includes("focus-visible:ring-2"));
assert.ok(modalSource.includes('showAdditionalOptions && "rotate-180"'));
assert.doesNotMatch(modalSource, /(?:localStorage|indexedDB)[\s\S]{0,120}showAdditionalOptions/i);
assert.ok(modalSource.includes('toast.error("ה-GEM נפתח, אך לא ניתן להעתיק ללוח — השתמש בכפתור ההעתקה הנפרד")'));
assert.ok(modalSource.includes('toast.error("אין תמלול להעתקה — ה-GEM נפתח ללא תוכן")'));
assert.doesNotMatch(
  modalSource,
  /onClick=\{handleOpenGem\}[\s\S]{0,120}disabled=\{!fullTranscriptText\}/,
);
assert.ok(videoDetailSource.includes("getBriefDisplayClassification(videoType)"));
assert.ok(videoDetailSource.includes("effectiveBriefDisplayLabel"));
assert.ok(videoDetailSource.includes("MARKET_BRIEF_GEM_LABEL"));

console.log("brief GEM selector QA: mapping, selection, clipboard and safe-open assertions passed");
