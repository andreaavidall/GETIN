import type { Metadata } from "next";
import { Suspense } from "react";

import { NewPasswordForm } from "@/components/auth/new-password-form";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Elegir contraseña",
  robots: { index: false },
};

/**
 * Pantalla a la que lleva el enlace de recuperación.
 *
 * No se pide la contraseña anterior: quien llega aquí ya demostró que controla
 * el correo de la cuenta, que es justo lo que valida el enlace. El propio
 * enlace abre una sesión temporal, y `updatePasswordAction` comprueba que
 * exista antes de cambiar nada.
 */
export default function NewPasswordPage() {
  return (
    <div className="container flex min-h-[70vh] max-w-md flex-col justify-center py-14">
      <div className="mb-8 text-center">
        <Logo size="lg" />
        <h1 className="text-display mt-4 text-2xl">Elige una contraseña nueva</h1>
      </div>

      <Suspense fallback={<div className="skeleton h-64 w-full rounded-2xl" />}>
        <NewPasswordForm />
      </Suspense>
    </div>
  );
}
