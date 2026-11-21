# Estado real del proyecto

Este documento dice qué funciona **verificado ejecutándolo**, qué está escrito pero sin
probar, y qué falta. Sin adornos.

Última verificación: con Supabase local corriendo (`npx supabase start`) y la aplicación en
modo `live` contra esa base.

---

## Verificado ejecutándolo

### Código

| Comprobación | Resultado |
| --- | --- |
| `npx tsc --noEmit` | ✅ sin errores |
| `npm test` (Vitest) | ✅ **92 pruebas en 5 archivos, todas pasan** |
| `npm run lint` | ✅ sin warnings |
| `npm run build` | ✅ compila; 35 rutas |

### Base de datos

| Comprobación | Resultado |
| --- | --- |
| Las 4 migraciones aplican sobre Postgres limpio | ✅ |
| `seed.sql` carga | ✅ 4 perfiles, 5 locales, 5 eventos, 11 tipos de entrada, 6 mesas, 2 listas |
| 15 funciones `getin_*` creadas | ✅ |
| 28 tablas con RLS activo | ✅ |
| `supabase/tests/atomicidad.sql` | ✅ **15 aserciones, todas OK** |
| `supabase/tests/concurrencia.sh` | ✅ **dos sesiones reales, sin sobreventa** |
| `supabase/tests/rls.sh` | ✅ **15 consultas hostiles, todas rechazadas** |

Lo que demuestran esas pruebas de base de datos:

- **No se sobrevende.** Con aforo 3, el segundo comprador que pide 2 es rechazado; con el
  aforo lleno nadie más retiene.
- **Dos sesiones simultáneas por la última entrada:** la segunda queda bloqueada en el
  `FOR UPDATE` y, al confirmar la primera, recibe `SOLD_OUT`. El inventario acaba en 1/1.
- **La retención es idempotente:** repetirla no duplica inventario.
- **Las retenciones vencidas se liberan** y la entrada vuelve a la venta.
- **Confirmar emite entradas, QR y comisión**, y mueve `held → sold`.
- **Confirmar dos veces no duplica nada** (reintento de webhook).
- **Un QR autoriza una sola vez;** el segundo escaneo responde `denied_used`.
- **Un QR desconocido se rechaza** y todo escaneo queda en `checkins`.
- **Una mesa no se retiene para dos órdenes** ni admite disponibilidad duplicada.

### Flujo completo de compra, recorrido en el navegador

Con la app en modo `live` contra la base real, de principio a fin:

1. **Login** como `cliente@demo.getin.pe` → sesión y perfil correctos (rol CLIENTE).
2. **Evento** `/eventos/nocturna-saturday-house` renderizado desde Postgres, con line-up,
   horarios, mesas y lista de invitados.
3. **Selección de 2 entradas General** → Subtotal S/ 140.00 · Cargo por servicio (7%)
   S/ 9.80 · **Total S/ 149.80**. Los importes del navegador coinciden con los que el
   servidor recalculó.
4. **Orden creada** (`GETIN-NG9UTT`) con cuenta atrás de 15 minutos. En la base:
   `held_count = 2`, orden en `pending`.
5. **Pago** en el simulador → el servidor firma un webhook y lo entrega a
   `/api/webhooks/pagos`, que responde 200.
6. **Resultado en la base:** orden `paid`; inventario 96 → **98 vendidas, 0 retenidas**;
   **2 entradas emitidas** con serie; **2 credenciales QR** con nonce y hash; pago `paid`
   por 14980; comisión registrada (bruto 14980, GETIN 980, local 14000); webhook con
   `signature_valid = true` y `processed = true`.
7. **`/cuenta/entradas`** muestra los dos tickets digitales con su QR dibujado.
8. **Puerta:** login como `puerta@demo.getin.pe`, pegado el código en `/puerta` →
   **INGRESO AUTORIZADO**, con serie y titular.
9. **El mismo código otra vez** → **NO VÁLIDA · «Ya utilizada 11:06»**.
10. **Código con la firma manipulada** → **NO VÁLIDA · «Código no emitido por GETIN»**
    (rechazado por HMAC, sin llegar a consultar la base).

Esto cierra el riesgo que quedaba abierto: las consultas con relaciones anidadas de
PostgREST funcionan, y el camino pago → QR → ingreso es real.

### Resto de flujos de la fase 1, recorridos en el navegador

| Flujo | Resultado |
| --- | --- |
| **Reserva de mesa VIP** | Mesa 1 retenida → adelanto S/ 200 + 7% = S/ 214 → pagada → mesa `reserved`, reserva `confirmed` con su QR. En «Mis mesas»: **total S/ 600 · adelanto S/ 200 · saldo en el local S/ 400**. |
| **Lista de invitados (aprobación manual)** | Solicitud con 2 acompañantes → queda `pending` → el local la confirma desde su panel → `confirmed` y el cupo de la lista pasa de 12 a **15** (titular + 2). Queda en auditoría. |
| **Crear y publicar evento** | Creado como **borrador** con la hora correcta de Lima. Publicarlo sin entradas **se rechaza** («no se puede publicar hasta que tenga al menos una activa»); con un tipo de entrada creado, se publica y **aparece en el explorador y en su propia página**. |
| **Aprobar un local** | «Terraza Pacífico» en revisión → aprobado desde `/admin` → `approved`, verificado, expediente cerrado, auditoría escrita y **visible en el catálogo público**. |
| **Exportación CSV** | 200 con la cabecera correcta para un evento propio; **403 para un evento de otro local**. |

### Consultas hostiles contra RLS

`supabase/tests/rls.sh` ataca la API real con el token de cada rol. Las 15 pasan:

- Un cliente ve **solo su perfil**, sus órdenes y sus entradas; cero ajenas.
- Una discoteca **no puede listar los perfiles** de sus compradores ni ver órdenes de otro
  local.
- **Nadie crea una orden desde el navegador** (no hay política de `INSERT`), así que no se
  puede fijar el precio a mano.
- El personal de puerta **no puede leer `qr_credentials`**: valida por RPC, sin ver el nonce.
- La API pública **no expone borradores ni locales sin aprobar**.
- Un cliente **no puede ascenderse a superadministrador**; el rol sigue siendo `client`.
- Una discoteca **no puede bajarse su propia comisión**.
- Auditoría y webhooks solo para GETIN.

---

## Fallos encontrados y corregidos al ejecutar

Cuatro cosas que solo aparecieron al ejecutarlo de verdad:

1. **`orders` tenía una restricción imposible.** El `CHECK` exigía
   `total = subtotal + cargo + IGV`, pero el IGV va *contenido* en el precio del local, no
   sumado aparte: toda inserción de orden habría fallado. Corregido a
   `total = subtotal + cargo`, con un `CHECK` adicional de que el IGV no supere el subtotal.
2. **El login era imposible con los usuarios del seed.** GoTrue lee
   `confirmation_token` y compañía como `string`, no como puntero, así que un `NULL`
   reventaba con *«converting NULL to string is unsupported»*. Ahora se siembran como
   cadena vacía.
3. **Reinscribirse en una lista de invitados inflaba el cupo.** El `ON CONFLICT DO UPDATE`
   conservaba el estado `confirmed` y volvía a sumar plazas en cada envío, hasta cerrar la
   lista. Reescrito para ajustar por la *diferencia* de acompañantes.
4. **Las horas de los eventos salían cinco horas antes.** El seed guardaba horas locales
   como si fueran UTC, así que una fiesta de las 23:00 se mostraba «6:00 p. m.». Corregido
   en el seed (con ayudantes de zona horaria) y en el catálogo demo (Perú es siempre
   UTC-5).
5. **La reserva de mesa decía al cliente que no debía nada.** `getin_confirm_order`
   guardaba como total de la mesa el importe del concepto, que es solo el adelanto: la
   pantalla mostraba «total S/ 200 · saldo en el local S/ 0» cuando la mesa costaba S/ 600
   y quedaban S/ 400 por pagar en la puerta. Eso acaba en una discusión con el cliente.
   Ahora se guardan las tres cifras por separado: precio de la mesa, adelanto cobrado y
   saldo pendiente.
6. **«Mesa Mesa 1 (adelanto)».** El servidor anteponía «Mesa» a una etiqueta que ya la
   traía. Cosmético, pero sale impreso en el resumen del pedido.

También hubo dos ajustes de entorno: `config.toml` usaba `[inbucket]`, renombrado a
`[local_smtp]` en la CLI 3.x, y el seed necesita `search_path` con `extensions` porque ahí
vive `pgcrypto`.

---

## Escrito pero NO verificado

### Pagos

- **No hay ninguna pasarela real conectada.** No se puede cobrar dinero.
- El adaptador de Culqi está escrito **y no probado contra su API**. Faltan el formulario
  con `culqi.js`, la ruta `/checkout/[orderId]/pago` (no existe) y confirmar el formato de
  firma del webhook. Lista completa en [`PAGOS.md`](PAGOS.md).

### Lo que sigue sin recorrerse

- **Escaneo del QR de una mesa** en la puerta (el de una entrada sí está probado, y la
  función es la misma).
- **Rechazar** una solicitud de lista o un local (solo se ha probado el camino de aprobar).
- **Reembolsos** de punta a punta: se solicitan y se deciden, pero la devolución efectiva
  depende del proveedor de pagos.
- **Registro de un local nuevo** desde `/club/registro` por un usuario sin local.

---

## Implementado

### Fase 1 (MVP) — completa

- [x] Next 15 + TypeScript estricto + Tailwind
- [x] Identidad visual y primitivos de UI
- [x] Portada con todas las secciones pedidas
- [x] Catálogo de discotecas y explorador con filtros y ordenación
- [x] Páginas de detalle de evento y de local
- [x] Autenticación con roles y guards de servidor
- [x] Base de datos: 26 tablas, funciones atómicas, RLS, Storage
- [x] Panel de discoteca: resumen, eventos, entradas, asistentes, CSV
- [x] Entradas con control de aforo y retención temporal
- [x] Checkout con desglose, cuenta atrás y adaptador de pruebas
- [x] Órdenes y confirmación por webhook firmado e idempotente
- [x] QR firmado y validación de puerta
- [x] Dashboard del cliente
- [x] Panel GETIN: aprobaciones, comisiones, reembolsos, auditoría
- [x] 92 pruebas de dominio + 2 suites de base de datos
- [x] Páginas legales como borradores marcados
- [x] Modo demostración etiquetado
- [x] Mobile-first, PWA instalable

### Fase 2 — parcialmente adelantada

- [x] Mesas VIP (esquema, retención atómica, checkout, QR, panel del cliente)
- [x] Listas de invitados (esquema, inscripción atómica, aprobación)
- [ ] Subida de imágenes a Storage *(hoy se pega una URL)*
- [ ] Edición de eventos ya creados
- [ ] Reembolsos de punta a punta *(se solicitan y deciden; no se ejecuta la devolución)*
- [ ] Liquidaciones y conciliación *(tablas listas, sin interfaz)*
- [ ] Correos transaccionales *(tabla `notifications` lista, sin envío)*
- [ ] Gestión de personal de puerta desde el panel
- [ ] Tickets de soporte en la plataforma

### Fase 3 — no empezada

Mapa interactivo de mesas, reservas grupales, división de pagos, recomendaciones,
notificaciones push y WhatsApp, fidelización, app nativa.

---

## Deuda técnica consciente

1. **Tipos de la base escritos a mano.** Falta `npx supabase gen types typescript --local >
   src/types/database.ts` y tipar los clientes.
2. **El cron de vencimientos no está programado.** `getin_expire_stale_orders()` existe y
   nadie la llama. Entre medias, el inventario abandonado se libera cuando otra persona
   intenta comprar ese mismo tipo de entrada.
3. **Re-sellado de credenciales QR en dos pasos.** `getin_confirm_order` recibe nonces con
   un id provisional y `resealCredentials()` los vuelve a sellar con el id real. Funciona
   (verificado), pero son dos pasos donde podría haber uno.
4. **Edición de perfil** no implementada.
5. **Sin CSP.** Ver [`SEGURIDAD.md`](SEGURIDAD.md).
6. **El logo es provisional** (texto + CSS). Aislado en `src/components/brand/logo.tsx`.

---

## Siguiente paso recomendado

1. Generar los tipos de la base (`supabase gen types`) y tiparlos en la capa de datos.
2. Programar el cron de vencimientos de órdenes.
3. Subida de imágenes a Storage y edición de eventos ya creados.
4. Correos transaccionales (la tabla `notifications` ya está).
5. Revisión legal de los tres borradores.
6. Cuando haya decisión comercial: pasarela de pagos, siguiendo la lista de
   [`PAGOS.md`](PAGOS.md). **Hasta entonces, el modo de pruebas se queda como está.**
