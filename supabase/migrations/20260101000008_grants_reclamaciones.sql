-- ===========================================================================
-- GETIN · 0008 · Cerrar lo que abrio la 0006
--
-- La migracion 0005 ya habia revocado el EXECUTE de todas las funciones de
-- trigger, porque exponerlas en /rest/v1/rpc no aporta nada. La 0006 anadio
-- una nueva, `guard_complaint_integrity`, DESPUES de esa limpieza: quedo
-- publicada. El linter de Supabase lo detecto y aqui se corrige.
--
-- Se aprovecha para quitar tambien `getin_expire_stale_orders` del alcance de
-- `authenticated`. Es un barrido de mantenimiento: lo ejecuta el servidor con
-- la clave de servicio, no el navegador. Que cualquier usuario con sesion
-- pudiera dispararlo no rompe nada (solo libera ordenes ya caducadas) pero no
-- hay razon para dejarlo al alcance de nadie.
-- ===========================================================================

revoke execute on function guard_complaint_integrity()
  from public, anon, authenticated;

revoke execute on function getin_expire_stale_orders()
  from public, anon, authenticated;
