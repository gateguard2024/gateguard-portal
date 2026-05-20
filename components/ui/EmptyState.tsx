"use client";

import React from "react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8">
      {icon && (
        <div className="bg-muted rounded-full p-4 mb-4">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-foreground mb-1">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="bg-[#6B7EFF] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#5a6ee0] transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export { EmptyState };
export default EmptyState;
