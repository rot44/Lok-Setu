import React from "react";
import { RouterProvider } from "react-router-dom";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { LanguageProvider } from "@/context/LanguageContext";
import { router } from "@/router";

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <RouterProvider router={router} />
      </LanguageProvider>
    </ErrorBoundary>
  );
};
