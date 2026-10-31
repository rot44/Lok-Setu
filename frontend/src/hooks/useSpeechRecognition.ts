import { useState, useEffect, useRef, useCallback } from "react";
import { assistantService } from "@/services/assistant.service";
import { BCP47_SPEECH_MAP } from "@/types/voice";

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
  isTranscribing: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  startListening: (langOverride?: string) => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

/**
 * Universal Speech Recognition hook powered by Sarvam AI Saaras v4 via MediaRecorder.
 * Completely immune to browser network blocking (Brave, Firefox, Chrome, Safari).
 */
export const useSpeechRecognition = (
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn => {
  const {
    language = "hi",
    onResult,
    onEnd,
    onError,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeLanguageRef = useRef<string>(language);
  const callbacksRef = useRef({ onResult, onEnd, onError });

  useEffect(() => {
    callbacksRef.current = { onResult, onEnd, onError };
    activeLanguageRef.current = language;
  }, [onResult, onEnd, onError, language]);

  // Check MediaRecorder & getUserMedia support (supported across 100% of modern browsers)
  const isSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined";

  const cleanupStream = useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      });
      audioStreamRef.current = null;
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        cleanupStream();
        setIsListening(false);
      }
    } else {
      cleanupStream();
      setIsListening(false);
    }
  }, [cleanupStream]);

  const startListening = useCallback(
    async (langOverride?: string) => {
      if (!isSupported) {
        const msg = "Audio recording is not supported in this browser. Please use Chrome, Safari or Brave.";
        setError(msg);
        callbacksRef.current.onError?.(msg);
        return;
      }

      cleanupStream();
      setError(null);
      setInterimTranscript("");
      audioChunksRef.current = [];

      const targetLang = langOverride || activeLanguageRef.current || "hi";

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        audioStreamRef.current = stream;

        // Choose best supported MIME type
        let mimeType = "audio/webm";
        if (typeof MediaRecorder.isTypeSupported === "function") {
          if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
            mimeType = "audio/webm;codecs=opus";
          } else if (MediaRecorder.isTypeSupported("audio/webm")) {
            mimeType = "audio/webm";
          } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
            mimeType = "audio/mp4";
          } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
            mimeType = "audio/ogg";
          } else if (MediaRecorder.isTypeSupported("audio/wav")) {
            mimeType = "audio/wav";
          }
        }

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event: BlobEvent) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onerror = () => {
          const errMsg = "Microphone recording encountered an error.";
          setError(errMsg);
          callbacksRef.current.onError?.(errMsg);
          setIsListening(false);
          cleanupStream();
        };

        recorder.onstop = async () => {
          cleanupStream();
          setIsListening(false);

          const chunks = audioChunksRef.current;
          if (chunks.length === 0) {
            return;
          }

          const audioBlob = new Blob(chunks, { type: mimeType || "audio/webm" });
          if (audioBlob.size < 200) {
            // Audio too short / silent
            const shortMsg = "Recording was too short. Please speak clearly into your microphone.";
            setError(shortMsg);
            callbacksRef.current.onError?.(shortMsg);
            return;
          }

          setIsTranscribing(true);
          try {
            const result = await assistantService.transcribeAudio(audioBlob, targetLang);
            const recognized = (result?.transcript || "").trim();

            if (recognized) {
              setTranscript(recognized);
              callbacksRef.current.onResult?.(recognized, true);
              callbacksRef.current.onEnd?.(recognized);
            } else {
              const noSpeech = "No spoken words were detected. Please try speaking again.";
              setError(noSpeech);
              callbacksRef.current.onError?.(noSpeech);
            }
          } catch (transcribeErr: unknown) {
            const errText =
              transcribeErr instanceof Error
                ? transcribeErr.message
                : "Voice transcription service temporarily unavailable.";
            setError(errText);
            callbacksRef.current.onError?.(errText);
          } finally {
            setIsTranscribing(false);
          }
        };

        recorder.start(250); // Record in 250ms time-slices
        setIsListening(true);
      } catch (err: unknown) {
        let userMsg = "Failed to access microphone.";
        if (err instanceof Error) {
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            userMsg = "Microphone access was denied. Please allow microphone access in your browser settings.";
          } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
            userMsg = "No microphone hardware found on this device.";
          } else {
            userMsg = err.message;
          }
        }
        setError(userMsg);
        setIsListening(false);
        cleanupStream();
        callbacksRef.current.onError?.(userMsg);
      }
    },
    [isSupported, cleanupStream]
  );

  useEffect(() => {
    return () => {
      cleanupStream();
    };
  }, [cleanupStream]);

  return {
    isSupported,
    isListening,
    isTranscribing,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
};
