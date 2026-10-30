import React from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { GlobalAudioPlayer } from "@/components/voice/GlobalAudioPlayer";
import { useAudio } from "@/context/AudioContext";

export const AppLayout: React.FC = () => {
  const { currentTrack } = useAudio();

  return (
    <div className="min-h-screen flex flex-col bg-paper text-neel">
      <Header />
      <main
        className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 transition-all ${
          currentTrack ? "pb-24 sm:pb-20" : ""
        }`}
      >
        <Outlet />
      </main>
      <Footer />
      <GlobalAudioPlayer />
    </div>
  );
};
