"use client";

import { createBrowserClient } from "@supabase/ssr";

import { isSupabaseConfigured, publicEnv } from "@/lib/env";

/**
 * Cliente de navegador. Solo lleva la clave anonima (publica por diseño): toda
 * la autorizacion real la aplica RLS en la base y los guards del servidor.
 */
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase no esta configurado. Copia .env.example a .env.local y completa las claves.",
    );
  }
  browserClient ??= createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return browserClient;
}
