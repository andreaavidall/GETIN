import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { can } from "@/lib/domain/permissions";
import { verifyQrToken } from "@/lib/domain/qr";
import { serverEnv } from "@/lib/env";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { scanSchema } from "@/lib/validation/schemas";

/**
 * Validación de un QR en la puerta.
 *
 * Orden de las comprobaciones (de lo mas barato a lo mas caro):
 *   1. sesión y permiso de escaneo en ESE local (triple barrera: aquí, en la
 *      funcion de Postgres y por RLS),
 *   2. control de frecuencia, para que un escaner comprometido no sirva para
 *      sondear tokens,
 *   3. firma HMAC del token: si no es nuestra, se descarta sin tocar la base,
 *   4. `getin_scan_qr`, que comprueba y marca como usada en una sola
 *      transacción con bloqueo de fila. Dos escaneos simultaneos del mismo QR
 *      no pueden autorizar dos ingresos: el segundo recibe "ya utilizada".
 *
 * Siempre responde 200 con un veredicto (verde / rojo / amarillo), salvo en
 * errores de autorización: el personal de puerta necesita una respuesta clara,
 * no un error HTTP.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "necesitas iniciar sesión" }, { status: 401 });
  }

  const parsed = scanSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "petición inválida" }, { status: 400 });
  }
  const { token, venueId, device } = parsed.data;

  if (!can(session.actor, "door.scan", venueId)) {
    await recordAudit({
      action: "ticket.scan",
      entity: "checkins",
      actorId: session.user.id,
      actorRole: session.user.role,
      venueId,
      metadata: { result: "forbidden" },
    });
    return NextResponse.json({ error: "no tienes permiso para validar en este local" }, { status: 403 });
  }

  // Control de frecuencia: 120 escaneos por minuto y por usuario son de sobra
  // para una puerta real, y cortan un sondeo automatizado.
  const admin = createSupabaseAdminClient();
  const bucket = `scan:${session.user.id}:${Math.floor(Date.now() / 60_000)}`;
  const { data: allowed } = await admin.rpc("getin_rate_limit", {
    p_bucket: bucket,
    p_limit: 120,
    p_window_seconds: 60,
  });

  if (allowed === false) {
    return NextResponse.json(
      { result: "review", detail: "Demasiados escaneos seguidos. Espera un momento." },
      { status: 429 },
    );
  }

  // Firma local: un QR que no emitimos nosotros no llega a la base de datos.
  const verification = verifyQrToken(token, serverEnv().QR_TOKEN_SECRET);
  if (!verification.valid) {
    await recordAudit({
      action: "ticket.scan",
      entity: "checkins",
      actorId: session.user.id,
      actorRole: session.user.role,
      venueId,
      metadata: { result: "denied_invalid", reason: verification.error },
    });
    return NextResponse.json({
      result: "denied_invalid",
      detail:
        verification.error === "signature"
          ? "Código no emitido por GETIN"
          : "Código con formato invalido",
    });
  }

  // Comprobar + marcar usada, de forma atomica. Se llama con la sesión del
  // usuario (no con la service role) para que la propia funcion revalide el
  // permiso sobre el local.
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("getin_scan_qr", {
    p_token_hash: verification.tokenHash,
    p_venue_id: venueId,
    p_device: device ?? null,
  });

  if (error) {
    const forbidden = error.message.includes("FORBIDDEN");
    return NextResponse.json(
      {
        result: forbidden ? "denied_invalid" : "review",
        detail: forbidden ? "Sin permiso en este local" : "No se pudo validar. Reintenta.",
      },
      { status: forbidden ? 403 : 200 },
    );
  }

  const result = data as {
    result: string;
    detail: string;
    kind?: string;
    label?: string;
    holder?: string;
    event?: string;
  };

  await recordAudit({
    action: "ticket.scan",
    entity: "checkins",
    entityId: verification.id,
    actorId: session.user.id,
    actorRole: session.user.role,
    venueId,
    metadata: { result: result.result, kind: result.kind },
  });

  return NextResponse.json(result);
}
