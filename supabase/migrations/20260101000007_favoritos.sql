-- ===========================================================================
-- GETIN · 0007 · Favoritos
--
-- Guardar un evento o un local para volver despues. Se persiste en la base y
-- no en el navegador a proposito: quien guarda un plan en el celular espera
-- encontrarlo en la computadora, y al reves.
--
-- Una sola tabla con dos referencias opcionales y un CHECK que obliga a que
-- cada fila apunte exactamente a una cosa. Asi la pagina de favoritos lee de
-- un solo sitio y los indices unicos impiden duplicados.
-- ===========================================================================

create table favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  event_id    uuid references events(id) on delete cascade,
  venue_id    uuid references venues(id) on delete cascade,
  created_at  timestamptz not null default now(),

  -- Exactamente una de las dos: ni ninguna ni las dos.
  constraint favorites_one_target
    check ((event_id is not null) <> (venue_id is not null))
);

-- Un usuario no puede guardar dos veces lo mismo. Son indices parciales
-- porque la columna que no se usa queda nula y UNIQUE no la agruparia.
create unique index favorites_user_event_uq
  on favorites(user_id, event_id) where event_id is not null;
create unique index favorites_user_venue_uq
  on favorites(user_id, venue_id) where venue_id is not null;

create index favorites_user_idx on favorites(user_id, created_at desc);

alter table favorites enable row level security;

-- Cada quien gestiona los suyos y no ve los de nadie mas. No hay politica de
-- lectura para el local ni para el superadmin: a quien le gusta un evento no
-- es informacion que GETIN necesite.
create policy favorites_select_own on favorites
  for select to authenticated using (user_id = auth.uid());

create policy favorites_insert_own on favorites
  for insert to authenticated with check (user_id = auth.uid());

create policy favorites_delete_own on favorites
  for delete to authenticated using (user_id = auth.uid());
