/**
 * JSON schema example for Morning Brief GEM output.
 * Includes universalTabs (preferred) and legacy flat fields (fallback).
 *
 * The GEM prompt should return universalTabs at the top level.
 * The app reads universalTabs first; if absent, falls back to legacy flat keys.
 */
export function getMorningBriefSchemaExample() {
  return JSON.stringify({
    briefType: "morning",
    marketSession: "before-market",
    universalTabs: {
      summary: [
        "Today's session opened with cautious optimism as Fed held rates steady.",
        "Key watch: CPI data due Thursday could shift momentum."
      ],
      chapters: [
        {
          title: "Pre-market Overview",
          startSeconds: 0,
          endSeconds: 120,
          timestampSource: "youtube-timedtext",
          timestampConfidence: 1,
          summary: "SPY gap-down reversed at open"
        }
      ],
      insights: {
        top5Insights: [{ insight: "Market is pricing in 2 rate cuts before year-end.", startSeconds: 522.4, endSeconds: 548.1, timestampSource: "timed-transcript-alignment", timestampConfidence: 0.94 }],
        learningInsights: [{ lesson: "Wait for confirmation before increasing risk.", startSeconds: null, endSeconds: null, timestampSource: "unavailable", timestampConfidence: null }],
        marketLessons: [], tradingInsights: [], conclusions: []
      },
      usefulKnowledge: {
        reusableKnowledge: [{ text: "When VIX > 25, reduce position size by 50%.", startSeconds: 0, endSeconds: null, timestampSource: "youtube-timedtext", timestampConfidence: 1 }],
        keyTakeaways: ["Legacy string items remain supported."],
        actionChecklist: []
      },
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
          { title: "Fed holds rates steady", summary: "Rates remain at 5.25-5.50%", impact: "No new directional evidence", sentiment: "neutral", sentimentReason: "Factual decision without a supported directional market reaction", sentimentConfidence: 0.8, sourceEvidence: ["Rates held steady"] },
          { title: "NVDA reports Q2 beat", summary: "Revenue exceeded expectations and guidance increased", impact: "Favorable for NVDA", sentiment: "positive", sentimentReason: "Beat and raised guidance", sentimentConfidence: 0.95, sourceEvidence: ["Revenue beat", "Guidance raised"] }
        ],
        stocksMentioned: [
          { symbol: "NVDA", exchange: "NASDAQ", reason: "Q2 earnings beat", importance: "high" },
          { symbol: "SPY", reason: "Key support at 5,200", importance: "medium" }
        ],
        macro: [
          { event: "CPI Release", date: "Thursday 8:30 AM", importance: "high", impact: "Rate-sensitive sectors" }
        ],
        sentiment: [
          "Fear & Greed index at 62 — Greed territory",
          "Put/Call ratio 0.82 — mildly bullish"
        ],
        calendar: [
          { event: "US CPI Release", date: "Thursday 8:30 AM", importance: "high", impact: "Rate-sensitive sectors could reprice" },
          { event: "University of Michigan Sentiment", date: "Friday 10:00 AM", importance: "medium", impact: "Consumer confidence signal" }
        ],
        tradingOpportunities: [
          {
            ticker: "NVDA",
            setup: "Breakout above $130",
            reason: "Momentum entry supported by the transcript",
            priority: "high"
          },
          {
            ticker: "XLF",
            setup: "Swing setup at key support",
            reason: "Support level explicitly discussed",
            priority: "medium"
          }
        ],
        // Up to 3 distinct evidence-backed items; [] is valid. Never add filler.
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
    marketNews: [{ title: "...", summary: "...", impact: "...", sentiment: "positive|negative|neutral|mixed|unknown", sentimentReason: "...", sentimentConfidence: 0, sourceEvidence: ["..."] }],
    indices: [],
    stocksMentioned: [],
    macro: [],
    sentiment: ["..."],
    calendar: [{ event: "...", date: "...", importance: "high|medium|low", impact: "..." }],
    tradingOpportunities: ["..."],
    risks: ["..."],
    tags: ["..."],
    obsidianTopics: ["..."]
  }, null, 2);
}
