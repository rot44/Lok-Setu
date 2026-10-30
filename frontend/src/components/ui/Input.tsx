import React, { forwardRef, useId } from "react";
import { cn } from "@/utils/cn";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-neel"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-neel-muted pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            type={type}
            disabled={disabled}
            className={cn(
              "w-full bg-white text-neel placeholder:text-neel-muted/60 text-sm rounded border border-paper-border px-3.5 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-neel focus:border-transparent disabled:opacity-50 disabled:bg-paper-dark",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error && "border-vermilion focus:ring-vermilion",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 text-neel-muted">{rightIcon}</div>
          )}
        </div>
        {error ? (
          <p className="text-xs font-medium text-vermilion">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-neel-muted">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
