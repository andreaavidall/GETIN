"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // En produccion conviene enviarlo a un servicio de errores (Sentry u otro).
    console.error("[getin] error no capturado", error);
  }, [error]);

  return (
    <div className="container flex min-h-[70vh] max-w-lg flex-col items-center justify-center text-center">
      <AlertTriangle className="size-10 text-amber-400" />
      <h1 className="text-display mt-4 text-2xl">Algo se rompio de nuestro lado</h1>
      <p className="mt-2 text-sm text-muted">
        No se realizo ningún cargo por esta acción. Puedes reintentar; si vuelve a ocurrir,
        escribenos a soporte@getin.pe
        {error.digest ? (
          <>
            {" "}
            indicando el código <span className="font-mono text-paper">{error.digest}</span>
          </>
        ) : null}
        .
      </p>
      <Button className="mt-6" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
