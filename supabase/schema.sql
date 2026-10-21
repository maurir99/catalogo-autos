-- =====================================================================
-- Catálogo de autos — estructura de la base de datos en Supabase
-- Copiá TODO este archivo en Supabase → SQL Editor → New query → Run.
-- Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- ---------- Administradores ----------
-- Solo los usuarios que estén en esta tabla pueden cargar o editar autos.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  creado  timestamptz not null default now()
);
alter table public.admins enable row level security;
-- Permisos de la API (necesarios en proyectos nuevos desde oct. 2026).
-- La página nunca lee esta tabla directamente: sólo el servidor.
grant select, insert, update, delete on public.admins to service_role;
-- Nadie puede leer ni modificar esta tabla desde la página; se administra desde el panel de Supabase.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Vehículos ----------
create table if not exists public.autos (
  id           uuid primary key default gen_random_uuid(),
  marca        text not null,
  modelo       text not null,
  anio         int  not null check (anio between 1900 and 2100),
  km           int  check (km >= 0),
  precio       numeric(14,2) not null check (precio >= 0),
  moneda       text not null default 'USD' check (moneda in ('USD','PYG')),
  combustible  text,
  transmision  text,
  motor        text,
  traccion     text,
  color        text,
  puertas      int,
  carroceria   text,
  estado       text not null default 'disponible' check (estado in ('disponible','reservado','vendido')),
  extras       text,
  descripcion  text,
  cero         boolean not null default false,
  fotos        text[] not null default '{}',   -- rutas dentro del bucket "fotos"; la primera es la portada
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now(),
  vendido_en   timestamptz
);
create index if not exists autos_creado_idx on public.autos (creado desc);

alter table public.autos enable row level security;
-- Permisos de la API: los visitantes leen; lo que puede escribir cada uno lo limitan las políticas de abajo.
grant select on public.autos to anon;
grant select, insert, update, delete on public.autos to authenticated;
grant select, insert, update, delete on public.autos to service_role;

drop policy if exists "autos: todos leen"        on public.autos;
drop policy if exists "autos: admin inserta"     on public.autos;
drop policy if exists "autos: admin modifica"    on public.autos;
drop policy if exists "autos: admin elimina"     on public.autos;

create policy "autos: todos leen"     on public.autos for select using (true);
create policy "autos: admin inserta"  on public.autos for insert with check (public.is_admin());
create policy "autos: admin modifica" on public.autos for update using (public.is_admin()) with check (public.is_admin());
create policy "autos: admin elimina"  on public.autos for delete using (public.is_admin());

-- ---------- Datos del negocio (una sola fila, id = 1) ----------
create table if not exists public.config (
  id        int primary key default 1 check (id = 1),
  nombre    text,
  whatsapp  text,
  direccion text
);
insert into public.config (id) values (1) on conflict (id) do nothing;

alter table public.config enable row level security;
grant select on public.config to anon;
grant select, insert, update, delete on public.config to authenticated;
grant select, insert, update, delete on public.config to service_role;

drop policy if exists "config: todos leen"     on public.config;
drop policy if exists "config: admin inserta"  on public.config;
drop policy if exists "config: admin modifica" on public.config;

create policy "config: todos leen"     on public.config for select using (true);
create policy "config: admin inserta"  on public.config for insert with check (public.is_admin());
create policy "config: admin modifica" on public.config for update using (public.is_admin()) with check (public.is_admin());

-- ---------- Fotos (Storage) ----------
-- Bucket público: cualquiera puede ver las fotos, solo los administradores suben o borran.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true;

drop policy if exists "fotos: admin sube"      on storage.objects;
drop policy if exists "fotos: admin modifica"  on storage.objects;
drop policy if exists "fotos: admin borra"     on storage.objects;

create policy "fotos: admin sube"     on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.is_admin());
create policy "fotos: admin modifica" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and public.is_admin());
create policy "fotos: admin borra"    on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.is_admin());

-- =====================================================================
-- ÚLTIMO PASO (después de crear tu usuario en Authentication → Users):
-- reemplazá el email y ejecutá esta línea para hacerte administrador.
--
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'tu-email@gmail.com'
-- on conflict do nothing;
-- =====================================================================
