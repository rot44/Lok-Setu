export const PLAYBACK_RATES = [0.75, 1.0, 1.25, 1.5] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export interface AudioTrack {
  id: string;
  title: string;
  audioUrl: string;
  language: string;
  authority?: string;
  durationSeconds?: number;
  source: "scheme" | "notice";
  plainSummary?: string;
}

export interface SchemeAudioResponse {
  documentId: string;
  languageCode: string;
  languageName?: string;
  audioUrl: string;
  durationSeconds: number;
  mimeType: string;
  voiceName?: string;
  title: string;
  plainSummary: string;
  isCached: boolean;
}

export interface NoticeAudioResponse {
  documentId: string;
  fileName: string;
  language: string;
  audioUrl: string;
  durationSeconds: number;
  voiceName?: string;
  summary: string;
  isCached: boolean;
}
