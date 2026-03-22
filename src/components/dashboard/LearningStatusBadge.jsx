import { cn } from "@/lib/utils";

const LEARNING_STATUS_CONFIG = {
  not_started: {
    label: "טרם התחיל",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
  in_progress: {
    label: "בתהליך למידה",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  learned: {
    label: "נלמד",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  to_review: {
    label: "לחזרה",
    className: "bg-purple-50 text-purple-700 border-purple-200",
  },
  completed: {
    label: "הושלם",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
};

export const LEARNING_STATUSES = Object.entries(LEARNING_STATUS_CONFIG).map(
  ([value, { label }]) => ({ value, label })
);

export function LearningStatusBadge({ status }) {
  const config = LEARNING_STATUS_CONFIG[status];
  if (!config || status === "not_started") return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
