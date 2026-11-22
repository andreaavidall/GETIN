import { BellRing } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { NotificationList } from "@/components/account/notification-list";
import { Button } from "@/components/ui/button";
import { DemoNotice, EmptyState } from "@/components/ui/feedback";
import { requireSession } from "@/lib/auth/guards";
import { isDemoMode } from "@/lib/data/catalog";
import { listNotifications } from "@/lib/data/notifications";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Avisos", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Bandeja de avisos.
 *
 * Los escriben los disparadores de la base: un local que publica evento, una
 * entrada o una mesa que se libera. Se leen aquí dentro; no hay correo.
 */
export default async function NotificationsPage() {
  if (isDemoMode()) {
    return (
      <div className="space-y-4">
        <DemoNotice />
        <EmptyState
          icon={BellRing}
          title="Los avisos necesitan base de datos"
          description="En modo demostración no hay locales reales a los que seguir ni inventario que se libere."
          action={
            <Button asChild variant="outline">
              <Link href="/eventos">Ver eventos</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const session = await requireSession("/cuenta/avisos");
  const supabase = await createSupabaseServerClient();
  const [notifications, { data: profile }] = await Promise.all([
    listNotifications(),
    supabase.from("profiles").select("notify_new_events").eq("id", session.user.id).maybeSingle(),
  ]);

  const notifyNewEvents = profile?.notify_new_events !== false;

  if (notifications.length === 0) {
    return (
      <div className="space-y-6">
        <NotificationList notifications={[]} notifyNewEvents={notifyNewEvents} />
        <EmptyState
          icon={BellRing}
          title="Sin avisos por ahora"
          description="Guarda una discoteca y te avisaremos aquí cuando publique una fiesta. También te avisamos si se libera una entrada o una mesa que estabas esperando."
          action={
            <Button asChild variant="outline">
              <Link href="/discotecas">Ver discotecas</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return <NotificationList notifications={notifications} notifyNewEvents={notifyNewEvents} />;
}
