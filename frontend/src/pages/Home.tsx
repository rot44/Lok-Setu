import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Compass,
  FileSearch,
  CheckCircle2,
  Bell,
  ArrowRight,
  ShieldCheck,
  Building2,
  FileCheck2,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { buildEligibilityCheckPrompt } from "@/utils/aiPrompt";
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
      title: t("home.card1.title", "Check Scheme Eligibility"),
      desc: t(
        "home.card1.desc",
        "Answer a few questions about your state, age, and occupation to get matched with active government schemes."
      ),
      to: "/assistant?mode=eligibility",
      onClick: handleEligibilityNavigation,
      icon: CheckCircle2,
      tag: "Eligibility Assistant",
      meta: "Personalized by profile",
      actionText: "Check eligibility",
    },
    {
      title: t("home.card2.title", "Explore Welfare Schemes"),
      desc: t(
        "home.card2.desc",
        "Browse central and state policies, subsidies, DBT transfers, and loan schemes with verified official guidelines."
      ),
      to: "/schemes",
      icon: Compass,
      tag: "Scheme Directory",
      meta: "Central & State schemes",
      actionText: "Browse schemes",
    },
    {
      title: t("home.card3.title", "Analyze Government Notices"),
      desc: t(
        "home.card3.desc",
        "Upload any official notice, order, or circular in PDF, image, or text to extract your legal rights and appeal deadlines."
      ),
      to: "/analyze",
      icon: FileSearch,
      tag: "Notice Analyzer",
      meta: "PDF, image, or text",
      actionText: "Upload notice",
    },
    {
      title: t("home.card4.title", "Live Gazette Notifications"),
      desc: t(
        "home.card4.desc",
        "Stay updated on recent policy changes, gazette notifications, and government circulars issued across all states."
      ),
      to: "/notifications",
      icon: Bell,
      tag: "Gazette Feed",
      meta: "Updated in last 7 days",
      actionText: "View notifications",
    },
  ];

  return (
    <div className="space-y-12 sm:space-y-16 py-4">
      {/* Hero Section */}
      <section className="text-center max-w-3xl mx-auto pt-4 sm:pt-10 space-y-5">
        <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold text-stone-900 tracking-tight leading-[1.15]">
          {t("home.heroTitle")}
        </h1>

        <p className="text-base sm:text-lg text-stone-600 max-w-2xl mx-auto leading-relaxed font-normal">
          {t("home.heroSubtitle")}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <Link to="/schemes">
            <Button
              variant="primary"
              size="lg"
              className="px-6 py-2.5 rounded-lg shadow-xs text-sm font-medium"
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              {t("nav.explore")}
            </Button>
          </Link>
          <Link to="/analyze">
            <Button
              variant="outline"
              size="lg"
              className="px-6 py-2.5 rounded-lg border-stone-300 text-stone-700 hover:bg-stone-50 text-sm font-medium"
              leftIcon={<FileSearch className="h-4 w-4 text-stone-500" />}
            >
              {t("nav.analyze")}
            </Button>
          </Link>
        </div>
      </section>

      {/* 4 Core Pillars Grid */}
      <section className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between border-b border-stone-200/80 pb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
              Civic Services & Tools
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
              Select a service to verify entitlements, explore schemes, or analyze legal documents.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.to}
                to={c.to}
                onClick={c.onClick}
                className="group bg-white border border-stone-200/90 rounded-xl p-6 hover:border-stone-400/90 hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-10 w-10 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center group-hover:bg-stone-900 group-hover:text-white transition-colors duration-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-medium text-stone-500 bg-stone-50 border border-stone-200/60 px-2.5 py-1 rounded-full">
                      {c.tag}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-stone-900 tracking-tight group-hover:text-stone-700 transition-colors">
                    {c.title}
                  </h3>
                  <p className="text-sm text-stone-600 leading-relaxed mt-2 font-normal">
                    {c.desc}
                  </p>
                </div>

                <div className="pt-5 mt-6 border-t border-stone-100 flex items-center justify-between">
                  <span className="text-xs text-stone-400 font-medium">
                    {c.meta}
                  </span>
                  <span className="text-xs font-medium text-stone-900 group-hover:text-stone-600 flex items-center gap-1.5 transition-colors">
                    {c.actionText}
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform duration-200 text-stone-400 group-hover:text-stone-900" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Trust & Grounding Standards */}
      <section className="bg-white border border-stone-200/90 rounded-xl p-6 sm:p-8 max-w-6xl mx-auto shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-3.5">
            <div className="h-9 w-9 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center shrink-0 mt-0.5">
              <Building2 className="h-4.5 w-4.5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-sm sm:text-base text-stone-900">
                Official Sources Only
              </h4>
              <p className="text-xs text-stone-500 leading-relaxed font-normal">
                Every scheme summary and legal interpretation is verified against government gazettes and ministry portals.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="h-9 w-9 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center shrink-0 mt-0.5">
              <FileCheck2 className="h-4.5 w-4.5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-sm sm:text-base text-stone-900">
                Zero Hallucination
              </h4>
              <p className="text-xs text-stone-500 leading-relaxed font-normal">
                If an official document does not specify a detail, Lok-Setu explicitly states that rather than guessing.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="h-9 w-9 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-sm sm:text-base text-stone-900">
                Citizen Rights Focus
              </h4>
              <p className="text-xs text-stone-500 leading-relaxed font-normal">
                Highlighting appeal periods, mandatory notice requirements, and protections for MSMEs, vendors, and farmers.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
