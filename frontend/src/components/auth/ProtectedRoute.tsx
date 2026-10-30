import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader } from "@/components/ui/Loader";

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isInitialized, isLoading } = useAuth();
  const location = useLocation();

  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8">
        <Loader size="lg" text="Verifying citizen credentials..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
