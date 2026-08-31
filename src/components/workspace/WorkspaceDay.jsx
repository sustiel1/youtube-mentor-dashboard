import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/workspace/ConfirmDialog";
import { exportWorkspaceDayToObsidian } from "@/lib/workspaceDayObsidianExport";
import { useWorkspaceItems } from "@/hooks/useWorkspaceLibrary";
import {
  getWorkspaceDayReadModel,
  getWorkspaceDayIdsForItem,
  getWorkspaceDayPersistenceErrorMessage,
  WORKSPACE_DAY_PERSISTENCE_ERROR_CODES,
} from "@/lib/workspaceDayStore";
import {
  WORKSPACE_DAY_CATEGORY_ORDER,
  getWorkspaceDayCategoryMeta,
  isWorkspaceDayCategory,
} from "@/config/workspaceDayCategories";

/**
 * Stage 2 UI for the "Workspace Day" feature. Read-only wiring on top of the
 * Stage 1 store — no scheduling, no auto-open, no auto-close. Obsidian export
 * (Stage 3) is manual only: a per-closed-day button that calls
 * exportWorkspaceDayToObsidian; never triggered automatically.
 *
 * The useWorkspaceDays() hook itself is called ONCE by the parent
 * (WorkspaceLibrary.jsx) and passed down here as props — not called again
 * internally. The Stage 1 store has no event bus, so two independent
 * useWorkspaceDays() instances (this component's own, and the one
 * WorkspaceLibrary.jsx needs for its "הוסף ליום העבודה" bulk-action button)
 * would each hold a stale copy of `days` the instant the OTHER one mutated it
 * — e.g. opening a day here would never be seen by the bulk-action bar's
 * `openDay` check. Lifting the single hook instance up removes that class of
 * bug entirely instead of patching each direction with ad-hoc reload calls.
 */

// A day open this many days or longer gets a non-blocking "close me" warning.
export const WORKSPACE_DAY_STALE_AGE_DAYS = 2;

function formatDayDate(dateKey) {
  if (!dateKey) return "";
  try {
    return format(new Date(`${dateKey}T00:00:00`), "EEEE, d בMMMM yyyy", { locale: he });
  } catch {
    return dateKey;
  }
}

function resolveMemberTitle(member, liveItem) {
  const source = liveItem || member?.contentSnapshot || null;
  return (
    source?.videoTitle
    || source?.title
    || source?.label
    || source?.name
    || `פריט ${member?.workspaceItemId ?? ""}`.trim()
  );
}

function driftLabel(member) {
  if (!member?.drifted) return null;
  if (member.driftReason === "item-missing") return "המקור נמחק מהספרייה";
  return "המקור השתנה מאז הצירוף";
}

export function WorkspaceDay({
  openDay,
  closedDays,
  reload,
  createDay,
  detachItem,
  closeDay,
  reopenDay,
  refreshMember,
  deleteDay,
}) {
  const { items } = useWorkspaceItems();

  // The Stage 1 store has no event bus. Re-read the days whenever the library
  // items change so an "attach to today" done from SaveToWorkspaceDialog (a
  // direct store call) shows up here without a page navigation.
  useEffect(() => {
    reload();
  }, [items, reload]);

  const [collapsed, setCollapsed] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDeleteDayId, setConfirmDeleteDayId] = useState(null);
  const [exportingDayId, setExportingDayId] = useState(null);
  const sectionRef = useRef(null);

  const liveItemsById = useMemo(
    () => Object.fromEntries((items || []).map((item) => [String(item.id), item])),
    [items],
  );

  const readModel = useMemo(
    () => (openDay ? getWorkspaceDayReadModel(openDay.id, { liveItemsById }) : null),
    [openDay, liveItemsById],
  );

  // Group the open day's members by the FIXED v1 category order; skip empty
  // categories. Duplicate-day count is computed ONCE per member here.
  const groups = useMemo(() => {
    if (!readModel?.ok) return [];
    const byCategory = new Map();
    for (const member of readModel.members) {
      const category = isWorkspaceDayCategory(member.category) ? member.category : "general";
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category).push({
        ...member,
        duplicateDayCount: getWorkspaceDayIdsForItem(member).length,
      });
    }
    return WORKSPACE_DAY_CATEGORY_ORDER
      .filter((category) => byCategory.has(category))
      .map((category) => ({
        category,
        meta: getWorkspaceDayCategoryMeta(category),
        members: byCategory.get(category),
      }));
  }, [readModel]);

  const ageInDays = readModel?.ok ? readModel.ageInDays : 0;
  const isStale = ageInDays >= WORKSPACE_DAY_STALE_AGE_DAYS;
  const memberCount = readModel?.ok ? readModel.members.length : 0;

  const scrollIntoView = () => {
    setCollapsed(false);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleOpenToday = () => {
    const result = createDay();
    if (!result.ok) {
      toast.error(getWorkspaceDayPersistenceErrorMessage(result));
      if (result.error?.code === WORKSPACE_DAY_PERSISTENCE_ERROR_CODES.OPEN_DAY_EXISTS) {
        scrollIntoView();
      }
      return;
    }
    toast.success("נפתח יום עבודה חדש");
    scrollIntoView();
  };

  const handleConfirmClose = () => {
    if (!openDay) return;
    const result = closeDay(openDay.id, { liveItemsById });
    if (!result.ok) {
      toast.error(getWorkspaceDayPersistenceErrorMessage(result));
      return;
    }
    toast.success("יום העבודה נסגר וכל הפריטים הוקפאו");
  };

  const handleDetach = (workspaceItemId) => {
    if (!openDay) return;
    const result = detachItem(openDay.id, workspaceItemId);
    if (!result.ok) {
      toast.error(getWorkspaceDayPersistenceErrorMessage(result));
      return;
    }
    toast.success("הפריט הוסר מהיום");
  };

  const handleRefreshMember = (workspaceItemId) => {
    if (!openDay) return;
    const liveItem = liveItemsById[String(workspaceItemId)] || null;
    if (!liveItem) {
      toast.error("הפריט לא קיים יותר בספרייה — לא ניתן לרענן. אפשר להסיר אותו מהיום.");
      return;
    }
    const result = refreshMember(openDay.id, workspaceItemId, { liveItem });
    if (!result.ok) {
      toast.error(getWorkspaceDayPersistenceErrorMessage(result));
      return;
    }
    toast.success("תצוגת הפריט עודכנה");
  };

  const handleReopen = (dayId) => {
    const result = reopenDay(dayId);
    if (!result.ok) {
      toast.error(getWorkspaceDayPersistenceErrorMessage(result));
      return;
    }
    toast.success("היום נפתח מחדש");
    scrollIntoView();
  };

  const handleExportDay = async (day) => {
    if (!day || exportingDayId) return;
    setExportingDayId(day.id);
    try {
      const result = await exportWorkspaceDayToObsidian(day);
      if (!result.ok) {
        toast.error(result.userMessage || "ייצוא היום ל-Obsidian נכשל");
        return;
      }
      toast.success("היום יוצא ל-Obsidian", {
        description: `נתיב: ${result.savedPath}${result.added ? ` · ${result.added} פריטים חדשים` : ""}`,
      });
    } catch (error) {
      toast.error("ייצוא היום ל-Obsidian נכשל");
    } finally {
      setExportingDayId(null);
    }
  };

  const handleConfirmDeleteDay = () => {
    if (!confirmDeleteDayId) return;
    const result = deleteDay(confirmDeleteDayId);
    if (!result.ok) {
      toast.error(getWorkspaceDayPersistenceErrorMessage(result));
      return;
    }
    toast.success("יום העבודה נמחק");
    setConfirmDeleteDayId(null);
  };

  const recentClosedDays = closedDays.slice(0, 5);

  return (
    <section
      ref={sectionRef}
      dir="rtl"
      aria-labelledby="workspace-day-heading"
      className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-indigo-500" />
          <h2 id="workspace-day-heading" className="text-base font-bold text-slate-900 dark:text-zinc-100">
            יום העבודה
          </h2>
          {openDay ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              פתוח · {memberCount} פריטים
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
              אין יום פתוח
            </span>
          )}
        </div>

        <div className="ms-auto flex items-center gap-2">
          {!openDay && (
            <button
              type="button"
              onClick={handleOpenToday}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <Plus className="h-3.5 w-3.5" />
              פתח יום
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={!collapsed}
            aria-controls="workspace-day-body"
            title={collapsed ? "הרחב" : "כווץ"}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div id="workspace-day-body" className="border-t border-slate-100 px-4 py-4 dark:border-zinc-800 sm:px-5">
          {openDay ? (
            <div className="space-y-4">
              {/* Open-day toolbar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-sm text-slate-600 dark:text-zinc-300">
                  <span className="font-semibold text-slate-800 dark:text-zinc-100">
                    {formatDayDate(openDay.dateKey)}
                  </span>
                  <span className="ms-2 text-xs text-slate-400 dark:text-zinc-500">
                    פתוח {ageInDays === 0 ? "מהיום" : <>כבר <bdi>{ageInDays}</bdi> ימים</>}
                  </span>
                </div>

                <div className="ms-auto flex flex-wrap items-center gap-2">
                  {isStale && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300">
                      <TriangleAlert className="h-3.5 w-3.5" />
                      היום פתוח כבר {ageInDays} ימים — כדאי לסגור אותו
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmClose(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    סגור יום
                  </button>
                </div>
              </div>

              {/* Members grouped by category */}
              {groups.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400 dark:border-zinc-700 dark:text-zinc-500">
                  אין עדיין פריטים ביום העבודה. בזמן שמירה ל-Workspace Library אפשר לסמן "צרף גם ליום העבודה של היום".
                </p>
              ) : (
                <div className="space-y-4">
                  {groups.map((group) => (
                    <div key={group.category} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-200">
                        <span aria-hidden="true">{group.meta.emoji}</span>
                        <span>{group.meta.label}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                          {group.members.length}
                        </span>
                      </div>
                      <ul className="space-y-1.5">
                        {group.members.map((member) => {
                          const liveItem = liveItemsById[String(member.workspaceItemId)] || null;
                          const title = resolveMemberTitle(member, liveItem);
                          const drift = driftLabel(member);
                          return (
                            <li
                              key={member.workspaceItemId}
                              className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/40"
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                <span dir="auto" className="truncate text-sm text-slate-800 dark:text-zinc-100" title={title}>
                                  {title}
                                </span>
                                {member.sourceUrl && (
                                  <a
                                    href={member.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="פתח את קישור המקור"
                                    title="פתח את קישור המקור"
                                    className="shrink-0 text-slate-400 transition-colors hover:text-indigo-600 dark:text-zinc-500 dark:hover:text-indigo-400"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </div>

                              {member.duplicateDayCount > 1 && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:border-violet-800/50 dark:bg-violet-950/30 dark:text-violet-300">
                                  <Layers className="h-3 w-3" />
                                  מופיע ב־<bdi>{member.duplicateDayCount}</bdi> ימים
                                </span>
                              )}

                              {drift && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300">
                                  <TriangleAlert className="h-3 w-3" />
                                  {drift}
                                </span>
                              )}

                              <div className="flex shrink-0 items-center gap-1">
                                {member.drifted && (
                                  <button
                                    type="button"
                                    onClick={() => handleRefreshMember(member.workspaceItemId)}
                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:text-zinc-400 dark:hover:bg-emerald-950/20 dark:hover:text-emerald-300"
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                    רענן
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDetach(member.workspaceItemId)}
                                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-950/20 dark:hover:text-red-400"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  הסר מהיום
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400 dark:border-zinc-700 dark:text-zinc-500">
              אין יום עבודה פתוח. לחיצה על "פתח יום" תפתח יום חדש לריכוז התכנים של היום.
            </p>
          )}

          {/* Closed days — compact, read-only */}
          {recentClosedDays.length > 0 && (
            <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 dark:border-zinc-800">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                ימים שנסגרו לאחרונה
              </h3>
              <ul className="space-y-1.5">
                {recentClosedDays.map((day) => {
                  const count = Array.isArray(day.members) ? day.members.length : 0;
                  return (
                    <li
                      key={day.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-slate-100 px-3 py-2 text-sm dark:border-zinc-800"
                    >
                      <span className="font-medium text-slate-700 dark:text-zinc-200">
                        {formatDayDate(day.dateKey)}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-zinc-500">{count} פריטים</span>
                      <div className="ms-auto flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleExportDay(day)}
                          disabled={exportingDayId === day.id}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-emerald-950/20 dark:hover:text-emerald-300"
                        >
                          <Upload className="h-3 w-3" />
                          {exportingDayId === day.id ? "מייצא…" : "ייצא ל-Obsidian"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReopen(day.id)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700 dark:text-zinc-400 dark:hover:bg-indigo-950/20 dark:hover:text-indigo-300"
                        >
                          <RotateCcw className="h-3 w-3" />
                          פתח מחדש
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteDayId(day.id)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-950/20 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                          מחק
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {closedDays.length > recentClosedDays.length && (
                <p className="text-[11px] text-slate-400 dark:text-zinc-600">
                  מוצגים {recentClosedDays.length} מתוך {closedDays.length} ימים שנסגרו
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="לסגור את יום העבודה?"
        description={`כל ${memberCount} הפריטים ביום יוקפאו (snapshot) ולא יתעדכנו יותר אוטומטית. תמיד אפשר לפתוח את היום מחדש.`}
        confirmLabel="סגור יום"
        onConfirm={handleConfirmClose}
      />

      <ConfirmDialog
        open={!!confirmDeleteDayId}
        onOpenChange={(open) => !open && setConfirmDeleteDayId(null)}
        title="למחוק את יום העבודה?"
        description="היום וכל רשומות הצירוף שלו יימחקו לצמיתות. הפריטים עצמם ב-Workspace Library לא יושפעו."
        confirmLabel="מחק יום"
        danger
        onConfirm={handleConfirmDeleteDay}
      />
    </section>
  );
}
