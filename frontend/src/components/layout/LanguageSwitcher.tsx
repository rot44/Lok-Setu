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
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 rounded-md hover:bg-stone-100/80 transition-colors focus:outline-none cursor-pointer"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Select Language"
      >
        <Globe className="h-3.5 w-3.5 text-stone-400 shrink-0" />
        <span className="font-medium text-stone-700">{currentLanguageMeta.nativeName}</span>
        <ChevronDown className={cn("h-3 w-3 text-stone-400 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-1.5 w-48 origin-top-right bg-white border border-stone-200 rounded-lg shadow-lg py-1 z-50 focus:outline-none animate-in fade-in zoom-in-95 duration-100"
          role="menu"
          aria-orientation="vertical"
        >
          <div className="px-3 py-1.5 text-[10.5px] font-medium tracking-wide text-stone-400 border-b border-stone-100">
            Select Language • भाषा
          </div>
          <div className="py-1 max-h-72 overflow-y-auto">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => handleSelect(l.code)}
                className={cn(
                  "flex items-center justify-between w-full px-3 py-1.5 text-xs text-left transition-colors cursor-pointer",
                  language === l.code
                    ? "bg-stone-100 font-semibold text-stone-900"
                    : "text-stone-600 hover:bg-stone-50 font-normal"
                )}
                role="menuitem"
              >
                <div className="flex flex-col">
                  <span className="text-xs leading-tight">{l.nativeName}</span>
                  <span className="text-[10px] text-stone-400">{l.name}</span>
                </div>
                {language === l.code && (
                  <Check className="h-3.5 w-3.5 text-stone-900 shrink-0 ml-2" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
