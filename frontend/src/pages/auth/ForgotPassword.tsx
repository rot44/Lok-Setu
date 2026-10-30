import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, ArrowRight, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { ClientApiError } from "@/types/api";

export const ForgotPassword: React.FC = () => {
  const { forgotPassword } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your registered email address.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await forgotPassword(email.trim().toLowerCase());
      navigate(`/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err: unknown) {
      if (err instanceof ClientApiError) {
        setError(err.message);
      } else {
        setError("Failed to send reset code. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 sm:py-12">
      <Card accent="vermilion" className="space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-paper text-neel shadow-xs mb-1">
            <Lock className="h-6 w-6 text-vermilion" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl">Reset Password</CardTitle>
          <CardDescription>
            Enter your email to receive a 6-digit password reset code.
          </CardDescription>
        </div>

        {error && (
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Registered Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="citizen@domain.in"
            required
          />

          <Button
            type="submit"
            variant="secondary"
            size="lg"
            className="w-full mt-2"
            isLoading={loading}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            Send Password Reset Code
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
