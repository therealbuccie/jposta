import * as React from "react";

import { cn } from "../lib/cn";

export type GradientBackgroundProps = React.HTMLAttributes<HTMLDivElement>;

export function GradientBackground({ className, children, ...props }: GradientBackgroundProps) {
  return (
    <div
      className={cn(
        "relative min-h-dvh overflow-hidden bg-jposta-gradient text-foreground",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_18%_18%,rgba(125,211,252,0.38),transparent_26rem),radial-gradient(circle_at_82%_10%,rgba(221,214,254,0.42),transparent_24rem),radial-gradient(circle_at_54%_82%,rgba(186,230,253,0.34),transparent_30rem)] before:blur-2xl before:animate-aurora-drift",
        "after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(rgba(255,255,255,0.75)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.14)_1px,transparent_1px)] after:bg-[size:92px_92px] after:opacity-35",
        className,
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 z-[1] opacity-90" aria-hidden="true">
        <div className="absolute left-[7%] top-[14%] h-48 w-48 animate-soft-float rounded-full border border-white/70 bg-white/35 shadow-glass blur-[1px]" />
        <div className="absolute right-[10%] top-[9%] h-64 w-64 animate-soft-float-delayed rounded-[5rem] border border-sky-100/70 bg-sky-100/28 shadow-glass blur-[1px]" />
        <div className="absolute bottom-[10%] left-[34%] h-56 w-56 animate-soft-float rounded-[4.5rem] border border-violet-100/70 bg-violet-100/24 shadow-glass blur-[1px]" />
        <div className="absolute inset-0 animate-particle-drift bg-[radial-gradient(circle_at_20%_30%,rgba(56,189,248,0.22)_0_1px,transparent_1px),radial-gradient(circle_at_70%_20%,rgba(139,92,246,0.16)_0_1px,transparent_1px),radial-gradient(circle_at_82%_68%,rgba(14,165,233,0.15)_0_1px,transparent_1px),radial-gradient(circle_at_34%_78%,rgba(255,255,255,0.72)_0_1px,transparent_1px)] bg-[length:240px_240px] opacity-45" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
