import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
  {
    variants: {
      variant: {
        neutral: "bg-white/10 text-paper",
        lime: "bg-lime text-ink",
        outline: "border border-white/20 text-muted",
        success: "bg-emerald-400/15 text-emerald-300",
        warning: "bg-amber-400/15 text-amber-300",
        danger: "bg-red-500/15 text-red-300",
        /** Aviso de dato ficticio: tiene que cantar, no disimular. */
        demo: "bg-amber-400 text-ink",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Etiqueta de disponibilidad reutilizable en tarjetas y detalle. */
export function AvailabilityBadge({
  tone,
  label,
}: {
  tone: "available" | "low" | "soldout" | "closed";
  label: string;
}) {
  const variant = {
    available: "success",
    low: "warning",
    soldout: "danger",
    closed: "outline",
  }[tone] as BadgeProps["variant"];
  return <Badge variant={variant}>{label}</Badge>;
}

export { badgeVariants };
