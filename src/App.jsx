import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import { LEGACY_LAB_REDIRECTS } from '../shared/lab-registry.js';
import ScrollToTop from "./components/ScrollToTop";
import Layout from "./components/site/Layout";
import AdminLayout from "./pages/admin/AdminLayout";
import { LoadingState } from "./components/site/States";

const Home = lazy(() => import("./pages/Home"));
const Courses = lazy(() => import("./pages/Courses"));
const CourseDetail = lazy(() => import("./pages/CourseDetail"));
const Labs = lazy(() => import("./pages/Labs"));
const CvLabs = lazy(() => import("./pages/CvLabs"));
const LabDetail = lazy(() => import("./pages/LabDetail"));
const Works = lazy(() => import("./pages/Works"));
const WorkDetail = lazy(() => import("./pages/WorkDetail"));
const About = lazy(() => import("./pages/About"));
const Login = lazy(() => import("./pages/Login"));
const OpenSourceCredits = lazy(() => import("./pages/OpenSourceCredits"));
const PageNotFound = lazy(() => import("./lib/PageNotFound"));

const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminTeacher = lazy(() => import("./pages/admin/AdminTeacher"));
const AdminCourses = lazy(() => import("./pages/admin/AdminCourses"));
const AdminExperiments = lazy(() => import("./pages/admin/AdminExperiments"));
const AdminWorks = lazy(() => import("./pages/admin/AdminWorks"));
const AdminQuizzes = lazy(() => import("./pages/admin/AdminQuizzes"));
const AdminMedia = lazy(() => import("./pages/admin/AdminMedia"));

export default function App() {
  return <Router>
    <ScrollToTop />
    <Suspense fallback={<LoadingState />}> 
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:slug" element={<CourseDetail />} />
          <Route path="/labs" element={<Labs />} />
          <Route path="/labs/cv" element={<CvLabs />} />
          <Route path="/labs/cv/lenet-training" element={<Navigate replace to="/labs/cv/lenet" />} />
          <Route path="/labs/cv/:slug" element={<LabDetail />} />
          {Object.entries(LEGACY_LAB_REDIRECTS).map(([slug, to]) => <Route key={slug} path={`/labs/${slug}`} element={<Navigate replace to={to} />} />)}
          <Route path="/labs/:slug" element={<LabDetail />} />
          <Route path="/works" element={<Works />} />
          <Route path="/works/:slug" element={<WorkDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/credits" element={<OpenSourceCredits />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<Login />} />
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
  </Router>;
}
