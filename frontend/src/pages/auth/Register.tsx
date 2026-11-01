import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus, ArrowRight, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Card, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { ClientApiError } from "@/types/api";
import { INDIAN_STATES } from "@/constants/indianStates";

export const Register: React.FC = () => {
  const { register } = useAuth();
  const { languages } = useLanguage();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    state: "Uttar Pradesh",
    city: "",
    preferredLanguage: "hi",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);

    try {
      await register({
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim() || undefined,
        state: formData.state,
        city: formData.city.trim() || undefined,
        preferredLanguage: formData.preferredLanguage,
      });

      // Navigate to OTP verification with user's email
      navigate(`/verify-otp?email=${encodeURIComponent(formData.email.trim().toLowerCase())}`);
    } catch (err: unknown) {
      if (err instanceof ClientApiError) {
        let msg = err.message;
        if (msg.includes("E11000") || msg.toLowerCase().includes("duplicate key")) {
          if (msg.toLowerCase().includes("email")) {
            msg = "An account with this email address already exists. Please sign in instead.";
          } else if (msg.toLowerCase().includes("username")) {
            msg = "This username is already taken. Please choose another username.";
          } else {
            msg = "An account with these details already exists. Please sign in instead.";
          }
        }
        setError(msg);
      } else {
        setError("Failed to complete registration. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-8 sm:py-12">
      <Card accent="vermilion" className="space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-paper text-neel shadow-xs mb-1">
            <UserPlus className="h-6 w-6 text-vermilion" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl">Citizen Registration</CardTitle>
          <CardDescription>
            Create your Lok-Setu citizen profile to receive tailored welfare scheme matches and regional notifications.
          </CardDescription>
        </div>

        {error && (
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="e.g. prakhar_g"
              required
            />
            <Input
              label="Email Address"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="name@domain.in"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Password (min 8 chars)"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
            <Input
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Mobile Number (Optional)"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+91 98765 43210"
            />
            <Select
              label="Primary Language"
              name="preferredLanguage"
              value={formData.preferredLanguage}
              onChange={handleChange}
              options={languages.map((l) => ({ value: l.code, label: `${l.nativeName} (${l.name})` }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="State / UT"
              name="state"
              value={formData.state}
              onChange={handleChange}
              options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
            />
            <Input
              label="City / District"
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder="e.g. Varanasi, Lucknow"
            />
          </div>

          <Button
            type="submit"
            variant="secondary"
            size="lg"
            className="w-full mt-2"
            isLoading={loading}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            Create Citizen Account & Verify
          </Button>
        </form>

        <CardContent className="pt-2 text-center text-xs text-neel-muted border-t border-paper-border">
          <p>
            Already registered?{" "}
            <Link to="/login" className="font-bold text-neel hover:underline">
              Sign In Here
            </Link>
          </p>
        </CardContent>

        <div className="flex items-center gap-2 p-3 bg-paper-light rounded border border-paper-border text-[11px] text-neel-muted">
          <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
          <span>A 6-digit verification OTP will be sent to verify your email address.</span>
        </div>
      </Card>
    </div>
  );
};

