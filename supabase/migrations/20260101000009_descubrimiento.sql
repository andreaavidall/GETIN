-- ===========================================================================
-- GETIN · 0009 · Descubrir, decidir y volver
--
-- Diez funciones nuevas comparten este esquema. Se agrupan en una migracion
-- porque se apoyan unas en otras (los avisos los disparan los favoritos y la
-- lista de espera; las promociones y las fotos cuelgan del local).
--
-- Lo que NO hay aqui: envio de correos. Las filas de `notifications` se
-- escriben igual, pero mientras no haya proveedor configurado se leen dentro
-- de la aplicacion y `sent_at` queda nulo. Prometer un correo que nadie manda
-- seria peor que no ofrecerlo.
-- ===========================================================================

-- ---------------------------------------------------------------- 1. AVISOS ---
-- `notifications` ya existia sin usarse. Se le añade el tipo (para agrupar en
-- la bandeja) y el enlace al que lleva el aviso.
alter table notifications
  add column kind text not null default 'generic',
  add column title text,
  add column body text,
  add column href text;

create index notifications_unread_idx on notifications(user_id) where read_at is null;

alter table notifications enable row level security;

create policy notifications_select_own on notifications
  for select to authenticated using (user_id = auth.uid());

-- Solo se permite marcar como leido: el contenido del aviso no se edita.
create policy notifications_update_own on notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke update on notifications from anon, authenticated;
grant update (read_at) on notifications to authenticated;

-- Preferencia del usuario. Por defecto activada para quien guarda un local:
-- guardar algo es justamente pedir que te avisen de ello.
alter table profiles
  add column notify_new_events boolean not null default true;

-- Aviso a quien tenga el local en favoritos cuando publica un evento.
create or replace function getin_notify_followers() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_venue venues%rowtype;
begin
  -- Solo al pasar a publicado, y solo una vez.
  if new.status <> 'published' or coalesce(old.status, 'draft') = 'published' then
    return new;
  end if;

  select * into v_venue from venues where id = new.venue_id;

  insert into notifications (user_id, channel, template, kind, title, body, href, payload)
  select f.user_id,
         'inapp',
         'event.published',
         'evento_nuevo',
         v_venue.name || ' publicó un evento',
         new.name,
         '/eventos/' || new.slug,
         jsonb_build_object('event_id', new.id, 'venue_id', new.venue_id)
  from favorites f
  join profiles p on p.id = f.user_id
  where f.venue_id = new.venue_id
    and p.notify_new_events
    -- Al propio equipo del local no se le avisa de su propio evento.
    and not exists (
      select 1 from venue_staff vs
      where vs.venue_id = new.venue_id and vs.user_id = f.user_id and vs.is_active
    );

  return new;
end;
$$;

create trigger events_notify_followers after insert or update of status on events
  for each row execute function getin_notify_followers();

-- --------------------------------------------------- 5. LISTA DE ESPERA ---
-- Apuntarse a que te avisen si se libera algo. No reserva nada ni da
-- preferencia: cuando llega el aviso, hay que comprar como todos.
create table waitlist_entries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  event_id        uuid not null references events(id) on delete cascade,
  ticket_type_id  uuid references ticket_types(id) on delete cascade,
  venue_table_id  uuid references venue_tables(id) on delete cascade,
  created_at      timestamptz not null default now(),
  notified_at     timestamptz,

  constraint waitlist_one_target
    check ((ticket_type_id is not null) <> (venue_table_id is not null))
);

create unique index waitlist_user_ticket_uq
  on waitlist_entries(user_id, ticket_type_id) where ticket_type_id is not null;
create unique index waitlist_user_table_uq
  on waitlist_entries(user_id, event_id, venue_table_id) where venue_table_id is not null;
create index waitlist_ticket_idx on waitlist_entries(ticket_type_id) where notified_at is null;
create index waitlist_table_idx on waitlist_entries(venue_table_id) where notified_at is null;

alter table waitlist_entries enable row level security;

create policy waitlist_select_own on waitlist_entries
  for select to authenticated using (user_id = auth.uid());
create policy waitlist_insert_own on waitlist_entries
  for insert to authenticated with check (user_id = auth.uid());
create policy waitlist_delete_own on waitlist_entries
  for delete to authenticated using (user_id = auth.uid());

-- Cuando vuelve a haber sitio, se avisa. El aviso dice lo que es: hay
-- disponibilidad ahora, no "tienes una entrada guardada".
create or replace function getin_notify_waitlist_tickets() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_antes integer;
  v_ahora integer;
  v_event events%rowtype;
begin
  v_antes := old.capacity - old.sold_count - old.held_count;
  v_ahora := new.capacity - new.sold_count - new.held_count;

  -- Solo interesa el cruce de cero hacia arriba.
  if v_antes > 0 or v_ahora <= 0 then
    return new;
  end if;

  select * into v_event from events where id = new.event_id;
  if v_event.status <> 'published' or v_event.starts_at < now() then
    return new;
  end if;

  with avisados as (
    update waitlist_entries w
       set notified_at = now()
     where w.ticket_type_id = new.id and w.notified_at is null
    returning w.user_id
  )
  insert into notifications (user_id, channel, template, kind, title, body, href, payload)
  select a.user_id,
         'inapp',
         'waitlist.available',
         'disponible',
         'Se liberaron entradas',
         new.name || ' · ' || v_event.name,
         '/eventos/' || v_event.slug,
         jsonb_build_object('ticket_type_id', new.id, 'event_id', v_event.id)
  from avisados a;

  return new;
end;
$$;

create trigger ticket_types_notify_waitlist after update on ticket_types
  for each row execute function getin_notify_waitlist_tickets();

create or replace function getin_notify_waitlist_tables() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_event events%rowtype;
  v_mesa venue_tables%rowtype;
begin
  if old.state = 'available' or new.state <> 'available' then
    return new;
  end if;

  select * into v_event from events where id = new.event_id;
  if v_event.status <> 'published' or v_event.starts_at < now() then
    return new;
  end if;
  select * into v_mesa from venue_tables where id = new.venue_table_id;

  with avisados as (
    update waitlist_entries w
       set notified_at = now()
     where w.venue_table_id = new.venue_table_id
       and w.event_id = new.event_id
       and w.notified_at is null
    returning w.user_id
  )
  insert into notifications (user_id, channel, template, kind, title, body, href, payload)
  select a.user_id,
         'inapp',
         'waitlist.available',
         'disponible',
         'Se liberó una mesa',
         v_mesa.label || ' · ' || v_event.name,
         '/eventos/' || v_event.slug || '#mesas',
         jsonb_build_object('venue_table_id', new.venue_table_id, 'event_id', v_event.id)
  from avisados a;

  return new;
end;
$$;

create trigger etb_notify_waitlist after update of state on event_table_availability
  for each row execute function getin_notify_waitlist_tables();

-- ------------------------------------------------- 2. PLANES DE GRUPO ---
-- Un enlace para decidir entre amigos a que evento van y cuantos son. No
-- mueve dinero: cada quien compra su entrada. Lo que resuelve es el "¿somos
-- suficientes para una mesa?" que hoy se hace por chat.
create type plan_rsvp as enum ('va', 'quiza', 'no');

create table plans (
  id          uuid primary key default gen_random_uuid(),
  -- Token del enlace. Es la credencial: quien lo tiene, entra al plan.
  token       text not null unique,
  event_id    uuid not null references events(id) on delete cascade,
  creator_id  uuid not null references profiles(id) on delete cascade,
  title       text not null,
  note        text,
  -- Cuantas personas se buscan (p. ej. la capacidad de una mesa).
  goal_people smallint check (goal_people is null or goal_people between 2 and 50),
  venue_table_id uuid references venue_tables(id) on delete set null,
  closed_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index plans_event_idx on plans(event_id);
create index plans_creator_idx on plans(creator_id, created_at desc);
create trigger plans_updated_at before update on plans
  for each row execute function set_updated_at();

create table plan_members (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references plans(id) on delete cascade,
  user_id       uuid references profiles(id) on delete set null,
  display_name  text not null,
  rsvp          plan_rsvp not null default 'va',
  companions    smallint not null default 0 check (companions between 0 and 10),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index plan_members_user_uq
  on plan_members(plan_id, user_id) where user_id is not null;
create index plan_members_plan_idx on plan_members(plan_id, created_at);
create trigger plan_members_updated_at before update on plan_members
  for each row execute function set_updated_at();

alter table plans enable row level security;
alter table plan_members enable row level security;

-- Por la API publica no se listan planes: se leen por su token desde el
-- servidor. Quien lo creo si puede ver los suyos en su cuenta.
create policy plans_select_own on plans
  for select to authenticated using (creator_id = auth.uid());
create policy plans_insert_own on plans
  for insert to authenticated with check (creator_id = auth.uid());
create policy plans_update_own on plans
  for update to authenticated
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());

create policy plan_members_select_own on plan_members
  for select to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from plans p where p.id = plan_id and p.creator_id = auth.uid()));

-- ------------------------------------- 4. INFORMACION PARA DECIDIR ---
-- Datos concretos que ayudan a elegir mas que una descripcion larga.
alter table venues
  add column ambiences      text[] not null default '{}',  -- terraza, pista, zona para sentarse
  add column accessibility  text,                          -- rampa, ascensor, baño adaptado
  add column parking        text,                          -- propio, de pago, en la calle
  add column entrance_notes text;                          -- por donde se entra

-- Que incluye exactamente cada entrada. Lista corta y literal, no un parrafo.
alter table ticket_types
  add column includes text[] not null default '{}';

-- Fotos del local, como ya existian las del evento.
create table venue_images (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references venues(id) on delete cascade,
  url         text not null,
  alt         text,
  kind        text not null default 'ambiente',   -- ambiente | mesa | fachada
  position    smallint not null default 0,
  created_at  timestamptz not null default now()
);
create index venue_images_venue_idx on venue_images(venue_id, position);

alter table venue_images enable row level security;

create policy venue_images_public_read on venue_images
  for select to anon, authenticated
  using (exists (select 1 from venues v where v.id = venue_id and v.status = 'approved'));

create policy venue_images_staff_write on venue_images
  for all to authenticated
  using (getin_has_venue_access(venue_id, array['owner','manager']::venue_role[]))
  with check (getin_has_venue_access(venue_id, array['owner','manager']::venue_role[]));

-- ------------------------------------------- 9. PROMOCIONES DEL LOCAL ---
-- Beneficios reales publicados por el local, con sus condiciones a la vista.
-- GETIN no inventa ninguno: si no hay acuerdo, esta tabla esta vacia.
create table promotions (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references venues(id) on delete cascade,
  event_id    uuid references events(id) on delete cascade,
  title       text not null,
  description text not null,
  -- Las condiciones son obligatorias a proposito: un beneficio sin letra
  -- pequeña visible es exactamente lo que genera la discusion en la puerta.
  conditions  text not null,
  starts_at   timestamptz,
  ends_at     timestamptz,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint promotions_dates_ok check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index promotions_venue_idx on promotions(venue_id) where is_active;
create index promotions_event_idx on promotions(event_id) where is_active;
create trigger promotions_updated_at before update on promotions
  for each row execute function set_updated_at();

alter table promotions enable row level security;

create policy promotions_public_read on promotions
  for select to anon, authenticated
  using (is_active and exists (select 1 from venues v where v.id = venue_id and v.status = 'approved'));

create policy promotions_staff_write on promotions
  for all to authenticated
  using (getin_has_venue_access(venue_id, array['owner','manager']::venue_role[]))
  with check (getin_has_venue_access(venue_id, array['owner','manager']::venue_role[]));

-- -------------------------------------------- 6. TRASPASO DE ENTRADAS ---
-- Pasar una entrada a quien va a usarla. El QR viejo se anula y se emite uno
-- nuevo: si no, la entrada circularia en dos telefonos.
create table ticket_transfers (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references tickets(id) on delete cascade,
  from_user_id  uuid not null references profiles(id) on delete cascade,
  to_user_id    uuid references profiles(id) on delete set null,
  to_email      citext not null,
  token_hash    text not null,                 -- sha256 del token del enlace
  expires_at    timestamptz not null,
  claimed_at    timestamptz,
  cancelled_at  timestamptz,
  created_at    timestamptz not null default now()
);
create unique index ticket_transfers_token_uq on ticket_transfers(token_hash);
create index ticket_transfers_ticket_idx on ticket_transfers(ticket_id)
  where claimed_at is null and cancelled_at is null;

alter table ticket_transfers enable row level security;

create policy ticket_transfers_select_own on ticket_transfers
  for select to authenticated
  using (from_user_id = auth.uid() or to_user_id = auth.uid());

-- ------------------------------------------------ 7. SOPORTE POR COMPRA ---
alter table support_tickets
  add column reason text not null default 'otro',
  add column last_reply_at timestamptz;

create table support_messages (
  id                uuid primary key default gen_random_uuid(),
  support_ticket_id uuid not null references support_tickets(id) on delete cascade,
  author_id         uuid references profiles(id) on delete set null,
  is_staff          boolean not null default false,
  body              text not null,
  created_at        timestamptz not null default now()
);
create index support_messages_ticket_idx on support_messages(support_ticket_id, created_at);

alter table support_tickets enable row level security;
alter table support_messages enable row level security;

create policy support_tickets_select_own on support_tickets
  for select to authenticated
  using (user_id = auth.uid() or getin_is_superadmin());
create policy support_tickets_insert_own on support_tickets
  for insert to authenticated with check (user_id = auth.uid());
create policy support_tickets_admin_update on support_tickets
  for update to authenticated
  using (getin_is_superadmin()) with check (getin_is_superadmin());

create policy support_messages_select_own on support_messages
  for select to authenticated
  using (exists (select 1 from support_tickets s
                 where s.id = support_ticket_id
                   and (s.user_id = auth.uid() or getin_is_superadmin())));
create policy support_messages_insert_own on support_messages
  for insert to authenticated
  with check (author_id = auth.uid()
              and exists (select 1 from support_tickets s
                          where s.id = support_ticket_id
                            and (s.user_id = auth.uid() or getin_is_superadmin())));

-- ------------------------------------------ 10. HERRAMIENTAS DEL LOCAL ---
-- Publicacion programada: el evento se prepara hoy y sale solo a su hora.
alter table events
  add column publish_at timestamptz;

create index events_publish_at_idx on events(publish_at)
  where status = 'draft' and publish_at is not null;

-- De donde vino la compra, para saber que enlace funciona. Se guarda una
-- etiqueta corta, no la URL completa ni nada del navegador.
alter table orders
  add column source text;

create index orders_source_idx on orders(venue_id, source) where source is not null;

-- Publica los borradores cuyo momento ya llego. La ejecuta el servidor con la
-- clave de servicio (o el cron de Supabase), nunca el navegador.
create or replace function getin_publish_scheduled() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  with publicados as (
    update events
       set status = 'published', published_at = now()
     where status = 'draft'
       and publish_at is not null
       and publish_at <= now()
    returning 1
  )
  select count(*) into v_count from publicados;
  return v_count;
end;
$$;

-- ------------------------------------------------------------- permisos ---
-- Igual que en la 0005 y la 0008: nada de esto se llama desde el navegador.
revoke execute on function getin_notify_followers() from public, anon, authenticated;
revoke execute on function getin_notify_waitlist_tickets() from public, anon, authenticated;
revoke execute on function getin_notify_waitlist_tables() from public, anon, authenticated;
revoke execute on function getin_publish_scheduled() from public, anon, authenticated;
