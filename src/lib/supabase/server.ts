import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { isSupabaseConfigured, publicEnv, serverEnv } from "@/lib/env";

/**
 * Cliente de Supabase para componentes de servidor, server actions y rutas API.
 * Usa la clave anonima + la cookie de sesion, asi que **todas las consultas
 * pasan por RLS**. Es el cliente por defecto.
 */
export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured()) {
    throw new SupabaseNotConfiguredError();
  }
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // En componentes de servidor de solo lectura no se pueden escribir
            // cookies: el refresco de sesion lo hace el middleware.
          }
        },
      },
    },
  );
}

/**
 * Cliente con la service role. **Nunca** se usa para responder a una peticion
 * del usuario sin haber comprobado permisos antes: salta RLS por completo.
 *
 * Usos legitimos en este proyecto:
 *  - confirmar un pago desde un webhook firmado,
 *  - escribir en audit_logs,
 *  - tareas programadas (vencimiento de retenciones).
 */
export function createSupabaseAdminClient() {
  const key = serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseConfigured() || !key) {
    throw new SupabaseNotConfiguredError(
      "Falta SUPABASE_SERVICE_ROLE_KEY para operaciones de servidor",
    );
  }
  return createServerClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, key, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export class SupabaseNotConfiguredError extends Error {
  constructor(message = "Supabase no esta configurado (ver .env.example)") {
    super(message);
    this.name = "SupabaseNotConfiguredError";
  }
}
