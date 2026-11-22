import { Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Configuración requerida", robots: { index: false } };

type SearchParams = Promise<{ desde?: string }>;

/**
 * Pantalla a la que el middleware reescribe las zonas privadas cuando falta
 * Supabase. Es mejor explicar que falta que mostrar un error 500.
 */
export default async function SetupRequiredPage({ searchParams }: { searchParams: SearchParams }) {
  const { desde } = await searchParams;

  return (
    <div className="container flex min-h-[70vh] max-w-xl flex-col justify-center py-14">
      <Settings className="size-10 text-lime" />
      <h1 className="text-display mt-4 text-3xl">Falta configurar Supabase</h1>
      <p className="mt-3 text-sm text-muted">
        {desde ? (
          <>
            La pantalla <code className="rounded bg-white/10 px-1">{desde}</code> necesita base de
            datos y autenticacion.{" "}
          </>
        ) : null}
        El catálogo funciona en modo demostración sin configuración, pero las cuentas, las compras y
        el control de puerta requieren un proyecto de Supabase.
      </p>

      <ol className="mt-6 space-y-3 text-sm">
        {[
          ["1", "Crea un proyecto gratuito en supabase.com."],
          ["2", "Copia .env.example a .env.local y completa NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY."],
          ["3", "Aplica las migraciones: supabase link y supabase db push (o supabase start en local)."],
          ["4", "Pon NEXT_PUBLIC_DATA_MODE=live y reinicia npm run dev."],
        ].map(([step, text]) => (
          <li key={step} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-lime text-xs font-bold text-ink">
              {step}
            </span>
            <span className="text-muted">{text}</span>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-xs text-muted">
        El detalle completo esta en <code className="rounded bg-white/10 px-1">README.md</code> y en{" "}
        <code className="rounded bg-white/10 px-1">docs/ARQUITECTURA.md</code>.
      </p>

      <div className="mt-8 flex gap-2">
        <Button asChild>
          <Link href="/eventos">Ver el catálogo demo</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Ir al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
