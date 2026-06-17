import { useEffect, useState } from "react";
import {
  DEFAULT_OBSIDIAN_VAULT_NAME,
  DEFAULT_OBSIDIAN_VAULT_PATH,
  resolveObsidianVaultSettings,
  stripMigrationPrefixFromRelativePath,
} from "@/lib/obsidianVaultDefaults";

const OBSIDIAN_SETTINGS_KEY = "obsidian_settings_v1";
export const OBSIDIAN_SETTINGS_CHANGED_EVENT = "obsidian-settings-changed";

export { DEFAULT_OBSIDIAN_VAULT_NAME, DEFAULT_OBSIDIAN_VAULT_PATH };

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

export function getEnvObsidianVaultPath() {
  return normalizeValue(import.meta.env.VITE_OBSIDIAN_VAULT_PATH);
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

/** vaultName + vaultPath for every /api/vault/* request body (P0 vault sync). */
export function getObsidianVaultRequestFields() {
  const { vaultName, vaultPath } = getObsidianSettings();
  return {
    vaultName: normalizeValue(vaultName),
    vaultPath: normalizeValue(vaultPath),
  };
}

export function getObsidianSettings() {
  const stored = getStoredObsidianSettings();
  const envVaultName = getEnvObsidianVaultName();
  const envVaultPath = getEnvObsidianVaultPath();

  const resolved = resolveObsidianVaultSettings({
    vaultName: envVaultName || stored.vaultName || DEFAULT_OBSIDIAN_VAULT_NAME,
    vaultPath: envVaultPath || stored.vaultPath || DEFAULT_OBSIDIAN_VAULT_PATH,
  });

  const hasLocalOverride = Boolean(stored.vaultName || stored.vaultPath) && !resolved.migrated;
  const source = envVaultName || envVaultPath
    ? "env"
    : hasLocalOverride
      ? "local"
      : resolved.migrated
        ? "migrated"
        : "default";

  return {
    ...resolved,
    source,
  };
}

export function saveObsidianSettings(nextSettings = {}) {
  if (typeof window === "undefined") return getObsidianSettings();

  const merged = resolveObsidianVaultSettings({
    vaultName: nextSettings.vaultName,
    vaultPath: nextSettings.vaultPath,
  });

  try {
    window.localStorage.setItem(OBSIDIAN_SETTINGS_KEY, JSON.stringify({
      vaultName: merged.vaultName,
      vaultPath: merged.vaultPath,
    }));
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

export function sanitizeObsidianRelativePath(filePath = "") {
  const base = String(filePath || "")
    .trim()
    .replace(/[\\]+/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.\./g, "");
  return stripMigrationPrefixFromRelativePath(base);
}

export function buildObsidianVaultRootUrl(vaultName = getConfiguredObsidianVaultName()) {
  const normalizedVaultName = normalizeValue(vaultName);
  if (!normalizedVaultName) return "";
  return `obsidian://open?vault=${encodeURIComponent(normalizedVaultName)}`;
}

export function buildObsidianOpenUrl(filePath, vaultName = getConfiguredObsidianVaultName()) {
  const normalizedPath = sanitizeObsidianRelativePath(filePath);
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
    defaultVaultPath: DEFAULT_OBSIDIAN_VAULT_PATH,
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

  const resolved = resolveObsidianVaultSettings({
    vaultName: preferredVaultName || settings.vaultName || DEFAULT_OBSIDIAN_VAULT_NAME,
    vaultPath: preferredVaultPath || settings.vaultPath || DEFAULT_OBSIDIAN_VAULT_PATH,
  });

  return {
    activeVault: resolved.vaultName,
    vaultName: resolved.vaultName,
    vaultPath: resolved.vaultPath,
    source: preferredVaultName || preferredVaultPath ? "preferred" : settings.source,
    hasVaultName: Boolean(resolved.vaultName),
    hasVaultPath: Boolean(resolved.vaultPath),
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
          migrated: detail.migrated,
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
