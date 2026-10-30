/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { AudioTrack } from "@/types/voice";

export interface AudioContextType {
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  playbackRate: number;
  currentTime: number;
  duration: number;
  error: string | null;
  playTrack: (track: AudioTrack) => Promise<void>;
  togglePlayPause: () => void;
  seek: (timeSeconds: number) => void;
  skip: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  stopAudio: () => void;
  dismiss: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [playbackRate, setPlaybackRateState] = useState<number>(1.0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize single persistent native Audio instance
  useEffect(() => {
    if (typeof window === "undefined") return;

    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    };

    const onLoadedMetadata = () => {
      if (audioRef.current && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
      setIsLoading(false);
    };

    const onPlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
      setError(null);
    };

    const onPause = () => {
      setIsPlaying(false);
    };

    const onWaiting = () => {
      setIsLoading(true);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = () => {
      setIsPlaying(false);
      setIsLoading(false);
      setError("Unable to stream audio explainer. Please try again.");
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.src = "";
      audioRef.current = null;
    };
  }, []);

  const playTrack = useCallback(async (track: AudioTrack) => {
    setError(null);
    setCurrentTrack(track);
    setIsLoading(true);

    if (track.durationSeconds && track.durationSeconds > 0) {
      setDuration(track.durationSeconds);
    } else {
      setDuration(0);
    }
    setCurrentTime(0);

    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (audio.src !== track.audioUrl) {
        audio.src = track.audioUrl;
        audio.load();
      }
      audio.playbackRate = playbackRate;
      await audio.play();
      setIsPlaying(true);
      setIsLoading(false);
    } catch (err: unknown) {
      setIsPlaying(false);
      setIsLoading(false);
      // Auto-play might be blocked by user-gesture requirements
      const message =
        err instanceof Error && err.name === "NotAllowedError"
          ? "Click Play on the player to start listening."
          : "Could not play audio track. Please try again.";
      setError(message);
    }
  }, [playbackRate]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
          setError(null);
        })
        .catch((err: unknown) => {
          setIsPlaying(false);
          setIsLoading(false);
          const msg = err instanceof Error ? err.message : "Playback failed.";
          setError(msg);
        });
    }
  }, [isPlaying, currentTrack]);

  const seek = useCallback((timeSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const boundedTime = Math.max(0, Math.min(timeSeconds, duration || audio.duration || 0));
    audio.currentTime = boundedTime;
    setCurrentTime(boundedTime);
  }, [duration]);

  const skip = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const targetTime = audio.currentTime + seconds;
      seek(targetTime);
    },
    [seek]
  );

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const dismiss = useCallback(() => {
    stopAudio();
    setCurrentTrack(null);
    setError(null);
    setDuration(0);
    setCurrentTime(0);
  }, [stopAudio]);

  return (
    <AudioContext.Provider
      value={{
        currentTrack,
        isPlaying,
        isLoading,
        playbackRate,
        currentTime,
        duration,
        error,
        playTrack,
        togglePlayPause,
        seek,
        skip,
        setPlaybackRate,
        stopAudio,
        dismiss,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = (): AudioContextType => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
};
