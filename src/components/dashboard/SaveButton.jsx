import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

export function SaveButton({ isSaved, onClick, size = "sm" }) {
  const handleClick = (e) => {
    e.stopPropagation();
    onClick?.();
  };

  const sizeClasses = size === "sm" ? "p-1.5" : "p-2";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <button
      onClick={handleClick}
      className={cn(
        "rounded-md transition-colors",
        sizeClasses,
        isSaved
          ? "text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
          : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
      )}
      title={isSaved ? "הסר משמורים" : "שמור"}
    >
      <Bookmark
        className={cn(iconSize, isSaved && "fill-current")}
      />
    </button>
  );
}
