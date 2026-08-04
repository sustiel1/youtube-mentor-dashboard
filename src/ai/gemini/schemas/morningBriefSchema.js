/**
 * JSON schema example for Morning Brief GEM output.
 * Includes universalTabs (preferred) and legacy flat fields (fallback).
 *
 * The GEM prompt should return universalTabs at the top level.
 * The app reads universalTabs first; if absent, falls back to legacy flat keys.
 */
export function getMorningBriefSchemaExample() {
  return JSON.stringify({
    universalTabs: {
      summary: [
        "Today's session opened with cautious optimism as Fed held rates steady.",
        "Key watch: CPI data due Thursday could shift momentum."
      ],
      chapters: [
        { title: "Pre-market Overview", startSeconds: null, endSeconds: null, timestampSource: "unavailable", timestampConfidence: null, summary: "SPY gap-down reversed at open" }
      ],
      insights: [
        "Market is pricing in 2 rate cuts before year-end — watch FOMC minutes.",
        "Tech sector showing relative strength despite broad-market weakness."
      ],
      usefulKnowledge: [
        "When VIX > 25, reduce position size by 50%.",
        "Pre-market volume spike on SPY signals institutional activity."
      ],
      appBuilder: {
        kpiList: ["VIX level", "SPY pre-market gap"],
        dashboards: ["Pre-market scanner", "Sector rotation heatmap"],
        prompts: ["Show me today's macro events and expected market impact"],
        suggestedFeatures: ["Economic calendar integration", "Fear & Greed meter"]
      },
      topicsSubtopics: [
        "Federal Reserve",
        "S&P 500",
        "CPI / Inflation",
        "Tech sector rotation"
      ],
      specialized: {
        indices: [
          { name: "S&P 500", level: "5,280", change: "+0.3%", note: "Holding above 50-day MA" },
          { name: "Nasdaq 100", level: "18,540", change: "+0.5%" }
        ],
        marketNews: [
          "Fed holds rates steady at 5.25-5.50%",
          "NVDA reports Q2 beat, guides higher"
        ],
        stocksMentioned: [
          { symbol: "NVDA", reason: "Q2 earnings beat", importance: "high" },
          { symbol: "SPY", reason: "Key support at 5,200", importance: "medium" }
        ],
        macro: [
          { event: "CPI Release", date: "Thursday 8:30 AM", importance: "high", impact: "Rate-sensitive sectors" }
        ],
        sentiment: [
          {
            label: "Fear & Greed",
            direction: "neutral",
            value: "62",
            source: "video",
            scope: "US market",
            evidence: "The video explicitly states the index value is 62",
            drivers: ["risk appetite discussed in the video"],
            confidence: 0.7,
            verificationState: "video-unverified",
            verified: false,
            externallyVerified: false,
            etfTarget: null
          }
        ],
        calendar: [
          { event: "US CPI Release", date: "Thursday 8:30 AM", importance: "high", impact: "Rate-sensitive sectors could reprice" },
          { event: "University of Michigan Sentiment", date: "Friday 10:00 AM", importance: "medium", impact: "Consumer confidence signal" }
        ],
        opportunities: [
          "NVDA breakout above $130 — momentum entry",
          "XLF at key support — swing trade setup"
        ],
        risks: [
          "Hot CPI could push yields higher and compress tech valuations",
          "Middle East tension escalating — watch oil prices"
        ]
      }
    },

    // Legacy flat fields — still read as fallback when universalTabs is absent
    shortSummary: "...",
    chapters: [],
    top5Insights: ["..."],
    reusableKnowledge: ["..."],
    keyTakeaways: ["..."],
    actionChecklist: ["..."],
    marketNews: ["..."],
    indices: [],
    stocksMentioned: [],
    macro: [],
    sentiment: [{ label: "...", direction: "bullish|bearish|neutral|unverified", source: "video", evidence: "...", verificationState: "video-unverified" }],
    calendar: [{ event: "...", date: "...", importance: "high|medium|low", impact: "..." }],
    opportunities: ["..."],
    risks: ["..."],
    tags: ["..."],
    obsidianTopics: ["..."]
  }, null, 2);
}
