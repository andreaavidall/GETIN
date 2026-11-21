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
