import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";

const glassButtonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-medium",
    "transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-0",
    "disabled:pointer-events-none disabled:opacity-45",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-glass-soft hover:translate-y-[-1px] hover:bg-primary/90",
        glass:
          "border border-glass-edge/32 bg-white/58 text-foreground shadow-glass-soft backdrop-blur-glass hover:-translate-y-0.5 hover:border-glass-edge/48 hover:bg-white/72",
        subtle:
          "border border-transparent bg-sky-50/55 text-muted-foreground hover:bg-white/72 hover:text-foreground",
        ghost: "text-muted-foreground hover:bg-white/62 hover:text-foreground",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-5 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "glass",
    },
  },
);

export type GlassButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof glassButtonVariants> & {
    asChild?: boolean;
  };

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ asChild = false, className, size, variant, ...props }, ref) => {
    const Component = asChild ? Slot : "button";

    return (
      <Component
        ref={ref}
        className={cn(glassButtonVariants({ className, size, variant }))}
        {...props}
      />
    );
  },
);

GlassButton.displayName = "GlassButton";
