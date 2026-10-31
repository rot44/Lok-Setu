import React from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Calendar,
  ExternalLink,
  ArrowRight,
  MapPin,
  CheckCircle2,
  Volume2,
  VolumeX,
  Loader2,
  Sparkles,
} from "lucide-react";
import { SchemeSummary } from "@/types/scheme";
import { Card } from "@/components/ui/Card";
import { cn } from "@/utils/cn";
import { useAudio } from "@/context/AudioContext";
import { useLanguage } from "@/context/LanguageContext";
import { schemeService } from "@/services/scheme.service";

interface SchemeCardProps {
  scheme: SchemeSummary;
}

export const SchemeCard: React.FC<SchemeCardProps> = ({ scheme }) => {
  const { language } = useLanguage();
  const { currentTrack, isPlaying, playTrack, togglePlayPause } = useAudio();
  const [loadingAudio, setLoadingAudio] = React.useState(false);

  const isThisPlaying = currentTrack?.id === scheme._id && isPlaying;

  const handleQuickPlay = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (currentTrack?.id === scheme._id) {
      togglePlayPause();
      return;
    }

    try {
      setLoadingAudio(true);
      const audioRes = await schemeService.getOrSynthesizeAudio(scheme._id, language);
      playTrack({
        id: scheme._id,
        title: scheme.title,
        audioUrl: audioRes.audioUrl,
        language: audioRes.languageCode || language,
        authority: scheme.issuingAuthority,
        durationSeconds: audioRes.durationSeconds,
        source: "scheme",
        plainSummary: audioRes.plainSummary,
      });
    } catch {
      // safe fallback
    } finally {
      setLoadingAudio(false);
    }
  };

  const isCentral = scheme.jurisdictionLevel?.toLowerCase() === "central";
  const isState = scheme.jurisdictionLevel?.toLowerCase() === "state";

  const formatDocType = (type: string) => {
    switch (type) {
      case "welfare_policy":
        return "Welfare Scheme";
      case "subsidies_grants":
        return "Subsidy & Grant";
      case "government_notification":
        return "Govt Notification";
      case "municipal_law":
        return "Municipal Rule";
      case "circular":
        return "Circular";
      default:
        return type.replace(/_/g, " ");
    }
  };

  const formatDeadline = (dateStr?: string | null) => {
    if (!dateStr) return "Ongoing / Not time-limited";
    try {
      const d = new Date(dateStr);
      return `Deadline: ${d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`;
    } catch {
      return "Ongoing / Not time-limited";
    }
  };

  const getAccent = () => {
    if (isCentral) return "neel";
    if (isState) return "mustard";
    return "sage";
  };

  return (
    <Card
      accent={getAccent()}
      className="flex flex-col justify-between hover:shadow-editorial-hover transition-all duration-200"
    >
      <div className="space-y-3">
        {/* Badges strip */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
          <span
            className={cn(
              "px-2 py-0.5 rounded uppercase tracking-wider",
              isCentral
                ? "bg-neel text-white"
                : isState
                ? "bg-mustard-dark text-white"
                : "bg-sage-dark text-white"
            )}
          >
            {scheme.jurisdictionLevel}
          </span>

          <span className="px-2 py-0.5 rounded bg-paper-dark text-neel-muted border border-paper-border">
            {formatDocType(scheme.documentType)}
          </span>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-paper text-neel">
            <MapPin className="h-3 w-3 text-vermilion" />
            {scheme.applicableState === "ALL" ? "All-India" : scheme.applicableState}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-serif text-lg sm:text-xl font-bold text-neel leading-snug line-clamp-2">
          <Link
            to={`/schemes/${scheme._id}`}
            className="hover:text-vermilion transition-colors focus:outline-none focus:underline"
          >
            {scheme.title}
          </Link>
        </h3>

        {/* Issuing Authority / Ministry */}
        <div className="flex items-start gap-2 text-xs text-neel-muted">
          <Building2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-neel-light" />
          <span className="line-clamp-1">{scheme.issuingAuthority}</span>
        </div>

        {/* Eligibility Snapshot */}
        {scheme.eligibilityRules && (
          <div className="pt-2 border-t border-paper-border/60 text-xs text-neel-muted space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-neel">
              <CheckCircle2 className="h-3.5 w-3.5 text-sage-dark shrink-0" />
              <span>
                Age: {scheme.eligibilityRules.minAge || 0} -{" "}
                {scheme.eligibilityRules.maxAge && scheme.eligibilityRules.maxAge < 120
                  ? `${scheme.eligibilityRules.maxAge} yrs`
                  : "No limit"}
              </span>
            </div>
            {scheme.eligibilityRules.occupations &&
              scheme.eligibilityRules.occupations.length > 0 &&
              !scheme.eligibilityRules.occupations.includes("ALL") && (
                <div className="text-[11px] text-neel-muted truncate">
                  Target: {scheme.eligibilityRules.occupations.join(", ")}
                </div>
              )}
          </div>
        )}

        {/* Tags */}
        {scheme.tags && scheme.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {scheme.tags.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className="inline-block text-[10px] font-medium bg-paper px-2 py-0.5 rounded text-neel-muted"
              >
                #{tag}
              </span>
            ))}
            {scheme.tags.length > 3 && (
              <span className="text-[10px] text-neel-muted self-center">
                +{scheme.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Card Footer: Deadline & Actions */}
      <div className="pt-4 mt-4 border-t border-paper-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-neel-muted">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-vermilion" />
          <span className="truncate">{formatDeadline(scheme.applicationDeadline)}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleQuickPlay}
            disabled={loadingAudio}
            className="p-1.5 text-neel-muted hover:text-vermilion hover:bg-paper rounded transition-colors focus:outline-none"
            title={isThisPlaying ? "Pause audio explainer" : "Listen to voice explainer"}
            aria-label={isThisPlaying ? `Pause voice explainer for ${scheme.title}` : `Listen to voice explainer for ${scheme.title}`}
          >
            {loadingAudio ? (
              <Loader2 className="h-4 w-4 animate-spin text-vermilion" />
            ) : isThisPlaying ? (
              <VolumeX className="h-4 w-4 text-vermilion" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>

          <Link
            to={`/assistant?schemeTitle=${encodeURIComponent(scheme.title)}&autoSend=1`}
            className="p-1.5 text-mustard-dark hover:text-vermilion hover:bg-amber-50 rounded transition-colors"
            title={`Ask AI to explain ${scheme.title}`}
            aria-label={`Ask AI about ${scheme.title}`}
          >
            <Sparkles className="h-4 w-4" />
          </Link>

          {scheme.officialPortalUrl && (
            <a
              href={scheme.officialPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-neel-muted hover:text-neel hover:bg-paper rounded transition-colors"
              title="Official Government Portal"
              aria-label={`Official government portal for ${scheme.title}`}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}

          <Link
            to={`/schemes/${scheme._id}`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-paper-dark hover:bg-neel hover:text-white text-xs font-semibold text-neel transition-all"
          >
            <span>Details</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </Card>
  );
};
