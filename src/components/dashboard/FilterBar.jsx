import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FilterBar({ filters, onFiltersChange, mentors }) {
  const handleChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

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
          {mentors.map((mentor) => (
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
          <SelectItem value="AI">AI</SelectItem>
          <SelectItem value="Food">אוכל</SelectItem>
          <SelectItem value="Markets">שוק ההון</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
