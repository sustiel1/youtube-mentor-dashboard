import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { queryClientInstance } from '@/lib/query-client';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { useMentors } from '@/hooks/useMentors';
import { useTopics } from '@/hooks/useTopics';
import { useCategories } from '@/hooks/useCategories';
import { useVideos } from '@/hooks/useVideos';
import { PAGES } from './pages.config';

const DEFAULT_FILTERS = { search: "", mentor: "all", category: "all" };

function AppLayout() {
  const [currentPage, setCurrentPage] = useState("Dashboard");
  const [pageParams, setPageParams] = useState({});
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const { data: mentors = [] } = useMentors();
  const { data: topics = [] } = useTopics();
  const { data: categories = [] } = useCategories();
  const { data: videos = [] } = useVideos();

  const PageComponent = PAGES[currentPage] || PAGES["Dashboard"];

  // Navigate to a page, optionally with params
  const navigateTo = (page, params = {}) => {
    setCurrentPage(page);
    setPageParams(params);
    // Reset filters when navigating to Dashboard
    if (page === "Dashboard") {
      setFilters(DEFAULT_FILTERS);
    }
  };

  // Navigate to Dashboard with a specific filter
  const navigateWithFilter = (filterKey, filterValue) => {
    setFilters({ ...DEFAULT_FILTERS, [filterKey]: filterValue });
    setCurrentPage("Dashboard");
    setPageParams({});
  };

  // Counts for sidebar badges
  const savedCount = videos.filter((v) => v.isSaved).length;
  const learningCount = videos.filter(
    (v) => v.learningStatus && v.learningStatus !== "not_started"
  ).length;

  return (
    <div dir="rtl" className="flex h-screen overflow-hidden bg-[#F8F9FB]">
      <AppSidebar
        currentPage={currentPage}
        pageParams={pageParams}
        navigateTo={navigateTo}
        navigateWithFilter={navigateWithFilter}
        filters={filters}
        setFilters={setFilters}
        mentors={mentors}
        topics={topics}
        categories={categories}
        savedCount={savedCount}
        learningCount={learningCount}
      />
      <main className="flex-1 overflow-y-auto">
        <PageComponent
          filters={filters}
          setFilters={setFilters}
          topicId={pageParams.topicId}
          mentorId={pageParams.mentorId}
          navigateTo={navigateTo}
          pageParams={pageParams}
        />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <AppLayout />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
