"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Spinner } from "@/components/ui/feedback";
import { weekendRange } from "@/lib/domain/event-filters";
import { cn, limaISODate } from "@/lib/utils";
import { LIMA_DISTRICTS, MUSIC_GENRES } from "@/types/catalog";

/**
 * Filtros del explorador.
 *
 * Todo el estado vive en la URL: se puede compartir un enlace filtrado, el
 * boton de atras funciona y el servidor renderiza el resultado correcto en la
 * primera carga. En movil el panel esta plegado para no comerse la pantalla.
 */
const SORTS = [
  { value: "fecha", label: "Fecha: más próximos" },
  { value: "fecha_desc", label: "Fecha: más lejanos" },
  { value: "precio", label: "Precio: menor a mayor" },
  { value: "precio_desc", label: "Precio: mayor a menor" },
];

// Nombres de los parametros de la URL: SIN acentos a proposito. Son un
// contrato (enlaces compartidos, marcadores), no texto de interfaz; las
// etiquetas visibles si llevan tilde.
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

  // Atajos de fecha, siempre en hora de Lima.
  const hoy = limaISODate();
  const manana = limaISODate(new Date(Date.now() + 86_400_000));
  const finde = weekendRange();
  const atajos = [
    { label: "Hoy", desde: hoy, hasta: hoy },
    { label: "Mañana", desde: manana, hasta: manana },
    {
      label: finde.isUpcoming ? "Próximo finde" : "Este finde",
      desde: limaISODate(finde.from),
      hasta: limaISODate(finde.to),
    },
  ];

  function aplicarAtajo(atajo: { desde: string; hasta: string }) {
    const next = new URLSearchParams(params.toString());
    const yaActivo = get("desde") === atajo.desde && get("hasta") === atajo.hasta;
    if (yaActivo) {
      next.delete("desde");
      next.delete("hasta");
    } else {
      next.set("desde", atajo.desde);
      next.set("hasta", atajo.hasta);
    }
    const query = next.toString();
    startTransition(() => router.replace(query ? `/eventos?${query}` : "/eventos"));
  }

  const ETIQUETAS: Record<string, string> = {
    q: "Búsqueda",
    distrito: "Distrito",
    genero: "Género",
    desde: "Desde",
    hasta: "Hasta",
    precioMax: "Hasta S/",
  };

  // Si el rango viene al reves (desde > hasta), el servidor lo ordena para
  // buscar. Aqui se muestra ordenado tambien: ver "Desde: 10 dic / Hasta: 1
  // dic" junto a resultados de la primera semana de diciembre no se entiende.
  const invertido =
    Boolean(get("desde")) && Boolean(get("hasta")) && get("hasta") < get("desde");

  const valorChip = (k: string): string => {
    if (!invertido) return params.get(k) ?? "";
    if (k === "desde") return params.get("hasta") ?? "";
    if (k === "hasta") return params.get("desde") ?? "";
    return params.get(k) ?? "";
  };

  const chips = FILTER_KEYS.filter((k) => k !== "orden" && params.get(k)).map((k) => ({
    key: k as string,
    label: `${ETIQUETAS[k] ?? k}: ${valorChip(k)}`,
  }));

  function quitar(key: string) {
    update(key, "");
  }

  function clearAll() {
    // La vista (lista o mapa) no es un filtro: es como estas mirando. Limpiar
    // filtros no deberia devolverte a la lista si abriste el mapa.
    const vista = params.get("vista");
    const query = vista ? `?vista=${vista}` : "";
    startTransition(() => router.replace(`/eventos${query}`, { scroll: false }));
    setOpen(false);
  }

  return (
    <section className="surface overflow-hidden p-4" aria-label="Filtros">
      {/* En móvil el selector de orden baja a su propia fila. Antes iba en la
          misma línea con un ancho mínimo de 190px y, con un filtro activo, el
          contenido medía 424px en una pantalla de 390: cortaba el selector y
          obligaba a desplazar horizontalmente. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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

        <div className="flex shrink-0 items-center gap-2">
          {activeCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X className="size-3.5" />
              Limpiar
            </Button>
          ) : null}
        </div>

        <div className="order-last w-full sm:order-none sm:w-auto">
          <Select
            value={get("orden") || "fecha"}
            onChange={(e) => update("orden", e.target.value === "fecha" ? "" : e.target.value)}
            aria-label="Ordenar por"
            className="h-9 w-full text-xs sm:w-[200px]"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Accesos rápidos calculados en hora de Lima. Ponen `desde` y `hasta`
          a la vez, de modo que «Hoy» signifique hoy de verdad y no «de hoy en
          adelante». */}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-white/5 pt-3">
        {atajos.map((atajo) => {
          const activo = get("desde") === atajo.desde && get("hasta") === atajo.hasta;
          return (
            <button
              key={atajo.label}
              type="button"
              onClick={() => aplicarAtajo(atajo)}
              aria-pressed={activo}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs transition-colors",
                activo
                  ? "bg-lime font-semibold text-ink"
                  : "bg-white/5 text-muted hover:bg-white/10 hover:text-paper",
              )}
            >
              {atajo.label}
            </button>
          );
        })}
      </div>

      {/* Cada filtro activo se ve y se quita por separado, sin tener que abrir
          el panel ni borrarlos todos. */}
      {chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted">Filtros activos</span>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => quitar(chip.key)}
              className="group flex items-center gap-1.5 rounded-full border border-lime/40 bg-lime/10 px-3 py-1 text-xs text-lime transition-colors hover:bg-lime/20"
              aria-label={`Quitar filtro ${chip.label}`}
            >
              {chip.label}
              <X className="size-3 opacity-70 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      ) : null}

      <div
        id="panel-filtros"
        className={`${open ? "grid" : "hidden sm:grid"} mt-4 gap-3 border-t border-white/5 pt-4 sm:grid-cols-2 lg:grid-cols-3`}
      >
        <Field label="Buscar" htmlFor="f-q">
          {/* La `key` cuelga del valor de la URL: al pulsar Limpiar el
              parametro desaparece, la key cambia y el campo se vuelve a montar
              vacio. Sin esto el texto escrito se quedaba en pantalla aunque la
              búsqueda ya se hubiera borrado. */}
          <Input
            key={`q-${get("q")}`}
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

        <Field label="Género" htmlFor="f-genero">
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

        {/* Las dos fechas se escriben a mano o se eligen del calendario. Antes
            solo estaba «Desde»: el chip de «Hasta» aparecia con los atajos
            pero no habia manera de ponerlo ni de corregirlo. */}
        <Field label="Desde" htmlFor="f-desde">
          <Input
            id="f-desde"
            type="date"
            value={get("desde")}
            onChange={(e) => update("desde", e.target.value)}
            onBlur={(e) => update("desde", e.target.value)}
          />
        </Field>

        <Field label="Hasta" htmlFor="f-hasta">
          <Input
            id="f-hasta"
            type="date"
            min={get("desde") || undefined}
            value={get("hasta")}
            onChange={(e) => update("hasta", e.target.value)}
            onBlur={(e) => update("hasta", e.target.value)}
          />
        </Field>

        <Field label="Precio máximo (S/)" htmlFor="f-precio">
          <Input
            key={`precio-${get("precioMax")}`}
            id="f-precio"
            type="number"
            min={0}
            step={5}
            inputMode="numeric"
            placeholder="Sin límite"
            defaultValue={get("precioMax")}
            onBlur={(e) => update("precioMax", e.target.value)}
          />
        </Field>
      </div>
    </section>
  );
}
