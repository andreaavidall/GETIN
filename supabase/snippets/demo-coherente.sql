-- ===========================================================================
-- Coherencia del catálogo de demostración
--
-- Dos cosas que una auditoría encontró y que son de DATOS, no de código:
--
--  1. Los contadores estaban inventados. `ticket_types.sold_count` decía 99 o
--     119 cuando en la base había tres entradas de verdad. El panel del local
--     cuenta entradas reales y el catálogo lee el contador, así que las dos
--     cifras no cuadraban y no se podía comprobar nada. Aquí se igualan a la
--     realidad y el aforo baja para que la escasez siga siendo visible.
--
--  2. Sin un evento publicado en las próximas 24 horas, /puerta no permite
--     demostrar un ingreso válido. Se añade uno para esta noche, etiquetado
--     como lo que es.
--
-- Se puede ejecutar las veces que haga falta.
-- ===========================================================================

-- Helper de fechas del seed, por si la base se creó con el esquema completo.
create or replace function getin_seed_lima(p_days integer, p_time text) returns timestamptz
language sql stable as $$
  select (((now() at time zone 'America/Lima')::date + p_days) + p_time::time)
         at time zone 'America/Lima';
$$;

-- 1. Contadores = realidad -------------------------------------------------
update ticket_types tt
   set sold_count = r.reales,
       held_count = 0,
       capacity = greatest(r.reales + 12, 20)
  from (
    select tt2.id,
           (select count(*) from tickets t
             where t.ticket_type_id = tt2.id and t.status in ('issued','used'))::int as reales
      from ticket_types tt2
  ) r
 where r.id = tt.id;

-- Un tipo casi agotado, para que "Quedan 3" siga siendo demostrable y cierto.
update ticket_types tt
   set capacity = tt.sold_count + 3
  from events e
 where e.id = tt.event_id
   and e.slug = 'nocturna-saturday-house'
   and tt.name = 'VIP';

-- 2. Evento de esta noche, para el control de puerta -----------------------
insert into events (
  venue_id, slug, name, tagline, description,
  cover_url, starts_at, ends_at, doors_open_at, last_entry_at,
  min_age, music_genres, entry_rules, cancellation_policy,
  status, is_demo, published_at
)
select v.id,
       'nocturna-prueba-de-puerta',
       'Prueba de puerta (demo)',
       'Evento de demostración para probar el escaneo de entradas',
       'Existe para que cualquiera pueda comprar una entrada, escanearla en /puerta y comprobar que el segundo intento se rechaza. No es una fiesta real.',
       'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=1600&q=70',
       getin_seed_lima(0, '22:00'),
       getin_seed_lima(1, '04:00'),
       getin_seed_lima(0, '21:00'),
       getin_seed_lima(1, '02:00'),
       18,
       array['House'],
       'Evento de demostración: no hay fiesta. Sirve para probar el control de puerta.',
       'Al ser un evento de demostración no se cobra nada y no hay reembolsos que tramitar.',
       'published', true, now()
from venues v
where v.slug = 'nocturna-barranco'
  and not exists (select 1 from events e where e.slug = 'nocturna-prueba-de-puerta');

insert into ticket_types (
  event_id, name, description, price_cents, capacity, max_per_order,
  conditions, includes, position
)
select e.id, 'General', 'Entrada de prueba para el control de puerta.',
       1000, 50, 4,
       'Entrada de demostración. El pago es simulado y no se cobra nada.',
       array['Ingreso de prueba'], 0
from events e
where e.slug = 'nocturna-prueba-de-puerta'
  and not exists (select 1 from ticket_types tt where tt.event_id = e.id);

-- Si el evento ya existía de un día anterior, se recoloca a esta noche: la
-- gracia es que /puerta siempre tenga algo en las próximas 24 horas.
update events
   set starts_at = getin_seed_lima(0, '22:00'),
       ends_at = getin_seed_lima(1, '04:00'),
       doors_open_at = getin_seed_lima(0, '21:00'),
       last_entry_at = getin_seed_lima(1, '02:00')
 where slug = 'nocturna-prueba-de-puerta';
