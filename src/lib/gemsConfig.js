export const GEMS_CONFIG_KEY = "gems_config";

export const GEM_STORAGE_KEYS = {
  general: "gemUrl.general",
  political: "gemUrl.political",
  market: "gemUrl.market",
  technical: "gemUrl.technical",
  fundamental: "gemUrl.fundamental",
  appBuilder: "gemUrl.appBuilder",
  macro: "gemUrl.macro",
  news: "gemUrl.news",
  dayTrading: "gemUrl.dayTrading",
};

export const defaultGems = {
  fundamental: "https://gemini.google.com/gem/593021ea2734",
  appBuilder: "https://gemini.google.com/gem/c195e8991418",
  political: "https://gemini.google.com/gem/99b982aa44b6",
  general: "",
  market: "",
  technical: "",
  macro: "",
  news: "https://gemini.google.com/gem/0e687d497bd3",
  dayTrading: "",
};

function normalizeGemUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";

  try {
    const parsed = new URL(value);
    if (parsed.hostname === "gemini.google.com" && parsed.pathname.startsWith("/gem/")) {
      parsed.searchParams.delete("usp");
      return parsed.toString().replace(/\?$/, "");
    }
  } catch {}

  return value;
}

export function isGeminiGemUrl(url) {
  const value = String(url || "").trim();
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.hostname === "gemini.google.com" && parsed.pathname.startsWith("/gem/");
  } catch {
    return false;
  }
}

function readLegacyConfig() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GEMS_CONFIG_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function getGemConfigSnapshot() {
  const legacy = readLegacyConfig();
  const snapshot = {};

  Object.entries(GEM_STORAGE_KEYS).forEach(([key, storageKey]) => {
    let value = "";

    try {
      value = localStorage.getItem(storageKey) || "";
    } catch {
      value = "";
    }

    if (!value && typeof legacy[key] === "string") {
      value = legacy[key];
    }

    snapshot[key] = normalizeGemUrl(value || defaultGems[key] || "");
  });

  return snapshot;
}

export function saveGemConfigSnapshot(nextConfig) {
  const current = getGemConfigSnapshot();
  const merged = {
    ...current,
    ...(nextConfig && typeof nextConfig === "object" ? nextConfig : {}),
  };

  const normalized = Object.fromEntries(
    Object.keys({ ...defaultGems, ...merged }).map((key) => [key, normalizeGemUrl(merged[key] || "")])
  );

  try {
    localStorage.setItem(GEMS_CONFIG_KEY, JSON.stringify(normalized));
  } catch {}

  Object.entries(GEM_STORAGE_KEYS).forEach(([key, storageKey]) => {
    try {
      localStorage.setItem(storageKey, normalized[key] || "");
    } catch {}
  });

  return normalized;
}

export function setGemUrl(key, url) {
  return saveGemConfigSnapshot({ [key]: url });
}

export function getGemUrl(key) {
  const snapshot = getGemConfigSnapshot();
  return normalizeGemUrl(snapshot[key] || "");
}

export function openGeminiGemUrl(url) {
  const normalized = normalizeGemUrl(url);
  if (!normalized || !isGeminiGemUrl(normalized)) return false;
  const tab = window.open(normalized, "_blank", "noopener,noreferrer");
  return Boolean(tab);
}
