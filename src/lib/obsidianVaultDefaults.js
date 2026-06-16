/** Shared Obsidian vault defaults — safe for Vite server + client imports. */

export const DEFAULT_OBSIDIAN_VAULT_NAME = "Knowledge-Base";
export const DEFAULT_OBSIDIAN_VAULT_PATH = "C:\\Users\\11\\Desktop\\Workspace\\Knowledge-Base";
export const OBSIDIAN_MIGRATION_FOLDER = "Obsidian-Brain-Structure-2026-05-17";

const LEGACY_VAULT_PATH = "C:\\Users\\11\\Workspace\\Knowledge-Base";

function trimValue(value) {
  return String(value || "").trim();
}

/** Obsidian desktop vault name — never the migration export folder name. */
export function normalizeObsidianVaultName(vaultName = "") {
  const name = trimValue(vaultName);
  if (!name) return DEFAULT_OBSIDIAN_VAULT_NAME;
  if (name === OBSIDIAN_MIGRATION_FOLDER) return DEFAULT_OBSIDIAN_VAULT_NAME;
  if (/obsidian-brain-structure/i.test(name)) return DEFAULT_OBSIDIAN_VAULT_NAME;
  return name;
}

/** Local filesystem vault root — never the migration subfolder inside Knowledge-Base. */
export function normalizeObsidianVaultPath(vaultPath = "") {
  let pathValue = trimValue(vaultPath).replace(/\//g, "\\").replace(/\\+$/, "");
  if (!pathValue) return DEFAULT_OBSIDIAN_VAULT_PATH;

  const migrationSuffix = `\\${OBSIDIAN_MIGRATION_FOLDER}`;
  if (pathValue.toLowerCase().endsWith(migrationSuffix.toLowerCase())) {
    pathValue = pathValue.slice(0, -migrationSuffix.length).replace(/\\+$/, "");
  }

  if (pathValue.toLowerCase() === LEGACY_VAULT_PATH.toLowerCase()) {
    return DEFAULT_OBSIDIAN_VAULT_PATH;
  }

  return pathValue || DEFAULT_OBSIDIAN_VAULT_PATH;
}

/** Strip accidental migration-folder prefix from relative note paths. */
export function stripMigrationPrefixFromRelativePath(relPath = "") {
  let safe = trimValue(relPath).replace(/\\/g, "/").replace(/^\/+/, "");
  const prefix = `${OBSIDIAN_MIGRATION_FOLDER}/`;
  if (safe.toLowerCase().startsWith(prefix.toLowerCase())) {
    safe = safe.slice(prefix.length);
  }
  return safe;
}

export function resolveObsidianVaultSettings({ vaultName = "", vaultPath = "" } = {}) {
  const rawName = trimValue(vaultName);
  const rawPath = trimValue(vaultPath);
  const normalizedName = normalizeObsidianVaultName(rawName || DEFAULT_OBSIDIAN_VAULT_NAME);
  const normalizedPath = normalizeObsidianVaultPath(rawPath || DEFAULT_OBSIDIAN_VAULT_PATH);
  const migrated =
    (rawName && rawName !== normalizedName) ||
    (rawPath && rawPath !== normalizedPath);
  return {
    vaultName: normalizedName,
    vaultPath: normalizedPath,
    migrated,
  };
}
