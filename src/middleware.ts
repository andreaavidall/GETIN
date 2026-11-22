import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured, publicEnv } from "@/lib/env";

/**
 * Middleware: refresca la sesión de Supabase en cada navegacion y bloquea las
 * zonas privadas antes de renderizar.
 *
 * El control fino de roles NO se hace aquí (el middleware no debe ser la única
 * barrera): cada layout privado vuelve a pedir el permiso con los guards del
 * servidor, y la base lo comprueba por tercera vez con RLS. Esto solo evita que
 * un usuario anonimo llegue a una pantalla privada.
 */
const PROTECTED_PREFIXES = ["/cuenta", "/club", "/admin", "/puerta", "/checkout"];

/**
 * Rutas que caen bajo un prefijo privado pero son publicas a proposito.
 *
 * `/club/registro` es la página con la que un local decide si quiere publicar
 * en GETIN: tiene que poder leerla cualquiera, sin cuenta. Solo el formulario
 * de envio pide sesión, y eso lo resuelve la propia página.
 */
const PUBLIC_EXCEPTIONS = ["/club/registro"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const needsSession =
    PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) &&
    !PUBLIC_EXCEPTIONS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!isSupabaseConfigured()) {
    // Modo demo: el catalogo funciona, las zonas privadas avisan que falta
    // configurar Supabase en lugar de romperse.
    if (needsSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/configuracion-requerida";
      url.searchParams.set("desde", pathname);
      return NextResponse.rewrite(url);
    }
    return response;
  }

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() revalida el token con Supabase: no confiamos en la cookie sin mas.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && needsSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("siguiente", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Todo menos estaticos, imagenes y los webhooks de pago (que se autentican
     * por firma, no por cookie).
     */
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
