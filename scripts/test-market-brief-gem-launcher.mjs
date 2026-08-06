import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import {
  MARKET_BRIEF_GEM_URL,
  MARKET_BRIEF_GEM_NAME,
  MARKET_BRIEF_GEM,
  buildMarketBriefGemPayload,
  isCanonicalMarketBrief,
  resolveMarketBriefSession,
} from "../src/lib/marketBriefGemLauncher.js";

const require = createRequire(import.meta.url);
const { normalizeMarketBriefPayload, validateMarketBriefPayload } = require("../shared/marketExtractionContract.cjs");

assert.equal(MARKET_BRIEF_GEM_URL, "https://gemini.google.com/gem/1CN2KyVNHZalbhNR6rqCcztivoHcl4ySx?usp=sharing");
assert.equal(MARKET_BRIEF_GEM_NAME, "מבזק בוקר / ערב");
assert.equal(MARKET_BRIEF_GEM.key, "morning-evening-market-brief");
assert.deepEqual(MARKET_BRIEF_GEM.supportedVideoTypes, ["morningBrief", "eveningBrief"]);
assert.equal(isCanonicalMarketBrief({ contentType: "marketBrief" }), true);
assert.equal(isCanonicalMarketBrief({ tabsKey: "morningBrief" }), true);
assert.equal(isCanonicalMarketBrief({ videoType: "close" }), true);
assert.equal(isCanonicalMarketBrief({ videoType: "learning" }), false);
const lateNightFixture = { title: "לייט נייט דיווחי תוצאות TSLA NOW IBM LRCX TXN", contentType: "dailyTrading", videoType: "learning" };
assert.equal(isCanonicalMarketBrief({ video: lateNightFixture, contentType: lateNightFixture.contentType }), true);
assert.equal(resolveMarketBriefSession({ video: lateNightFixture }).briefType, "evening");
for (const title of ["לייט נייט", "לייטנייט", "מבזק ערב", "סיכום יום המסחר", "after market", "market close", "late night"]) {
  assert.equal(isCanonicalMarketBrief({ video: { title, contentType: "dailyTrading" } }), true, `${title} must use the compact Market Brief selector`);
  assert.equal(resolveMarketBriefSession({ video: { title } }).briefType, "evening", `${title} must resolve as evening`);
}
assert.equal(isCanonicalMarketBrief({ video: { title: "לייט נייט", userConfirmedSubCategory: true, confirmedSubCategory: "מסחר יומי" } }), false);
assert.equal(isCanonicalMarketBrief({ video: { title: "אסטרטגיית מסחר יומי", contentType: "dailyTrading" } }), false);

assert.deepEqual(
  resolveMarketBriefSession({ videoType: "morningBrief" }),
  {
    briefType: "morning", marketSession: "before-market", labelHe: "מבזק בוקר",
    phaseLabelHe: "לפני פתיחת המסחר", icon: "🌅", confidence: "high", classificationSource: "stored",
  },
);
assert.equal(resolveMarketBriefSession({ videoType: "close" }).briefType, "evening");
assert.equal(resolveMarketBriefSession({ video: { videoType: "close" }, videoType: "learning" }).briefType, "evening");
assert.equal(resolveMarketBriefSession({ video: { title: "מבזק לייב פתיחה לתאריך 9.7.26" } }).briefType, "morning");
assert.equal(resolveMarketBriefSession({ video: { title: "פתיחת מסחר" } }).briefType, "morning");
assert.equal(resolveMarketBriefSession({ video: { title: "לייט נייט לתאריך 9.6.26" } }).briefType, "evening");
assert.equal(resolveMarketBriefSession({ video: { title: "סיכום מסחר" } }).briefType, "evening");
assert.equal(resolveMarketBriefSession({ video: { title: "סקירת שוק", publishedAt: "2026-08-02T06:00:00Z" } }).briefType, "unknown");
assert.equal(resolveMarketBriefSession({ video: { title: "סקירת שוק" }, manualSession: "evening" }).classificationSource, "manual");
assert.equal(resolveMarketBriefSession({ video: { briefType: "morning", title: "לייט נייט" } }).briefType, "morning");
assert.equal(resolveMarketBriefSession({ structuredData: { briefType: "evening" }, video: { title: "מבזק פתיחה" } }).briefType, "evening");

const transcript = "טקסט מתוזמן 00:00 ושורה נוספת";
const morningPayload = buildMarketBriefGemPayload({
  video: { title: "מבזק פתיחה", url: "https://youtu.be/example", publishedAt: "2026-07-09" },
  fullTranscriptText: transcript,
  session: resolveMarketBriefSession({ videoType: "morningBrief" }),
});
assert.match(morningPayload, /BRIEF SESSION:\nmorning/);
assert.match(morningPayload, /MARKET PHASE:\nbefore-market/);
assert.equal(morningPayload.split(transcript).length - 1, 1);
assert.match(morningPayload, /today's economic calendar/);
assert.match(morningPayload, /טקסט מתוזמן 00:00/);

const youtubeIdPayload = buildMarketBriefGemPayload({
  video: { youtubeId: "abcdefghijk" },
  fullTranscriptText: transcript,
  session: resolveMarketBriefSession({ videoType: "morningBrief" }),
});
assert.match(youtubeIdPayload, /https:\/\/www\.youtube\.com\/watch\?v=abcdefghijk/);

const eveningPayload = buildMarketBriefGemPayload({
  video: { title: "לייט נייט" },
  fullTranscriptText: transcript,
  session: resolveMarketBriefSession({ videoType: "eveningBrief" }),
});
assert.match(eveningPayload, /BRIEF SESSION:\nevening/);
assert.match(eveningPayload, /MARKET PHASE:\nafter-market/);
assert.match(eveningPayload, /actual closing performance/);
assert.equal(eveningPayload.split(transcript).length - 1, 1);

const chooserSource = fs.readFileSync(new URL("../src/components/dashboard/GemSelectionModal.jsx", import.meta.url), "utf8");
const configSource = fs.readFileSync(new URL("../src/lib/gemsConfig.js", import.meta.url), "utf8");
assert.match(chooserSource, /isMarketBrief \? \(/);
assert.match(chooserSource, /!isMarketBrief && <div>/);
assert.match(configSource, /noopener,noreferrer/);
assert.match(chooserSource, /aria-label=\{isMarketBrief/);
assert.match(chooserSource, /MARKET_BRIEF_GEM_NAME/);
assert.match(chooserSource, /\{briefSession\.labelHe\}/);
assert.equal(resolveMarketBriefSession({ video: { title: "לייט נייט" } }).phaseLabelHe, "לאחר יום המסחר");
assert.equal(resolveMarketBriefSession({ video: { title: "מבזק לייב פתיחה" } }).phaseLabelHe, "לפני פתיחת המסחר");
assert.doesNotMatch(chooserSource, /Micha\.Stocks/);
assert.equal((fs.readFileSync(new URL("../src/lib/marketBriefGemLauncher.js", import.meta.url), "utf8").match(/1CN2KyVNHZalbhNR6rqCcztivoHcl4ySx/g) || []).length, 1);

const structuredMetadata = normalizeMarketBriefPayload({
  contentType: "marketBrief",
  briefType: "evening",
  marketSession: "after-market",
  shortSummary: "סיכום תקין",
});
assert.equal(structuredMetadata.briefType, "evening");
assert.equal(structuredMetadata.marketSession, "after-market");
assert.doesNotThrow(() => validateMarketBriefPayload({ contentType: "marketBrief", shortSummary: "legacy" }));

console.log("Market Brief GEM launcher regression passed (39 assertions)");
