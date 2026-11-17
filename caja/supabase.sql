-- ============================================================
-- Dashboard de caja PanelPro: tablas y seguridad.
-- Pegá TODO este texto en Supabase -> SQL Editor -> New query -> Run.
-- Se puede correr más de una vez sin romper nada.
-- ============================================================

-- Perfiles: uno por usuario de Supabase.
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text not null default '',
  rol text not null default 'cliente' check (rol in ('admin', 'cliente')),
  activo boolean not null default true,
  objetivo_diario numeric(14,2) not null default 0,
  creado timestamptz not null default now()
);

-- Un registro por cliente y por día.
create table if not exists public.registros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null,
  ingresos numeric(14,2) not null default 0 check (ingresos >= 0),
  premios numeric(14,2) not null default 0 check (premios >= 0),
  fichas numeric(14,2) not null default 0 check (fichas >= 0),
  meta_ads numeric(14,2) not null default 0 check (meta_ads >= 0),
  comisiones numeric(14,2) not null default 0 check (comisiones >= 0),
  otros_gastos numeric(14,2) not null default 0 check (otros_gastos >= 0),
  jugadores_nuevos integer not null default 0 check (jugadores_nuevos >= 0),
  jugadores_recurrentes integer not null default 0 check (jugadores_recurrentes >= 0),
  jugadores_meta integer not null default 0 check (jugadores_meta >= 0),
  cargas_atribuidas numeric(14,2) not null default 0 check (cargas_atribuidas >= 0),
  actualizado timestamptz not null default now(),
  unique (user_id, fecha)
);
create index if not exists registros_user_fecha on public.registros (user_id, fecha desc);

-- Cada usuario nuevo de Supabase recibe su perfil de cliente.
create or replace function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users for each row execute function public.crear_perfil();

-- Perfiles para usuarios que ya existían antes de correr este script.
insert into public.perfiles (id, email, nombre)
select id, email, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- Ayudas para las reglas de seguridad.
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin' and activo);
$$;
create or replace function public.esta_activo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo);
$$;

-- Un cliente puede cambiar su nombre y su objetivo, pero nunca su rol ni su estado.
-- (Los cambios hechos desde el SQL Editor de Supabase no tienen usuario y no se bloquean.)
create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.es_admin() then
    new.rol := old.rol;
    new.activo := old.activo;
    new.email := old.email;
  end if;
  return new;
end $$;
drop trigger if exists proteger_perfil on public.perfiles;
create trigger proteger_perfil before update on public.perfiles for each row execute function public.proteger_perfil();

-- ------------------------------------------------------------ seguridad por fila
alter table public.perfiles enable row level security;
alter table public.registros enable row level security;

drop policy if exists perfiles_ver on public.perfiles;
create policy perfiles_ver on public.perfiles for select
  using (id = auth.uid() or public.es_admin());

drop policy if exists perfiles_editar on public.perfiles;
create policy perfiles_editar on public.perfiles for update
  using ((id = auth.uid() and activo) or public.es_admin())
  with check ((id = auth.uid()) or public.es_admin());

drop policy if exists registros_ver on public.registros;
create policy registros_ver on public.registros for select
  using ((user_id = auth.uid() and public.esta_activo()) or public.es_admin());

drop policy if exists registros_crear on public.registros;
create policy registros_crear on public.registros for insert
  with check ((user_id = auth.uid() and public.esta_activo()) or public.es_admin());

drop policy if exists registros_editar on public.registros;
create policy registros_editar on public.registros for update
  using ((user_id = auth.uid() and public.esta_activo()) or public.es_admin())
  with check ((user_id = auth.uid() and public.esta_activo()) or public.es_admin());

drop policy if exists registros_borrar on public.registros;
create policy registros_borrar on public.registros for delete
  using ((user_id = auth.uid() and public.esta_activo()) or public.es_admin());

-- Nadie sin sesión puede leer nada.
revoke all on public.perfiles, public.registros from anon;
grant select, update on public.perfiles to authenticated;
grant select, insert, update, delete on public.registros to authenticated;
