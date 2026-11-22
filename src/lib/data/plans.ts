import "server-only";

import { getSession } from "@/lib/auth/session";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Lectura de planes.
 *
 * La página pública se lee por token con la clave de servicio: no hay
 * política RLS que exponga un plan a cualquiera, de modo que la única llave
 * es el enlace. A cambio, aquí se devuelve solo lo que se enseña —nombre y
 * respuesta— y nunca el correo de quien se apuntó.
 */
export type PlanMemberView = {
  id: string;
  displayName: string;
  rsvp: "va" | "quiza" | "no";
  companions: number;
  isMe: boolean;
};

export type PlanView = {
  id: string;
  token: string;
  title: string;
  note: string | null;
  goalPeople: number | null;
  closedAt: Date | null;
  createdByMe: boolean;
  event: {
    slug: string;
    name: string;
    startsAt: Date;
    venueName: string;
    district: string;
    coverUrl: string | null;
    minAge: number;
  };
  members: PlanMemberView[];
  /** Personas confirmadas, contando acompañantes. */
  going: number;
};

type PlanRow = {
  id: string;
  token: string;
  title: string;
  note: string | null;
  goal_people: number | null;
  closed_at: string | null;
  creator_id: string;
  events: {
    slug: string;
    name: string;
    starts_at: string;
    cover_url: string | null;
    min_age: number;
    venues: { name: string; district: string } | null;
  } | null;
  plan_members: {
    id: string;
    display_name: string;
    rsvp: "va" | "quiza" | "no";
    companions: number;
    user_id: string | null;
  }[];
};

const SELECT = `
  id, token, title, note, goal_people, closed_at, creator_id,
  events!inner (slug, name, starts_at, cover_url, min_age, venues!inner (name, district)),
  plan_members (id, display_name, rsvp, companions, user_id)
`;

export async function getPlanByToken(token: string): Promise<PlanView | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("plans").select(SELECT).eq("token", token).maybeSingle();
  if (!data) return null;

  const session = await getSession();
  return toPlanView(data as unknown as PlanRow, session?.user.id ?? null);
}

export async function listMyPlans(): Promise<PlanView[]> {
  const session = await getSession();
  if (!session) return [];

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("plans")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(30);

  return ((data ?? []) as unknown as PlanRow[]).map((row) => toPlanView(row, session.user.id));
}

function toPlanView(row: PlanRow, viewerId: string | null): PlanView {
  const members: PlanMemberView[] = (row.plan_members ?? [])
    .map((m) => ({
      id: m.id,
      displayName: m.display_name,
      rsvp: m.rsvp,
      companions: m.companions,
      isMe: viewerId !== null && m.user_id === viewerId,
    }))
    // Primero quien va, luego los indecisos: es el orden en que se mira.
    .sort((a, b) => ORDEN[a.rsvp] - ORDEN[b.rsvp]);

  const going = members
    .filter((m) => m.rsvp === "va")
    .reduce((acc, m) => acc + 1 + m.companions, 0);

  return {
    id: row.id,
    token: row.token,
    title: row.title,
    note: row.note,
    goalPeople: row.goal_people,
    closedAt: row.closed_at ? new Date(row.closed_at) : null,
    createdByMe: viewerId !== null && row.creator_id === viewerId,
    event: {
      slug: row.events?.slug ?? "",
      name: row.events?.name ?? "",
      startsAt: new Date(row.events?.starts_at ?? Date.now()),
      venueName: row.events?.venues?.name ?? "",
      district: row.events?.venues?.district ?? "",
      coverUrl: row.events?.cover_url ?? null,
      minAge: row.events?.min_age ?? 18,
    },
    members,
    going,
  };
}

const ORDEN: Record<PlanMemberView["rsvp"], number> = { va: 0, quiza: 1, no: 2 };
