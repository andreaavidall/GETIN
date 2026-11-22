"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { requestPasswordResetAction } from "@/lib/actions/auth";
import { emailSchema } from "@/lib/validation/schemas";

export function RecoverForm() {
  const params = useSearchParams();
  const next = params.get("siguiente") ?? undefined;
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginHref = next ? `/login?siguiente=${encodeURIComponent(next)}` : "/login";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Correo inválido");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await requestPasswordResetAction(parsed.data, next);
      if (!result.ok) {
        toast.error("No se pudo enviar el enlace", { description: result.error });
        setError(result.error);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="surface flex flex-col items-center gap-3 p-6 text-center">
        <MailCheck className="size-8 text-lime" />
        <h2 className="font-display text-lg font-semibold">Revisa tu correo</h2>
        <p className="text-sm text-muted">
          Si esa dirección tiene una cuenta en GETIN, le acaba de llegar un enlace para elegir una
          contraseña nueva. El enlace caduca en una hora.
        </p>
        <p className="text-xs text-muted">
          ¿No lo ves? Mira en la carpeta de correo no deseado antes de volver a pedirlo.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-2">
          <Link href={loginHref}>Volver a iniciar sesión</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="surface space-y-4 p-5" noValidate>
      <Field label="Correo de tu cuenta" htmlFor="rec-email" error={error ?? undefined} required>
        <Input
          id="rec-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="tu@correo.com"
        />
      </Field>

      <Button type="submit" full size="lg" disabled={pending}>
        {pending ? "Enviando..." : "Enviarme el enlace"}
      </Button>

      <p className="border-t border-white/10 pt-4 text-center text-sm text-muted">
        ¿Te acordaste?{" "}
        <Link href={loginHref} className="text-lime hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
