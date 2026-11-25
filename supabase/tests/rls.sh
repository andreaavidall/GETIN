#!/usr/bin/env bash
# ===========================================================================
# GETIN · pruebas de Row Level Security contra la API real
#
# No comprueba la interfaz: va directo a PostgREST con el token de cada
# usuario, que es justo lo que haria alguien curioso con las DevTools abiertas.
#
# Lo que se verifica:
#   · un cliente solo ve SUS ordenes, entradas y perfil,
#   · una discoteca no ve nada de otra discoteca,
#   · nadie puede crear una orden ni cambiar su importe desde el navegador,
#   · los borradores y los locales sin aprobar no salen en el catalogo publico,
#   · la auditoria y los webhooks solo los ve GETIN.
#
# Requisitos: `npx supabase start` corriendo y el seed cargado.
# Uso:  bash supabase/tests/rls.sh
# ===========================================================================
set -uo pipefail

API=${SUPABASE_URL:-http://127.0.0.1:54321}

# NO es un secreto: es la clave anonima de demostracion que la CLI de Supabase
# genera identica en CUALQUIER instalacion local (esta publicada en su propia
# documentacion). Solo sirve contra 127.0.0.1. Para apuntar a otro entorno,
# exporta SUPABASE_URL y SUPABASE_ANON_KEY.
ANON=${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0}

# Contraseña de los usuarios de demostracion del seed, solo para desarrollo local.
PASS=${GETIN_DEMO_PASSWORD:-demo1234}

fallos=0
ok()   { echo "OK   · $1"; }
fail() { echo "FALLO · $1"; echo "         $2"; fallos=$((fallos + 1)); }

token_for() {
  curl -s -X POST "$API/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON" -H "Content-Type: application/json" \
    --data-raw "{\"email\":\"$1\",\"password\":\"$PASS\"}" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).access_token??'')}catch{console.log('')}})"
}

rest() { # rest <token> <metodo> <ruta> [cuerpo]
  local tok=$1 method=$2 path=$3 body=${4:-}
  if [ -n "$body" ]; then
    curl -s -X "$method" "$API/rest/v1/$path" \
      -H "apikey: $ANON" -H "Authorization: Bearer $tok" \
      -H "Content-Type: application/json" -H "Prefer: return=representation" \
      --data-raw "$body"
  else
    curl -s -X "$method" "$API/rest/v1/$path" \
      -H "apikey: $ANON" -H "Authorization: Bearer $tok"
  fi
}

count() { # cuenta elementos de un array JSON
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(Array.isArray(j)?j.length:-1)}catch{console.log(-1)}})"
}

echo "Obteniendo tokens de los usuarios de demostracion..."
TOK_CLIENTE=$(token_for cliente@demo.getin.pe)
TOK_CLUB=$(token_for club@demo.getin.pe)
TOK_PUERTA=$(token_for puerta@demo.getin.pe)
TOK_ADMIN=$(token_for admin@demo.getin.pe)

for par in "cliente:$TOK_CLIENTE" "club:$TOK_CLUB" "puerta:$TOK_PUERTA" "admin:$TOK_ADMIN"; do
  if [ -z "${par#*:}" ]; then
    echo "No pude autenticar a ${par%%:*}. ¿Esta cargado el seed? (npx supabase db reset)" >&2
    exit 1
  fi
done
echo

# --------------------------------------------------------------- perfiles ---
n=$(rest "$TOK_CLIENTE" GET "profiles?select=id,email" | count)
[ "$n" = "1" ] && ok "un cliente solo ve su propio perfil (ve $n)" \
               || fail "un cliente ve $n perfiles" "deberia ver exactamente 1"

n=$(rest "$TOK_CLUB" GET "profiles?select=id,email" | count)
[ "$n" = "1" ] && ok "una discoteca no puede listar los perfiles de sus clientes (ve $n)" \
               || fail "la discoteca ve $n perfiles" "no debe acceder a los datos personales de los compradores"

n=$(rest "$TOK_ADMIN" GET "profiles?select=id" | count)
[ "$n" -ge "4" ] && ok "el superadministrador si ve todos los perfiles (ve $n)" \
                 || fail "el superadministrador ve $n perfiles" "deberia verlos todos"

# ---------------------------------------------------------------- ordenes ---
# El cliente solo debe ver ordenes suyas.
propias=$(rest "$TOK_CLIENTE" GET "orders?select=id,user_id" | count)
ajenas=$(rest "$TOK_CLIENTE" GET "orders?select=id&user_id=neq.11111111-1111-4111-8111-111111111111" | count)
[ "$ajenas" = "0" ] && ok "un cliente no ve ordenes ajenas (propias: $propias, ajenas: $ajenas)" \
                    || fail "el cliente ve $ajenas ordenes ajenas" "RLS de orders demasiado abierta"

# La discoteca solo ve ordenes de SUS locales.
ajenas=$(rest "$TOK_CLUB" GET "orders?select=id&venue_id=eq.a0000000-0000-4000-8000-000000000003" | count)
[ "$ajenas" = "0" ] && ok "una discoteca no ve ordenes de otro local (ve $ajenas)" \
                    || fail "la discoteca ve $ajenas ordenes de otro local" "fuga entre establecimientos"

# Crear una orden desde el navegador: no hay politica de INSERT.
res=$(rest "$TOK_CLIENTE" POST "orders" '{"code":"HACK-001","user_id":"11111111-1111-4111-8111-111111111111","event_id":"b0000000-0000-4000-8000-000000000001","venue_id":"a0000000-0000-4000-8000-000000000001","subtotal_cents":1,"service_fee_cents":0,"tax_cents":0,"total_cents":1,"commission_bps":0,"getin_fee_cents":0,"venue_amount_cents":1}')
echo "$res" | grep -qiE "row-level security|permission denied|violates" \
  && ok "un cliente NO puede crear una orden (y por tanto no puede fijar el precio)" \
  || fail "el cliente pudo insertar una orden" "$res"

# ---------------------------------------------------------- entradas y QR ---
ajenas=$(rest "$TOK_CLIENTE" GET "tickets?select=id&user_id=neq.11111111-1111-4111-8111-111111111111" | count)
[ "$ajenas" = "0" ] && ok "un cliente no ve entradas de otros (ve $ajenas)" \
                    || fail "el cliente ve $ajenas entradas ajenas" "RLS de tickets demasiado abierta"

# El personal de puerta valida por RPC; no debe poder leer los nonces.
n=$(rest "$TOK_PUERTA" GET "qr_credentials?select=nonce,token_hash" | count)
[ "$n" = "0" ] && ok "el personal de puerta no puede leer las credenciales QR (ve $n)" \
               || fail "la puerta lee $n credenciales QR" "con el nonce podria intentar reconstruir codigos"

# ------------------------------------------------------- catalogo publico ---
n=$(curl -s "$API/rest/v1/events?select=id,status&status=eq.draft" -H "apikey: $ANON" | count)
[ "$n" = "0" ] && ok "los eventos en borrador no salen por la API publica (ve $n)" \
               || fail "la API publica expone $n borradores" "RLS de events demasiado abierta"

n=$(curl -s "$API/rest/v1/venues?select=id&status=neq.approved" -H "apikey: $ANON" | count)
[ "$n" = "0" ] && ok "los locales sin aprobar no salen por la API publica (ve $n)" \
               || fail "la API publica expone $n locales sin aprobar" "revisar venues_public_read"

# ------------------------------------------------- auditoria y operaciones ---
n=$(rest "$TOK_CLUB" GET "audit_logs?select=id" | count)
[ "$n" = "0" ] && ok "una discoteca no lee la auditoria (ve $n)" \
               || fail "la discoteca lee $n registros de auditoria" "solo GETIN debe verlos"

n=$(rest "$TOK_CLIENTE" GET "payment_webhook_events?select=id" | count)
[ "$n" = "0" ] && ok "un cliente no lee los eventos de webhook (ve $n)" \
               || fail "el cliente lee $n webhooks" "contienen datos de pago de terceros"

# ------------------------------------------------------ escalada de roles ---
res=$(rest "$TOK_CLIENTE" PATCH "profiles?id=eq.11111111-1111-4111-8111-111111111111" '{"role":"superadmin"}')
echo "$res" | grep -qiE "FORBIDDEN|row-level security|permission denied" \
  && ok "un cliente no puede ascenderse a superadministrador" \
  || fail "el cliente cambio su propio rol" "$res"

rol=$(rest "$TOK_CLIENTE" GET "profiles?select=role" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d)[0]?.role??'?')}catch{console.log('?')}})")
[ "$rol" = "client" ] && ok "el rol sigue siendo 'client' despues del intento" \
                      || fail "el rol quedo en '$rol'" "deberia seguir siendo client"

# ------------------------------- ejecucion de funciones desde el navegador ---
# Postgres concede EXECUTE a PUBLIC por defecto, y PostgREST expone todo el
# esquema public en /rest/v1/rpc/. Las funciones de inventario no comprueban de
# quien es la orden (la app las llama con la service role), asi que un usuario
# con sesion no debe poder tocarlas: podria soltar las entradas retenidas por
# otro, o agotar inventario ajeno.
res=$(curl -s -X POST "$API/rest/v1/rpc/getin_release_hold" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOK_CLIENTE" \
  -H "Content-Type: application/json" \
  --data-raw '{"p_order_id":"00000000-0000-4000-8000-000000000000"}')
echo "$res" | grep -q "permission denied" \
  && ok "un cliente no puede liberar la retencion de otro (getin_release_hold)" \
  || fail "el cliente pudo llamar a getin_release_hold" "$res"

res=$(curl -s -X POST "$API/rest/v1/rpc/getin_hold_tickets" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOK_CLIENTE" \
  -H "Content-Type: application/json" \
  --data-raw '{"p_order_id":"00000000-0000-4000-8000-000000000000","p_ticket_type_id":"00000000-0000-4000-8000-000000000000","p_qty":5}')
echo "$res" | grep -q "permission denied" \
  && ok "un cliente no puede retener inventario a mano (getin_hold_tickets)" \
  || fail "el cliente pudo llamar a getin_hold_tickets" "$res"

# Pero el escaneo si tiene que llegar a su propio control de permisos.
res=$(curl -s -X POST "$API/rest/v1/rpc/getin_scan_qr" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOK_CLIENTE" \
  -H "Content-Type: application/json" \
  --data-raw '{"p_token_hash":"x","p_venue_id":"a0000000-0000-4000-8000-000000000001"}')
echo "$res" | grep -q "FORBIDDEN" \
  && ok "getin_scan_qr se alcanza pero rechaza a quien no es personal del local" \
  || fail "getin_scan_qr no respondio FORBIDDEN" "$res"

# Y el catalogo publico, que depende de funciones llamadas dentro de las
# politicas de RLS, tiene que seguir cargando para un anonimo.
n=$(curl -s "$API/rest/v1/events?select=id&status=eq.published" -H "apikey: $ANON" | count)
[ "$n" -ge "1" ] && ok "el catalogo publico sigue leyendose como anonimo (ve $n eventos)" \
                 || fail "el catalogo publico dejo de cargar" "revisar los revoke de 0005"

# ----------------------------------------------- publicacion de un local ----
res=$(rest "$TOK_CLUB" PATCH "venues?id=eq.a0000000-0000-4000-8000-000000000001" '{"commission_bps":0}')
echo "$res" | grep -qiE "FORBIDDEN|row-level security|permission denied" \
  && ok "una discoteca no puede bajarse su propia comision" \
  || fail "la discoteca cambio su comision" "$res"

# ------------------------------------------------------------- favoritos ----
# Un favorito es poco, pero dice donde piensa ir alguien. Que solo lo vea su
# dueño: ni otro cliente, ni el local, ni el personal de puerta.
first_id() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d)[0].id)}catch{console.log('')}})"; }

EV_ID=$(curl -s "$API/rest/v1/events?select=id&status=eq.published&limit=1" -H "apikey: $ANON" | first_id)
YO=$(rest "$TOK_CLIENTE" GET "profiles?select=id" | first_id)
# Un perfil que NO es el del cliente: el de otra persona cualquiera.
OTRO=$(rest "$TOK_ADMIN" GET "profiles?select=id&id=neq.$YO&limit=1" | first_id)

# Sin user_id la politica no puede cumplirse: la columna no tiene default.
res=$(rest "$TOK_CLIENTE" POST "favorites" "{\"event_id\":\"$EV_ID\"}")
echo "$res" | grep -qiE "row-level security|permission denied|null value"   && ok "un favorito sin dueño explicito se rechaza"   || fail "se creo un favorito sin dueño" "$res"

# En nombre de otro usuario: esto es el intento que importa.
res=$(rest "$TOK_CLIENTE" POST "favorites" "{\"user_id\":\"$OTRO\",\"event_id\":\"$EV_ID\"}")
echo "$res" | grep -qiE "row-level security|permission denied"   && ok "un cliente no puede guardar favoritos en nombre de otro"   || fail "el cliente creo un favorito ajeno" "$res"

# El propio si, y solo lo ve el.
res=$(rest "$TOK_CLIENTE" POST "favorites" "{\"user_id\":\"$YO\",\"event_id\":\"$EV_ID\"}")
echo "$res" | grep -q "$EV_ID"   && ok "el cliente guarda su propio favorito"   || fail "el cliente no pudo guardar su favorito" "$res"

n=$(rest "$TOK_CLUB" GET "favorites?select=id" | count)
[ "$n" = "0" ] && ok "una discoteca no ve los favoritos de sus clientes (ve 0)"               || fail "la discoteca vio favoritos" "ve $n"

n=$(rest "$TOK_PUERTA" GET "favorites?select=id" | count)
[ "$n" = "0" ] && ok "el personal de puerta no ve favoritos (ve 0)"               || fail "la puerta vio favoritos" "ve $n"

# Se limpia lo que la prueba creo.
rest "$TOK_CLIENTE" DELETE "favorites?event_id=eq.$EV_ID" > /dev/null

# ------------------------------------------------- la puerta no ve la caja ---
# La cuenta de puerta pertenece al local, pero su herramienta es el escaner.
# Que pudiera leer ventas y comisiones era un hallazgo de auditoria.
n=$(rest "$TOK_PUERTA" GET "orders?select=id,total_cents" | count)
[ "$n" = "0" ] && ok "la puerta no lee ordenes del local (ve 0)"               || fail "la puerta leyo ordenes" "ve $n"

n=$(rest "$TOK_PUERTA" GET "payments?select=id,amount_cents" | count)
[ "$n" = "0" ] && ok "la puerta no lee pagos (ve 0)" || fail "la puerta leyo pagos" "ve $n"

n=$(rest "$TOK_PUERTA" GET "commissions?select=id" | count)
[ "$n" = "0" ] && ok "la puerta no lee comisiones (ve 0)"               || fail "la puerta leyo comisiones" "ve $n"

n=$(rest "$TOK_PUERTA" GET "settlements?select=id" | count)
[ "$n" = "0" ] && ok "la puerta no lee liquidaciones (ve 0)"               || fail "la puerta leyo liquidaciones" "ve $n"

n=$(rest "$TOK_PUERTA" GET "venue_verifications?select=id" | count)
[ "$n" = "0" ] && ok "la puerta no lee los documentos del local (ve 0)"               || fail "la puerta leyo las verificaciones" "ve $n"

# Pero si sigue viendo lo que necesita para trabajar.
n=$(rest "$TOK_PUERTA" GET "tickets?select=id,serial" | count)
[ "$n" -ge "0" ] && ok "la puerta sigue viendo las entradas del local (ve $n)"                  || fail "la puerta dejo de ver entradas" "ve $n"

# Y el local si ve su propia caja.
n=$(rest "$TOK_CLUB" GET "orders?select=id" | count)
[ "$n" -ge "1" ] && ok "el local si ve sus ordenes (ve $n)"                  || fail "el local dejo de ver sus ordenes" "ve $n"

echo
if [ "$fallos" -eq 0 ]; then
  echo "Todas las pruebas de RLS pasaron."
  exit 0
fi
echo "$fallos prueba(s) de RLS FALLARON."
exit 1
