import "server-only";

import { getSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/data/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Solicitudes de soporte de quien ha iniciado sesión, con su hilo.
 *
 * El estado es lo que hace que esto sirva: quien reclama quiere saber si su
 * caso está abierto, respondido o cerrado, no reenviar correos.
 */
export type SupportMessage = {
  id: string;
  body: string;
  isStaff: boolean;
  createdAt: Date;
};

export type SupportTicketView = {
  id: string;
  reason: string;
  subject: string;
  status: "open" | "pending_user" | "resolved" | "closed";
  createdAt: Date;
  orderCode: string | null;
  messages: SupportMessage[];
};

const ESTADOS: Record<SupportTicketView["status"], string> = {
  open: "Abierta",
  pending_user: "Esperando tu respuesta",
  resolved: "Resuelta",
  closed: "Cerrada",
};

export function supportStatusLabel(status: SupportTicketView["status"]): string {
  return ESTADOS[status] ?? status;
}

export async function listMySupportTickets(): Promise<SupportTicketView[]> {
  if (isDemoMode()) return [];
  const session = await getSession();
  if (!session) return [];

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("support_tickets")
    .select(
      `id, reason, subject, status, created_at,
       orders (code),
       support_messages (id, body, is_staff, created_at)`,
    )
    .order("created_at", { ascending: false })
    .limit(30);

  type Row = {
    id: string;
    reason: string;
    subject: string;
    status: SupportTicketView["status"];
    created_at: string;
    orders: { code: string } | { code: string }[] | null;
    support_messages: { id: string; body: string; is_staff: boolean; created_at: string }[] | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    reason: row.reason,
    subject: row.subject,
    status: row.status,
    createdAt: new Date(row.created_at),
    orderCode: Array.isArray(row.orders) ? (row.orders[0]?.code ?? null) : (row.orders?.code ?? null),
    messages: (row.support_messages ?? [])
      .map((m) => ({
        id: m.id,
        body: m.body,
        isStaff: m.is_staff,
        createdAt: new Date(m.created_at),
      }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
  }));
}
