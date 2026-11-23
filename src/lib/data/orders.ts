import "server-only";

import { rebuildQrToken } from "@/lib/domain/qr";
import { serverEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Lecturas de la cuenta del cliente.
 *
 * Usan el cliente con RLS a proposito: si una consulta se escapara sin filtrar
 * por usuario, la base no devolveria datos de otro. La única excepcion es la
 * reconstruccion del token QR, que necesita el secreto del servidor.
 */

export type OrderItemView = {
  id: string;
  kind: "ticket" | "table" | "guest_list";
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
};

export type OrderView = {
  id: string;
  code: string;
  status: string;
  subtotalCents: number;
  serviceFeeCents: number;
  taxCents: number;
  totalCents: number;
  commissionBps: number;
  expiresAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  items: OrderItemView[];
  event: {
    id: string;
    slug: string;
    name: string;
    startsAt: Date;
    cancellationPolicy: string | null;
    venueName: string;
    district: string;
  };
};

const ORDER_SELECT = `
  id, code, status, subtotal_cents, service_fee_cents, tax_cents, total_cents,
  commission_bps, expires_at, paid_at, created_at,
  order_items (id, kind, description, quantity, unit_price_cents, total_cents),
  events!inner (
    id, slug, name, starts_at, cancellation_policy,
    venues!inner (name, district)
  )
`;

type RawOrder = {
  id: string;
  code: string;
  status: string;
  subtotal_cents: number;
  service_fee_cents: number;
  tax_cents: number;
  total_cents: number;
  commission_bps: number;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string;
  order_items: {
    id: string;
    kind: OrderItemView["kind"];
    description: string;
    quantity: number;
    unit_price_cents: number;
    total_cents: number;
  }[];
  events: {
    id: string;
    slug: string;
    name: string;
    starts_at: string;
    cancellation_policy: string | null;
    venues: { name: string; district: string } | null;
  } | null;
};

function toOrderView(row: RawOrder): OrderView {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    subtotalCents: Number(row.subtotal_cents),
    serviceFeeCents: Number(row.service_fee_cents),
    taxCents: Number(row.tax_cents),
    totalCents: Number(row.total_cents),
    commissionBps: row.commission_bps,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    paidAt: row.paid_at ? new Date(row.paid_at) : null,
    createdAt: new Date(row.created_at),
    items: (row.order_items ?? []).map((i) => ({
      id: i.id,
      kind: i.kind,
      description: i.description,
      quantity: i.quantity,
      unitPriceCents: Number(i.unit_price_cents),
      totalCents: Number(i.total_cents),
    })),
    event: {
      id: row.events?.id ?? "",
      slug: row.events?.slug ?? "",
      name: row.events?.name ?? "",
      startsAt: new Date(row.events?.starts_at ?? Date.now()),
      cancellationPolicy: row.events?.cancellation_policy ?? null,
      venueName: row.events?.venues?.name ?? "",
      district: row.events?.venues?.district ?? "",
    },
  };
}

export async function getOrder(orderId: string): Promise<OrderView | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("orders").select(ORDER_SELECT).eq("id", orderId).maybeSingle();
  return data ? toOrderView(data as unknown as RawOrder) : null;
}

export async function listMyOrders(): Promise<OrderView[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false })
    .limit(50);
  return ((data ?? []) as unknown as RawOrder[]).map(toOrderView);
}

// ------------------------------------------------------------------ entradas ---

export type TicketView = {
  id: string;
  serial: string;
  status: string;
  holderName: string | null;
  usedAt: Date | null;
  typeName: string;
  orderCode: string;
  /** Estado de la orden: distingue "pago pendiente" de "entrada anulada". */
  orderStatus: string;
  /** Traspaso abierto, si lo hay: la entrada sigue siendo tuya hasta que lo reclamen. */
  pendingTransfer: { id: string; toEmail: string } | null;
  /** Contenido del QR. Solo se calcula para entradas emitidas y pagadas. */
  qrToken: string | null;
  event: {
    slug: string;
    name: string;
    startsAt: Date;
    lastEntryAt: Date | null;
    venueName: string;
    address: string;
    district: string;
    minAge: number;
    dressCode: string | null;
    entryRules: string | null;
  };
};

export async function listMyTickets(options: { onlyUpcoming?: boolean } = {}): Promise<TicketView[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("tickets")
    .select(
      `id, serial, status, holder_name, used_at,
       ticket_types!inner (name),
       orders!inner (code, status),
       events!inner (
         slug, name, starts_at, last_entry_at, min_age, entry_rules,
         venues!inner (name, address, district, dress_code)
       ),
       qr_credentials (nonce, revoked_at),
       ticket_transfers (id, to_email, claimed_at, cancelled_at, expires_at)`,
    )
    .order("created_at", { ascending: false })
    .limit(100);

  type Row = {
    id: string;
    serial: string;
    status: string;
    holder_name: string | null;
    used_at: string | null;
    ticket_types: { name: string } | null;
    orders: { code: string; status: string } | null;
    events: {
      slug: string;
      name: string;
      starts_at: string;
      last_entry_at: string | null;
      min_age: number;
      entry_rules: string | null;
      venues: { name: string; address: string; district: string; dress_code: string | null } | null;
    } | null;
    qr_credentials: { nonce: string; revoked_at: string | null }[] | null;
    ticket_transfers:
      | { id: string; to_email: string; claimed_at: string | null; cancelled_at: string | null; expires_at: string }[]
      | null;
  };

  const secret = serverEnv().QR_TOKEN_SECRET;
  const now = new Date();

  const tickets = ((data ?? []) as unknown as Row[]).map((row): TicketView => {
    const credential = (row.qr_credentials ?? []).find((c) => c.revoked_at === null);
    const paid = row.orders?.status === "paid";
    const issued = row.status === "issued";

    return {
      id: row.id,
      serial: row.serial,
      status: row.status,
      holderName: row.holder_name,
      usedAt: row.used_at ? new Date(row.used_at) : null,
      typeName: row.ticket_types?.name ?? "Entrada",
      orderCode: row.orders?.code ?? "",
      orderStatus: row.orders?.status ?? "pending",
      pendingTransfer: (() => {
        const abierto = (row.ticket_transfers ?? []).find(
          (t) =>
            t.claimed_at === null &&
            t.cancelled_at === null &&
            new Date(t.expires_at) > now,
        );
        return abierto ? { id: abierto.id, toEmail: abierto.to_email } : null;
      })(),
      // El QR se dibuja solo si el pago esta confirmado y la entrada sigue válida.
      qrToken:
        credential && paid && issued ? rebuildQrToken("ticket", row.id, credential.nonce, secret) : null,
      event: {
        slug: row.events?.slug ?? "",
        name: row.events?.name ?? "",
        startsAt: new Date(row.events?.starts_at ?? Date.now()),
        lastEntryAt: row.events?.last_entry_at ? new Date(row.events.last_entry_at) : null,
        venueName: row.events?.venues?.name ?? "",
        address: row.events?.venues?.address ?? "",
        district: row.events?.venues?.district ?? "",
        minAge: row.events?.min_age ?? 18,
        dressCode: row.events?.venues?.dress_code ?? null,
        entryRules: row.events?.entry_rules ?? null,
      },
    };
  });

  // Lo mas proximo primero: es lo que alguien busca al abrir la pagina.
  tickets.sort((a, b) => a.event.startsAt.getTime() - b.event.startsAt.getTime());

  if (!options.onlyUpcoming) return tickets;
  return tickets.filter((t) => t.event.startsAt > new Date(now.getTime() - 12 * 3_600_000));
}

// --------------------------------------------------------------------- mesas ---

export type ReservationView = {
  id: string;
  status: string;
  guests: number;
  totalCents: number;
  depositPaidCents: number;
  balanceDueCents: number;
  conditions: string | null;
  usedAt: Date | null;
  qrToken: string | null;
  tableLabel: string;
  zone: string | null;
  event: { slug: string; name: string; startsAt: Date; venueName: string; address: string };
};

export async function listMyReservations(): Promise<ReservationView[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("table_reservations")
    .select(
      `id, status, guests, total_cents, deposit_paid_cents, balance_due_cents,
       conditions_snapshot, used_at,
       event_table_availability!inner (venue_tables!inner (label, zone)),
       events!inner (slug, name, starts_at, venues!inner (name, address)),
       qr_credentials (nonce, revoked_at)`,
    )
    .order("created_at", { ascending: false })
    .limit(50);

  type Row = {
    id: string;
    status: string;
    guests: number;
    total_cents: number;
    deposit_paid_cents: number;
    balance_due_cents: number;
    conditions_snapshot: string | null;
    used_at: string | null;
    event_table_availability: { venue_tables: { label: string; zone: string | null } | null } | null;
    events: {
      slug: string;
      name: string;
      starts_at: string;
      venues: { name: string; address: string } | null;
    } | null;
    qr_credentials: { nonce: string; revoked_at: string | null }[] | null;
    ticket_transfers:
      | { id: string; to_email: string; claimed_at: string | null; cancelled_at: string | null; expires_at: string }[]
      | null;
  };

  const secret = serverEnv().QR_TOKEN_SECRET;

  return ((data ?? []) as unknown as Row[]).map((row) => {
    const credential = (row.qr_credentials ?? []).find((c) => c.revoked_at === null);
    return {
      id: row.id,
      status: row.status,
      guests: row.guests,
      totalCents: Number(row.total_cents),
      depositPaidCents: Number(row.deposit_paid_cents),
      balanceDueCents: Number(row.balance_due_cents),
      conditions: row.conditions_snapshot,
      usedAt: row.used_at ? new Date(row.used_at) : null,
      qrToken:
        credential && row.status === "confirmed"
          ? rebuildQrToken("reservation", row.id, credential.nonce, secret)
          : null,
      tableLabel: row.event_table_availability?.venue_tables?.label ?? "Mesa",
      zone: row.event_table_availability?.venue_tables?.zone ?? null,
      event: {
        slug: row.events?.slug ?? "",
        name: row.events?.name ?? "",
        startsAt: new Date(row.events?.starts_at ?? Date.now()),
        venueName: row.events?.venues?.name ?? "",
        address: row.events?.venues?.address ?? "",
      },
    };
  });
}

// --------------------------------------------------------------------- listas ---

export type GuestEntryView = {
  id: string;
  guestName: string;
  companions: number;
  status: string;
  note: string | null;
  listName: string;
  conditions: string | null;
  lastEntryAt: Date | null;
  event: { slug: string; name: string; startsAt: Date; venueName: string };
};

export async function listMyGuestEntries(): Promise<GuestEntryView[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("guest_list_entries")
    .select(
      `id, guest_name, companions, status, note,
       guest_lists!inner (
         name, conditions, last_entry_at,
         events!inner (slug, name, starts_at, venues!inner (name))
       )`,
    )
    .order("created_at", { ascending: false })
    .limit(50);

  type Row = {
    id: string;
    guest_name: string;
    companions: number;
    status: string;
    note: string | null;
    guest_lists: {
      name: string;
      conditions: string | null;
      last_entry_at: string | null;
      events: {
        slug: string;
        name: string;
        starts_at: string;
        venues: { name: string } | null;
      } | null;
    } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    guestName: row.guest_name,
    companions: row.companions,
    status: row.status,
    note: row.note,
    listName: row.guest_lists?.name ?? "Lista",
    conditions: row.guest_lists?.conditions ?? null,
    lastEntryAt: row.guest_lists?.last_entry_at ? new Date(row.guest_lists.last_entry_at) : null,
    event: {
      slug: row.guest_lists?.events?.slug ?? "",
      name: row.guest_lists?.events?.name ?? "",
      startsAt: new Date(row.guest_lists?.events?.starts_at ?? Date.now()),
      venueName: row.guest_lists?.events?.venues?.name ?? "",
    },
  }));
}
