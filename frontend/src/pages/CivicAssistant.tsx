import React, { useState } from "react";
import { MessageSquare, Send, ShieldAlert, Sparkles } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/Button";

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
}

export const CivicAssistant: React.FC = () => {
  const { t } = useLanguage();
  const [messages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "assistant",
      text: "नमस्ते! मैं लोक सेतु नागरिक सहायक हूँ। आप मुझसे किसी भी सरकारी योजना, छात्रवृत्ति, कानूनी अधिकार, व्यापार नियमों या पात्रता के बारे में पूछ सकते हैं।",
      timestamp: "Just now",
    },
  ]);
  const [inputText, setInputText] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setInputText("");
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-14rem)] min-h-[500px] flex flex-col bg-white border border-paper-border rounded-lg shadow-editorial-lg overflow-hidden">
      {/* Chat Header */}
      <div className="px-5 py-4 border-b border-paper-border bg-paper-light flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-neel text-white">
            <MessageSquare className="h-4 w-4 text-mustard" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-neel text-base">
              {t("nav.assistant")}
            </h2>
            <span className="text-[11px] text-neel-muted flex items-center gap-1 font-medium">
              <Sparkles className="h-3 w-3 text-vermilion" /> Grounded in Government Gazettes
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-paper-dark text-[11px] font-semibold text-neel-muted">
          <ShieldAlert className="h-3.5 w-3.5 text-mustard-dark" />
          <span>Informational Guidance Only</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-paper/30">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${
              m.sender === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-lg p-4 text-sm leading-relaxed shadow-xs ${
                m.sender === "user"
                  ? "bg-neel text-white rounded-br-none"
                  : "bg-white border border-paper-border text-neel rounded-bl-none"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
            </div>
            <span className="text-[10px] text-neel-muted mt-1 px-1">
              {m.timestamp}
            </span>
          </div>
        ))}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={handleSend}
        className="p-3 sm:p-4 bg-white border-t border-paper-border flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask a question about government policies, MSME benefits, or legal notices..."
          className="flex-1 bg-paper-light text-neel placeholder:text-neel-muted/60 text-sm rounded border border-paper-border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-neel"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!inputText.trim()}
          rightIcon={<Send className="h-4 w-4" />}
        >
          Send
        </Button>
      </form>
    </div>
  );
};
