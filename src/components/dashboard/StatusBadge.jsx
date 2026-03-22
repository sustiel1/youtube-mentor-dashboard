import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  new: {
    label: "חדש לצפייה",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  processing: {
    label: "מעבד סיכום",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  done: {
    label: "מוכן",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  error: {
    label: "שגיאה",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

export function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
