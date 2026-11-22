"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/cuenta", label: "Perfil" },
  { href: "/cuenta/entradas", label: "Mis entradas" },
  { href: "/cuenta/mesas", label: "Mis mesas" },
  { href: "/cuenta/listas", label: "Mis listas" },
  { href: "/cuenta/planes", label: "Mis planes" },
  { href: "/cuenta/favoritos", label: "Favoritos" },
  { href: "/cuenta/avisos", label: "Avisos" },
  { href: "/cuenta/compras", label: "Compras" },
  { href: "/cuenta/soporte", label: "Soporte" },
];

export function AccountTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      aria-label="Secciones de la cuenta"
    >
      {TABS.map((tab) => {
        const active = tab.href === "/cuenta" ? pathname === "/cuenta" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-xl px-4 py-2.5 text-sm transition-colors",
              active ? "bg-lime font-semibold text-ink" : "text-muted hover:bg-white/5 hover:text-paper",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
