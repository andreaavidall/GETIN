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
