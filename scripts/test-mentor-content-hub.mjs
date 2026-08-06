import assert from "node:assert/strict";
import { resolveCanonicalMentorIdentity, resolveMentorContentHub } from "../src/lib/mentorContentHub.js";

const channelId = "UCSxjNbPriyBh9RNl_QNSAtw";
const mentor = {
  id: "m1",
  name: "Micha.Stocks",
  youtubeChannelId: channelId,
  handle: "old-handle",
  contentHub: {
    status: "ready",
    tabs: [
      { key: "live", availability: "verified", source: "youtube" },
      { key: "courses", availability: "verified", source: "manual" },
      { key: "playlists", availability: "verified", source: "youtube" },
      { key: "shorts", availability: "verified", source: "youtube" },
    ],
    playlists: [{ playlistId: "PL_verified_123", title: "קורס לדוגמה", isPublic: true }],
  },
};

const identity = resolveCanonicalMentorIdentity(mentor);
assert.equal(identity.canonicalChannelUrl, `https://www.youtube.com/channel/${channelId}`);
assert.equal(resolveCanonicalMentorIdentity({ ...mentor, handle: "new-handle" }).canonicalChannelUrl, identity.canonicalChannelUrl);

const hub = resolveMentorContentHub(mentor, { videos: [{ mentorId: "m1", url: "https://youtu.be/example" }] });
const byKey = Object.fromEntries(hub.tabs.map((tab) => [tab.key, tab]));
for (const key of ["home", "videos", "live", "courses", "playlists", "shorts", "search"]) assert.ok(byKey[key], `${key} should be visible`);
assert.equal(byKey.courses.url, `https://www.youtube.com/channel/${channelId}/courses`);
assert.equal(hub.playlists[0].url, "https://www.youtube.com/playlist?list=PL_verified_123");

const universal = resolveMentorContentHub({ id: "new", name: "New", youtubeChannelId: "UC1234567890123456789012" });
assert.deepEqual(universal.tabs.map((tab) => tab.key), ["home", "search"]);
assert.equal(universal.status, "partial");
assert.equal(resolveMentorContentHub({ name: "Unknown" }).tabs.length, 0);
assert.equal(resolveMentorContentHub({ name: "Unknown" }).status, "unavailable");

const hiddenCourse = resolveMentorContentHub({ ...mentor, contentHub: { tabs: [] } });
assert.equal(hiddenCourse.tabs.some((tab) => tab.key === "courses"), false);

const unsafe = resolveMentorContentHub({ ...mentor, contentHub: { curatedLinks: [{ labelHe: "bad", url: "javascript:alert(1)" }] } });
assert.equal(unsafe.curatedLinks.length, 0);

console.log("Mentor Content Hub regression: 14 assertions passed");
