"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { signInAction, signUpAction } from "@/lib/actions/auth";
import { signInSchema, signUpSchema } from "@/lib/validation/schemas";

type Errors = Record<string, string>;

/**
 * Formulario de acceso y registro.
 *
 * Válida con el MISMO esquema zod que el servidor: la validación del navegador
 * es solo para dar respuesta rápida, y la que decide es la del servidor.
 */
export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Errors>({});

  const next = params.get("siguiente") ?? undefined;
  const withNext = (path: string) =>
    next ? `${path}?siguiente=${encodeURIComponent(next)}` : path;
  const justRegistered = params.get("registrado") === "1";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrors({});

    const raw =
      mode === "signup"
        ? {
            fullName: String(form.get("fullName") ?? ""),
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
            phone: String(form.get("phone") ?? ""),
            birthdate: String(form.get("birthdate") ?? ""),
            acceptTerms: form.get("acceptTerms") === "on",
          }
        : {
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
          };

    const schema = mode === "signup" ? signUpSchema : signInSchema;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    startTransition(async () => {
      const result =
        mode === "signup" ? await signUpAction(parsed.data) : await signInAction(parsed.data, next);

      if (!result.ok) {
        toast.error(result.error);
        setErrors({ form: result.error });
        return;
      }
      router.push(result.next);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="surface space-y-4 p-5" noValidate>
      {justRegistered ? (
        <p className="rounded-xl bg-lime/10 p-3 text-sm text-lime">
          Cuenta creada. Si tu proyecto exige confirmar el correo, revisa tu bandeja antes de
          entrar.
        </p>
      ) : null}

      {mode === "signup" ? (
        <Field label="Nombre completo" htmlFor="fullName" error={errors.fullName} required>
          <Input id="fullName" name="fullName" autoComplete="name" placeholder="Camila Rojas" />
        </Field>
      ) : null}

      <Field label="Correo" htmlFor="email" error={errors.email} required>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="tu@correo.com"
        />
      </Field>

      <Field
        label="Contraseña"
        htmlFor="password"
        error={errors.password}
        hint={mode === "signup" ? "Mínimo 10 caracteres, con mayuscula, minuscula y número" : undefined}
        required
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
      </Field>

      {mode === "signup" ? (
        <>
          <Field
            label="Teléfono"
            htmlFor="phone"
            error={errors.phone}
            hint="Opcional. Lo usamos solo para avisos de tu reserva."
          >
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="987654321"
            />
          </Field>

          <Field
            label="Fecha de nacimiento"
            htmlFor="birthdate"
            error={errors.birthdate}
            hint="GETIN es solo para mayores de 18 años."
            required
          >
            <Input id="birthdate" name="birthdate" type="date" />
          </Field>

          <label className="flex items-start gap-2 text-xs text-muted">
            <input type="checkbox" name="acceptTerms" className="mt-0.5 size-4 accent-lime" />
            <span>
              Acepto los{" "}
              <Link href="/legal/terminos" className="text-lime hover:underline">
                terminos y condiciones
              </Link>{" "}
              y la{" "}
              <Link href="/legal/privacidad" className="text-lime hover:underline">
                política de privacidad
              </Link>
              .
            </span>
          </label>
          {errors.acceptTerms ? (
            <p role="alert" className="text-xs text-red-400">
              {errors.acceptTerms}
            </p>
          ) : null}
        </>
      ) : null}

      {errors.form ? (
        <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
          {errors.form}
        </p>
      ) : null}

      <Button type="submit" full size="lg" disabled={pending}>
        {pending
          ? "Un momento..."
          : mode === "signup"
            ? "Crear mi cuenta"
            : "Iniciar sesión"}
      </Button>

      {/* Estos enlaces arrastran `siguiente`. Antes se perdía: quien llegaba
          desde un evento para comprar acababa en su cuenta y tenía que volver
          a buscar el evento. */}
      <div className="flex flex-col gap-2 border-t border-white/10 pt-4 text-center text-sm">
        {mode === "signin" ? (
          <>
            <Link href={withNext("/recuperar")} className="text-muted hover:text-paper">
              ¿Olvidaste tu contraseña?
            </Link>
            <p className="text-muted">
              ¿No tienes cuenta?{" "}
              <Link href={withNext("/registro")} className="text-lime hover:underline">
                Regístrate
              </Link>
            </p>
          </>
        ) : (
          <p className="text-muted">
            ¿Ya tienes cuenta?{" "}
            <Link href={withNext("/login")} className="text-lime hover:underline">
              Inicia sesión
            </Link>
          </p>
        )}
      </div>
    </form>
  );
}
