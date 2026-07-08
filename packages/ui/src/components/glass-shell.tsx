import * as React from "react";

import { cn } from "../lib/cn";
import { GradientBackground } from "./gradient-background";

export type GlassShellProps = React.HTMLAttributes<HTMLDivElement> & {
  eyebrow?: string;
  title?: string;
};

export function GlassShell({ children, className, eyebrow, title, ...props }: GlassShellProps) {
  return (
    <GradientBackground>
      <main
        className={cn("mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-6 py-8", className)}
        {...props}
      >
        {(eyebrow ?? title) ? (
          <header className="mb-8 flex items-end justify-between gap-6">
            <div className="min-w-0">
              {eyebrow ? (
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700/72">
                  {eyebrow}
                </p>
              ) : null}
              {title ? <h1 className="text-2xl font-semibold text-foreground">{title}</h1> : null}
            </div>
          </header>
        ) : null}
        {children}
      </main>
    </GradientBackground>
  );
}
