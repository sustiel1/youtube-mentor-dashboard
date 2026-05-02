// ─── Topic Storage Service ────────────────────────────────────────────────────
// localStorage persistence for user-added topics.
// Merges with mockData TOPICS — user topics are additive and removable.
// mockData topics (ids t1-t13) are never stored here; they come from mockData.
//
// Key: "yt_topic_user_v1" → array of user-added topic objects
//
// API:
//   loadTopics()              → [...TOPICS_from_mock, ...user_added] deduped by name
//   getUserTopics()           → only user-added topics (from localStorage)
//   addTopic({ name, color }) → add new, returns { topic } or { error }
//   deleteTopic(id)           → delete user-added topic (ls_ prefix only)
//   updateTopic(id, updates)  → update user-added topic
//   isUserTopic(id)           → true if managed by this service

import { TOPICS } from "@/data/mockData";

const STORAGE_KEY = "yt_topic_user_v1";

// Default topics to seed on first use — only those NOT already in mockData TOPICS
export const DEFAULT_TOPICS = [
  { id: "ls_daytrading", name: "מסחר יומי",          color: "cyan"   },
  { id: "ls_dev",        name: "פיתוח",              color: "blue"   },
  { id: "ls_react",      name: "React",              color: "blue"   },
  { id: "ls_base44",     name: "Base44",             color: "blue"   },
  { id: "ls_prompt",     name: "Prompt Engineering", color: "violet" },
];

// Normalize a simple topic into the full shape the app expects
function normalize(t) {
  return {
    id:             t.id,
    name:           t.name,
    color:          t.color  || "blue",
    icon:           t.icon   || "Hash",
    description:    t.description || "",
    isMainCategory: true,
    parentId:       null,
    createdAt:      t.createdAt || new Date().toISOString(),
  };
}

function readUserTopics() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null; // null = not yet seeded
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeUserTopics(topics) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(topics));
  } catch (e) {
    console.warn("[topicStorage] write failed:", e.message);
  }
}

// Seed DEFAULT_TOPICS that aren't already in mockData TOPICS
function seedDefaults() {
  const existingNames = new Set(TOPICS.map((t) => t.name.toLowerCase()));
  const toSeed = DEFAULT_TOPICS
    .filter((t) => !existingNames.has(t.name.toLowerCase()))
    .map(normalize);
  writeUserTopics(toSeed);
  return toSeed;
}

// Returns user-added topics from localStorage, seeding defaults on first use
export function getUserTopics() {
  const stored = readUserTopics();
  if (stored === null) return seedDefaults();
  return stored;
}

// Returns merged list: mockData TOPICS + user-added, deduped by name
export function loadTopics() {
  const userTopics  = getUserTopics();
  const existingNames = new Set(TOPICS.map((t) => t.name.toLowerCase()));
  const newOnes = userTopics.filter((t) => !existingNames.has(t.name.toLowerCase()));
  return [...TOPICS, ...newOnes];
}

export function isUserTopic(id) {
  return typeof id === "string" && id.startsWith("ls_");
}

// Add a new user topic. Returns { topic } on success or { error } on failure.
export function addTopic({ name, color = "blue" }) {
  const trimmed = name?.trim();
  if (!trimmed) return { error: "יש להזין שם לנושא" };

  const all = loadTopics();
  const duplicate = all.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());
  if (duplicate) return { error: "כבר קיים נושא עם שם זה" };

  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9֐-׿]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 30);
  const id    = `ls_${slug}_${Date.now()}`;
  const topic = normalize({ id, name: trimmed, color });

  writeUserTopics([...getUserTopics(), topic]);
  return { topic };
}

// Delete a user-added topic. Returns { error } if not allowed.
export function deleteTopic(id) {
  if (!isUserTopic(id)) return { error: "לא ניתן למחוק נושא מובנה" };
  writeUserTopics(getUserTopics().filter((t) => t.id !== id));
  return {};
}

// Update a user-added topic. Returns { error } if not allowed.
export function updateTopic(id, updates) {
  if (!isUserTopic(id)) return {};  // silently succeed for mockData topics
  const user = getUserTopics();
  const idx  = user.findIndex((t) => t.id === id);
  if (idx === -1) return {};
  user[idx] = { ...user[idx], ...updates };
  writeUserTopics(user);
  return { topic: user[idx] };
}
