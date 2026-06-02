// User-configurable cost-safety settings for Claude/Anthropic API calls.
// Stored in localStorage; defaults to maximum safety (all confirmations ON).

const KEY = 'yt_claude_safety_v1';

const DEFAULTS = {
  requireConfirmation: true,   // Show confirmation modal before every Claude API call
  hideWhenGeminiActive: true,  // De-emphasize Claude button when analysis came from Gemini
};

export function getClaudeSafetySettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setClaudeSafetySettings(patch) {
  try {
    const current = getClaudeSafetySettings();
    localStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
  } catch (e) {
    console.warn('[ClaudeSafety] could not save settings:', e.message);
  }
}
