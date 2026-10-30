import React, { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

export interface Option {
  value: string;
  label: string;
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: Option[];
  error?: string;
  helperText?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      options,
      error,
      helperText,
      id,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold uppercase tracking-wider text-neel"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            disabled={disabled}
            className={cn(
              "w-full appearance-none bg-white text-neel text-sm rounded border border-paper-border px-3.5 py-2.5 pr-10 transition-colors focus:outline-none focus:ring-2 focus:ring-neel focus:border-transparent disabled:opacity-50 disabled:bg-paper-dark cursor-pointer",
              error && "border-vermilion focus:ring-vermilion",
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neel-muted pointer-events-none" />
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

Select.displayName = "Select";
