// Server-only Google Drive OAuth helper — token exchange, refresh, and
// encrypted local token storage. Imported ONLY by vite.config.js (Node
// context). Never import this from client code: it uses Node's `fs`/`crypto`
// built-ins, which don't exist in the browser bundle, and it's the one place
// that ever sees the refresh token in plaintext.
//
// Scope: https://www.googleapis.com/auth/drive.file only — the app can only
// see/manage files it creates itself, never the user's full Drive.

import crypto from 'crypto';

const TOKEN_FILE = '.gdrive-tokens.json';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

let _accessTokenCache = null; // { accessToken, expiresAt } — in-memory only, never persisted
const _pendingStates = new Map(); // CSRF state → createdAt, cleared on use or after 10 min

// ─── CSRF state (auth-url ↔ callback) ──────────────────────────────────────────

export function createOAuthState() {
  const state = crypto.randomBytes(16).toString('hex');
  _pendingStates.set(state, Date.now());
  for (const [s, t] of _pendingStates) {
    if (Date.now() - t > 10 * 60_000) _pendingStates.delete(s);
  }
  return state;
}

export function consumeOAuthState(state) {
  if (!state || !_pendingStates.has(state)) return false;
  _pendingStates.delete(state);
  return true;
}

// ─── Encrypted token storage ───────────────────────────────────────────────────
// Key is derived from GOOGLE_CLIENT_SECRET (already server-only, already
// required for the OAuth flow) so the token file alone isn't readable without
// also having the .env.local secret. Rotating the client secret in Google
// Cloud Console intentionally invalidates any stored token file — the user
// just reconnects.

function getEncryptionKey(env) {
  return crypto.scryptSync(env.GOOGLE_CLIENT_SECRET || '', 'gdrive-token-store-v1', 32);
}

function encrypt(env, tokens) {
  const key = getEncryptionKey(env);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}

function decrypt(env, blob) {
  const key = getEncryptionKey(env);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(blob.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(blob.authTag, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(blob.data, 'base64')), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}

async function saveTokens(env, tokens) {
  const { default: fs } = await import('fs');
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(encrypt(env, tokens)), 'utf-8');
}

async function loadTokens(env) {
  const { default: fs } = await import('fs');
  if (!fs.existsSync(TOKEN_FILE)) return null;
  try {
    return decrypt(env, JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8')));
  } catch (err) {
    console.warn('[gdrive-oauth] token file unreadable (stale/corrupt/rotated secret) — treating as disconnected:', err.message);
    return null;
  }
}

export async function clearStoredTokens() {
  const { default: fs } = await import('fs');
  if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE);
  _accessTokenCache = null;
}

// ─── OAuth HTTP calls ───────────────────────────────────────────────────────────

export function buildAuthUrl(env, redirectUri, state) {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DRIVE_FILE_SCOPE,
    access_type: 'offline',
    // Forces Google to reissue a refresh_token on every connect, not just the
    // very first one — otherwise a reconnect after a lost/corrupt token file
    // silently gets no refresh_token and the app can't self-heal.
    prompt: 'consent',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(env, code, redirectUri) {
  const params = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID || '',
    client_secret: env.GOOGLE_CLIENT_SECRET || '',
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || `token exchange failed (${res.status})`);

  const tokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  await saveTokens(env, tokens);
  _accessTokenCache = { accessToken: tokens.accessToken, expiresAt: tokens.expiresAt };
  return tokens;
}

async function refreshAccessToken(env, refreshToken) {
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: env.GOOGLE_CLIENT_ID || '',
    client_secret: env.GOOGLE_CLIENT_SECRET || '',
    grant_type: 'refresh_token',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || `token refresh failed (${res.status})`);
  return { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
}

/**
 * Returns a valid access token, refreshing (and persisting) if the cached one
 * is missing/expired. Returns null — never throws — if not connected or the
 * refresh fails (e.g. the user revoked access from their Google Account), so
 * callers can treat that uniformly as "disconnected".
 */
export async function getValidAccessToken(env) {
  const stored = await loadTokens(env);
  if (!stored?.refreshToken) return null;

  if (_accessTokenCache && _accessTokenCache.expiresAt > Date.now() + 60_000) {
    return _accessTokenCache.accessToken;
  }

  try {
    const refreshed = await refreshAccessToken(env, stored.refreshToken);
    _accessTokenCache = refreshed;
    await saveTokens(env, { refreshToken: stored.refreshToken, accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt });
    return refreshed.accessToken;
  } catch (err) {
    console.warn('[gdrive-oauth] refresh failed — treating as disconnected:', err.message);
    return null;
  }
}
