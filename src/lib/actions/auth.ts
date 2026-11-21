"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { publicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signInSchema, signUpSchema } from "@/lib/validation/schemas";

/**
 * Autenticacion.
 *
 * Supabase Auth gestiona el hash de la contraseña, la rotacion del refresh
 * token y las cookies httpOnly. Aqui solo se valida la entrada y se traduce el
 * error a algo legible.
 *
 * Los mensajes de error al iniciar sesion son deliberadamente genericos: decir
 * "ese correo no existe" permitiria enumerar usuarios.
 */
export type AuthResult = { ok: true; next: string } | { ok: false; error: string };

export async function signUpAction(input: unknown): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { email, password, fullName, phone, birthdate } = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone: phone || null },
        emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });

    if (error) {
      return {
        ok: false,
        error:
          error.message.toLowerCase().includes("already")
            ? "Ese correo ya tiene una cuenta. Inicia sesion."
            : error.message,
      };
    }

    // El trigger handle_new_user ya creo el perfil; aqui se completan los datos
    // que solo conoce el formulario y el consentimiento, con su fecha.
    if (data.user) {
      await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone: phone || null,
          birthdate,
          terms_accepted_at: new Date().toISOString(),
          privacy_accepted_at: new Date().toISOString(),
        })
        .eq("id", data.user.id);
    }

    revalidatePath("/", "layout");
    // Si el proyecto exige confirmacion por correo, no hay sesion todavia.
    return { ok: true, next: data.session ? "/cuenta" : "/login?registrado=1" };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo completar el registro. Revisa la configuracion de Supabase.",
    };
  }
}

export async function signInAction(input: unknown, next?: string): Promise<AuthResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error || !data.user) {
      return { ok: false, error: "Correo o contraseña incorrectos" };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_suspended")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profile?.is_suspended) {
      await supabase.auth.signOut();
      return { ok: false, error: "Esta cuenta esta suspendida. Escribe a soporte@getin.pe" };
    }

    revalidatePath("/", "layout");
    return { ok: true, next: next && next.startsWith("/") ? next : "/cuenta" };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo iniciar sesion. Revisa la configuracion de Supabase.",
    };
  }
}

export async function signOutAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.auth.signOut();
    if (user) {
      await recordAudit({
        action: "auth.signout",
        entity: "auth",
        entityId: user.id,
        actorId: user.id,
      });
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error al cerrar sesion" };
  }
}
