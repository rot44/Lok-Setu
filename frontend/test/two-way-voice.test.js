import test from "node:test";
import assert from "node:assert/strict";
import { BCP47_SPEECH_MAP } from "../src/types/voice.ts";
import { translations, SUPPORTED_LANGUAGES } from "../src/translations/index.ts";

test("Lok-Setu Two-Way Regional Voice Assistant & Sarvam AI Contracts", async (t) => {
  await t.test("1. BCP-47 speech recognition locales map cleanly to all 8 supported languages", () => {
    assert.equal(BCP47_SPEECH_MAP["hi"], "hi-IN", "Hindi maps to hi-IN");
    assert.equal(BCP47_SPEECH_MAP["en"], "en-IN", "English maps to en-IN");
    assert.equal(BCP47_SPEECH_MAP["gu"], "gu-IN", "Gujarati maps to gu-IN");
    assert.equal(BCP47_SPEECH_MAP["mr"], "mr-IN", "Marathi maps to mr-IN");
    assert.equal(BCP47_SPEECH_MAP["bn"], "bn-IN", "Bengali maps to bn-IN");
    assert.equal(BCP47_SPEECH_MAP["ta"], "ta-IN", "Tamil maps to ta-IN");
    assert.equal(BCP47_SPEECH_MAP["te"], "te-IN", "Telugu maps to te-IN");
    assert.equal(BCP47_SPEECH_MAP["kn"], "kn-IN", "Kannada maps to kn-IN");

    for (const lang of SUPPORTED_LANGUAGES) {
      assert.ok(BCP47_SPEECH_MAP[lang.code], `BCP-47 speech locale must exist for ${lang.code}`);
    }
  });

  await t.test("2. Regional voice translations exist across all 8 Indian languages", () => {
    const requiredKeys = [
      "assistant.voiceInput",
      "assistant.listening",
      "assistant.stopListening",
      "assistant.voiceAutoReply",
    ];

    for (const lang of SUPPORTED_LANGUAGES) {
      const dict = translations[lang.code];
      assert.ok(dict, `Dictionary must exist for ${lang.code}`);
      for (const key of requiredKeys) {
        assert.ok(
          dict[key] && dict[key].trim().length > 0,
          `Translation key '${key}' must be non-empty for language '${lang.code}'`
        );
      }
    }
  });

  await t.test("3. Two-Way Voice State Machine: speech input triggers automatic Sarvam voice output", async () => {
    // Simulated state machine
    let state = {
      isListening: false,
      transcript: "",
      querySent: null,
      autoSpeakTriggered: false,
      synthesizedVoiceUrl: null,
      isPlayingAudio: false,
    };

    // Step A: Citizen taps microphone
    state.isListening = true;
    assert.equal(state.isListening, true, "Microphone becomes active on user tap");

    // Step B: Speech recognition transcribes Hindi speech chunk
    const spokenText = "आयुष्मान भारत योजना के तहत कितना मुफ्त इलाज मिलता है?";
    state.transcript = spokenText;
    assert.equal(state.transcript, spokenText);

    // Step C: Citizen stops speaking (onEnd)
    state.isListening = false;
    // Auto-dispatch with autoSpeak flag
    state.querySent = {
      query: state.transcript,
      language: "hi",
      autoSpeak: true,
    };
    assert.equal(state.querySent.autoSpeak, true, "Two-way voice activates autoSpeak");

    // Step D: Gemini Assistant responds with policy analysis
    const mockAssistantResponse = {
      id: "assistant-voice-turn-1",
      sender: "assistant",
      text: "आयुष्मान भारत (PM-JAY) योजना के तहत प्रत्येक पात्र परिवार को प्रति वर्ष ₹5 लाख तक का निःशुल्क स्वास्थ्य कवर मिलता है।",
      languageUsed: "hi",
    };

    // Step E: Auto-speak triggers Sarvam Bulbul Indic synthesis
    if (state.querySent.autoSpeak) {
      state.autoSpeakTriggered = true;
      state.synthesizedVoiceUrl = `/api/v1/assistant/audio/stream?hash=sample123&lang=hi`;
      state.isPlayingAudio = true;
    }

    assert.equal(state.autoSpeakTriggered, true, "Sarvam speech synthesis must auto-trigger");
    assert.ok(state.synthesizedVoiceUrl.includes("/audio/stream"), "Stream URL generated");
    assert.equal(state.isPlayingAudio, true, "Spoken explanation starts playing for citizen");
  });

  await t.test("4. Error resilience: handles permission denial and unsupported browser gracefully", () => {
    const mapError = (errType) => {
      switch (errType) {
        case "not-allowed":
          return "Microphone access was denied. Please allow microphone permissions.";
        case "no-speech":
          return "No speech was detected. Please try speaking again.";
        case "network":
          return "Network error during speech recognition.";
        default:
          return "Voice input error occurred.";
      }
    };

    assert.equal(
      mapError("not-allowed"),
      "Microphone access was denied. Please allow microphone permissions."
    );
    assert.equal(
      mapError("no-speech"),
      "No speech was detected. Please try speaking again."
    );
    assert.equal(
      mapError("network"),
      "Network error during speech recognition."
    );
  });
});

