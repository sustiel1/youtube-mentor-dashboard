import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } });

try {
  const launcher = await vite.ssrLoadModule('/src/lib/marketBriefGemLauncher.js');
  const sessions = await vite.ssrLoadModule('/src/lib/marketBriefSession.js');
  const canonicalId = '1CN2KyVNHZalbhNR6rqCcztivoHcl4ySx';
  const staleNewsOverride = 'https://gemini.google.com/gem/OLD_NEWS_OVERRIDE';
  const customMacroOverride = 'https://gemini.google.com/gem/CUSTOM_MACRO';

  const morning = launcher.resolveMarketBriefLaunchContext({ video: { title: 'מבזק לייב פתיחה לתאריך 28.7.26' } });
  const lateNight = launcher.resolveMarketBriefLaunchContext({ video: { title: 'לייט נייט - קראודסטרייק וברודקום מדווחות' } });
  assert.equal(morning.session, 'morning');
  assert.equal(lateNight.session, 'evening');
  assert.match(launcher.resolveGemLaunchUrl({ isMarketBrief: morning.isMarketBrief, selectedGemUrl: staleNewsOverride }), new RegExp(canonicalId));
  assert.doesNotMatch(launcher.resolveGemLaunchUrl({ isMarketBrief: lateNight.isMarketBrief, selectedGemUrl: staleNewsOverride }), /OLD_NEWS_OVERRIDE/);
  assert.equal(launcher.resolveGemLaunchUrl({ isMarketBrief: false, selectedGemUrl: customMacroOverride }), customMacroOverride);

  const confirmedNonBrief = launcher.resolveMarketBriefLaunchContext({
    video: { title: 'לייט נייט', userConfirmedSubCategory: true, confirmedSubCategory: 'מסחר יומי' },
  });
  assert.equal(confirmedNonBrief.isMarketBrief, false);

  const unknown = launcher.resolveMarketBriefLaunchContext({ video: { title: 'סקירת שוק כללית', contentType: 'marketBrief' } });
  assert.equal(unknown.isMarketBrief, true);
  assert.equal(unknown.session, 'unknown');
  assert.equal(launcher.resolveMarketBriefLaunchContext({ video: { title: 'סקירת שוק כללית', contentType: 'marketBrief' }, manualSession: 'evening' }).session, 'evening');

  assert.equal(sessions.resolveMarketBriefSession({ briefSession: 'evening' }).session, 'evening');
  assert.equal(sessions.resolveMarketBriefSession({ marketPhase: 'post-market' }).session, 'evening');

  const transcript = 'תמלול ייחודי לבדיקה';
  const payload = launcher.buildMarketBriefGemPayload({ video: { title: 'לייט נייט' }, fullTranscriptText: transcript, session: 'evening' });
  assert.equal(payload.split(transcript).length - 1, 1);

  const modalSource = fs.readFileSync(path.join(root, 'src', 'components', 'dashboard', 'GemSelectionModal.jsx'), 'utf8');
  assert.match(modalSource, /resolveGemLaunchUrl/);
  assert.match(modalSource, /marketBriefLaunch\.isMarketBrief \? MARKET_BRIEF_GEM\.key : selected/);
  assert.match(modalSource, /marketBriefLaunch\.session === 'unknown'/);
  assert.match(modalSource, /marketBriefLaunch\.isMarketBrief \? \(/);
  assert.match(modalSource, /!marketBriefLaunch\.isMarketBrief && <div>/);
  assert.match(modalSource, /\{marketBriefDisplay\.gemLabel\}/);
  assert.match(modalSource, /MARKET_BRIEF_GEM\.labelHe/);
  assert.match(modalSource, /בחירת הקשר למבזק שוק/);

  console.log(JSON.stringify({ status: 'passed', canonicalId, morning: morning.session, lateNight: lateNight.session, unknown: unknown.session }, null, 2));
} finally {
  await vite.close();
}
