-- ===========================================================================
-- GETIN · 0010 · ¿La mesa incluye el ingreso?
--
-- Es la primera pregunta de quien reserva una mesa para seis: "¿mis amigos
-- tienen que comprar entrada aparte?". Hasta ahora la ficha remitia a las
-- condiciones del local, que es correcto pero no responde. Esto lo responde.
--
-- Va en `venue_tables` porque es una politica del local sobre SU mesa, no de
-- un evento concreto. Si algun dia hace falta por evento, se añade el mismo
-- campo en `event_table_availability` y manda ese.
--
-- NULL significa "el local no lo ha indicado", y se muestra tal cual. Poner
-- 0 por defecto seria afirmar que no incluye ninguna entrada, que es una
-- afirmacion que nadie ha hecho.
-- ===========================================================================

alter table venue_tables
  add column includes_entry_for smallint
    check (includes_entry_for is null or includes_entry_for >= 0);

comment on column venue_tables.includes_entry_for is
  'Personas cuyo ingreso cubre la mesa. NULL = el local no lo ha indicado.';
