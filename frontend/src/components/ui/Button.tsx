import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neel focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer";

    const variantStyles = {
      primary:
        "bg-neel text-white hover:bg-neel-dark shadow-editorial active:translate-y-0.5",
      secondary:
        "bg-vermilion text-white hover:bg-vermilion-hover shadow-editorial active:translate-y-0.5",
      outline:
        "border-2 border-neel text-neel bg-transparent hover:bg-neel hover:text-white active:translate-y-0.5",
      ghost:
        "text-neel hover:bg-paper-dark hover:text-neel-dark active:bg-paper-border",
      destructive:
        "bg-vermilion-dark text-white hover:bg-red-800 shadow-editorial active:translate-y-0.5",
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs gap-1.5 rounded-sm",
      md: "h-10 px-4 text-sm gap-2 rounded",
      lg: "h-12 px-6 text-base gap-2.5 rounded-md",
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {!isLoading && leftIcon}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";
