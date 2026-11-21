import "server-only";

import { cache } from "react";

import type { Actor, AppRole, VenueMembership } from "@/lib/domain/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: AppRole;
  isSuspended: boolean;
  avatarUrl: string | null;
};

export type Session = {
  user: SessionUser;
  actor: Actor;
};

/**
 * Lee la sesion actual y construye el "actor" que usan los guards.
 * `cache()` evita repetir la consulta dentro de una misma peticion.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabaseServerClient();

  // getUser valida el JWT contra Supabase; getSession() solo lee la cookie.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, role, is_suspended, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const { data: staffRows } = await supabase
    .from("venue_staff")
    .select("venue_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true);

  const memberships: VenueMembership[] = (staffRows ?? []).map((row) => ({
    venueId: row.venue_id as string,
    role: row.role as VenueMembership["role"],
    isActive: Boolean(row.is_active),
  }));

  const sessionUser: SessionUser = {
    id: profile.id as string,
    email: profile.email as string,
    fullName: (profile.full_name as string | null) ?? null,
    phone: (profile.phone as string | null) ?? null,
    role: profile.role as AppRole,
    isSuspended: Boolean(profile.is_suspended),
    avatarUrl: (profile.avatar_url as string | null) ?? null,
  };

  return {
    user: sessionUser,
    actor: {
      userId: sessionUser.id,
      role: sessionUser.role,
      isSuspended: sessionUser.isSuspended,
      memberships,
    },
  };
});

export async function getActor(): Promise<Actor | null> {
  return (await getSession())?.actor ?? null;
}
