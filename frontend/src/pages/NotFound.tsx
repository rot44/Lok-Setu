import React from "react";
import { Link } from "react-router-dom";
import { FileQuestion, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/Button";

export const NotFound: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-paper-dark text-neel mb-4">
        <FileQuestion className="h-8 w-8 text-vermilion" />
      </div>
      <span className="text-xs font-bold uppercase tracking-widest text-vermilion mb-2">
        Error 404
      </span>
      <h1 className="font-serif text-3xl sm:text-4xl font-bold text-neel mb-3">
        {t("error.notFoundTitle")}
      </h1>
      <p className="max-w-md text-sm sm:text-base text-neel-muted mb-8 leading-relaxed">
        {t("error.notFoundDesc")}
      </p>
      <Link to="/">
        <Button variant="primary" leftIcon={<ArrowLeft className="h-4 w-4" />}>
          {t("common.backHome")}
        </Button>
      </Link>
    </div>
  );
};
