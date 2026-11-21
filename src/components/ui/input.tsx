import * as React from "react";

import { cn } from "@/lib/utils";

const baseField =
  "w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm text-paper placeholder:text-muted/70 transition-colors hover:border-white/25 focus:border-lime focus:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input ref={ref} type={type} className={cn(baseField, "h-11", className)} {...props} />
  ),
);
Input.displayName = "Input";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 4, ...props }, ref) => (
  <textarea ref={ref} rows={rows} className={cn(baseField, "py-3", className)} {...props} />
));
Textarea.displayName = "Textarea";

/**
 * Select nativo con estilo propio.
 *
 * Decision deliberada frente al select de Radix: en movil el selector nativo es
 * mas rapido, accesible por defecto y no necesita JavaScript. Los filtros del
 * explorador son justamente lo que mas se usa desde el celular.
 */
const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        baseField,
        "h-11 appearance-none pr-10 [&>option]:bg-surface [&>option]:text-paper",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
));
Select.displayName = "Select";

export { Input, Textarea, Select };
