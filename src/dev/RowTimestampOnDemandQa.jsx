import React, { useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import RowTimestampGenerator from "@/components/dashboard/RowTimestampGenerator";
import { BriefContextHeader } from "@/components/dashboard/BriefContextHeader";
import { InsightsStructuredView } from "@/components/dashboard/InsightsStructuredView";
import { StaticVideoTimestampProvider } from "@/components/shared/StaticVideoTimestampLink";
import { createLocalStorageStore, createMemoryStore, createRowTimestampResolver, indexAnnotationsForVideo, saveAnnotations } from "@/lib/rowTimestampSidecar";
import { mergeRowTimestampsIntoAnalysis } from "@/lib/rowTimestampMerge";
import { buildRowTimestampAnalysis, buildRowTimestampDescriptors, extractRows, getRowTimestampActionState } from "@/lib/rowExtraction";
import { applyEvidenceGateToRowAnnotations } from "@/lib/rowTimestampAnnotation";
import { parseTimedTranscriptSegments } from "@/lib/timedNarrativeEvidenceGate";
import "../index.css";

const YOUTUBE_ID = "9su_tZfRYrI"; // approved real pilot ID; fixture content remains synthetic
const VIDEO_ID = "local_1787327696551_dd7jx";
const QA_MODE = new URLSearchParams(window.location.search).get("mode") || "success";
const USE_PERSISTENT_STORE = new URLSearchParams(window.location.search).get("persist") === "1";
const SOURCE_KIND = new URLSearchParams(window.location.search).get("source") || "saved-analysis";
const TRANSCRIPT_KIND = new URLSearchParams(window.location.search).get("transcript") || "timed";
const SEED_KIND = new URLSearchParams(window.location.search).get("seed") || "none";

// 13 segments — deliberately more than the Evidence Gate's maxWindow (10),
// so a late-transcript quote can never be matched by a coincidental
// whole-transcript concatenation window starting at segment 0. See the
// final report for a discovered pre-existing edge case in
// locateLiteralQuoteWindow when a transcript has <= maxWindow segments.
const TRANSCRIPT = [
  "[0] שלום וברוכים הבאים לשידור המבזק היומי",
  "[20] סקירה קצרה של סדר היום לפני שנתחיל",
  "[45] היום נדבר על ניתוח טכני של מדד הוויקס",
  "[70] נמשיך לבדוק את מדדי הפחד בשוק",
  "[95] עוד כמה מילים על הרקע הכללי",
  "[120] הכלל הראשון בניהול סיכונים הוא לשמור על סיכון מבוקר בכל עסקה",
  "[150] נעבור עכשיו לנתונים המאקרו כלכליים",
  "[180] סקירה של האינדיקטורים המובילים",
  "[210] בואו נעבור לנושא הבא, ריבית הפד",
  "[240] המשך הדיון בהחלטת הריבית האחרונה",
  "[270] סיכום ביניים לפני המסקנה הסופית",
  "[300] מסקנה חשובה: אין להסיק מגמה מנר בודד",
  "[320] תודה שצפיתם, נתראה בשידור הבא",
].join("\n");

const ANALYSIS = {
  shortSummary: "תקציר קיים שלא ישתנה",
  tags: ["שוק", "ריבית"],
  chapters: [{ title: "פרק קיים", startSeconds: 0, endSeconds: 200 }],
  keyPoints: [
    { text: "הכלל הראשון בניהול סיכונים הוא לשמור על סיכון מבוקר בכל עסקה" },
    { text: "אין להסיק מגמה מנר בודד" },
    "פריט טקסט פשוט ללא אובייקט — נשאר ללא שינוי",
  ],
  keyInsights: [
    { lesson: "בדיקת הקשר לפני קבלת החלטה", whyImportant: "כך נמנעת מסקנה על סמך נתון בודד" },
    { text: "היום נדבר על ניתוח טכני של מדד הוויקס" },
    { text: "שורה בלי שום ראיית זמן אמינה בתמלול" },
  ],
};

const GEMS_DATA = {
  universalTabs: {
    summary: { topTakeaways: ANALYSIS.keyPoints },
    insights: { top5Insights: ANALYSIS.keyInsights },
    usefulKnowledge: { reusableKnowledge: [ANALYSIS.keyPoints[0]] },
    specialized: {},
  },
};
const FIXTURE_VIDEO = { id: VIDEO_ID, url: `https://www.youtube.com/watch?v=${YOUTUBE_ID}`, durationSeconds: 320 };
const ACTIVE_ANALYSIS = SOURCE_KIND === "gems"
  ? buildRowTimestampAnalysis(FIXTURE_VIDEO, GEMS_DATA)
  : SOURCE_KIND === "no-rows" ? {} : ANALYSIS;
const ACTIVE_TRANSCRIPT = TRANSCRIPT_KIND === "timed" ? TRANSCRIPT : "";

async function fixtureLoadTranscriptFn({ youtubeId, signal }) {
  window.__rowTimestampTranscriptCalls = (window.__rowTimestampTranscriptCalls || 0) + 1;
  window.__rowTimestampTranscriptYoutubeId = youtubeId;
  await new Promise((resolve, reject) => {
    const timeoutId = setTimeout(resolve, 250);
    signal?.addEventListener("abort", () => {
      clearTimeout(timeoutId);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
  if (TRANSCRIPT_KIND === "404") {
    throw new Error("לא נמצא תמלול מתוזמן לסרטון. נסה שוב מאוחר יותר.");
  }
  if (TRANSCRIPT_KIND === "invalid") {
    throw new Error("התמלול שהתקבל אינו מכיל זמנים אמינים. נסה שוב.");
  }
  return { transcript: TRANSCRIPT, youtubeId, source: "fixture" };
}

// Canned response resolver: exercises the REAL, production evidence-gate
// logic against the fixture transcript — not a hardcoded static reply. No
// network call is made anywhere in this file.
async function fixtureGenerateFn(payload) {
  const { signal, ...wirePayload } = payload;
  const { rows } = wirePayload;
  window.__rowTimestampFixtureCalls = (window.__rowTimestampFixtureCalls || 0) + 1;
  window.__rowTimestampLastPayload = wirePayload;
  window.__rowTimestampGenerationHadSignal = signal instanceof AbortSignal;
  await new Promise((r) => setTimeout(r, 400)); // simulate latency, nothing else
  if (QA_MODE === "failure") throw new Error("כשל בדיקה צפוי");
  if (QA_MODE === "no-evidence") {
    return {
      accepted: [],
      rejected: rows.map((row) => ({ rowPath: row.rowPath, reason: "quote-not-found" })),
      staticTimeCoverage: { totalSegments: 13, analyzedSegments: 13, status: "full" },
    };
  }
  const rawAnnotations = [
    { rowPath: "summary.keyPoints[0]", sourceQuote: "הכלל הראשון בניהול סיכונים הוא לשמור על סיכון מבוקר בכל עסקה", estimatedStartSeconds: 120, timestampConfidence: 0.92 },
    { rowPath: "summary.keyPoints[1]", sourceQuote: "אין להסיק מגמה מנר בודד", estimatedStartSeconds: 300, timestampConfidence: 0.85 },
    { rowPath: "insights.keyInsights[0]", sourceQuote: "היום נדבר על ניתוח טכני של מדד הוויקס", estimatedStartSeconds: 45, timestampConfidence: 0.9 },
    // Deliberately unsupported claim, to prove rejection is real, not staged:
    { rowPath: "insights.keyInsights[1]", sourceQuote: "משפט שלא קיים בתמלול בכלל", estimatedStartSeconds: 45 },
  ];
  const segments = parseTimedTranscriptSegments(TRANSCRIPT);
  // The wire-format `rows` the caller sent only carries {rowPath, text} —
  // reconstruct the full row shape (fingerprint/tab/field) the same way a
  // real server would: from its own copy of the current analysis, keyed by
  // the caller-supplied rowPath (never trusting anything else in `rows`).
  const fullRows = rows.map((r) => findRow(r.rowPath)).filter(Boolean);
  const { accepted, rejected } = applyEvidenceGateToRowAnnotations(rawAnnotations, fullRows, segments);
  return {
    accepted,
    rejected,
    staticTimeCoverage: { totalSegments: segments.length, analyzedSegments: segments.length, status: "full" },
  };
}
function findRow(rowPath) {
  return extractRows(ACTIVE_ANALYSIS).find((r) => r.rowPath === rowPath) || {};
}

function App() {
  const [store] = useState(() => {
    const nextStore = USE_PERSISTENT_STORE ? createLocalStorageStore() : createMemoryStore();
    if (SEED_KIND === "existing") {
      const seedRows = extractRows(ACTIVE_ANALYSIS);
      saveAnnotations(nextStore, VIDEO_ID, [
        {
          rowPath: seedRows[0].rowPath,
          fingerprint: seedRows[0].fingerprint,
          estimatedStartSeconds: 320,
          sourceQuote: "ממצא סינתטי מאומת",
        },
        {
          rowPath: seedRows[1].rowPath,
          fingerprint: "stale-fixture-fingerprint",
          estimatedStartSeconds: 300,
          sourceQuote: "ציטוט ישן מטקסט שהשתנה",
        },
      ]);
    }
    return nextStore;
  });
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const [activeQaTab, setActiveQaTab] = useState("summary");
  const index = indexAnnotationsForVideo(store, VIDEO_ID);
  const rowDescriptors = buildRowTimestampDescriptors({
    analysis: ACTIVE_ANALYSIS,
    recordId: VIDEO_ID,
    youtubeId: YOUTUBE_ID,
  });
  const resolver = createRowTimestampResolver(rowDescriptors, index);
  const merged = mergeRowTimestampsIntoAnalysis(ACTIVE_ANALYSIS, index);
  const actionState = getRowTimestampActionState({
    video: FIXTURE_VIDEO,
    youtubeId: YOUTUBE_ID,
    analysis: ACTIVE_ANALYSIS,
    transcriptText: ACTIVE_TRANSCRIPT,
  });

  const universalInsightSections = [
    { key: "summary-keyPoints", label: "נקודות מפתח", items: merged.keyPoints },
    { key: "insights-keyInsights", label: "תובנות", items: merged.keyInsights },
  ];

  const timestampAction = actionState.shouldRender ? (
    <RowTimestampGenerator
      video={FIXTURE_VIDEO}
      recordId={VIDEO_ID}
      youtubeId={YOUTUBE_ID}
      transcriptText={ACTIVE_TRANSCRIPT}
      loadTranscriptFn={fixtureLoadTranscriptFn}
      analysis={ACTIVE_ANALYSIS}
      rowDescriptors={rowDescriptors}
      generateFn={fixtureGenerateFn}
      store={store}
      disabledReason={actionState.disabledReason}
      onAnnotationsChanged={bump}
    />
  ) : null;

  return (
    <div dir="rtl" className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="bg-amber-100 dark:bg-amber-900/40 border border-amber-400 rounded-lg p-3 text-sm font-semibold">
        ⚠️ RowTimestampOnDemandQa — פיקסצ'ר בדיקה מבודד עם נתונים סינתטיים בלבד.
      </div>

      <div className="border rounded-lg p-4" data-testid="qa-generator-block">
        <BriefContextHeader
          slug="morning-brief"
          subject="מבזק בוקר"
          publishedAt="2026-08-21T12:00:00.000Z"
          showSourceCaption={false}
          action={timestampAction}
        />
        <div className="flex flex-wrap gap-1 mt-3" data-testid="qa-tab-list">
          {["summary", "insights", "chapters", "useful-knowledge", "specialized"].map((tab) => (
            <button key={tab} type="button" data-testid={`qa-tab-${tab}`} onClick={() => setActiveQaTab(tab)}>
              {tab}
            </button>
          ))}
        </div>
        <p data-testid="qa-active-tab">{activeQaTab}</p>
      </div>

      <div className="border rounded-lg p-4" data-testid="qa-render-block" key={version}>
        <h2 className="font-semibold mb-2">רינדור דרך רכיבי production אמיתיים</h2>
        <StaticVideoTimestampProvider
          youtubeId={YOUTUBE_ID}
          activeTab={activeQaTab}
          resolver={resolver}
        >
          <InsightsStructuredView
            sections={universalInsightSections}
            videoId={YOUTUBE_ID}
            onSaveToBrain={() => {}}
            isSaved={() => false}
            bulkSelection={null}
            tabScope="insights"
          />
        </StaticVideoTimestampProvider>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
