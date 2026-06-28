import { useMemo, useState, useEffect, useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { queryClientInstance } from '@/lib/query-client';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { SaveToBrainModal } from '@/components/layout/SaveToBrainModal';
import { useMentors } from '@/hooks/useMentors';
import { useTopics } from '@/hooks/useTopics';
import { useCategories } from '@/hooks/useCategories';
import { useVideos } from '@/hooks/useVideos';
import { useTheme } from '@/hooks/useTheme';
import { PAGES } from './pages.config';
import { normalizeDashboardFilters } from '@/lib/topicFilters';
import { shouldAutoChannelScan, runChannelScan } from '@/services/channelScanService';

const DEFAULT_FILTERS = {
  search: "",
  mentor: "all",
  category: "all",
  topicId: "all",
  obsidianSaved: "all",
};

function AppLayout({ theme, toggleTheme, isDark }) {
  const [currentPage, setCurrentPage] = useState("Dashboard");
  const [pageParams, setPageParams] = useState({});
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [saveToBrainOpen, setSaveToBrainOpen] = useState(false);
  const [saveToBrainBrainId, setSaveToBrainBrainId] = useState("");
  const { data: mentors = [] } = useMentors();
  const { data: topics = [] } = useTopics();
  const { data: categories = [] } = useCategories();
  const { data: videos = [] } = useVideos();

  const autoSyncDone = useRef(false);
  useEffect(() => {
    if (!mentors.length || autoSyncDone.current) return;
    autoSyncDone.current = true;
    if (!shouldAutoChannelScan()) {
      console.info('[App] channelScan: ׳¡׳¨׳™׳§׳” ׳‘׳•׳¦׳¢׳” ׳‘׳₪׳—׳•׳× ׳-8 ׳©׳¢׳•׳× ג€” ׳׳“׳׳’');
      return;
    }
    runChannelScan(mentors, { reason: 'auto' }).catch((err) => {
      console.warn('[App] channelScan error:', err.message);
    });
  }, [mentors]);

  const PageComponent = PAGES[currentPage] || PAGES["Dashboard"];
  const normalizedDefaultFilters = useMemo(
    () => normalizeDashboardFilters(DEFAULT_FILTERS, topics),
    [topics]
  );

  const updateFilters = (nextFilters) => {
    setFilters((prev) => {
      const resolvedFilters =
        typeof nextFilters === "function" ? nextFilters(prev) : nextFilters;

      return normalizeDashboardFilters(resolvedFilters, topics);
    });
  };

  const navigateTo = (page, params = {}) => {
    setCurrentPage(page);
    setPageParams(params);
    if (page === "Dashboard") {
      updateFilters(normalizedDefaultFilters);
    }
  };

  const navigateWithFilter = (filterKey, filterValue) => {
    updateFilters({ ...DEFAULT_FILTERS, [filterKey]: filterValue });
    setCurrentPage("Dashboard");
    setPageParams({});
  };

  const savedCount = videos.filter((v) => v.isSaved).length;
  const learningCount = videos.filter(
    (v) => v.learningStatus && v.learningStatus !== "not_started"
  ).length;

  return (
    <div
      data-testid="app-layout"
      dir="rtl"
      className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 transition-colors dark:bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.16),_transparent_24%),linear-gradient(180deg,#0b0b0f_0%,#050505_100%)] dark:text-white"
    >
      <AppSidebar
        currentPage={currentPage}
        pageParams={pageParams}
        navigateTo={navigateTo}
        navigateWithFilter={navigateWithFilter}
        filters={filters}
        setFilters={updateFilters}
        mentors={mentors}
        topics={topics}
        videos={videos}
        categories={categories}
        savedCount={savedCount}
        learningCount={learningCount}
        theme={theme}
        isDark={isDark}
        toggleTheme={toggleTheme}
        onSaveToBrain={(brainId) => { setSaveToBrainBrainId(brainId || ""); setSaveToBrainOpen(true); }}
      />
      <main className="flex-1 overflow-y-auto bg-transparent">
        <PageComponent
          filters={filters}
          setFilters={updateFilters}
          topicId={pageParams.topicId}
          mentorId={pageParams.mentorId}
          navigateTo={navigateTo}
          pageParams={pageParams}
          isDark={isDark}
          toggleTheme={toggleTheme}
        />
      </main>

      <SaveToBrainModal
        open={saveToBrainOpen}
        onOpenChange={setSaveToBrainOpen}
        initialBrainId={saveToBrainBrainId}
      />
    </div>
  );
}

export default function App() {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <QueryClientProvider client={queryClientInstance}>
      <AppLayout theme={theme} toggleTheme={toggleTheme} isDark={isDark} />
      <Toaster position="bottom-center" theme={isDark ? "dark" : "light"} richColors />
    </QueryClientProvider>
  );
}
