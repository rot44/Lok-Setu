import React from "react";
import { RouterProvider } from "react-router-dom";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { LanguageProvider } from "@/context/LanguageContext";
import { AuthProvider } from "@/context/AuthContext";
import { AudioProvider } from "@/context/AudioContext";
import { router } from "@/router";

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <AudioProvider>
            <RouterProvider router={router} />
          </AudioProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
};
