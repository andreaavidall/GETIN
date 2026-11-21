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
