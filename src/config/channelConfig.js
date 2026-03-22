// ─── Channel Config ───────────────────────────────────────────────────────────
// Mapping: mentorId → YouTube channelId + topic/category metadata
//
// ❗ כיצד למצוא Channel ID:
//    1. כנס לדף הערוץ ביוטיוב
//    2. לחץ ימני → "View Page Source"
//    3. חפש: "channelId" — תמצא ערך בפורמט UCxxxxxxxxxxxxxxxxxxxxxxxxx
//    4. או השתמש בכלי: https://commentpicker.com/youtube-channel-id.php
//
// ✅ Channel ID שמולא → RSS יעבוד
// ❌ null → הערוץ ידולג בזמן המשיכה

export const CHANNEL_CONFIG = {
  // ── שוק ההון ─────────────────────────────────────
  m1: {
    channelId: "UCSxjNbPriyBh9RNl_QNSAtw",
    handle: "@micha.stocks",
    name: "Micha.Stocks",
    category: "Markets",
    topicIds: ["t2", "t7", "t3"],
    subCategory: "ניתוח שוק",
  },
  m2: {
    channelId: "UCrQmXSenNhePSOiCTdnhwRg",
    handle: "@bursagraph",
    name: "בורסה גרף",
    category: "Markets",
    topicIds: ["t5", "t2"],
    subCategory: "ניתוח טכני",
  },
  m7: {
    channelId: "UCSB4SNRWhbemGAJ4wfeKj2Q",
    handle: "@TheHasidicTrader",
    name: "The Hasidic Trader",
    category: "Markets",
    topicIds: ["t4", "t2"],
    subCategory: "מסחר יומי",
  },
  m9: {
    channelId: "UCQ-TvNxqs6oj0XtbMFOt37w",
    handle: "@OliverVelezTrading",
    name: "Oliver Velez Trading",
    category: "Markets",
    topicIds: ["t4", "t7"],
    subCategory: "מסחר מקצועי",
  },
  m11: {
    channelId: "UCSyPOk83lhOXoGcT2vUNhdw",
    handle: "@DorAmirTrading",
    name: "Dor Amir Trading",
    category: "Markets",
    topicIds: ["t4", "t2"],
    subCategory: "סיכומי שוק",
  },
  m12: {
    channelId: "UCgAPfTzpZ5nLz7IgIvNsY7w",
    handle: "@EyalShaniTrading",
    name: "Eyal Shani",
    category: "Markets",
    topicIds: ["t2", "t4"],
    subCategory: "שוק ההון",
  },
  m15: {
    channelId: "UC32oVb-nfyRBNlWzUw3dC5Q",
    handle: "@Wysetrade",
    name: "Wysetrade",
    category: "Markets",
    topicIds: ["t5", "t4"],
    subCategory: "ניתוח טכני",
  },

  // ── בינה מלאכותית ואוטומציה ──────────────────────
  m3: {
    channelId: "UC5_2We-HeVdEeHcIyfmMHOg",
    handle: "@EdHillAI",
    name: "Ed Hill AI Automation",
    category: "AI",
    topicIds: ["t1", "t8"],
    subCategory: "סוכני AI",
  },
  m4: {
    channelId: "UCU-63yYePl3WDLVGS3ElXkA",
    handle: "@automation-tribe",
    name: "Automation-Tribe",
    category: "AI",
    topicIds: ["t8", "t12"],
    subCategory: "אוטומציה",
  },
  m5: {
    channelId: "UCn2RJFAA1ndipnVJsYAwWOw",
    handle: "@TheAIAndy",
    name: "AI Andy",
    category: "AI",
    topicIds: ["t1", "t12"],
    subCategory: "כלי AI",
  },
  m6: {
    channelId: "UCfnihhol5a4Qc2EciLf5kOQ",
    handle: "@itsAimprove",
    name: "Aimprove - אימפרוב",
    category: "AI",
    topicIds: ["t1"],
    subCategory: "מדריכי AI",
  },
  m8: {
    channelId: "UCGFogLEUR_nuiT83pt8zVWQ",
    handle: "@BibasAI",
    name: "Eden Bibas",
    category: "AI",
    topicIds: ["t1", "t12"],
    subCategory: "כלי AI",
  },
  m10: {
    channelId: "UCJ-KJeHzrnZkGX7qAM2V74Q",
    handle: "@AIPathwaysChannel",
    name: "AI Pathways",
    category: "AI",
    topicIds: ["t1", "t8", "t3"],
    subCategory: "סוכני AI",
  },

  // ── פיתוח תוכנה ──────────────────────────────────
  m13: {
    channelId: "UChCdtyyAp7p3UO56HgZxJJA",
    handle: "@base44",
    name: "Base44 Community",
    category: "Dev",
    topicIds: ["t13", "t9"],
    subCategory: "Base44",
  },
  m14: {
    channelId: "UCrLSr2UVC4DGTZikP7AFOLA",
    handle: "@ranbar",
    name: "Ran Bar Zik",
    category: "Dev",
    topicIds: ["t9", "t12"],
    subCategory: "פיתוח ווב",
  },
};

// Returns only channels that have a channelId configured
export function getConfiguredChannels() {
  return Object.entries(CHANNEL_CONFIG)
    .filter(([, cfg]) => cfg.channelId)
    .map(([mentorId, cfg]) => ({ mentorId, ...cfg }));
}

// Returns all channels regardless of channelId status
export function getAllChannels() {
  return Object.entries(CHANNEL_CONFIG).map(([mentorId, cfg]) => ({
    mentorId,
    ...cfg,
    isConfigured: !!cfg.channelId,
  }));
}
