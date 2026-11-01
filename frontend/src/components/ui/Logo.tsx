import React from "react";
import logoUrl from "@/assets/logo.jpg";
import { cn } from "@/utils/cn";

export interface LogoProps {
  className?: string;
  imageClassName?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  textClassName?: string;
}

const sizeMap = {
  xs: "h-6 w-auto",
  sm: "h-8 w-auto",
  md: "h-10 w-auto",
  lg: "h-16 w-auto",
  xl: "h-24 w-auto",
};

export const Logo: React.FC<LogoProps> = ({
  className,
  imageClassName,
  size = "sm",
  showText = false,
  textClassName,
}) => {
  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <img
        src={logoUrl}
        alt="Lok-Setu"
        className={cn(
          sizeMap[size],
          "rounded-md object-contain shadow-xs border border-stone-800/20",
          imageClassName
        )}
      />
      {showText && (
        <div className={cn("flex items-baseline gap-1.5 whitespace-nowrap", textClassName)}>
          <span className="font-serif text-lg font-bold tracking-tight text-stone-900">
            लोक सेतु
          </span>
          <span className="text-stone-300 font-light text-base">/</span>
          <span className="font-sans text-sm font-semibold tracking-tight text-stone-700">
            Lok-Setu
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
