import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Filter,
  Compass,
  RotateCcw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  X,
  GraduationCap,
  Sprout,
  HeartPulse,
  Briefcase,
  Users,
} from "lucide-react";
import { schemeService } from "@/services/scheme.service";
import {
  SchemeSummary,
  ExploreFiltersMetadata,
  ExploreQueryParams,
} from "@/types/scheme";
import { useLanguage } from "@/context/LanguageContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SchemeCard } from "@/components/schemes/SchemeCard";
import { INDIAN_STATES } from "@/constants/indianStates";
import { cn } from "@/utils/cn";

export const ExploreSchemes: React.FC = () => {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active filters derived from URL search parameters for state preservation
  const searchQuery = searchParams.get("search") || "";
  const selectedTab = searchParams.get("tab") || "all";
  const selectedLevel = searchParams.get("governmentLevel") || "all";
  const selectedState = searchParams.get("state") || "ALL";
  const selectedCategory = searchParams.get("category") || "all";
  const selectedGender = searchParams.get("gender") || "all";
  const selectedAgeGroup = searchParams.get("ageGroup") || "all";
  const selectedIncome = searchParams.get("incomeRange") || "any";
  const selectedCaste = searchParams.get("caste") || "all";
  const selectedBeneficiary = searchParams.get("beneficiaryType") || "all";
  const isSpeciallyAbled = searchParams.get("isSpeciallyAbled") || "false";
  const selectedSortBy = searchParams.get("sortBy") || "newest";
  const currentPage = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  // Local state for debounced search input
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Data state
  const [schemes, setSchemes] = useState<SchemeSummary[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersMeta, setFiltersMeta] = useState<ExploreFiltersMetadata | null>(null);

  // Sync search input when URL changes
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  // Fetch sidebar/meta facet counts
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const meta = await schemeService.getFiltersMetadata();
        setFiltersMeta(meta);
      } catch {
        // Silently tolerate filter meta count failures
      }
    };
    fetchMeta();
  }, []);

  // Update URL search parameters
  const updateParam = useCallback(
    (key: string, value: string | null, resetPage = true) => {
      const nextParams = new URLSearchParams(searchParams);
      if (value === null || value === "" || value === "all" || value === "any" || value === "ALL") {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
      if (resetPage) {
        nextParams.delete("page");
      }
      setSearchParams(nextParams);
    },
    [searchParams, setSearchParams]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam("search", searchInput.trim());
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters = Boolean(
    searchQuery ||
      (selectedTab && selectedTab !== "all") ||
      (selectedLevel && selectedLevel !== "all") ||
      (selectedState && selectedState !== "ALL") ||
      (selectedCategory && selectedCategory !== "all") ||
      (selectedGender && selectedGender !== "all") ||
      (selectedAgeGroup && selectedAgeGroup !== "all") ||
      (selectedIncome && selectedIncome !== "any") ||
      (selectedCaste && selectedCaste !== "all") ||
      (selectedBeneficiary && selectedBeneficiary !== "all") ||
      isSpeciallyAbled === "true" ||
      selectedSortBy !== "newest" ||
      currentPage > 1
  );

  // Load schemes from backend
  const fetchSchemes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams: ExploreQueryParams = {
        page: currentPage,
        limit: 12,
        sortBy: selectedSortBy as "newest" | "relevance" | "deadline" | "title",
      };

      if (searchQuery) queryParams.search = searchQuery;
      if (selectedTab !== "all") queryParams.tab = selectedTab as "all" | "schemes" | "policies" | "notifications";
      if (selectedLevel !== "all") queryParams.governmentLevel = selectedLevel as "all" | "central" | "state" | "municipal";
      if (selectedState !== "ALL") queryParams.state = selectedState;
      if (selectedCategory !== "all") queryParams.category = selectedCategory;
      if (selectedGender !== "all") queryParams.gender = selectedGender as "all" | "female" | "male" | "other";
      if (selectedAgeGroup !== "all") queryParams.ageGroup = selectedAgeGroup as "all" | "below_18" | "18_25" | "26_40" | "41_60" | "above_60";
      if (selectedIncome !== "any") queryParams.incomeRange = selectedIncome as "any" | "below_1_lakh" | "1_to_2.5_lakh" | "2.5_to_5_lakh" | "5_to_8_lakh" | "above_8_lakh";
      if (selectedCaste !== "all") queryParams.caste = selectedCaste as "all" | "general" | "obc" | "sc" | "st" | "ews";
      if (selectedBeneficiary !== "all") queryParams.beneficiaryType = selectedBeneficiary as "all" | "farmer" | "student" | "msme" | "street_vendor" | "women";
      if (isSpeciallyAbled === "true") queryParams.isSpeciallyAbled = "true";

      const response = await schemeService.getSchemes(queryParams);
      setSchemes(response.documents || []);
      setTotalCount(response.totalCount || 0);
      setTotalPages(response.totalPages || 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load government schemes catalog.";
      setError(msg);
      setSchemes([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    searchQuery,
    selectedTab,
    selectedLevel,
    selectedState,
    selectedCategory,
    selectedGender,
    selectedAgeGroup,
    selectedIncome,
    selectedCaste,
    selectedBeneficiary,
    isSpeciallyAbled,
    selectedSortBy,
  ]);

  useEffect(() => {
    fetchSchemes();
  }, [fetchSchemes]);

  // Categories list with counts if available
  const CATEGORIES = [
    { id: "all", label: "All Categories", icon: Compass, count: filtersMeta?.totalActive },
    { id: "Education", label: "Education", icon: GraduationCap, count: filtersMeta?.categories.education },
    { id: "Agriculture", label: "Agriculture", icon: Sprout, count: filtersMeta?.categories.agriculture },
    { id: "Healthcare", label: "Healthcare", icon: HeartPulse, count: filtersMeta?.categories.healthcare },
    { id: "MSME", label: "MSME & Business", icon: Briefcase, count: filtersMeta?.categories.msme },
    { id: "Women", label: "Women & Child", icon: Users, count: filtersMeta?.categories.womenAndChild },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-paper-border pb-5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-vermilion">
          <Compass className="h-4 w-4" />
          <span>Welfare Scheme Directory</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl sm:text-4xl font-bold text-neel">
              {t("nav.explore", "Explore Schemes")}
            </h1>
            <p className="text-sm text-neel-muted max-w-2xl leading-relaxed mt-1">
              Search and browse verified central, state, and municipal policies, subsidies, and citizen welfare programs.
            </p>
          </div>
          {filtersMeta && (
            <div className="text-xs font-mono px-3 py-1.5 rounded bg-paper-dark border border-paper-border text-neel self-start sm:self-auto">
              Active Catalog: <strong className="text-vermilion">{filtersMeta.totalActive}</strong> policies
            </div>
          )}
        </div>
      </div>

      {/* Tabs Strip: All / Welfare Schemes / Policies / Circulars */}
      <div className="flex items-center gap-2 border-b border-paper-border overflow-x-auto pb-1 text-sm font-semibold">
        {[
          { id: "all", label: "All Records" },
          { id: "schemes", label: "Welfare Schemes & Grants" },
          { id: "policies", label: "Policies & Municipal Rules" },
          { id: "notifications", label: "Gazettes & Circulars" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => updateParam("tab", tab.id === "all" ? null : tab.id)}
            className={cn(
              "px-3 py-2 border-b-2 font-serif text-xs sm:text-sm whitespace-nowrap transition-colors",
              selectedTab === tab.id
                ? "border-vermilion text-vermilion font-bold"
                : "border-transparent text-neel-muted hover:text-neel hover:border-paper-border"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search & Jurisdiction Bar */}
      <div className="space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:flex-1">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by scheme name, ministry, or keyword (e.g. PM-Kisan, MSME, Subsidy)..."
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>

          <Button type="submit" variant="primary" size="md">
            Search
          </Button>

          <Button
            type="button"
            variant={showAdvancedFilters ? "secondary" : "outline"}
            size="md"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            leftIcon={<SlidersHorizontal className="h-4 w-4" />}
          >
            Filters {hasActiveFilters && "•"}
          </Button>
        </form>

        {/* Quick Jurisdiction Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-neel-muted text-xs">Jurisdiction:</span>
          {[
            { id: "all", label: "All Levels" },
            { id: "central", label: "Central Government", count: filtersMeta?.levels.central },
            { id: "state", label: "State Government", count: filtersMeta?.levels.state },
            { id: "municipal", label: "Municipal" },
          ].map((lvl) => (
            <button
              key={lvl.id}
              type="button"
              onClick={() => updateParam("governmentLevel", lvl.id === "all" ? null : lvl.id)}
              className={cn(
                "px-2.5 py-1 rounded-full border text-xs font-medium transition-colors",
                selectedLevel === lvl.id
                  ? "bg-neel text-white border-neel"
                  : "bg-white text-neel border-paper-border hover:bg-paper"
              )}
            >
              {lvl.label} {lvl.count !== undefined ? `(${lvl.count})` : ""}
            </button>
          ))}
        </div>

        {/* Category Filter Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected =
              cat.id === "all" ? selectedCategory === "all" : selectedCategory.toLowerCase() === cat.id.toLowerCase();
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => updateParam("category", cat.id === "all" ? null : cat.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-semibold whitespace-nowrap transition-colors",
                  isSelected
                    ? "bg-paper-dark border-vermilion text-vermilion"
                    : "bg-white border-paper-border text-neel hover:bg-paper"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{cat.label}</span>
                {cat.count !== undefined && (
                  <span className="text-[10px] opacity-75">({cat.count})</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Advanced Expandable Filter Panel */}
      {showAdvancedFilters && (
        <div className="p-4 sm:p-6 rounded-md bg-paper border border-paper-border space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-paper-border/80 pb-3">
            <div className="flex items-center gap-2 font-serif font-bold text-neel text-base">
              <Filter className="h-4 w-4 text-vermilion" />
              <span>Target Citizen & Regional Filters</span>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-vermilion hover:underline"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset All Filters</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Applicable State */}
            <Select
              label="State / Territory"
              value={selectedState}
              onChange={(e) => updateParam("state", e.target.value)}
              options={[
                { value: "ALL", label: "All-India & State Specific" },
                ...INDIAN_STATES.map((s) => ({ value: s, label: s })),
              ]}
            />

            {/* Gender Filter */}
            <Select
              label="Target Gender"
              value={selectedGender}
              onChange={(e) => updateParam("gender", e.target.value)}
              options={[
                { value: "all", label: "All Genders" },
                { value: "female", label: "Female Only" },
                { value: "male", label: "Male" },
                { value: "other", label: "Other / Transgender" },
              ]}
            />

            {/* Age Group */}
            <Select
              label="Age Bracket"
              value={selectedAgeGroup}
              onChange={(e) => updateParam("ageGroup", e.target.value)}
              options={[
                { value: "all", label: "Any Age" },
                { value: "below_18", label: "Below 18 years" },
                { value: "18_25", label: "18 to 25 years" },
                { value: "26_40", label: "26 to 40 years" },
                { value: "41_60", label: "41 to 60 years" },
                { value: "above_60", label: "Senior Citizens (60+)" },
              ]}
            />

            {/* Annual Income */}
            <Select
              label="Family Income Ceiling"
              value={selectedIncome}
              onChange={(e) => updateParam("incomeRange", e.target.value)}
              options={[
                { value: "any", label: "No Income Limit" },
                { value: "below_1_lakh", label: "Under ₹1 Lakh" },
                { value: "1_to_2.5_lakh", label: "₹1 - ₹2.5 Lakh" },
                { value: "2.5_to_5_lakh", label: "₹2.5 - ₹5 Lakh" },
                { value: "5_to_8_lakh", label: "₹5 - ₹8 Lakh" },
                { value: "above_8_lakh", label: "Above ₹8 Lakh" },
              ]}
            />

            {/* Social Category (Caste) */}
            <Select
              label="Social Category"
              value={selectedCaste}
              onChange={(e) => updateParam("caste", e.target.value)}
              options={[
                { value: "all", label: "All Categories" },
                { value: "general", label: "General" },
                { value: "obc", label: "OBC" },
                { value: "sc", label: "Scheduled Caste (SC)" },
                { value: "st", label: "Scheduled Tribe (ST)" },
                { value: "ews", label: "EWS" },
              ]}
            />

            {/* Beneficiary Type */}
            <Select
              label="Target Occupation"
              value={selectedBeneficiary}
              onChange={(e) => updateParam("beneficiaryType", e.target.value)}
              options={[
                { value: "all", label: "All Beneficiaries" },
                { value: "farmer", label: "Farmers & Agri Workers" },
                { value: "student", label: "Students" },
                { value: "msme", label: "MSME & Business" },
                { value: "street_vendor", label: "Street Vendors" },
                { value: "women", label: "Women Entrepreneurs" },
              ]}
            />

            {/* Sort Order */}
            <Select
              label="Sort Results By"
              value={selectedSortBy}
              onChange={(e) => updateParam("sortBy", e.target.value)}
              options={[
                { value: "newest", label: "Newest Published" },
                { value: "relevance", label: "Search Relevance" },
                { value: "deadline", label: "Ending Soonest" },
                { value: "title", label: "Alphabetical (A-Z)" },
              ]}
            />

            {/* Specially Abled Toggle */}
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 p-2.5 rounded bg-white border border-paper-border cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isSpeciallyAbled === "true"}
                  onChange={(e) =>
                    updateParam("isSpeciallyAbled", e.target.checked ? "true" : null)
                  }
                  className="rounded text-vermilion focus:ring-vermilion h-4 w-4"
                />
                <span className="text-xs font-semibold text-neel">
                  Divyangjan / Specially-Abled Only
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Pills Strip */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-neel-muted font-medium">Applied:</span>
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-paper-dark text-neel border border-paper-border">
              Search: "{searchQuery}"
              <button type="button" onClick={() => updateParam("search", null)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {selectedLevel !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-paper-dark text-neel border border-paper-border">
              Level: {selectedLevel}
              <button type="button" onClick={() => updateParam("governmentLevel", null)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {selectedState !== "ALL" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-paper-dark text-neel border border-paper-border">
              State: {selectedState}
              <button type="button" onClick={() => updateParam("state", null)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {selectedCategory !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-paper-dark text-neel border border-paper-border">
              Category: {selectedCategory}
              <button type="button" onClick={() => updateParam("category", null)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {isSpeciallyAbled === "true" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-paper-dark text-neel border border-paper-border">
              Divyangjan
              <button type="button" onClick={() => updateParam("isSpeciallyAbled", null)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs text-vermilion hover:underline ml-2 font-semibold"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-6 rounded-md bg-white border border-paper-border space-y-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="pt-4 border-t border-paper-border flex justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="max-w-2xl mx-auto py-8 space-y-4">
          <Alert variant="error" title="Error Loading Schemes">
            {error}
          </Alert>
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={fetchSchemes}>
              Try Again
            </Button>
          </div>
        </div>
      ) : schemes.length === 0 ? (
        <EmptyState
          title={t("empty.noSchemes", "No Schemes Available")}
          description={
            hasActiveFilters
              ? "No government welfare schemes matched the current filters. Try resetting search or selecting broader criteria."
              : t("empty.noSchemesDesc", "There are currently no welfare schemes in the repository.")
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Reset Filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Results count & page header */}
          <div className="flex items-center justify-between text-xs text-neel-muted border-b border-paper-border/60 pb-2">
            <span>
              Showing{" "}
              <strong className="text-neel font-semibold">{schemes.length}</strong> of{" "}
              <strong className="text-neel font-semibold">{totalCount}</strong> verified schemes
            </span>
            <span>
              Page {currentPage} of {totalPages}
            </span>
          </div>

          {/* Scheme Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {schemes.map((scheme) => (
              <SchemeCard key={scheme._id} scheme={scheme} />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6 border-t border-paper-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateParam("page", String(currentPage - 1), false)}
                disabled={currentPage <= 1}
                leftIcon={<ChevronLeft className="h-4 w-4" />}
              >
                Previous
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                  // Only show close pages
                  if (p !== 1 && p !== totalPages && Math.abs(p - currentPage) > 2) {
                    if (Math.abs(p - currentPage) === 3) {
                      return (
                        <span key={p} className="px-1 text-neel-muted text-xs">
                          ...
                        </span>
                      );
                    }
                    return null;
                  }

                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => updateParam("page", String(p), false)}
                      className={cn(
                        "h-8 w-8 rounded text-xs font-semibold transition-colors",
                        currentPage === p
                          ? "bg-neel text-white"
                          : "text-neel hover:bg-paper"
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => updateParam("page", String(currentPage + 1), false)}
                disabled={currentPage >= totalPages}
                rightIcon={<ChevronRight className="h-4 w-4" />}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
