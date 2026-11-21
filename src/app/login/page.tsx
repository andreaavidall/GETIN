import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { AuthForm } from "@/components/auth/auth-form";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Iniciar sesion",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <div className="container flex min-h-[70vh] max-w-md flex-col justify-center py-14">
      <div className="mb-8 text-center">
        <Logo size="lg" />
        <p className="mt-3 text-sm text-muted">Entra para ver tus entradas y reservas.</p>
      </div>

      {isSupabaseConfigured() ? (
        <Suspense fallback={<div className="skeleton h-80 w-full rounded-2xl" />}>
          <AuthForm mode="signin" />
        </Suspense>
      ) : (
        <div className="surface p-5 text-sm text-muted">
          <p className="font-medium text-paper">Supabase no esta configurado</p>
          <p className="mt-2">
            El inicio de sesion necesita las claves de Supabase. Copia{" "}
            <code className="rounded bg-white/10 px-1">.env.example</code> a{" "}
            <code className="rounded bg-white/10 px-1">.env.local</code>, completa las variables y
            reinicia el servidor.
          </p>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="text-lime hover:underline">
          Registrate
        </Link>
      </p>
    </div>
  );
}
