import { normalizeSubCategory } from "@/config/videoTabsConfig";
import {
  buildObsidianOpenUrl,
  getActiveObsidianVaultConfig,
} from "@/lib/obsidianVaultConfig";

function normalizeSegment(value) {
  return String(value || "")
    .trim()
    .replace(/[\\]+/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function buildSlug(text, maxLen = 40) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\wא-ת\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .slice(0, maxLen)
    .replace(/-$/, "");
}

export function sanitizeObsidianRelativePath(filePath = "") {
  return normalizeSegment(String(filePath || "").replace(/\.\./g, ""));
}

export function resolveObsidianFolderFromTaxonomy(video = {}) {
  const category = normalizeSegment(video?.category);
  const subCategory = normalizeSegment(video?.subCategory);

  if (category && subCategory) return `${category}/${subCategory}`;
  if (category) return category;
  return "";
}

export function buildObsidianVideoFileName(video = {}, { prefix = "V", maxLen = 40 } = {}) {
  const slug = buildSlug(video?.title || "video", maxLen) || "video";
  return `${prefix}-${slug}.md`;
}

export function resolveVideoObsidianRoute(video = {}, options = {}) {
  const vault = getActiveObsidianVaultConfig(options);
  const category = normalizeSegment(video?.category);
  const subCategory = normalizeSegment(video?.subCategory);
  const normalizedSubCategory = normalizeSubCategory(subCategory || "") || "";
  const resolvedFolder =
    normalizeSegment(options?.folder) || resolveObsidianFolderFromTaxonomy({ category, subCategory });
  const fileName =
    normalizeSegment(options?.fileName) || buildObsidianVideoFileName(video, {
      prefix: options?.filePrefix || "V",
      maxLen: options?.maxLen || 40,
    });
  const finalFilePath = sanitizeObsidianRelativePath(
    [resolvedFolder, fileName].filter(Boolean).join("/")
  );
  const obsidianUrl = buildObsidianOpenUrl(finalFilePath, vault.vaultName);

  return {
    ...vault,
    category,
    subCategory,
    normalizedSubCategory,
    resolvedFolder,
    fileName,
    finalFilePath,
    obsidianUrl,
  };
}

export function buildObsidianRoutingDebugInfo(video = {}, options = {}) {
  const route = resolveVideoObsidianRoute(video, options);
  return {
    activeVault: route.activeVault,
    sourceOfActiveVault: route.source,
    category: route.category,
    subCategory: route.subCategory,
    normalizedSubCategory: route.normalizedSubCategory,
    resolvedFolder: route.resolvedFolder,
    finalFilePath: route.finalFilePath,
    vaultName: route.vaultName,
    vaultPath: route.vaultPath,
    obsidianUrl: route.obsidianUrl,
  };
}
