#!/usr/bin/env bash
# ===========================================================================
# GETIN · prueba de concurrencia real del inventario
#
# Comprueba la garantia central de la plataforma: con UNA sola entrada
# disponible y dos compradores pidiendola a la vez, solo uno puede llevarsela.
#
# Lo que deberia ocurrir:
#   1. La sesion A toma la entrada y mantiene la transaccion abierta.
#   2. La sesion B queda BLOQUEADA en el SELECT ... FOR UPDATE de
#      getin_hold_tickets (no lee un valor viejo: espera).
#   3. Al confirmar A, la sesion B relee el inventario y falla con SOLD_OUT.
#
# Requisitos: Docker + `supabase start` corriendo.
# Uso:  bash supabase/tests/concurrencia.sh
# ===========================================================================
set -euo pipefail

DB=${GETIN_DB_CONTAINER:-supabase_db_getin}
# `-i` es imprescindible: sin el, docker exec no reenvia stdin y el bloque SQL
# de preparacion se pierde en silencio.
PSQL="docker exec -i $DB psql -U postgres -At"

if ! docker ps --format '{{.Names}}' | grep -q "^${DB}$"; then
  echo "No encuentro el contenedor '$DB'. Arranca Supabase con: npx supabase start" >&2
  exit 1
fi

echo "Preparando escenario: un tipo de entrada con aforo 1 y dos compradores..."

$PSQL -q <<'SQL'
-- Limpieza de una ejecucion anterior.
delete from inventory_holds where order_id in (
  select id from orders where code in ('CONC-A','CONC-B'));
delete from order_items where order_id in (
  select id from orders where code in ('CONC-A','CONC-B'));
delete from orders where code in ('CONC-A','CONC-B');
delete from ticket_types where id = 'cccc0000-0000-4000-8000-00000000cc01';
delete from events  where id = 'bbbb0000-0000-4000-8000-00000000cc01';
delete from venues  where id = 'aaaa0000-0000-4000-8000-00000000cc01';
delete from auth.users where email in ('conc1@test.pe','conc2@test.pe');

insert into auth.users (id, email) values
  ('88888888-8888-4888-8888-888888888881','conc1@test.pe'),
  ('88888888-8888-4888-8888-888888888882','conc2@test.pe');

-- En borrador a proposito: aunque quedaran restos, no asoman al catalogo
-- publico. getin_hold_tickets no mira el estado del evento, solo el inventario.
insert into venues (id, slug, name, district, address, status)
values ('aaaa0000-0000-4000-8000-00000000cc01','concurrencia-test','Concurrencia',
        'Barranco','Calle de prueba 1','draft');

insert into events (id, venue_id, slug, name, starts_at, status)
values ('bbbb0000-0000-4000-8000-00000000cc01','aaaa0000-0000-4000-8000-00000000cc01',
        'concurrencia-test','Evento de concurrencia', now() + interval '3 days','draft');

-- Una sola plaza: es el punto de la prueba.
insert into ticket_types (id, event_id, name, price_cents, capacity)
values ('cccc0000-0000-4000-8000-00000000cc01','bbbb0000-0000-4000-8000-00000000cc01',
        'Unica', 5000, 1);

insert into orders (id, code, user_id, event_id, venue_id, subtotal_cents,
                    service_fee_cents, tax_cents, total_cents, commission_bps,
                    getin_fee_cents, venue_amount_cents, buyer_email) values
  ('dddd0000-0000-4000-8000-00000000cc01','CONC-A','88888888-8888-4888-8888-888888888881',
   'bbbb0000-0000-4000-8000-00000000cc01','aaaa0000-0000-4000-8000-00000000cc01',
   5000,350,763,5350,700,350,5000,'conc1@test.pe'),
  ('dddd0000-0000-4000-8000-00000000cc02','CONC-B','88888888-8888-4888-8888-888888888882',
   'bbbb0000-0000-4000-8000-00000000cc01','aaaa0000-0000-4000-8000-00000000cc01',
   5000,350,763,5350,700,350,5000,'conc2@test.pe');
SQL

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Sesion B: espera medio segundo para entrar despues de A, y pide la misma entrada.
$PSQL -c "
  select pg_sleep(0.5);
  begin;
  select getin_hold_tickets('dddd0000-0000-4000-8000-00000000cc02',
                            'cccc0000-0000-4000-8000-00000000cc01', 1, 15);
  commit;
" > "$TMP/b.txt" 2>&1 &
B_PID=$!

# Sesion A: toma la entrada y retiene el bloqueo tres segundos.
$PSQL -c "
  begin;
  select getin_hold_tickets('dddd0000-0000-4000-8000-00000000cc01',
                            'cccc0000-0000-4000-8000-00000000cc01', 1, 15);
  select pg_sleep(3);
  commit;
" > "$TMP/a.txt" 2>&1

wait $B_PID || true

echo
fallos=0

if grep -q "ERROR" "$TMP/a.txt"; then
  echo "FALLO · la sesion A no pudo retener la entrada:"
  grep "ERROR" "$TMP/a.txt"
  fallos=$((fallos + 1))
else
  echo "OK · la sesion A retuvo la unica entrada"
fi

if grep -q "SOLD_OUT" "$TMP/b.txt"; then
  echo "OK · la sesion B fue rechazada con SOLD_OUT (sin sobreventa)"
else
  echo "FALLO · la sesion B no recibio SOLD_OUT:"
  cat "$TMP/b.txt"
  fallos=$((fallos + 1))
fi

estado=$($PSQL -c "select held_count || '/' || capacity from ticket_types
                   where id = 'cccc0000-0000-4000-8000-00000000cc01';")
echo "Inventario final (retenidas/aforo): $estado"
if [ "$estado" != "1/1" ]; then
  echo "FALLO · el inventario deberia quedar en 1/1"
  fallos=$((fallos + 1))
fi

# No dejar rastro en la base.
$PSQL -q <<'SQL'
delete from inventory_holds where order_id in (
  select id from orders where code in ('CONC-A','CONC-B'));
delete from order_items where order_id in (
  select id from orders where code in ('CONC-A','CONC-B'));
delete from orders where code in ('CONC-A','CONC-B');
delete from ticket_types where id = 'cccc0000-0000-4000-8000-00000000cc01';
delete from events  where id = 'bbbb0000-0000-4000-8000-00000000cc01';
delete from venues  where id = 'aaaa0000-0000-4000-8000-00000000cc01';
delete from auth.users where email in ('conc1@test.pe','conc2@test.pe');
SQL

echo
if [ "$fallos" -eq 0 ]; then
  echo "Prueba de concurrencia superada."
  exit 0
fi
echo "Prueba de concurrencia FALLIDA ($fallos problemas)."
exit 1
