import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";

import { LogoutButton } from "@/components/layout/logout-button";

export const metadata: Metadata = { title: "Cuenta suspendida", robots: { index: false } };

export default function SuspendedPage() {
  return (
    <div className="container flex min-h-[60vh] max-w-lg flex-col items-center justify-center text-center">
      <ShieldAlert className="size-10 text-amber-400" />
      <h1 className="text-display mt-4 text-2xl">Tu cuenta esta suspendida</h1>
      <p className="mt-3 text-sm text-muted">
        No puedes comprar ni reservar mientras la cuenta este suspendida. Si crees que es un error,
        escribe a{" "}
        <a href="mailto:soporte@getin.pe" className="text-lime hover:underline">
          soporte@getin.pe
        </a>{" "}
        indicando el correo de tu cuenta.
      </p>
      <div className="mt-6">
        <LogoutButton />
      </div>
    </div>
  );
}
