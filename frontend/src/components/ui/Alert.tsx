import React from "react";
import { Info, CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react";
import { cn } from "@/utils/cn";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "error";
  title?: string;
  onDismiss?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  className,
  variant = "info",
  title,
  onDismiss,
  children,
  ...props
}) => {
  const variantStyles = {
    info: "bg-paper-light border-neel/30 text-neel",
    success: "bg-emerald-50/60 border-emerald-600/40 text-emerald-950",
    warning: "bg-amber-50/80 border-mustard-dark/50 text-amber-950",
    error: "bg-red-50/80 border-vermilion/40 text-vermilion-dark",
  };

  const icons = {
    info: <Info className="h-5 w-5 text-neel shrink-0" />,
    success: <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0" />,
    warning: <AlertTriangle className="h-5 w-5 text-mustard-dark shrink-0" />,
    error: <XCircle className="h-5 w-5 text-vermilion shrink-0" />,
  };

  return (
    <div
      role="alert"
      className={cn(
        "relative flex items-start gap-3 p-4 rounded border text-sm shadow-xs",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      <div className="mt-0.5">{icons[variant]}</div>
      <div className="flex-1 space-y-1">
        {title && <h5 className="font-semibold tracking-tight">{title}</h5>}
        <div className="text-xs sm:text-sm leading-relaxed">{children}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 -mr-1 -mt-1 text-neel-muted hover:text-neel rounded hover:bg-paper-dark transition-colors"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
