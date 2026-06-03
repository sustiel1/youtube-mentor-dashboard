export const GEMS_CONFIG_KEY = "gems_config";

export const defaultGems = {
  fundamental: "https://gemini.google.com/gem/593021ea2734",
  appBuilder: "https://gemini.google.com/gem/c195e8991418",
  political: "https://gemini.google.com/gem/99b982aa44b6",
  general: "",
  technical: "",
  macro: "",
  news: "https://gemini.google.com/gem/0e687d497bd3",
};

function normalizeGemUrl(url) {
  const s = String(url || "").trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    if (u.hostname === "gemini.google.com" && u.pathname.startsWith("/gem/")) {
      u.searchParams.delete("usp");
      return u.toString().replace(/\?$/, "");
    }
  } catch {}
  return s;
}

export function getGemUrl(key) {
  let saved = {};

  try {
    saved = JSON.parse(localStorage.getItem(GEMS_CONFIG_KEY) || "{}");
  } catch {
    saved = {};
  }

  return normalizeGemUrl(saved[key] || defaultGems[key] || "");
}

export function openGeminiGemUrl(url) {
  const normalized = normalizeGemUrl(url);
  if (!normalized) return false;
  const tab = window.open(normalized, "_blank", "noopener,noreferrer");
  return Boolean(tab);
}
