# GETIN

**GET IN. GO OUT.** — Plataforma de discotecas, eventos y reservas para Lima, Perú.

Descubrir fiestas, comprar entradas, reservar mesas VIP, apuntarse a listas de invitados y
entrar con un código QR, sin depender de promotores informales.

---

## Puesta en marcha

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>. **Funciona sin configurar nada**: arranca en *modo
demostración* con un catálogo ficticio (claramente etiquetado) para que puedas recorrer la
interfaz. En ese modo no hay cuentas ni compras.

### Para operar con datos reales (local, con Docker)

```bash
npx supabase start      # levanta Postgres, Auth, Storage y Studio
npx supabase status     # imprime las claves locales
```

Copia `.env.example` a `.env.local` y completa:

- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con lo que imprime
  `supabase status` (`API_URL` y `ANON_KEY`).
- `SUPABASE_SERVICE_ROLE_KEY` con `SERVICE_ROLE_KEY` (solo servidor; nunca con prefijo
  `NEXT_PUBLIC_`).
- `QR_TOKEN_SECRET` y `PAYMENTS_TEST_WEBHOOK_SECRET` con valores aleatorios:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  ```
- `NEXT_PUBLIC_DATA_MODE=live`

Después, `npm run dev`. El esquema y el seed se aplican solos al arrancar; para recargarlos:
`npx supabase db reset`.

### Para un proyecto alojado

Con la CLI (mantiene el historial de migraciones):

```bash
npx supabase login
npx supabase link --project-ref TU_REF
npx supabase db push
```

**Sin la CLI**, si prefieres no manejar la contraseña de la base: abre tu proyecto en
supabase.com → **SQL Editor** → *New query*, pega entero
[`supabase/esquema-completo.sql`](supabase/esquema-completo.sql) y ejecútalo. Es la
concatenación en orden de las cuatro migraciones: crea las 28 tablas y las 15 funciones, y
activa RLS en todas. Ejecútalo una sola vez sobre un proyecto nuevo.

Si además quieres el catálogo de ejemplo, pega después `supabase/seed.sql`. Ten en cuenta que
crea usuarios de prueba con contraseña conocida (`demo1234`): **no lo cargues en un proyecto
que vaya a ser público de verdad**.

Luego pon las claves de tu proyecto en `.env.local` (o en las variables de entorno de Vercel)
en lugar de las locales.

### Usuarios de prueba (solo con el seed local)

Contraseña de todos: `demo1234`

| Correo | Rol |
| --- | --- |
| `cliente@demo.getin.pe` | Cliente |
| `club@demo.getin.pe` | Administrador de discoteca |
| `puerta@demo.getin.pe` | Personal de puerta |
| `admin@demo.getin.pe` | Superadministrador GETIN |

---

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Pruebas unitarias del dominio (Vitest) |
| `npm run lint` | ESLint |

Pruebas de base de datos (con `npx supabase start` corriendo):

```powershell
docker cp supabase/tests/atomicidad.sql supabase_db_getin:/tmp/atomicidad.sql; docker exec supabase_db_getin psql -U postgres -v ON_ERROR_STOP=1 -f /tmp/atomicidad.sql
```

```powershell
bash supabase/tests/concurrencia.sh
```

```powershell
bash supabase/tests/rls.sh
```

- **atomicidad** — 15 invariantes: sobreventa, idempotencia del webhook, QR de un solo uso,
  mesas que no se duplican.
- **concurrencia** — dos sesiones reales peleando por la última entrada; solo una se la
  lleva.
- **rls** — 15 consultas hostiles contra la API real con el token de cada rol: un cliente
  no ve órdenes ajenas, una discoteca no ve nada de otra, nadie crea una orden desde el
  navegador ni se asciende a superadministrador.

---

## Estructura

```
src/
├─ app/                        Rutas (App Router)
│  ├─ page.tsx                 Portada
│  ├─ eventos/                 Explorador + detalle de evento
│  ├─ discotecas/              Catálogo + ficha de local
│  ├─ checkout/                Resumen, pago, resultado, simulador
│  ├─ cuenta/                  Panel del cliente (entradas, mesas, listas, compras)
│  ├─ club/                    Panel de discoteca + solicitud de alta
│  ├─ admin/                   Panel GETIN (aprobaciones, comisiones, auditoría)
│  ├─ puerta/                  Escáner de QR
│  ├─ legal/                   Términos, privacidad, reembolsos
│  └─ api/                     Webhook de pagos, validación de QR, CSV
├─ components/
│  ├─ ui/                      Primitivos (estilo shadcn/ui, paleta GETIN)
│  ├─ brand/                   Logotipo
│  ├─ layout/                  Navbar, footer, pestañas
│  ├─ catalog/                 Tarjetas, buscador, filtros
│  ├─ checkout/                Selector de entradas, mesas, listas
│  ├─ club/ · admin/ · door/   Paneles por rol
│  └─ tickets/                 Ticket digital con QR
├─ lib/
│  ├─ domain/                  Lógica pura y probada: precios, disponibilidad,
│  │                           permisos, QR, filtros
│  ├─ orders/ · payments/      Servicios de servidor (dinero e inventario)
│  ├─ data/                    Lecturas del catálogo y de la cuenta
│  ├─ actions/                 Server actions por área
│  ├─ auth/                    Sesión y guards
│  ├─ supabase/                Clientes (anónimo con RLS y service role)
│  └─ validation/              Esquemas Zod compartidos
└─ types/                      Modelos de vista

supabase/
├─ migrations/                 Esquema, funciones atómicas, RLS, Storage
├─ seed.sql                    Datos de demostración (ficticios)
└─ tests/atomicidad.sql        Pruebas de sobreventa y doble ingreso

docs/
├─ ARQUITECTURA.md             Decisiones y diseño
├─ PAGOS.md                    Cómo activar una pasarela real
├─ SEGURIDAD.md                Modelo de amenazas y controles
└─ ESTADO.md                   Qué funciona y qué falta, sin adornos
```

---

## Las tres reglas que sostienen el producto

1. **El inventario lo decide Postgres, no JavaScript.** Retener entradas o una mesa pasa
   por funciones con bloqueo de fila (`getin_hold_tickets`, `getin_hold_table`). Si dos
   personas piden la última entrada a la vez, una recibe `SOLD_OUT`.
2. **Una orden se paga solo cuando lo confirma el proveedor.** El QR nace en
   `getin_confirm_order`, llamada únicamente desde el webhook con firma válida. Volver a
   una página de éxito no confirma nada.
3. **Los permisos se comprueban tres veces:** en el guard del servidor, dentro de la
   función de Postgres y por Row Level Security. Ocultar un botón no es seguridad.

---

## Estado

Lee [`docs/ESTADO.md`](docs/ESTADO.md) antes de dar nada por operativo. Resumen honesto:

- **Verificado ejecutándolo:** 92 pruebas de dominio, 15 invariantes de base de datos, la
  concurrencia con dos sesiones, 15 consultas hostiles de RLS, y **todos los flujos de la
  fase 1 recorridos en el navegador**: compra de entradas, reserva de mesa VIP, lista de
  invitados con aprobación del local, creación y publicación de un evento, aprobación de un
  local, exportación CSV y control de puerta (autorizado, repetido y falsificado).
- **No verificado:** no hay **ninguna pasarela de pago real conectada**. Los pagos usan el
  adaptador de pruebas; el de Culqi está escrito pero sin probar contra su API, y así se
  queda por ahora.

---

## Aviso

Plataforma para mayores de 18 años. Los textos legales son **borradores** pendientes de
revisión por un abogado peruano. Los datos del modo demostración son ficticios y están
etiquetados como tales.
