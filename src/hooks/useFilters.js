import { useState, useMemo } from "react";

const DEFAULT_FILTERS = {
  search: "",
  mentor: "all",
  category: "all",
};

export function useFilters(videos) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      // Search filter
      if (
        filters.search &&
        !video.title.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }

      // Mentor filter
      if (filters.mentor !== "all" && video.mentorId !== filters.mentor) {
        return false;
      }

      // Category filter
      if (filters.category !== "all" && video.category !== filters.category) {
        return false;
      }

      return true;
    });
  }, [videos, filters]);

  return { filters, setFilters, filteredVideos };
}
