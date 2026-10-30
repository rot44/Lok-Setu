export interface EligibilityRules {
  minAge?: number;
  maxAge?: number;
  genders?: string[];
  castes?: string[];
  religions?: string[];
  occupations?: string[];
  maxAnnualIncome?: string;
  requiresRationCard?: boolean;
  requiresDisabilityStatus?: boolean;
}

export interface SchemeSummary {
  _id: string;
  title: string;
  documentType: string;
  jurisdictionLevel: "central" | "state" | "municipal" | string;
  applicableState: string;
  issuingAuthority: string;
  applicationDeadline?: string | null;
  officialPortalUrl?: string;
  tags?: string[];
  eligibilityRules?: EligibilityRules;
  createdAt?: string;
}

export interface SchemeDetail extends SchemeSummary {
  applicableDistrict?: string;
  originalPdfUrl?: string;
  rawExtractedText: string;
  notificationDate?: string;
  isActive: boolean;
  updatedAt?: string;
}

export interface ExplainerAudio {
  audioUrl?: string;
  durationSeconds?: number;
}

export interface SchemeExplainer {
  _id: string;
  languageCode: string;
  languageName?: string;
  plainSummary: string;
  keyRights?: string[];
  eligibilityCriteria?: string[];
  citizenImpact?: string[];
  businessImpact?: string[];
  requiredDocuments?: string[];
  howToApplySteps?: string[];
  audio?: ExplainerAudio;
}

export interface SchemeDetailResponseData {
  document: SchemeDetail;
  availableExplainers: SchemeExplainer[];
}

export interface ExploreFiltersMetadata {
  totalActive: number;
  levels: {
    central: number;
    state: number;
  };
  categories: {
    education: number;
    agriculture: number;
    healthcare: number;
    msme: number;
    womenAndChild: number;
  };
}

export interface ExploreQueryParams {
  search?: string;
  tab?: "all" | "schemes" | "policies" | "notifications";
  category?: string;
  governmentLevel?: "all" | "central" | "state" | "municipal";
  state?: string;
  gender?: "all" | "female" | "male" | "other";
  ageGroup?: "all" | "below_18" | "18_25" | "26_40" | "41_60" | "above_60";
  incomeRange?: "any" | "below_1_lakh" | "1_to_2.5_lakh" | "2.5_to_5_lakh" | "5_to_8_lakh" | "above_8_lakh";
  religion?: "all" | "hindu" | "muslim" | "christian" | "sikh" | "buddhist" | "jain";
  caste?: "all" | "general" | "obc" | "sc" | "st" | "ews";
  beneficiaryType?: "all" | "farmer" | "student" | "msme" | "street_vendor" | "women";
  isSpeciallyAbled?: "true" | "false";
  sortBy?: "newest" | "relevance" | "deadline" | "title";
  page?: number;
  limit?: number;
}

export interface ExploreSchemesResponseData {
  documents: SchemeSummary[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  activeFilters?: Record<string, unknown>;
}
