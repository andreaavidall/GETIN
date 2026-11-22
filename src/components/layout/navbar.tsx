"use client";

import { Menu, Ticket, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/eventos", label: "Explorar" },
  { href: "/eventos", label: "Eventos" },
  { href: "/discotecas", label: "Discotecas" },
  { href: "/cuenta/entradas", label: "Mis reservas" },
];

// "Explorar" y "Eventos" apuntan al mismo explorador; se mantienen los dos
// porque el nombre que busca la gente cambia (unos buscan "explorar", otros
// "eventos"). El activo se calcula por prefijo de ruta.
const PRIMARY = [
  { href: "/eventos", label: "Explorar" },
  { href: "/discotecas", label: "Discotecas" },
  { href: "/cuenta/entradas", label: "Mis reservas" },
];

export function Navbar({
  session,
}: {
  session: { name: string | null; landing: string } | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors",
        scrolled || open
          ? "border-white/10 bg-ink/90 backdrop-blur-xl"
          : "border-transparent bg-gradient-to-b from-black/70 to-transparent",
      )}
    >
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-6 md:flex" aria-label="Principal">
            {PRIMARY.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-sm transition-colors",
                    active ? "text-paper" : "text-muted hover:text-paper",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {session ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/cuenta/entradas">
                  <Ticket className="size-4" />
                  Mis entradas
                </Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href={session.landing}>
                  <User className="size-4" />
                  {session.name?.split(" ")[0] ?? "Mi cuenta"}
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Iniciar sesión</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/registro">Registrarse</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex size-11 items-center justify-center rounded-xl text-paper md:hidden"
          aria-expanded={open}
          aria-controls="menu-movil"
          aria-label={open ? "Cerrar menu" : "Abrir menu"}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open ? (
        <div id="menu-movil" className="border-t border-white/10 bg-ink md:hidden">
          <nav className="container flex flex-col py-2" aria-label="Principal movil">
            {LINKS.filter((l, i, arr) => arr.findIndex((x) => x.label === l.label) === i).map(
              (link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="flex h-12 items-center text-sm text-paper"
                >
                  {link.label}
                </Link>
              ),
            )}
            <div className="flex gap-2 py-3">
              {session ? (
                <Button asChild full>
                  <Link href={session.landing}>Mi cuenta</Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline" full>
                    <Link href="/login">Iniciar sesión</Link>
                  </Button>
                  <Button asChild full>
                    <Link href="/registro">Registrarse</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
