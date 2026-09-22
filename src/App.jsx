import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { lazy, Suspense } from 'react';

import Layout from '@/components/site/Layout';
import AdminLayout from '@/pages/admin/AdminLayout';

const Home = lazy(() => import('@/pages/Home'));
const Courses = lazy(() => import('@/pages/Courses'));
const Labs = lazy(() => import('@/pages/Labs'));
const LabDetail = lazy(() => import('@/pages/LabDetail'));
const Works = lazy(() => import('@/pages/Works'));
const WorkDetail = lazy(() => import('@/pages/WorkDetail'));
const About = lazy(() => import('@/pages/About'));
const DataAndCameraNotice = lazy(() => import('@/pages/DataAndCameraNotice'));
const OpenSourceCredits = lazy(() => import('@/pages/OpenSourceCredits'));

const AdminOverview = lazy(() => import('@/pages/admin/AdminOverview'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));
const AdminTeacher = lazy(() => import('@/pages/admin/AdminTeacher'));
const AdminCourses = lazy(() => import('@/pages/admin/AdminCourses'));
const AdminExperiments = lazy(() => import('@/pages/admin/AdminExperiments'));
const AdminWorks = lazy(() => import('@/pages/admin/AdminWorks'));
const AdminQuizzes = lazy(() => import('@/pages/admin/AdminQuizzes'));
const AdminMedia = lazy(() => import('@/pages/admin/AdminMedia'));

const PageFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/labs" element={<Labs />} />
          <Route path="/labs/:slug" element={<LabDetail />} />
          <Route path="/works" element={<Works />} />
          <Route path="/works/:slug" element={<WorkDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/data-notice" element={<DataAndCameraNotice />} />
          <Route path="/credits" element={<OpenSourceCredits />} />
        </Route>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="teacher" element={<AdminTeacher />} />
          <Route path="courses" element={<AdminCourses />} />
          <Route path="experiments" element={<AdminExperiments />} />
          <Route path="works" element={<AdminWorks />} />
          <Route path="quizzes" element={<AdminQuizzes />} />
          <Route path="media" element={<AdminMedia />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App