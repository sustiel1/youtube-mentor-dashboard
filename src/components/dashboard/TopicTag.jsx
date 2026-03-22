import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTopicConfig } from "@/config/topicConfig";

// TopicTag — chip אחיד לכל נושא לפי topicConfig.js
// Props: topic (object with id + name), onRemove (optional callback), size ("sm" | "md")
export function TopicTag({ topic, onRemove, size = "sm" }) {
  const config = getTopicConfig(topic.id);

  return (
    <span
      dir="rtl"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        config.bg,
        config.text,
        config.border,
        size === "md"
          ? "px-3 py-1 text-sm"
          : "px-2.5 py-0.5 text-xs"
      )}
    >
      <span className="leading-none">{config.emoji}</span>
      <span>{topic.name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(topic.id);
          }}
          className="hover:opacity-60 transition-opacity -mr-0.5"
          aria-label="הסר נושא"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}
