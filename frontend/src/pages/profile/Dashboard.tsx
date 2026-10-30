import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  CheckCircle2,
  FileSearch,
  Compass,
  MessageSquare,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Building,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/api";
import { DashboardSummaryData } from "@/types/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, CardDescription, CardFooter } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";

export const Dashboard: React.FC = () => {
  const { user } = useAuth();

  const [dashboardData, setDashboardData] = useState<DashboardSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<DashboardSummaryData>("/profile/dashboard");
      setDashboardData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load dashboard metrics.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const metrics = dashboardData?.dashboardMetrics;
  const profile = dashboardData?.profile;
  const matchedSchemes = dashboardData?.matchedSchemes || [];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-paper-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-vermilion mb-1">
            <LayoutDashboard className="h-4 w-4" />
            <span>Citizen Governance Portal</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-4xl font-bold text-neel">
            Welcome, {user?.username || "Citizen"}
          </h1>
          <p className="text-sm text-neel-muted max-w-xl">
            Here is your live welfare scheme match overview and civic profile status based on verified government policies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/profile">
            <Button variant="outline" size="sm" leftIcon={<UserCheck className="h-4 w-4" />}>
              Edit Profile
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchDashboard}
            disabled={loading}
            leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Incomplete Profile Alert */}
      {!loading && profile && !metrics?.isProfileComplete && (
        <div className="bg-amber-50 border-2 border-mustard rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <span className="font-serif font-bold text-base text-amber-950 block">
              Complete Your Citizen Profile for 100% Accurate Matching
            </span>
            <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
              Fill in your age, locality, annual income bracket, and occupation to uncover all central and state welfare subsidies you may be eligible for.
            </p>
          </div>
          <Link to="/profile">
            <Button variant="secondary" size="sm" className="whitespace-nowrap">
              Complete Profile Now →
            </Button>
          </Link>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card accent="neel" className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-neel-muted">
            Eligible Schemes Found
          </span>
          {loading ? (
            <Skeleton className="h-10 w-24" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-3xl sm:text-4xl font-bold text-neel">
                {metrics?.matchedSchemesCount || 0}
              </span>
              <span className="text-xs font-semibold text-neel-muted">Policies Matched</span>
            </div>
          )}
          <p className="text-[11px] text-neel-muted pt-1">
            Grounded in {profile?.state || "All India"} state criteria.
          </p>
        </Card>

        <Card accent="vermilion" className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-neel-muted">
            Profile Status
          </span>
          {loading ? (
            <Skeleton className="h-10 w-32" />
          ) : (
            <div className="flex items-center gap-2 pt-1">
              {metrics?.isProfileComplete ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-100 text-emerald-800 text-sm font-bold">
                  <CheckCircle2 className="h-4 w-4" /> Complete
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-amber-100 text-amber-900 text-sm font-bold">
                  Basic Info Only
                </span>
              )}
            </div>
          )}
          <p className="text-[11px] text-neel-muted pt-1">
            Occupation: {profile?.occupation || "Not Specified"}
          </p>
        </Card>

        <Card accent="mustard" className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-neel-muted">
            Primary Language
          </span>
          {loading ? (
            <Skeleton className="h-10 w-20" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-2xl font-bold text-neel uppercase">
                {metrics?.primaryLanguage || "HI"}
              </span>
              <span className="text-xs text-neel-muted font-semibold">Active Explainer Audio</span>
            </div>
          )}
          <p className="text-[11px] text-neel-muted pt-1">
            Voice explainers will synthesize in this tongue.
          </p>
        </Card>
      </div>

      {/* Matched Schemes Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-paper-border pb-3">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-neel">
              Your Matched Welfare Policies
            </h2>
            <p className="text-xs text-neel-muted">
              Policies where you may be eligible based on current profile criteria.
            </p>
          </div>
          <Link to="/schemes">
            <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
              Browse All Schemes
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="p-6 bg-white border border-paper-border rounded-md space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : matchedSchemes.length === 0 ? (
          <EmptyState
            title="No Matched Schemes Yet"
            description="No active welfare policies match your current demographic criteria, or none have been ingested for your region yet. Try completing all profile fields or browse the full directory."
            action={
              <Link to="/schemes">
                <Button variant="outline" size="sm">
                  Explore All Schemes
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {matchedSchemes.map((scheme) => (
              <Card key={scheme._id} accent="neel" className="flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-neel-muted mb-2">
                    <span className="font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-paper-dark text-neel">
                      {scheme.jurisdictionLevel} • {scheme.applicableState}
                    </span>
                    <span className="text-[11px]">
                      Added {new Date(scheme.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <CardTitle className="text-lg mb-2">{scheme.title}</CardTitle>
                  <CardDescription className="flex items-center gap-1.5 text-xs">
                    <Building className="h-3.5 w-3.5 text-neel-muted shrink-0" />
                    <span>{scheme.issuingAuthority}</span>
                  </CardDescription>
                </div>

                <CardFooter className="pt-4">
                  <span className="text-xs capitalize font-medium text-neel-muted">
                    {scheme.documentType.replace("_", " ")}
                  </span>
                  {scheme.officialPortalUrl ? (
                    <a
                      href={scheme.officialPortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-vermilion hover:underline"
                    >
                      Official Portal <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <Link
                      to={`/schemes?id=${scheme._id}`}
                      className="text-xs font-semibold text-vermilion hover:underline"
                    >
                      View Details →
                    </Link>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick Services Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
        <Link to="/analyze" className="group">
          <Card className="hover:border-neel transition-colors p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded bg-paper group-hover:bg-neel group-hover:text-white transition-colors">
                <FileSearch className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-sm text-neel block">Analyze Notice</span>
                <span className="text-xs text-neel-muted">Upload an order or challan</span>
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/schemes" className="group">
          <Card className="hover:border-neel transition-colors p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded bg-paper group-hover:bg-neel group-hover:text-white transition-colors">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-sm text-neel block">Directory</span>
                <span className="text-xs text-neel-muted">Search 100+ policies</span>
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/assistant" className="group">
          <Card className="hover:border-neel transition-colors p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded bg-paper group-hover:bg-neel group-hover:text-white transition-colors">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-sm text-neel block">Civic Assistant</span>
                <span className="text-xs text-neel-muted">Ask eligibility questions</span>
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
};
