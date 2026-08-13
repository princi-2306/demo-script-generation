import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 uppercase tracking-wide",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/20 text-primary border-primary/30",
        secondary:
          "border-transparent bg-surface-raised text-text-muted",
        destructive:
          "border-transparent bg-danger/20 text-danger border-danger/30",
        outline: "text-text border-hairline",
        draft: "border-slate-500/30 bg-slate-500/10 text-slate-400",
        in_review: "border-indigo-500/30 bg-indigo-500/10 text-indigo-400",
        approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        generated: "border-slate-500/30 bg-slate-500/10 text-slate-400",
        edited: "border-indigo-500/30 bg-indigo-500/10 text-indigo-400",
        verified: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
