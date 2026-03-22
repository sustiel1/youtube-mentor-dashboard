import { cn } from "@/lib/utils";

const CATEGORY_CONFIG = {
  AI: {
    label: "AI",
    className: "bg-violet-100 text-violet-700",
  },
  Food: {
    label: "אוכל",
    className: "bg-orange-100 text-orange-700",
  },
  Markets: {
    label: "שוק ההון",
    className: "bg-cyan-100 text-cyan-700",
  },
};

export function CategoryBadge({ category }) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.AI;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
