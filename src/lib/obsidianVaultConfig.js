const OBSIDIAN_SETTINGS_KEY = "obsidian_settings_v1";
export const OBSIDIAN_SETTINGS_CHANGED_EVENT = "obsidian-settings-changed";

export const DEFAULT_OBSIDIAN_VAULT_NAME = "Knowledge-Base";
export const DEFAULT_OBSIDIAN_VAULT_PATH = "";

function normalizeValue(value) {
  return String(value || "").trim();
}

function emitObsidianSettingsChanged(settings) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  try {
    window.dispatchEvent(new CustomEvent(OBSIDIAN_SETTINGS_CHANGED_EVENT, { detail: settings }));
  } catch {}
}

export function getEnvObsidianVaultName() {
  return normalizeValue(import.meta.env.VITE_OBSIDIAN_VAULT_NAME);
}

export function getStoredObsidianSettings() {
  if (typeof window === "undefined") {
    return {
      vaultName: "",
      vaultPath: "",
    };
  }

  try {
    const raw = window.localStorage.getItem(OBSIDIAN_SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      vaultName: normalizeValue(parsed?.vaultName),
      vaultPath: normalizeValue(parsed?.vaultPath),
    };
  } catch {
    return {
      vaultName: "",
      vaultPath: "",
    };
  }
}

export function getObsidianSettings() {
  const stored = getStoredObsidianSettings();
  const envVaultName = getEnvObsidianVaultName();
  const vaultName = stored.vaultName || envVaultName || DEFAULT_OBSIDIAN_VAULT_NAME;
  const vaultPath = stored.vaultPath || DEFAULT_OBSIDIAN_VAULT_PATH;

  return {
    vaultName,
    vaultPath,
    source: stored.vaultName ? "local" : envVaultName ? "env" : "default",
  };
}

export function saveObsidianSettings(nextSettings = {}) {
  if (typeof window === "undefined") return getObsidianSettings();

  const merged = {
    vaultName: normalizeValue(nextSettings.vaultName),
    vaultPath: normalizeValue(nextSettings.vaultPath),
  };

  try {
    window.localStorage.setItem(OBSIDIAN_SETTINGS_KEY, JSON.stringify(merged));
  } catch {}

  const resolved = getObsidianSettings();
  emitObsidianSettingsChanged(resolved);
  return resolved;
}

export function clearObsidianSettings() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(OBSIDIAN_SETTINGS_KEY);
    } catch {}
  }
  const resolved = getObsidianSettings();
  emitObsidianSettingsChanged(resolved);
  return resolved;
}

export function getConfiguredObsidianVaultName() {
  return getObsidianSettings().vaultName;
}

export function getConfiguredObsidianVaultPath() {
  return getObsidianSettings().vaultPath;
}

export function buildObsidianVaultRootUrl(vaultName = getConfiguredObsidianVaultName()) {
  const normalizedVaultName = normalizeValue(vaultName);
  if (!normalizedVaultName) return "";
  return `obsidian://open?vault=${encodeURIComponent(normalizedVaultName)}`;
}

export function buildObsidianOpenUrl(filePath, vaultName = getConfiguredObsidianVaultName()) {
  const normalizedPath = String(filePath || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
  const normalizedVaultName = normalizeValue(vaultName);
  if (!normalizedPath || !normalizedVaultName) return "";
  return `obsidian://open?vault=${encodeURIComponent(normalizedVaultName)}&file=${encodeURIComponent(normalizedPath)}`;
}

export function getObsidianVaultDebugInfo(filePath = "") {
  const stored = getStoredObsidianSettings();
  const settings = getObsidianSettings();
  const envVaultName = getEnvObsidianVaultName();

  return {
    defaultVaultName: DEFAULT_OBSIDIAN_VAULT_NAME,
    envVaultName,
    storedVaultName: stored.vaultName,
    storedVaultPath: stored.vaultPath,
    detectedVaultName: envVaultName || DEFAULT_OBSIDIAN_VAULT_NAME,
    generatedVaultName: settings.vaultName,
    configuredVaultName: settings.vaultName,
    configuredVaultPath: settings.vaultPath,
    settingsSource: settings.source,
    finalObsidianUrl: buildObsidianOpenUrl(filePath, settings.vaultName),
    vaultRootUrl: buildObsidianVaultRootUrl(settings.vaultName),
  };
}

// Backward-compatible aliases for existing call sites.
export function getManualObsidianVaultOverride() {
  return getStoredObsidianSettings().vaultName;
}

export function setManualObsidianVaultOverride(vaultName) {
  return saveObsidianSettings({
    ...getStoredObsidianSettings(),
    vaultName,
  }).vaultName;
}

export function clearManualObsidianVaultOverride() {
  return clearObsidianSettings();
}
