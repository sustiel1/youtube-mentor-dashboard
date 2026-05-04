import React from "react";
import { buildTimestampUrl } from "@/services/youtubeMetadata";

/** Same rules as VideoDetailPanel — startSeconds may be string from JSON */
function resolveStartSeconds(section) {
  const s = section?.startSeconds;
  if (typeof s === "number" && Number.isFinite(s) && s >= 0) return s;
  if (typeof s === "string" && s.trim() !== "") {
    const n = Number(s);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

const ChapterItem = ({ section, playerRef, videoUrl }) => {
  const finalSeconds = resolveStartSeconds(section);
  const isValid = finalSeconds !== null;
  const isEstimated = section?.timeSource === "estimated";
  const hasPlayerSeek = Boolean(playerRef?.current?.seekTo);
  const urlStr = typeof videoUrl === "string" ? videoUrl.trim() : "";
  const hasTarget = hasPlayerSeek || urlStr.length > 0;

  const handleNavigation = () => {
    if (!isValid) return;

    if (playerRef?.current?.seekTo) {
      const p = playerRef.current;
      if (typeof p.playVideo === "function") {
        p.seekTo(finalSeconds, true);
        p.playVideo();
      } else {
        p.seekTo(finalSeconds, "seconds");
      }
      return;
    }

    if (urlStr) {
      const timestampUrl = buildTimestampUrl(urlStr, finalSeconds);
      if (timestampUrl) {
        window.open(timestampUrl, "_blank", "noopener,noreferrer");
      }
    }
  };

  // No startSeconds at all — disabled
  if (!isValid) {
    const tooltip = isEstimated
      ? "זמן משוער — חסרים נתוני משך הסרטון לחישוב"
      : "ניווט זמין רק כשיש timestamps אמיתיים";
    return (
      <div
        className="p-3 mb-2 border rounded-lg bg-gray-50 opacity-60 cursor-not-allowed"
        title={tooltip}
      >
        <div className="font-bold text-gray-700">{section.title}</div>
        <div className="text-sm text-gray-500">{section.description}</div>
      </div>
    );
  }

  // Has startSeconds but no navigation target
  if (!hasTarget) {
    return (
      <div
        className="p-3 mb-2 border border-amber-100 rounded-lg bg-amber-50/40 opacity-90 cursor-not-allowed"
        title="יש זמן לפרק אבל חסר קישור לסרטון (url / link / videoUrl) או נגן פנימי"
      >
        <div className="font-bold text-gray-800">{section.title}</div>
        <div className="text-sm text-gray-600">{section.description}</div>
        <div className="mt-2 text-xs text-amber-800">לא ניתן לפתוח — חסר קישור צפייה</div>
      </div>
    );
  }

  // Estimated timestamp — clickable, amber style
  if (isEstimated) {
    return (
      <button
        type="button"
        onClick={handleNavigation}
        className="w-full text-right p-3 mb-2 border border-amber-200 rounded-lg bg-white hover:bg-amber-50 transition-colors cursor-pointer"
        title="ניווט משוער — הזמן מחושב לפי אורך הסרטון"
      >
        <div className="font-bold text-amber-800">{section.title}</div>
        <div className="text-sm text-gray-600">{section.description}</div>
        <div className="mt-2 text-xs font-semibold text-amber-600">
          ניווט משוער — {section.timestamp || `${finalSeconds}s`}
        </div>
      </button>
    );
  }

  // Real timestamp — clickable, blue style
  return (
    <button
      type="button"
      onClick={handleNavigation}
      className="w-full text-right p-3 mb-2 border border-blue-200 rounded-lg bg-white hover:bg-blue-50 transition-colors cursor-pointer"
    >
      <div className="font-bold text-blue-900">{section.title}</div>
      <div className="text-sm text-gray-600">{section.description}</div>
      <div className="mt-2 text-xs font-semibold text-blue-600">
        קפיצה ל-{section.timestamp || `${finalSeconds}s`}
      </div>
    </button>
  );
};

export default ChapterItem;
