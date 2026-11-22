import { CalendarDays, MapPin, Users } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PlanRsvp, RsvpBadge } from "@/components/plans/plan-rsvp";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { getPlanByToken } from "@/lib/data/plans";
import { formatEventDate } from "@/lib/utils";

type Params = Promise<{ token: string }>;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { token } = await params;
  const plan = await getPlanByToken(token);
  if (!plan) return { title: "Plan no encontrado", robots: { index: false } };

  return {
    title: `${plan.title} · ${plan.event.name}`,
    description: `${plan.event.name} en ${plan.event.venueName}. ${formatEventDate(plan.event.startsAt)}.`,
    // Un plan es privado por enlace: no tiene por qué acabar en un buscador.
    robots: { index: false, follow: false },
  };
}

/**
 * Plan compartido.
 *
 * Quien tenga el enlace ve el evento, quiénes van y cuántos faltan. No se
 * muestran correos ni se exige cuenta para responder.
 */
export default async function PlanPage({ params }: { params: Params }) {
  const { token } = await params;
  const [plan, session] = await Promise.all([getPlanByToken(token), getSession()]);
  if (!plan) notFound();

  const myRsvp = plan.members.find((m) => m.isMe) ?? null;
  const faltan = plan.goalPeople ? Math.max(plan.goalPeople - plan.going, 0) : null;

  return (
    <div className="container max-w-2xl space-y-6 py-8">
      <article className="surface overflow-hidden">
        {plan.event.coverUrl ? (
          <div className="relative aspect-[16/7]">
            <Image src={plan.event.coverUrl} alt="" fill sizes="(max-width: 768px) 100vw, 672px" className="object-cover" />
            <div className="absolute inset-0 photo-scrim" />
          </div>
        ) : null}

        <div className="space-y-3 p-5">
          <h1 className="text-display text-2xl sm:text-3xl">{plan.title}</h1>
          {plan.note ? <p className="text-sm text-muted">{plan.note}</p> : null}

          <div className="space-y-1.5 border-t border-white/10 pt-3 text-sm">
            <p className="font-semibold">
              <Link href={`/eventos/${plan.event.slug}`} className="hover:text-lime">
                {plan.event.name}
              </Link>
            </p>
            <p className="flex items-center gap-1.5 text-muted">
              <MapPin className="size-3.5" />
              {plan.event.venueName} · {plan.event.district}
            </p>
            <p className="flex items-center gap-1.5 text-muted">
              <CalendarDays className="size-3.5" />
              {formatEventDate(plan.event.startsAt)}
            </p>
            <p className="text-xs text-muted">Ingreso desde {plan.event.minAge} años.</p>
          </div>

          <Button asChild full className="mt-2">
            <Link href={`/eventos/${plan.event.slug}`}>Ver el evento y comprar</Link>
          </Button>
        </div>
      </article>

      <section className="surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <Users className="size-4 text-lime" />
            {plan.going} {plan.going === 1 ? "persona confirmada" : "personas confirmadas"}
          </h2>
          {faltan !== null ? (
            <p className="text-xs text-muted">
              {faltan === 0
                ? `Ya son ${plan.goalPeople}: el grupo está completo`
                : `Faltan ${faltan} para llegar a ${plan.goalPeople}`}
            </p>
          ) : null}
        </div>

        <ul className="mt-4 divide-y divide-white/5">
          {plan.members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="truncate">
                {m.displayName}
                {m.isMe ? <span className="ml-1.5 text-xs text-muted">(tú)</span> : null}
                {m.companions > 0 ? (
                  <span className="ml-1.5 text-xs text-muted">+{m.companions}</span>
                ) : null}
              </span>
              <RsvpBadge rsvp={m.rsvp} />
            </li>
          ))}
        </ul>
      </section>

      <PlanRsvp
        token={plan.token}
        defaultName={session?.user.fullName ?? ""}
        myRsvp={myRsvp}
        closed={plan.closedAt !== null}
        createdByMe={plan.createdByMe}
      />
    </div>
  );
}
