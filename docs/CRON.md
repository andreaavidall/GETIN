# Publicación programada

Un local puede dejar un evento en borrador con fecha de salida
(`events.publish_at`). Quien lo publica de verdad no es el navegador: es la
función `getin_publish_scheduled()`, que corre en la base con la clave de
servicio.

El endpoint que la llama es `GET /api/cron/publicar`.

## Qué hay configurado

`vercel.json` declara el cron:

```json
{ "path": "/api/cron/publicar", "schedule": "0 17 * * *" }
```

`0 17 * * *` es **17:00 UTC = 12:00 de Lima**, una vez al día. Es la frecuencia
máxima que admite el plan Hobby de Vercel. Con un plan de pago puedes bajarlo a
cada hora cambiando esa línea por `"0 * * * *"`.

Mientras el barrido no corra, el evento **sigue en borrador**, y el panel del
local lo dice así en vez de dar por hecho que saldrá solo.

## Lo que falta hacer una vez, en Vercel

1. Project → Settings → Environment Variables.
2. Nueva variable `CRON_SECRET`, con un valor aleatorio largo. Para generarlo:

   ```powershell
   [Convert]::ToBase64String((1..32|%{Get-Random -Max 256}))
   ```

3. Marcarla para **Production** (y Preview si quieres probarla ahí).
4. Volver a desplegar para que el cron quede registrado.

Vercel manda la cabecera `Authorization: Bearer $CRON_SECRET` en cada ejecución.
Sin esa variable el endpoint responde **401 a todo el mundo**, incluido Vercel:
es deliberado, porque un endpoint que publica eventos no puede quedar abierto.

## Comprobarlo

```powershell
curl.exe -H "Authorization: Bearer $env:CRON_SECRET" https://TU-DOMINIO/api/cron/publicar
```

Responde `{"publicados": N}` con los eventos que salieron en esa pasada. Sin la
cabecera correcta: `{"error":"no autorizado"}` con código 401.

En el panel de Vercel, las ejecuciones se ven en Project → Cron Jobs.
