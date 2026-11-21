# Seguridad

## Las amenazas que importan en esta plataforma

| Amenaza | Qué lo impide |
| --- | --- |
| Sobreventa de entradas | `CHECK (sold_count + held_count <= capacity)` + `SELECT FOR UPDATE` en `getin_hold_tickets`. La decisión no se toma en JavaScript. |
| Vender la misma mesa dos veces | `UNIQUE (event_id, venue_table_id)` + índice único parcial sobre reservas vivas + bloqueo en `getin_hold_table`. |
| Comprar más barato manipulando el cliente | El navegador **no puede insertar órdenes**: no hay política de `INSERT` en RLS. El servidor relee los precios desde `ticket_types` y `assertOrderAmountIntact` recalcula antes de cobrar. |
| Marcar una orden como pagada sin pagar | Solo `getin_confirm_order`, llamada únicamente desde el webhook con firma válida. El trigger `guard_order_money` rechaza el cambio a `paid` hecho con sesión de usuario. |
| Fabricar un QR | El token lleva HMAC-SHA256 con `QR_TOKEN_SECRET`, que solo está en el servidor. La base guarda el nonce y el hash, no el token: quien lea `qr_credentials` no puede firmar. |
| Entrar dos veces con el mismo QR | `getin_scan_qr` comprueba y marca como usada en una transacción con `FOR UPDATE`. El segundo escaneo recibe `denied_used`. |
| Una discoteca espiando a otra | `venue_staff` + `getin_has_venue_access()` en los guards, en las funciones y en cada política de RLS. Cubierto por tests. |
| El personal de puerta leyendo compradores | `venue.exportReports` y `venue.readPayments` requieren `owner` o `manager`. El rol `door` no lee `qr_credentials`: valida por RPC, que no expone el nonce. |
| Un webhook repetido duplicando entradas | `UNIQUE (provider, provider_event_id)` en `payment_webhook_events` + `getin_confirm_order` idempotente. |
| Sondeo de tokens desde un escáner comprometido | `getin_rate_limit`: 120 escaneos por minuto y usuario. Y la firma se valida antes de tocar la base. |
| Escalada de privilegios cambiándose el rol | Trigger `guard_profile_privileges`: `role` e `is_suspended` solo los cambia el superadmin. |
| Un local publicándose solo | Triggers `venues_guard_insert` y `venues_guard`: `status`, `is_verified`, `commission_bps` y `published_at` solo los toca GETIN. |
| Bajar el aforo por debajo de lo vendido | Trigger `guard_ticket_counters` + el `CHECK` de la tabla. |
| Inyección de fórmulas en el CSV de asistentes | `csvCell()` prefija con `'` los valores que empiezan por `=`, `+`, `-`, `@`. |
| Redirección abierta en el callback de auth | Solo se aceptan rutas internas (`/...`, nunca `//...`). |

---

## Las tres capas de autorización

```
1. Guard de servidor     can(actor, acción, venueId)      src/lib/auth/guards.ts
2. Función de Postgres    getin_has_venue_access(...)      dentro del SECURITY DEFINER
3. Row Level Security     políticas por tabla              migración 0003
```

Son redundantes a propósito. Ocultar un botón no es un control de acceso; tampoco lo es un
`if` en un componente de cliente.

Nota de diseño: **`can()` deniega si no se le pasa el `venueId`** de la acción. Evita el
error habitual de concluder “tiene permiso en algún local, luego puede aquí”.

### Tablas sin escritura desde el cliente

Ninguna de estas tiene política de `INSERT`/`UPDATE` para `authenticated`:

`orders` · `order_items` · `payments` · `tickets` · `qr_credentials` · `checkins` ·
`commissions` · `audit_logs` · `inventory_holds` · `rate_limit_counters`

Se escriben desde el servidor (service role) o desde las funciones `security definer`.

---

## Gestión de secretos

| Variable | Dónde vive | Si se filtra |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Navegador (es pública por diseño) | Sin impacto: RLS limita todo. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo servidor** | Grave: salta RLS por completo. |
| `QR_TOKEN_SECRET` | **Solo servidor** | Grave: permite fabricar QR válidos. Rotarlo invalida todos los QR emitidos. |
| `CULQI_SECRET_KEY` | **Solo servidor** | Grave: permite cobrar y reembolsar. |
| `PAYMENTS_TEST_WEBHOOK_SECRET` | Solo servidor | Leve en producción (ahí no se usa el simulador). |

Los módulos que leen secretos llevan `import "server-only"`: si alguien los importa desde
un componente de cliente, **el build falla**. No es una convención, es una barrera.

---

## Datos personales (Ley 29733)

- El QR **no contiene datos personales**: solo un identificador aleatorio firmado.
- `payments` guarda la marca de la tarjeta y los 4 últimos dígitos. Nunca el PAN ni el CVV.
- Una discoteca ve los compradores **de sus propios eventos**, no los de otros locales. Y
  no puede leer la tabla `profiles` de sus clientes: usa `tickets.holder_name` y
  `orders.buyer_email`.
- El bucket `venue-documents` (RUC, licencias) es **privado**; se sirve por URL firmada.
- Los consentimientos de términos y privacidad se guardan con su fecha
  (`terms_accepted_at`, `privacy_accepted_at`).
- `audit_logs` registra IP y user-agent **solo** en operaciones sensibles.

---

## Cabeceras HTTP

Configuradas en `next.config.ts`:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(self), geolocation=()
```

`camera=(self)` es necesario para el escáner de puerta.

---

## Pendiente de endurecer

Cosas reales que faltan y conviene no olvidar:

- [ ] **Content-Security-Policy.** No está puesta. Con `culqi.js` en el checkout hay que
      definirla con cuidado (nonce por petición) para no romper el pago.
- [ ] **Rate limiting en login y registro.** Ahora solo lo tiene el escaneo. Supabase Auth
      limita por su lado, pero conviene añadirlo en la aplicación.
- [ ] **Rotación de `QR_TOKEN_SECRET`.** Hoy rotarlo invalidaría los QR vigentes. Haría
      falta versionar el secreto (el token ya lleva prefijo de versión, `GETIN1`).
- [ ] **Cron de vencimientos.** `getin_expire_stale_orders()` existe pero **nadie la
      llama**. Hay que programarla (pg_cron o una ruta protegida con cron de Vercel), o el
      inventario de órdenes abandonadas se libera solo cuando alguien intenta comprar ese
      mismo tipo de entrada.
- [ ] **Copias de seguridad.** Supabase hace backups automáticos según el plan; hay que
      verificar la frecuencia y **probar una restauración** antes de operar.
- [ ] **Registro de errores.** `src/app/error.tsx` solo escribe en consola. Conectar Sentry
      u equivalente.
- [ ] **Verificación de correo obligatoria.** Está desactivada en `config.toml` para
      desarrollar cómodo. En producción debe activarse.
- [ ] **2FA para el superadministrador.** Supabase lo soporta (MFA); no está habilitado.
- [ ] **Revisión de las políticas de RLS contra una base real.** Están escritas pero no
      ejecutadas: ver `docs/ESTADO.md`.

---

## Qué probar antes de abrir al público

1. `supabase/tests/atomicidad.sql` en verde.
2. La prueba de concurrencia con dos sesiones `psql` (descrita al final de ese archivo).
3. Intentar comprar con otra sesión manipulando `orders` por la API de Supabase: debe fallar.
4. Enviar un webhook con firma inválida: debe responder 401.
5. Enviar el mismo webhook dos veces: una sola emisión de entradas.
6. Escanear un QR dos veces desde dos dispositivos a la vez: un solo ingreso.
7. Entrar al panel de un local ajeno cambiando el `?local=<uuid>` en la URL: debe redirigir.
8. Descargar el CSV de un evento ajeno por su id: debe responder 403.
