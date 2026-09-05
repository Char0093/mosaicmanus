import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import { useAuth } from "./_core/hooks/useAuth";
import ErrorBoundary from "./components/ErrorBoundary";
import KioskExperience from "./components/KioskExperience";
import LiveJoinPage from "./pages/LiveJoinPage";
import LoginLandingPage from "./pages/LoginLandingPage";
import MosaicDashboard from "./components/MosaicDashboard";
import RoadmapPage from "./pages/RoadmapPage";
import RoleLoginPage from "./pages/RoleLoginPage";
import StudentAnalytics from "./pages/StudentAnalytics";
import StudentDashboard from "./pages/StudentDashboard";
import TutorPerksPage from "./pages/TutorPerksPage";
import EducatorWorkspacePage from "./pages/EducatorWorkspacePage";
import CreateQuizPage from "./pages/CreateQuizPage";
import StudentQuizReview from "./pages/StudentQuizReview";
import QuizHubPage from "./pages/QuizHubPage";
import ClassDetailsPage from "./pages/ClassDetailsPage";
import { ThemeProvider } from "./contexts/ThemeContext";

function SessionRedirector() {
  const auth = useAuth();
  const [location, navigate] = useLocation();
  useEffect(() => {
    if (location !== "/" || auth.loading || !auth.user) return;
    const savedIntent = localStorage.getItem("mosaic-role-intent");
    const role = savedIntent === "teacher" || auth.user.role === "admin" || auth.user.role === "educator" ? "teacher" : "student";
    localStorage.removeItem("mosaic-role-intent");
    localStorage.removeItem("mosaic-role-intent-at");
    navigate(role === "teacher" ? "/teacher" : "/student");
  }, [auth.loading, auth.user, location, navigate]);
  return null;
}

function Router() {
  return <><SessionRedirector /><Switch>
    <Route path="/" component={LoginLandingPage} />
    <Route path="/teacher" component={MosaicDashboard} />
    <Route path="/educator" component={EducatorWorkspacePage} />
    <Route path="/teacher/quiz/create" component={CreateQuizPage} />
    <Route path="/teacher/quiz" component={QuizHubPage} />
    <Route path="/teacher/class" component={ClassDetailsPage} />
    <Route path="/login/educator"><RoleLoginPage role="educator" /></Route>
    <Route path="/login/tutor"><RoleLoginPage role="tutor" /></Route>
    <Route path="/login/student"><RoleLoginPage role="student" /></Route>
    <Route path="/tutor/perks" component={TutorPerksPage} />
    <Route path="/student" component={StudentDashboard} />
    <Route path="/student/analytics" component={StudentAnalytics} />
    <Route path="/student/review" component={StudentQuizReview} />
    <Route path="/student/quiz" component={QuizHubPage} />
    <Route path="/kiosk" component={KioskExperience} />
    <Route path="/join/:code" component={LiveJoinPage} />
    <Route path="/roadmap" component={RoadmapPage} />
    <Route component={LoginLandingPage} />
  </Switch></>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
