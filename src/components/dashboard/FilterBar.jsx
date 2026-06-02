import { useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  filterMentorsByTopicFamily,
  getEffectiveMainTopicId,
  getOrderedMainTopics,
} from "@/lib/topicFilters";
import { OBSIDIAN_SAVED_FILTER_OPTIONS } from "@/lib/obsidianSavedStatus";

export function FilterBar({ filters, onFiltersChange, mentors, topics = [], compact = false }) {
  const handleChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const mainTopics = useMemo(() => getOrderedMainTopics(topics), [topics]);

  const selectedMainTopicId = useMemo(
    () => getEffectiveMainTopicId(filters, topics),
    [filters, topics]
  );

  const categoryOptions = useMemo(
    () => mainTopics.map((topic) => ({ label: topic.name, value: topic.id })),
    [mainTopics]
  );

  const visibleMentors = useMemo(
    () => filterMentorsByTopicFamily(mentors, selectedMainTopicId, topics),
    [selectedMainTopicId, mentors, topics]
  );

  useEffect(() => {
    if (filters.mentor === "all") return;

    const selectedMentorStillVisible = visibleMentors.some(
      (mentor) => mentor.id === filters.mentor
    );

    if (!selectedMentorStillVisible) {
      onFiltersChange({ ...filters, mentor: "all" });
    }
  }, [filters, onFiltersChange, visibleMentors]);

  return (
    <div
      dir="rtl"
      className={compact ? "flex items-center gap-2 flex-nowrap flex-row" : "flex flex-wrap items-center gap-3 mb-6"}
    >
      {/* Search (right edge in RTL row when compact) */}
      <div className={compact ? "relative w-[180px] shrink-0" : "relative flex-1 min-w-[200px]"}>
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
        <Input
          placeholder="חיפוש לפי כותרת..."
          value={filters.search}
          onChange={(e) => handleChange("search", e.target.value)}
          className="border-slate-200 bg-white pr-9 text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
        />
      </div>

      <Select
        value={filters.mentor}
        onValueChange={(val) => handleChange("mentor", val)}
      >
        <SelectTrigger className={(compact ? "w-[150px]" : "w-[160px]") + " border-slate-200 bg-white text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"}>
          <SelectValue placeholder="כל המנטורים" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל המנטורים</SelectItem>
          {visibleMentors.map((mentor) => (
            <SelectItem key={mentor.id} value={mentor.id}>
              {mentor.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedMainTopicId}
        onValueChange={(val) =>
          onFiltersChange({ ...filters, category: val, topicId: "all" })
        }
      >
        <SelectTrigger className={(compact ? "w-[150px]" : "w-[140px]") + " border-slate-200 bg-white text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"}>
          <SelectValue placeholder="כל הקטגוריות" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל הקטגוריות</SelectItem>
          {categoryOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.obsidianSaved || "all"}
        onValueChange={(val) => handleChange("obsidianSaved", val)}
      >
        <SelectTrigger
          className={
            (compact ? "w-[150px]" : "w-[160px]") +
            " border-slate-200 bg-white text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
          }
        >
          <SelectValue placeholder="כל הסרטונים" />
        </SelectTrigger>
        <SelectContent>
          {OBSIDIAN_SAVED_FILTER_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
