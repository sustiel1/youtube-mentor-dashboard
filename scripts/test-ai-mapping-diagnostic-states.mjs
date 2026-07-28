/**
 * Focused regression check for the AI Mapping Diagnosis classification fix.
 * Before this change, buildLocalDiagResult() pushed every blanket warning
 * ("Missing AI analysis", "No chapters", "No subCategory...") and every
 * empty-tab check into `issues` with severity 'high'/'medium' and an
 * unconditional recommendedFix — even when the real cause was simply that no
 * analysis/chapter-generation had been run yet (no source data existed at
 * all). This produced misleading warnings and an always-present "Copy Fix
 * Prompt for Claude Code" button with no proven bug behind it.
 *
 * Scenarios 1-3 call buildDiagnosticReport()/buildLocalDiagResult() directly
 * — both now exported from AiMappingModal.jsx — via a dynamic import of the
 * real module inside the already-loaded Vite dev-server page (same technique
 * used in scripts/test-marketbrief-tabs-field-mapping-e2e.mjs: no shim/loader
 * needed, import.meta.env.DEV works natively).
 *
 * Scenario 4 drives the real UI: opens the AI Mapping modal for a
 * not-yet-analyzed video and clicks "אבחן מיפוי עם AI". No real Gemini API
 * key is configured in this environment, so the call genuinely falls back to
 * Local Diagnostic Mode — this exercises the real fallback path, not a mock.
 *
 * Run: node scripts/test-ai-mapping-diagnostic-states.mjs  (dev server on :5184)
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5184';

function record(results, id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${id}: ${detail}`);
}

async function main() {
  const results = [];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // ── Scenario 1: analysisExists: false, transcript exists ──────────────
  const s1 = await page.evaluate(async () => {
    const mod = await import('/src/components/dashboard/AiMappingModal.jsx');
    const v = {
      id: 'diag-e2e-scenario-1',
      title: 'Scenario 1 Video',
      category: 'שוק ההון',
      subCategory: 'ניתוח טכני',
      transcript: 'x'.repeat(5000),
    };
    const report = mod.buildDiagnosticReport({
      v, videoType: 'learning', normalizedSubCategory: 'technical-analysis',
      selectedTabsConfigKey: 'learning', gemRec: null, marketBriefData: null,
      userConfirmedSubCategory: true, confirmedAt: null,
    });
    const result = mod.buildLocalDiagResult(report, { droppedFields: [] });
    return {
      issuesCount: result.issues.length,
      hasProvenMappingFailure: result.hasProvenMappingFailure,
      fixPromptForClaudeCode: result.fixPromptForClaudeCode,
      chaptersAction: result.actionsNeeded.find((a) => a.area === 'chapters')?.action ?? null,
      usefulKnowledgeAction: result.actionsNeeded.find((a) => a.area === 'usefulKnowledge')?.action ?? null,
      appBuilderAction: result.actionsNeeded.find((a) => a.area === 'appBuilder')?.action ?? null,
      analysisMessage: result.actionsNeeded.find((a) => a.area === 'analysis')?.message ?? null,
    };
  });
  record(results, '1a-no-genuine-issues', s1.issuesCount === 0, `issuesCount=${s1.issuesCount}`);
  record(results, '1b-no-fix-prompt', s1.fixPromptForClaudeCode === null && s1.hasProvenMappingFailure === false, `fixPrompt=${s1.fixPromptForClaudeCode}, hasProven=${s1.hasProvenMappingFailure}`);
  record(results, '1c-chapters-available-as-action', s1.chaptersAction === 'generateChapters', `chaptersAction=${s1.chaptersAction}`);
  record(results, '1d-useful-knowledge-not-yet-generated', s1.usefulKnowledgeAction === 'runAnalysis', `usefulKnowledgeAction=${s1.usefulKnowledgeAction}`);
  record(results, '1e-app-builder-not-yet-generated', s1.appBuilderAction === 'runAnalysis', `appBuilderAction=${s1.appBuilderAction}`);
  record(results, '1f-analysis-not-run-message', s1.analysisMessage === 'טרם בוצע ניתוח AI', `analysisMessage="${s1.analysisMessage}"`);

  // ── Scenario 2: source data exists but rendered items are zero ────────
  const s2 = await page.evaluate(async () => {
    const mod = await import('/src/components/dashboard/AiMappingModal.jsx');
    const report = {
      video: { title: 'Scenario 2 Video', category: 'שוק ההון', subCategory: 'test', tabsKey: 'learning', analysisFlow: 'General' },
      transcript: { exists: true, length: 5000, segments: 0 },
      chapters: { finalChapters: 0, source: 'none' },
      analysis: { exists: true },
      tabs: {
        summary: { items: 3, sources: [], sourceItemCount: 3 },
        chapters: { items: 0, sources: [], sourceItemCount: 0 },
        insights: { items: 5, sources: [], sourceItemCount: 5 },
        usefulKnowledge: { items: 0, sources: ['marketBriefData.learningInsights'], sourceItemCount: 3 },
        appBuilder: { items: 2, sources: [], sourceItemCount: 2 },
        topics: { items: 3, sources: [], sourceItemCount: 3 },
        specialized: { items: 15, sources: [], sourceItemCount: 15 },
      },
      warnings: [],
    };
    const result = mod.buildLocalDiagResult(report, { droppedFields: [] });
    return {
      issuesCount: result.issues.length,
      provenIssue: result.issues.find((i) => i.area === 'tab:usefulKnowledge') ?? null,
      hasProvenMappingFailure: result.hasProvenMappingFailure,
      fixPromptForClaudeCode: result.fixPromptForClaudeCode,
      actionsNeededHasUsefulKnowledge: result.actionsNeeded.some((a) => a.area === 'usefulKnowledge'),
    };
  });
  record(results, '2a-genuine-mapping-issue-detected', !!s2.provenIssue && s2.provenIssue.severity === 'high' && s2.provenIssue.provenMappingFailure === true, `provenIssue=${JSON.stringify(s2.provenIssue)}`);
  record(results, '2b-fix-prompt-enabled', s2.hasProvenMappingFailure === true && typeof s2.fixPromptForClaudeCode === 'string' && s2.fixPromptForClaudeCode.includes('usefulKnowledge'), `hasProven=${s2.hasProvenMappingFailure}, promptHasKey=${s2.fixPromptForClaudeCode?.includes('usefulKnowledge')}`);
  record(results, '2c-not-double-classified-as-action', s2.actionsNeededHasUsefulKnowledge === false, `actionsNeededHasUsefulKnowledge=${s2.actionsNeededHasUsefulKnowledge}`);

  // ── Scenario 3: analysis exists, rendered data exists — success, no false warning ──
  const s3 = await page.evaluate(async () => {
    const mod = await import('/src/components/dashboard/AiMappingModal.jsx');
    const report = {
      video: { title: 'Scenario 3 Video', category: 'שוק ההון', subCategory: 'test', tabsKey: 'learning', analysisFlow: 'General' },
      transcript: { exists: true, length: 5000, segments: 10 },
      chapters: { finalChapters: 5, source: 'ai' },
      analysis: { exists: true },
      tabs: {
        summary: { items: 3, sources: ['x'], sourceItemCount: 3 },
        chapters: { items: 5, sources: ['x'], sourceItemCount: 5 },
        insights: { items: 5, sources: ['x'], sourceItemCount: 5 },
        usefulKnowledge: { items: 4, sources: ['x'], sourceItemCount: 4 },
        appBuilder: { items: 2, sources: ['x'], sourceItemCount: 2 },
        topics: { items: 3, sources: ['x'], sourceItemCount: 3 },
        specialized: { items: 15, sources: ['x'], sourceItemCount: 15 },
      },
      warnings: [],
    };
    const result = mod.buildLocalDiagResult(report, { droppedFields: [] });
    return {
      issuesCount: result.issues.length,
      actionsNeededCount: result.actionsNeeded.length,
      fixPromptForClaudeCode: result.fixPromptForClaudeCode,
    };
  });
  record(results, '3a-no-issues', s3.issuesCount === 0, `issuesCount=${s3.issuesCount}`);
  record(results, '3b-no-actions-needed', s3.actionsNeededCount === 0, `actionsNeededCount=${s3.actionsNeededCount}`);
  record(results, '3c-no-fix-prompt', s3.fixPromptForClaudeCode === null, `fixPrompt=${s3.fixPromptForClaudeCode}`);

  // ── Scenario 4: real UI — Gemini call fails in this environment (no API
  // key configured), so it must genuinely fall back to Local Diagnostic
  // Mode, and must not fabricate a mapping failure for a video that only
  // lacks analysis. ──
  const videoId = 'diag-e2e-scenario-4';
  await page.evaluate(({ videoId }) => {
    const STORAGE_KEY = 'yt_mentor_videos_v2';
    let videos = [];
    try { videos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { videos = []; }
    const rest = videos.filter((v) => (v.id || v.youtubeId) !== videoId);
    const video = {
      id: videoId,
      youtubeId: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: 'Diagnostic Scenario 4 Video',
      category: 'שוק ההון',
      subCategory: 'ניתוח טכני',
      confirmedSubCategory: 'technical-analysis',
      userConfirmedSubCategory: true,
      fetchedAt: new Date().toISOString(),
      transcript: 'x'.repeat(5000),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([video, ...rest]));
  }, { videoId });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const card = page.locator('div').filter({ hasText: 'Diagnostic Scenario 4 Video' }).last();
  await card.waitFor({ timeout: 20000 });
  await card.click();
  await page.waitForSelector('[role="tablist"]', { timeout: 20000 });
  await page.waitForTimeout(600);

  const aiMappingButton = page.getByRole('button', { name: /AI Mapping/i }).first();
  const hasAiMappingButton = await aiMappingButton.count();
  if (hasAiMappingButton > 0) {
    await aiMappingButton.click();
    await page.waitForTimeout(600);
    const diagButton = page.getByRole('button', { name: /אבחן מיפוי עם AI/ }).first();
    await diagButton.waitFor({ timeout: 10000 });
    await diagButton.click();
    await page.waitForTimeout(4000);

    const localModeVisible = await page.getByText('Local Diagnostic Mode').count();
    const fixPromptButtonVisible = await page.getByRole('button', { name: /Copy Fix Prompt for Claude Code/ }).count();
    const noMappingMessageVisible = await page.getByText('לא נמצאה תקלה במיפוי שדורשת שינוי קוד').count();

    record(results, '4a-local-mode-notice-shown', localModeVisible > 0, `localModeVisible=${localModeVisible}`);
    record(results, '4b-no-speculative-fix-prompt', fixPromptButtonVisible === 0, `fixPromptButtonVisible=${fixPromptButtonVisible}`);
    record(results, '4c-no-mapping-failure-message-shown', noMappingMessageVisible > 0, `noMappingMessageVisible=${noMappingMessageVisible}`);
  } else {
    record(results, '4-ai-mapping-entrypoint-not-found', false, 'Could not find an "AI Mapping" button in this build — skipping live UI check (dev-only feature may be gated).');
  }

  await browser.close();

  const allPass = results.every((r) => r.pass);
  console.log(`\nOverall: ${allPass ? 'PASS' : 'FAIL'}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
