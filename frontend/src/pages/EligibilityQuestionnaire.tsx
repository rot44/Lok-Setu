import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RotateCcw,
  Sparkles,
  UserCheck,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { INDIAN_STATES } from "@/constants/indianStates";
import {
  eligibilityService,
} from "@/services/eligibility.service";
import {
  CitizenDemographicInput,
  MatchAllResponseData,
  MatchedScheme,
} from "@/types/eligibility";

export const EligibilityQuestionnaire: React.FC = () => {
  const { t } = useLanguage();
  const { profile, isAuthenticated, isInitialized } = useAuth();

  // Form State
  const [formData, setFormData] = useState<CitizenDemographicInput>({
    state: "ALL",
    age: "",
    gender: "all",
    occupation: "all",
    caste: "all",
    isSpeciallyAbled: false,
    disabilityPercentage: 40,
    rationCardType: "none",
  });

  const [hasPrefilled, setHasPrefilled] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Execution State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MatchAllResponseData | null>(null);
  const [hasEvaluated, setHasEvaluated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"eligible" | "partial">("eligible");

  // Helper to safely normalize and map citizen profile options
  const normOccupation = (occ?: string | null) => {
    if (!occ) return "all";
    const lower = occ.toLowerCase().trim();
    if (lower === "shopkeeper_msme" || lower === "business" || lower === "self_employed") return "msme";
    return lower;
  };

  const normRationCard = (type?: string | null) => {
    if (!type) return "none";
    const lower = type.toLowerCase().trim();
    if (lower === "aay_antyodaya" || lower === "antyodaya") return "aay_antyodaya";
    return lower;
  };

  // Pre-fill from citizen profile when available
  useEffect(() => {
    if (isInitialized && isAuthenticated && profile && !hasPrefilled) {
      setFormData({
        state: profile.state || "ALL",
        age: profile.age ? String(profile.age) : "",
        gender: profile.gender ? profile.gender.toLowerCase() : "all",
        occupation: normOccupation(profile.occupation),
        caste: profile.caste ? profile.caste.toLowerCase() : "all",
        isSpeciallyAbled: Boolean(profile.isSpeciallyAbled),
        disabilityPercentage: profile.disabilityPercentage || 40,
        rationCardType: normRationCard(profile.rationCardType),
      });
      setHasPrefilled(true);
    }
  }, [isInitialized, isAuthenticated, profile, hasPrefilled]);

  const handleChange = (field: keyof CitizenDemographicInput, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setValidationError(null);
  };

  const handleEvaluate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setValidationError(null);
    setError(null);

    // Validation: Require at least state, age, or gender as mandated by backend
    const hasState = Boolean(formData.state && formData.state.trim().length > 0);
    const hasAge = Boolean(formData.age && !isNaN(Number(formData.age)) && Number(formData.age) > 0);
    const hasGender = Boolean(formData.gender && formData.gender !== "all");

    if (!hasState && !hasAge && !hasGender) {
      setValidationError("Please provide at least your State, Age, or Gender to evaluate eligibility.");
      return;
    }

    if (formData.age && (Number(formData.age) < 1 || Number(formData.age) > 120)) {
      setValidationError("Please enter a valid age between 1 and 120 years.");
      return;
    }

    setIsLoading(true);

    try {
      const payload: CitizenDemographicInput = {
        state: formData.state === "ALL" ? "all" : formData.state,
        age: formData.age ? Number(formData.age) : undefined,
        gender: formData.gender || "all",
        occupation: formData.occupation || "all",
        caste: formData.caste || "all",
        isSpeciallyAbled: Boolean(formData.isSpeciallyAbled),
        rationCardType: formData.rationCardType || "none",
      };

      const data = await eligibilityService.matchAllSchemes(payload);
      setResults(data);
      setHasEvaluated(true);
      // Default to eligible tab if matches exist, otherwise to partial
      if (data.totalEligible > 0) {
        setActiveTab("eligible");
      } else if (data.totalPartiallyEligible > 0) {
        setActiveTab("partial");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to evaluate scheme eligibility.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      state: "ALL",
      age: "",
      gender: "all",
      occupation: "all",
      caste: "all",
      isSpeciallyAbled: false,
      disabilityPercentage: 40,
      rationCardType: "none",
    });
    setHasEvaluated(false);
    setResults(null);
    setValidationError(null);
    setError(null);
  };

  const stateOptions = [
    { value: "ALL", label: "All India / Central Jurisdiction" },
    ...INDIAN_STATES.map((s) => ({ value: s, label: s })),
  ];

  const genderOptions = [
    { value: "all", label: "All Genders / Not Specified" },
    { value: "female", label: "Female (महिला)" },
    { value: "male", label: "Male (पुरुष)" },
    { value: "transgender", label: "Transgender (तृतीय लिंग)" },
  ];

  const occupationOptions = [
    { value: "all", label: "All Occupations / Any" },
    { value: "farmer", label: "Farmer / Agriculture (किसान)" },
    { value: "student", label: "Student / Youth (विद्यार्थी)" },
    { value: "street_vendor", label: "Street Vendor / Hawker (रेहड़ी-पटरी विक्रेता)" },
    { value: "msme", label: "MSME / Small Business / Shopkeeper (लघु उद्यमी / व्यापारी)" },
    { value: "artisan_craftsperson", label: "Artisan / Craftsperson (शिल्पकार / कारीगर)" },
    { value: "unemployed", label: "Unemployed / Job Seeker (बेरोज़गार)" },
    { value: "other", label: "Other / General Citizen (अन्य)" },
  ];

  const casteOptions = [
    { value: "all", label: "All Categories / Any" },
    { value: "general", label: "General (सामान्य)" },
    { value: "ews", label: "EWS (Economically Weaker Section / आर्थिक रूप से कमजोर)" },
    { value: "obc", label: "OBC (अन्य पिछड़ा वर्ग)" },
    { value: "sc", label: "SC (अनुसूचित जाति)" },
    { value: "st", label: "ST (अनुसूचित जनजाति)" },
  ];

  const rationCardOptions = [
    { value: "none", label: "None / Not Applicable" },
    { value: "bpl", label: "BPL Card (Below Poverty Line / गरीबी रेखा से नीचे)" },
    { value: "aay_antyodaya", label: "Antyodaya (AAY / अंत्योदय अन्न योजना)" },
    { value: "apl", label: "APL Card (Above Poverty Line)" },
    { value: "annapurna", label: "Annapurna Food Scheme Card" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b border-paper-border pb-5 space-y-2 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-vermilion">
          <UserCheck className="h-4 w-4" />
          <span>Interactive Scheme Matching</span>
        </div>
        <h1 className="font-serif text-2xl sm:text-4xl font-bold text-neel">
          {t("home.card1.title") || "Scheme Eligibility Check"}
        </h1>
        <p className="text-sm text-neel-muted max-w-2xl leading-relaxed">
          Answer a few quick demographic questions to find government welfare policies, grants, and subsidies you may qualify for.
        </p>
      </div>

      {/* Profile Prefill Notice */}
      {hasPrefilled && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-sage/30 border border-sage text-xs text-neel">
          <ShieldCheck className="h-4 w-4 text-sage-dark shrink-0" />
          <span>
            Demographics pre-filled from your registered citizen profile. You may revise any field below to test eligibility across different criteria.
          </span>
        </div>
      )}

      {/* Main Questionnaire Card */}
      <Card accent="neel" className="space-y-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <CardTitle>Citizen Demographic Questionnaire</CardTitle>
              <CardDescription>
                Criteria marked <span className="text-vermilion font-bold">*</span> are recommended for accurate state and age-bracket matching.
              </CardDescription>
            </div>
            {hasEvaluated && (
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Reset Answers
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleEvaluate} className="space-y-6">
            {/* Step 1: Core Required Attributes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select
                label="State / Union Territory *"
                value={formData.state}
                onChange={(e) => handleChange("state", e.target.value)}
                options={stateOptions}
                helperText="Select your resident state or All India"
              />

              <Input
                label="Age (in years) *"
                type="number"
                min={1}
                max={120}
                placeholder="e.g. 28"
                value={formData.age}
                onChange={(e) => handleChange("age", e.target.value)}
                helperText="Required for age-bracket criteria"
              />

              <Select
                label="Gender *"
                value={formData.gender}
                onChange={(e) => handleChange("gender", e.target.value)}
                options={genderOptions}
                helperText="Select applicable gender group"
              />
            </div>

            {/* Step 2: Social Category & Livelihood */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-paper-border">
              <Select
                label="Occupation / Livelihood (Optional)"
                value={formData.occupation}
                onChange={(e) => handleChange("occupation", e.target.value)}
                options={occupationOptions}
                helperText="Unlocks farmer, vendor, or student schemes"
              />

              <Select
                label="Social Category / Caste (Optional)"
                value={formData.caste}
                onChange={(e) => handleChange("caste", e.target.value)}
                options={casteOptions}
                helperText="For affirmative action welfare schemes"
              />

              <Select
                label="Ration Card / BPL Status (Optional)"
                value={formData.rationCardType}
                onChange={(e) => handleChange("rationCardType", e.target.value)}
                options={rationCardOptions}
                helperText="For food security and income subsidies"
              />
            </div>

            {/* Step 3: Special Circumstances / Divyangjan (Conditional) */}
            <div className="pt-2 border-t border-paper-border space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded bg-paper-light border border-paper-border">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neel block">
                    Specially Abled / Divyangjan Status (Optional)
                  </span>
                  <p className="text-xs text-neel-muted">
                    Do you hold a certified disability certificate (Divyangjan)?
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleChange("isSpeciallyAbled", false)}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                      !formData.isSpeciallyAbled
                        ? "bg-neel text-white"
                        : "bg-white text-neel border border-paper-border hover:bg-paper"
                    }`}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange("isSpeciallyAbled", true)}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                      formData.isSpeciallyAbled
                        ? "bg-vermilion text-white"
                        : "bg-white text-neel border border-paper-border hover:bg-paper"
                    }`}
                  >
                    Yes
                  </button>
                </div>
              </div>

              {/* Conditional Question: Disability Percentage */}
              {formData.isSpeciallyAbled && (
                <div className="p-3.5 rounded bg-mustard-light/20 border border-mustard/40 max-w-sm space-y-2">
                  <Input
                    label="Certified Disability Percentage (%)"
                    type="number"
                    min={1}
                    max={100}
                    value={formData.disabilityPercentage}
                    onChange={(e) => handleChange("disabilityPercentage", Number(e.target.value))}
                    helperText="Under RPwD Act 2016, Central benchmark welfare benefits typically require 40% or higher certified disability"
                  />
                </div>
              )}
            </div>

            {/* Validation / Error Warnings */}
            {validationError && (
              <Alert variant="warning" title="Input Needed">
                {validationError}
              </Alert>
            )}

            {error && (
              <Alert variant="error" title="Evaluation Error">
                {error}
              </Alert>
            )}

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-paper-border">
              <span className="text-xs text-neel-muted text-center sm:text-left">
                Your answers are processed locally against official eligibility rules. No personal data is stored without consent.
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isLoading}
                  className="w-full sm:w-auto"
                >
                  {isLoading ? "Evaluating Rules..." : "Check Eligible Schemes"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <div className="h-6 w-48 bg-paper-dark rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      )}

      {/* Results View */}
      {hasEvaluated && results && !isLoading && (
        <div className="space-y-6 pt-2">
          {/* Results Summary & Mandatory Disclaimer */}
          <Card accent="mustard" className="bg-mustard-light/15 border-mustard space-y-3">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-mustard-dark" />
                  <span>Evaluation Results</span>
                </CardTitle>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="px-2.5 py-1 rounded bg-sage text-neel">
                    {results.totalEligible} Potential Matches
                  </span>
                  <span className="px-2.5 py-1 rounded bg-mustard-light text-neel">
                    {results.totalPartiallyEligible} Near Matches
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-neel font-serif leading-relaxed">
                <strong>Important Notice:</strong> You may be eligible for the schemes listed below based on your provided demographic answers. This is a preliminary assessment and does not constitute an authoritative government ruling or guarantee. Final benefit sanction is subject to document verification by the respective Ministry or Department.
              </p>
            </CardContent>
          </Card>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-paper-border pb-2">
            <button
              onClick={() => setActiveTab("eligible")}
              className={`flex items-center gap-2 px-4 py-2 rounded-t text-xs font-bold transition-colors ${
                activeTab === "eligible"
                  ? "bg-neel text-white"
                  : "bg-paper text-neel-muted hover:text-neel hover:bg-paper-dark"
              }`}
            >
              <CheckCircle2 className="h-4 w-4 text-sage" />
              <span>Potential Matches ({results.totalEligible})</span>
            </button>
            <button
              onClick={() => setActiveTab("partial")}
              className={`flex items-center gap-2 px-4 py-2 rounded-t text-xs font-bold transition-colors ${
                activeTab === "partial"
                  ? "bg-neel text-white"
                  : "bg-paper text-neel-muted hover:text-neel hover:bg-paper-dark"
              }`}
            >
              <AlertTriangle className="h-4 w-4 text-mustard" />
              <span>Near Matches ({results.totalPartiallyEligible})</span>
            </button>
          </div>

          {/* Tab 1: Potential Matches */}
          {activeTab === "eligible" && (
            <div className="space-y-4">
              {results.eligibleSchemes.length === 0 ? (
                <EmptyState
                  title="No Exact Matches Found"
                  description="No schemes currently match all supplied criteria. Review the 'Near Matches' tab or revise your demographic answers (such as selecting All India jurisdiction)."
                  action={
                    <Button variant="outline" size="sm" onClick={() => setActiveTab("partial")}>
                      View Near Matches ({results.totalPartiallyEligible})
                    </Button>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.eligibleSchemes.map((scheme) => (
                    <SchemeEligibilityCard
                      key={scheme._id}
                      scheme={scheme}
                      isPotentialMatch={true}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Near Matches */}
          {activeTab === "partial" && (
            <div className="space-y-4">
              {results.partiallyEligibleSchemes.length > 0 && (
                <div className="p-3.5 rounded bg-mustard-light/25 border border-mustard/40 text-xs text-neel space-y-1">
                  <span className="font-bold block">Notice on Near Matches:</span>
                  <p className="text-neel-muted leading-relaxed">
                    Government welfare schemes require all statutory criteria to be satisfied in full. A match percentage indicates how many preliminary rules your profile meets, but final sanction requires resolving every unmet or unverified requirement listed below.
                  </p>
                </div>
              )}
              {results.partiallyEligibleSchemes.length === 0 ? (
                <EmptyState
                  title="No Near Matches Found"
                  description="There are no partially matching schemes requiring specific verification for your criteria."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.partiallyEligibleSchemes.map((scheme) => (
                    <SchemeEligibilityCard
                      key={scheme._id}
                      scheme={scheme}
                      isPotentialMatch={false}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer Callout to Assistant */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-paper border border-paper-border text-xs">
            <div className="space-y-0.5 text-center sm:text-left">
              <span className="font-bold text-neel block">
                Need personalized guidance on any of these schemes?
              </span>
              <span className="text-neel-muted">
                Ask NagrikMitra, our conversational AI assistant, to explain required documents and application steps in your regional language.
              </span>
            </div>
            <Link to="/assistant">
              <Button variant="primary" size="sm" rightIcon={<ChevronRight className="h-3.5 w-3.5" />}>
                Open Civic Assistant
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

interface SchemeEligibilityCardProps {
  scheme: MatchedScheme;
  isPotentialMatch: boolean;
}

const SchemeEligibilityCard: React.FC<SchemeEligibilityCardProps> = ({
  scheme,
  isPotentialMatch,
}) => {
  return (
    <Card
      accent={isPotentialMatch ? "sage" : "mustard"}
      className="flex flex-col justify-between h-full bg-white border-paper-border space-y-4"
    >
      <div className="space-y-3">
        {/* Header Badges */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-paper-dark text-neel">
            {scheme.issuingAuthority || "Government Scheme"}
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              isPotentialMatch
                ? "bg-sage text-neel"
                : "bg-mustard-light text-neel-dark"
            }`}
          >
            {isPotentialMatch ? "You May Be Eligible" : `${scheme.matchPercentage}% Met (Near Match)`}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-serif font-bold text-neel text-base sm:text-lg leading-snug">
          {scheme.title}
        </h3>

        {/* Location & Deadline */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-neel-muted">
          <span>Jurisdiction: <strong>{scheme.applicableState || "All India"}</strong></span>
          {scheme.applicationDeadline && (
            <span>• Deadline: <strong>{scheme.applicationDeadline}</strong></span>
          )}
        </div>

        {/* Passed Criteria Breakdown */}
        {scheme.passedCriteria && scheme.passedCriteria.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-paper-border">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sage-dark block">
              Criteria Satisfied ({scheme.passedCriteria.length})
            </span>
            <ul className="space-y-1 text-xs text-neel">
              {scheme.passedCriteria.map((crit, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-sage-dark shrink-0 mt-0.5" />
                  <span className="leading-tight">{crit}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Failed Criteria Breakdown (for Near Matches) */}
        {!isPotentialMatch && scheme.failedCriteria && scheme.failedCriteria.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-paper-border">
            <span className="text-[10px] font-bold uppercase tracking-wider text-vermilion block">
              Criteria Requiring Verification ({scheme.failedCriteria.length})
            </span>
            <ul className="space-y-1 text-xs text-vermilion-dark font-medium">
              {scheme.failedCriteria.map((fail, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-vermilion shrink-0 mt-0.5" />
                  <span className="leading-tight">{fail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-paper-border text-xs">
        <Link to={`/schemes/${scheme._id}`}>
          <Button variant="outline" size="sm">
            View Details
          </Button>
        </Link>

        {scheme.officialPortalUrl && (
          <a
            href={scheme.officialPortalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-vermilion hover:underline font-semibold"
            title="Open official government application portal"
          >
            <span>Official Portal</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </Card>
  );
};
