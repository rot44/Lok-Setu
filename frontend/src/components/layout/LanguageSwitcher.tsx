import React, { useState, useRef, useEffect } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageCode } from "@/translations";
import { cn } from "@/utils/cn";

export const LanguageSwitcher: React.FC<{ className?: string }> = ({
  className,
}) => {
  const { language, setLanguage, languages, currentLanguageMeta } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (code: LanguageCode) => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={cn("relative inline-block text-left", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neel bg-white hover:bg-paper-light border border-paper-border/80 rounded-full shadow-2xs hover:border-paper-border transition-all focus:outline-none focus:ring-2 focus:ring-neel/20 cursor-pointer"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Select Language"
      >
        <Globe className="h-3.5 w-3.5 text-vermilion shrink-0" />
        <span className="font-medium text-neel">{currentLanguageMeta.nativeName}</span>
        <ChevronDown className={cn("h-3 w-3 text-neel-muted transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-52 origin-top-right bg-white border border-paper-border rounded-xl shadow-editorial-lg py-1.5 z-50 focus:outline-none animate-in fade-in zoom-in-95 duration-100"
          role="menu"
          aria-orientation="vertical"
        >
          <div className="px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-neel-muted/80 border-b border-paper-border/70">
            Choose Language / भाषा चुनें
          </div>
          <div className="py-1 max-h-72 overflow-y-auto">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => handleSelect(l.code)}
                className={cn(
                  "flex items-center justify-between w-full px-3.5 py-2 text-xs text-left transition-colors cursor-pointer",
                  language === l.code
                    ? "bg-neel/5 font-semibold text-vermilion"
                    : "text-neel hover:bg-paper-light font-normal"
                )}
                role="menuitem"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-semibold leading-tight">{l.nativeName}</span>
                  <span className="text-[10px] text-neel-muted/80">{l.name}</span>
                </div>
                {language === l.code && (
                  <Check className="h-3.5 w-3.5 text-vermilion shrink-0 ml-2" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
