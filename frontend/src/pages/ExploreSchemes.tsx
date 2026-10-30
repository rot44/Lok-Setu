import React, { useState } from "react";
import { Search, Filter, Compass } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export const ExploreSchemes: React.FC = () => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>("all");

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-paper-border pb-5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-vermilion">
          <Compass className="h-4 w-4" />
          <span>Welfare Scheme Directory</span>
        </div>
        <h1 className="font-serif text-2xl sm:text-4xl font-bold text-neel">
          {t("nav.explore")}
        </h1>
        <p className="text-sm text-neel-muted max-w-2xl leading-relaxed">
          Search and browse verified central, state, and municipal policies, subsidies, and citizen welfare programs.
        </p>
      </div>

      {/* Search and Filters Strip */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="w-full sm:flex-1">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by scheme name, ministry, or keyword (e.g. PM-Kisan, MSME, Subsidy)..."
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {["all", "central", "state", "municipal"].map((lvl) => (
            <Button
              key={lvl}
              variant={selectedJurisdiction === lvl ? "primary" : "outline"}
              size="sm"
              onClick={() => setSelectedJurisdiction(lvl)}
              className="capitalize whitespace-nowrap"
            >
              {lvl === "all" ? "All Levels" : lvl}
            </Button>
          ))}
          <Button variant="ghost" size="sm" leftIcon={<Filter className="h-3.5 w-3.5" />}>
            Filters
          </Button>
        </div>
      </div>

      {/* Database Status / Honest Empty State */}
      <EmptyState
        title={t("empty.noSchemes")}
        description={t("empty.noSchemesDesc")}
        action={
          <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
            Reset Filters
          </Button>
        }
      />
    </div>
  );
};
