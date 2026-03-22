import { Video, CheckCircle, Loader2, ShieldAlert } from "lucide-react";
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
  {
    key: "processing",
    filterKey: "processing",
    label: "בתהליך",
    tooltip: "סרטונים שנמצאים כרגע בעיבוד",
    icon: Loader2,
    color: "text-cyan-500",
    activeRing: "ring-cyan-300 border-cyan-300",
  },
  {
    key: "errors",
    filterKey: "errors",
    label: "שגיאות",
    tooltip: "סרטונים שנכשלו בעיבוד — לחץ לפרטים",
    icon: ShieldAlert,
    color: "text-red-500",
    activeRing: "ring-red-300 border-red-300",
  },
];

export function KpiCards({ stats, activeFilter, onFilterClick }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
              "bg-white rounded-2xl border border-gray-100 px-5 pt-5 pb-4 shadow-sm text-right",
              "transition-all duration-200 cursor-pointer",
              "hover:shadow-md hover:-translate-y-0.5",
              isActive && `ring-2 ${item.activeRing} bg-gray-50/50`
            )}
          >
            {/* Row: label (right) + large icon (left) */}
            <div className="flex items-center gap-3">
              {/* Text side */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-xs font-medium mb-2.5 leading-tight",
                  isActive ? "text-gray-700" : "text-gray-400"
                )}>
                  {item.label}
                </p>
                <p className="text-4xl font-bold text-gray-900 leading-none">
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
