import React from "react";
import { FolderSearch } from "lucide-react";
import { cn } from "@/utils/cn";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-white border border-dashed border-paper-border rounded-lg",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-paper-dark text-neel mb-4">
        {icon || <FolderSearch className="h-7 w-7 text-neel-muted" />}
      </div>
      <h3 className="font-serif text-lg sm:text-xl font-bold text-neel mb-1.5 tracking-tight">
        {title}
      </h3>
      <p className="max-w-md text-xs sm:text-sm text-neel-muted leading-relaxed mb-6">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
};
