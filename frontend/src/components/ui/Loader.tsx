import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

export interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  text?: string;
}

export const Loader: React.FC<LoaderProps> = ({
  size = "md",
  text,
  className,
  ...props
}) => {
  const sizeStyles = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-10 w-10",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center justify-center gap-2 text-neel", className)}
      {...props}
    >
      <Loader2 className={cn("animate-spin text-vermilion", sizeStyles[size])} />
      {text && <span className="text-xs font-medium text-neel-muted">{text}</span>}
      <span className="sr-only">Loading...</span>
    </div>
  );
};
