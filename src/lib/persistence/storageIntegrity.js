const WORKSPACE_TOPIC_ASSIGNMENT_FIELDS = Object.freeze([
  'topicId',
  'topicName',
  'subTopicId',
  'subtopicId',
  'subTopicName',
  'subtopicName',
]);

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function checksumWorkspaceItemIds(items = []) {
  return fnv1a(items.map((item) => String(item?.id || '')).sort().join('\n'));
}

function stripWorkspaceTopicAssignment(item = {}) {
  const copy = { ...item };
  WORKSPACE_TOPIC_ASSIGNMENT_FIELDS.forEach((field) => delete copy[field]);
  return copy;
}

export function checksumWorkspacePayloadsExcludingTopicAssignment(items = []) {
  const source = Array.isArray(items) ? items : [];
  return fnv1a(JSON.stringify(source.map(stripWorkspaceTopicAssignment)));
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256Text(value, cryptoProvider = globalThis.crypto) {
  if (!cryptoProvider?.subtle) throw new Error('Web Crypto SHA-256 is unavailable');
  const bytes = new TextEncoder().encode(String(value));
  const digest = await cryptoProvider.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(digest));
}

export async function canonicalSha256(value, cryptoProvider = globalThis.crypto) {
  return sha256Text(JSON.stringify(canonicalize(value)), cryptoProvider);
}

export function logicalUtf16Bytes(key, value) {
  return (String(key).length + String(value).length) * 2;
}

export function classifyStorageError(error) {
  if (error?.name === 'QuotaExceededError' || error?.code === 22 || error?.code === 1014) {
    return 'quota-exceeded';
  }
  if (error?.name === 'AbortError') return 'transaction-aborted';
  if (error?.name === 'InvalidStateError' || error?.name === 'NotFoundError') {
    return 'storage-unavailable';
  }
  return 'storage-operation-failed';
}

export function verifyWorkspaceRaw(rawValue, expected = null) {
  let items;
  try {
    items = JSON.parse(rawValue);
  } catch {
    throw new Error('Workspace payload is not valid JSON');
  }
  if (!Array.isArray(items)) throw new Error('Workspace payload is not an array');

  const integrity = {
    recordCount: items.length,
    idChecksum: checksumWorkspaceItemIds(items),
    payloadChecksum: checksumWorkspacePayloadsExcludingTopicAssignment(items),
  };

  if (expected && (
    integrity.recordCount !== expected.recordCount
    || integrity.idChecksum !== expected.idChecksum
    || integrity.payloadChecksum !== expected.payloadChecksum
  )) {
    throw new Error('Workspace integrity does not match the approved baseline');
  }

  return { items, integrity };
}
