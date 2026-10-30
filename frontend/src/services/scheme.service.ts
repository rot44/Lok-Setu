import { api } from "./api";
import {
  ExploreQueryParams,
  ExploreSchemesResponseData,
  SchemeDetailResponseData,
  ExploreFiltersMetadata,
} from "@/types/scheme";
import { SchemeAudioResponse } from "@/types/voice";

export const schemeService = {
  getSchemes: async (params?: ExploreQueryParams): Promise<ExploreSchemesResponseData> => {
    return api.get<ExploreSchemesResponseData>("/explore", {
      params: params as Record<string, string | number | boolean | undefined | null>,
    });
  },

  getSchemeById: async (id: string): Promise<SchemeDetailResponseData> => {
    return api.get<SchemeDetailResponseData>(`/explore/${id}`);
  },

  getFiltersMetadata: async (): Promise<ExploreFiltersMetadata> => {
    return api.get<ExploreFiltersMetadata>("/explore/filters-meta");
  },

  getOrSynthesizeAudio: async (id: string, language?: string): Promise<SchemeAudioResponse> => {
    return api.post<SchemeAudioResponse>(`/explore/${id}/audio`, { language });
  },
};
