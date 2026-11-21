-- ============================================================
-- Administración del negocio (solo admin): abono, cobros y notas de cada cliente.
-- Los clientes no pueden ver nada de esto.
-- ============================================================
create table if not exists public.cuentas (
  user_id uuid primary key references public.perfiles(id) on delete cascade,
  abono numeric(14,2) not null default 0 check (abono >= 0),
  moneda text not null default 'USD' check (moneda in ('USD', 'ARS')),
  proximo_cobro date,
  whatsapp text not null default '',
  notas text not null default '',
  actualizado timestamptz not null default now()
);
create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null default current_date,
  monto numeric(14,2) not null check (monto >= 0),
  moneda text not null default 'USD' check (moneda in ('USD', 'ARS')),
  creado timestamptz not null default now()
);
create index if not exists pagos_fecha on public.pagos (fecha desc);

alter table public.cuentas enable row level security;
alter table public.pagos enable row level security;
drop policy if exists cuentas_admin on public.cuentas;
create policy cuentas_admin on public.cuentas for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists pagos_admin on public.pagos;
create policy pagos_admin on public.pagos for all using (public.es_admin()) with check (public.es_admin());
revoke all on public.cuentas, public.pagos from anon;
grant select, insert, update, delete on public.cuentas, public.pagos to authenticated;
