import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Compass,
  FileSearch,
  CheckCircle2,
  Bell,
  ArrowRight,
  ShieldAlert,
  Building2,
  FileCheck2,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { buildEligibilityCheckPrompt } from "@/utils/aiPrompt";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export const Home: React.FC = () => {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const handleEligibilityNavigation = (e: React.MouseEvent) => {
    e.preventDefault();
    const prompt = buildEligibilityCheckPrompt(profile, language);
    navigate(`/assistant?preprompt=${encodeURIComponent(prompt)}&autoSend=1&mode=eligibility`);
  };

  const cards = [
    {
      title: t("home.card1.title"),
      desc: t("home.card1.desc"),
      to: "/assistant?mode=eligibility",
      onClick: handleEligibilityNavigation,
      icon: CheckCircle2,
      accent: "neel" as const,
      badge: "AI Eligibility Engine",
      actionText: "Check with AI",
    },
    {
      title: t("home.card2.title"),
      desc: t("home.card2.desc"),
      to: "/schemes",
      icon: Compass,
      accent: "vermilion" as const,
      badge: "Central & State",
      actionText: "Browse Schemes",
    },
    {
      title: t("home.card3.title"),
      desc: t("home.card3.desc"),
      to: "/analyze",
      icon: FileSearch,
      accent: "mustard" as const,
      badge: "Notice Analyzer",
      actionText: "Upload Notice",
    },
    {
      title: t("home.card4.title"),
      desc: t("home.card4.desc"),
      to: "/notifications",
      icon: Bell,
      accent: "sage" as const,
      badge: "7-Day Gazettes",
      actionText: "View Feed",
    },
  ];

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* Hero Section */}
      <section className="text-center max-w-4xl mx-auto pt-4 sm:pt-8 space-y-4 sm:space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-paper-dark border border-paper-border text-xs font-bold uppercase tracking-wider text-neel shadow-xs">
          <span className="h-2 w-2 rounded-full bg-vermilion" />
          <span>National Civic Intelligence Bridge</span>
        </div>

        <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold text-neel tracking-tight leading-[1.15]">
          {t("home.heroTitle")}
        </h1>

        <p className="text-sm sm:text-lg text-neel-muted max-w-2xl mx-auto leading-relaxed">
          {t("home.heroSubtitle")}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link to="/schemes">
            <Button
              variant="primary"
              size="lg"
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              {t("nav.explore")}
            </Button>
          </Link>
          <Link to="/analyze">
            <Button
              variant="outline"
              size="lg"
              leftIcon={<FileSearch className="h-4 w-4" />}
            >
              {t("nav.analyze")}
            </Button>
          </Link>
        </div>
      </section>

      {/* 4 Core Pillars Grid */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-paper-border pb-3">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-neel">
              Civic Services & Tools
            </h2>
            <p className="text-xs sm:text-sm text-neel-muted">
              Select a tool to explore verified policies or analyze legal notices.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Card
                key={c.to}
                accent={c.accent}
                className="group hover:border-neel transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-paper text-neel group-hover:bg-neel group-hover:text-white transition-colors">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-paper-dark text-neel">
                      {c.badge}
                    </span>
                  </div>
                  <CardTitle className="mb-2 text-xl">{c.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {c.desc}
                  </CardDescription>
                </div>

                <div className="pt-6 mt-6 border-t border-paper-border flex items-center justify-between">
                  <span className="text-xs font-bold text-neel uppercase tracking-wider">
                    Official Guidance
                  </span>
                  <Link to={c.to} onClick={c.onClick}>
                    <Button
                      variant="ghost"
                      size="sm"
                      rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                    >
                      {c.actionText}
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Safety & Grounding Guarantee Strip */}
      <section className="bg-white border border-paper-border rounded-lg p-6 sm:p-8 shadow-editorial">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-3.5">
            <Building2 className="h-6 w-6 text-vermilion shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-serif font-bold text-sm sm:text-base text-neel">
                Official Sources Only
              </h4>
              <p className="text-xs text-neel-muted leading-relaxed">
                Every scheme summary and legal interpretation is verified against government gazettes and ministry portals.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <FileCheck2 className="h-6 w-6 text-neel shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-serif font-bold text-sm sm:text-base text-neel">
                Zero Hallucination
              </h4>
              <p className="text-xs text-neel-muted leading-relaxed">
                If an official document does not specify a detail, Lok-Setu explicitly states that rather than guessing.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <ShieldAlert className="h-6 w-6 text-mustard-dark shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-serif font-bold text-sm sm:text-base text-neel">
                Citizen Rights Focus
              </h4>
              <p className="text-xs text-neel-muted leading-relaxed">
                Highlighting appeal periods, mandatory notice requirements, and protections for MSMEs, vendors, and farmers.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
