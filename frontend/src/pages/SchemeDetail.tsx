import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Building2,
  Calendar,
  ExternalLink,
  FileText,
  MapPin,
  CheckCircle2,
  XCircle,
  Volume2,
  VolumeX,
  ArrowLeft,
  ShieldCheck,
  Briefcase,
  Users,
  FileCheck,
  Share2,
  HelpCircle,
} from "lucide-react";
import { schemeService } from "@/services/scheme.service";
import { SchemeDetailResponseData, SchemeExplainer } from "@/types/scheme";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/utils/cn";

const NOT_SPECIFIED = "This document does not clearly specify this information.";

export const SchemeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();

  const [data, setData] = useState<SchemeDetailResponseData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExplainerIndex, setSelectedExplainerIndex] = useState<number>(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchScheme = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await schemeService.getSchemeById(id);
      setData(response);

      // Auto-select explainer matching current language if present
      if (response.availableExplainers && response.availableExplainers.length > 0) {
        const langMatchIndex = response.availableExplainers.findIndex(
          (e) => e.languageCode === language
        );
        setSelectedExplainerIndex(langMatchIndex !== -1 ? langMatchIndex : 0);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load scheme details.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id, language]);

  useEffect(() => {
    fetchScheme();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [fetchScheme]);

  const activeExplainer: SchemeExplainer | undefined =
    data?.availableExplainers && data.availableExplainers.length > 0
      ? data.availableExplainers[selectedExplainerIndex]
      : undefined;

  const toggleAudio = () => {
    if (!activeExplainer?.audio?.audioUrl) return;

    if (!audioRef.current) {
      const audio = new Audio(activeExplainer.audio.audioUrl);
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      audio.play();
      audioRef.current = audio;
      setIsPlayingAudio(true);
    } else {
      if (isPlayingAudio) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioRef.current.play();
        setIsPlayingAudio(true);
      }
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto py-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-12 w-3/4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 md:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-4">
        <Alert variant="error" title="Unable to Load Scheme">
          {error || "The requested scheme could not be found."}
        </Alert>
        <div className="flex justify-center">
          <Button variant="outline" onClick={fetchScheme}>
            Retry Loading
          </Button>
        </div>
      </div>
    );
  }

  const { document: scheme, availableExplainers } = data;
  const isCentral = scheme.jurisdictionLevel?.toLowerCase() === "central";
  const isState = scheme.jurisdictionLevel?.toLowerCase() === "state";

  const formatDocType = (type: string) => {
    switch (type) {
      case "welfare_policy":
        return "Welfare Policy";
      case "subsidies_grants":
        return "Subsidies & Grants";
      case "government_notification":
        return "Government Notification";
      case "municipal_law":
        return "Municipal Law";
      case "circular":
        return "Official Circular";
      default:
        return type.replace(/_/g, " ");
    }
  };

  const formatDeadline = (dateStr?: string | null) => {
    if (!dateStr) return "Ongoing / Not time-limited";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "Ongoing / Not time-limited";
    }
  };

  const formatNotificationDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Navigation Breadcrumb & Back */}
      <div className="flex items-center justify-between gap-4 border-b border-paper-border pb-3">
        <Link
          to="/schemes"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neel hover:text-vermilion transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Scheme Directory</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            leftIcon={<Share2 className="h-3.5 w-3.5" />}
          >
            {copiedLink ? "Link Copied!" : "Share Scheme"}
          </Button>

          {scheme.officialPortalUrl && (
            <a
              href={scheme.officialPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-vermilion hover:bg-vermilion-dark text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <span>Official Portal</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Scheme Hero Header */}
      <div className="space-y-4">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span
            className={cn(
              "px-2.5 py-1 rounded uppercase tracking-wider text-xs",
              isCentral
                ? "bg-neel text-white"
                : isState
                ? "bg-mustard-dark text-white"
                : "bg-sage-dark text-white"
            )}
          >
            {scheme.jurisdictionLevel} Government
          </span>

          <span className="px-2.5 py-1 rounded bg-paper-dark text-neel border border-paper-border">
            {formatDocType(scheme.documentType)}
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-paper text-neel font-medium">
            <MapPin className="h-3.5 w-3.5 text-vermilion" />
            {scheme.applicableState === "ALL"
              ? "All-India Coverage"
              : `State: ${scheme.applicableState}`}
            {scheme.applicableDistrict && scheme.applicableDistrict !== "ALL" && (
              <span>({scheme.applicableDistrict})</span>
            )}
          </span>

          {scheme.isActive ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-sage/40 text-neel-dark font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-sage-dark" />
              Active Scheme
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-vermilion/20 text-vermilion font-medium">
              <XCircle className="h-3.5 w-3.5" />
              Archived / Inactive
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="font-serif text-2xl sm:text-4xl font-bold text-neel leading-tight">
          {scheme.title}
        </h1>

        {/* Ministry / Authority & Dates Metadata Strip */}
        <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-neel-muted pt-1">
          <div className="flex items-center gap-1.5 font-medium text-neel">
            <Building2 className="h-4 w-4 text-neel-light shrink-0" />
            <span>{scheme.issuingAuthority}</span>
          </div>

          {formatNotificationDate(scheme.notificationDate) && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-mustard-dark shrink-0" />
              <span>Notified: {formatNotificationDate(scheme.notificationDate)}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-vermilion shrink-0" />
            <span>
              Application Window:{" "}
              <strong className="text-neel font-semibold">
                {formatDeadline(scheme.applicationDeadline)}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Explainer/Rights vs Eligibility Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 Cols): Plain Explanation & Impact */}
        <div className="lg:col-span-2 space-y-6">
          {/* Explainer Language Selector & Audio Strip */}
          {availableExplainers && availableExplainers.length > 0 && (
            <Card accent="neel" className="space-y-4 bg-paper-light/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-paper-border pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-vermilion" />
                  <span className="font-serif font-bold text-neel">
                    Citizen Plain-Language Explainer
                  </span>
                </div>

                {/* Explainer Language Pills */}
                {availableExplainers.length > 1 && (
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {availableExplainers.map((exp, idx) => (
                      <button
                        key={exp._id || idx}
                        type="button"
                        onClick={() => setSelectedExplainerIndex(idx)}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-semibold transition-colors",
                          selectedExplainerIndex === idx
                            ? "bg-neel text-white"
                            : "bg-paper text-neel hover:bg-paper-dark"
                        )}
                      >
                        {exp.languageName || exp.languageCode.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Audio Player if URL exists */}
              {activeExplainer?.audio?.audioUrl && (
                <div className="flex items-center justify-between p-3 rounded bg-white border border-paper-border shadow-xs">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleAudio}
                      className="p-2 rounded-full bg-vermilion text-white hover:bg-vermilion-dark transition-colors shadow-xs"
                      aria-label={isPlayingAudio ? "Pause Audio Explainer" : "Play Audio Explainer"}
                    >
                      {isPlayingAudio ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </button>
                    <div>
                      <div className="text-xs font-bold text-neel">Spoken Explainer</div>
                      <div className="text-[11px] text-neel-muted">
                        {activeExplainer.languageName || "Regional"} Audio Voice Overview
                        {activeExplainer.audio.durationSeconds && (
                          <span> ({Math.round(activeExplainer.audio.durationSeconds)}s)</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-paper px-2 py-1 rounded text-neel-muted">
                    S3 Audio
                  </span>
                </div>
              )}

              {/* Plain Summary Text */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neel-muted">
                  Simplified Summary
                </h4>
                <p className="text-sm text-neel leading-relaxed whitespace-pre-line">
                  {activeExplainer?.plainSummary || NOT_SPECIFIED}
                </p>
              </div>
            </Card>
          )}

          {/* Key Citizen Rights & Benefits */}
          <Card accent="mustard" className="space-y-4">
            <div className="flex items-center gap-2 text-neel">
              <ShieldCheck className="h-5 w-5 text-mustard-dark shrink-0" />
              <CardTitle className="text-lg">Key Rights & Citizen Entitlements</CardTitle>
            </div>

            {activeExplainer?.keyRights && activeExplainer.keyRights.length > 0 ? (
              <ul className="space-y-2 text-sm text-neel">
                {activeExplainer.keyRights.map((right, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-mustard-dark mt-0.5 shrink-0" />
                    <span>{right}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm italic text-neel-muted bg-paper/60 p-3 rounded">
                {NOT_SPECIFIED}
              </p>
            )}
          </Card>

          {/* Citizen & Business Impact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card accent="sage" className="space-y-3">
              <div className="flex items-center gap-2 text-neel">
                <Users className="h-4 w-4 text-sage-dark shrink-0" />
                <h3 className="font-serif font-bold text-base">Citizen Impact</h3>
              </div>
              {activeExplainer?.citizenImpact && activeExplainer.citizenImpact.length > 0 ? (
                <ul className="space-y-1.5 text-xs text-neel-muted">
                  {activeExplainer.citizenImpact.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-vermilion font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs italic text-neel-muted bg-paper/50 p-2.5 rounded">
                  {NOT_SPECIFIED}
                </p>
              )}
            </Card>

            <Card accent="none" className="space-y-3 border-l-4 border-l-neel">
              <div className="flex items-center gap-2 text-neel">
                <Briefcase className="h-4 w-4 text-neel-light shrink-0" />
                <h3 className="font-serif font-bold text-base">Business & Enterprise Impact</h3>
              </div>
              {activeExplainer?.businessImpact && activeExplainer.businessImpact.length > 0 ? (
                <ul className="space-y-1.5 text-xs text-neel-muted">
                  {activeExplainer.businessImpact.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-neel font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs italic text-neel-muted bg-paper/50 p-2.5 rounded">
                  {NOT_SPECIFIED}
                </p>
              )}
            </Card>
          </div>

          {/* Actionable Roadmap: How to Apply & Required Documents */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card accent="none" className="space-y-3">
              <div className="flex items-center gap-2 text-neel">
                <FileCheck className="h-4 w-4 text-vermilion shrink-0" />
                <h3 className="font-serif font-bold text-base">Application Process</h3>
              </div>
              {activeExplainer?.howToApplySteps && activeExplainer.howToApplySteps.length > 0 ? (
                <ol className="space-y-2 text-xs text-neel list-decimal pl-4">
                  {activeExplainer.howToApplySteps.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs italic text-neel-muted bg-paper/50 p-2.5 rounded">
                  {NOT_SPECIFIED}
                </p>
              )}
            </Card>

            <Card accent="none" className="space-y-3">
              <div className="flex items-center gap-2 text-neel">
                <FileText className="h-4 w-4 text-neel shrink-0" />
                <h3 className="font-serif font-bold text-base">Required Documents</h3>
              </div>
              {activeExplainer?.requiredDocuments && activeExplainer.requiredDocuments.length > 0 ? (
                <ul className="space-y-1.5 text-xs text-neel">
                  {activeExplainer.requiredDocuments.map((doc, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-sage-dark shrink-0" />
                      <span>{doc}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs italic text-neel-muted bg-paper/50 p-2.5 rounded">
                  {NOT_SPECIFIED}
                </p>
              )}
            </Card>
          </div>

          {/* 🏛️ Verified Official Government Record (Raw Source) */}
          <div className="p-5 rounded-md bg-paper border border-paper-border space-y-4">
            <div className="flex items-center justify-between border-b border-paper-border/80 pb-3">
              <div className="flex items-center gap-2 text-neel">
                <FileText className="h-4 w-4 text-vermilion" />
                <h3 className="font-serif font-bold text-sm uppercase tracking-wider">
                  Verified Official Government Record
                </h3>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white text-neel-muted border border-paper-border">
                Authentic Source Extract
              </span>
            </div>

            <p className="text-xs text-neel leading-relaxed font-sans bg-white/70 p-4 rounded border border-paper-border">
              {scheme.rawExtractedText || NOT_SPECIFIED}
            </p>

            {/* Official Source URLs (Only displayed when they exist in backend data) */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              {scheme.officialPortalUrl ? (
                <a
                  href={scheme.officialPortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-vermilion font-semibold hover:underline"
                >
                  <span>Official Application Portal</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-xs text-neel-muted">Portal link: {NOT_SPECIFIED}</span>
              )}

              {scheme.originalPdfUrl ? (
                <a
                  href={scheme.originalPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-neel font-semibold hover:underline"
                >
                  <span>Original Gazette / Circular (PDF)</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Eligibility Criteria Breakdown */}
        <div className="space-y-6">
          <Card accent="vermilion" className="space-y-4">
            <div className="flex items-center gap-2 text-neel border-b border-paper-border pb-3">
              <HelpCircle className="h-5 w-5 text-vermilion shrink-0" />
              <CardTitle className="text-lg">Eligibility Criteria</CardTitle>
            </div>

            {scheme.eligibilityRules ? (
              <div className="space-y-3 text-xs">
                {/* Age Criteria */}
                <div className="p-2.5 rounded bg-paper/60 space-y-1">
                  <div className="font-semibold text-neel">Age Requirement</div>
                  <div className="text-neel-muted">
                    {scheme.eligibilityRules.minAge !== undefined && scheme.eligibilityRules.maxAge !== undefined
                      ? `${scheme.eligibilityRules.minAge} to ${scheme.eligibilityRules.maxAge} years`
                      : NOT_SPECIFIED}
                  </div>
                </div>

                {/* Gender Criteria */}
                <div className="p-2.5 rounded bg-paper/60 space-y-1">
                  <div className="font-semibold text-neel">Eligible Genders</div>
                  <div className="text-neel-muted capitalize">
                    {scheme.eligibilityRules.genders && scheme.eligibilityRules.genders.length > 0
                      ? scheme.eligibilityRules.genders.join(", ")
                      : NOT_SPECIFIED}
                  </div>
                </div>

                {/* Social Categories / Castes */}
                <div className="p-2.5 rounded bg-paper/60 space-y-1">
                  <div className="font-semibold text-neel">Social Categories (Caste)</div>
                  <div className="text-neel-muted uppercase">
                    {scheme.eligibilityRules.castes && scheme.eligibilityRules.castes.length > 0
                      ? scheme.eligibilityRules.castes.join(", ")
                      : NOT_SPECIFIED}
                  </div>
                </div>

                {/* Occupation Targets */}
                <div className="p-2.5 rounded bg-paper/60 space-y-1">
                  <div className="font-semibold text-neel">Target Occupation</div>
                  <div className="text-neel-muted capitalize">
                    {scheme.eligibilityRules.occupations && scheme.eligibilityRules.occupations.length > 0
                      ? scheme.eligibilityRules.occupations.join(", ")
                      : NOT_SPECIFIED}
                  </div>
                </div>

                {/* Annual Income Ceiling */}
                <div className="p-2.5 rounded bg-paper/60 space-y-1">
                  <div className="font-semibold text-neel">Annual Income Ceiling</div>
                  <div className="text-neel-muted">
                    {scheme.eligibilityRules.maxAnnualIncome && scheme.eligibilityRules.maxAnnualIncome !== "any"
                      ? scheme.eligibilityRules.maxAnnualIncome.replace(/_/g, " ")
                      : "No income ceiling specified"}
                  </div>
                </div>

                {/* Ration Card Requirement */}
                <div className="p-2.5 rounded bg-paper/60 space-y-1">
                  <div className="font-semibold text-neel">Ration Card Mandatory</div>
                  <div className="text-neel-muted">
                    {scheme.eligibilityRules.requiresRationCard
                      ? "Yes, requires active Ration Card (BPL/AAY)"
                      : "No ration card requirement"}
                  </div>
                </div>

                {/* Disability Status Requirement */}
                <div className="p-2.5 rounded bg-paper/60 space-y-1">
                  <div className="font-semibold text-neel">Divyangjan / Disability Condition</div>
                  <div className="text-neel-muted">
                    {scheme.eligibilityRules.requiresDisabilityStatus
                      ? "Exclusively for certified specially-abled individuals"
                      : "Not restricted to disability status"}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs italic text-neel-muted bg-paper/50 p-2.5 rounded">
                {NOT_SPECIFIED}
              </p>
            )}

            {/* Link to Citizen Desk for personalized match */}
            <div className="pt-3 border-t border-paper-border text-center">
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded bg-neel hover:bg-neel-dark text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <span>Check Your Match on Desk</span>
              </Link>
            </div>
          </Card>

          {/* Scheme Tags / Metadata */}
          {scheme.tags && scheme.tags.length > 0 && (
            <div className="p-4 rounded bg-white border border-paper-border space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neel-muted">
                Scheme Tags
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {scheme.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-paper px-2.5 py-1 rounded text-neel font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
