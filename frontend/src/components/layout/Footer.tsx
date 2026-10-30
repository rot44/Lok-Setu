import React from "react";
import { Link } from "react-router-dom";
import { Scale, ShieldCheck, HeartHandshake } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageCode } from "@/translations";

export const Footer: React.FC = () => {
  const { t, setLanguage, languages } = useLanguage();

  return (
    <footer className="mt-auto bg-paper-dark border-t-2 border-paper-border text-neel">
      {/* Disclaimer Strip */}
      <div className="bg-sage/40 border-b border-paper-border py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-vermilion shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-neel-dark font-medium leading-relaxed">
            <span className="font-bold uppercase tracking-wider text-vermilion">
              {t("common.disclaimer").split(":")[0]}:
            </span>{" "}
            {t("common.disclaimer").split(":")[1] || t("common.disclaimer")}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-neel text-white shadow-editorial">
                <Scale className="h-4 w-4 text-mustard" />
              </div>
              <span className="font-serif text-lg font-bold text-neel">
                लोक सेतु | Lok-Setu
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neel-muted max-w-md leading-relaxed">
              {t("app.tagline")}. An open civic intelligence bridge connecting citizens, shopkeepers, farmers, and MSMEs with verified government welfare policies and legal protections.
            </p>
            <div className="flex items-center gap-2 pt-2 text-xs font-semibold text-neel-muted">
              <HeartHandshake className="h-4 w-4 text-vermilion" />
              <span>Public Interest Civic Initiative</span>
            </div>
          </div>

          {/* Quick Navigation */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neel mb-3 border-b border-paper-border pb-1">
              {t("nav.home")} & Services
            </h4>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <Link to="/schemes" className="hover:text-vermilion transition-colors">
                  {t("nav.explore")}
                </Link>
              </li>
              <li>
                <Link to="/analyze" className="hover:text-vermilion transition-colors">
                  {t("nav.analyze")}
                </Link>
              </li>
              <li>
                <Link to="/assistant" className="hover:text-vermilion transition-colors">
                  {t("nav.assistant")}
                </Link>
              </li>
              <li>
                <Link to="/notifications" className="hover:text-vermilion transition-colors">
                  {t("nav.notifications")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Regional Languages */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neel mb-3 border-b border-paper-border pb-1">
              Languages / भाषाएं
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs font-medium">
              {languages.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLanguage(l.code as LanguageCode)}
                  className="text-left hover:text-vermilion transition-colors py-0.5"
                >
                  {l.nativeName}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-paper-border flex flex-col sm:flex-row items-center justify-between text-xs text-neel-muted gap-4">
          <p>© {new Date().getFullYear()} Lok-Setu. Grounded in Government of India public records.</p>
          <p className="text-[11px]">Strict Zero-Hallucination Civic Architecture</p>
        </div>
      </div>
    </footer>
  );
};
