import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Boton base (patron shadcn/ui, adaptado a la paleta GETIN).
 *
 * `primary` es amarillo lima y se reserva para la accion principal de cada
 * pantalla: comprar, reservar, apuntarse. Si hay dos botones lima en una
 * vista, uno de los dos esta mal.
 *
 * Altura minima de 44px en movil para cumplir el tamaño de toque accesible.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-lime text-ink hover:bg-lime-600 shadow-[0_0_0_0_rgba(223,255,0,0)] hover:shadow-[0_6px_24px_-6px_rgba(223,255,0,0.5)]",
        secondary: "bg-white/10 text-paper hover:bg-white/[0.16]",
        outline: "border border-white/20 bg-transparent text-paper hover:border-white/40 hover:bg-white/5",
        ghost: "text-muted hover:bg-white/5 hover:text-paper",
        danger: "bg-red-500/90 text-white hover:bg-red-500",
        link: "text-lime underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-11 px-5",
        lg: "h-12 px-7 text-base",
        icon: "h-11 w-11",
      },
      full: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", full: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, full, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, full }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
