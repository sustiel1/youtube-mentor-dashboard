import { normalizeMentorChannelResources } from '@/lib/mentorChannelResources';

const STORAGE_KEY = 'yt_mentor_channel_resource_overrides_v1';

function readAll() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function writeAll(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function getMentorChannelResourceOverride(mentorId) {
  return mentorId ? readAll()[mentorId] ?? null : null;
}

export function setMentorChannelResourceOverride(mentorId, resources) {
  if (!mentorId) return null;
  const all = readAll();
  all[mentorId] = { resources: normalizeMentorChannelResources(resources), updatedAt: new Date().toISOString() };
  writeAll(all);
  return all[mentorId];
}

export function applyMentorChannelResourceOverrides(mentors) {
  const overrides = readAll();
  return mentors.map((mentor) => {
    const override = overrides[mentor.id];
    return override ? { ...mentor, channelResources: override.resources, channelResourcesUpdatedAt: override.updatedAt } : mentor;
  });
}

export function exportMentorChannelResourceOverrides() {
  return { version: 1, mentors: readAll() };
}

export function importMentorChannelResourceOverrides(payload) {
  if (!payload || payload.version !== 1 || !payload.mentors || typeof payload.mentors !== 'object') {
    throw new Error('גיבוי קישורי המנטורים אינו תקין');
  }
  const current = readAll();
  const next = { ...current };
  for (const [mentorId, entry] of Object.entries(payload.mentors)) {
    if (!mentorId || !Array.isArray(entry?.resources)) throw new Error('רשומת מנטור בגיבוי אינה תקינה');
    const resources = normalizeMentorChannelResources(entry.resources);
    if (resources.length !== entry.resources.length) throw new Error('הגיבוי מכיל קישור לא תקין או כפול');
    next[mentorId] = { resources, updatedAt: entry.updatedAt || new Date().toISOString() };
  }
  writeAll(next);
  return next;
}
