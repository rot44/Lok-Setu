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
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-neel bg-paper border border-paper-border rounded hover:bg-paper-dark transition-colors focus:outline-none focus:ring-2 focus:ring-neel"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Select Language"
      >
        <Globe className="h-3.5 w-3.5 text-vermilion shrink-0" />
        <span>{currentLanguageMeta.nativeName}</span>
        <ChevronDown className="h-3 w-3 text-neel-muted" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-1.5 w-48 origin-top-right bg-white border border-paper-border rounded-md shadow-editorial-lg py-1 z-50 focus:outline-none animate-in fade-in zoom-in-95 duration-100"
          role="menu"
          aria-orientation="vertical"
        >
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neel-muted border-b border-paper-border">
            Choose Language / भाषा चुनें
          </div>
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => handleSelect(l.code)}
              className={cn(
                "flex items-center justify-between w-full px-3.5 py-2 text-xs text-left transition-colors hover:bg-paper",
                language === l.code
                  ? "bg-paper-light font-bold text-vermilion"
                  : "text-neel font-medium"
              )}
              role="menuitem"
            >
              <div className="flex flex-col">
                <span className="text-xs font-semibold">{l.nativeName}</span>
                <span className="text-[10px] text-neel-muted">{l.name}</span>
              </div>
              {language === l.code && (
                <Check className="h-3.5 w-3.5 text-vermilion shrink-0 ml-2" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
