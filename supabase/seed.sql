-- ===========================================================================
-- GETIN · seed de DEMOSTRACION
--
-- TODO lo que hay aqui es FICTICIO. Los locales, eventos y fechas no existen:
-- is_demo = true en venues y events, y la interfaz muestra el aviso "DEMO" en
-- cada tarjeta. No usar este archivo en produccion.
--
-- Los usuarios de abajo son credenciales de PRUEBA para desarrollo local
-- (supabase start / supabase db reset). Contraseña de todos: demo1234
-- ===========================================================================

-- En Supabase pgcrypto vive en el esquema `extensions`, no en `public`:
-- sin esto, crypt() y gen_salt() no se resuelven al sembrar los usuarios.
set search_path = public, extensions;

-- --------------------------------------------------------------- usuarios ---
-- Solo para el entorno local de Supabase. En produccion los usuarios se crean
-- por el flujo normal de registro.
-- OJO con las columnas de token: GoTrue las lee como `string`, no como
-- `*string`, asi que un NULL rompe el login con
-- «converting NULL to string is unsupported». Tienen que ir como cadena vacia.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone_change, phone_change_token,
  reauthentication_token
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
   'authenticated', 'authenticated', 'cliente@demo.getin.pe',
   crypt('demo1234', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Camila Rojas"}', now(), now(),
   '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
   'authenticated', 'authenticated', 'club@demo.getin.pe',
   crypt('demo1234', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Diego Paredes"}', now(), now(),
   '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333',
   'authenticated', 'authenticated', 'puerta@demo.getin.pe',
   crypt('demo1234', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Luis Quispe"}', now(), now(),
   '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444',
   'authenticated', 'authenticated', 'admin@demo.getin.pe',
   crypt('demo1234', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Equipo GETIN"}', now(), now(),
   '', '', '', '', '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now()
from auth.users u
where u.email like '%@demo.getin.pe'
on conflict do nothing;

-- El trigger handle_new_user ya creo los profiles; ajustamos roles de demo.
update profiles set role = 'client',     full_name = 'Camila Rojas'
  where id = '11111111-1111-4111-8111-111111111111';
update profiles set role = 'club_admin', full_name = 'Diego Paredes'
  where id = '22222222-2222-4222-8222-222222222222';
update profiles set role = 'door_staff', full_name = 'Luis Quispe'
  where id = '33333333-3333-4333-8333-333333333333';
update profiles set role = 'superadmin', full_name = 'Equipo GETIN'
  where id = '44444444-4444-4444-8444-444444444444';

-- ---------------------------------------------------------------- locales ---
insert into venues (
  id, slug, name, legal_name, tax_id, description, district, address, lat, lng,
  phone, instagram, cover_url, capacity, min_age, dress_code, music_genres,
  status, is_verified, owner_id, is_demo, published_at
) values
  ('a0000000-0000-4000-8000-000000000001', 'nocturna-barranco', 'Nocturna Barranco',
   'Nocturna Entretenimiento SAC (demo)', '20600000001',
   'Casona republicana convertida en club de tres ambientes: pista principal, patio y sotano de techno.',
   'Barranco', 'Av. Grau 234, Barranco', -12.148500, -77.021900,
   '+51 999 000 001', '@nocturna.demo',
   'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=1600&q=70',
   850, 20, 'Casual elegante. No shorts ni sandalias.',
   array['House','Techno','Reggaeton'], 'approved', true,
   '22222222-2222-4222-8222-222222222222', true, now()),

  ('a0000000-0000-4000-8000-000000000002', 'vertigo-miraflores', 'Vértigo Miraflores',
   'Vértigo Rooftop SAC (demo)', '20600000002',
   'Rooftop con vista al malecón, coctelería de autor y sesiones de house hasta el amanecer.',
   'Miraflores', 'Calle Berlín 921, Miraflores', -12.124800, -77.030100,
   '+51 999 000 002', '@vertigo.demo',
   'https://images.unsplash.com/photo-1545128485-c400e7702796?w=1600&q=70',
   420, 21, 'Elegante. Prohibido el ingreso con mochilas.',
   array['House','Deep House','Disco'], 'approved', true,
   '22222222-2222-4222-8222-222222222222', true, now()),

  ('a0000000-0000-4000-8000-000000000003', 'club-fauna', 'Club Fauna',
   'Fauna Nightlife SAC (demo)', '20600000003',
   'Club de música latina y urbana en pleno San Isidro, con tres barras y zona VIP elevada.',
   'San Isidro', 'Av. Conquistadores 455, San Isidro', -12.097400, -77.038200,
   '+51 999 000 003', '@fauna.demo',
   'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1600&q=70',
   600, 18, 'Casual.',
   array['Reggaeton','Salsa','Urbano'], 'approved', true, null, true, now()),

  ('a0000000-0000-4000-8000-000000000004', 'subsuelo-lima', 'Subsuelo',
   'Subsuelo Audio SAC (demo)', '20600000004',
   'Sótano de 300 personas dedicado al techno y al drum and bass. Sonido Funktion-One.',
   'Surquillo', 'Av. Tomás Marsano 110, Surquillo', -12.113900, -77.012500,
   '+51 999 000 004', '@subsuelo.demo',
   'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=1600&q=70',
   300, 18, 'Libre.', array['Techno','Drum & Bass'], 'approved', false, null, true, now()),

  -- Local pendiente de aprobacion: aparece en /admin, no en el catalogo publico.
  ('a0000000-0000-4000-8000-000000000005', 'terraza-pacifico', 'Terraza Pacífico',
   'Pacífico Eventos SAC (demo)', '20600000005',
   'Propuesta de terraza frente al mar en Chorrillos. Expediente en revisión.',
   'Chorrillos', 'Malecón Grau 45, Chorrillos', -12.173000, -77.026000,
   '+51 999 000 005', '@pacifico.demo', null, 250, 18, 'Casual.',
   array['Pop','Reggaeton'], 'pending_review', false, null, true, null)
on conflict (id) do nothing;

insert into venue_staff (venue_id, user_id, role) values
  ('a0000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'owner'),
  ('a0000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'owner'),
  ('a0000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'door')
on conflict do nothing;

insert into venue_verifications (venue_id, status, notes, documents)
values ('a0000000-0000-4000-8000-000000000005', 'pending_review',
        'Ficha RUC y licencia de funcionamiento adjuntas (demo).',
        '[{"type":"ruc","path":"demo/ruc.pdf"},{"type":"licencia","path":"demo/licencia.pdf"}]')
on conflict do nothing;

-- ---------------------------------------------------------------- eventos ---
-- Fechas relativas a la instalacion: el catalogo siempre tiene contenido futuro.
--
-- OJO con la zona horaria: las horas de una discoteca son HORAS DE LIMA. Si se
-- escriben como `now() + interval '23 hours'` quedan guardadas en UTC y la
-- interfaz las muestra cinco horas antes (una fiesta "a las 6 p. m."). Estos
-- dos ayudantes construyen la hora local correcta y se eliminan al final.

create or replace function getin_seed_days_to(p_dow integer) returns integer
language sql stable as $$
  -- Dias que faltan hasta el proximo p_dow (0=domingo .. 6=sabado). Nunca 0.
  select case when d = 0 then 7 else d end
  from (
    select ((p_dow - extract(dow from (now() at time zone 'America/Lima'))::int) + 7) % 7 as d
  ) s;
$$;

create or replace function getin_seed_lima(p_days integer, p_time text) returns timestamptz
language sql stable as $$
  -- "Dentro de p_days dias, a las p_time, hora de Lima".
  select (((now() at time zone 'America/Lima')::date + p_days) + p_time::time)
         at time zone 'America/Lima';
$$;
insert into events (
  id, venue_id, slug, name, tagline, description, cover_url,
  starts_at, ends_at, doors_open_at, last_entry_at, min_age, music_genres, lineup,
  entry_rules, cancellation_policy, status, is_demo, published_at
) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'nocturna-saturday-house', 'Saturday House',
   'La fiesta de casa de Nocturna, cada sábado',
   'Tres ambientes, dos pistas y la terraza abierta hasta el cierre. House melódico en la pista principal y selección urbana en el patio.',
   'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1600&q=70',
   getin_seed_lima(getin_seed_days_to(6), '23:00'),
   getin_seed_lima(getin_seed_days_to(6) + 1, '06:00'),
   getin_seed_lima(getin_seed_days_to(6), '22:00'),
   getin_seed_lima(getin_seed_days_to(6) + 1, '03:00'),
   20, array['House','Reggaeton'],
   '[{"name":"DJ Mara","role":"Headliner","start":"01:00"},{"name":"Bruno Sas","role":"Opening","start":"23:00"}]',
   'Documento de identidad obligatorio. Reservamos el derecho de admisión según el aforo autorizado.',
   'Cancelación con reembolso completo hasta 48 horas antes del evento. Después de ese plazo no hay devolución.',
   'published', true, now()),

  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
   'vertigo-sunset-rooftop', 'Sunset Rooftop',
   'Atardecer con vista al malecón',
   'Sesión de deep house desde las 7 p.m. con la puesta de sol de Miraflores de fondo. Coctelería de autor y cena ligera disponible.',
   'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=1600&q=70',
   getin_seed_lima(getin_seed_days_to(5), '19:00'),
   getin_seed_lima(getin_seed_days_to(5) + 1, '02:00'),
   getin_seed_lima(getin_seed_days_to(5), '18:30'),
   getin_seed_lima(getin_seed_days_to(5) + 1, '00:00'),
   21, array['Deep House','Disco'],
   '[{"name":"Lucia Vela","role":"Live set","start":"20:00"}]',
   'Aforo limitado. Ingreso solo con entrada o reserva confirmada.',
   'Reembolso del 50% hasta 24 horas antes. Las mesas no son reembolsables.',
   'published', true, now()),

  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003',
   'fauna-noche-latina', 'Noche Latina',
   'Salsa, timba y urbano hasta el cierre',
   'Orquesta en vivo a medianoche y DJ urbano después. La noche más concurrida de San Isidro.',
   'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1600&q=70',
   getin_seed_lima(10, '22:00'), getin_seed_lima(11, '05:00'),
   getin_seed_lima(10, '21:00'), getin_seed_lima(11, '02:00'),
   18, array['Salsa','Reggaeton','Urbano'],
   '[{"name":"Orquesta Fauna","role":"En vivo","start":"00:00"},{"name":"DJ Keko","role":"Cierre","start":"01:30"}]',
   'Mayores de 18 con DNI o carné de extranjería.',
   'Reembolso completo hasta 72 horas antes.',
   'published', true, now()),

  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004',
   'subsuelo-techno-session', 'Techno Session 014',
   'Seis horas de techno continuo',
   'Sótano, luces mínimas y sonido Funktion-One. Entrada por aforo estricto de 300 personas.',
   'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=1600&q=70',
   getin_seed_lima(17, '23:30'), getin_seed_lima(18, '06:00'),
   getin_seed_lima(17, '23:00'), getin_seed_lima(18, '02:00'),
   18, array['Techno'],
   '[{"name":"Nerea K","role":"Headliner","start":"02:00"}]',
   'Sin reingreso. Guardarropa obligatorio para mochilas.',
   'Entradas no reembolsables salvo cancelación del evento.',
   'published', true, now()),

  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001',
   'nocturna-aniversario', 'Aniversario Nocturna · 7 años',
   'Line-up completo y capacidad ampliada',
   'Edición aniversario con los tres ambientes conectados y invitados internacionales.',
   'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1600&q=70',
   getin_seed_lima(31, '23:00'), getin_seed_lima(32, '07:00'),
   getin_seed_lima(31, '22:00'), getin_seed_lima(32, '03:00'),
   20, array['House','Techno'],
   '[{"name":"Invitado internacional","role":"Headliner","start":"02:00"}]',
   'Documento obligatorio.', 'Reembolso completo hasta 7 días antes.',
   'published', true, now())
on conflict (id) do nothing;

-- --------------------------------------------------------------- entradas ---
insert into ticket_types (
  event_id, name, description, price_cents, capacity, sold_count,
  max_per_order, sales_start_at, sales_end_at, conditions, position
) values
  -- Saturday House
  ('b0000000-0000-4000-8000-000000000001', 'Preventa', 'Cupo limitado, primera tanda.',
   4500, 150, 118, 4, now() - interval '10 days', now() + interval '4 days',
   'Válida solo hasta las 00:30. No incluye consumo.', 0),
  ('b0000000-0000-4000-8000-000000000001', 'General', 'Ingreso a los tres ambientes.',
   7000, 400, 96, 6, now() - interval '10 days', null, 'No incluye consumo.', 1),
  ('b0000000-0000-4000-8000-000000000001', 'VIP', 'Zona elevada y barra exclusiva.',
   15000, 60, 12, 4, now() - interval '10 days', null,
   'Incluye un trago de bienvenida. No garantiza asiento.', 2),

  -- Sunset Rooftop
  ('b0000000-0000-4000-8000-000000000002', 'Early Bird', 'Ingreso antes de las 20:00.',
   3500, 80, 80, 2, now() - interval '14 days', now() + interval '3 days',
   'Agotada. Ingreso hasta las 20:00.', 0),
  ('b0000000-0000-4000-8000-000000000002', 'General', 'Ingreso general al rooftop.',
   6000, 200, 54, 6, now() - interval '14 days', null, 'Aforo limitado.', 1),

  -- Noche Latina
  ('b0000000-0000-4000-8000-000000000003', 'General', 'Ingreso general.',
   3000, 350, 140, 8, now() - interval '5 days', null, 'No incluye consumo.', 0),
  ('b0000000-0000-4000-8000-000000000003', 'Preventa pareja', 'Dos ingresos.',
   5000, 100, 31, 2, now() - interval '5 days', now() + interval '8 days',
   'Equivale a dos personas. Ingreso conjunto.', 1),

  -- Techno Session
  ('b0000000-0000-4000-8000-000000000004', 'Preventa 1', 'Primera tanda.',
   5000, 100, 100, 4, now() - interval '20 days', now() - interval '2 days',
   'Agotada.', 0),
  ('b0000000-0000-4000-8000-000000000004', 'Preventa 2', 'Segunda tanda.',
   6500, 120, 44, 4, now() - interval '2 days', null, 'Sin reingreso.', 1),

  -- Aniversario
  ('b0000000-0000-4000-8000-000000000005', 'Early Bird', 'Precio de lanzamiento.',
   8000, 200, 23, 4, now() - interval '1 day', now() + interval '14 days',
   'Cupo limitado.', 0),
  ('b0000000-0000-4000-8000-000000000005', 'General', 'Ingreso general.',
   12000, 500, 0, 6, now() + interval '14 days', null, 'No incluye consumo.', 1)
on conflict do nothing;

-- -------------------------------------------------------------- mesas VIP ---
insert into venue_tables (id, venue_id, label, zone, capacity,
  default_price_cents, default_min_consumption_cents, position_x, position_y) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Mesa 1', 'Zona VIP', 6, 60000, 40000, 20, 30),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'Mesa 2', 'Zona VIP', 6, 60000, 40000, 35, 30),
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'Box A', 'Balcón', 10, 120000, 90000, 60, 15),
  ('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002',
   'Lounge 1', 'Terraza', 8, 90000, 70000, 25, 20),
  ('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002',
   'Lounge 2', 'Terraza', 8, 90000, 70000, 45, 20),
  ('c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000003',
   'Mesa 10', 'Pista', 4, 45000, 30000, 30, 50)
on conflict (id) do nothing;

insert into event_table_availability (
  event_id, venue_table_id, state, price_cents, min_consumption_cents, deposit_cents, conditions
) values
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'available', 60000, 40000, 20000,
   'El adelanto no es reembolsable. El consumo mínimo se abona en el local.'),
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
   'reserved', 60000, 40000, 20000, 'Reservada (demo).'),
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003',
   'available', 120000, 90000, 40000,
   'Ingreso preferente hasta la 01:00. El adelanto no es reembolsable.'),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000004',
   'available', 90000, 70000, 30000, 'Incluye servicio de mozo.'),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000005',
   'blocked', 90000, 70000, 30000, 'Bloqueada por el local (demo).'),
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000006',
   'available', 45000, 30000, 15000, 'Hasta 4 personas.')
on conflict do nothing;

-- -------------------------------------------------- listas de invitados -----
insert into guest_lists (
  event_id, name, description, capacity, confirmed_count, signup_deadline,
  last_entry_at, conditions, benefits, auto_approve
) values
  ('b0000000-0000-4000-8000-000000000001', 'Lista Nocturna · ingreso 23:00-00:30',
   'Inscríbete y entra sin costo antes de las 00:30.', 120, 64,
   getin_seed_lima(getin_seed_days_to(6), '20:00'),
   getin_seed_lima(getin_seed_days_to(6) + 1, '00:30'),
   'El ingreso depende del aforo autorizado del local y del criterio de admisión. La inscripción no garantiza el acceso.',
   'Sin costo de entrada antes de las 00:30.', true),
  -- Segunda lista del mismo evento, con aprobacion MANUAL: asi el demo muestra
  -- los dos modos y el panel del local tiene solicitudes que decidir.
  ('b0000000-0000-4000-8000-000000000001', 'Lista VIP · aprobacion del local',
   'Plazas limitadas en la zona VIP. El local revisa cada solicitud.', 40, 12,
   getin_seed_lima(getin_seed_days_to(6), '18:00'),
   getin_seed_lima(getin_seed_days_to(6) + 1, '00:00'),
   'Sujeta a aprobación del local y al aforo autorizado. No garantiza el ingreso.',
   'Acceso a la zona VIP sin costo de entrada.', false),

  ('b0000000-0000-4000-8000-000000000003', 'Lista Fauna',
   'Lista de cortesía con aprobación del local.', 80, 22,
   getin_seed_lima(9, '23:00'),
   getin_seed_lima(10, '23:30'),
   'Sujeta a aprobación y al aforo del local. No garantiza el ingreso.',
   'Ingreso sin costo antes de las 23:30.', false)
on conflict do nothing;

-- Los ayudantes de zona horaria solo existen durante la siembra.
drop function if exists getin_seed_lima(integer, text);
drop function if exists getin_seed_days_to(integer);
