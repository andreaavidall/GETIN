"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Spinner } from "@/components/ui/feedback";
import { LIMA_DISTRICTS, MUSIC_GENRES } from "@/types/catalog";

/**
 * Filtros del explorador.
 *
 * Todo el estado vive en la URL: se puede compartir un enlace filtrado, el
 * boton de atras funciona y el servidor renderiza el resultado correcto en la
 * primera carga. En movil el panel esta plegado para no comerse la pantalla.
 */
const SORTS = [
  { value: "fecha", label: "Fecha: mas proximos" },
  { value: "fecha_desc", label: "Fecha: mas lejanos" },
  { value: "precio", label: "Precio: menor a mayor" },
  { value: "precio_desc", label: "Precio: mayor a menor" },
];

const FILTER_KEYS = ["q", "distrito", "genero", "desde", "hasta", "precioMax", "orden"] as const;

export function EventFiltersPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const get = (key: string) => params.get(key) ?? "";
  const activeCount = FILTER_KEYS.filter((k) => k !== "orden" && params.get(k)).length;

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const query = next.toString();
    startTransition(() => router.replace(query ? `/eventos?${query}` : "/eventos"));
  }

  function clearAll() {
    startTransition(() => router.replace("/eventos"));
    setOpen(false);
  }

  return (
    <section className="surface p-4" aria-label="Filtros">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium sm:cursor-default"
          aria-expanded={open}
          aria-controls="panel-filtros"
        >
          <SlidersHorizontal className="size-4 text-lime" />
          Filtros
          {activeCount > 0 ? (
            <span className="rounded-full bg-lime px-1.5 text-[11px] font-bold text-ink">
              {activeCount}
            </span>
          ) : null}
          {pending ? <Spinner className="text-muted" /> : null}
        </button>

        <div className="flex items-center gap-2">
          {activeCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X className="size-3.5" />
              Limpiar
            </Button>
          ) : null}
          <Select
            value={get("orden") || "fecha"}
            onChange={(e) => update("orden", e.target.value === "fecha" ? "" : e.target.value)}
            aria-label="Ordenar por"
            className="h-9 w-auto min-w-[190px] text-xs"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div
        id="panel-filtros"
        className={`${open ? "grid" : "hidden sm:grid"} mt-4 gap-3 border-t border-white/5 pt-4 sm:grid-cols-2 lg:grid-cols-5`}
      >
        <Field label="Buscar" htmlFor="f-q">
          <Input
            id="f-q"
            defaultValue={get("q")}
            placeholder="Nombre o discoteca"
            onBlur={(e) => update("q", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") update("q", e.currentTarget.value);
            }}
          />
        </Field>

        <Field label="Distrito" htmlFor="f-distrito">
          <Select
            id="f-distrito"
            value={get("distrito")}
            onChange={(e) => update("distrito", e.target.value)}
          >
            <option value="">Todos</option>
            {LIMA_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Genero" htmlFor="f-genero">
          <Select
            id="f-genero"
            value={get("genero")}
            onChange={(e) => update("genero", e.target.value)}
          >
            <option value="">Todos</option>
            {MUSIC_GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Desde" htmlFor="f-desde">
          <Input
            id="f-desde"
            type="date"
            value={get("desde")}
            onChange={(e) => update("desde", e.target.value)}
          />
        </Field>

        <Field label="Precio maximo (S/)" htmlFor="f-precio">
          <Input
            id="f-precio"
            type="number"
            min={0}
            step={5}
            inputMode="numeric"
            placeholder="Sin limite"
            defaultValue={get("precioMax")}
            onBlur={(e) => update("precioMax", e.target.value)}
          />
        </Field>
      </div>
    </section>
  );
}
