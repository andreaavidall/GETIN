import { DoorOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Scanner } from "@/components/door/scanner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireSession } from "@/lib/auth/guards";
import { accessibleVenueIds } from "@/lib/domain/permissions";
import { isDemoMode } from "@/lib/data/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Control de puerta", robots: { index: false } };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ local?: string }>;

export default async function DoorPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSession("/puerta");
  const { local } = await searchParams;

  if (isDemoMode()) {
    return (
      <div className="container py-10">
        <EmptyState
          icon={DoorOpen}
          title="El control de puerta necesita la base de datos"
          description="La validacion de QR escribe en checkins y marca la entrada como utilizada de forma atomica: no tiene sentido simularla. Configura Supabase para usarla."
          action={
            <Button asChild variant="outline">
              <Link href="/">Volver al inicio</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const venueIds = accessibleVenueIds(session.actor);
  if (venueIds.length === 0) {
    redirect("/cuenta");
  }

  const supabase = await createSupabaseServerClient();
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, district")
    .in("id", venueIds)
    .order("name");

  const list = (venues ?? []) as { id: string; name: string; district: string }[];
  const activeVenue = list.find((v) => v.id === local) ?? list[0];

  if (!activeVenue) {
    redirect("/cuenta");
  }

  // Eventos de hoy y de las proximas horas, para mostrar contexto al personal.
  const { data: events } = await supabase
    .from("events")
    .select("id, name, starts_at")
    .eq("venue_id", activeVenue.id)
    .eq("status", "published")
    .gte("starts_at", new Date(Date.now() - 12 * 3_600_000).toISOString())
    .lte("starts_at", new Date(Date.now() + 24 * 3_600_000).toISOString())
    .order("starts_at");

  return (
    <div className="container max-w-xl py-6">
      <header className="mb-5">
        <h1 className="text-display flex items-center gap-2 text-2xl">
          <DoorOpen className="size-6 text-lime" />
          Control de puerta
        </h1>
        <p className="mt-1 text-sm text-muted">
          {activeVenue.name} · {activeVenue.district}
        </p>

        {list.length > 1 ? (
          <nav className="mt-3 flex flex-wrap gap-2">
            {list.map((venue) => (
              <Link
                key={venue.id}
                href={`/puerta?local=${venue.id}`}
                className={`rounded-xl px-3 py-1.5 text-xs ${
                  venue.id === activeVenue.id
                    ? "bg-lime font-semibold text-ink"
                    : "bg-white/5 text-muted hover:text-paper"
                }`}
              >
                {venue.name}
              </Link>
            ))}
          </nav>
        ) : null}

        {(events ?? []).length > 0 ? (
          <p className="mt-3 text-xs text-muted">
            Eventos en curso o proximos:{" "}
            {(events ?? []).map((e) => e.name as string).join(", ")}
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted">
            Este local no tiene eventos publicados en las proximas 24 horas.
          </p>
        )}
      </header>

      <Scanner venueId={activeVenue.id} venueName={activeVenue.name} />

      <p className="mt-6 text-xs text-muted">
        Cada validacion queda registrada con la fecha, la hora y el usuario que escaneo. Una
        entrada ya utilizada no vuelve a autorizar el ingreso.
      </p>
    </div>
  );
}
