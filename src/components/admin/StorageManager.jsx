import { useState, useEffect, useCallback } from "react";
import {
  HardDrive, RefreshCw, Trash2, AlertTriangle, CheckCircle2,
  Zap, ChevronDown, ChevronUp, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Constants ─────────────────────────────────────────────────────────────────
const KB = 1024;
const MB = KB * KB;
const LIMIT_MB = 5;
const TRANSCRIPT_FIELDS = ['transcript', 'transcriptText', 'transcriptSegments', 'rawTranscript'];

// ── Category map ──────────────────────────────────────────────────────────────
const CATS = [
  {
    id: "videos",
    label: "🎬 סרטונים",
    keys: ["yt_mentor_videos_v2"],
    prefixes: [],
    bar: "bg-blue-500",
    safe: false,
    desc: "מסד הסרטונים הראשי — ניתוח, פרקים, מטא-דאטה",
  },
  {
    id: "analysis",
    label: "🧠 ניתוח AI (שמור)",
    keys: [],
    prefixes: ["analysis:"],
    bar: "bg-violet-500",
    safe: false,
    desc: "ניתוחי AI שנשמרו לפי סרטון (analysis:videoId)",
  },
  {
    id: "transcript",
    label: "📝 Cache תמלולים",
    keys: ["yt_mentor_transcript_cache_v1", "yt_transcript_segs_v1"],
    prefixes: [],
    bar: "bg-emerald-500",
    safe: true,
    desc: "תמלולים זמניים — ייווצרו מחדש בצפייה הבאה",
  },
  {
    id: "chapters",
    label: "📖 Cache פרקים",
    keys: ["yt_mentor_youtube_chapter_cache_v1"],
    prefixes: [],
    bar: "bg-cyan-500",
    safe: true,
    desc: "מטא-דאטה של פרקים מ-YouTube — ייווצרו מחדש",
  },
  {
    id: "chunks",
    label: "💡 Knowledge Chunks",
    keys: ["yt_chunks_v1", "yt_chunk_meta_v1"],
    prefixes: [],
    bar: "bg-amber-500",
    safe: true,
    desc: "נתחי ידע — ניתן לשחזר מניתוח קיים",
  },
  {
    id: "legacy_ai",
    label: "⚠️ Legacy AI Analysis",
    keys: [],
    prefixes: ["ai_analysis_"],
    bar: "bg-rose-400",
    safe: true,
    desc: "מפתחות ai_analysis_* ישנים — מוחלפים על ידי analysis:*",
  },
  {
    id: "notes",
    label: "📓 הערות",
    keys: ["yt_mentor_notes_v1", "yt_manual_notes_v1", "yt_sentence_notes_v1"],
    prefixes: [],
    bar: "bg-orange-500",
    safe: false,
    desc: "הערות אישיות — לא ניתן לשחזר",
  },
  {
    id: "brain",
    label: "🔮 Brain / Obsidian",
    keys: ["yt_knowledge_items_v1", "obsidian_settings_v1", "brain_custom_dests_v1", "brain_dest_subs_v1"],
    prefixes: [],
    bar: "bg-pink-500",
    safe: false,
    desc: "פריטי ידע לייצוא — לא ניתן לשחזר",
  },
  {
    id: "archive",
    label: "🗄️ ארכיון מחוקים",
    keys: ["yt_mentor_deleted_videos_archive_v1"],
    prefixes: [],
    bar: "bg-red-400",
    safe: false, // requires explicit user choice
    desc: "גיבוי סרטונים שנמחקו",
  },
  {
    id: "mentors",
    label: "👤 ערוצים / מנטורים",
    keys: ["yt_custom_mentors_v1", "yt_mentor_hidden_ids_v1", "yt_mentor_scan_frozen_v1", "ym_channel_collections_v1"],
    prefixes: [],
    bar: "bg-indigo-400",
    safe: false,
    desc: "מנטורים וערוצים מוגדרים",
  },
  {
    id: "settings",
    label: "⚙️ הגדרות / Sync",
    keys: [
      "youtubeMentor.theme", "gems_config", "ym_topic_order",
      "yt_mentor_last_sync_v1", "yt_mentor_last_sync_result_v1",
      "lastChannelScanAt", "lastChannelScanSummary", "nextChannelScanAt",
      "youtubeMentorScanDebug", "yt_mentor_videos_cleared_v1",
      "yt_mentor_deleted_video_ids_v1", "yt_topic_user_v1",
    ],
    prefixes: [],
    bar: "bg-slate-400",
    safe: false,
    desc: "הגדרות, סינכרון, נושאים",
  },
];

// ── Cleanup action definitions ────────────────────────────────────────────────
const CLEANUP_DEFS = [
  {
    id: "transcript_cache",
    label: "מחק Cache תמלולים",
    desc: "yt_mentor_transcript_cache_v1 + yt_transcript_segs_v1",
    detail: "תמלולים זמניים — ייווצרו מחדש אוטומטית בצפייה הבאה",
    keys: ["yt_mentor_transcript_cache_v1", "yt_transcript_segs_v1"],
    prefixes: [],
    level: "safe",
  },
  {
    id: "chapter_cache",
    label: "מחק Cache פרקים",
    desc: "yt_mentor_youtube_chapter_cache_v1",
    detail: "מטא-דאטה של פרקים — ייווצרו מחדש בטעינת הסרטון",
    keys: ["yt_mentor_youtube_chapter_cache_v1"],
    prefixes: [],
    level: "safe",
  },
  {
    id: "chunks",
    label: "מחק Knowledge Chunks",
    desc: "yt_chunks_v1 + yt_chunk_meta_v1",
    detail: "נתחי ידע — ניתן לשחזר מהניתוח הקיים בסרטון",
    keys: ["yt_chunks_v1", "yt_chunk_meta_v1"],
    prefixes: [],
    level: "safe",
  },
  {
    id: "legacy_analysis",
    label: "מחק Legacy AI Analysis",
    desc: "כל מפתחות ai_analysis_*",
    detail: "פורמט ישן — הניתוח השמור ב-analysis:* נשאר שלם",
    keys: [],
    prefixes: ["ai_analysis_"],
    level: "safe",
  },
  {
    id: "deleted_archive",
    label: "מחק ארכיון סרטונים מחוקים",
    desc: "yt_mentor_deleted_videos_archive_v1",
    detail: "⚠️ גיבוי של סרטונים שנמחקו — לא ניתן לשחזר לאחר מחיקה זו",
    keys: ["yt_mentor_deleted_videos_archive_v1"],
    prefixes: [],
    level: "caution",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function bytesOf(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? new Blob([v]).size : 0;
  } catch { return 0; }
}

function allKeysForDef({ keys = [], prefixes = [] }) {
  const found = [...keys];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && prefixes.some(p => k.startsWith(p))) found.push(k);
  }
  return [...new Set(found)];
}

function parseDate(raw) {
  try {
    const obj = JSON.parse(raw);
    const candidate = obj?.savedAt || obj?.analyzedAt || obj?.fetchedAt || obj?.updatedAt || obj?.createdAt;
    if (candidate) return new Date(candidate);
  } catch {}
  return null;
}

function fmtDate(d) {
  if (!d || isNaN(d)) return "—";
  return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function detectTranscriptInVideos() {
  try {
    const raw = localStorage.getItem("yt_mentor_videos_v2");
    if (!raw) return { count: 0, estimatedKb: 0 };
    const videos = JSON.parse(raw);
    if (!Array.isArray(videos)) return { count: 0, estimatedKb: 0 };
    const affected = videos.filter(v =>
      TRANSCRIPT_FIELDS.some(f => v[f] != null && v[f] !== "")
    );
    const estimatedBytes = affected.reduce((sum, v) =>
      sum + TRANSCRIPT_FIELDS.reduce((s, f) => {
        if (v[f] == null) return s;
        try { return s + new Blob([JSON.stringify(v[f])]).size; } catch { return s; }
      }, 0)
    , 0);
    return { count: affected.length, estimatedKb: estimatedBytes / KB };
  } catch { return { count: 0, estimatedKb: 0 }; }
}

function cleanTranscriptsFromVideos() {
  try {
    const raw = localStorage.getItem("yt_mentor_videos_v2");
    if (!raw) return { count: 0, freedKb: 0 };
    const videos = JSON.parse(raw);
    if (!Array.isArray(videos)) return { count: 0, freedKb: 0 };
    const beforeBytes = new Blob([raw]).size;
    let count = 0;
    const cleaned = videos.map(v => {
      if (!TRANSCRIPT_FIELDS.some(f => v[f] != null && v[f] !== "")) return v;
      count++;
      const copy = { ...v };
      TRANSCRIPT_FIELDS.forEach(f => delete copy[f]);
      return copy;
    });
    const newRaw = JSON.stringify(cleaned);
    localStorage.setItem("yt_mentor_videos_v2", newRaw);
    return { count, freedKb: (beforeBytes - new Blob([newRaw]).size) / KB };
  } catch { return { count: 0, freedKb: 0 }; }
}

// ── Core scan ─────────────────────────────────────────────────────────────────
function scanLocalStorage() {
  const allKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) allKeys.push(k);
  }

  const totalBytes = allKeys.reduce((s, k) => s + bytesOf(k), 0);

  // Per-category stats
  const catStats = CATS.map(cat => {
    const matchedKeys = allKeys.filter(k =>
      cat.keys.includes(k) || cat.prefixes.some(p => k.startsWith(p))
    );
    const bytes = matchedKeys.reduce((s, k) => s + bytesOf(k), 0);
    let itemCount = 0;
    matchedKeys.forEach(k => {
      try {
        const v = JSON.parse(localStorage.getItem(k));
        if (Array.isArray(v)) itemCount += v.length;
        else if (v && typeof v === "object") itemCount += Object.keys(v).length;
        else itemCount += 1;
      } catch { itemCount += 1; }
    });
    return {
      ...cat,
      matchedKeys,
      bytes,
      kb: bytes / KB,
      mb: bytes / MB,
      pct: totalBytes > 0 ? (bytes / totalBytes) * 100 : 0,
      itemCount,
    };
  });

  // Track assigned keys to find "other"
  const assignedKeys = new Set(CATS.flatMap(c => allKeysForDef(c)));
  const otherKeys = allKeys.filter(k => !assignedKeys.has(k));
  const otherBytes = otherKeys.reduce((s, k) => s + bytesOf(k), 0);

  // Top items
  const topItems = allKeys
    .map(k => {
      const raw = localStorage.getItem(k);
      const bytes = raw ? new Blob([raw]).size : 0;
      const date = raw ? parseDate(raw) : null;
      const catLabel = CATS.find(c => c.keys.includes(k) || c.prefixes.some(p => k.startsWith(p)))?.label ?? "❓ אחר";
      return { key: k, bytes, kb: bytes / KB, date, catLabel };
    })
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 15);

  // Recommendations
  const recs = [];
  const tcCat = catStats.find(c => c.id === "transcript");
  if (tcCat && tcCat.kb > 50)
    recs.push({ type: "cache", text: `Cache תמלולים תופס ${tcCat.kb.toFixed(0)} KB — ניתן למחוק בבטחה` });
  const chCat = catStats.find(c => c.id === "chapters");
  if (chCat && chCat.kb > 20)
    recs.push({ type: "cache", text: `Cache פרקים תופס ${chCat.kb.toFixed(0)} KB — ניתן למחוק בבטחה` });
  const legacyCat = catStats.find(c => c.id === "legacy_ai");
  if (legacyCat && legacyCat.matchedKeys.length > 0)
    recs.push({ type: "legacy", text: `${legacyCat.matchedKeys.length} מפתחות legacy ai_analysis_* (${legacyCat.kb.toFixed(0)} KB) — הפורמט הישן, ניתן למחוק` });
  const chunksCat = catStats.find(c => c.id === "chunks");
  if (chunksCat && chunksCat.kb > 30)
    recs.push({ type: "regen", text: `Knowledge Chunks תופסים ${chunksCat.kb.toFixed(0)} KB — ניתן לשחזר` });
  const archiveCat = catStats.find(c => c.id === "archive");
  if (archiveCat && archiveCat.kb > 10)
    recs.push({ type: "optional", text: `ארכיון סרטונים מחוקים: ${archiveCat.kb.toFixed(0)} KB` });
  // Duplicate detection
  const savedIds = new Set();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("analysis:")) savedIds.add(k.slice("analysis:".length));
  }
  const legacyIds = new Set();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("ai_analysis_")) legacyIds.add(k.slice("ai_analysis_".length));
  }
  const dups = [...savedIds].filter(id => legacyIds.has(id));
  if (dups.length > 0)
    recs.push({ type: "dup", text: `${dups.length} סרטונים שמורים בשני פורמטים במקביל (analysis:* וגם ai_analysis_*)` });

  // Transcripts stored inside video objects
  const transcriptInVideos = detectTranscriptInVideos();
  if (transcriptInVideos.count > 0)
    recs.push({ type: "transcript_cleanup", count: transcriptInVideos.count, estimatedKb: transcriptInVideos.estimatedKb });

  const recoverableBytes = CLEANUP_DEFS.filter(d => d.level === "safe")
    .flatMap(d => allKeysForDef(d))
    .reduce((s, k) => s + bytesOf(k), 0);

  return {
    totalBytes,
    totalKb: totalBytes / KB,
    totalMb: totalBytes / MB,
    limitMb: LIMIT_MB,
    pctUsed: (totalBytes / MB / LIMIT_MB) * 100,
    catStats,
    otherKeys,
    otherBytes,
    topItems,
    recs,
    allKeys,
    recoverableKb: recoverableBytes / KB,
    recoverableBytes,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────
function UsageBar({ pct }) {
  const clamped = Math.min(pct, 100);
  const color =
    clamped > 90 ? "bg-red-500" :
    clamped > 70 ? "bg-amber-400" :
    "bg-emerald-500";
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
      <div
        className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function CategoryRow({ cat, totalBytes }) {
  const pct = totalBytes > 0 ? ((cat.bytes / totalBytes) * 100).toFixed(1) : "0.0";
  const sizeColor = cat.kb > 500
    ? "text-red-600 dark:text-red-400"
    : cat.kb > 100
    ? "text-amber-600 dark:text-amber-400"
    : "text-slate-700 dark:text-zinc-200";
  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 dark:border-zinc-800/50 dark:hover:bg-zinc-800/30">
      <td className="py-2.5 pr-3 text-right text-sm font-medium text-slate-700 dark:text-zinc-200 whitespace-nowrap">
        {cat.label}
      </td>
      <td className="py-2.5 px-2 text-center text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
        {cat.itemCount > 0 ? cat.itemCount.toLocaleString() : "—"}
      </td>
      {/* Size — MB primary, KB secondary */}
      <td className="py-2.5 px-3 text-left min-w-[90px]">
        <span className={cn("block text-sm font-bold tabular-nums leading-tight", sizeColor)}>
          {cat.mb.toFixed(2)} MB
        </span>
        <span className="block text-[10px] tabular-nums text-slate-400 dark:text-zinc-500 leading-tight">
          {cat.kb.toFixed(1)} KB
        </span>
      </td>
      {/* Percentage — explicit number */}
      <td className="py-2.5 px-2 text-center">
        <span className={cn("text-sm font-bold tabular-nums", cat.kb > 200 ? "text-slate-700 dark:text-zinc-200" : "text-slate-500 dark:text-zinc-400")}>
          {pct}%
        </span>
      </td>
      {/* Mini bar */}
      <td className="py-2.5 px-2 w-20">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
          <div className={cn("h-full rounded-full", cat.bar)} style={{ width: `${Math.min(+pct, 100)}%` }} />
        </div>
      </td>
      <td className="py-2.5 pl-2">
        {cat.safe && cat.bytes > 0 && (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
            ניתן לנקות
          </span>
        )}
        {!cat.safe && cat.bytes > 0 && (
          <span className="inline-flex items-center rounded-full bg-slate-50 px-1.5 py-0.5 text-[9px] font-medium text-slate-400 dark:bg-zinc-800 dark:text-zinc-500">
            חשוב
          </span>
        )}
      </td>
    </tr>
  );
}

function TranscriptCleanupDialog({ count, estimatedKb, onConfirm, onCancel }) {
  const sizeTxt = estimatedKb >= 1000
    ? `${(estimatedKb / 1000).toFixed(2)} MB`
    : `${estimatedKb.toFixed(1)} KB`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" dir="rtl">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 mx-4">
        <h2 className="text-base font-bold text-slate-800 dark:text-zinc-100 mb-3">
          הסרת תמלולים מסרטונים
        </h2>
        <p className="text-sm text-slate-600 dark:text-zinc-300 mb-4">
          נמצאו <span className="font-semibold">{count}</span> סרטונים המכילים תמלול מלא שנשמר גם ב-cache.
        </p>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 mb-3 dark:border-emerald-800/40 dark:bg-emerald-950/20">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">פעולה זו תסיר רק:</p>
          <ul className="space-y-0.5">
            {TRANSCRIPT_FIELDS.map(f => (
              <li key={f} className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                <span className="h-1 w-1 rounded-full bg-emerald-500 shrink-0" />
                <code className="font-mono">{f}</code>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 mb-4 dark:border-zinc-700 dark:bg-zinc-800/40">
          <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1.5">הפעולה לא תמחק:</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {["הסרטון", "ניתוחי AI", "תובנות", "הערות", "Brain", "Obsidian", "נתוני מטא"].map(item => (
              <span key={item} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                <span className="h-1 w-1 rounded-full bg-slate-300 shrink-0" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-5 dark:border-amber-800/40 dark:bg-amber-950/20">
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-0.5">שטח צפוי להתפנות:</p>
          <p className="text-xl font-extrabold tabular-nums text-amber-700 dark:text-amber-300">{sizeTxt}</p>
        </div>

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            ביטול
          </button>
          <button type="button" onClick={onConfirm}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            🧹 הסר תמלולים
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCards({ data }) {
  const largest = [...data.catStats]
    .filter(c => c.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes)[0];

  const mainRecoverable = [...data.catStats]
    .filter(c => c.safe && c.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes)[0];

  const recKb = data.recoverableKb;
  const recMb = recKb / 1000;

  return (
    <div className="grid grid-cols-2 gap-3" dir="rtl">
      {/* Largest consumer */}
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500 mb-2">
          הצרכן הגדול ביותר
        </p>
        {largest ? (
          <>
            <p className="text-sm font-bold text-slate-700 dark:text-zinc-200 leading-snug">{largest.label}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-zinc-50">
              {largest.mb.toFixed(2)}{" "}
              <span className="text-sm font-normal text-slate-400">MB</span>
            </p>
            <p className="text-xs tabular-nums text-slate-400 dark:text-zinc-500">
              {largest.kb.toFixed(1)} KB &bull; {largest.pct.toFixed(1)}% מהסך
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-400">—</p>
        )}
      </div>

      {/* Recoverable space */}
      <div className={cn(
        "rounded-2xl border p-4 shadow-sm",
        recKb > 50
          ? "border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-800/30 dark:bg-emerald-950/10"
          : "border-slate-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-950/70"
      )}>
        <p className={cn(
          "text-[11px] font-semibold uppercase tracking-wide mb-2",
          recKb > 50 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-zinc-500"
        )}>
          שטח ניתן לפינוי
        </p>
        {recKb > 1 ? (
          <>
            {mainRecoverable && (
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-snug mb-1">
                מחיקת {mainRecoverable.label} תפנה:
              </p>
            )}
            <p className={cn(
              "text-2xl font-extrabold tabular-nums",
              recKb > 50 ? "text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-zinc-200"
            )}>
              {recMb >= 0.01 ? recMb.toFixed(2) : recKb.toFixed(0)}{" "}
              <span className="text-sm font-normal">{recMb >= 0.01 ? "MB" : "KB"}</span>
            </p>
            <p className="text-xs tabular-nums text-slate-400 dark:text-zinc-500">
              {recKb.toFixed(1)} KB &bull; {data.totalKb > 0 ? ((recKb / data.totalKb) * 100).toFixed(1) : "0"}% מהסך
            </p>
          </>
        ) : (
          <p className="text-sm font-medium text-slate-400 dark:text-zinc-500 mt-2">אין מה לנקות</p>
        )}
      </div>
    </div>
  );
}

function ConfirmBanner({ action, freedKb, onConfirm, onCancel }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-950/20" dir="rtl">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            אישור מחיקה: {action.label}
          </p>
          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{action.detail}</p>
          {freedKb > 0 && (
            <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              פינוי משוער: {freedKb >= 1000 ? `${(freedKb/1000).toFixed(2)} MB` : `${freedKb.toFixed(0)} KB`}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          ביטול
        </button>
        <button type="button" onClick={onConfirm}
          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600">
          כן, מחק
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StorageManager() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(null); // { action, freedKb }
  const [showTopItems, setShowTopItems] = useState(false);
  const [showRecs, setShowRecs] = useState(true);
  const [showTranscriptDialog, setShowTranscriptDialog] = useState(false);

  const scan = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setData(scanLocalStorage());
      setLoading(false);
    }, 50);
  }, []);

  useEffect(() => { scan(); }, [scan]);

  const requestCleanup = (action) => {
    const keys = allKeysForDef(action);
    const freedKb = keys.reduce((s, k) => s + bytesOf(k), 0) / KB;
    setConfirm({ action, freedKb });
  };

  const executeCleanup = () => {
    if (!confirm) return;
    const { action } = confirm;
    const keys = allKeysForDef(action);
    let removed = 0;
    keys.forEach(k => {
      try { localStorage.removeItem(k); removed++; } catch {}
    });
    setConfirm(null);
    scan();
    toast.success(`${action.label} — הוסרו ${removed} ${removed === 1 ? "מפתח" : "מפתחות"}`);
  };

  const handleTranscriptCleanup = () => {
    const result = cleanTranscriptsFromVideos();
    setShowTranscriptDialog(false);
    scan();
    const sizeTxt = result.freedKb >= 1000
      ? `${(result.freedKb / 1000).toFixed(2)} MB`
      : `${result.freedKb.toFixed(0)} KB`;
    toast.success(`✅ הוסרו תמלולים מ־${result.count} סרטונים\n💾 התפנו ${sizeTxt}`, { duration: 5000 });
  };

  const safeCleanupAll = () => {
    const safeActions = CLEANUP_DEFS.filter(a => a.level === "safe");
    let total = 0;
    safeActions.forEach(action => {
      const keys = allKeysForDef(action);
      keys.forEach(k => {
        try { localStorage.removeItem(k); total++; } catch {}
      });
    });
    scan();
    toast.success(`ניקוי בטוח הושלם — הוסרו ${total} מפתחות`);
  };

  if (!data && !loading) return null;

  const safeFreeKb = data
    ? CLEANUP_DEFS.filter(a => a.level === "safe")
        .flatMap(a => allKeysForDef(a))
        .reduce((s, k) => s + bytesOf(k), 0) / KB
    : 0;

  return (
    <div className="space-y-5" dir="rtl">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-indigo-500" />
            ניהול אחסון
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            סריקת localStorage — מצא מה תופס מקום ונקה בבטחה
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={scan} disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            סרוק מחדש
          </button>
          {data && safeFreeKb > 1 && (
            <button type="button" onClick={safeCleanupAll}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700">
              <Zap className="h-3.5 w-3.5" />
              ניקוי בטוח ({safeFreeKb >= 1000 ? `${(safeFreeKb/1000).toFixed(1)} MB` : `${safeFreeKb.toFixed(0)} KB`})
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" /> סורק...
        </div>
      )}

      {data && (
        <>
          {/* ── Usage meter ── */}
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-2xl font-bold text-slate-800 dark:text-zinc-100 tabular-nums">
                  {data.totalMb.toFixed(2)} <span className="text-base font-normal text-slate-400">MB</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  ממגבלה של ~{LIMIT_MB} MB ({data.allKeys.length} מפתחות)
                </p>
              </div>
              <span className={cn(
                "text-3xl font-extrabold tabular-nums",
                data.pctUsed > 90 ? "text-red-500" : data.pctUsed > 70 ? "text-amber-500" : "text-emerald-500"
              )}>
                {data.pctUsed.toFixed(0)}%
              </span>
            </div>
            <UsageBar pct={data.pctUsed} />
            {data.pctUsed > 85 && (
              <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                אחסון גבוה — מומלץ לנקות לפני שהאפליקציה תיכשל לשמור נתונים חדשים
              </p>
            )}
          </div>

          {/* ── Summary cards ── */}
          <SummaryCards data={data} />

          {/* ── Category breakdown ── */}
          <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800/60">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-zinc-200">פירוט לפי קטגוריה</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-zinc-800/60 text-right">
                    <th className="py-2.5 pr-3 text-xs font-semibold text-slate-400 dark:text-zinc-500">קטגוריה</th>
                    <th className="py-2.5 px-2 text-center text-xs font-semibold text-slate-400 dark:text-zinc-500">פריטים</th>
                    <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-400 dark:text-zinc-500">גודל</th>
                    <th className="py-2.5 px-2 text-center text-xs font-semibold text-slate-400 dark:text-zinc-500">%</th>
                    <th className="py-2.5 px-2 w-20 text-xs font-semibold text-slate-400 dark:text-zinc-500"></th>
                    <th className="py-2.5 pl-3 text-xs font-semibold text-slate-400 dark:text-zinc-500"></th>
                  </tr>
                </thead>
                <tbody className="px-5">
                  {data.catStats
                    .filter(c => c.bytes > 0)
                    .sort((a, b) => b.bytes - a.bytes)
                    .map(cat => (
                      <CategoryRow key={cat.id} cat={cat} totalBytes={data.totalBytes} />
                    ))}
                  {data.otherBytes > 0 && (
                    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 dark:border-zinc-800/50 dark:hover:bg-zinc-800/30">
                      <td className="py-2.5 pr-3 text-right text-sm font-medium text-slate-500">❓ אחר</td>
                      <td className="py-2.5 px-2 text-center text-xs text-slate-400">—</td>
                      <td className="py-2.5 px-3 text-left">
                        <span className="block text-sm font-bold tabular-nums text-slate-500 leading-tight">
                          {(data.otherBytes/MB).toFixed(2)} MB
                        </span>
                        <span className="block text-[10px] tabular-nums text-slate-400 leading-tight">
                          {(data.otherBytes/KB).toFixed(1)} KB
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="text-sm font-bold tabular-nums text-slate-400">
                          {data.totalBytes > 0 ? ((data.otherBytes/data.totalBytes)*100).toFixed(1) : "0.0"}%
                        </span>
                      </td>
                      <td className="py-2.5 px-2 w-20">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                          <div className="h-full rounded-full bg-slate-300" style={{ width: `${Math.min((data.otherBytes/data.totalBytes)*100, 100)}%` }} />
                        </div>
                      </td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Recommendations ── */}
          {data.recs.length > 0 && (
            <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 shadow-sm dark:border-amber-800/30 dark:bg-amber-950/10 overflow-hidden">
              <button type="button"
                onClick={() => setShowRecs(v => !v)}
                className="flex w-full items-center justify-between px-5 py-4 text-right">
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  המלצות ניקוי ({data.recs.length})
                </h3>
                {showRecs ? <ChevronUp className="h-4 w-4 text-amber-500" /> : <ChevronDown className="h-4 w-4 text-amber-500" />}
              </button>
              {showRecs && (
                <ul className="px-5 pb-4 space-y-2">
                  {data.recs.map((r, i) => {
                    if (r.type === "transcript_cleanup") {
                      return (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() => setShowTranscriptDialog(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-950/30 transition-colors"
                          >
                            🧹 הסר תמלולים מסרטונים ({r.count})
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] dark:bg-emerald-900/40">
                              ~{r.estimatedKb >= 1000 ? `${(r.estimatedKb/1000).toFixed(1)} MB` : `${r.estimatedKb.toFixed(0)} KB`}
                            </span>
                          </button>
                        </li>
                      );
                    }
                    return (
                      <li key={i} className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                        <span className="mt-0.5 shrink-0">
                          {r.type === "dup" ? "⚠️" : r.type === "legacy" ? "🗑️" : r.type === "cache" ? "🧹" : "💡"}
                        </span>
                        {r.text}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* ── Confirm banner ── */}
          {confirm && (
            <ConfirmBanner
              action={confirm.action}
              freedKb={confirm.freedKb}
              onConfirm={executeCleanup}
              onCancel={() => setConfirm(null)}
            />
          )}

          {/* ── Cleanup actions ── */}
          <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800/60 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-zinc-200">פעולות ניקוי</h3>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                ירוק = בטוח לחלוטין
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-zinc-800/50">
              {CLEANUP_DEFS.map(action => {
                const keys = allKeysForDef(action);
                const sizeKb = keys.reduce((s, k) => s + bytesOf(k), 0) / KB;
                const isEmpty = sizeKb < 0.1;
                return (
                  <div key={action.id}
                    className={cn("flex items-center gap-4 px-5 py-3.5", isEmpty && "opacity-40")}>
                    <div className="flex-1 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">{action.label}</span>
                        {action.level === "safe" && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        )}
                        {action.level === "caution" && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">{action.detail}</p>
                    </div>
                    <div className="shrink-0 text-left min-w-[72px]">
                      <p className={cn("text-xs font-mono font-semibold tabular-nums text-left",
                        sizeKb > 500 ? "text-red-500" : sizeKb > 50 ? "text-amber-600 dark:text-amber-400" : "text-slate-400"
                      )}>
                        {isEmpty ? "ריק" : sizeKb >= 1000 ? `${(sizeKb/1000).toFixed(2)} MB` : `${sizeKb.toFixed(0)} KB`}
                      </p>
                      {!isEmpty && (
                        <p className="text-[10px] text-slate-400">{keys.length} מפתחות</p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={isEmpty}
                      onClick={() => requestCleanup(action)}
                      className={cn(
                        "shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
                        action.level === "safe"
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-30 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-400"
                          : "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-30 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-400"
                      )}
                    >
                      <Trash2 className="h-3 w-3" />
                      מחק
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Top items ── */}
          <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70 overflow-hidden">
            <button type="button"
              onClick={() => setShowTopItems(v => !v)}
              className="flex w-full items-center justify-between px-5 py-4 text-right">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
                15 הפריטים הגדולים ביותר
              </h3>
              {showTopItems
                ? <ChevronUp className="h-4 w-4 text-slate-400" />
                : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {showTopItems && (
              <div className="overflow-x-auto border-t border-slate-100 dark:border-zinc-800/60">
                <table className="w-full min-w-[580px] text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-zinc-800/60 text-right">
                      <th className="py-2 pr-5 font-semibold text-slate-400">#</th>
                      <th className="py-2 px-2 font-semibold text-slate-400">מפתח</th>
                      <th className="py-2 px-2 text-center font-semibold text-slate-400">קטגוריה</th>
                      <th className="py-2 px-2 text-center font-semibold text-slate-400">גודל</th>
                      <th className="py-2 pl-5 text-center font-semibold text-slate-400">תאריך</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topItems.map((item, idx) => (
                      <tr key={item.key} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 dark:border-zinc-800/30 dark:hover:bg-zinc-800/20">
                        <td className="py-2 pr-5 text-slate-400 tabular-nums">{idx + 1}</td>
                        <td className="py-2 px-2 font-mono text-slate-600 dark:text-zinc-300 max-w-[280px] truncate">
                          {item.key}
                        </td>
                        <td className="py-2 px-2 text-center text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                          {item.catLabel}
                        </td>
                        <td className={cn("py-2 px-2 text-center tabular-nums font-semibold",
                          item.kb > 500 ? "text-red-500" : item.kb > 100 ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-zinc-300"
                        )}>
                          {item.kb >= 1000 ? `${(item.kb/1000).toFixed(2)} MB` : `${item.kb.toFixed(1)} KB`}
                        </td>
                        <td className="py-2 pl-5 text-center text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                          {fmtDate(item.date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </>
      )}

      {/* ── Transcript cleanup dialog ── */}
      {showTranscriptDialog && data && (() => {
        const rec = data.recs.find(r => r.type === "transcript_cleanup");
        if (!rec) return null;
        return (
          <TranscriptCleanupDialog
            count={rec.count}
            estimatedKb={rec.estimatedKb}
            onConfirm={handleTranscriptCleanup}
            onCancel={() => setShowTranscriptDialog(false)}
          />
        );
      })()}
    </div>
  );
}
