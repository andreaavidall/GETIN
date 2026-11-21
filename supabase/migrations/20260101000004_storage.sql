-- ===========================================================================
-- GETIN · 0004 · Storage (imagenes de eventos y documentos de verificacion)
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('event-images', 'event-images', true, 5242880,
   array['image/jpeg','image/png','image/webp','image/avif']),
  ('venue-images', 'venue-images', true, 5242880,
   array['image/jpeg','image/png','image/webp','image/avif']),
  -- Documentos comerciales: bucket PRIVADO. Se sirven por URL firmada.
  ('venue-documents', 'venue-documents', false, 10485760,
   array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

-- Lectura publica de las imagenes del catalogo.
create policy "event images publicas" on storage.objects
  for select using (bucket_id in ('event-images', 'venue-images'));

-- Cada local sube solo dentro de su carpeta: <venue_id>/<archivo>.
-- El primer segmento de la ruta debe ser un venue al que pertenece el usuario.
create policy "event images escritura del local" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('event-images', 'venue-images')
    and getin_has_venue_access(
          nullif((storage.foldername(name))[1], '')::uuid,
          array['owner','manager']::venue_role[])
  );

create policy "event images borrado del local" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('event-images', 'venue-images')
    and getin_has_venue_access(
          nullif((storage.foldername(name))[1], '')::uuid,
          array['owner','manager']::venue_role[])
  );

-- Documentos de verificacion: los sube el dueño, los lee GETIN.
create policy "documentos del local" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'venue-documents'
    and getin_has_venue_access(
          nullif((storage.foldername(name))[1], '')::uuid,
          array['owner']::venue_role[])
  );

create policy "documentos lectura" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'venue-documents'
    and (
      getin_is_superadmin()
      or getin_has_venue_access(
           nullif((storage.foldername(name))[1], '')::uuid,
           array['owner']::venue_role[])
    )
  );
