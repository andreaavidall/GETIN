import type { Metadata } from "next";
import { Suspense } from "react";

import { RecoverForm } from "@/components/auth/recover-form";
import { Logo } from "@/components/brand/logo";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
  robots: { index: false },
};

export default function RecoverPage() {
  return (
    <div className="container flex min-h-[70vh] max-w-md flex-col justify-center py-14">
      <div className="mb-8 text-center">
        <Logo size="lg" />
        <h1 className="text-display mt-4 text-2xl">Recuperar contraseña</h1>
        <p className="mt-2 text-sm text-muted">
          Te enviamos un enlace al correo con el que te registraste.
        </p>
      </div>

      {isSupabaseConfigured() ? (
        <Suspense fallback={<div className="skeleton h-56 w-full rounded-2xl" />}>
          <RecoverForm />
        </Suspense>
      ) : (
        <div className="surface p-5 text-sm text-muted">
          <p className="font-medium text-paper">Supabase no está configurado</p>
          <p className="mt-2">
            La recuperación de contraseña necesita las claves de Supabase en el entorno.
          </p>
        </div>
      )}
    </div>
  );
}
