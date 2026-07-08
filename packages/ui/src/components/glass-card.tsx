import * as React from "react";

import { cn } from "../lib/cn";

export type GlassCardProps = React.HTMLAttributes<HTMLDivElement> & {
  intensity?: "soft" | "default" | "strong";
};

const intensityClassNames = {
  soft: "border-glass-edge/22 bg-glass-surface/46 shadow-glass-soft",
  default: "border-glass-edge/30 bg-glass-surface/62 shadow-glass",
  strong: "border-glass-edge/40 bg-glass-surface/78 shadow-glass",
};

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, intensity = "default", children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden rounded-glass border backdrop-blur-glass",
        "before:pointer-events-none before:absolute before:inset-px before:rounded-[inherit] before:bg-glass-highlight before:opacity-90",
        "after:pointer-events-none after:absolute after:inset-x-6 after:top-0 after:h-px after:bg-white/85",
        intensityClassNames[intensity],
        className,
      )}
      {...props}
    >
      <div className="relative z-10">{children}</div>
    </div>
  ),
);

GlassCard.displayName = "GlassCard";
