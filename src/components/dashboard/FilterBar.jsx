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

const CATEGORY_ALIASES = {
  Markets: ["שוק ההון", "markets", "מסחר", "השקעות"],
  AI: ["ai", "בינה מלאכותית", "machine learning"],
  Dev: ["פיתוח", "dev", "programming"],
  Food: ["אוכל", "אוכל ובישול", "food"],
};

function categoryMatchesTopic(mentorCategory, topicName) {
  if (!mentorCategory || !topicName) return false;

  const cat = mentorCategory.toLowerCase();
  const name = topicName.toLowerCase();

  if (cat === name || name.includes(cat) || cat.includes(name)) return true;

  const aliases = CATEGORY_ALIASES[mentorCategory] || [];
  return aliases.some((alias) => {
    const normalizedAlias = alias.toLowerCase();
    return name.includes(normalizedAlias) || normalizedAlias.includes(name);
  });
}

function getMentorsForTopic(mainTopicId, allTopics, allMentors) {
  const mainTopic = allTopics.find((topic) => topic.id === mainTopicId);
  const relevantIds = new Set([mainTopicId]);

  allTopics.forEach((topic) => {
    if (topic.parentId === mainTopicId) relevantIds.add(topic.id);
  });

  return allMentors.filter((mentor) => {
    if (!mentor.active) return false;
    if (mentor.topicIds?.some((topicId) => relevantIds.has(topicId))) return true;
    return mainTopic ? categoryMatchesTopic(mentor.category, mainTopic.name) : false;
  });
}

function getCategoryValueForTopic(topic, allTopics, allMentors) {
  const topicMentors = getMentorsForTopic(topic.id, allTopics, allMentors);
  if (topicMentors.length > 0) return topicMentors[0].category;

  return Object.keys(CATEGORY_ALIASES).find((categoryCode) =>
    categoryMatchesTopic(categoryCode, topic.name)
  ) || "all";
}

export function FilterBar({ filters, onFiltersChange, mentors, topics = [] }) {
  const handleChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const mainTopics = useMemo(
    () => topics.filter((topic) => topic.isMainCategory || !topic.parentId),
    [topics]
  );

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Map(
          mainTopics.map((topic) => {
            const value = getCategoryValueForTopic(topic, topics, mentors);
            return [value, { label: topic.name, value }];
          })
        ).values()
      ),
    [mainTopics, topics, mentors]
  );

  const visibleMentors = useMemo(() => {
    if (filters.category === "all") return mentors;

    const matchingTopic = mainTopics.find(
      (topic) => getCategoryValueForTopic(topic, topics, mentors) === filters.category
    );

    if (!matchingTopic) {
      return mentors.filter((mentor) => mentor.category === filters.category);
    }

    return getMentorsForTopic(matchingTopic.id, topics, mentors);
  }, [filters.category, mainTopics, mentors, topics]);

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
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="חיפוש לפי כותרת..."
          value={filters.search}
          onChange={(e) => handleChange("search", e.target.value)}
          className="pr-9 bg-white"
        />
      </div>

      {/* Mentor Filter */}
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

      {/* Category Filter */}
      <Select
        value={filters.category}
        onValueChange={(val) => handleChange("category", val)}
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
