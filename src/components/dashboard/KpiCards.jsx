import { Video, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const KPI_ITEMS = [
  {
    key: "totalNew",
    filterKey: "new",
    label: "סרטונים חדשים",
    tooltip: "סרטונים שהגיעו ועדיין לא עברו עיבוד",
    icon: Video,
    color: "text-emerald-500",
    activeRing: "ring-emerald-300 border-emerald-300",
  },
  {
    key: "summarized",
    filterKey: "summarized",
    label: "עברו סיכום",
    tooltip: "סרטונים שה-AI סיכם בהצלחה",
    icon: CheckCircle,
    color: "text-blue-500",
    activeRing: "ring-blue-300 border-blue-300",
  },
];

export function KpiCards({ stats, activeFilter, onFilterClick }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {KPI_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeFilter === item.filterKey;
        return (
          <button
            key={item.key}
            onClick={() => onFilterClick?.(item.filterKey)}
            title={item.tooltip}
            dir="rtl"
            className={cn(
              "rounded-2xl border border-slate-200 bg-white px-5 pt-5 pb-4 text-right shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-2xl",
              "transition-all duration-200 cursor-pointer",
              "hover:-translate-y-0.5 hover:shadow-md dark:hover:shadow-black/30",
              isActive && `ring-2 ${item.activeRing} bg-slate-50 dark:bg-zinc-900`
            )}
          >
            {/* Row: label (right) + large icon (left) */}
            <div className="flex items-center gap-3">
              {/* Text side */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-xs font-medium mb-2.5 leading-tight",
                  isActive ? "text-slate-700 dark:text-zinc-200" : "text-slate-500 dark:text-zinc-400"
                )}>
                  {item.label}
                </p>
                <p className="text-4xl font-bold leading-none text-slate-900 dark:text-white">
                  {stats[item.key] ?? 0}
                </p>
              </div>

              {/* Large icon */}
              <Icon
                className={cn("shrink-0 opacity-85", item.color)}
                style={{ width: 52, height: 52 }}
                strokeWidth={1.4}
              />
            </div>

            {isActive && (
              <p className="text-xs text-gray-400 mt-3 text-right">לחץ שוב לביטול</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
