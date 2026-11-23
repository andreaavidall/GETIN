import { Ticket } from "lucide-react";
import type { Metadata } from "next";

import { ClaimTransfer } from "@/components/tickets/claim-transfer";
import { getSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Params = Promise<{ token: string }>;

export const metadata: Metadata = {
  title: "Recibir una entrada",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Recibir una entrada traspasada.
 *
 * Hace falta cuenta: la entrada queda asociada a una persona y su QR se emite
 * para ella. Sin sesión se ofrece iniciarla y volver aquí.
 */
export default async function ClaimPage({ params }: { params: Params }) {
  const { token } = await params;
  const session = await getSession();

  return (
    <div className="container max-w-md space-y-6 py-12">
      <div className="flex items-start gap-3">
        <Ticket className="mt-1 size-6 shrink-0 text-lime" />
        <div>
          <h1 className="text-display text-2xl">Te pasaron una entrada</h1>
          <p className="mt-2 text-sm text-muted">
            Al reclamarla queda en tu cuenta con un código QR nuevo, y el de quien te la pasó
            deja de valer. Así la misma entrada no circula en dos teléfonos.
          </p>
        </div>
      </div>

      {session ? (
        <ClaimTransfer token={token} />
      ) : (
        <div className="surface space-y-3 p-5">
          <p className="text-sm">
            Inicia sesión o crea tu cuenta para recibirla. Es gratis y es lo que permite que la
            entrada sea tuya de verdad.
          </p>
          <Button asChild full>
            <Link href={`/login?siguiente=${encodeURIComponent(`/entradas/recibir/${token}`)}`}>
              Iniciar sesión
            </Link>
          </Button>
          <Button asChild variant="secondary" full>
            <Link href={`/registro?siguiente=${encodeURIComponent(`/entradas/recibir/${token}`)}`}>
              Crear cuenta
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
