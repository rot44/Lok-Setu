/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  User,
  UserProfile,
  LoginPayload,
  RegisterPayload,
  VerifyOtpPayload,
  ResetPasswordPayload,
  UpdateProfilePayload,
  AuthResponseData,
  RegisterResponseData,
} from "@/types/auth";
import { api } from "@/services/api";
import { ClientApiError } from "@/types/api";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  login: (payload: LoginPayload) => Promise<AuthResponseData>;
  register: (payload: RegisterPayload) => Promise<RegisterResponseData>;
  verifyOtp: (payload: VerifyOtpPayload) => Promise<AuthResponseData>;
  resendOtp: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (payload: ResetPasswordPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<UserProfile>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Checks current session from backend using HTTP-only cookies
  const checkAuthStatus = useCallback(async () => {
    try {
      const data = await api.get<{ user: User; profile: UserProfile | null }>("/auth/me");
      setUser(data.user);
      setProfile(data.profile || null);
    } catch (err: unknown) {
      if (err instanceof ClientApiError && err.statusCode === 401) {
        // Attempt token rotation if refresh token is available in cookies
        try {
          await api.post("/auth/refresh-token");
          const retryData = await api.get<{ user: User; profile: UserProfile | null }>("/auth/me");
          setUser(retryData.user);
          setProfile(retryData.profile || null);
        } catch {
          setUser(null);
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = async (payload: LoginPayload): Promise<AuthResponseData> => {
    setIsLoading(true);
    try {
      const data = await api.post<AuthResponseData>("/auth/login", payload);
      setUser(data.user);
      setProfile(data.profile || null);
      return data;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload): Promise<RegisterResponseData> => {
    setIsLoading(true);
    try {
      const data = await api.post<RegisterResponseData>("/auth/register", payload);
      return data;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (payload: VerifyOtpPayload): Promise<AuthResponseData> => {
    setIsLoading(true);
    try {
      const data = await api.post<AuthResponseData>("/auth/verify-otp", payload);
      setUser(data.user);
      setProfile(data.profile || null);
      return data;
    } finally {
      setIsLoading(false);
    }
  };

  const resendOtp = async (email: string): Promise<void> => {
    await api.post("/auth/resend-otp", { email });
  };

  const forgotPassword = async (email: string): Promise<void> => {
    await api.post("/auth/forgot-password", { email });
  };

  const resetPassword = async (payload: ResetPasswordPayload): Promise<void> => {
    await api.post("/auth/reset-password", payload);
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
      setProfile(null);
    }
  };

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const data = await api.get<UserProfile>("/profile");
      setProfile(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  const updateProfile = async (payload: UpdateProfilePayload): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const data = await api.put<UserProfile>("/profile", payload);
      setProfile(data);
      return data;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAuthenticated: Boolean(user && user.isVerified),
        isLoading,
        isInitialized,
        login,
        register,
        verifyOtp,
        resendOtp,
        forgotPassword,
        resetPassword,
        logout,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
