import * as React from "react";

import { cn } from "../lib/cn";

export type GlassInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-11 w-full rounded-control border border-input bg-white/58 px-3.5 py-2 text-sm text-foreground shadow-inner-glass backdrop-blur-glass transition",
        "placeholder:text-muted-foreground/68 focus:border-glass-edge/54 focus:bg-white/74 focus:outline-none focus:ring-2 focus:ring-ring/35",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);

GlassInput.displayName = "GlassInput";
