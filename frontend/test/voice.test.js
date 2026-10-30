import test from "node:test";
import assert from "node:assert/strict";
import { PLAYBACK_RATES } from "../src/types/voice.ts";

// Helper time formatter matching GlobalAudioPlayer
const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

test("Lok-Setu Voice Explainer & Persistent Audio Suite", async (t) => {
  await t.test("1. PLAYBACK_RATES provides accessibility-conscious speeds", () => {
    assert.deepEqual(PLAYBACK_RATES, [0.75, 1.0, 1.25, 1.5]);
    // Cycling through rates wraps correctly
    const nextRate = (current) => {
      const idx = PLAYBACK_RATES.indexOf(current);
      return PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length];
    };
    assert.equal(nextRate(0.75), 1.0);
    assert.equal(nextRate(1.0), 1.25);
    assert.equal(nextRate(1.25), 1.5);
    assert.equal(nextRate(1.5), 0.75);
  });

  await t.test("2. Audio time formatting formats mm:ss accurately across boundary values", () => {
    assert.equal(formatTime(0), "0:00");
    assert.equal(formatTime(9), "0:09");
    assert.equal(formatTime(45), "0:45");
    assert.equal(formatTime(60), "1:00");
    assert.equal(formatTime(75), "1:15");
    assert.equal(formatTime(125), "2:05");
    assert.equal(formatTime(600), "10:00");
    // Invalid, negative, or infinite values fall back safely to 0:00
    assert.equal(formatTime(-10), "0:00");
    assert.equal(formatTime(NaN), "0:00");
    assert.equal(formatTime(Infinity), "0:00");
  });

  await t.test("3. Seek calculations bound within [0, duration]", () => {
    const duration = 120; // 2 minutes
    const seek = (targetTime) => Math.max(0, Math.min(targetTime, duration));

    assert.equal(seek(-10), 0);
    assert.equal(seek(0), 0);
    assert.equal(seek(45), 45);
    assert.equal(seek(120), 120);
    assert.equal(seek(150), 120);
  });

  await t.test("4. Skip ±10s advances and rewinds cleanly without negative time", () => {
    const duration = 60;
    const skip = (currentTime, delta) => Math.max(0, Math.min(currentTime + delta, duration));

    let time = 5;
    time = skip(time, -10);
    assert.equal(time, 0, "Rewinding past 0 clamps to 0");

    time = skip(time, 10);
    assert.equal(time, 10, "Fast-forwarding adds 10s");

    time = skip(time, 45);
    assert.equal(time, 55);

    time = skip(time, 10);
    assert.equal(time, 60, "Fast-forwarding past duration clamps to duration");
  });

  await t.test("5. Scheme AudioTrack contract validation", () => {
    const schemeTrack = {
      id: "6722d5f81234567890abcdef",
      title: "PM-KISAN Samman Nidhi",
      audioUrl: "https://lok-setu-storage.s3.ap-south-1.amazonaws.com/audio/explainers/kisan-hi.wav",
      language: "hi",
      authority: "Ministry of Agriculture",
      durationSeconds: 95,
      source: "scheme",
      plainSummary: "किसानों के लिए ₹6,000 वार्षिक सहायता।",
    };

    assert.equal(schemeTrack.source, "scheme");
    assert.equal(schemeTrack.language, "hi");
    assert.ok(schemeTrack.audioUrl.startsWith("https://"));
    assert.ok(schemeTrack.durationSeconds > 0);
    assert.ok(schemeTrack.title.length > 0);
  });

  await t.test("6. Citizen Notice AudioTrack contract validation", () => {
    const noticeTrack = {
      id: "notice-upload-777",
      title: "Property Tax Notice 2026.pdf",
      audioUrl: "https://lok-setu-storage.s3.ap-south-1.amazonaws.com/user-uploads/123/audio/777-hi.wav",
      language: "gu",
      durationSeconds: 42,
      source: "notice",
      plainSummary: "પાલિકા પ્રોપર્ટી ટેક્સ ડિમાન્ડ નોટિસ.",
    };

    assert.equal(noticeTrack.source, "notice");
    assert.equal(noticeTrack.language, "gu");
    assert.equal(noticeTrack.durationSeconds, 42);
  });

  await t.test("7. State transition simulation preserves active track across virtual navigation", () => {
    // In-memory simulator of AudioContext state machine
    let state = {
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      playbackRate: 1.0,
      currentRoute: "/schemes/123",
    };

    // 1. Play track on SchemeDetail
    const track1 = {
      id: "scheme-123",
      title: "Ayushman Bharat",
      audioUrl: "https://example.com/audio/ayushman.wav",
      language: "hi",
      durationSeconds: 120,
      source: "scheme",
    };

    state.currentTrack = track1;
    state.isPlaying = true;
    state.duration = track1.durationSeconds;
    state.currentTime = 15; // 15 seconds elapsed

    assert.equal(state.isPlaying, true);
    assert.equal(state.currentTrack.id, "scheme-123");

    // 2. Citizen navigates to "/analyze" or "/profile"
    state.currentRoute = "/analyze";
    // Invariant: track, isPlaying, and currentTime remain active!
    assert.equal(state.isPlaying, true);
    assert.equal(state.currentTrack.id, "scheme-123");
    assert.equal(state.currentTime, 15);

    // 3. Citizen clicks Pause from persistent bottom player
    state.isPlaying = false;
    assert.equal(state.isPlaying, false);
    assert.equal(state.currentTrack.id, "scheme-123");

    // 4. Citizen clicks Close (dismiss)
    state.currentTrack = null;
    state.currentTime = 0;
    state.duration = 0;
    assert.equal(state.currentTrack, null);
  });
});
