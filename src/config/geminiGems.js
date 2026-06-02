export {
  GEMS_CONFIG_KEY,
  defaultGems,
  getGemUrl,
  openGeminiGemUrl,
} from "../lib/gemsConfig";

import { defaultGems, getGemUrl as _getGemUrl } from "../lib/gemsConfig";

export const DEFAULT_GEMINI_POLITICAL_GEM_URL = defaultGems.political;
export const DEFAULT_GEMINI_FUNDAMENTAL_GEM_URL = defaultGems.fundamental;

export function getGeminiPoliticalGemUrl() {
  const fromEnv = String(import.meta.env.VITE_GEMINI_POLITICAL_GEM_URL || "").trim();
  return fromEnv || _getGemUrl("political");
}

export function getGeminiFundamentalGemUrl() {
  const fromEnv = String(import.meta.env.VITE_GEMINI_FUNDAMENTAL_GEM_URL || "").trim();
  return fromEnv || _getGemUrl("fundamental");
}

/** Playback position from video record when the player exposes it (optional). */
export function resolveCurrentPlaybackLabel(video) {
  const sec = Number(
    video?.currentPlaybackSeconds ??
      video?.playbackPositionSeconds ??
      video?.playbackPosition ??
      video?.currentTime
  );
  if (!Number.isFinite(sec) || sec < 0) return null;
  const total = Math.floor(sec);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Clipboard payload for Gem shortcuts: metadata block first, then full transcript.
 */
export function buildGeminiTranscriptClipboardText({
  title = "",
  videoUrl = "",
  currentTime = null,
  duration = null,
  segmentCount = null,
  wordCount = null,
  transcript = "",
} = {}) {
  const display = (value) => {
    if (value === null || value === undefined || value === "") return "—";
    return String(value);
  };

  return [
    `Video title: ${display(title)}`,
    `Video URL: ${display(videoUrl)}`,
    `Current time: ${display(currentTime)}`,
    `Duration: ${display(duration)}`,
    `Segments: ${display(segmentCount)}`,
    `Words: ${display(wordCount)}`,
    "",
    "Transcript:",
    String(transcript || "").trim(),
  ].join("\n");
}
