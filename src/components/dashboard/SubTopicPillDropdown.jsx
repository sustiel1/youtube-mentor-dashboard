import { useState, useEffect, useRef, useMemo } from "react";
import ReactDOM from "react-dom";
import { cn } from "@/lib/utils";
import { CheckCircle2, Plus, ChevronDown, X } from "lucide-react";

export function SubTopicPillDropdown({ anchorEl, options = [], value = "", onSelect, onCancel, topicName = "", vaultPath = "" }) {
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [coords, setCoords] = useState(null);
  const [maxListHeight, setMaxListHeight] = useState(300);
  const [openGroups, setOpenGroups] = useState({});
  const [obsidianSubs, setObsidianSubs] = useState([]);
  const [obsidianLoading, setObsidianLoading] = useState(false);
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);
  const selectedRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const CHROME_HEIGHT = 100; // search box + create row

    if (spaceBelow >= 200 || spaceBelow >= spaceAbove) {
      setCoords({ top: rect.bottom + 4, right: window.innerWidth - rect.right, bottom: undefined });
      setMaxListHeight(Math.min(360, Math.max(120, spaceBelow - CHROME_HEIGHT)));
    } else {
      setCoords({ top: undefined, right: window.innerWidth - rect.right, bottom: window.innerHeight - rect.top + 4 });
      setMaxListHeight(Math.min(360, Math.max(120, spaceAbove - CHROME_HEIGHT)));
    }

    setTimeout(() => searchRef.current?.focus(), 0);
  }, [anchorEl]);

  // Scroll selected item into view after list renders
  useEffect(() => {
    if (coords && selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [coords]);

  // Fetch sub-topics from Obsidian vault (silent if no vault configured)
  useEffect(() => {
    if (!topicName) return;
    setObsidianLoading(true);
    const params = new URLSearchParams({ topic: topicName });
    if (vaultPath) params.set("vaultPath", vaultPath);
    fetch(`/api/vault/list?${params.toString()}`)
      .then(r => r.ok ? r.json() : { ok: false, subtopics: [] })
      .then(data => {
        if (data.ok && data.subtopics?.length) {
          setObsidianSubs(data.subtopics.map(name => ({ id: `obs:${name}`, name, isObsidian: true })));
        }
      })
      .catch(() => {})
      .finally(() => setObsidianLoading(false));
  }, [topicName, vaultPath]);

  // Merge app options + Obsidian subs, deduplicate by normalized name, sort
  const mergedOptions = useMemo(() => {
    const merged = [...options];
    const existingNames = new Set(options.map(o => String(o.name || "").trim().toLowerCase()));
    obsidianSubs.forEach(obs => {
      if (!existingNames.has(obs.name.trim().toLowerCase())) {
        merged.push(obs);
      }
    });
    return merged.sort((a, b) => String(a.name).localeCompare(String(b.name), 'he'));
  }, [options, obsidianSubs]);

  // No outside-click close — only X button or explicit cancel closes this dropdown

  const filtered = mergedOptions.filter(
    (o) => !search || o.name.toLowerCase().includes(search.toLowerCase())
  );

  const hasGroups = !search && filtered.some((o) => o.group);

  // Build group map and initialize all groups open on first render
  const groupMap = hasGroups
    ? filtered.reduce((acc, o) => {
        const key = o.group || "כללי";
        if (!acc[key]) acc[key] = [];
        acc[key].push(o);
        return acc;
      }, {})
    : null;

  useEffect(() => {
    if (groupMap) {
      setOpenGroups((prev) => {
        const next = { ...prev };
        Object.keys(groupMap).forEach((k) => {
          if (!(k in next)) next[k] = true;
        });
        return next;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGroups]);

  const toggleGroup = (key) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleCreate = () => {
    const name = (newName || search).trim();
    if (name) onSelect(name);
  };

  const renderOption = (o) => (
    <button
      key={o.id || o.name}
      ref={value === o.name ? selectedRef : null}
      type="button"
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(o.name); }}
      className={cn(
        "flex w-full items-center justify-between gap-2 px-3 py-2 text-sm text-right transition-colors hover:bg-slate-50 dark:hover:bg-zinc-900",
        value === o.name
          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300"
          : "text-slate-700 dark:text-zinc-200"
      )}
    >
      <span className="truncate font-medium">{o.name}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        {(o.count ?? 0) > 0 && (
          <span className="text-[10px] text-slate-400 dark:text-zinc-500">({o.count})</span>
        )}
        {o.isObsidian && <span className="text-[9px] text-violet-400" title="מ-Obsidian">📁</span>}
        {o.isCustom && !o.isObsidian && <span className="text-[9px] text-violet-400">✦</span>}
        {value === o.name && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500" />}
      </span>
    </button>
  );

  if (!coords) return null;

  const positionStyle = {
    position: "fixed",
    zIndex: 9999,
    right: coords.right,
    ...(coords.top !== undefined ? { top: coords.top } : {}),
    ...(coords.bottom !== undefined ? { bottom: coords.bottom } : {}),
  };

  const dropdown = (
    <div
      ref={dropdownRef}
      dir="rtl"
      style={{ ...positionStyle, pointerEvents: 'auto' }}
      onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
      onPointerDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
      className="w-64 rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
    >
      {/* Header: search + X close button */}
      <div className="flex items-center gap-1.5 border-b border-slate-100 p-2 dark:border-zinc-800">
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            // ESC clears search only — does NOT close the dropdown
            if (e.key === "Escape") { e.stopPropagation(); setSearch(""); }
            if (e.key === "Enter" && search.trim()) {
              const exact = mergedOptions.find(
                (o) => String(o.name).toLowerCase() === search.trim().toLowerCase()
              );
              onSelect(exact ? exact.name : search.trim());
            }
          }}
          placeholder="חיפוש תת-נושא..."
          dir="rtl"
          className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-right outline-none placeholder:text-slate-400 focus:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(); }}
          title="סגור"
          className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Scrollable options list — wheel events contained here */}
      <div
        ref={listRef}
        style={{ maxHeight: maxListHeight }}
        className="overflow-y-auto overscroll-contain py-1"
        onWheel={(e) => e.stopPropagation()}
      >
        {obsidianLoading && (
          <p className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-slate-400 dark:text-zinc-500">
            <span className="inline-block h-3 w-3 rounded-full border border-slate-300 border-t-indigo-400 animate-spin shrink-0" />
            טוען מ-Obsidian...
          </p>
        )}
        {!obsidianLoading && filtered.length === 0 && (
          <p className="px-3 py-2 text-xs text-slate-400 dark:text-zinc-500 text-right">
            {topicName ? `לא נמצאו תתי-נושאים ב-Obsidian` : "אין תוצאות"}
          </p>
        )}

        {hasGroups && groupMap
          ? Object.entries(groupMap).map(([groupName, items]) => (
              <div key={groupName}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                  onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleGroup(groupName); }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-900/50"
                >
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 shrink-0 transition-transform duration-150",
                      !openGroups[groupName] && "-rotate-90"
                    )}
                  />
                  <span>{groupName}</span>
                </button>
                {openGroups[groupName] && (
                  <div className="pr-2">
                    {items.map(renderOption)}
                  </div>
                )}
              </div>
            ))
          : filtered.map(renderOption)
        }
      </div>

      {/* Create new — always visible at bottom */}
      <div className="border-t border-slate-100 p-2 dark:border-zinc-800">
        {showNew ? (
          <div className="flex gap-1.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                // ESC closes the "create" form only, not the whole dropdown
                if (e.key === "Escape") { e.stopPropagation(); setShowNew(false); }
              }}
              placeholder="שם תת-נושא חדש..."
              dir="rtl"
              className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-right outline-none focus:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCreate(); }}
              className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-indigo-700"
            >
              צור
            </button>
          </div>
        ) : (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowNew(true); setNewName(search); }}
            className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950/20"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>+ צור תת-נושא חדש</span>
          </button>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(dropdown, document.body);
}
