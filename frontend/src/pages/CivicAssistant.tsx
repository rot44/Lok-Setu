import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  MessageSquare,
  Send,
  Sparkles,
  ExternalLink,
  RotateCcw,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  FileText,
  HelpCircle,
  X,
  Volume2,
  VolumeX,
  Loader2,
  Mic,
  MicOff,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAudio } from "@/context/AudioContext";
import { Button } from "@/components/ui/Button";
import {
  assistantService,
  AssistantMessage,
  getStoredSessionId,
  clearStoredSession,
} from "@/services/assistant.service";
import { buildSchemeExplanationPrompt } from "@/utils/aiPrompt";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { BCP47_SPEECH_MAP } from "@/types/voice";
import { cn } from "@/utils/cn";

const SUGGESTED_QUERIES = [
  {
    en: "What is the loan amount and interest subsidy under PM SVANidhi?",
    hi: "पीएम स्वनिधि योजना के तहत कितना ऋण और ब्याज सब्सिडी मिलती है?",
  },
  {
    en: "Who is eligible for PM-KISAN direct income support?",
    hi: "पीएम-किसान योजना के लिए कौन पात्र है और कितना पैसा मिलता है?",
  },
  {
    en: "What hospital treatments are covered under Ayushman Bharat (PM-JAY)?",
    hi: "आयुष्मान भारत योजना के तहत अस्पताल में कितना मुफ्त इलाज मिलता है?",
  },
  {
    en: "What are the rules and subsidies for rooftop solar installation?",
    hi: "घर की छत पर सोलर पैनल लगाने के लिए क्या सब्सिडी मिलती है?",
  },
];

const NOTICE_SUGGESTED_QUERIES = [
  {
    en: "What immediate action should I take to comply with or appeal this notice?",
    hi: "इस नोटिस का पालन करने या अपील करने के लिए मुझे तुरंत क्या कदम उठाने चाहिए?",
  },
  {
    en: "Can authorities take coercive recovery action or disconnect services without a hearing?",
    hi: "क्या अधिकारी बिना सुनवाई के मेरे लाभ रोक सकते हैं या दंडात्मक कार्रवाई कर सकते हैं?",
  },
  {
    en: "What is the exact appeal deadline and which official office handles objections?",
    hi: "अपील की अंतिम तिथि क्या है और आपत्ति दर्ज करने के लिए किस कार्यालय में जाना होगा?",
  },
  {
    en: "What supporting documents and evidence should I prepare and submit?",
    hi: "मुझे कौन-से दस्तावेज और साक्ष्य तैयार करके संबंधित विभाग में जमा करने चाहिए?",
  },
];

const renderInlineMarkdown = (text: string): React.ReactNode => {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-neel">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

export const RenderFormattedCivicText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  const lines = text.split("\n");

  return (
    <div className="space-y-2 font-sans text-sm leading-relaxed text-neel">
      {lines.map((rawLine, idx) => {
        const trimmed = rawLine.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // 1. Heading line (starts with #, ##, ###)
        if (/^#{1,6}\s+/.test(trimmed)) {
          const heading = trimmed.replace(/^#{1,6}\s+/, "");
          return (
            <h4
              key={idx}
              className="font-serif font-bold text-base text-neel tracking-tight pt-2 pb-0.5 first:pt-0"
            >
              {renderInlineMarkdown(heading)}
            </h4>
          );
        }

        // 2. Sub-bullet (indented with 2+ spaces or tabs before bullet)
        if (/^\s{2,}[-*•]\s+/.test(rawLine) || /^(\t+)[-*•]\s+/.test(rawLine)) {
          const content = rawLine.replace(/^\s*[-*•]\s+/, "");
          return (
            <div key={idx} className="ml-5 flex items-start gap-2 text-neel-muted leading-relaxed">
              <span className="text-vermilion/70 shrink-0 font-bold text-xs mt-0.5">•</span>
              <span className="text-neel">{renderInlineMarkdown(content)}</span>
            </div>
          );
        }

        // 3. Top-level bullet
        if (/^[-*•]\s+/.test(trimmed)) {
          const content = trimmed.replace(/^[-*•]\s+/, "");
          return (
            <div key={idx} className="flex items-start gap-2.5 text-neel leading-relaxed pt-0.5">
              <span className="text-vermilion shrink-0 font-bold text-sm leading-none mt-1">•</span>
              <span>{renderInlineMarkdown(content)}</span>
            </div>
          );
        }

        // 4. Regular paragraph
        return (
          <p key={idx} className="leading-relaxed">
            {renderInlineMarkdown(trimmed)}
          </p>
        );
      })}
    </div>
  );
};

export const CivicAssistant: React.FC = () => {
  const { language, t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(() => getStoredSessionId());
  const [activeSchemeBadge, setActiveSchemeBadge] = useState<string | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(() => searchParams.get("documentId"));
  const [lastAttemptedQuery, setLastAttemptedQuery] = useState<string>("");
  const { currentTrack, isPlaying, playTrack, togglePlayPause } = useAudio();
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const voiceAutoPlay = false; // Voice is strictly opt-in: only plays when citizen clicks speaker button
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const autoPromptTriggered = useRef(false);

  const handlePlayAssistantVoice = useCallback(
    async (msg: AssistantMessage) => {
      if (currentTrack?.id === msg.id) {
        togglePlayPause();
        return;
      }

      try {
        setLoadingAudioId(msg.id);
        const audioRes = await assistantService.synthesizeAssistantAudio(
          msg.text,
          msg.languageUsed || language,
          activeSchemeBadge || "AI Scheme Explainer"
        );

        playTrack({
          id: msg.id,
          title: activeSchemeBadge
            ? `${activeSchemeBadge} (AI Explainer)`
            : "AI Scheme Explanation",
          audioUrl: audioRes.audioUrl,
          language: audioRes.language || language,
          authority: "Lok-Setu Civic AI (Sarvam)",
          durationSeconds: audioRes.durationSeconds,
          source: "assistant",
          plainSummary: msg.text,
        });
      } catch (err: unknown) {
        console.warn("Sarvam audio synthesis fallback:", err);
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(msg.text.slice(0, 350));
            utterance.lang = BCP47_SPEECH_MAP[msg.languageUsed || language] || "hi-IN";
            window.speechSynthesis.speak(utterance);
          } catch {
            const errMessage = err instanceof Error ? err.message : "Failed to synthesize voice.";
            setError(errMessage);
          }
        } else {
          const errMessage = err instanceof Error ? err.message : "Failed to synthesize voice.";
          setError(errMessage);
        }
      } finally {
        setLoadingAudioId(null);
      }
    },
    [currentTrack?.id, togglePlayPause, language, activeSchemeBadge, playTrack]
  );

  const handleSend = useCallback(
    async (queryText?: string) => {
      const textToSend = (queryText || inputText || lastAttemptedQuery).trim();
      if (!textToSend || loading) return;

      setLastAttemptedQuery(textToSend);
      setError(null);
      setLoading(true);

      // Optimistically add user message to UI
      const optimisticUserMessage: AssistantMessage = {
        id: `user-${Date.now()}`,
        sender: "user",
        text: textToSend,
        languageUsed: language,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticUserMessage]);
      setInputText("");

      try {
        const response = await assistantService.sendMessage({
          query: textToSend,
          language,
          sessionId: sessionId || undefined,
          documentId: activeDocumentId || undefined,
        });

        if (response.sessionId) {
          setSessionId(response.sessionId);
        }

        setMessages((prev) => [...prev, response.message]);

        // Voice only plays on user explicit interaction (speaker button click)
        if (voiceAutoPlay) {
          handlePlayAssistantVoice(response.message);
        }
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to generate answer. Please try again.";
        setError(errorMsg);
        // Restore user text on failure so user can edit or retry
        setInputText(textToSend);
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMessage.id));
      } finally {
        setLoading(false);
      }
    },
    [inputText, loading, language, sessionId, lastAttemptedQuery, voiceAutoPlay, handlePlayAssistantVoice]
  );

  // Universal Speech Recognition Hook (Two-Way Voice powered by Sarvam AI)
  const {
    isListening,
    isTranscribing,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    language,
    onResult: (transcriptText) => {
      setInputText(transcriptText);
    },
    onEnd: (finalTranscript) => {
      if (finalTranscript && finalTranscript.trim()) {
        handleSend(finalTranscript);
      }
    },
    onError: (speechErr) => {
      setError(speechErr);
    },
  });

  const handleToggleVoiceInput = () => {
    if (isListening) {
      stopListening();
    } else {
      setError(null);
      resetTranscript();
      startListening(language);
    }
  };

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load existing session history if available
  useEffect(() => {
    let isMounted = true;
    const loadSession = async () => {
      const activeSessionId = getStoredSessionId();
      if (!activeSessionId) return;

      try {
        const history = await assistantService.getSessionHistory(activeSessionId);
        if (isMounted && history?.messages && history.messages.length > 0) {
          setMessages(history.messages);
          setSessionId(history.sessionId);
        }
      } catch {
        clearStoredSession();
        if (isMounted) {
          setSessionId(null);
        }
      }
    };

    loadSession();
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-prompt handler when arriving with a specific scheme, preprompt or query
  useEffect(() => {
    const schemeTitle = searchParams.get("schemeTitle");
    const noticeTitle = searchParams.get("noticeTitle");
    const incomingDocId = searchParams.get("documentId");
    const incomingQuery = searchParams.get("query");
    const incomingPreprompt = searchParams.get("preprompt");
    const mode = searchParams.get("mode");
    const autoSend =
      searchParams.get("autoSend") === "1" || searchParams.get("autoSend") === "true";

    if (incomingDocId) {
      setActiveDocumentId(incomingDocId);
    }

    if (
      (schemeTitle || noticeTitle || incomingDocId || incomingQuery || incomingPreprompt || mode === "eligibility" || mode === "notice") &&
      !autoPromptTriggered.current
    ) {
      autoPromptTriggered.current = true;
      const targetTitle = noticeTitle
        ? decodeURIComponent(noticeTitle)
        : schemeTitle
        ? decodeURIComponent(schemeTitle)
        : "";
      
      let generatedPrompt = "";
      if (incomingPreprompt) {
        generatedPrompt = decodeURIComponent(incomingPreprompt);
      } else if (incomingQuery) {
        generatedPrompt = decodeURIComponent(incomingQuery);
      } else if (noticeTitle) {
        generatedPrompt =
          language === "hi"
            ? `कृपया मुझे सरकारी नोटिस "${targetTitle}" के बारे में विस्तार से समझाएं: मेरे क्या अधिकार हैं, अपील की क्या प्रक्रिया है और मुझे क्या करना चाहिए?`
            : `Explain this government notice in detail: "${targetTitle}". What are my citizen rights, appeal procedures, and action steps?`;
      } else if (targetTitle) {
        generatedPrompt = buildSchemeExplanationPrompt(targetTitle, language);
      }

      if (noticeTitle) {
        setActiveSchemeBadge(`Notice: ${targetTitle}`);
      } else if (targetTitle) {
        setActiveSchemeBadge(targetTitle);
      } else if (mode === "eligibility") {
        setActiveSchemeBadge(
          language === "hi"
            ? "पात्रता मूल्यांकन (Eligibility Evaluation)"
            : "Scheme Eligibility Evaluation"
        );
      }

      // Clean URL params quietly so back/reload does not resend
      const cleanParams = new URLSearchParams(searchParams);
      cleanParams.delete("schemeTitle");
      cleanParams.delete("noticeTitle");
      cleanParams.delete("documentId");
      cleanParams.delete("query");
      cleanParams.delete("preprompt");
      cleanParams.delete("mode");
      cleanParams.delete("autoSend");
      cleanParams.delete("schemeId");
      setSearchParams(cleanParams, { replace: true });

      if (generatedPrompt) {
        if (autoSend) {
          handleSend(generatedPrompt);
        } else {
          setInputText(generatedPrompt);
        }
      }
    }
  }, [searchParams, language, setSearchParams, handleSend]);

  const handleResetSession = () => {
    clearStoredSession();
    setSessionId(null);
    setMessages([]);
    setError(null);
    setInputText("");
  };

  const isHindi = language === "hi";

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)] min-h-[550px] flex flex-col bg-white border border-paper-border rounded-lg shadow-editorial-lg overflow-hidden">
      {/* Chat Header */}
      <div className="px-5 py-3.5 border-b border-paper-border bg-paper-light flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-neel text-white shadow-xs">
            <MessageSquare className="h-5 w-5 text-mustard" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-neel text-base">
              {t("nav.assistant")}
            </h2>
            <span className="text-[11px] text-neel-muted font-medium block">
              Grounded strictly in verified Indian government gazettes & policies
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetSession}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              className="text-xs"
            >
              New Chat
            </Button>
          )}
        </div>
      </div>

      {/* Active Scheme / Notice Context Banner */}
      {activeSchemeBadge && (
        <div className="px-5 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-mustard/30 flex items-center justify-between text-xs text-neel animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-vermilion shrink-0" />
            <span>
              {activeSchemeBadge.startsWith("Notice:") ? "Notice Context: " : "Explaining Scheme: "}
              <strong className="font-semibold text-neel">
                {activeSchemeBadge.replace(/^Notice:\s*/, "")}
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveSchemeBadge(null)}
            className="text-neel-muted hover:text-vermilion p-1 transition-colors"
            title="Dismiss badge"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-paper/20">
        {messages.length === 0 && (
          <div className="text-center py-6 sm:py-10 max-w-xl mx-auto space-y-6">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-paper-dark border border-paper-border text-vermilion mb-1">
              <BookOpen className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-neel">
                {activeSchemeBadge?.startsWith("Notice:")
                  ? isHindi
                    ? "इस सरकारी नोटिस के बारे में प्रश्न पूछें"
                    : "Ask questions about this government notice"
                  : isHindi
                  ? "आप किस सरकारी योजना के बारे में जानना चाहते हैं?"
                  : "How can Lok-Setu help you today?"}
              </h3>
              <p className="text-xs sm:text-sm text-neel-muted leading-relaxed">
                {isHindi
                  ? "नीचे दिए गए सुझावों में से चुनें या अपना प्रश्न लिखें। हमारे उत्तर केवल प्रमाणित सरकारी दस्तावेजों से दिए जाते हैं।"
                  : "Ask any question about welfare schemes, municipal regulations, eligibility, or rights. Every claim is cited directly from verified official records."}
              </p>
            </div>

            {/* Suggested Prompt Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-left">
              {(activeSchemeBadge?.startsWith("Notice:") ? NOTICE_SUGGESTED_QUERIES : SUGGESTED_QUERIES).map((q, idx) => {
                const queryPrompt = isHindi ? q.hi : q.en;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(queryPrompt)}
                    className="p-3 rounded border border-paper-border bg-white hover:border-vermilion hover:bg-paper-light transition-all text-left text-xs font-medium text-neel shadow-xs flex items-start gap-2 group cursor-pointer"
                  >
                    <HelpCircle className="h-4 w-4 text-mustard-dark shrink-0 mt-0.5 group-hover:text-vermilion" />
                    <span className="line-clamp-2">{queryPrompt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[92%] sm:max-w-[85%] rounded-lg p-4 sm:p-5 text-sm leading-relaxed shadow-xs transition-all ${
                m.sender === "user"
                  ? "bg-neel text-white rounded-br-none"
                  : "bg-white border border-paper-border text-neel rounded-bl-none space-y-4"
              }`}
            >
              {m.sender === "user" ? (
                <div className="space-y-2">
                  {m.text.includes("Uploaded Notice:") ? (
                    <>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/10 text-xs text-stone-200 border border-white/20">
                        <FileText className="h-3.5 w-3.5 text-stone-300 shrink-0" />
                        <span className="font-semibold">
                          Attached Document:{" "}
                          {m.text.match(/Uploaded Notice:\s*"([^"]+)"/)?.[1] || "Government Notice"}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap font-sans text-sm">
                        {m.text.includes("Citizen Question:")
                          ? m.text.split("Citizen Question:")[1].trim()
                          : m.text}
                      </p>
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  )}
                </div>
              ) : (
                <>
                  {/* Assistant Answer / Summary with rich formatting */}
                  <RenderFormattedCivicText text={m.text} />

                  {/* Grounded Breakdown Details (when available) */}
                  {m.analysis && (
                    <div className="space-y-3 pt-2 border-t border-paper-border text-xs">
                      {/* 1. Stated in Source Facts */}
                      {m.analysis.sourceFacts && m.analysis.sourceFacts.length > 0 && (
                        <div className="bg-sage/20 border border-sage/60 rounded p-3 space-y-1.5">
                          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-neel">
                            <CheckCircle2 className="h-3.5 w-3.5 text-sage-dark shrink-0" />
                            <span>Stated in Official Source</span>
                          </div>
                          <ul className="space-y-1 text-neel-muted pl-4 list-disc marker:text-neel">
                            {m.analysis.sourceFacts.map((fact, idx) => (
                              <li key={idx} className="leading-relaxed">
                                {fact}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 2. Limitations / Missing Info Alert */}
                      {m.analysis.insufficientEvidence && (
                        <div className="bg-mustard/15 border border-mustard rounded p-2.5 flex items-start gap-2 text-neel">
                          <AlertTriangle className="h-4 w-4 text-mustard-dark shrink-0 mt-0.5" />
                          <span className="font-semibold text-xs leading-relaxed">
                            This document does not clearly specify this information.
                          </span>
                        </div>
                      )}

                      {/* 3. Citations Section */}
                      {m.analysis.citations && m.analysis.citations.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-neel-muted flex items-center gap-1">
                            <FileText className="h-3 w-3 text-vermilion" />
                            <span>Verified Source Evidence</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {m.analysis.citations.map((cite, idx) => (
                              <div
                                key={idx}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-paper border border-paper-border text-[11px] font-medium text-neel shadow-xs hover:border-neel transition-colors"
                              >
                                <span className="font-bold text-vermilion">{cite.clauseNumber || `Ref #${idx + 1}`}:</span>
                                <span className="truncate max-w-[200px]" title={cite.title}>
                                  {cite.title}
                                </span>
                                {cite.sourceUrl && (
                                  <a
                                    href={cite.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-neel hover:text-vermilion transition-colors ml-1 p-0.5 rounded hover:bg-paper-dark"
                                    title="Open official government publication"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Spoken AI Voice Explainer Action */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-paper-border/60">
                    <button
                      type="button"
                      onClick={() => handlePlayAssistantVoice(m)}
                      disabled={loadingAudioId === m.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-paper-dark hover:bg-vermilion hover:text-white text-neel transition-all shadow-xs cursor-pointer focus:outline-none"
                      title={currentTrack?.id === m.id && isPlaying ? "Pause spoken explainer" : "Listen to spoken explanation"}
                    >
                      {loadingAudioId === m.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-vermilion" />
                      ) : currentTrack?.id === m.id && isPlaying ? (
                        <VolumeX className="h-3.5 w-3.5 text-white" />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5 text-vermilion" />
                      )}
                      <span>
                        {loadingAudioId === m.id
                          ? "Generating Audio..."
                          : currentTrack?.id === m.id && isPlaying
                          ? "Pause Audio"
                          : "Listen to Explanation (AI Voice)"}
                      </span>
                    </button>
                    <span className="text-[11px] text-neel-muted font-medium flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-mustard-dark" /> Sarvam Bulbul Indic Voice
                    </span>
                  </div>
                </>
              )}
            </div>

            <span className="text-[10px] text-neel-muted mt-1 px-1">
              {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex flex-col items-start space-y-1">
            <div className="bg-white border border-paper-border rounded-lg rounded-bl-none p-4 shadow-xs flex items-center gap-3">
              <div className="h-4 w-4 border-2 border-vermilion border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-neel font-medium">
                Consulting verified government policies and assembling citations...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Banner with Retry */}
      {error && (
        <div className="px-4 py-2.5 bg-vermilion/10 border-t border-vermilion/30 flex items-center justify-between gap-3 text-xs text-vermilion font-medium">
          <div className="flex items-center gap-2 truncate">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSend(lastAttemptedQuery || inputText)}
            className="text-xs h-7 border-vermilion text-vermilion hover:bg-vermilion hover:text-white shrink-0"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Listening Status Banner */}
      {/* Voice Status Banner */}
      {(isListening || isTranscribing) && (
        <div className="px-4 py-2.5 bg-amber-50/90 border-t border-amber-200 flex items-center justify-between text-xs text-amber-900 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vermilion opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-vermilion"></span>
            </span>
            <span className="font-medium">
              {isTranscribing
                ? "Transcribing your voice..."
                : isHindi
                ? "सुन रहे हैं... बोलिए (बोलना समाप्त होने पर माइक दबाएं)"
                : "Listening to your voice... Speak now (Tap mic when done)"}
            </span>
          </div>
          {isListening && (
            <button
              type="button"
              onClick={stopListening}
              className="px-2.5 py-1 rounded bg-stone-900 text-white font-medium text-[11px] hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Done
            </button>
          )}
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 sm:p-4 bg-white border-t border-paper-border flex items-center gap-2 shrink-0"
      >
        {/* Microphone Button */}
        <button
          type="button"
          onClick={handleToggleVoiceInput}
          disabled={loading || isTranscribing}
          className={cn(
            "flex items-center justify-center h-10 w-10 rounded-md transition-all shrink-0 focus:outline-none focus:ring-2 focus:ring-neel cursor-pointer",
            isListening
              ? "bg-vermilion text-white shadow-sm animate-pulse hover:bg-vermilion-dark"
              : isTranscribing
              ? "bg-amber-100 text-amber-800"
              : "bg-paper-light border border-paper-border text-stone-700 hover:text-stone-900 hover:bg-stone-100"
          )}
          title={
            isListening
              ? "Stop listening"
              : isTranscribing
              ? "Transcribing..."
              : "Speak your question"
          }
          aria-label="Toggle microphone"
        >
          {isTranscribing ? (
            <Loader2 className="h-4 w-4 animate-spin text-amber-700" />
          ) : isListening ? (
            <MicOff className="h-4 w-4 text-white" />
          ) : (
            <Mic className="h-4 w-4 text-stone-700" />
          )}
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            isListening
              ? isHindi
                ? "सुन रहे हैं... बोलिए..."
                : "Listening to your voice... speak now..."
              : isTranscribing
              ? "Transcribing..."
              : isHindi
              ? "सरकारी योजनाओं या अधिकारों के बारे में पूछें या माइक दबाएं..."
              : "Ask a question about government welfare, or tap the mic to speak..."
          }
          disabled={loading || isTranscribing}
          className="flex-1 bg-paper-light text-neel placeholder:text-neel-muted/60 text-sm rounded border border-paper-border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-neel disabled:opacity-50"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!inputText.trim() || loading || isTranscribing}
          rightIcon={<Send className="h-4 w-4" />}
          className="shrink-0"
        >
          Send
        </Button>
      </form>
    </div>
  );
};
