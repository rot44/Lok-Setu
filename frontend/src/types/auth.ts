export type UserRole = "citizen" | "business_owner" | "official" | "admin";

export type Gender = "female" | "male" | "transgender" | "prefer_not_to_say";
export type MaritalStatus = "single" | "married" | "widowed" | "divorced" | "separated";
export type Religion =
  | "hindu"
  | "muslim"
  | "christian"
  | "sikh"
  | "buddhist"
  | "jain"
  | "parsi"
  | "other";

export type CasteCategory = "general" | "obc" | "sc" | "st" | "ews";
export type LocalityType = "rural" | "urban" | "semi_urban";
export type IncomeRange =
  | "below_1_lakh"
  | "1_to_2.5_lakh"
  | "2.5_to_5_lakh"
  | "5_to_8_lakh"
  | "above_8_lakh";

export type RationCardType = "none" | "apl" | "bpl" | "aay_antyodaya" | "annapurna";

export type Occupation =
  | "student"
  | "farmer"
  | "shopkeeper_msme"
  | "street_vendor"
  | "artisan_craftsperson"
  | "gig_worker"
  | "salaried"
  | "homemaker"
  | "senior_citizen"
  | "unemployed"
  | "other";

export interface User {
  _id: string;
  username: string;
  email: string;
  phone?: string;
  role: UserRole;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileLocation {
  area?: string;
  pincode?: string;
  localityType: LocalityType;
}

export interface UserPreferredLanguages {
  primary: string;
  secondary?: string;
  tertiary?: string;
}

export interface UserProfile {
  _id: string;
  user: User | string;
  dob?: string;
  age?: number;
  gender?: Gender;
  maritalStatus?: MaritalStatus;
  religion?: Religion;
  caste?: CasteCategory;
  isSpeciallyAbled?: boolean;
  disabilityPercentage?: number;
  state: string;
  city: string;
  location?: UserProfileLocation;
  incomeRange?: IncomeRange;
  rationCardType?: RationCardType;
  occupation?: Occupation;
  isBusinessOwner?: boolean;
  isFarmer?: boolean;
  isProfileComplete?: boolean;
  preferredLanguages?: UserPreferredLanguages;
  createdAt?: string;
  updatedAt?: string;
}

export interface MatchedSchemeItem {
  _id: string;
  title: string;
  documentType: string;
  jurisdictionLevel: string;
  applicableState: string;
  issuingAuthority: string;
  applicationDeadline?: string | null;
  officialPortalUrl?: string | null;
  createdAt: string;
}

export interface DashboardSummaryData {
  profile: UserProfile;
  dashboardMetrics: {
    matchedSchemesCount: number;
    isProfileComplete: boolean;
    primaryLanguage: string;
  };
  matchedSchemes: MatchedSchemeItem[];
}

export interface AuthResponseData {
  user: User;
  profile?: UserProfile | null;
  accessToken?: string;
}

export interface RegisterResponseData {
  userId: string;
  email: string;
  username: string;
  isVerified: boolean;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  phone?: string;
  state?: string;
  city?: string;
  preferredLanguage?: string;
}

export interface LoginPayload {
  email?: string;
  username?: string;
  password: string;
}

export interface VerifyOtpPayload {
  email: string;
  otp: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  email: string;
  otp: string;
  newPassword: string;
}

export interface UpdateProfilePayload {
  dob?: string;
  age?: number;
  gender?: Gender;
  maritalStatus?: MaritalStatus;
  religion?: Religion;
  caste?: CasteCategory;
  isSpeciallyAbled?: boolean;
  disabilityPercentage?: number;
  state?: string;
  city?: string;
  location?: {
    area?: string;
    pincode?: string;
    localityType?: LocalityType;
  };
  incomeRange?: IncomeRange;
  rationCardType?: RationCardType;
  occupation?: Occupation;
  isBusinessOwner?: boolean;
  isFarmer?: boolean;
  preferredLanguages?: {
    primary?: string;
    secondary?: string;
    tertiary?: string;
  };
}
