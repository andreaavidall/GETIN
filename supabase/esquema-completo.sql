-- ===========================================================================
-- GETIN · esquema completo en un solo archivo
--
-- Alternativa a la CLI: copia TODO este archivo y pegalo en el editor SQL de
-- tu proyecto de Supabase (Dashboard -> SQL Editor -> New query -> Run).
-- Asi no hace falta ni `supabase link` ni la contraseña de la base.
--
-- Es la concatenacion, en orden, de supabase/migrations/. Si usas la CLI
-- (`supabase db push`) NO necesitas este archivo.
--
-- Ejecutalo UNA sola vez sobre un proyecto nuevo: crea tipos y tablas, y
-- fallara si ya existen.
--
-- Despues, opcionalmente, pega supabase/seed.sql para cargar el catalogo de
-- demostracion. OJO: el seed crea usuarios de prueba con contraseña conocida
-- (demo1234). No lo uses en un proyecto que vaya a ser publico de verdad.
-- ===========================================================================


-- ===========================================================================
-- 20260101000001_init.sql
-- ===========================================================================

-- ===========================================================================
-- GETIN · 0001 · Esquema base
-- Convenciones:
--   * Dinero en enteros (centimos). Nunca float. Moneda por defecto PEN.
--   * Timestamps en timestamptz, siempre UTC.
--   * Toda tabla de negocio lleva created_at / updated_at.
-- ===========================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ----------------------------------------------------------------- enums ---
create type app_role as enum ('client', 'club_admin', 'door_staff', 'superadmin');
create type venue_role as enum ('owner', 'manager', 'door');
create type venue_status as enum ('draft', 'pending_review', 'approved', 'rejected', 'suspended');
create type event_status as enum ('draft', 'published', 'cancelled', 'finished');
create type ticket_status as enum ('issued', 'used', 'cancelled', 'refunded');
create type order_status as enum (
  'pending', 'awaiting_payment', 'paid', 'failed', 'expired',
  'cancelled', 'refunded', 'partially_refunded'
);
create type payment_status as enum (
  'initiated', 'pending', 'authorized', 'paid', 'failed', 'refunded', 'chargeback'
);
create type hold_status as enum ('active', 'consumed', 'released', 'expired');
create type table_state as enum ('available', 'held', 'reserved', 'blocked');
create type reservation_status as enum ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
create type guest_entry_status as enum ('pending', 'confirmed', 'rejected', 'cancelled', 'used');
create type checkin_result as enum (
  'granted', 'denied_used', 'denied_invalid', 'denied_event', 'denied_unpaid',
  'denied_window', 'review'
);
create type settlement_status as enum ('pending', 'in_review', 'paid', 'disputed');
create type refund_status as enum ('requested', 'approved', 'rejected', 'processed', 'failed');
create type support_status as enum ('open', 'pending_user', 'resolved', 'closed');
create type order_item_kind as enum ('ticket', 'table', 'guest_list');

-- ----------------------------------------------------- utilidades comunes ---
create or replace function set_updated_at() returns trigger
language plpgsql as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

-- =========================================================== 1. USUARIOS ===
-- profiles.id referencia auth.users (gestionado por Supabase Auth).
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         citext not null,
  full_name     text,
  phone         text,
  document_id   text,                       -- DNI/CE. Dato personal: ver RLS.
  birthdate     date,
  role          app_role not null default 'client',
  avatar_url    text,
  marketing_opt_in boolean not null default false,
  -- Consentimiento Ley 29733 (proteccion de datos personales, Peru).
  privacy_accepted_at timestamptz,
  terms_accepted_at   timestamptz,
  is_suspended  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index profiles_role_idx on profiles(role);
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ============================================================= 2. LOCALES ===
create table venues (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  legal_name    text,
  tax_id        text,                        -- RUC
  description   text,
  district      text not null,               -- Miraflores, Barranco, ...
  address       text not null,
  city          text not null default 'Lima',
  country       text not null default 'PE',
  lat           numeric(9,6),
  lng           numeric(9,6),
  phone         text,
  email         citext,
  instagram     text,
  cover_url     text,
  logo_url      text,
  capacity      integer check (capacity is null or capacity > 0),
  min_age       smallint not null default 18 check (min_age >= 18),
  dress_code    text,
  music_genres  text[] not null default '{}',
  status        venue_status not null default 'draft',
  is_verified   boolean not null default false,
  -- Comision especifica del local; si es null se usa la global de platform_settings.
  commission_bps integer check (commission_bps is null or (commission_bps between 0 and 10000)),
  owner_id      uuid references profiles(id) on delete set null,
  is_demo       boolean not null default false,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index venues_status_idx on venues(status);
create index venues_district_idx on venues(district);
create trigger venues_updated_at before update on venues
  for each row execute function set_updated_at();

-- Personal del local: define el alcance (scoping) de club_admin y door_staff.
create table venue_staff (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references venues(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  role        venue_role not null,
  is_active   boolean not null default true,
  invited_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (venue_id, user_id)
);
create index venue_staff_user_idx on venue_staff(user_id) where is_active;
create trigger venue_staff_updated_at before update on venue_staff
  for each row execute function set_updated_at();

-- Expediente de verificacion comercial (lo revisa el superadmin).
create table venue_verifications (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references venues(id) on delete cascade,
  submitted_by  uuid references profiles(id) on delete set null,
  reviewed_by   uuid references profiles(id) on delete set null,
  status        venue_status not null default 'pending_review',
  documents     jsonb not null default '[]'::jsonb,   -- rutas en Storage, no archivos
  notes         text,
  reviewer_notes text,
  submitted_at  timestamptz not null default now(),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index venue_verifications_venue_idx on venue_verifications(venue_id);
create trigger venue_verifications_updated_at before update on venue_verifications
  for each row execute function set_updated_at();

-- ============================================================= 3. EVENTOS ===
create table events (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references venues(id) on delete cascade,
  slug            text not null unique,
  name            text not null,
  tagline         text,
  description     text,
  cover_url       text,
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  doors_open_at   timestamptz,
  last_entry_at   timestamptz,
  timezone        text not null default 'America/Lima',
  min_age         smallint not null default 18 check (min_age >= 18),
  music_genres    text[] not null default '{}',
  lineup          jsonb not null default '[]'::jsonb,  -- [{name, role, start}]
  entry_rules     text,
  cancellation_policy text,
  status          event_status not null default 'draft',
  is_demo         boolean not null default false,       -- datos ficticios etiquetados
  published_at    timestamptz,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint events_dates_ok check (ends_at is null or ends_at > starts_at)
);
create index events_venue_idx on events(venue_id);
create index events_starts_at_idx on events(starts_at);
create index events_status_starts_idx on events(status, starts_at);
create trigger events_updated_at before update on events
  for each row execute function set_updated_at();

create table event_images (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  url         text not null,
  alt         text,
  position    smallint not null default 0,
  created_at  timestamptz not null default now()
);
create index event_images_event_idx on event_images(event_id, position);

-- ============================================================ 4. ENTRADAS ===
create table ticket_types (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references events(id) on delete cascade,
  name              text not null,                    -- General, Preventa, VIP...
  description       text,
  price_cents       bigint not null check (price_cents >= 0),
  currency          char(3) not null default 'PEN',
  capacity          integer not null check (capacity > 0),
  sold_count        integer not null default 0 check (sold_count >= 0),
  held_count        integer not null default 0 check (held_count >= 0),
  max_per_order     smallint not null default 10 check (max_per_order between 1 and 50),
  sales_start_at    timestamptz,
  sales_end_at      timestamptz,
  conditions        text,
  position          smallint not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Invariante central del inventario: nunca se vende ni se retiene mas que el aforo.
  constraint ticket_types_no_oversell check (sold_count + held_count <= capacity),
  constraint ticket_types_sales_window
    check (sales_end_at is null or sales_start_at is null or sales_end_at > sales_start_at)
);
create index ticket_types_event_idx on ticket_types(event_id, position);
create trigger ticket_types_updated_at before update on ticket_types
  for each row execute function set_updated_at();

-- ============================================================= 5. MESAS VIP ===
create table venue_tables (
  id                    uuid primary key default gen_random_uuid(),
  venue_id              uuid not null references venues(id) on delete cascade,
  label                 text not null,                 -- "Mesa 12" / "Box A"
  zone                  text,                          -- Terraza, Pista, Balcon
  capacity              smallint not null check (capacity > 0),
  default_price_cents   bigint check (default_price_cents is null or default_price_cents >= 0),
  default_min_consumption_cents bigint
    check (default_min_consumption_cents is null or default_min_consumption_cents >= 0),
  position_x            numeric(6,2),                  -- para el mapa visual (fase 3)
  position_y            numeric(6,2),
  notes                 text,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (venue_id, label)
);
create index venue_tables_venue_idx on venue_tables(venue_id) where is_active;
create trigger venue_tables_updated_at before update on venue_tables
  for each row execute function set_updated_at();

-- Disponibilidad por evento. El UNIQUE(event_id, venue_table_id) es lo que impide
-- que una misma mesa se venda dos veces para el mismo evento.
create table event_table_availability (
  id                    uuid primary key default gen_random_uuid(),
  event_id              uuid not null references events(id) on delete cascade,
  venue_table_id        uuid not null references venue_tables(id) on delete cascade,
  state                 table_state not null default 'available',
  price_cents           bigint not null check (price_cents >= 0),
  min_consumption_cents bigint not null default 0 check (min_consumption_cents >= 0),
  deposit_cents         bigint not null default 0 check (deposit_cents >= 0),
  conditions            text,
  held_until            timestamptz,
  held_by_order_id      uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (event_id, venue_table_id),
  constraint etb_deposit_lte_price check (deposit_cents <= price_cents),
  constraint etb_hold_has_deadline check (state <> 'held' or held_until is not null)
);
create index etb_event_state_idx on event_table_availability(event_id, state);
create trigger etb_updated_at before update on event_table_availability
  for each row execute function set_updated_at();

-- ==================================================== 6. LISTAS DE INVITADOS ===
create table guest_lists (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  name            text not null,
  description     text,
  capacity        integer not null check (capacity > 0),
  confirmed_count integer not null default 0 check (confirmed_count >= 0),
  signup_deadline timestamptz,
  last_entry_at   timestamptz,
  conditions      text,
  benefits        text,
  auto_approve    boolean not null default false,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint guest_lists_capacity check (confirmed_count <= capacity)
);
create index guest_lists_event_idx on guest_lists(event_id);
create trigger guest_lists_updated_at before update on guest_lists
  for each row execute function set_updated_at();

create table guest_list_entries (
  id            uuid primary key default gen_random_uuid(),
  guest_list_id uuid not null references guest_lists(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  guest_name    text not null,
  companions    smallint not null default 0 check (companions between 0 and 20),
  status        guest_entry_status not null default 'pending',
  decided_by    uuid references profiles(id) on delete set null,
  decided_at    timestamptz,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (guest_list_id, user_id)
);
create index gle_list_status_idx on guest_list_entries(guest_list_id, status);
create index gle_user_idx on guest_list_entries(user_id);
create trigger gle_updated_at before update on guest_list_entries
  for each row execute function set_updated_at();

-- ======================================================= 7. ORDENES Y PAGOS ===
create table platform_settings (
  id                      smallint primary key default 1 check (id = 1),
  default_commission_bps  integer not null default 700
    check (default_commission_bps between 0 and 10000),
  igv_bps                 integer not null default 1800   -- IGV 18% informativo
    check (igv_bps between 0 and 10000),
  service_fee_fixed_cents bigint not null default 0 check (service_fee_fixed_cents >= 0),
  hold_minutes            smallint not null default 15 check (hold_minutes between 1 and 120),
  updated_at              timestamptz not null default now()
);
insert into platform_settings (id) values (1) on conflict do nothing;

create table orders (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,          -- codigo legible: GETIN-XXXXXX
  user_id           uuid not null references profiles(id) on delete restrict,
  event_id          uuid not null references events(id) on delete restrict,
  venue_id          uuid not null references venues(id) on delete restrict,
  status            order_status not null default 'pending',
  currency          char(3) not null default 'PEN',
  subtotal_cents    bigint not null default 0 check (subtotal_cents >= 0),
  service_fee_cents bigint not null default 0 check (service_fee_cents >= 0),
  tax_cents         bigint not null default 0 check (tax_cents >= 0),
  total_cents       bigint not null default 0 check (total_cents >= 0),
  -- Desglose del reparto, congelado al momento de la compra.
  commission_bps    integer not null default 0 check (commission_bps between 0 and 10000),
  getin_fee_cents   bigint not null default 0 check (getin_fee_cents >= 0),
  gateway_fee_cents bigint not null default 0 check (gateway_fee_cents >= 0),
  venue_amount_cents bigint not null default 0 check (venue_amount_cents >= 0),
  buyer_name        text,
  buyer_email       citext,
  buyer_phone       text,
  expires_at        timestamptz,                   -- vencimiento de la retencion
  paid_at           timestamptz,
  cancelled_at      timestamptz,
  -- Clave de idempotencia del cliente al crear la orden.
  idempotency_key   text unique,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- El IGV va CONTENIDO en el precio del local (costumbre peruana: el precio
  -- publicado ya lo incluye), por eso `tax_cents` es informativo y no se suma
  -- aparte. Lo que se cobra es el precio del local mas el cargo por servicio.
  constraint orders_total_coherent
    check (total_cents = subtotal_cents + service_fee_cents),
  constraint orders_tax_within_subtotal
    check (tax_cents <= subtotal_cents)
);
create index orders_user_idx on orders(user_id, created_at desc);
create index orders_event_idx on orders(event_id);
create index orders_venue_status_idx on orders(venue_id, status);
create index orders_expiring_idx on orders(expires_at) where status in ('pending', 'awaiting_payment');
create trigger orders_updated_at before update on orders
  for each row execute function set_updated_at();

create table order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references orders(id) on delete cascade,
  kind              order_item_kind not null,
  ticket_type_id    uuid references ticket_types(id) on delete restrict,
  table_availability_id uuid references event_table_availability(id) on delete restrict,
  guest_list_id     uuid references guest_lists(id) on delete restrict,
  description       text not null,
  quantity          integer not null check (quantity > 0),
  unit_price_cents  bigint not null check (unit_price_cents >= 0),
  total_cents       bigint not null check (total_cents >= 0),
  created_at        timestamptz not null default now(),
  constraint order_items_target check (
    (kind = 'ticket'     and ticket_type_id is not null) or
    (kind = 'table'      and table_availability_id is not null) or
    (kind = 'guest_list' and guest_list_id is not null)
  )
);
create index order_items_order_idx on order_items(order_id);

-- Retenciones temporales de inventario de entradas.
create table inventory_holds (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  ticket_type_id  uuid not null references ticket_types(id) on delete cascade,
  quantity        integer not null check (quantity > 0),
  status          hold_status not null default 'active',
  expires_at      timestamptz not null,
  released_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index inventory_holds_active_idx on inventory_holds(ticket_type_id) where status = 'active';
create index inventory_holds_expiry_idx on inventory_holds(expires_at) where status = 'active';
create unique index inventory_holds_order_type_idx
  on inventory_holds(order_id, ticket_type_id) where status = 'active';

create table payments (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references orders(id) on delete restrict,
  provider          text not null,                 -- 'test' | 'culqi' | ...
  provider_payment_id text,
  status            payment_status not null default 'initiated',
  amount_cents      bigint not null check (amount_cents >= 0),
  currency          char(3) not null default 'PEN',
  -- Solo metadatos no sensibles. Jamas PAN completo ni CVV.
  card_brand        text,
  card_last4        char(4),
  failure_code      text,
  failure_message   text,
  authorized_at     timestamptz,
  paid_at           timestamptz,
  raw_summary       jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (provider, provider_payment_id)
);
create index payments_order_idx on payments(order_id);
create trigger payments_updated_at before update on payments
  for each row execute function set_updated_at();

-- Bitacora de webhooks: garantiza idempotencia (un event_id del proveedor = una fila).
create table payment_webhook_events (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null,
  provider_event_id text not null,
  event_type        text not null,
  signature_valid   boolean not null,
  processed         boolean not null default false,
  processed_at      timestamptz,
  order_id          uuid references orders(id) on delete set null,
  payload           jsonb not null,
  error             text,
  received_at       timestamptz not null default now(),
  unique (provider, provider_event_id)
);
create index pwe_unprocessed_idx on payment_webhook_events(received_at) where not processed;

create table refunds (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete restrict,
  payment_id    uuid references payments(id) on delete set null,
  requested_by  uuid references profiles(id) on delete set null,
  decided_by    uuid references profiles(id) on delete set null,
  status        refund_status not null default 'requested',
  amount_cents  bigint not null check (amount_cents > 0),
  reason        text not null,
  provider_refund_id text,
  decided_at    timestamptz,
  processed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index refunds_order_idx on refunds(order_id);
create trigger refunds_updated_at before update on refunds
  for each row execute function set_updated_at();

-- ====================================================== 8. TICKETS Y ACCESO ===
create table tickets (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete restrict,
  order_item_id   uuid references order_items(id) on delete set null,
  ticket_type_id  uuid not null references ticket_types(id) on delete restrict,
  event_id        uuid not null references events(id) on delete restrict,
  venue_id        uuid not null references venues(id) on delete restrict,
  user_id         uuid not null references profiles(id) on delete restrict,
  serial          text not null unique,          -- GETIN-T-XXXXXXXX (legible)
  status          ticket_status not null default 'issued',
  holder_name     text,
  used_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index tickets_user_idx on tickets(user_id, created_at desc);
create index tickets_event_idx on tickets(event_id, status);
create index tickets_order_idx on tickets(order_id);
create trigger tickets_updated_at before update on tickets
  for each row execute function set_updated_at();

create table table_reservations (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references orders(id) on delete restrict,
  table_availability_id uuid not null references event_table_availability(id) on delete restrict,
  event_id              uuid not null references events(id) on delete restrict,
  venue_id              uuid not null references venues(id) on delete restrict,
  user_id               uuid not null references profiles(id) on delete restrict,
  status                reservation_status not null default 'pending',
  guests                smallint not null default 1 check (guests > 0),
  total_cents           bigint not null check (total_cents >= 0),
  deposit_paid_cents    bigint not null default 0 check (deposit_paid_cents >= 0),
  balance_due_cents     bigint not null default 0 check (balance_due_cents >= 0),
  conditions_snapshot   text,
  used_at               timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
-- Una reserva viva por mesa/evento: segunda barrera contra doble venta.
create unique index table_reservations_one_live_idx
  on table_reservations(table_availability_id)
  where status in ('pending', 'confirmed', 'completed');
create index table_reservations_user_idx on table_reservations(user_id, created_at desc);
create trigger table_reservations_updated_at before update on table_reservations
  for each row execute function set_updated_at();

-- Credenciales QR.
-- El contenido del QR es "GETIN1.<subject>.<nonce>.<hmac>", donde el HMAC se calcula
-- con QR_TOKEN_SECRET (solo en el servidor de la app). La base guarda el nonce y el
-- hash del payload: quien lea esta tabla no puede fabricar un QR valido sin el secreto,
-- y la app puede volver a dibujar el QR del usuario cuando lo necesite.
create table qr_credentials (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid references tickets(id) on delete cascade,
  reservation_id  uuid references table_reservations(id) on delete cascade,
  guest_entry_id  uuid references guest_list_entries(id) on delete cascade,
  nonce           text not null,             -- 128 bits aleatorios, base64url
  token_hash      text not null unique,      -- sha256(payload completo) en hex
  token_prefix    char(8) not null,          -- para soporte/busqueda, no autentica
  event_id        uuid not null references events(id) on delete cascade,
  valid_from      timestamptz,
  valid_until     timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now(),
  constraint qr_single_target check (
    (ticket_id is not null)::int + (reservation_id is not null)::int
      + (guest_entry_id is not null)::int = 1
  )
);
create index qr_event_idx on qr_credentials(event_id);
create index qr_prefix_idx on qr_credentials(token_prefix);

create table checkins (
  id              uuid primary key default gen_random_uuid(),
  qr_credential_id uuid references qr_credentials(id) on delete set null,
  ticket_id       uuid references tickets(id) on delete set null,
  reservation_id  uuid references table_reservations(id) on delete set null,
  guest_entry_id  uuid references guest_list_entries(id) on delete set null,
  event_id        uuid not null references events(id) on delete cascade,
  venue_id        uuid not null references venues(id) on delete cascade,
  scanned_by      uuid references profiles(id) on delete set null,
  result          checkin_result not null,
  detail          text,
  device_label    text,
  scanned_at      timestamptz not null default now()
);
create index checkins_event_idx on checkins(event_id, scanned_at desc);
create index checkins_ticket_idx on checkins(ticket_id);

-- ================================================ 9. COMISIONES Y LIQUIDACION ===
create table commissions (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references orders(id) on delete cascade unique,
  venue_id          uuid not null references venues(id) on delete restrict,
  gross_cents       bigint not null check (gross_cents >= 0),
  commission_bps    integer not null check (commission_bps between 0 and 10000),
  getin_fee_cents   bigint not null check (getin_fee_cents >= 0),
  gateway_fee_cents bigint not null check (gateway_fee_cents >= 0),
  tax_cents         bigint not null default 0 check (tax_cents >= 0),
  venue_amount_cents bigint not null check (venue_amount_cents >= 0),
  settlement_id     uuid,
  status            settlement_status not null default 'pending',
  created_at        timestamptz not null default now()
);
create index commissions_venue_status_idx on commissions(venue_id, status);

create table settlements (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references venues(id) on delete restrict,
  period_start    date not null,
  period_end      date not null,
  gross_cents     bigint not null default 0,
  getin_fee_cents bigint not null default 0,
  gateway_fee_cents bigint not null default 0,
  refunds_cents   bigint not null default 0,
  net_cents       bigint not null default 0,
  status          settlement_status not null default 'pending',
  reference       text,
  notes           text,
  paid_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint settlements_period check (period_end >= period_start)
);
create index settlements_venue_idx on settlements(venue_id, period_start desc);
create trigger settlements_updated_at before update on settlements
  for each row execute function set_updated_at();

alter table commissions
  add constraint commissions_settlement_fk
  foreign key (settlement_id) references settlements(id) on delete set null;

-- ============================================= 10. NOTIFICACIONES Y SOPORTE ===
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  channel     text not null default 'email',   -- email | push | whatsapp (fases 2-3)
  template    text not null,
  payload     jsonb not null default '{}'::jsonb,
  sent_at     timestamptz,
  read_at     timestamptz,
  error       text,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, created_at desc);
create index notifications_pending_idx on notifications(created_at) where sent_at is null;

create table support_tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete set null,
  order_id    uuid references orders(id) on delete set null,
  venue_id    uuid references venues(id) on delete set null,
  subject     text not null,
  body        text not null,
  status      support_status not null default 'open',
  assigned_to uuid references profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index support_tickets_status_idx on support_tickets(status, created_at desc);
create trigger support_tickets_updated_at before update on support_tickets
  for each row execute function set_updated_at();

-- Auditoria de operaciones sensibles (append-only desde la aplicacion).
create table audit_logs (
  id          bigserial primary key,
  actor_id    uuid references profiles(id) on delete set null,
  actor_role  app_role,
  action      text not null,                 -- 'venue.approve', 'order.refund', ...
  entity      text not null,
  entity_id   text,
  venue_id    uuid references venues(id) on delete set null,
  metadata    jsonb not null default '{}'::jsonb,
  ip          inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index audit_logs_entity_idx on audit_logs(entity, entity_id);
create index audit_logs_actor_idx on audit_logs(actor_id, created_at desc);
create index audit_logs_created_idx on audit_logs(created_at desc);

-- Control de frecuencia (rate limiting) persistente para endpoints sensibles.
create table rate_limit_counters (
  bucket      text primary key,              -- 'scan:<user>:<minuto>'
  hits        integer not null default 0,
  expires_at  timestamptz not null
);
create index rate_limit_expiry_idx on rate_limit_counters(expires_at);


-- ===========================================================================
-- 20260101000002_functions.sql
-- ===========================================================================

-- ===========================================================================
-- GETIN · 0002 · Funciones de dominio (atomicidad e idempotencia)
--
-- Todo lo que puede sobrevender, duplicar un ingreso o cobrar dos veces vive
-- aqui dentro de una sola transaccion con bloqueo de fila (FOR UPDATE).
-- La app NUNCA hace "leer disponibilidad -> decidir -> escribir" por su cuenta.
-- ===========================================================================

-- ------------------------------------------------- helpers de autorizacion ---
create or replace function getin_current_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function getin_is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'superadmin' from profiles where id = auth.uid()), false);
$$;

-- ¿El usuario actual pertenece al local, con alguno de los roles pedidos?
create or replace function getin_has_venue_access(p_venue_id uuid, p_roles venue_role[] default null)
returns boolean
language sql stable security definer set search_path = public as $$
  select getin_is_superadmin() or exists (
    select 1 from venue_staff vs
    where vs.venue_id = p_venue_id
      and vs.user_id = auth.uid()
      and vs.is_active
      and (p_roles is null or vs.role = any(p_roles))
  );
$$;

create or replace function getin_venue_of_event(p_event_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select venue_id from events where id = p_event_id;
$$;

-- ------------------------------------------------------- codigos legibles ----
-- Alfabeto sin caracteres ambiguos (sin I, O, 0, 1) para codigos dictados por telefono.
create or replace function getin_short_code(p_len int default 6) returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out_code text := '';
  i int;
begin
  for i in 1..p_len loop
    out_code := out_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return out_code;
end;
$$;

-- =========================================================================
-- 1. RETENCION DE ENTRADAS
-- =========================================================================
-- Reserva temporalmente p_qty entradas. Falla (no sobrevende) si no alcanzan.
-- Es idempotente por (order_id, ticket_type_id): repetir la llamada con la misma
-- orden actualiza la retencion existente en lugar de acumular inventario.
create or replace function getin_hold_tickets(
  p_order_id       uuid,
  p_ticket_type_id uuid,
  p_qty            integer,
  p_minutes        integer default null
) returns inventory_holds
language plpgsql volatile security definer set search_path = public as $$
declare
  v_type      ticket_types;
  v_existing  inventory_holds;
  v_hold      inventory_holds;
  v_available integer;
  v_minutes   integer;
  v_delta     integer;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'INVALID_QUANTITY' using errcode = 'check_violation';
  end if;

  select coalesce(p_minutes, hold_minutes) into v_minutes from platform_settings where id = 1;

  -- Bloqueo de la fila de inventario: serializa a todos los compradores de este tipo.
  select * into v_type from ticket_types where id = p_ticket_type_id for update;
  if not found then
    raise exception 'TICKET_TYPE_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if not v_type.is_active then
    raise exception 'TICKET_TYPE_INACTIVE' using errcode = 'check_violation';
  end if;
  if v_type.sales_start_at is not null and now() < v_type.sales_start_at then
    raise exception 'SALES_NOT_STARTED' using errcode = 'check_violation';
  end if;
  if v_type.sales_end_at is not null and now() > v_type.sales_end_at then
    raise exception 'SALES_ENDED' using errcode = 'check_violation';
  end if;
  if p_qty > v_type.max_per_order then
    raise exception 'OVER_MAX_PER_ORDER' using errcode = 'check_violation';
  end if;

  -- Primero libera lo que ya vencio de este tipo, para no bloquear ventas reales.
  perform getin_expire_holds_for_type(p_ticket_type_id);
  select * into v_type from ticket_types where id = p_ticket_type_id for update;

  select * into v_existing
  from inventory_holds
  where order_id = p_order_id and ticket_type_id = p_ticket_type_id and status = 'active';

  v_delta := p_qty - coalesce(v_existing.quantity, 0);
  v_available := v_type.capacity - v_type.sold_count - v_type.held_count;

  if v_delta > v_available then
    raise exception 'SOLD_OUT: solo quedan % entradas', greatest(v_available, 0)
      using errcode = 'check_violation';
  end if;

  update ticket_types
    set held_count = held_count + v_delta
    where id = p_ticket_type_id;

  if v_existing.id is null then
    insert into inventory_holds (order_id, ticket_type_id, quantity, expires_at)
    values (p_order_id, p_ticket_type_id, p_qty, now() + make_interval(mins => v_minutes))
    returning * into v_hold;
  else
    update inventory_holds
      set quantity = p_qty,
          expires_at = now() + make_interval(mins => v_minutes)
      where id = v_existing.id
      returning * into v_hold;
  end if;

  update orders
    set expires_at = v_hold.expires_at,
        status = case when status = 'pending' then 'pending' else status end
    where id = p_order_id;

  return v_hold;
end;
$$;

-- Libera retenciones vencidas de un tipo de entrada concreto.
create or replace function getin_expire_holds_for_type(p_ticket_type_id uuid)
returns integer
language plpgsql volatile security definer set search_path = public as $$
declare
  v_freed integer := 0;
  r record;
begin
  for r in
    select id, quantity from inventory_holds
    where ticket_type_id = p_ticket_type_id and status = 'active' and expires_at <= now()
    for update
  loop
    update inventory_holds set status = 'expired', released_at = now() where id = r.id;
    v_freed := v_freed + r.quantity;
  end loop;

  if v_freed > 0 then
    update ticket_types
      set held_count = greatest(held_count - v_freed, 0)
      where id = p_ticket_type_id;
  end if;

  return v_freed;
end;
$$;

create or replace function getin_release_hold(p_order_id uuid)
returns integer
language plpgsql volatile security definer set search_path = public as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select id, ticket_type_id, quantity from inventory_holds
    where order_id = p_order_id and status = 'active'
    for update
  loop
    update ticket_types
      set held_count = greatest(held_count - r.quantity, 0)
      where id = r.ticket_type_id;
    update inventory_holds set status = 'released', released_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;

  -- Suelta tambien las mesas retenidas por esta orden.
  update event_table_availability
    set state = 'available', held_until = null, held_by_order_id = null
    where held_by_order_id = p_order_id and state = 'held';

  return v_count;
end;
$$;

-- Barrido global: pensado para un cron (pg_cron o una ruta programada).
create or replace function getin_expire_stale_orders() returns integer
language plpgsql volatile security definer set search_path = public as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select id from orders
    where status in ('pending', 'awaiting_payment')
      and expires_at is not null and expires_at <= now()
    for update skip locked
  loop
    perform getin_release_hold(r.id);
    update orders set status = 'expired' where id = r.id;
    v_count := v_count + 1;
  end loop;

  update event_table_availability
    set state = 'available', held_until = null, held_by_order_id = null
    where state = 'held' and held_until <= now();

  return v_count;
end;
$$;

-- =========================================================================
-- 2. RETENCION DE MESAS VIP
-- =========================================================================
create or replace function getin_hold_table(
  p_order_id        uuid,
  p_availability_id uuid,
  p_minutes         integer default null
) returns event_table_availability
language plpgsql volatile security definer set search_path = public as $$
declare
  v_row     event_table_availability;
  v_minutes integer;
begin
  select coalesce(p_minutes, hold_minutes) into v_minutes from platform_settings where id = 1;

  select * into v_row from event_table_availability where id = p_availability_id for update;
  if not found then
    raise exception 'TABLE_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- Una retencion vencida de otro comprador no bloquea esta.
  if v_row.state = 'held' and v_row.held_until is not null and v_row.held_until <= now() then
    v_row.state := 'available';
  end if;

  if v_row.state = 'reserved' then
    raise exception 'TABLE_ALREADY_RESERVED' using errcode = 'check_violation';
  end if;
  if v_row.state = 'blocked' then
    raise exception 'TABLE_BLOCKED' using errcode = 'check_violation';
  end if;
  if v_row.state = 'held' and v_row.held_by_order_id is distinct from p_order_id then
    raise exception 'TABLE_HELD_BY_OTHER' using errcode = 'check_violation';
  end if;

  update event_table_availability
    set state = 'held',
        held_until = now() + make_interval(mins => v_minutes),
        held_by_order_id = p_order_id
    where id = p_availability_id
    returning * into v_row;

  update orders set expires_at = v_row.held_until where id = p_order_id;
  return v_row;
end;
$$;

-- =========================================================================
-- 3. CONFIRMACION DE ORDEN -> EMISION DE ENTRADAS Y QR
-- =========================================================================
-- Idempotente: si la orden ya esta pagada devuelve las entradas existentes y no
-- vuelve a tocar el inventario. Es el unico camino por el que nace un QR.
--
-- p_credentials: [{"nonce": "...", "token_hash": "...", "token_prefix": "..."}]
-- generado por el servidor de la app (necesita QR_TOKEN_SECRET, que la base no tiene).
create or replace function getin_confirm_order(
  p_order_id     uuid,
  p_payment_id   uuid,
  p_credentials  jsonb
) returns setof tickets
language plpgsql volatile security definer set search_path = public as $$
declare
  v_order     orders;
  v_item      record;
  v_hold      record;
  v_needed    integer := 0;
  v_cursor    integer := 0;
  v_cred      jsonb;
  v_ticket    tickets;
  v_res       table_reservations;
  v_avail     event_table_availability;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- Idempotencia frente a webhooks repetidos o reintentos del proveedor.
  if v_order.status = 'paid' then
    return query select * from tickets where order_id = p_order_id;
    return;
  end if;

  if v_order.status in ('expired', 'cancelled', 'refunded') then
    raise exception 'ORDER_NOT_PAYABLE: %', v_order.status using errcode = 'check_violation';
  end if;

  -- Cuantas entradas hay que emitir.
  select coalesce(sum(quantity), 0) into v_needed
  from order_items where order_id = p_order_id and kind = 'ticket';

  if jsonb_array_length(coalesce(p_credentials, '[]'::jsonb)) < v_needed then
    raise exception 'NOT_ENOUGH_CREDENTIALS: se necesitan %', v_needed
      using errcode = 'check_violation';
  end if;

  -- 3.1 Entradas: consume las retenciones y pasa held -> sold.
  for v_hold in
    select h.id, h.ticket_type_id, h.quantity
    from inventory_holds h
    where h.order_id = p_order_id and h.status = 'active'
    for update
  loop
    update ticket_types
      set held_count = greatest(held_count - v_hold.quantity, 0),
          sold_count = sold_count + v_hold.quantity
      where id = v_hold.ticket_type_id;
    update inventory_holds set status = 'consumed', released_at = now() where id = v_hold.id;
  end loop;

  for v_item in
    select oi.id, oi.ticket_type_id, oi.quantity
    from order_items oi
    where oi.order_id = p_order_id and oi.kind = 'ticket'
  loop
    for i in 1..v_item.quantity loop
      v_cred := p_credentials -> v_cursor;
      v_cursor := v_cursor + 1;

      insert into tickets (
        order_id, order_item_id, ticket_type_id, event_id, venue_id, user_id,
        serial, holder_name
      ) values (
        p_order_id, v_item.id, v_item.ticket_type_id, v_order.event_id, v_order.venue_id,
        v_order.user_id, 'GETIN-T-' || getin_short_code(8), v_order.buyer_name
      ) returning * into v_ticket;

      insert into qr_credentials (
        ticket_id, nonce, token_hash, token_prefix, event_id, valid_until
      ) values (
        v_ticket.id,
        v_cred ->> 'nonce',
        v_cred ->> 'token_hash',
        v_cred ->> 'token_prefix',
        v_order.event_id,
        (select coalesce(last_entry_at, ends_at, starts_at + interval '12 hours')
         from events where id = v_order.event_id)
      );
    end loop;
  end loop;

  -- 3.2 Mesas: la retencion pasa a reserva confirmada.
  for v_item in
    select oi.table_availability_id, oi.total_cents
    from order_items oi
    where oi.order_id = p_order_id and oi.kind = 'table'
  loop
    select * into v_avail
    from event_table_availability where id = v_item.table_availability_id for update;

    if v_avail.state = 'reserved' and v_avail.held_by_order_id is distinct from p_order_id then
      raise exception 'TABLE_ALREADY_RESERVED' using errcode = 'check_violation';
    end if;

    update event_table_availability
      set state = 'reserved', held_until = null
      where id = v_item.table_availability_id;

    -- Importes de la reserva, que son TRES cosas distintas:
    --   total_cents        = precio completo de la mesa,
    --   deposit_paid_cents = lo que se acaba de cobrar (el adelanto),
    --   balance_due_cents  = lo que queda por pagar en el local.
    -- Usar aqui el total del concepto (que es solo el adelanto) le diria al
    -- cliente que no debe nada, y acabaria en una discusion en la puerta.
    insert into table_reservations (
      order_id, table_availability_id, event_id, venue_id, user_id,
      status, total_cents, deposit_paid_cents, balance_due_cents, conditions_snapshot
    ) values (
      p_order_id, v_item.table_availability_id, v_order.event_id, v_order.venue_id,
      v_order.user_id, 'confirmed',
      v_avail.price_cents,
      v_item.total_cents,
      greatest(v_avail.price_cents - v_item.total_cents, 0),
      v_avail.conditions
    )
    on conflict do nothing
    returning * into v_res;

    if v_res.id is not null then
      v_cred := p_credentials -> v_cursor;
      v_cursor := v_cursor + 1;
      if v_cred is not null then
        insert into qr_credentials (reservation_id, nonce, token_hash, token_prefix, event_id)
        values (v_res.id, v_cred ->> 'nonce', v_cred ->> 'token_hash',
                v_cred ->> 'token_prefix', v_order.event_id);
      end if;
    end if;
  end loop;

  -- 3.3 Orden pagada + registro del reparto economico.
  update orders
    set status = 'paid', paid_at = now(), expires_at = null
    where id = p_order_id;

  if p_payment_id is not null then
    update payments set status = 'paid', paid_at = now() where id = p_payment_id;
  end if;

  insert into commissions (
    order_id, venue_id, gross_cents, commission_bps,
    getin_fee_cents, gateway_fee_cents, tax_cents, venue_amount_cents
  ) values (
    p_order_id, v_order.venue_id, v_order.total_cents, v_order.commission_bps,
    v_order.getin_fee_cents, v_order.gateway_fee_cents, v_order.tax_cents,
    v_order.venue_amount_cents
  ) on conflict (order_id) do nothing;

  return query select * from tickets where order_id = p_order_id;
end;
$$;

-- =========================================================================
-- 4. VALIDACION DE QR EN PUERTA
-- =========================================================================
-- Comprueba y marca como usada en una sola transaccion: dos escaneos simultaneos
-- del mismo QR no pueden autorizar dos ingresos.
-- Devuelve el resultado SIEMPRE (no lanza excepcion) y deja rastro en checkins.
create or replace function getin_scan_qr(
  p_token_hash  text,
  p_venue_id    uuid,
  p_device      text default null
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_qr      qr_credentials;
  v_ticket  tickets;
  v_event   events;
  v_res     table_reservations;
  v_entry   guest_list_entries;
  v_result  checkin_result;
  v_detail  text;
  v_holder  text;
  v_kind    text := 'ticket';
  v_label   text;
begin
  if not getin_has_venue_access(p_venue_id, array['owner','manager','door']::venue_role[]) then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;

  select * into v_qr from qr_credentials where token_hash = p_token_hash for update;

  if not found then
    insert into checkins (event_id, venue_id, scanned_by, result, detail, device_label)
    select e.id, p_venue_id, auth.uid(), 'denied_invalid', 'QR desconocido', p_device
    from events e where e.venue_id = p_venue_id order by e.starts_at desc limit 1;
    return jsonb_build_object('result', 'denied_invalid', 'detail', 'QR no reconocido');
  end if;

  select * into v_event from events where id = v_qr.event_id;

  -- El personal solo puede validar QR de su propio local.
  if v_event.venue_id <> p_venue_id then
    insert into checkins (qr_credential_id, event_id, venue_id, scanned_by, result, detail, device_label)
    values (v_qr.id, v_qr.event_id, p_venue_id, auth.uid(), 'denied_event',
            'QR de otro local', p_device);
    return jsonb_build_object('result', 'denied_event', 'detail', 'Esta entrada no es de este local');
  end if;

  if v_qr.revoked_at is not null then
    v_result := 'denied_invalid'; v_detail := 'Credencial revocada';
  elsif v_qr.valid_from is not null and now() < v_qr.valid_from then
    v_result := 'denied_window'; v_detail := 'Aun no habilitada';
  elsif v_qr.valid_until is not null and now() > v_qr.valid_until then
    v_result := 'denied_window'; v_detail := 'Fuera del horario de ingreso';
  elsif v_event.status = 'cancelled' then
    v_result := 'denied_event'; v_detail := 'Evento cancelado';
  end if;

  if v_result is null then
    if v_qr.ticket_id is not null then
      select * into v_ticket from tickets where id = v_qr.ticket_id for update;
      v_label := v_ticket.serial; v_holder := v_ticket.holder_name;
      if v_ticket.status = 'used' then
        v_result := 'denied_used';
        v_detail := 'Ya utilizada ' || to_char(v_ticket.used_at at time zone 'America/Lima', 'HH24:MI');
      elsif v_ticket.status in ('cancelled', 'refunded') then
        v_result := 'denied_invalid'; v_detail := 'Entrada anulada o reembolsada';
      elsif not exists (select 1 from orders o where o.id = v_ticket.order_id and o.status = 'paid') then
        v_result := 'denied_unpaid'; v_detail := 'Pago no confirmado';
      else
        update tickets set status = 'used', used_at = now() where id = v_ticket.id;
        v_result := 'granted'; v_detail := 'Ingreso autorizado';
      end if;

    elsif v_qr.reservation_id is not null then
      v_kind := 'table';
      select * into v_res from table_reservations where id = v_qr.reservation_id for update;
      v_label := 'Mesa';
      if v_res.used_at is not null then
        v_result := 'denied_used'; v_detail := 'Reserva ya registrada';
      elsif v_res.status <> 'confirmed' then
        v_result := 'review'; v_detail := 'Reserva en estado ' || v_res.status;
      else
        update table_reservations set used_at = now(), status = 'completed' where id = v_res.id;
        v_result := 'granted'; v_detail := 'Mesa confirmada';
      end if;

    else
      v_kind := 'guest_list';
      select * into v_entry from guest_list_entries where id = v_qr.guest_entry_id for update;
      v_label := v_entry.guest_name; v_holder := v_entry.guest_name;
      if v_entry.status = 'used' then
        v_result := 'denied_used'; v_detail := 'Ya ingreso';
      elsif v_entry.status <> 'confirmed' then
        v_result := 'review'; v_detail := 'Lista en estado ' || v_entry.status;
      else
        update guest_list_entries set status = 'used' where id = v_entry.id;
        v_result := 'granted'; v_detail := 'Ingreso por lista';
      end if;
    end if;
  end if;

  insert into checkins (
    qr_credential_id, ticket_id, reservation_id, guest_entry_id,
    event_id, venue_id, scanned_by, result, detail, device_label
  ) values (
    v_qr.id, v_qr.ticket_id, v_qr.reservation_id, v_qr.guest_entry_id,
    v_qr.event_id, p_venue_id, auth.uid(), v_result, v_detail, p_device
  );

  return jsonb_build_object(
    'result', v_result,
    'detail', v_detail,
    'kind', v_kind,
    'label', v_label,
    'holder', v_holder,
    'event', v_event.name,
    'scanned_at', now()
  );
end;
$$;

-- =========================================================================
-- 5. LISTAS DE INVITADOS
-- =========================================================================
create or replace function getin_join_guest_list(
  p_guest_list_id uuid,
  p_guest_name    text,
  p_companions    integer default 0
) returns guest_list_entries
language plpgsql volatile security definer set search_path = public as $$
declare
  v_list      guest_lists;
  v_entry     guest_list_entries;
  v_existing  guest_list_entries;
  v_seats     integer;
  v_old_seats integer;
  v_status    guest_entry_status;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'insufficient_privilege';
  end if;

  select * into v_list from guest_lists where id = p_guest_list_id for update;
  if not found or not v_list.is_active then
    raise exception 'LIST_UNAVAILABLE' using errcode = 'no_data_found';
  end if;
  if v_list.signup_deadline is not null and now() > v_list.signup_deadline then
    raise exception 'LIST_CLOSED' using errcode = 'check_violation';
  end if;

  v_seats := 1 + greatest(coalesce(p_companions, 0), 0);

  select * into v_existing
  from guest_list_entries
  where guest_list_id = p_guest_list_id and user_id = auth.uid()
  for update;

  -- Caso 1: ya estaba confirmado y vuelve a enviar el formulario.
  -- Se ajusta el cupo por la DIFERENCIA de acompañantes, nunca se suma de nuevo:
  -- de lo contrario reinscribirse inflaria confirmed_count hasta cerrar la lista.
  if v_existing.id is not null and v_existing.status = 'confirmed' then
    v_old_seats := 1 + v_existing.companions;

    if v_list.confirmed_count - v_old_seats + v_seats > v_list.capacity then
      raise exception 'LIST_FULL' using errcode = 'check_violation';
    end if;

    update guest_lists
      set confirmed_count = confirmed_count - v_old_seats + v_seats
      where id = p_guest_list_id;

    update guest_list_entries
      set guest_name = p_guest_name,
          companions = coalesce(p_companions, 0)
      where id = v_existing.id
      returning * into v_entry;

    return v_entry;
  end if;

  -- Caso 2: alta nueva, o reenvio de una solicitud pendiente/rechazada.
  v_status := case
    when v_list.auto_approve and v_list.confirmed_count + v_seats <= v_list.capacity
    then 'confirmed'::guest_entry_status
    else 'pending'::guest_entry_status
  end;

  if v_existing.id is not null then
    update guest_list_entries
      set guest_name = p_guest_name,
          companions = coalesce(p_companions, 0),
          status = v_status,
          decided_at = case when v_status = 'confirmed' then now() else null end
      where id = v_existing.id
      returning * into v_entry;
  else
    insert into guest_list_entries (
      guest_list_id, user_id, guest_name, companions, status, decided_at
    ) values (
      p_guest_list_id, auth.uid(), p_guest_name, coalesce(p_companions, 0), v_status,
      case when v_status = 'confirmed' then now() else null end
    )
    returning * into v_entry;
  end if;

  if v_entry.status = 'confirmed' then
    update guest_lists set confirmed_count = confirmed_count + v_seats
      where id = p_guest_list_id;
  end if;

  return v_entry;
end;
$$;

-- Decision manual del local sobre una solicitud de lista.
create or replace function getin_decide_guest_entry(
  p_entry_id uuid,
  p_approve  boolean,
  p_note     text default null
) returns guest_list_entries
language plpgsql volatile security definer set search_path = public as $$
declare
  v_entry guest_list_entries;
  v_list  guest_lists;
  v_seats integer;
begin
  select * into v_entry from guest_list_entries where id = p_entry_id for update;
  if not found then
    raise exception 'ENTRY_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  select * into v_list from guest_lists where id = v_entry.guest_list_id for update;

  if not getin_has_venue_access(getin_venue_of_event(v_list.event_id),
                                array['owner','manager']::venue_role[]) then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;

  v_seats := 1 + v_entry.companions;

  if p_approve then
    if v_list.confirmed_count + v_seats > v_list.capacity then
      raise exception 'LIST_FULL' using errcode = 'check_violation';
    end if;
    update guest_lists set confirmed_count = confirmed_count + v_seats where id = v_list.id;
    update guest_list_entries
      set status = 'confirmed', decided_by = auth.uid(), decided_at = now(), note = p_note
      where id = p_entry_id returning * into v_entry;
  else
    if v_entry.status = 'confirmed' then
      update guest_lists set confirmed_count = greatest(confirmed_count - v_seats, 0)
        where id = v_list.id;
    end if;
    update guest_list_entries
      set status = 'rejected', decided_by = auth.uid(), decided_at = now(), note = p_note
      where id = p_entry_id returning * into v_entry;
  end if;

  return v_entry;
end;
$$;

-- =========================================================================
-- 6. ALTA AUTOMATICA DE PERFIL AL REGISTRARSE
-- =========================================================================
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =========================================================================
-- 7. CONTROL DE FRECUENCIA (rate limiting) PARA ENDPOINTS SENSIBLES
-- =========================================================================
create or replace function getin_rate_limit(
  p_bucket text,
  p_limit  integer,
  p_window_seconds integer
) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  v_hits integer;
begin
  delete from rate_limit_counters where expires_at < now();

  insert into rate_limit_counters (bucket, hits, expires_at)
  values (p_bucket, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (bucket) do update
    set hits = rate_limit_counters.hits + 1
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

-- -------------------------------------------------------------- permisos ----
revoke all on function getin_confirm_order(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function getin_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function getin_expire_stale_orders() from public, anon;

grant execute on function getin_hold_tickets(uuid, uuid, integer, integer) to authenticated;
grant execute on function getin_hold_table(uuid, uuid, integer) to authenticated;
grant execute on function getin_release_hold(uuid) to authenticated;
grant execute on function getin_scan_qr(text, uuid, text) to authenticated;
grant execute on function getin_join_guest_list(uuid, text, integer) to authenticated;
grant execute on function getin_decide_guest_entry(uuid, boolean, text) to authenticated;


-- ===========================================================================
-- 20260101000003_rls.sql
-- ===========================================================================

-- ===========================================================================
-- GETIN · 0003 · Row Level Security
--
-- Regla general: todo denegado por defecto. Lo publico (catalogo) se abre a
-- 'anon'; lo privado se limita al dueño del dato o al personal del local.
-- Lo que mueve dinero o emite QR no tiene politica de escritura: solo entra
-- por las funciones security definer de 0002 o por la service role del servidor.
--
-- IMPORTANTE: estas politicas son la segunda barrera. La app vuelve a validar
-- permisos en el servidor (src/lib/auth/guards.ts); ocultar un boton no es
-- un control de acceso.
-- ===========================================================================

alter table profiles                  enable row level security;
alter table venues                    enable row level security;
alter table venue_staff               enable row level security;
alter table venue_verifications       enable row level security;
alter table events                    enable row level security;
alter table event_images              enable row level security;
alter table ticket_types              enable row level security;
alter table venue_tables              enable row level security;
alter table event_table_availability  enable row level security;
alter table guest_lists               enable row level security;
alter table guest_list_entries        enable row level security;
alter table platform_settings         enable row level security;
alter table orders                    enable row level security;
alter table order_items               enable row level security;
alter table inventory_holds           enable row level security;
alter table payments                  enable row level security;
alter table payment_webhook_events    enable row level security;
alter table refunds                   enable row level security;
alter table tickets                   enable row level security;
alter table table_reservations        enable row level security;
alter table qr_credentials            enable row level security;
alter table checkins                  enable row level security;
alter table commissions               enable row level security;
alter table settlements               enable row level security;
alter table notifications             enable row level security;
alter table support_tickets           enable row level security;
alter table audit_logs                enable row level security;
alter table rate_limit_counters       enable row level security;

-- ------------------------------------------------------------- profiles ----
create policy profiles_select_own on profiles
  for select using (id = auth.uid() or getin_is_superadmin());

create policy profiles_update_own on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- El rol global y la suspension solo los cambia el superadmin (o el servidor).
create or replace function guard_profile_privileges() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then          -- service role / triggers internos
    return new;
  end if;
  if not getin_is_superadmin() then
    if new.role is distinct from old.role then
      raise exception 'FORBIDDEN: no puedes cambiar tu rol' using errcode = 'insufficient_privilege';
    end if;
    if new.is_suspended is distinct from old.is_suspended then
      raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_guard before update on profiles
  for each row execute function guard_profile_privileges();

create policy profiles_admin_all on profiles
  for all using (getin_is_superadmin()) with check (getin_is_superadmin());

-- --------------------------------------------------------------- venues ----
-- El catalogo publico solo muestra locales aprobados.
create policy venues_public_read on venues
  for select using (status = 'approved' or getin_has_venue_access(id) or getin_is_superadmin());

create policy venues_staff_update on venues
  for update using (getin_has_venue_access(id, array['owner','manager']::venue_role[]))
  with check (getin_has_venue_access(id, array['owner','manager']::venue_role[]));

create policy venues_owner_insert on venues
  for insert with check (owner_id = auth.uid() or getin_is_superadmin());

create policy venues_admin_all on venues
  for all using (getin_is_superadmin()) with check (getin_is_superadmin());

-- La aprobacion, la verificacion y la comision no las toca el local.
create or replace function guard_venue_privileges() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or getin_is_superadmin() then
    return new;
  end if;
  if new.status is distinct from old.status
     or new.is_verified is distinct from old.is_verified
     or new.commission_bps is distinct from old.commission_bps
     or new.published_at is distinct from old.published_at then
    raise exception 'FORBIDDEN: la publicacion y la comision las aprueba GETIN'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
create trigger venues_guard before update on venues
  for each row execute function guard_venue_privileges();

-- Un local recien creado nunca nace publicado.
create or replace function guard_venue_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not getin_is_superadmin() then
    new.status := 'draft';
    new.is_verified := false;
    new.commission_bps := null;
    new.published_at := null;
  end if;
  return new;
end;
$$;
create trigger venues_guard_insert before insert on venues
  for each row execute function guard_venue_insert();

-- ---------------------------------------------------------- venue_staff ----
create policy venue_staff_read on venue_staff
  for select using (user_id = auth.uid() or getin_has_venue_access(venue_id));

create policy venue_staff_manage on venue_staff
  for all using (getin_has_venue_access(venue_id, array['owner','manager']::venue_role[]))
  with check (getin_has_venue_access(venue_id, array['owner','manager']::venue_role[]));

-- -------------------------------------------------- venue_verifications ----
create policy venue_verifications_read on venue_verifications
  for select using (getin_has_venue_access(venue_id) or getin_is_superadmin());

create policy venue_verifications_submit on venue_verifications
  for insert with check (getin_has_venue_access(venue_id, array['owner']::venue_role[]));

create policy venue_verifications_review on venue_verifications
  for update using (getin_is_superadmin()) with check (getin_is_superadmin());

-- --------------------------------------------------------------- events ----
create policy events_public_read on events
  for select using (
    (status = 'published' and exists (
      select 1 from venues v where v.id = events.venue_id and v.status = 'approved'))
    or getin_has_venue_access(venue_id)
    or getin_is_superadmin()
  );

create policy events_staff_write on events
  for all using (getin_has_venue_access(venue_id, array['owner','manager']::venue_role[]))
  with check (getin_has_venue_access(venue_id, array['owner','manager']::venue_role[]));

create policy event_images_read on event_images
  for select using (exists (select 1 from events e where e.id = event_id));

create policy event_images_write on event_images
  for all using (getin_has_venue_access(getin_venue_of_event(event_id),
                                        array['owner','manager']::venue_role[]))
  with check (getin_has_venue_access(getin_venue_of_event(event_id),
                                     array['owner','manager']::venue_role[]));

-- ---------------------------------------------------------- ticket_types ---
create policy ticket_types_public_read on ticket_types
  for select using (
    exists (select 1 from events e where e.id = event_id)   -- hereda el filtro de events
  );

create policy ticket_types_staff_write on ticket_types
  for all using (getin_has_venue_access(getin_venue_of_event(event_id),
                                        array['owner','manager']::venue_role[]))
  with check (getin_has_venue_access(getin_venue_of_event(event_id),
                                     array['owner','manager']::venue_role[]));

-- El inventario vendido/retenido solo lo mueven las funciones de 0002.
create or replace function guard_ticket_counters() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.sold_count is distinct from old.sold_count
     or new.held_count is distinct from old.held_count then
    raise exception 'FORBIDDEN: el inventario se mueve solo por las funciones de reserva'
      using errcode = 'insufficient_privilege';
  end if;
  if new.capacity < old.sold_count + old.held_count then
    raise exception 'CAPACITY_BELOW_SOLD: ya hay % entradas comprometidas',
      old.sold_count + old.held_count using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger ticket_types_guard before update on ticket_types
  for each row execute function guard_ticket_counters();

-- ------------------------------------------------------- mesas y listas ----
create policy venue_tables_read on venue_tables
  for select using (exists (select 1 from venues v where v.id = venue_id));

create policy venue_tables_write on venue_tables
  for all using (getin_has_venue_access(venue_id, array['owner','manager']::venue_role[]))
  with check (getin_has_venue_access(venue_id, array['owner','manager']::venue_role[]));

create policy etb_read on event_table_availability
  for select using (exists (select 1 from events e where e.id = event_id));

create policy etb_staff_write on event_table_availability
  for all using (getin_has_venue_access(getin_venue_of_event(event_id),
                                        array['owner','manager']::venue_role[]))
  with check (getin_has_venue_access(getin_venue_of_event(event_id),
                                     array['owner','manager']::venue_role[]));

create policy guest_lists_read on guest_lists
  for select using (exists (select 1 from events e where e.id = event_id));

create policy guest_lists_write on guest_lists
  for all using (getin_has_venue_access(getin_venue_of_event(event_id),
                                        array['owner','manager']::venue_role[]))
  with check (getin_has_venue_access(getin_venue_of_event(event_id),
                                     array['owner','manager']::venue_role[]));

create policy gle_read on guest_list_entries
  for select using (
    user_id = auth.uid()
    or getin_has_venue_access(
         (select getin_venue_of_event(gl.event_id) from guest_lists gl where gl.id = guest_list_id))
  );
-- La inscripcion pasa por getin_join_guest_list (controla aforo y cierre).

-- ------------------------------------------------- platform_settings ------
create policy platform_settings_read on platform_settings for select using (true);
create policy platform_settings_write on platform_settings
  for update using (getin_is_superadmin()) with check (getin_is_superadmin());

-- --------------------------------------------------------------- orders ----
create policy orders_read_own on orders
  for select using (
    user_id = auth.uid() or getin_has_venue_access(venue_id) or getin_is_superadmin()
  );

-- OJO: no hay politica de INSERT sobre orders ni order_items.
-- Una orden la crea siempre el servidor (server action -> service role) despues
-- de recalcular los precios desde ticket_types. Si el navegador pudiera
-- insertar la orden, podria inventarse el importe a pagar.

-- El cliente solo puede cancelar su orden mientras no este pagada.
create policy orders_cancel_own on orders
  for update using (user_id = auth.uid() and status in ('pending', 'awaiting_payment'))
  with check (user_id = auth.uid());

create or replace function guard_order_money() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then          -- service role: webhooks y confirmaciones
    return new;
  end if;
  -- Nadie desde el navegador puede tocar importes ni marcar una orden como pagada.
  if new.total_cents is distinct from old.total_cents
     or new.subtotal_cents is distinct from old.subtotal_cents
     or new.service_fee_cents is distinct from old.service_fee_cents
     or new.tax_cents is distinct from old.tax_cents
     or new.getin_fee_cents is distinct from old.getin_fee_cents
     or new.venue_amount_cents is distinct from old.venue_amount_cents
     or new.commission_bps is distinct from old.commission_bps then
    raise exception 'FORBIDDEN: los importes no se modifican desde el cliente'
      using errcode = 'insufficient_privilege';
  end if;
  if new.status = 'paid' and old.status <> 'paid' then
    raise exception 'FORBIDDEN: una orden solo se paga por confirmacion del proveedor'
      using errcode = 'insufficient_privilege';
  end if;
  if old.status = 'paid' and new.status is distinct from old.status
     and not getin_is_superadmin() then
    raise exception 'FORBIDDEN: una orden pagada no se altera'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
create trigger orders_guard before update on orders
  for each row execute function guard_order_money();

create policy order_items_read on order_items
  for select using (exists (select 1 from orders o where o.id = order_id));

create policy order_items_insert on order_items
  for insert with check (
    exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()
            and o.status in ('pending', 'awaiting_payment'))
  );

create policy inventory_holds_read on inventory_holds
  for select using (exists (select 1 from orders o where o.id = order_id));

-- -------------------------------------------- pagos (solo lectura propia) ---
-- Sin politica de insert/update: ningun cliente escribe pagos.
create policy payments_read_own on payments
  for select using (
    exists (select 1 from orders o where o.id = order_id
            and (o.user_id = auth.uid() or getin_has_venue_access(o.venue_id)))
    or getin_is_superadmin()
  );

-- Los webhooks solo son visibles para GETIN.
create policy pwe_admin_read on payment_webhook_events
  for select using (getin_is_superadmin());

create policy refunds_read on refunds
  for select using (
    exists (select 1 from orders o where o.id = order_id
            and (o.user_id = auth.uid() or getin_has_venue_access(o.venue_id)))
    or getin_is_superadmin()
  );

create policy refunds_request_own on refunds
  for insert with check (
    requested_by = auth.uid()
    and exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()
                and o.status = 'paid')
  );

create policy refunds_decide on refunds
  for update using (getin_is_superadmin()) with check (getin_is_superadmin());

-- ------------------------------------------------------- entradas y QR -----
create policy tickets_read_own on tickets
  for select using (
    user_id = auth.uid() or getin_has_venue_access(venue_id) or getin_is_superadmin()
  );
-- Sin insert/update: las entradas nacen en getin_confirm_order y se marcan
-- usadas en getin_scan_qr.

create policy reservations_read_own on table_reservations
  for select using (
    user_id = auth.uid() or getin_has_venue_access(venue_id) or getin_is_superadmin()
  );

-- El nonce del QR lo ve unicamente su dueño. El personal de puerta NO lee esta
-- tabla: valida llamando a getin_scan_qr, que no expone el nonce.
create policy qr_read_own on qr_credentials
  for select using (
    exists (select 1 from tickets t where t.id = ticket_id and t.user_id = auth.uid())
    or exists (select 1 from table_reservations r where r.id = reservation_id and r.user_id = auth.uid())
    or exists (select 1 from guest_list_entries g where g.id = guest_entry_id and g.user_id = auth.uid())
  );

create policy checkins_read_venue on checkins
  for select using (getin_has_venue_access(venue_id) or getin_is_superadmin());

-- ------------------------------------------- comisiones y liquidaciones ----
create policy commissions_read on commissions
  for select using (getin_has_venue_access(venue_id) or getin_is_superadmin());

create policy settlements_read on settlements
  for select using (getin_has_venue_access(venue_id) or getin_is_superadmin());

create policy settlements_admin on settlements
  for all using (getin_is_superadmin()) with check (getin_is_superadmin());

-- ------------------------------------------- notificaciones y soporte ------
create policy notifications_read_own on notifications
  for select using (user_id = auth.uid() or getin_is_superadmin());

create policy notifications_mark_read on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy support_read on support_tickets
  for select using (
    user_id = auth.uid() or getin_has_venue_access(venue_id) or getin_is_superadmin()
  );

create policy support_create on support_tickets
  for insert with check (user_id = auth.uid());

create policy support_admin on support_tickets
  for update using (getin_is_superadmin()) with check (getin_is_superadmin());

-- ------------------------------------------------------------- auditoria ---
-- Solo lectura y solo para GETIN. La escritura entra por la service role.
create policy audit_read_admin on audit_logs
  for select using (getin_is_superadmin());

-- rate_limit_counters: sin politicas. Unicamente la funcion getin_rate_limit.


-- ===========================================================================
-- 20260101000004_storage.sql
-- ===========================================================================

-- ===========================================================================
-- GETIN · 0004 · Storage (imagenes de eventos y documentos de verificacion)
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('event-images', 'event-images', true, 5242880,
   array['image/jpeg','image/png','image/webp','image/avif']),
  ('venue-images', 'venue-images', true, 5242880,
   array['image/jpeg','image/png','image/webp','image/avif']),
  -- Documentos comerciales: bucket PRIVADO. Se sirven por URL firmada.
  ('venue-documents', 'venue-documents', false, 10485760,
   array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

-- Lectura publica de las imagenes del catalogo.
create policy "event images publicas" on storage.objects
  for select using (bucket_id in ('event-images', 'venue-images'));

-- Cada local sube solo dentro de su carpeta: <venue_id>/<archivo>.
-- El primer segmento de la ruta debe ser un venue al que pertenece el usuario.
create policy "event images escritura del local" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('event-images', 'venue-images')
    and getin_has_venue_access(
          nullif((storage.foldername(name))[1], '')::uuid,
          array['owner','manager']::venue_role[])
  );

create policy "event images borrado del local" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('event-images', 'venue-images')
    and getin_has_venue_access(
          nullif((storage.foldername(name))[1], '')::uuid,
          array['owner','manager']::venue_role[])
  );

-- Documentos de verificacion: los sube el dueño, los lee GETIN.
create policy "documentos del local" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'venue-documents'
    and getin_has_venue_access(
          nullif((storage.foldername(name))[1], '')::uuid,
          array['owner']::venue_role[])
  );

create policy "documentos lectura" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'venue-documents'
    and (
      getin_is_superadmin()
      or getin_has_venue_access(
           nullif((storage.foldername(name))[1], '')::uuid,
           array['owner']::venue_role[])
    )
  );


-- ===========================================================================
-- 20260101000005_grants.sql
-- ===========================================================================

-- ===========================================================================
-- GETIN · 0005 · Permisos de ejecucion de las funciones
--
-- Postgres concede EXECUTE a PUBLIC en toda funcion nueva. Combinado con
-- PostgREST, eso significa que CUALQUIER funcion del esquema `public` queda
-- expuesta en /rest/v1/rpc/<nombre>. El linter de Supabase lo detecto y tenia
-- razon: la migracion 0002 concedia explicitamente a `authenticated` tres
-- funciones de inventario que NO comprueban de quien es la orden.
--
-- El agujero concreto: `getin_release_hold(p_order_id)` libera la retencion de
-- la orden que se le pase, sin mirar si quien llama es su dueño. Un usuario con
-- sesion podia soltar las entradas que otro tenia retenidas, o usar
-- `getin_hold_tickets` contra una orden ajena para agotar inventario.
--
-- La app nunca las necesito desde el navegador: `src/lib/orders/service.ts` las
-- llama con la service role. Asi que se cierran.
--
-- OJO con lo que NO se revoca: `getin_is_superadmin`, `getin_has_venue_access`
-- y `getin_venue_of_event` se invocan DENTRO de las politicas de RLS. Si se les
-- quita EXECUTE a anon/authenticated, Postgres falla al evaluar las politicas y
-- el catalogo publico deja de cargar. Se quedan accesibles a proposito: son de
-- solo lectura y no revelan nada que las politicas no dejen ver ya.
-- ===========================================================================

-- --------------------------------------------- inventario: solo el servidor ---
revoke execute on function getin_hold_tickets(uuid, uuid, integer, integer)
  from public, anon, authenticated;
revoke execute on function getin_hold_table(uuid, uuid, integer)
  from public, anon, authenticated;
revoke execute on function getin_release_hold(uuid)
  from public, anon, authenticated;
revoke execute on function getin_expire_holds_for_type(uuid)
  from public, anon, authenticated;

-- ------------------------------------- funciones de trigger: nadie las llama ---
-- Se ejecutan como triggers, no como RPC. Exponerlas en la API no aporta nada.
revoke execute on function set_updated_at() from public, anon, authenticated;
revoke execute on function handle_new_user() from public, anon, authenticated;
revoke execute on function guard_profile_privileges() from public, anon, authenticated;
revoke execute on function guard_venue_privileges() from public, anon, authenticated;
revoke execute on function guard_venue_insert() from public, anon, authenticated;
revoke execute on function guard_ticket_counters() from public, anon, authenticated;
revoke execute on function guard_order_money() from public, anon, authenticated;
revoke execute on function getin_short_code(int) from public, anon, authenticated;

-- ------------------------------- lo que si usa el navegador, solo con sesion ---
-- Estas tres comprueban la autorizacion por dentro, pero un anonimo no pinta
-- nada llamandolas.
revoke execute on function getin_scan_qr(text, uuid, text) from public, anon;
revoke execute on function getin_join_guest_list(uuid, text, integer) from public, anon;
revoke execute on function getin_decide_guest_entry(uuid, boolean, text) from public, anon;
revoke execute on function getin_current_role() from public, anon;

grant execute on function getin_scan_qr(text, uuid, text) to authenticated;
grant execute on function getin_join_guest_list(uuid, text, integer) to authenticated;
grant execute on function getin_decide_guest_entry(uuid, boolean, text) to authenticated;
grant execute on function getin_current_role() to authenticated;

-- --------------------------------------------------- search_path inmutable ---
-- Sin esto, quien pueda cambiar su search_path podria colar sus propias tablas
-- delante de las del esquema dentro de una funcion SECURITY DEFINER.
alter function set_updated_at() set search_path = public;
alter function getin_short_code(int) set search_path = public;


-- ===========================================================================
-- 20260101000006_reclamaciones.sql
-- ===========================================================================

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


-- ===========================================================================
-- 20260101000007_favoritos.sql
-- ===========================================================================

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


-- ===========================================================================
-- 20260101000008_grants_reclamaciones.sql
-- ===========================================================================

-- ===========================================================================
-- GETIN · 0008 · Cerrar lo que abrio la 0006
--
-- La migracion 0005 ya habia revocado el EXECUTE de todas las funciones de
-- trigger, porque exponerlas en /rest/v1/rpc no aporta nada. La 0006 anadio
-- una nueva, `guard_complaint_integrity`, DESPUES de esa limpieza: quedo
-- publicada. El linter de Supabase lo detecto y aqui se corrige.
--
-- Se aprovecha para quitar tambien `getin_expire_stale_orders` del alcance de
-- `authenticated`. Es un barrido de mantenimiento: lo ejecuta el servidor con
-- la clave de servicio, no el navegador. Que cualquier usuario con sesion
-- pudiera dispararlo no rompe nada (solo libera ordenes ya caducadas) pero no
-- hay razon para dejarlo al alcance de nadie.
-- ===========================================================================

revoke execute on function guard_complaint_integrity()
  from public, anon, authenticated;

revoke execute on function getin_expire_stale_orders()
  from public, anon, authenticated;
