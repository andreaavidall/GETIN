"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { LIMA_DISTRICTS } from "@/types/catalog";

const EXPERIENCES = [
  { value: "", label: "Cualquier experiencia" },
  { value: "entradas", label: "Comprar entrada" },
  { value: "mesas", label: "Reservar mesa VIP" },
  { value: "listas", label: "Lista de invitados" },
];

/**
 * Buscador de la portada. Compone la URL del explorador: el estado vive en los
 * parametros de busqueda, asi que un resultado se puede compartir o guardar.
 */
export function SearchBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [district, setDistrict] = useState(params.get("distrito") ?? "");
  const [date, setDate] = useState(params.get("desde") ?? "");
  const [experience, setExperience] = useState(params.get("experiencia") ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    if (district) next.set("distrito", district);
    if (date) next.set("desde", date);
    if (experience) next.set("experiencia", experience);
    const query = next.toString();
    router.push(query ? `/eventos?${query}` : "/eventos");
  }

  return (
    <form
      onSubmit={submit}
      className="surface grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_auto]"
      role="search"
      aria-label="Buscar eventos y discotecas"
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Discoteca, evento o genero"
          aria-label="Discoteca, evento o genero"
          className="pl-10"
        />
      </div>

      <Select
        value={district}
        onChange={(e) => setDistrict(e.target.value)}
        aria-label="Distrito"
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
        aria-label="Desde que fecha"
      />

      <Select
        value={experience}
        onChange={(e) => setExperience(e.target.value)}
        aria-label="Tipo de experiencia"
      >
        {EXPERIENCES.map((x) => (
          <option key={x.value} value={x.value}>
            {x.label}
          </option>
        ))}
      </Select>

      <Button type="submit" size="md" className="sm:col-span-2 lg:col-span-1">
        <Search className="size-4" />
        Buscar
      </Button>
    </form>
  );
}
