import { api } from "@/services/api";
import { NoticeAudioResponse } from "@/types/voice";

export interface NoticeCitation {
  chunkId: string;
  documentId?: string;
  title: string;
  issuingAuthority?: string | null;
  sectionHeading?: string | null;
  clauseNumber?: string | null;
  sourceUrl?: string | null;
}

export interface NoticeAnalysis {
  language: string;
  summary: string;
  noticeFacts: string[];
  datesAndDeadlines: string[];
  actionItems: string[];
  penalties: string[];
  keyRights: string[];
  citizenImpact: string;
  businessImpact: string;
  missingInformation: string[];
  citations: NoticeCitation[];
  disclaimer: string;
  requiresOcr?: boolean;
}

export interface UploadDocumentResponse {
  documentId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileHash: string;
  status: "uploaded" | "processing" | "analyzed" | "failed" | "requires_ocr";
  readyForAiAnalysis?: boolean;
  isCached?: boolean;
  analysis?: NoticeAnalysis;
  audioUrl?: string;
}

export interface ExecuteAnalysisResponse {
  documentId: string;
  fileName: string;
  fileUrl?: string;
  status: "uploaded" | "processing" | "analyzed" | "failed" | "requires_ocr";
  isCached?: boolean;
  analysis?: NoticeAnalysis;
  requiresOcr?: boolean;
  message?: string;
  rawExtractedText?: string;
}

export interface UserAnalyzedHistoryItem {
  _id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  status: string;
  primaryExplanation?: {
    language?: string;
    summary?: string;
  };
  requiresOcr?: boolean;
  audioUrl?: string;
  createdAt: string;
}

export const analysisService = {
  /**
   * Uploads notice document (PDF, DOCX, Image, Text) to S3
   */
  async uploadNotice(file: File, sessionId?: string): Promise<UploadDocumentResponse> {
    const formData = new FormData();
    formData.append("document", file);
    if (sessionId) {
      formData.append("sessionId", sessionId);
    }

    return await api.post<UploadDocumentResponse>("/analyze/upload", formData);
  },

  /**
   * Executes grounded notice analysis and structured rights extraction
   */
  async executeAnalysis(
    documentId: string,
    language?: string
  ): Promise<ExecuteAnalysisResponse> {
    return await api.post<ExecuteAnalysisResponse>(`/analyze/${documentId}/execute`, {
      language,
    });
  },

  /**
   * Fetches single analyzed document by ID
   */
  async getDocument(documentId: string): Promise<UploadDocumentResponse> {
    return await api.get<UploadDocumentResponse>(`/analyze/${documentId}`);
  },

  /**
   * Fetches citizen's upload history
   */
  async getHistory(): Promise<{ totalCount: number; history: UserAnalyzedHistoryItem[] }> {
    return await api.get<{ totalCount: number; history: UserAnalyzedHistoryItem[] }>(
      "/analyze/history"
    );
  },

  /**
   * Generates or fetches voice explainer audio for an analyzed notice (Sarvam Bulbul TTS)
   */
  async getOrSynthesizeNoticeAudio(documentId: string, language?: string): Promise<NoticeAudioResponse> {
    return await api.post<NoticeAudioResponse>(`/analyze/${documentId}/audio`, { language });
  },
};
