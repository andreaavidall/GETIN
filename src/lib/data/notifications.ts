import "server-only";

import { getSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/data/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Avisos dentro de la aplicación.
 *
 * No hay envío de correo todavía: no hay proveedor configurado. Las filas se
 * escriben igual (las crean los disparadores de la base cuando un local
 * publica un evento o cuando se libera algo), y aquí se leen. `sentAt` queda
 * nulo mientras nadie las envíe, y eso se dice en pantalla en vez de dar a
 * entender que llegó un correo.
 */
export type NotificationView = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: Date;
  readAt: Date | null;
};

export async function listNotifications(limit = 50): Promise<NotificationView[]> {
  if (isDemoMode()) return [];
  const session = await getSession();
  if (!session) return [];

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, href, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    kind: (row.kind as string) ?? "generic",
    title: (row.title as string | null) ?? "Aviso",
    body: (row.body as string | null) ?? null,
    href: (row.href as string | null) ?? null,
    createdAt: new Date(row.created_at as string),
    readAt: row.read_at ? new Date(row.read_at as string) : null,
  }));
}

/** Para el contador de la pestaña. Una consulta de solo cabecera. */
export async function countUnreadNotifications(): Promise<number> {
  if (isDemoMode()) return 0;
  const session = await getSession();
  if (!session) return 0;

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  return count ?? 0;
}
