# Arquitectura de GETIN

## 1. Forma general

Una sola aplicación Next.js (App Router) con Supabase detrás. No hay backend separado: el
“servidor” son los componentes de servidor, las server actions y las rutas de API, que
corren en el mismo despliegue (Vercel).

```
Navegador
   │  (HTML renderizado en servidor + islas de cliente)
   ▼
Next.js App Router
   ├─ Componentes de servidor ──► lectura del catálogo (cliente anónimo, con RLS)
   ├─ Server actions ───────────► escrituras del usuario (validan permiso + Zod)
   ├─ Rutas API ────────────────► webhook de pagos, validación de QR, CSV
   └─ Middleware ───────────────► refresco de sesión y bloqueo de zonas privadas
   │
   ▼
Supabase
   ├─ Auth            sesiones, cookies httpOnly, rotación de refresh token
   ├─ PostgreSQL      esquema relacional + funciones atómicas + RLS
   └─ Storage         imágenes públicas y documentos privados del local
   │
   ▼
Proveedor de pagos (puerto `PaymentProvider`)
   ├─ TestPaymentProvider   simulador local, no cobra
   └─ CulqiPaymentProvider  estructura lista, sin credenciales
```

### Por qué así

- **Sin backend aparte.** Para un MVP, un servicio extra duplica despliegues, autenticación
  y modelos sin aportar nada: todo lo que necesita privilegio vive ya en el servidor de
  Next.
- **Supabase y no un ORM contra Postgres pelado.** Da autenticación, Storage y, sobre todo,
  **RLS**: una segunda barrera de autorización dentro de la base. Con un ORM, si se escapa
  una consulta sin filtrar, no hay nada que la pare.
- **La lógica crítica en SQL.** La regla “no sobrevender” no se puede garantizar desde
  JavaScript: entre leer la disponibilidad y escribir la venta hay una ventana donde entra
  otro comprador. Se resuelve con bloqueo de fila dentro de una función de Postgres.

---

## 2. Cambios respecto al planteamiento inicial

| Pedido | Qué se hizo | Por qué |
| --- | --- | --- |
| shadcn/ui | Primitivos propios en `src/components/ui` con el mismo patrón (CVA + Radix + `cn`) | shadcn no es una dependencia: es código que se copia. Escribirlo directamente evita una capa de CLI y deja el control de la paleta GETIN, que es lo que distingue el diseño. |
| Select de Radix | `<select>` nativo con estilo | La mayoría entra desde el celular. El selector nativo es más rápido, accesible por defecto y no necesita JavaScript. |
| TanStack Query | No se usa todavía | El estado de servidor lo resuelven los componentes de servidor y las server actions; el estado de los filtros vive en la URL. Añadir una caché de cliente ahora sería complejidad sin problema que resolver. Entra cuando haya pantallas con sondeo en vivo (puerta en tiempo real, panel de ventas). |
| “Un proveedor de pagos compatible con Perú” | Puerto `PaymentProvider` + adaptador de pruebas + Culqi sin credenciales | Stripe no procesa pagos con entidades peruanas. Culqi, Niubiz, Izipay y Mercado Pago sí. Culqi tiene la integración más directa por token de tarjeta y soporte de Yape. La decisión final es comercial, así que la arquitectura no se ata a ninguna. |
| Dinero | Enteros en céntimos (`bigint`) | Con coma flotante, 0.1 + 0.2 ≠ 0.3. En una plataforma que reparte comisiones eso es un descuadre contable. |
| QR | Token firmado con HMAC, nonce en la base | Permite volver a dibujar el QR del usuario sin guardar el token, y que quien lea la tabla no pueda fabricar uno válido. |

---

## 3. Modelo de datos

26 tablas. Las que sostienen el negocio:

### Identidad y locales
- `profiles` — extiende `auth.users` con rol global, teléfono, fecha de nacimiento y
  consentimientos (Ley 29733).
- `venues` — el local. `status` controla la publicación; **el propio local no puede
  cambiarlo** (triggers `venues_guard_insert` y `venues_guard`).
- `venue_staff` — quién pertenece a qué local y con qué rol (`owner` / `manager` / `door`).
  Es la pieza que hace el aislamiento entre discotecas.
- `venue_verifications` — expediente comercial que revisa GETIN.

### Catálogo
- `events`, `event_images`
- `ticket_types` — aforo, vendidas, retenidas, ventana de venta, máximo por compra.
  Lleva el `CHECK (sold_count + held_count <= capacity)`: **la invariante central**.
- `venue_tables` + `event_table_availability` — el `UNIQUE (event_id, venue_table_id)` es lo
  que impide vender la misma mesa dos veces para el mismo evento.
- `guest_lists`, `guest_list_entries`

### Dinero
- `orders`, `order_items` — con el desglose congelado en el momento de la compra: precio,
  comisión GETIN, comisión estimada de pasarela, importe del local.
- `inventory_holds` — retenciones temporales con vencimiento.
- `payments` — solo metadatos de la tarjeta (marca y 4 últimos). **Nunca PAN ni CVV.**
- `payment_webhook_events` — `UNIQUE (provider, provider_event_id)`: la idempotencia frente
  a los reintentos del proveedor.
- `refunds`, `commissions`, `settlements`, `platform_settings`

### Acceso
- `tickets`, `table_reservations`
- `qr_credentials` — nonce + hash del token, con `CHECK` de un solo objetivo.
- `checkins` — cada escaneo, con resultado, hora y quién lo hizo.

### Operación
- `notifications`, `support_tickets`, `audit_logs`, `rate_limit_counters`

---

## 4. Las funciones que importan

Viven en `supabase/migrations/..._functions.sql`, todas `security definer`.

### `getin_hold_tickets(orden, tipo, cantidad, minutos)`
1. `SELECT ... FOR UPDATE` sobre `ticket_types`: serializa a todos los compradores de ese
   tipo de entrada.
2. Libera primero las retenciones vencidas (para no bloquear ventas reales).
3. Comprueba ventana de venta, máximo por compra y disponibilidad real.
4. Inserta o **ajusta** la retención — es idempotente por `(order_id, ticket_type_id)`, así
   que reintentar no acumula inventario.

Si dos personas piden la última entrada a la vez, la segunda espera el bloqueo y luego
recibe `SOLD_OUT`. No hay forma de sobrevender sin saltarse esta función.

### `getin_confirm_order(orden, pago, credenciales)`
Única puerta de entrada a “pagado”. Convierte retenciones en ventas, emite entradas y
credenciales QR, confirma las reservas de mesa y registra la comisión. **Idempotente**: si
la orden ya está pagada devuelve las entradas existentes sin tocar nada.

### `getin_scan_qr(hash, local, dispositivo)`
Comprueba y marca como usada en una sola transacción con `FOR UPDATE`. Dos escaneos
simultáneos del mismo QR no pueden autorizar dos ingresos: el segundo recibe
`denied_used`. Siempre deja rastro en `checkins`, incluso cuando rechaza.

### `getin_expire_stale_orders()`
Barrido para un cron: libera inventario de órdenes vencidas aunque el navegador se haya
cerrado. Con `FOR UPDATE SKIP LOCKED` para que dos ejecuciones no se peleen.

---

## 5. Autorización en tres capas

```
1. Guard de servidor     src/lib/auth/guards.ts  →  can(actor, acción, venueId)
2. Función de Postgres   getin_has_venue_access(...) dentro del SECURITY DEFINER
3. Row Level Security    políticas por tabla
```

Las tres son necesarias a propósito. Si se afloja una política de RLS, el guard sigue
negando; si una consulta se escapa sin guard, la base sigue negando.

Detalle importante: **`can()` exige el `venueId`**. Sin él deniega, para evitar el fallo
clásico de “tiene permiso en algún local, luego puede aquí”.

### Qué puede cada rol

| Acción | Cliente | Puerta | Gerente | Dueño | GETIN |
| --- | :-: | :-: | :-: | :-: | :-: |
| Ver catálogo | ✓ | ✓ | ✓ | ✓ | ✓ |
| Comprar | ✓ | ✓ | ✓ | ✓ | ✓ |
| Escanear QR | — | ✓ | ✓ | ✓ | ✓ |
| Ver panel del local | — | ✓ | ✓ | ✓ | ✓ |
| Gestionar eventos y entradas | — | — | ✓ | ✓ | ✓ |
| Ver pagos / exportar | — | — | ✓ | ✓ | ✓ |
| Gestionar personal | — | — | — | ✓ | ✓ |
| Aprobar locales, comisiones, auditoría | — | — | — | — | ✓ |

Siempre limitado al local al que pertenece. Está cubierto por tests
(`tests/permissions.test.ts`), incluidos los casos de cruce entre locales.

---

## 6. Flujo de compra

```
1. El usuario elige entradas en el evento
       │
2. createOrderAction  (server action)
       ├─ exige sesión y permiso
       ├─ valida con Zod
       └─ createOrderFromCart
            ├─ relee precios DESDE LA BASE (nunca del navegador)
            ├─ calcula totales (computeOrderTotals)
            ├─ inserta la orden con service role  ◄── el navegador NO puede
            └─ getin_hold_tickets / getin_hold_table  (atómico)
       │
3. /checkout/[orderId] — resumen con desglose y cuenta atrás
       │
4. startPaymentAction
            ├─ assertOrderAmountIntact  ◄── recalcula el importe desde los conceptos
            └─ provider.createIntent
       │
5. El comprador paga en el proveedor
       │
6. POST /api/webhooks/pagos   ◄── el ÚNICO camino a "pagado"
            ├─ verifica la firma           → 401 si no cuadra
            ├─ registra el evento (único)  → idempotencia
            ├─ compara el importe informado con el cobrado
            └─ confirmPaidOrder → getin_confirm_order → entradas + QR
       │
7. /cuenta/entradas — ticket digital con el QR
```

**No existe ninguna ruta que marque una orden como pagada desde el navegador.** No hay
política de `INSERT` sobre `orders` ni `order_items` en RLS, y el trigger
`guard_order_money` rechaza cualquier cambio de importes o de estado a `paid` hecho con una
sesión de usuario.

---

## 7. Las credenciales QR

Contenido del QR:

```
GETIN1.t:<uuid-de-la-entrada>.<nonce>.<hmac>
```

- **No lleva datos personales.** Ni nombre, ni correo, ni documento. Una foto del QR
  filtrada no expone al comprador.
- El `hmac` se calcula con `QR_TOKEN_SECRET`, que solo existe en el servidor.
- La base guarda el **nonce** y el **hash del token**, no el token. Así el servidor puede
  volver a dibujar el QR del usuario cuantas veces quiera, pero quien lea la tabla
  `qr_credentials` no puede fabricar uno válido.
- La validación comprueba la firma **antes** de consultar la base: un QR falsificado no
  llega a generar consulta.

Cubierto en `tests/qr.test.ts`, incluidos los intentos de manipular el identificador, el
nonce y la firma.

---

## 8. Modelo de negocio en el esquema

Por cada operación pagada se guarda, en céntimos:

| Campo | Qué es |
| --- | --- |
| `subtotal_cents` | Lo que fijó el local |
| `service_fee_cents` | Cargo por servicio que paga el comprador |
| `commission_bps` | Comisión aplicada, congelada en la orden |
| `getin_fee_cents` | Ingreso de GETIN |
| `gateway_fee_cents` | Coste estimado de la pasarela |
| `venue_amount_cents` | Lo que corresponde al local |
| `tax_cents` | IGV contenido en el precio (informativo) |

La comisión es configurable: global en `platform_settings` y por local en
`venues.commission_bps`.

**No se asume que el dinero se divida automáticamente.** Eso depende del proveedor y del
acuerdo comercial. La plataforma registra el desglose y prepara la conciliación
(`commissions` + `settlements`); el pago al local es, por ahora, un proceso operativo.

---

## 9. Modo demostración

`NEXT_PUBLIC_DATA_MODE=demo` (el valor por defecto) sirve un catálogo ficticio en memoria
(`src/lib/data/demo.ts`) con la misma forma que la versión con base de datos, para que el
proyecto arranque con `npm run dev` sin configurar nada.

En ese modo: cada tarjeta lleva la etiqueta **DEMO**, hay un aviso explícito en cada
pantalla, el botón de compra está deshabilitado y las zonas privadas explican qué falta
configurar en lugar de romperse. Ningún evento ficticio se presenta como comprable.

---

## 10. Lo que falta por fase

**Fase 2** — Subida de imágenes a Storage, edición de eventos, mapa de mesas, panel de
personal, reembolsos de punta a punta, liquidaciones, correos transaccionales,
tickets de soporte en la plataforma.

**Fase 3** — Mapa interactivo de mesas, reservas grupales, división de pagos,
recomendaciones, notificaciones push y WhatsApp, fidelización, app nativa.

Lo que ya está preparado para ello: coordenadas en `venue_tables`, tabla `notifications`
con campo `channel`, `support_tickets`, `settlements`.
