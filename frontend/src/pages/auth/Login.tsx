import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { LogIn, Eye, EyeOff, ShieldCheck, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Card, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { ClientApiError } from "@/types/api";

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError("Please enter your email or username and password.");
      return;
    }

    setLoading(true);
    setError(null);

    const isEmail = identifier.includes("@");
    const payload = isEmail
      ? { email: identifier.trim().toLowerCase(), password }
      : { username: identifier.trim().toLowerCase(), password };

    try {
      await login(payload);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err instanceof ClientApiError) {
        if (err.statusCode === 403 && isEmail) {
          // Unverified email: navigate to OTP verification
          navigate(`/verify-otp?email=${encodeURIComponent(identifier.trim().toLowerCase())}`);
          return;
        }
        setError(err.message);
      } else {
        setError("An unexpected authentication error occurred. Please try again.");
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
            <LogIn className="h-6 w-6 text-vermilion" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl">Citizen Sign In</CardTitle>
          <CardDescription>
            Access your personalized welfare dashboard, saved notice analyses, and scheme eligibility tracker.
          </CardDescription>
        </div>

        {error && (
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email or Username"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="e.g. rajesh.kumar or citizen@domain.in"
            autoComplete="username"
            required
          />

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neel">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-vermilion hover:underline"
              >
                Forgot Password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                className="w-full bg-white text-neel text-sm rounded border border-paper-border px-3.5 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-neel"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neel-muted hover:text-neel p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2"
            isLoading={loading}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            Sign In to Lok-Setu
          </Button>
        </form>

        <CardContent className="pt-2 text-center text-xs text-neel-muted border-t border-paper-border">
          <p>
            Don't have an account yet?{" "}
            <Link to="/register" className="font-bold text-vermilion hover:underline">
              Register as Citizen
            </Link>
          </p>
        </CardContent>

        <div className="flex items-center gap-2 p-3 bg-paper-light rounded border border-paper-border text-[11px] text-neel-muted">
          <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
          <span>Encrypted with HTTP-Only authentication cookies & zero credential sharing.</span>
        </div>
      </Card>
    </div>
  );
};
