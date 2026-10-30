import React from "react";
import { cn } from "@/utils/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  accent?: "none" | "neel" | "vermilion" | "mustard" | "sage";
}

export const Card: React.FC<CardProps> = ({
  className,
  accent = "none",
  children,
  ...props
}) => {
  const accentStyles = {
    none: "",
    neel: "border-t-4 border-t-neel",
    vermilion: "border-t-4 border-t-vermilion",
    mustard: "border-t-4 border-t-mustard",
    sage: "border-t-4 border-t-sage-dark",
  };

  return (
    <div
      className={cn(
        "bg-white border border-paper-border rounded-md shadow-editorial p-5 sm:p-6 transition-all",
        accentStyles[accent],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={cn("space-y-1.5 mb-4", className)} {...props} />;

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  ...props
}) => (
  <h3
    className={cn(
      "font-serif text-lg sm:text-xl font-bold tracking-tight text-neel",
      className
    )}
    {...props}
  />
);

export const CardDescription: React.FC<
  React.HTMLAttributes<HTMLParagraphElement>
> = ({ className, ...props }) => (
  <p className={cn("text-xs sm:text-sm text-neel-muted leading-relaxed", className)} {...props} />
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={cn("space-y-3", className)} {...props} />;

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      "flex items-center justify-between pt-4 mt-4 border-t border-paper-border text-sm",
      className
    )}
    {...props}
  />
);
