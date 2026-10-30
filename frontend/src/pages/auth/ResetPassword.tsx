import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ShieldCheck, ArrowRight, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { ClientApiError } from "@/types/api";

export const ResetPassword: React.FC = () => {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !otp.trim() || !newPassword) {
      setError("Please fill out all fields.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await resetPassword({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        newPassword,
      });
      navigate("/login", { replace: true });
    } catch (err: unknown) {
      if (err instanceof ClientApiError) {
        setError(err.message);
      } else {
        setError("Failed to reset password. Please check your OTP code.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 sm:py-12">
      <Card accent="neel" className="space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-paper text-neel shadow-xs mb-1">
            <ShieldCheck className="h-6 w-6 text-vermilion" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl">Set New Password</CardTitle>
          <CardDescription>
            Enter the 6-digit code received on your email along with your new password.
          </CardDescription>
        </div>

        {error && (
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="6-Digit Reset OTP"
            type="text"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            required
          />

          <Input
            label="New Password (min 8 chars)"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2"
            isLoading={loading}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            Update Password & Sign In
          </Button>
        </form>

        <div className="pt-2 text-center text-xs text-neel-muted border-t border-paper-border">
          <Link to="/login" className="inline-flex items-center gap-1 font-semibold text-neel hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
          </Link>
        </div>
      </Card>
    </div>
  );
};
