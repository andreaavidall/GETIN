"use client";

import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { cn, limaISODate } from "@/lib/utils";
import { weekendRange } from "@/lib/domain/event-filters";
import { LIMA_DISTRICTS } from "@/types/catalog";

const EXPERIENCES = [
  { value: "", label: "Cualquier experiencia" },
  { value: "entradas", label: "Comprar entrada" },
  { value: "mesas", label: "Reservar mesa VIP" },
  { value: "listas", label: "Lista de invitados" },
];

/**
 * Buscador de la portada.
 *
 * Antes eran cuatro campos siempre abiertos que, con el hero, se comían la
 * primera pantalla del móvil entera: no se veía ni un evento sin desplazar.
 *
 * Ahora manda una sola pregunta —«¿Dónde quieres salir?»— con tres accesos
 * rápidos debajo. Distrito, fecha y experiencia siguen ahí, plegados: quien
 * los necesita los abre, y quien no, ve eventos.
 *
 * El estado sigue viviendo en la URL, así que un resultado se comparte igual.
 */
export function SearchBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [district, setDistrict] = useState(params.get("distrito") ?? "");
  const [date, setDate] = useState(params.get("desde") ?? "");
  const [experience, setExperience] = useState(params.get("experiencia") ?? "");
  const [abierto, setAbierto] = useState(
    Boolean(params.get("distrito") || params.get("desde") || params.get("experiencia")),
  );

  const filtrosActivos = [district, date, experience].filter(Boolean).length;

  function irA(query: URLSearchParams) {
    const texto = query.toString();
    router.push(texto ? `/eventos?${texto}` : "/eventos");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    if (district) next.set("distrito", district);
    if (date) next.set("desde", date);
    if (experience) next.set("experiencia", experience);
    irA(next);
  }

  /** Accesos rápidos: lo que de verdad se busca al abrir la aplicación. */
  function atajo(tipo: "hoy" | "finde" | "mesas") {
    const next = new URLSearchParams();
    if (tipo === "hoy") {
      const hoy = limaISODate();
      next.set("desde", hoy);
      next.set("hasta", hoy);
    }
    if (tipo === "finde") {
      const finde = weekendRange();
      next.set("desde", limaISODate(finde.from));
      next.set("hasta", limaISODate(finde.to));
    }
    if (tipo === "mesas") next.set("experiencia", "mesas");
    irA(next);
  }

  return (
    <form onSubmit={submit} role="search" aria-label="Buscar eventos y discotecas">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="¿Dónde quieres salir?"
            aria-label="¿Dónde quieres salir? Busca por discoteca, evento o género"
            className="control-h pl-11 text-base"
          />
        </div>
        <Button type="submit" size="lg" className="sm:w-auto">
          Buscar
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {([
          ["hoy", "Hoy"],
          ["finde", "Este finde"],
          ["mesas", "Mesas VIP"],
        ] as const).map(([tipo, etiqueta]) => (
          <button
            key={tipo}
            type="button"
            onClick={() => atajo(tipo)}
            className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium transition-colors duration-200 hover:border-lime/50 hover:text-lime"
          >
            {etiqueta}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-controls="filtros-portada"
          className={cn(
            "ml-auto flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition-colors duration-200",
            filtrosActivos > 0 ? "text-lime" : "text-muted hover:text-paper",
          )}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filtros
          {filtrosActivos > 0 ? (
            <span className="rounded-full bg-lime px-1.5 text-xs font-bold text-ink">
              {filtrosActivos}
            </span>
          ) : null}
          <ChevronDown
            className={cn("size-4 transition-transform duration-200", abierto && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Renderizado condicional, no `hidden`: la clase `grid` de Tailwind
          gana al atributo y el panel se quedaba abierto siempre. */}
      {abierto ? (
      <div id="filtros-portada" className="mt-3 grid gap-2 sm:grid-cols-3">
        <Select
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          aria-label="Distrito"
          className="control-h"
        >
          <option value="">Todo Lima</option>
          {LIMA_DISTRICTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>

        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Desde qué fecha"
          className="control-h"
        />

        <Select
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
          aria-label="Tipo de experiencia"
          className="control-h"
        >
          {EXPERIENCES.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </Select>
      </div>
      ) : null}
    </form>
  );
}
