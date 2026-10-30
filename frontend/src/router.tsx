import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Home } from "@/pages/Home";
import { ExploreSchemes } from "@/pages/ExploreSchemes";
import { AnalyzeDocument } from "@/pages/AnalyzeDocument";
import { CivicAssistant } from "@/pages/CivicAssistant";
import { NotificationsFeed } from "@/pages/NotificationsFeed";
import { NotFound } from "@/pages/NotFound";

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
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);
