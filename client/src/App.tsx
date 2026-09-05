import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import KioskExperience from "./components/KioskExperience";
import MosaicDashboard from "./components/MosaicDashboard";
import EducatorWorkspacePage from "./pages/EducatorWorkspacePage";
import LiveJoinPage from "./pages/LiveJoinPage";
import RoadmapPage from "./pages/RoadmapPage";
import RoleLoginPage from "./pages/RoleLoginPage";
import StudentAnalytics from "./pages/StudentAnalytics";
import StudentDashboard from "./pages/StudentDashboard";
import TutorPerksPage from "./pages/TutorPerksPage";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return <Switch>
    <Route path="/" component={MosaicDashboard} />
    <Route path="/teacher" component={MosaicDashboard} />
    <Route path="/educator" component={EducatorWorkspacePage} />
    <Route path="/login/educator"><RoleLoginPage role="educator" /></Route>
    <Route path="/login/tutor"><RoleLoginPage role="tutor" /></Route>
    <Route path="/login/student"><RoleLoginPage role="student" /></Route>
    <Route path="/tutor/perks" component={TutorPerksPage} />
    <Route path="/student" component={StudentDashboard} />
    <Route path="/student/analytics" component={StudentAnalytics} />
    <Route path="/kiosk" component={KioskExperience} />
    <Route path="/join/:code" component={LiveJoinPage} />
    <Route path="/roadmap" component={RoadmapPage} />
    <Route component={MosaicDashboard} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
