import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { Logo } from "@/components/brand/logo";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Crear cuenta",
  description: "Crea tu cuenta GETIN para comprar entradas y reservar mesas en Lima.",
  robots: { index: false },
};

export default function RegisterPage() {
  return (
    <div className="container flex min-h-[70vh] max-w-md flex-col justify-center py-14">
      <div className="mb-8 text-center">
        <Logo size="lg" />
        <p className="mt-3 text-sm text-muted">
          Crea tu cuenta y guarda tus entradas en un solo lugar.
        </p>
      </div>

      {isSupabaseConfigured() ? (
        <Suspense fallback={<div className="skeleton h-[520px] w-full rounded-2xl" />}>
          <AuthForm mode="signup" />
        </Suspense>
      ) : (
        <div className="surface p-5 text-sm text-muted">
          <p className="font-medium text-paper">Supabase no esta configurado</p>
          <p className="mt-2">
            El registro necesita las claves de Supabase. Copia{" "}
            <code className="rounded bg-white/10 px-1">.env.example</code> a{" "}
            <code className="rounded bg-white/10 px-1">.env.local</code> y completa las variables.
          </p>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-lime hover:underline">
          Inicia sesion
        </Link>
      </p>
    </div>
  );
}
