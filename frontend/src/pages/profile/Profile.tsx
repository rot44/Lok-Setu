import React, { useState, useEffect } from "react";
import {
  User,
  Save,
  CheckCircle2,
  Building,
  Heart,
  Briefcase,
  Languages,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Card, CardTitle } from "@/components/ui/Card";
import {
  Gender,
  MaritalStatus,
  Religion,
  CasteCategory,
  LocalityType,
  IncomeRange,
  RationCardType,
  Occupation,
  UpdateProfilePayload,
} from "@/types/auth";
import { ClientApiError } from "@/types/api";
import { INDIAN_STATES } from "@/constants/indianStates";

const STATE_OPTIONS = [
  { value: "All India", label: "All India / Central Jurisdiction" },
  ...INDIAN_STATES.map((s) => ({ value: s, label: s })),
];

const GENDERS: { value: Gender; label: string }[] = [
  { value: "female", label: "Female / महिला" },
  { value: "male", label: "Male / पुरुष" },
  { value: "transgender", label: "Transgender / उभयलिंगी" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const MARITAL_STATUSES: { value: MaritalStatus; label: string }[] = [
  { value: "single", label: "Single / अविवाहित" },
  { value: "married", label: "Married / विवाहित" },
  { value: "widowed", label: "Widowed / विधवा/विधुर" },
  { value: "divorced", label: "Divorced / तलाकशुदा" },
  { value: "separated", label: "Separated" },
];

const RELIGIONS: { value: Religion; label: string }[] = [
  { value: "hindu", label: "Hindu" },
  { value: "muslim", label: "Muslim" },
  { value: "christian", label: "Christian" },
  { value: "sikh", label: "Sikh" },
  { value: "buddhist", label: "Buddhist" },
  { value: "jain", label: "Jain" },
  { value: "parsi", label: "Parsi" },
  { value: "other", label: "Other" },
];

const CASTES: { value: CasteCategory; label: string }[] = [
  { value: "general", label: "General" },
  { value: "obc", label: "OBC (Other Backward Class)" },
  { value: "sc", label: "SC (Scheduled Caste)" },
  { value: "st", label: "ST (Scheduled Tribe)" },
  { value: "ews", label: "EWS (Economically Weaker Section)" },
];

const LOCALITY_TYPES: { value: LocalityType; label: string }[] = [
  { value: "rural", label: "Rural (गाँव / ग्राम)" },
  { value: "urban", label: "Urban (शहर / नगर)" },
  { value: "semi_urban", label: "Semi-Urban (कस्बा)" },
];

const INCOME_RANGES: { value: IncomeRange; label: string }[] = [
  { value: "below_1_lakh", label: "Below ₹1 Lakh per annum" },
  { value: "1_to_2.5_lakh", label: "₹1 Lakh - ₹2.5 Lakh" },
  { value: "2.5_to_5_lakh", label: "₹2.5 Lakh - ₹5 Lakh" },
  { value: "5_to_8_lakh", label: "₹5 Lakh - ₹8 Lakh" },
  { value: "above_8_lakh", label: "Above ₹8 Lakh per annum" },
];

const RATION_CARDS: { value: RationCardType; label: string }[] = [
  { value: "none", label: "None / Not Applicable" },
  { value: "apl", label: "APL (Above Poverty Line)" },
  { value: "bpl", label: "BPL (Below Poverty Line)" },
  { value: "aay_antyodaya", label: "AAY (Antyodaya Anna Yojana)" },
  { value: "annapurna", label: "Annapurna Card" },
];

const OCCUPATIONS: { value: Occupation; label: string }[] = [
  { value: "farmer", label: "Farmer / किसान" },
  { value: "shopkeeper_msme", label: "Small Business / Shopkeeper / MSME" },
  { value: "street_vendor", label: "Street Vendor / रेहड़ी-पटरी विक्रेता" },
  { value: "artisan_craftsperson", label: "Artisan / Craftsperson (शिल्पकार)" },
  { value: "gig_worker", label: "Gig / Delivery / Transport Worker" },
  { value: "student", label: "Student / विद्यार्थी" },
  { value: "salaried", label: "Salaried Employee" },
  { value: "homemaker", label: "Homemaker / गृहिणी" },
  { value: "senior_citizen", label: "Senior Citizen" },
  { value: "unemployed", label: "Unemployed / Seeking Work" },
  { value: "other", label: "Other" },
];

export const Profile: React.FC = () => {
  const { user, profile, updateProfile, refreshProfile } = useAuth();
  const { languages } = useLanguage();

  const [formData, setFormData] = useState<UpdateProfilePayload>({
    age: profile?.age || undefined,
    gender: profile?.gender || "prefer_not_to_say",
    maritalStatus: profile?.maritalStatus || "single",
    religion: profile?.religion || "hindu",
    caste: profile?.caste || "general",
    isSpeciallyAbled: profile?.isSpeciallyAbled || false,
    disabilityPercentage: profile?.disabilityPercentage || 0,
    state: profile?.state || "Uttar Pradesh",
    city: profile?.city || "",
    location: {
      area: profile?.location?.area || "",
      pincode: profile?.location?.pincode || "",
      localityType: profile?.location?.localityType || "urban",
    },
    incomeRange: profile?.incomeRange || "below_1_lakh",
    rationCardType: profile?.rationCardType || "none",
    occupation: profile?.occupation || "farmer",
    isBusinessOwner: profile?.isBusinessOwner || false,
    isFarmer: profile?.isFarmer || false,
    preferredLanguages: {
      primary: profile?.preferredLanguages?.primary || "hi",
      secondary: profile?.preferredLanguages?.secondary || "en",
      tertiary: profile?.preferredLanguages?.tertiary || "",
    },
  });

  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile) {
      setFormData({
        age: profile.age || undefined,
        gender: profile.gender || "prefer_not_to_say",
        maritalStatus: profile.maritalStatus || "single",
        religion: profile.religion || "hindu",
        caste: profile.caste || "general",
        isSpeciallyAbled: profile.isSpeciallyAbled || false,
        disabilityPercentage: profile.disabilityPercentage || 0,
        state: profile.state || "All India",
        city: profile.city || "",
        location: {
          area: profile.location?.area || "",
          pincode: profile.location?.pincode || "",
          localityType: profile.location?.localityType || "urban",
        },
        incomeRange: profile.incomeRange || "below_1_lakh",
        rationCardType: profile.rationCardType || "none",
        occupation: profile.occupation || "farmer",
        isBusinessOwner: profile.isBusinessOwner || false,
        isFarmer: profile.isFarmer || false,
        preferredLanguages: {
          primary: profile.preferredLanguages?.primary || "hi",
          secondary: profile.preferredLanguages?.secondary || "en",
          tertiary: profile.preferredLanguages?.tertiary || "",
        },
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    setJustSaved(false);

    try {
      await updateProfile(formData);
      setJustSaved(true);
      setSuccessMsg("Profile changes saved successfully! Your matched schemes have been refreshed.");
      setTimeout(() => {
        setJustSaved(false);
      }, 4000);
      setTimeout(() => {
        setSuccessMsg(null);
      }, 5000);
    } catch (err: unknown) {
      if (err instanceof ClientApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to update profile. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b border-paper-border pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-vermilion mb-1">
            <User className="h-4 w-4" />
            <span>Citizen Profile & Welfare Preferences</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-4xl font-bold text-neel">
            {user?.username ? `${user.username}'s Profile` : "Citizen Profile"}
          </h1>
          <p className="text-sm text-neel-muted max-w-xl">
            This demographic data is used exclusively to calculate your eligibility for government policies, subsidies, and pension schemes.
          </p>
        </div>

        <div className="flex flex-col sm:items-end gap-1">
          <div className="flex items-center gap-2">
            {profile?.isProfileComplete ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                <CheckCircle2 className="h-3.5 w-3.5" /> Profile Complete
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                Incomplete Profile
              </span>
            )}
          </div>
          <span className="text-[11px] text-neel-muted">
            {profile?.isProfileComplete
              ? "All essential criteria set for 100% accurate scheme matching"
              : "Fill State, City, Gender & Occupation for 100% complete status"}
          </span>
        </div>
      </div>

      {successMsg && (
        <Alert variant="success" onDismiss={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}

      {errorMsg && (
        <Alert variant="error" onDismiss={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Demographics */}
        <Card accent="neel" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-paper-border pb-3">
            <Heart className="h-5 w-5 text-vermilion" />
            <CardTitle className="text-lg">Personal & Demographic Details</CardTitle>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Age (Years)"
              type="number"
              min={0}
              max={120}
              value={formData.age || ""}
              onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) || undefined })}
              placeholder="e.g. 35"
            />
            <Select
              label="Gender"
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value as Gender })}
              options={GENDERS}
            />
            <Select
              label="Marital Status"
              value={formData.maritalStatus}
              onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value as MaritalStatus })}
              options={MARITAL_STATUSES}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Caste Category"
              value={formData.caste}
              onChange={(e) => setFormData({ ...formData, caste: e.target.value as CasteCategory })}
              options={CASTES}
            />
            <Select
              label="Religion"
              value={formData.religion}
              onChange={(e) => setFormData({ ...formData, religion: e.target.value as Religion })}
              options={RELIGIONS}
            />
          </div>

          <div className="pt-2 border-t border-paper-border space-y-3">
            <div className="flex items-center gap-3">
              <input
                id="specially-abled"
                type="checkbox"
                checked={formData.isSpeciallyAbled}
                onChange={(e) => setFormData({ ...formData, isSpeciallyAbled: e.target.checked })}
                className="h-4 w-4 rounded border-paper-border text-vermilion focus:ring-vermilion"
              />
              <label htmlFor="specially-abled" className="text-xs font-semibold text-neel cursor-pointer">
                Divyangjan / Specially-Abled (दिव्यांगजन)
              </label>
            </div>

            {formData.isSpeciallyAbled && (
              <div className="max-w-xs">
                <Input
                  label="Disability Percentage (%)"
                  type="number"
                  min={0}
                  max={100}
                  value={formData.disabilityPercentage || 0}
                  onChange={(e) => setFormData({ ...formData, disabilityPercentage: Number(e.target.value) })}
                />
              </div>
            )}
          </div>
        </Card>

        {/* Section 2: Location */}
        <Card accent="sage" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-paper-border pb-3">
            <Building className="h-5 w-5 text-neel" />
            <CardTitle className="text-lg">Location & Jurisdiction</CardTitle>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="State"
              value={formData.state || "All India"}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              options={STATE_OPTIONS}
            />
            <Input
              label="City / District"
              value={formData.city || ""}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="e.g. Varanasi"
            />
            <Select
              label="Locality Type"
              value={formData.location?.localityType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  location: {
                    ...formData.location,
                    localityType: e.target.value as LocalityType,
                  },
                })
              }
              options={LOCALITY_TYPES}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Area / Ward (Optional)"
              value={formData.location?.area || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  location: { ...formData.location, localityType: formData.location?.localityType || "urban", area: e.target.value },
                })
              }
              placeholder="e.g. Dashashwamedh"
            />
            <Input
              label="PIN Code"
              value={formData.location?.pincode || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  location: { ...formData.location, localityType: formData.location?.localityType || "urban", pincode: e.target.value },
                })
              }
              placeholder="e.g. 221001"
            />
          </div>
        </Card>

        {/* Section 3: Occupation & Socioeconomic */}
        <Card accent="mustard" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-paper-border pb-3">
            <Briefcase className="h-5 w-5 text-mustard-dark" />
            <CardTitle className="text-lg">Occupation & Welfare Bracket</CardTitle>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Primary Occupation"
              value={formData.occupation}
              onChange={(e) => setFormData({ ...formData, occupation: e.target.value as Occupation })}
              options={OCCUPATIONS}
            />
            <Select
              label="Annual Household Income"
              value={formData.incomeRange}
              onChange={(e) => setFormData({ ...formData, incomeRange: e.target.value as IncomeRange })}
              options={INCOME_RANGES}
            />
            <Select
              label="Ration Card Category"
              value={formData.rationCardType}
              onChange={(e) => setFormData({ ...formData, rationCardType: e.target.value as RationCardType })}
              options={RATION_CARDS}
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-2">
            <div className="flex items-center gap-2">
              <input
                id="is-farmer"
                type="checkbox"
                checked={formData.isFarmer}
                onChange={(e) => setFormData({ ...formData, isFarmer: e.target.checked })}
                className="h-4 w-4 rounded border-paper-border text-vermilion"
              />
              <label htmlFor="is-farmer" className="text-xs font-semibold text-neel cursor-pointer">
                Agricultural Landowner / Farmer (किसान)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="is-business-owner"
                type="checkbox"
                checked={formData.isBusinessOwner}
                onChange={(e) => setFormData({ ...formData, isBusinessOwner: e.target.checked })}
                className="h-4 w-4 rounded border-paper-border text-vermilion"
              />
              <label htmlFor="is-business-owner" className="text-xs font-semibold text-neel cursor-pointer">
                Registered MSME / Shopkeeper (व्यापारी)
              </label>
            </div>
          </div>
        </Card>

        {/* Section 4: Languages */}
        <Card accent="vermilion" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-paper-border pb-3">
            <Languages className="h-5 w-5 text-vermilion" />
            <CardTitle className="text-lg">Preferred Regional Languages</CardTitle>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Primary Language (Explanations & Voice)"
              value={formData.preferredLanguages?.primary}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  preferredLanguages: {
                    ...formData.preferredLanguages,
                    primary: e.target.value,
                  },
                })
              }
              options={languages.map((l) => ({ value: l.code, label: `${l.nativeName} (${l.name})` }))}
            />

            <Select
              label="Secondary Language"
              value={formData.preferredLanguages?.secondary}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  preferredLanguages: {
                    ...formData.preferredLanguages,
                    secondary: e.target.value,
                  },
                })
              }
              options={languages.map((l) => ({ value: l.code, label: `${l.nativeName} (${l.name})` }))}
            />

            <Select
              label="Tertiary Language"
              value={formData.preferredLanguages?.tertiary || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  preferredLanguages: {
                    ...formData.preferredLanguages,
                    tertiary: e.target.value,
                  },
                })
              }
              options={[
                { value: "", label: "None / कोई नहीं" },
                ...languages.map((l) => ({ value: l.code, label: `${l.nativeName} (${l.name})` })),
              ]}
            />
          </div>
        </Card>

        {/* Submit Bar with Instant Inline Feedback */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-paper-border">
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <div className="flex items-center gap-2 text-xs text-neel-muted">
              <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
              <span>Updates immediately recalibrate scheme eligibility scores.</span>
            </div>
            {justSaved && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 animate-fade-in">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Changes saved successfully!</span>
                {profile?.isProfileComplete ? (
                  <span className="text-emerald-800 font-normal">Profile is complete for 100% matching.</span>
                ) : (
                  <span className="text-amber-800 font-normal">
                    (Tip: Choose a specific State & City for "Profile Complete" status)
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Button
              type="submit"
              variant={justSaved ? "secondary" : "primary"}
              size="lg"
              isLoading={saving}
              leftIcon={justSaved ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <Save className="h-4 w-4" />}
            >
              {justSaved ? "Saved Successfully!" : "Save Profile Changes"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
