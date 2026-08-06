const ASSET_ALIASES = Object.freeze(require('./marketAssetAliases.json'));

function canonicalizeMarketAsset(value) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!normalized) return '';
  return ASSET_ALIASES[normalized] || normalized;
}

module.exports = {
  ASSET_ALIASES,
  canonicalizeMarketAsset,
};
