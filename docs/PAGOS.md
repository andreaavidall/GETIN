# Pagos

## Estado actual, sin rodeos

- **No hay ninguna pasarela real conectada.** No se puede cobrar dinero.
- El proveedor activo por defecto es `test`: un **simulador local** que no mueve dinero.
- El adaptador de Culqi está escrito pero **no verificado contra la API real**: no tengo
  credenciales ni puedo probarlo. Los puntos que hay que confirmar con la documentación
  vigente de Culqi están marcados con `TODO(culqi)` en el código.

Nada en la interfaz dice que los pagos estén operativos: el checkout muestra el proveedor
activo y una advertencia cuando no es real.

---

## Por qué Culqi y no Stripe

Stripe no procesa pagos con entidades peruanas. Las opciones reales en Perú son:

| Proveedor | Nota |
| --- | --- |
| **Culqi** | Integración directa por token de tarjeta, soporte de Yape, documentación clara. Es la opción por defecto del adaptador escrito. |
| **Niubiz** (ex VisaNet) | Mayor cobertura bancaria, integración más pesada. |
| **Izipay** | Buenas tarifas, enfoque en comercio presencial. |
| **Mercado Pago** | Cobertura regional, checkout hospedado, comisiones más altas. |

La decisión es comercial (tarifas, plazos de liquidación, soporte), no técnica. Por eso la
aplicación habla con un **puerto** y no con una pasarela concreta.

---

## El puerto

`src/lib/payments/types.ts` define `PaymentProvider`:

```ts
interface PaymentProvider {
  readonly name: string;
  readonly isLive: boolean;      // ¿puede cobrar de verdad?
  readonly statusNote: string;   // qué se le dice al usuario

  createIntent(request): Promise<PaymentIntent>;
  verifyWebhook(rawBody, headers): Promise<WebhookVerification>;
  refund(request): Promise<RefundResult>;
}
```

Reglas que todo adaptador debe cumplir:

1. **Nunca** almacenar el número completo de la tarjeta ni el CVV. El dato sensible va del
   navegador a la pasarela y vuelve como token.
2. Una orden se da por pagada **solo** cuando lo confirma el proveedor por webhook firmado
   (o consulta directa a su API). Nunca por una redirección del navegador.
3. `verifyWebhook` valida la firma **antes** de interpretar el cuerpo.
4. `providerEventId` es la clave de idempotencia: los reintentos son normales.

---

## El adaptador de pruebas

`PAYMENTS_PROVIDER=test` (valor por defecto).

Recorre el ciclo completo igual que una pasarela real:

```
startPaymentAction
   └─ createIntent → /checkout/simulador?pago=...&orden=...
          │
       el usuario elige: aprobado / rechazado / pendiente
          │
       POST /api/checkout/simular   (firma con PAYMENTS_TEST_WEBHOOK_SECRET)
          │
       POST /api/webhooks/pagos     ◄── el MISMO endpoint de producción
          ├─ verifica la firma HMAC
          ├─ registra el evento (idempotencia)
          └─ getin_confirm_order → entradas + QR
```

Esto es deliberado: el camino de confirmación que se prueba en desarrollo es exactamente
el que confirmará los pagos reales. Si el webhook se rompe, se nota en local.

El simulador exige sesión y comprueba que la orden sea del usuario: no sirve para confirmar
la orden de otra persona. Con un proveedor real, esa ruta responde 404.

---

## Activar Culqi

### 1. Cuenta y credenciales

Regístrate en [culqi.com](https://culqi.com), completa la verificación del negocio (RUC,
cuenta bancaria, representante legal) y obtén:

- `pk_test_...` / `pk_live_...` → clave pública (va al navegador)
- `sk_test_...` / `sk_live_...` → clave secreta (**solo servidor**)
- el secreto del webhook

### 2. Variables

```bash
PAYMENTS_PROVIDER=culqi
CULQI_PUBLIC_KEY=pk_test_xxx
CULQI_SECRET_KEY=sk_test_xxx
CULQI_WEBHOOK_SECRET=xxx
```

### 3. Lo que falta por implementar

El adaptador tiene la estructura, pero **antes de cobrar un sol hay que**:

- [ ] Confirmar el formato de firma del webhook y el nombre de la cabecera con la
      documentación vigente. Está marcado `TODO(culqi)` en `culqi-provider.ts`.
- [ ] Confirmar el nombre de la cabecera de idempotencia de la API.
- [ ] Hacer que el webhook de Culqi traiga el `order_id` en `metadata` (se envía al crear
      el cargo, pero hay que verificar que vuelve en el evento).
- [ ] Montar el formulario con `culqi.js` en el navegador para tokenizar la tarjeta, y la
      ruta que llama a `createCharge` con ese token. La página
      `/checkout/[orderId]/pago` a la que apunta `createIntent` **no existe todavía**.
- [ ] Registrar la URL del webhook en el panel de Culqi:
      `https://<tu-dominio>/api/webhooks/pagos`
- [ ] Probar con las tarjetas de prueba de Culqi **en modo `sk_test`**, recorriendo:
      aprobado, rechazado, importe distinto, webhook repetido, webhook con firma inválida.
- [ ] Revisar la conciliación: comparar lo que informa Culqi con la tabla `payments`.

Mientras falte algo de esta lista, deja `PAYMENTS_PROVIDER=test`.

---

## Añadir otro proveedor

1. Crea `src/lib/payments/<proveedor>-provider.ts` implementando `PaymentProvider`.
2. Regístralo en la fábrica de `src/lib/payments/index.ts`.
3. Añade su valor al enum `PAYMENTS_PROVIDER` en `src/lib/env.ts`.

No hay que tocar el checkout, ni el webhook, ni la base de datos.

---

## Qué NO hace la plataforma

- **No divide el dinero automáticamente** entre GETIN y la discoteca. Eso depende de que
  el proveedor ofrezca split payments y del acuerdo comercial. Lo que sí hace es registrar
  el desglose de cada operación (`commissions`) y preparar la liquidación (`settlements`).
- **No guarda tarjetas** para pagos recurrentes.
- **No emite comprobantes de pago electrónicos** (boleta/factura SUNAT). El responsable
  tributario de la venta es el establecimiento. Si GETIN debe emitir comprobante por su
  comisión, hay que integrar un proveedor de facturación electrónica.

---

## Seguridad del webhook

`src/app/api/webhooks/pagos/route.ts`:

- Lee el cuerpo **en crudo** (la firma se calcula sobre los bytes exactos).
- Firma inválida → `401` y queda registrado el intento en la auditoría.
- Cada evento se guarda con `UNIQUE (provider, provider_event_id)`: un reintento devuelve
  `200 {duplicate: true}` sin reprocesar.
- Compara el importe informado por el proveedor con el importe cobrado; si no cuadra, no
  confirma.
- Si falla al procesar, responde `500` y deja el evento sin procesar con el error, para que
  el proveedor reintente.
- Está excluido del `matcher` del middleware: se autentica por firma, no por cookie.
