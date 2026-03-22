import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import SavedVideos from './pages/SavedVideos';
import LearningQueue from './pages/LearningQueue';
import TopicPage from './pages/TopicPage';
import TopicsPage from './pages/TopicsPage';
import LearningHub from './pages/LearningHub';
import TopicLearningPage from './pages/TopicLearningPage';
import MentorPage from './pages/MentorPage';

export const PAGES = {
    "Dashboard": Dashboard,
    "Admin": Admin,
    "SavedVideos": SavedVideos,
    "LearningQueue": LearningQueue,
    "TopicPage": TopicPage,
    "TopicsPage": TopicsPage,
    "LearningHub": LearningHub,
    "TopicLearningPage": TopicLearningPage,
    "MentorPage": MentorPage,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
};
