import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container flex min-h-[70vh] max-w-lg flex-col items-center justify-center text-center">
      <p className="text-display text-6xl text-lime">404</p>
      <h1 className="text-display mt-3 text-2xl">Esta página no existe</h1>
      <p className="mt-2 text-sm text-muted">
        Puede que el evento se haya despublicado o que el enlace este mal escrito.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/eventos">Ver eventos</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Ir al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
