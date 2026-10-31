import React from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  X,
  Volume2,
  AlertCircle,
  Loader2,
  FileText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAudio } from "@/context/AudioContext";
import { PLAYBACK_RATES } from "@/types/voice";
import { cn } from "@/utils/cn";

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

export const GlobalAudioPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    playbackRate,
    currentTime,
    duration,
    error,
    togglePlayPause,
    seek,
    skip,
    setPlaybackRate,
    dismiss,
  } = useAudio();

  if (!currentTrack) {
    return null;
  }

  const handleNextRate = () => {
    const currentIndex = PLAYBACK_RATES.indexOf(playbackRate as (typeof PLAYBACK_RATES)[number]);
    const nextIndex = (currentIndex + 1) % PLAYBACK_RATES.length;
    setPlaybackRate(PLAYBACK_RATES[nextIndex]);
  };

  const effectiveDuration = duration > 0 ? duration : currentTrack.durationSeconds || 0;
  const progressPercent = effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0;

  return (
    <aside
      aria-label="Civic Voice Explainer Audio Player"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-paper-border shadow-2xl transition-all duration-300"
    >
      {/* Top progress scrubber bar */}
      <div className="relative w-full h-1.5 bg-paper group cursor-pointer">
        <div
          className="h-full bg-vermilion transition-all duration-100 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />
        <input
          type="range"
          min={0}
          max={effectiveDuration || 100}
          value={currentTime}
          onChange={(e) => seek(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Audio Seek Slider"
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Track Metadata & Badges */}
        <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
          <div className="h-10 w-10 rounded-full bg-neel/10 border border-neel/20 flex items-center justify-center shrink-0 text-neel">
            {currentTrack.source === "notice" ? (
              <FileText className="h-5 w-5 text-mustard-dark" />
            ) : currentTrack.source === "assistant" ? (
              <Sparkles className="h-5 w-5 text-mustard-dark" />
            ) : (
              <Volume2 className="h-5 w-5 text-vermilion" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              <span className="px-1.5 py-0.5 rounded uppercase tracking-wider bg-neel text-white text-[10px]">
                {currentTrack.language.toUpperCase()}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-paper-dark text-neel-muted border border-paper-border text-[10px]">
                {currentTrack.source === "notice"
                  ? "Citizen Notice"
                  : currentTrack.source === "assistant"
                  ? "AI Voice Explanation"
                  : "Scheme Explainer"}
              </span>
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-sage-dark font-medium">
                <ShieldCheck className="h-3 w-3" />
                Grounded Voice (Sarvam Bulbul)
              </span>
            </div>
            <h4 className="font-serif text-sm font-bold text-neel truncate" title={currentTrack.title}>
              {currentTrack.title}
            </h4>
            {currentTrack.authority && (
              <p className="text-[11px] text-neel-muted truncate">{currentTrack.authority}</p>
            )}
          </div>
        </div>

        {/* Audio Controls */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {/* Skip -10s */}
          <button
            type="button"
            onClick={() => skip(-10)}
            className="p-2 text-neel hover:text-vermilion transition-colors focus:outline-none focus:ring-2 focus:ring-vermilion/50 rounded-full"
            title="Rewind 10 seconds"
            aria-label="Rewind 10 seconds"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          {/* Play / Pause Toggle */}
          <button
            type="button"
            onClick={togglePlayPause}
            disabled={isLoading}
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center text-white shadow-md transition-all",
              "bg-vermilion hover:bg-vermilion-dark active:scale-95 focus:outline-none focus:ring-2 focus:ring-vermilion/50",
              isLoading && "opacity-80 cursor-wait"
            )}
            title={isPlaying ? "Pause audio explainer" : "Play audio explainer"}
            aria-label={isPlaying ? "Pause audio explainer" : "Play audio explainer"}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </button>

          {/* Skip +10s */}
          <button
            type="button"
            onClick={() => skip(10)}
            className="p-2 text-neel hover:text-vermilion transition-colors focus:outline-none focus:ring-2 focus:ring-vermilion/50 rounded-full"
            title="Fast forward 10 seconds"
            aria-label="Fast forward 10 seconds"
          >
            <RotateCw className="h-4 w-4" />
          </button>

          {/* Time Display */}
          <div className="text-xs font-mono text-neel tabular-nums hidden xs:block">
            <span>{formatTime(currentTime)}</span>
            <span className="text-neel-muted mx-1">/</span>
            <span className="text-neel-muted">{formatTime(effectiveDuration)}</span>
          </div>

          {/* Playback Speed Pill */}
          <button
            type="button"
            onClick={handleNextRate}
            className="px-2 py-1 rounded bg-paper-dark hover:bg-paper-border text-xs font-bold font-mono text-neel transition-colors focus:outline-none"
            title="Change playback speed"
            aria-label={`Playback speed: ${playbackRate}x. Click to change.`}
          >
            {playbackRate}x
          </button>

          {/* Dismiss Player */}
          <button
            type="button"
            onClick={dismiss}
            className="p-1.5 text-neel-muted hover:text-vermilion rounded-full transition-colors focus:outline-none"
            title="Close audio player"
            aria-label="Close audio player"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Error alert banner if playback fails */}
      {error && (
        <div className="bg-vermilion text-white text-xs px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="text-white hover:underline text-[11px] font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}
    </aside>
  );
};
