import { useState, useEffect, useRef, useCallback } from "react";

export const BCP47_SPEECH_MAP: Record<string, string> = {
  hi: "hi-IN",
  en: "en-IN",
  gu: "gu-IN",
  mr: "mr-IN",
  bn: "bn-IN",
  ta: "ta-IN",
  te: "te-IN",
  kn: "kn-IN",
};

export interface UseSpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onEnd?: (finalTranscript: string) => void;
  onError?: (errorMessage: string) => void;
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  startListening: (langOverride?: string) => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

// Minimal interface for SpeechRecognition
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
}

interface IWindowWithSpeech extends Window {
  SpeechRecognition?: {
    new (): SpeechRecognitionInstance;
  };
  webkitSpeechRecognition?: {
    new (): SpeechRecognitionInstance;
  };
}

/**
 * Universal Speech Recognition hook for Lok-Setu.
 * Supports all 8 Indian regional languages with BCP-47 fallback.
 */
export const useSpeechRecognition = (
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn => {
  const {
    language = "hi",
    continuous = false,
    interimResults = true,
    onResult,
    onEnd,
    onError,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const activeTranscriptRef = useRef<string>("");
  const callbacksRef = useRef({ onResult, onEnd, onError });

  useEffect(() => {
    callbacksRef.current = { onResult, onEnd, onError };
  }, [onResult, onEnd, onError]);

  // Check browser support
  const isSupported =
    typeof window !== "undefined" &&
    Boolean(
      (window as unknown as IWindowWithSpeech).SpeechRecognition ||
        (window as unknown as IWindowWithSpeech).webkitSpeechRecognition
    );

  const cleanupRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.abort();
      } catch {
        // Ignore abort errors on stopped instances
      }
      recognitionRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        cleanupRecognition();
      }
    }
    setIsListening(false);
  }, [cleanupRecognition]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    activeTranscriptRef.current = "";
    setError(null);
  }, []);

  const startListening = useCallback(
    (langOverride?: string) => {
      if (!isSupported) {
        const msg = "Speech recognition is not supported in this browser. Please use Chrome, Safari or Edge.";
        setError(msg);
        callbacksRef.current.onError?.(msg);
        return;
      }

      cleanupRecognition();
      setError(null);
      setInterimTranscript("");

      try {
        const win = window as unknown as IWindowWithSpeech;
        const SpeechRecognitionConstructor =
          win.SpeechRecognition || win.webkitSpeechRecognition;

        if (!SpeechRecognitionConstructor) return;

        const recognition = new SpeechRecognitionConstructor();
        const targetLang = langOverride || language;
        const bcp47Locale = BCP47_SPEECH_MAP[targetLang] || "hi-IN";

        recognition.lang = bcp47Locale;
        recognition.continuous = continuous;
        recognition.interimResults = interimResults;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
          setError(null);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let currentFinal = "";
          let currentInterim = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcriptChunk = result[0]?.transcript || "";
            if (result.isFinal) {
              currentFinal += transcriptChunk;
            } else {
              currentInterim += transcriptChunk;
            }
          }

          if (currentFinal) {
            setTranscript((prev) => {
              const updated = prev ? `${prev} ${currentFinal}`.trim() : currentFinal.trim();
              activeTranscriptRef.current = updated;
              callbacksRef.current.onResult?.(updated, true);
              return updated;
            });
            setInterimTranscript("");
          } else if (currentInterim) {
            setInterimTranscript(currentInterim);
            const preview = activeTranscriptRef.current
              ? `${activeTranscriptRef.current} ${currentInterim}`.trim()
              : currentInterim.trim();
            callbacksRef.current.onResult?.(preview, false);
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          let userFriendlyError = "Voice input error occurred.";
          switch (event.error) {
            case "not-allowed":
            case "service-not-allowed":
              userFriendlyError = "Microphone access was denied. Please allow microphone permissions.";
              break;
            case "no-speech":
              userFriendlyError = "No speech was detected. Please try speaking again.";
              break;
            case "network":
              userFriendlyError = "Network error during speech recognition.";
              break;
            case "aborted":
              userFriendlyError = "";
              break;
            default:
              userFriendlyError = `Speech recognition error: ${event.error}`;
          }

          if (userFriendlyError) {
            setError(userFriendlyError);
            callbacksRef.current.onError?.(userFriendlyError);
          }
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
          const finalResult = activeTranscriptRef.current.trim();
          callbacksRef.current.onEnd?.(finalResult);
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to initialize microphone.";
        setError(errorMsg);
        setIsListening(false);
        callbacksRef.current.onError?.(errorMsg);
      }
    },
    [isSupported, language, continuous, interimResults, cleanupRecognition]
  );

  useEffect(() => {
    return () => {
      cleanupRecognition();
    };
  }, [cleanupRecognition]);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
};
