import { api } from "./api";

export interface CitationItem {
  chunkId: string;
  documentId: string;
  title: string;
  issuingAuthority: string | null;
  sectionHeading: string | null;
  clauseNumber: string | null;
  startOffset: number;
  endOffset: number;
  sourceUrl: string | null;
}

export interface AssistantAnalysis {
  summary: string;
  sourceFacts: string[];
  interpretation: string;
  limitations: string[];
  citations: CitationItem[];
  insufficientEvidence: boolean;
}

export interface AssistantMessage {
  id: string;
  sender: "user" | "assistant" | "system";
  text: string;
  languageUsed?: string;
  timestamp: string;
  analysis?: AssistantAnalysis | null;
}

export interface AssistantChatPayload {
  query: string;
  language?: string;
  sessionId?: string;
  guestToken?: string;
  filters?: Record<string, string>;
  documentId?: string;
  documentText?: string;
}

export interface AssistantChatResponse {
  sessionId: string;
  guestToken?: string;
  message: AssistantMessage;
  disclaimer: string;
}

export interface AssistantSessionResponse {
  sessionId: string;
  sessionMode: string;
  createdAt: string;
  lastActiveAt: string;
  messages: AssistantMessage[];
}

export interface AssistantAudioResponse {
  audioUrl: string;
  durationSeconds: number;
  language: string;
  voiceName?: string;
  isCached: boolean;
}

const GUEST_TOKEN_KEY = "loksetu_guest_token";
const SESSION_ID_KEY = "loksetu_assistant_session_id";

export const getStoredGuestToken = (): string | null => {
  try {
    return sessionStorage.getItem(GUEST_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setStoredGuestToken = (token: string): void => {
  try {
    sessionStorage.setItem(GUEST_TOKEN_KEY, token);
  } catch {
    // Ignore storage errors in restricted contexts
  }
};

export const getStoredSessionId = (): string | null => {
  try {
    return sessionStorage.getItem(SESSION_ID_KEY);
  } catch {
    return null;
  }
};

export const setStoredSessionId = (id: string): void => {
  try {
    sessionStorage.setItem(SESSION_ID_KEY, id);
  } catch {
    // Ignore storage errors
  }
};

export const clearStoredSession = (): void => {
  try {
    sessionStorage.removeItem(GUEST_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_ID_KEY);
  } catch {
    // Ignore storage errors
  }
};

export const assistantService = {
  sendMessage: async (payload: AssistantChatPayload): Promise<AssistantChatResponse> => {
    const guestToken = payload.guestToken || getStoredGuestToken() || undefined;
    const headers: Record<string, string> = {};
    if (guestToken) {
      headers["x-guest-token"] = guestToken;
    }

    const response = await api.post<AssistantChatResponse>(
      "/assistant/chat",
      {
        ...payload,
        guestToken,
      },
      { headers }
    );

    if (response.sessionId) {
      setStoredSessionId(response.sessionId);
    }
    if (response.guestToken) {
      setStoredGuestToken(response.guestToken);
    }

    return response;
  },

  getSessionHistory: async (sessionId: string, guestToken?: string): Promise<AssistantSessionResponse> => {
    const token = guestToken || getStoredGuestToken() || undefined;
    const headers: Record<string, string> = {};
    if (token) {
      headers["x-guest-token"] = token;
    }

    return await api.get<AssistantSessionResponse>(`/assistant/session/${sessionId}`, {
      headers,
    });
  },

  synthesizeAssistantAudio: async (
    text: string,
    language?: string,
    title?: string
  ): Promise<AssistantAudioResponse> => {
    return await api.post<AssistantAudioResponse>("/assistant/audio", {
      text,
      language,
      title,
    });
  },

  transcribeAudio: async (
    audioBlob: Blob,
    language?: string
  ): Promise<{ transcript: string; languageCode: string; requestId: string }> => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "voice_query.webm");
    if (language) {
      formData.append("language", language);
    }

    return await api.post<{
      transcript: string;
      languageCode: string;
      requestId: string;
    }>("/assistant/transcribe", formData);
  },
};
