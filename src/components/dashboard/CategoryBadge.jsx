import { cn } from "@/lib/utils";
import { getTopicByCategory, DEFAULT_TOPIC_CONFIG } from "@/config/topicConfig";

export function CategoryBadge({ category }) {
  const cfg = getTopicByCategory(category) || DEFAULT_TOPIC_CONFIG;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        cfg.bg,
        cfg.text
      )}
    >
      {cfg.label}
    </span>
  );
}
