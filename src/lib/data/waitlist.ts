import "server-only";

import { getSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/data/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Qué está esperando ya esta persona en un evento, para que el botón aparezca
 * en su estado correcto al cargar la página y no "parpadee" después.
 */
export type WaitlistIds = { ticketTypes: Set<string>; tables: Set<string> };

const EMPTY: WaitlistIds = { ticketTypes: new Set(), tables: new Set() };

export async function getWaitlistIds(eventId: string): Promise<WaitlistIds> {
  if (isDemoMode()) return EMPTY;
  const session = await getSession();
  if (!session) return EMPTY;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("waitlist_entries")
    .select("ticket_type_id, venue_table_id")
    .eq("event_id", eventId);

  const ids: WaitlistIds = { ticketTypes: new Set(), tables: new Set() };
  for (const row of data ?? []) {
    if (row.ticket_type_id) ids.ticketTypes.add(row.ticket_type_id as string);
    if (row.venue_table_id) ids.tables.add(row.venue_table_id as string);
  }
  return ids;
}
