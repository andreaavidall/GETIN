"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { publicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emailSchema, signInSchema, signUpSchema } from "@/lib/validation/schemas";

/**
 * Autenticacion.
 *
 * Supabase Auth gestiona el hash de la contraseña, la rotacion del refresh
 * token y las cookies httpOnly. Aquí solo se válida la entrada y se traduce el
 * error a algo legible.
 *
 * Los mensajes de error al iniciar sesión son deliberadamente genericos: decir
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
            ? "Ese correo ya tiene una cuenta. Inicia sesión."
            : error.message,
      };
    }

    // El trigger handle_new_user ya creo el perfil; aquí se completan los datos
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
    // Si el proyecto exige confirmación por correo, no hay sesión todavia.
    return { ok: true, next: data.session ? "/cuenta" : "/login?registrado=1" };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo completar el registro. Revisa la configuración de Supabase.",
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
          : "No se pudo iniciar sesión. Revisa la configuración de Supabase.",
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
    return { ok: false, error: error instanceof Error ? error.message : "Error al cerrar sesión" };
  }
}

/**
 * Envía el enlace para elegir una contraseña nueva.
 *
 * Responde siempre «ok», exista o no la cuenta: decir «ese correo no está
 * registrado» permitiría averiguar quién tiene cuenta en GETIN probando
 * direcciones.
 */
export async function requestPasswordResetAction(
  email: string,
  next?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return { ok: false, error: "Correo inválido" };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const destino = next && next.startsWith("/") ? next : "/cuenta";
    const redirectTo = `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?siguiente=${encodeURIComponent(
      `/nueva-contrasena?siguiente=${encodeURIComponent(destino)}`,
    )}`;

    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo });
    if (error && !error.message.toLowerCase().includes("not found")) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo enviar el enlace. Revisa la configuración de Supabase.",
    };
  }
}

/** Cambia la contraseña de la sesión abierta (la que crea el enlace de recuperación). */
export async function updatePasswordAction(
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = signUpSchema.shape.password.safeParse(password);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Contraseña inválida" };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "El enlace caducó. Pide uno nuevo desde «Recuperar contraseña»." };
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo cambiar" };
  }
}
