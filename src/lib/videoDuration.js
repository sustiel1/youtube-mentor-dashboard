export function formatVideoDuration(duration) {
  if (duration == null || duration === "") return null;

  if (typeof duration === "number" && Number.isFinite(duration)) {
    return formatSeconds(duration);
  }

  if (typeof duration !== "string") return null;

  const raw = duration.trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    return formatSeconds(Number(raw));
  }

  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(raw)) {
    return raw;
  }

  const isoMatch = raw.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (isoMatch) {
    const hours = Number(isoMatch[1] || 0);
    const minutes = Number(isoMatch[2] || 0);
    const seconds = Number(isoMatch[3] || 0);
    return formatHms(hours, minutes, seconds);
  }

  return raw;
}

function formatSeconds(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return formatHms(hours, minutes, seconds);
}

function formatHms(hours, minutes, seconds) {
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
