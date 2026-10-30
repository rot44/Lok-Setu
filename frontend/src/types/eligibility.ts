export interface CitizenDemographicInput {
  age?: number | string;
  gender?: string;
  state?: string;
  caste?: string;
  occupation?: string;
  isSpeciallyAbled?: boolean;
  disabilityPercentage?: number;
  rationCardType?: string;
}

export interface MatchedScheme {
  _id: string;
  title: string;
  documentType: string;
  applicableState: string;
  issuingAuthority: string;
  officialPortalUrl?: string | null;
  applicationDeadline?: string | null;
  isEligible: boolean;
  passedCriteria: string[];
  failedCriteria: string[];
  matchPercentage: number;
}

export interface MatchAllResponseData {
  totalEligible: number;
  totalPartiallyEligible: number;
  eligibleSchemes: MatchedScheme[];
  partiallyEligibleSchemes: MatchedScheme[];
  evaluationNotice?: string;
}
