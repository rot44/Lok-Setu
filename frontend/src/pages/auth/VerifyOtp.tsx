import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { KeyRound, CheckCircle2, RotateCw, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { ClientApiError } from "@/types/api";

export const VerifyOtp: React.FC = () => {
  const { verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialEmail = searchParams.get("email") || "";
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(
    initialEmail ? `A 6-digit verification code was sent to ${initialEmail}.` : null
  );
  const [resendCooldown, setResendCooldown] = useState(30);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !otp.trim()) {
      setError("Please provide both email and the 6-digit OTP.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await verifyOtp({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
      });
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      if (err instanceof ClientApiError) {
        setError(err.message);
      } else {
        setError("Invalid or expired verification code. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim() || resendCooldown > 0) return;

    setResending(true);
    setError(null);
    try {
      await resendOtp(email.trim().toLowerCase());
      setInfoMessage(`A fresh verification OTP has been sent to ${email}.`);
      setResendCooldown(60);
    } catch (err: unknown) {
      if (err instanceof ClientApiError) {
        setError(err.message);
      } else {
        setError("Failed to resend OTP. Please try again.");
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 sm:py-12">
      <Card accent="mustard" className="space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-paper text-neel shadow-xs mb-1">
            <KeyRound className="h-6 w-6 text-mustard-dark" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl">Verify Email Address</CardTitle>
          <CardDescription>
            Enter the 6-digit verification code sent to your registered email to activate your account.
          </CardDescription>
        </div>

        {infoMessage && (
          <Alert variant="info" onDismiss={() => setInfoMessage(null)}>
            {infoMessage}
          </Alert>
        )}

        {error && (
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <Input
            label="Registered Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="citizen@domain.in"
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-neel">
              6-Digit OTP Code
            </label>
            <input
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              required
              className="w-full text-center tracking-[0.5em] text-2xl font-bold font-mono bg-paper-light text-neel rounded border border-paper-border py-3 focus:outline-none focus:ring-2 focus:ring-neel"
            />
            <p className="text-[11px] text-neel-muted text-center">
              The verification code is valid for 10 minutes.
            </p>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2"
            isLoading={loading}
            rightIcon={<CheckCircle2 className="h-4 w-4" />}
          >
            Verify & Proceed to Dashboard
          </Button>
        </form>

        <div className="flex items-center justify-between pt-2 border-t border-paper-border text-xs text-neel-muted">
          <Link to="/login" className="flex items-center gap-1 hover:text-neel font-semibold">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
          </Link>

          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || resending}
            className="flex items-center gap-1 font-semibold text-vermilion hover:underline disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <RotateCw className={`h-3 w-3 ${resending ? "animate-spin" : ""}`} />
            {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : "Resend Code"}
          </button>
        </div>
      </Card>
    </div>
  );
};
