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

export function FilterBar({ filters, onFiltersChange, mentors, topics = [] }) {
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
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="חיפוש לפי כותרת..."
          value={filters.search}
          onChange={(e) => handleChange("search", e.target.value)}
          className="pr-9 bg-white"
        />
      </div>

      <Select
        value={filters.mentor}
        onValueChange={(val) => handleChange("mentor", val)}
      >
        <SelectTrigger className="w-[160px] bg-white">
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
        <SelectTrigger className="w-[140px] bg-white">
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
    </div>
  );
}
