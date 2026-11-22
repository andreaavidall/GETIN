import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  PromotionsForm,
  TablePositionsForm,
  VenuePhotosForm,
  VenueProfileForm,
} from "@/components/club/venue-profile-forms";
import { requireActiveVenue } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ficha del local", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Ficha del local: lo que el público ve para decidir.
 *
 * Todo lo de esta página lo escribe el local. GETIN no rellena ningún campo
 * por él, ni pone fotos de archivo, ni inventa beneficios.
 */
export default async function VenueProfilePage() {
  const { venueId } = await requireActiveVenue();
  const supabase = await createSupabaseServerClient();

  const [venueRes, photosRes, promosRes, tablesRes, eventsRes] = await Promise.all([
    supabase
      .from("venues")
      .select("id, name, ambiences, accessibility, parking, entrance_notes, dress_code")
      .eq("id", venueId)
      .single(),
    supabase
      .from("venue_images")
      .select("id, url, alt, kind")
      .eq("venue_id", venueId)
      .order("position"),
    supabase
      .from("promotions")
      .select("id, title, description, conditions, ends_at, is_active, events (name)")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false }),
    supabase
      .from("venue_tables")
      .select("id, label, zone, position_x, position_y")
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .order("label"),
    supabase
      .from("events")
      .select("id, name")
      .eq("venue_id", venueId)
      .in("status", ["draft", "published"])
      .order("starts_at", { ascending: false })
      .limit(20),
  ]);

  const venue = venueRes.data;
  if (!venue) return null;

  return (
    <div className="container space-y-6 py-8">
      <header className="space-y-2">
        <Link
          href="/club/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-paper"
        >
          <ArrowLeft className="size-4" />
          Volver al panel
        </Link>
        <h1 className="text-display text-3xl">Ficha de {venue.name as string}</h1>
        <p className="max-w-2xl text-sm text-muted">
          Esto es lo que ve quien está decidiendo dónde salir. Los datos concretos —ambientes,
          accesos, qué incluye cada entrada— suelen pesar más que una descripción larga.
        </p>
      </header>

      <VenueProfileForm
        venueId={venueId}
        ambiences={(venue.ambiences as string[] | null) ?? []}
        accessibility={(venue.accessibility as string | null) ?? null}
        parking={(venue.parking as string | null) ?? null}
        entranceNotes={(venue.entrance_notes as string | null) ?? null}
        dressCode={(venue.dress_code as string | null) ?? null}
      />

      <VenuePhotosForm
        venueId={venueId}
        photos={(photosRes.data ?? []).map((p) => ({
          id: p.id as string,
          url: p.url as string,
          alt: (p.alt as string | null) ?? null,
          kind: (p.kind as string) ?? "ambiente",
        }))}
      />

      <PromotionsForm
        venueId={venueId}
        events={(eventsRes.data ?? []).map((e) => ({ id: e.id as string, name: e.name as string }))}
        promotions={(promosRes.data ?? []).map((p) => ({
          id: p.id as string,
          title: p.title as string,
          description: p.description as string,
          conditions: p.conditions as string,
          endsAt: p.ends_at ? new Date(p.ends_at as string) : null,
          isActive: Boolean(p.is_active),
          // PostgREST devuelve la relacion como array aunque sea uno a uno.
          eventName:
            (p.events as unknown as { name: string }[] | { name: string } | null) === null
              ? null
              : Array.isArray(p.events)
                ? ((p.events as unknown as { name: string }[])[0]?.name ?? null)
                : ((p.events as unknown as { name: string }).name ?? null),
        }))}
      />

      <TablePositionsForm
        venueId={venueId}
        tables={(tablesRes.data ?? []).map((t) => ({
          id: t.id as string,
          label: t.label as string,
          zone: (t.zone as string | null) ?? null,
          x: t.position_x === null ? null : Number(t.position_x),
          y: t.position_y === null ? null : Number(t.position_y),
        }))}
      />
    </div>
  );
}
