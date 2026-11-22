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
