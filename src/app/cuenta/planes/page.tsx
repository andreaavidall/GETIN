import { UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { RsvpBadge } from "@/components/plans/plan-rsvp";
import { Button } from "@/components/ui/button";
import { DemoNotice, EmptyState } from "@/components/ui/feedback";
import { isDemoMode } from "@/lib/data/catalog";
import { listMyPlans } from "@/lib/data/plans";
import { formatEventDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Mis planes", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MyPlansPage() {
  if (isDemoMode()) {
    return (
      <div className="space-y-4">
        <DemoNotice />
        <EmptyState
          icon={UsersRound}
          title="Los planes necesitan base de datos"
          description="En modo demostración los eventos son ficticios y no se puede compartir un plan real."
        />
      </div>
    );
  }

  const plans = await listMyPlans();

  if (plans.length === 0) {
    return (
      <EmptyState
        icon={UsersRound}
        title="Todavía no has armado ningún plan"
        description="Desde la ficha de un evento puedes crear un enlace para tu grupo: quién va, cuántos son y cuántos faltan para completar una mesa."
        action={
          <Button asChild>
            <Link href="/eventos">Ver eventos</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="space-y-3">
      {plans.map((plan) => (
        <li key={plan.id} className="surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold">
                <Link href={`/planes/${plan.token}`} className="hover:text-lime">
                  {plan.title}
                </Link>
              </h2>
              <p className="mt-0.5 truncate text-sm text-muted">
                {plan.event.name} · {plan.event.venueName}
              </p>
              <p className="mt-0.5 text-xs text-muted">{formatEventDate(plan.event.startsAt)}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-lg font-bold text-lime">{plan.going}</p>
              <p className="text-[11px] uppercase tracking-wide text-muted">
                {plan.goalPeople ? `de ${plan.goalPeople}` : "van"}
              </p>
            </div>
          </div>

          {plan.members.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2 border-t border-white/5 pt-3">
              {plan.members.slice(0, 8).map((m) => (
                <li key={m.id} className="flex items-center gap-1.5 text-xs text-muted">
                  {m.displayName}
                  <RsvpBadge rsvp={m.rsvp} />
                </li>
              ))}
            </ul>
          ) : null}

          {plan.closedAt ? (
            <p className="mt-3 text-xs text-muted">Plan cerrado.</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
