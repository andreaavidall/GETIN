import { Building2, Percent, Receipt, ScrollText, Users } from "lucide-react";
import type { Metadata } from "next";

import { CommissionSettings } from "@/components/admin/commission-settings";
import { VenueReviewList } from "@/components/admin/venue-review-list";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { requireSuperadmin } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPEN, formatShortDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Panel GETIN", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireSuperadmin();
  const supabase = await createSupabaseServerClient();

  const [venuesRes, settingsRes, ordersRes, usersRes, auditRes, refundsRes] = await Promise.all([
    supabase
      .from("venues")
      .select("id, name, slug, district, status, is_verified, tax_id, legal_name, commission_bps, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("platform_settings").select("default_commission_bps, igv_bps, hold_minutes").eq("id", 1).maybeSingle(),
    supabase.from("orders").select("status, total_cents, getin_fee_cents").limit(1000),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("audit_logs")
      .select("id, action, entity, entity_id, created_at, metadata")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("refunds")
      .select("id, amount_cents, reason, status, created_at")
      .eq("status", "requested")
      .limit(20),
  ]);

  const venues = (venuesRes.data ?? []) as {
    id: string;
    name: string;
    slug: string;
    district: string;
    status: string;
    is_verified: boolean;
    tax_id: string | null;
    legal_name: string | null;
    commission_bps: number | null;
    created_at: string;
  }[];

  const orders = (ordersRes.data ?? []) as {
    status: string;
    total_cents: number;
    getin_fee_cents: number;
  }[];
  const paid = orders.filter((o) => o.status === "paid");
  const gmv = paid.reduce((acc, o) => acc + Number(o.total_cents), 0);
  const revenue = paid.reduce((acc, o) => acc + Number(o.getin_fee_cents), 0);

  const pending = venues.filter((v) => v.status === "pending_review" || v.status === "draft");
  const approved = venues.filter((v) => v.status === "approved");

  return (
    <div className="container space-y-10 py-8">
      <header>
        <h1 className="text-display text-3xl">Panel GETIN</h1>
        <p className="mt-1 text-sm text-muted">
          Aprobacion de locales, comisiones, transacciones y auditoria.
        </p>
      </header>

      {/* --------------------------------------------------------- metricas */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Volumen transaccionado" value={formatPEN(gmv)} hint={`${paid.length} ordenes pagadas`} />
        <Stat label="Ingresos GETIN" value={formatPEN(revenue)} icon={Percent} />
        <Stat label="Locales aprobados" value={String(approved.length)} icon={Building2} />
        <Stat label="Usuarios registrados" value={String(usersRes.count ?? 0)} icon={Users} />
      </section>

      {/* ----------------------------------------------- locales pendientes */}
      <section>
        <h2 className="text-display mb-1 flex items-center gap-2 text-xl">
          <Building2 className="size-5 text-lime" />
          Locales por revisar ({pending.length})
        </h2>
        <p className="mb-4 text-sm text-muted">
          Un local no aparece en el catalogo ni puede vender hasta que se apruebe. Verifica la
          razon social y el RUC antes de aprobar.
        </p>
        {pending.length === 0 ? (
          <EmptyState title="No hay solicitudes pendientes" />
        ) : (
          <VenueReviewList venues={pending} />
        )}
      </section>

      {/* ------------------------------------------------------- comisiones */}
      <section>
        <h2 className="text-display mb-4 flex items-center gap-2 text-xl">
          <Percent className="size-5 text-lime" />
          Comisiones
        </h2>
        <CommissionSettings
          defaultPercent={(settingsRes.data?.default_commission_bps ?? 700) / 100}
          venues={approved.map((v) => ({
            id: v.id,
            name: v.name,
            percent: v.commission_bps === null ? null : v.commission_bps / 100,
          }))}
        />
      </section>

      {/* -------------------------------------------------------- reembolsos */}
      <section>
        <h2 className="text-display mb-4 flex items-center gap-2 text-xl">
          <Receipt className="size-5 text-lime" />
          Reembolsos solicitados ({(refundsRes.data ?? []).length})
        </h2>
        {(refundsRes.data ?? []).length === 0 ? (
          <EmptyState title="Sin solicitudes de reembolso" />
        ) : (
          <ul className="surface divide-y divide-white/5">
            {((refundsRes.data ?? []) as { id: string; amount_cents: number; reason: string; created_at: string }[]).map(
              (refund) => (
                <li key={refund.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-sm font-medium">{formatPEN(Number(refund.amount_cents))}</p>
                    <p className="mt-0.5 text-xs text-muted">{refund.reason}</p>
                  </div>
                  <span className="text-xs text-muted">{formatShortDate(refund.created_at)}</span>
                </li>
              ),
            )}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">
          Aprobar una solicitud la marca como autorizada; la devolucion efectiva la ejecuta el
          adaptador del proveedor de pagos. Con el adaptador de pruebas no se mueve dinero.
        </p>
      </section>

      {/* --------------------------------------------------------- auditoria */}
      <section>
        <h2 className="text-display mb-4 flex items-center gap-2 text-xl">
          <ScrollText className="size-5 text-lime" />
          Registro de auditoria
        </h2>
        {(auditRes.data ?? []).length === 0 ? (
          <EmptyState
            title="Sin registros todavia"
            description="Cada operacion sensible (aprobaciones, pagos, escaneos, cambios de comision) deja aqui su rastro."
          />
        ) : (
          <ul className="surface divide-y divide-white/5 text-sm">
            {((auditRes.data ?? []) as {
              id: number;
              action: string;
              entity: string;
              entity_id: string | null;
              created_at: string;
            }[]).map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <Badge variant="outline">{log.action}</Badge>
                    <span className="truncate text-xs text-muted">
                      {log.entity}
                      {log.entity_id ? ` · ${log.entity_id.slice(0, 8)}` : ""}
                    </span>
                  </p>
                </div>
                <time className="shrink-0 text-xs text-muted" dateTime={log.created_at}>
                  {new Date(log.created_at).toLocaleString("es-PE", { timeZone: "America/Lima" })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
        {Icon ? <Icon className="size-4 text-muted" /> : null}
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}
