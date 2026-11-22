import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Retorno de los enlaces de Supabase Auth (confirmación de correo,
 * recuperacion de contraseña). Canjea el código por una sesión y redirige.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // Solo rutas internas: evita convertir esto en un redirector abierto.
  const rawNext = url.searchParams.get("siguiente") ?? "/cuenta";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/cuenta";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=enlace_invalido", url.origin));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/login?error=enlace_expirado", url.origin));
    }
    return NextResponse.redirect(new URL(next, url.origin));
  } catch {
    return NextResponse.redirect(new URL("/configuracion-requerida", url.origin));
  }
}
