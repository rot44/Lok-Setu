import React from "react";
import { cn } from "@/utils/cn";

export interface LokSetuLogoProps extends React.SVGProps<SVGSVGElement> {
  variant?: "bridge-beacon" | "modern-arch" | "dharma-shield";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

/**
 * Lok-Setu (लोक सेतु) Official Brand Emblem.
 * Symbolizes the foundational bridge (Setu) connecting Indian citizens to their welfare rights,
 * anchored by institutional pillars and illuminated by the radiant civic sun (Dharma/Welfare).
 */
export const LokSetuLogo: React.FC<LokSetuLogoProps> = ({
  variant = "bridge-beacon",
  size = "md",
  className,
  ...props
}) => {
  const sizeMap = {
    sm: "h-7 w-7",
    md: "h-8.5 w-8.5",
    lg: "h-10 w-10",
    xl: "h-12 w-12",
  };

  const selectedSize = sizeMap[size];

  if (variant === "modern-arch") {
    // Ultra-minimalist geometric interlocking arch
    return (
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(selectedSize, "shrink-0", className)}
        aria-hidden="true"
        {...props}
      >
        <rect width="40" height="40" rx="10" fill="#1C1917" />
        <path
          d="M10 28C10 20.268 16.268 14 24 14H30"
          stroke="#C84C32"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M30 28C30 23.5817 26.4183 20 22 20H10"
          stroke="#E4B65A"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <circle cx="25" cy="14" r="2" fill="#FFFFFF" />
      </svg>
    );
  }

  if (variant === "dharma-shield") {
    // Heraldic civic seal
    return (
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(selectedSize, "shrink-0", className)}
        aria-hidden="true"
        {...props}
      >
        <path
          d="M20 4L32 9V20C32 27.5 26.8 34.2 20 36C13.2 34.2 8 27.5 8 20V9L20 4Z"
          fill="#1C1917"
          stroke="#292524"
          strokeWidth="1.5"
        />
        {/* Setu Arch inside shield */}
        <path
          d="M12 24C12 18.5 15.5 15 20 15C24.5 15 28 24 28 24"
          stroke="#C84C32"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="20" cy="11" r="2.5" fill="#E4B65A" />
      </svg>
    );
  }

  // Default: "bridge-beacon" — The Signature Architectural Setu
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(selectedSize, "shrink-0", className)}
      aria-hidden="true"
      {...props}
    >
      {/* Background Soft Pill/Emblem Badge */}
      <rect
        width="40"
        height="40"
        rx="9"
        className="fill-stone-900 transition-colors duration-200"
      />

      {/* Ground Baseline of Justice */}
      <rect x="6" y="30.5" width="28" height="2" rx="1" fill="#44403C" />

      {/* Left & Right Civic Foundation Pillars */}
      <rect x="7" y="19" width="3.5" height="11.5" rx="1" fill="#78716C" />
      <rect x="29.5" y="19" width="3.5" height="11.5" rx="1" fill="#78716C" />

      {/* The Setu Arch (Sweeping Citizen Bridge in Stamp Vermilion) */}
      <path
        d="M8.5 22.5C8.5 22.5 13.5 14.5 20 14.5C26.5 14.5 31.5 22.5 31.5 22.5"
        stroke="#C84C32"
        strokeWidth="2.75"
        strokeLinecap="round"
      />

      {/* Inner Supportive Arch Ribbon */}
      <path
        d="M11 25.5C13.5 20.5 16.5 18 20 18C23.5 18 26.5 20.5 29 25.5"
        stroke="#E05638"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeOpacity="0.8"
      />

      {/* Subtle Vertical Cable Struts */}
      <line x1="16" y1="18" x2="16" y2="30" stroke="#78716C" strokeWidth="1" strokeDasharray="1.5 1.5" opacity="0.6" />
      <line x1="20" y1="17.5" x2="20" y2="30" stroke="#78716C" strokeWidth="1" strokeDasharray="1.5 1.5" opacity="0.6" />
      <line x1="24" y1="18" x2="24" y2="30" stroke="#78716C" strokeWidth="1" strokeDasharray="1.5 1.5" opacity="0.6" />

      {/* Radiant Civic Sun / Dharmic Beacon (Ashoka Gold) */}
      <circle cx="20" cy="9.5" r="2.8" fill="#E4B65A" />
      {/* Sun Rays */}
      <line x1="20" y1="4.5" x2="20" y2="5.8" stroke="#E4B65A" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="20" y1="13.2" x2="20" y2="14.5" stroke="#E4B65A" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="15" y1="9.5" x2="16.3" y2="9.5" stroke="#E4B65A" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="23.7" y1="9.5" x2="25" y2="9.5" stroke="#E4B65A" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="16.5" y1="6" x2="17.5" y2="7" stroke="#E4B65A" strokeWidth="1" strokeLinecap="round" />
      <line x1="22.5" y1="12" x2="23.5" y2="13" stroke="#E4B65A" strokeWidth="1" strokeLinecap="round" />
      <line x1="16.5" y1="13" x2="17.5" y2="12" stroke="#E4B65A" strokeWidth="1" strokeLinecap="round" />
      <line x1="22.5" y1="7" x2="23.5" y2="6" stroke="#E4B65A" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
};
