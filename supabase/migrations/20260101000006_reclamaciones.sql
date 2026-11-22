-- ===========================================================================
-- GETIN · 0006 · Libro de Reclamaciones virtual
--
-- Obligatorio en Peru para quien vende por internet (Codigo de Proteccion y
-- Defensa del Consumidor, Ley 29571, y su reglamento). La norma pide cosas
-- concretas que aqui se cumplen:
--
--   * numeracion CORRELATIVA, no un uuid suelto;
--   * distinguir QUEJA (malestar con la atencion) de RECLAMO (disconformidad
--     con el producto o servicio);
--   * datos del consumidor, del bien contratado, monto, detalle y pedido;
--   * constancia inmediata para el consumidor;
--   * plazo de respuesta de 15 dias habiles.
--
-- El correlativo se genera con una secuencia, de modo que dos envios
-- simultaneos no pueden recibir el mismo numero.
-- ===========================================================================

create type complaint_kind as enum ('queja', 'reclamo');
create type complaint_status as enum ('recibido', 'en_proceso', 'respondido', 'cerrado');
create type complaint_good as enum ('producto', 'servicio');

create sequence complaints_correlative_seq start 1;

create table complaints (
  id                uuid primary key default gen_random_uuid(),
  -- Numero visible para el consumidor: GETIN-LR-000001
  correlative       text not null unique
                      default 'GETIN-LR-' || lpad(nextval('complaints_correlative_seq')::text, 6, '0'),
  kind              complaint_kind not null,
  good_type         complaint_good not null default 'servicio',

  -- Identificacion del consumidor (la norma la exige).
  full_name         text not null,
  document_type     text not null default 'DNI',
  document_number   text not null,
  email             citext not null,
  phone             text,
  address           text,
  is_minor          boolean not null default false,
  guardian_name     text,

  -- Sobre que reclama.
  order_code        text,
  order_id          uuid references orders(id) on delete set null,
  venue_id          uuid references venues(id) on delete set null,
  amount_cents      bigint check (amount_cents is null or amount_cents >= 0),
  good_description  text not null,

  -- El detalle y lo que pide.
  detail            text not null,
  request           text not null,

  -- Seguimiento.
  status            complaint_status not null default 'recibido',
  user_id           uuid references profiles(id) on delete set null,
  response          text,
  responded_at      timestamptz,
  responded_by      uuid references profiles(id) on delete set null,
  -- 15 dias habiles; se guarda calculado para no discutirlo despues.
  due_at            timestamptz not null default (now() + interval '21 days'),
  copy_sent_at      timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint complaints_minor_guardian
    check (not is_minor or (guardian_name is not null and length(guardian_name) > 2))
);

create index complaints_status_idx on complaints(status, created_at desc);
create index complaints_email_idx on complaints(email);
create index complaints_user_idx on complaints(user_id);

create trigger complaints_updated_at before update on complaints
  for each row execute function set_updated_at();

alter table complaints enable row level security;

-- Cualquiera puede presentar una reclamacion, tenga cuenta o no: la ley no
-- exige estar registrado para usar el libro.
create policy complaints_insert_any on complaints
  for insert to anon, authenticated with check (true);

-- Cada quien ve las suyas; GETIN las ve todas.
create policy complaints_read_own on complaints
  for select to authenticated
  using (user_id = auth.uid() or getin_is_superadmin());

create policy complaints_admin_update on complaints
  for update using (getin_is_superadmin()) with check (getin_is_superadmin());

-- El consumidor NO puede alterar su reclamacion despues de enviarla, ni
-- cambiar su estado: seria vaciar de sentido el registro.
create or replace function guard_complaint_integrity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or getin_is_superadmin() then
    return new;
  end if;
  raise exception 'FORBIDDEN: una reclamación registrada no se modifica'
    using errcode = 'insufficient_privilege';
end;
$$;
create trigger complaints_guard before update on complaints
  for each row execute function guard_complaint_integrity();

-- El correlativo tampoco se toca.
revoke update (correlative, created_at) on complaints from anon, authenticated;
