import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Home } from "@/pages/Home";
import { ExploreSchemes } from "@/pages/ExploreSchemes";
import { SchemeDetailPage } from "@/pages/SchemeDetail";
import { AnalyzeDocument } from "@/pages/AnalyzeDocument";
import { CivicAssistant } from "@/pages/CivicAssistant";
import { NotificationsFeed } from "@/pages/NotificationsFeed";
import { NotFound } from "@/pages/NotFound";
import { Login } from "@/pages/auth/Login";
import { Register } from "@/pages/auth/Register";
import { VerifyOtp } from "@/pages/auth/VerifyOtp";
import { ForgotPassword } from "@/pages/auth/ForgotPassword";
import { ResetPassword } from "@/pages/auth/ResetPassword";
import { Dashboard } from "@/pages/profile/Dashboard";
import { Profile } from "@/pages/profile/Profile";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "schemes",
        element: <ExploreSchemes />,
      },
      {
        path: "schemes/:id",
        element: <SchemeDetailPage />,
      },
      {
        path: "analyze",
        element: <AnalyzeDocument />,
      },
      {
        path: "assistant",
        element: <CivicAssistant />,
      },
      {
        path: "notifications",
        element: <NotificationsFeed />,
      },
      {
        path: "login",
        element: <Login />,
      },
      {
        path: "register",
        element: <Register />,
      },
      {
        path: "verify-otp",
        element: <VerifyOtp />,
      },
      {
        path: "forgot-password",
        element: <ForgotPassword />,
      },
      {
        path: "reset-password",
        element: <ResetPassword />,
      },
      {
        path: "dashboard",
        element: (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "profile",
        element: (
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        ),
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);
