"use client";
import { Sparkles, Search } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface AISearchProps {
  placeholder?: string;
  className?: string;
}

export function AISearch({ placeholder = 'Try searching "show all offline cameras"', className }: AISearchProps) {
  const [focused, setFocused] = useState(false);
  const [value, setValue] = useState("");

  return (
    <div className={cn(
      "flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card transition-all duration-200",
      focused && "ai-search-glow border-brand-500/40",
      className
    )}>
      <Sparkles
        size={15}
        className={cn(
          "shrink-0 transition-colors",
          focused || value ? "text-brand-400" : "text-muted-foreground/50"
        )}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none min-w-0"
      />
      {value && (
        <button className="shrink-0 p-1 rounded-md bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 transition-colors">
          <Search size={13} />
        </button>
      )}
    </div>
  );
}
