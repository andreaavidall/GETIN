"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { updatePasswordAction } from "@/lib/actions/auth";

export function NewPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("siguiente");
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const repeat = String(form.get("repeat") ?? "");
    setErrors({});

    if (password !== repeat) {
      setErrors({ repeat: "Las dos contraseñas no coinciden" });
      return;
    }

    startTransition(async () => {
      const result = await updatePasswordAction(password);
      if (!result.ok) {
        setErrors({ password: result.error });
        toast.error("No se pudo cambiar", { description: result.error });
        return;
      }
      toast.success("Contraseña actualizada");
      router.push(next && next.startsWith("/") ? next : "/cuenta");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="surface space-y-4 p-5" noValidate>
      <Field
        label="Contraseña nueva"
        htmlFor="np-password"
        error={errors.password}
        hint="Mínimo 10 caracteres, con mayúscula, minúscula y número"
        required
      >
        <Input id="np-password" name="password" type="password" autoComplete="new-password" />
      </Field>

      <Field label="Repítela" htmlFor="np-repeat" error={errors.repeat} required>
        <Input id="np-repeat" name="repeat" type="password" autoComplete="new-password" />
      </Field>

      <Button type="submit" full size="lg" disabled={pending}>
        {pending ? "Guardando..." : "Guardar contraseña"}
      </Button>

      <p className="text-xs text-muted">
        Si el enlace caducó verás un aviso al guardar. En ese caso pide uno nuevo desde
        «Recuperar contraseña».
      </p>
    </form>
  );
}
