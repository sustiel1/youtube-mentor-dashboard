import React, { useState } from "react";
import { buildTimestampUrl } from "@/services/youtubeMetadata";

function resolveStartSeconds(section) {
  const s = section?.startSeconds;
  if (typeof s === "number" && Number.isFinite(s) && s >= 0) return s;
  if (typeof s === "string" && s.trim() !== "") {
    const n = Number(s);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

function parseTimestampString(str) {
  if (typeof str !== "string") return null;
  const parts = str.trim().split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function formatHebrewTimestamp(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Removes a duplicated title prefix from a chapter description.
 * GEM sometimes repeats the chapter title verbatim at the start of the description.
 * Operates at display-level only — raw stored data is never mutated.
 */
function cleanChapterSubtitle(title, subtitle) {
  if (!title || !subtitle) return subtitle || "";
  const norm = (s) => String(s).replace(/\s+/g, " ").trim();
  const normTitle = norm(title);
  const normSub = norm(subtitle);

  // Exact prefix: subtitle begins with full title text
  if (normSub.startsWith(normTitle)) {
    return normSub.slice(normTitle.length).replace(/^[\s,\-–—.·•:]+/, "").trim();
  }

  // Near-duplicate: first N words of subtitle match first N words of title (N ≥ 3)
  const titleWords = normTitle.split(" ");
  const n = Math.min(titleWords.length, 8);
  if (n >= 3) {
    const subWords = normSub.split(" ");
    if (titleWords.slice(0, n).join(" ") === subWords.slice(0, n).join(" ")) {
      return subWords.slice(n).join(" ").replace(/^[\s,\-–—.·•:]+/, "").trim();
    }
  }

  return subtitle;
}

function ChapterShell({ children, clickable = false, title, onClick, isHighlighted = false }) {
  const Tag = clickable ? "button" : "div";
  return (
    <Tag
      type={clickable ? "button" : undefined}
      onClick={onClick}
      className={[
        "w-full rounded-xl border bg-white/95 px-4 py-3 text-right shadow-sm transition-all dark:bg-zinc-900/90",
        clickable
          ? "cursor-pointer hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/60 hover:shadow-md dark:hover:border-blue-800 dark:hover:bg-zinc-900"
          : "opacity-80",
        isHighlighted
          ? "border-violet-400 ring-2 ring-violet-300 ring-offset-1 dark:border-violet-600 dark:ring-violet-700"
          : "border-slate-200 dark:border-zinc-800",
      ].join(" ")}
      title={title}
      dir="rtl"
    >
      {children}
    </Tag>
  );
}

/** Flat row shell — matches Insights / Useful Knowledge density inside UniversalTabSelectRow. */
function ChapterRowShell({ children, clickable = false, title, onClick, isHighlighted = false, muted = false }) {
  const Tag = clickable ? "button" : "div";
  return (
    <Tag
      type={clickable ? "button" : undefined}
      onClick={onClick}
      className={[
        "w-full min-w-0 text-right transition-colors",
        clickable
          ? "cursor-pointer rounded-md hover:text-blue-800 dark:hover:text-blue-200"
          : "",
        isHighlighted ? "rounded-md bg-violet-50/70 dark:bg-violet-950/25 px-1 -mx-1" : "",
        muted && !clickable ? "text-slate-600 dark:text-zinc-400" : "",
      ].join(" ")}
      title={title}
      dir="rtl"
    >
      {children}
    </Tag>
  );
}

function TranscriptPreview({ section }) {
  const [open, setOpen] = useState(false);
  const count = section?.transcriptSegmentCount ?? section?.transcriptSegments?.length ?? 0;
  const text  = section?.transcriptText || "";
  if (!count && !text) return null;
  return (
    <div className="mt-1.5" dir="rtl">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }}
        className="text-[10px] font-medium text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
      >
        {count > 0 ? `${count} קטעי תמלול מחוברים` : "תמלול מחובר"} {open ? "▲" : "▼"}
      </button>
      {open && text && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-1 max-h-[120px] overflow-auto rounded-lg border border-indigo-100 bg-indigo-50/60 px-2.5 py-2 text-[11px] leading-relaxed text-slate-700 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-zinc-300"
        >
          {text}
        </div>
      )}
    </div>
  );
}

function ChapterKeyPoints({ points }) {
  const [open, setOpen] = useState(false);
  const safe = Array.isArray(points) ? points.filter(Boolean) : [];
  if (safe.length === 0) return null;
  return (
    <div className="mt-1.5" dir="rtl">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }}
        className="text-[10px] font-medium text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
      >
        {safe.length} נקודות מפתח {open ? "▲" : "▼"}
      </button>
      {open && (
        <ul
          onClick={(e) => e.stopPropagation()}
          className="mt-1 space-y-1"
        >
          {safe.map((pt, i) => (
            <li
              key={i}
              className="rounded-md border border-amber-100 bg-amber-50/60 px-2 py-1 text-[11px] leading-relaxed text-slate-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-zinc-300"
            >
              {typeof pt === "string" ? pt : (pt?.text || pt?.point || pt?.title || JSON.stringify(pt))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChapterContent({ section, timestampLabel, muted = false, compact = false }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const hasHebrew = Boolean(section.hebrewTitle);
  const displayTitle = hasHebrew ? section.hebrewTitle : section.title;
  const originalTitle = hasHebrew ? (section.originalTitle || section.title) : null;
  const cleanedDescription = cleanChapterSubtitle(displayTitle, section.description || "");
  const titleCls = compact
    ? `w-full text-right text-[15px] font-semibold leading-snug ${muted ? "text-slate-600 dark:text-zinc-400" : "text-slate-800 dark:text-zinc-100"}`
    : `w-full text-right text-base font-bold leading-snug ${muted ? "text-slate-700 dark:text-zinc-200" : "text-blue-900 dark:text-blue-200"}`;

  return (
    <div className={`flex flex-row-reverse items-start justify-between ${compact ? "gap-2" : "gap-3"}`} dir="rtl">
      <div className="min-w-0 flex-1 items-start text-right">
        <div className={titleCls}>
          {displayTitle}
        </div>
        {hasHebrew && (
          <div className="mt-1 flex items-center gap-1.5" dir="rtl">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowOriginal(p => !p); }}
              className="text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
            >
              {showOriginal ? "הסתר מקור ▲" : "הצג מקור ▼"}
            </button>
          </div>
        )}
        {hasHebrew && showOriginal && originalTitle && (
          <div className="mt-0.5 text-xs text-slate-400 dark:text-zinc-500 text-right italic" dir="ltr">
            {originalTitle}
          </div>
        )}
        {!hasHebrew && section.translatedTitleHe && section.translatedTitleHe !== section.title && (
          <div className="mt-0.5 text-sm font-medium text-slate-500 dark:text-zinc-400 text-right" dir="rtl">
            {section.translatedTitleHe}
          </div>
        )}
        {cleanedDescription ? (
          <div className={`${compact ? "mt-1 text-sm leading-relaxed" : "mt-1.5 text-sm leading-6"} text-slate-600 dark:text-zinc-300 ${compact ? "line-clamp-1" : "line-clamp-2"} text-right`}>
            {cleanedDescription}
          </div>
        ) : null}
        <ChapterKeyPoints points={section?.keyPoints} />
        <TranscriptPreview section={section} />
      </div>
      {timestampLabel ? (
        <div className="shrink-0 flex flex-col items-center gap-0.5">
          <div
            className={`${compact ? "rounded-md px-2 py-0.5 text-[11px]" : "rounded-lg px-2.5 py-1 text-xs"} font-semibold tabular-nums ${
              muted
                ? "border border-slate-200 bg-slate-100 text-slate-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                : "border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200"
            }`}
            dir="ltr"
          >
            {timestampLabel}
          </div>
          {(section?.timestampSource === "estimated" || section?.isEstimated) && (
            <span className="text-[9px] leading-tight text-amber-500 dark:text-amber-400 whitespace-nowrap font-semibold">
              ~משוער
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}

const ChapterItem = ({ section, playerRef, videoUrl, isHighlighted = false, variant = "card" }) => {
  const isRow = variant === "row";
  const Shell = isRow ? ChapterRowShell : ChapterShell;
  const finalSeconds = resolveStartSeconds(section);
  // Fall back to parsing the "MM:SS" / "HH:MM:SS" timestamp string when no numeric startSeconds exists
  const resolvedSeconds = finalSeconds !== null
    ? finalSeconds
    : parseTimestampString(section?.timestamp);
  const formattedTimestamp = resolvedSeconds !== null
    ? formatHebrewTimestamp(resolvedSeconds)
    : (section?.timestamp || "");
  const isValid = resolvedSeconds !== null;
  const hasPlayerSeek = Boolean(playerRef?.current?.seekTo);
  const urlStr = typeof videoUrl === "string" ? videoUrl.trim() : "";
  const hasTarget = hasPlayerSeek || urlStr.length > 0;

  const handleNavigation = () => {
    if (!isValid) return;

    if (playerRef?.current?.seekTo) {
      const p = playerRef.current;
      if (typeof p.playVideo === "function") {
        p.seekTo(resolvedSeconds, true);
        p.playVideo();
      } else {
        p.seekTo(resolvedSeconds, "seconds");
      }
      return;
    }

    if (urlStr) {
      const timestampUrl = buildTimestampUrl(urlStr, resolvedSeconds);
      if (timestampUrl) {
        window.open(timestampUrl, "_blank", "noopener,noreferrer");
      }
    }
  };

  const contentProps = { compact: isRow };

  if (!isValid) {
    if (urlStr) {
      return (
        <Shell clickable title="הפרק יפתח את הסרטון מתחילתו" onClick={() => window.open(urlStr, "_blank", "noopener,noreferrer")} isHighlighted={isHighlighted} muted={isRow}>
          <ChapterContent section={section} timestampLabel={null} muted {...contentProps} />
        </Shell>
      );
    }

    return (
      <Shell title="אין זמן זמין לפרק הזה" isHighlighted={isHighlighted} muted={isRow}>
        <ChapterContent section={section} timestampLabel={null} muted {...contentProps} />
      </Shell>
    );
  }

  if (!hasTarget) {
    return (
      <Shell title="אין יעד פתיחה זמין לפרק הזה" isHighlighted={isHighlighted} muted={isRow}>
        <ChapterContent section={section} timestampLabel={formattedTimestamp} muted {...contentProps} />
      </Shell>
    );
  }

  return (
    <Shell clickable onClick={handleNavigation} title="ניווט לפי זמן" isHighlighted={isHighlighted}>
      <ChapterContent section={section} timestampLabel={formattedTimestamp} {...contentProps} />
    </Shell>
  );
};

export default ChapterItem;
