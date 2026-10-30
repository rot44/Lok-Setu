import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "dialog-title" : undefined}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neel-dark/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog Surface */}
      <div
        ref={dialogRef}
        className={cn(
          "relative w-full max-w-lg bg-white border border-paper-border rounded-lg shadow-editorial-lg p-6 z-10 animate-in fade-in zoom-in-95 duration-150",
          className
        )}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-neel-muted hover:text-neel hover:bg-paper-dark rounded transition-colors focus:outline-none focus:ring-2 focus:ring-neel"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {title && (
          <h2
            id="dialog-title"
            className="font-serif text-xl font-bold text-neel tracking-tight mb-1"
          >
            {title}
          </h2>
        )}

        {description && (
          <p className="text-sm text-neel-muted mb-4">{description}</p>
        )}

        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
};
