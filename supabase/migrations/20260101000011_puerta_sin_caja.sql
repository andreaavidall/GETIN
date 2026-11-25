-- ===========================================================================
-- GETIN · 0011 · La puerta no ve la caja
--
-- Hallazgo de auditoria: con la cuenta de puerta se podian leer ventas,
-- ingresos, comisiones e inventario del local. La causa estaba en la RLS, no
-- en la interfaz: `getin_has_venue_access(venue_id)` sin roles devuelve cierto
-- para CUALQUIER miembro del local, puerta incluida. Esconder el panel no
-- habria servido de nada: las tablas seguian abiertas por la API.
--
-- Quien trabaja en la puerta necesita comprobar una entrada y un nombre. No
-- necesita saber cuanto facturo el local anoche, y la diferencia importa: esa
-- cuenta suele estar en un telefono compartido.
--
-- Lo que SIGUE viendo la puerta: tickets, reservas de mesa, listas de
-- invitados y sus propios escaneos. Lo que deja de ver: ordenes, importes,
-- pagos, reembolsos, comisiones y liquidaciones.
-- ===========================================================================

create or replace function getin_venue_manager(p_venue_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select getin_has_venue_access(p_venue_id, array['owner','manager']::venue_role[]);
$$;

-- OJO: NO se le quita el EXECUTE a `authenticated`.
--
-- Una funcion usada DENTRO de una politica de RLS se evalua con los permisos
-- de quien hace la consulta, no de quien la escribio. Si se revoca, la
-- politica falla y la tabla deja de leerse para todo el mundo, incluido su
-- dueño. Es el mismo error que ya se corrigio en la 0005 con
-- `getin_is_superadmin`. Al anonimo si se le quita: no evalua estas
-- politicas.
revoke execute on function getin_venue_manager(uuid) from anon;

-- ------------------------------------------------------------- ordenes ----
drop policy if exists orders_read_own on orders;
create policy orders_read_own on orders
  for select using (
    user_id = auth.uid() or getin_venue_manager(venue_id) or getin_is_superadmin()
  );

-- `order_items` e `inventory_holds` heredan la visibilidad de la orden a
-- traves de su EXISTS, asi que no hay que tocarlos.

-- --------------------------------------------------------------- pagos ----
drop policy if exists payments_read_own on payments;
create policy payments_read_own on payments
  for select using (
    exists (select 1 from orders o where o.id = order_id
            and (o.user_id = auth.uid() or getin_venue_manager(o.venue_id)))
    or getin_is_superadmin()
  );

drop policy if exists refunds_read on refunds;
create policy refunds_read on refunds
  for select using (
    exists (select 1 from orders o where o.id = order_id
            and (o.user_id = auth.uid() or getin_venue_manager(o.venue_id)))
    or getin_is_superadmin()
  );

-- --------------------------------------- comisiones y liquidaciones -------
drop policy if exists commissions_read on commissions;
create policy commissions_read on commissions
  for select using (getin_venue_manager(venue_id) or getin_is_superadmin());

drop policy if exists settlements_read on settlements;
create policy settlements_read on settlements
  for select using (getin_venue_manager(venue_id) or getin_is_superadmin());

-- ------------------------------------------------- verificacion del local --
-- Los documentos comerciales del local (RUC, licencias) tampoco son cosa de
-- la puerta.
drop policy if exists venue_verifications_read on venue_verifications;
create policy venue_verifications_read on venue_verifications
  for select using (getin_venue_manager(venue_id) or getin_is_superadmin());
