import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";

const glassBadgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium shadow-glass-soft backdrop-blur-glass",
  {
    variants: {
      tone: {
        neutral: "border-glass-edge/28 bg-white/56 text-muted-foreground",
        success: "border-emerald-300/38 bg-emerald-50/72 text-emerald-700",
        warning: "border-amber-300/42 bg-amber-50/74 text-amber-700",
        premium: "border-sky-300/42 bg-sky-50/78 text-sky-700",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export type GlassBadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof glassBadgeVariants>;

export function GlassBadge({ className, tone, ...props }: GlassBadgeProps) {
  return <span className={cn(glassBadgeVariants({ className, tone }))} {...props} />;
}
