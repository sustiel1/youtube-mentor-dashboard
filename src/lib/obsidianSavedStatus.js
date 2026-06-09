import { buildObsidianOpenUrl, getObsidianSettings } from "@/lib/obsidianVaultConfig";

/**
 * Metadata persisted on a video after a successful vault save (append / political).
 * Does not alter save/export logic — only records where the file landed.
 */
export function buildObsidianSavedStatus({ folder, file, vaultName } = {}) {
  const normalizedFolder = String(folder || "").trim().replace(/\\/g, "/");
  const normalizedFile = String(file || "").trim().replace(/\\/g, "/");
  if (!normalizedFolder || !normalizedFile) return null;

  const settings = getObsidianSettings();
  const resolvedVault = String(vaultName || "").trim() || settings.vaultName;
  const savedPath = `${normalizedFolder}/${normalizedFile}`.replace(/\/+/g, "/");

  const result = {
    savedAt: new Date().toISOString(),
    vaultName: resolvedVault,
    folder: normalizedFolder,
    fileName: normalizedFile,
    savedPath,
    obsidianUrl: buildObsidianOpenUrl(savedPath, resolvedVault),
  };

  console.debug("OBSIDIAN SAVE FINAL", {
    resolvedFolder: normalizedFolder,
    fileName: normalizedFile,
    fullPath: savedPath,
    url: result.obsidianUrl,
  });

  return result;
}

/** Build saved status from a vault write response path (folder + fileName). */
export function buildObsidianSavedStatusFromPath(savedPath, vaultName) {
  const normalized = String(savedPath || "").trim().replace(/\\/g, "/");
  if (!normalized) return null;
  const lastSlash = normalized.lastIndexOf("/");
  const folder = lastSlash >= 0 ? normalized.substring(0, lastSlash) : "";
  const file = lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;
  if (!file) return null;
  return buildObsidianSavedStatus({
    folder: folder || normalized,
    file,
    vaultName,
  });
}

/** P0 diagnostics — vault write / status persistence. */
export function logObsidianVaultP0Diagnostics({
  apiRoute,
  vaultName,
  vaultPath,
  finalFilePath,
  verified,
  obsidianSavedStatusUpdated,
} = {}) {
  console.debug("[ObsidianVault][P0]", {
    apiRoute: apiRoute || null,
    vaultName: vaultName || null,
    vaultPath: vaultPath || null,
    finalFilePath: finalFilePath || null,
    verified: verified === true,
    obsidianSavedStatusUpdated: obsidianSavedStatusUpdated === true,
  });
}

export const OBSIDIAN_SAVED_FILTER_ALL = "all";
export const OBSIDIAN_SAVED_FILTER_SAVED = "saved";
export const OBSIDIAN_SAVED_FILTER_NOT_SAVED = "not_saved";

export const OBSIDIAN_SAVED_FILTER_OPTIONS = [
  { value: OBSIDIAN_SAVED_FILTER_ALL, label: "כל הסרטונים" },
  { value: OBSIDIAN_SAVED_FILTER_SAVED, label: "נשמר למוח" },
  { value: OBSIDIAN_SAVED_FILTER_NOT_SAVED, label: "לא נשמר למוח" },
];

export function hasObsidianSavedStatus(video) {
  const status = video?.obsidianSavedStatus;
  return Boolean(status?.savedAt && status?.savedPath);
}

export function matchesObsidianSavedFilter(video, filterValue = OBSIDIAN_SAVED_FILTER_ALL) {
  if (!filterValue || filterValue === OBSIDIAN_SAVED_FILTER_ALL) return true;
  const saved = hasObsidianSavedStatus(video);
  if (filterValue === OBSIDIAN_SAVED_FILTER_SAVED) return saved;
  if (filterValue === OBSIDIAN_SAVED_FILTER_NOT_SAVED) return !saved;
  return true;
}

/** Single-line path for cards: Vault / folder / file.md */
export function formatObsidianSavedLocation(status) {
  if (!status) return "";
  return [status.vaultName, status.folder, status.fileName].filter(Boolean).join(" / ");
}

export const BRAIN_SAVE_LABEL_DEFAULT = "שמור למוח";
export const BRAIN_SAVE_LABEL_SAVED = "✓ נשמר למוח";

/** Label for primary “Save to Brain” actions (optional selected count suffix). */
export function getBrainSaveButtonLabel(video, { count } = {}) {
  const base = hasObsidianSavedStatus(video) ? BRAIN_SAVE_LABEL_SAVED : BRAIN_SAVE_LABEL_DEFAULT;
  const n = Number(count);
  if (Number.isFinite(n) && n > 0) return `${base} (${n})`;
  return base;
}

/** Enabled primary-action classes when the video was already saved to Obsidian. */
export function getBrainSaveButtonEnabledClass(video, { variant = "indigo" } = {}) {
  if (!hasObsidianSavedStatus(video)) {
    if (variant === "violet") return "bg-violet-600 hover:bg-violet-700 text-white";
    return "bg-indigo-600 hover:bg-indigo-700 text-white";
  }
  return "bg-emerald-600 hover:bg-emerald-700 text-white";
}
