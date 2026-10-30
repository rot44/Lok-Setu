import { api } from "./api";
import { CitizenDemographicInput, MatchAllResponseData, MatchedScheme } from "@/types/eligibility";

export const eligibilityService = {
  /**
   * Matches all eligible schemes based on citizen demographic inputs
   */
  async matchAllSchemes(input: CitizenDemographicInput): Promise<MatchAllResponseData> {
    return api.post<MatchAllResponseData>("/eligibility/match-all", input);
  },

  /**
   * Evaluates eligibility for a single scheme by ID
   */
  async checkSingleScheme(schemeId: string, input?: CitizenDemographicInput): Promise<MatchedScheme> {
    return api.post<MatchedScheme>(`/eligibility/check/${schemeId}`, input || {});
  },
};
