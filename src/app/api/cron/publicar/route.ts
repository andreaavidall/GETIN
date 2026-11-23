import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Publicación programada.
 *
 * Publica los borradores cuyo momento ya llegó. No lo llama el navegador:
 * hace falta la cabecera con el secreto del cron (el mismo `CRON_SECRET` que
 * usa Vercel Cron). Sin esa cabecera, 401.
 *
 * Mientras nadie llame a este endpoint, un evento programado sigue en
 * borrador, y el panel del local lo dice tal cual en vez de dar por hecho que
 * saldrá solo.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const auth = request.headers.get("authorization") ?? "";

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  // `serverEnv()` valida la configuración del servidor antes de tocar la base.
  serverEnv();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("getin_publish_scheduled");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ publicados: data ?? 0 });
}
