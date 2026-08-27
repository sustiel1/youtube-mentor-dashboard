import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  isMarketBriefWorkflowVideo,
  resolveCanonicalBriefWorkflowVideo,
} from "../src/lib/gemRecommender.js";

const linkedAnalyzedVideo = {
  id: "linked-market-video",
  title: "מבזק פתיחת מסחר לתאריך 28.4.26",
  category: "שוק ההון",
  subCategory: "מסחר יומי",
};
const canonicalMorningAnalysis = {
  contentType: "marketBrief",
  universalTabs: { summary: { shortSummary: "saved" } },
};

assert.equal(
  isMarketBriefWorkflowVideo(linkedAnalyzedVideo),
  true,
  "a linked video titled 'מבזק פתיחת מסחר' must use the compact brief selector",
);
const legacyAnalyzedVideo = {
  ...linkedAnalyzedVideo,
  title: "סקירת השוק לתאריך 28.4.26",
};
assert.equal(isMarketBriefWorkflowVideo(legacyAnalyzedVideo), false);
const resolvedMorning = resolveCanonicalBriefWorkflowVideo(
  legacyAnalyzedVideo,
  canonicalMorningAnalysis,
);
assert.notEqual(resolvedMorning, legacyAnalyzedVideo);
assert.equal(resolvedMorning.subCategory, "morning-brief");
assert.equal(resolvedMorning.contentType, "marketBrief");
assert.equal(isMarketBriefWorkflowVideo(resolvedMorning), true);
assert.equal(linkedAnalyzedVideo.subCategory, "מסחר יומי", "read-time routing must not mutate the saved video");

const resolvedEvening = resolveCanonicalBriefWorkflowVideo(legacyAnalyzedVideo, {
  ...canonicalMorningAnalysis,
  subtype: "evening",
});
assert.equal(resolvedEvening.subCategory, "evening-brief");
assert.equal(isMarketBriefWorkflowVideo(resolvedEvening), true);

const titleIdentifiedEvening = {
  ...linkedAnalyzedVideo,
  title: "לייט נייט מבזק ערב — 05.08.2026",
};
assert.equal(
  resolveCanonicalBriefWorkflowVideo(titleIdentifiedEvening, canonicalMorningAnalysis),
  titleIdentifiedEvening,
  "an existing Morning/Evening identity must win over the legacy Morning fallback",
);

assert.equal(
  resolveCanonicalBriefWorkflowVideo(legacyAnalyzedVideo, { contentType: "general" }),
  legacyAnalyzedVideo,
  "non-Market Brief videos must keep the general GEM selector",
);

const panelSource = readFileSync(
  new URL("../src/components/dashboard/VideoDetailPanel.jsx", import.meta.url),
  "utf8",
);
assert.match(panelSource, /resolveCanonicalBriefWorkflowVideo\(effectiveVideo, marketBriefData\)/);
assert.match(panelSource, /<GemSelectionModal[\s\S]*?video=\{gemSelectionVideo\}/);

console.log("GEMS linked-import routing QA: canonical Morning/Evening selector assertions passed");
