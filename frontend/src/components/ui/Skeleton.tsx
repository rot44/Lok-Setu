import React from "react";
import { cn } from "@/utils/cn";

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => {
  return (
    <div
      className={cn("animate-pulse bg-paper-border/60 rounded", className)}
      aria-hidden="true"
      {...props}
    />
  );
};
