import { useEffect, useState } from "react";

const OBSIDIAN_SETTINGS_KEY = "obsidian_settings_v1";
export const OBSIDIAN_SETTINGS_CHANGED_EVENT = "obsidian-settings-changed";

const LEGACY_DEFAULT_VAULT_NAME = "Knowledge-Base";
export const DEFAULT_OBSIDIAN_VAULT_NAME = "Obsidian-Brain-Structure-2026-05-17";
export const DEFAULT_OBSIDIAN_VAULT_PATH = "C:\\Users\\11\\Workspace\\Obsidian-Brain-Structure-2026-05-17";

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

function isLegacyDefault(stored) {
  return stored.vaultName === LEGACY_DEFAULT_VAULT_NAME &&
    (!stored.vaultPath || stored.vaultPath.toLowerCase().includes("knowledge-base"));
}

export function getObsidianSettings() {
  const stored = getStoredObsidianSettings();
  const envVaultName = getEnvObsidianVaultName();
  const migrated = (stored.vaultName || stored.vaultPath) ? isLegacyDefault(stored) : false;
  const vaultName = migrated
    ? (envVaultName || DEFAULT_OBSIDIAN_VAULT_NAME)
    : (stored.vaultName || envVaultName || DEFAULT_OBSIDIAN_VAULT_NAME);
  const vaultPath = migrated
    ? DEFAULT_OBSIDIAN_VAULT_PATH
    : (stored.vaultPath || DEFAULT_OBSIDIAN_VAULT_PATH);
  const hasLocalOverride = Boolean(stored.vaultName || stored.vaultPath) && !migrated;

  return {
    vaultName,
    vaultPath,
    source: hasLocalOverride ? "local" : envVaultName ? "env" : migrated ? "migrated" : "default",
    migrated,
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

export function getExplicitObsidianVaultName() {
  const stored = getStoredObsidianSettings();
  return stored.vaultName || getEnvObsidianVaultName() || "";
}

export function resolveObsidianVaultName(preferredVaultName = "") {
  return normalizeValue(preferredVaultName) || getConfiguredObsidianVaultName();
}

export function hasUsableObsidianVaultName(preferredVaultName = "") {
  return Boolean(normalizeValue(preferredVaultName) || getConfiguredObsidianVaultName());
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

export function getActiveObsidianVaultConfig(preferred = {}) {
  const nextPreferred = typeof preferred === "string" ? { vaultName: preferred } : (preferred || {});
  const settings = getObsidianSettings();
  const preferredVaultName = normalizeValue(nextPreferred.vaultName);
  const preferredVaultPath = normalizeValue(nextPreferred.vaultPath);

  const vaultName = preferredVaultName || settings.vaultName || DEFAULT_OBSIDIAN_VAULT_NAME;
  const vaultPath = preferredVaultPath || settings.vaultPath || DEFAULT_OBSIDIAN_VAULT_PATH;

  return {
    activeVault: vaultName,
    vaultName,
    vaultPath,
    source: preferredVaultName || preferredVaultPath ? "preferred" : settings.source,
    hasVaultName: Boolean(vaultName),
    hasVaultPath: Boolean(vaultPath),
  };
}

export function useObsidianSettingsState() {
  const [settings, setSettings] = useState(() => getObsidianSettings());

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncSettings = (event) => {
      const detail = event?.detail;
      if (detail && typeof detail === "object") {
        setSettings({
          vaultName: normalizeValue(detail.vaultName) || getObsidianSettings().vaultName,
          vaultPath: normalizeValue(detail.vaultPath),
          source: detail.source || getObsidianSettings().source,
        });
        return;
      }
      setSettings(getObsidianSettings());
    };

    window.addEventListener(OBSIDIAN_SETTINGS_CHANGED_EVENT, syncSettings);
    window.addEventListener("storage", syncSettings);
    return () => {
      window.removeEventListener(OBSIDIAN_SETTINGS_CHANGED_EVENT, syncSettings);
      window.removeEventListener("storage", syncSettings);
    };
  }, []);

  return settings;
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
