-- ============================================================
-- Cuentas de la agencia (solo admin): clientes de la agencia y sus pagos.
-- Pegá TODO en Supabase -> SQL Editor -> New query -> Run. Se puede correr más de una vez.
-- ============================================================
create table if not exists public.agencia_clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  contacto text not null default '',
  servicio text not null default '',
  fecha_ingreso date not null default current_date,
  cuentas_publicitarias integer not null default 1 check (cuentas_publicitarias >= 0),
  monto numeric(14,2) not null default 0 check (monto >= 0),
  moneda text not null default 'USD' check (moneda in ('USD', 'ARS')),
  frecuencia text not null default 'mensual' check (frecuencia in ('mensual', 'unico')),
  cobrar_desde date not null default date_trunc('month', current_date)::date,
  estado text not null default 'activo' check (estado in ('activo', 'pausado', 'baja')),
  notas text not null default '',
  creado timestamptz not null default now()
);
create table if not exists public.agencia_pagos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.agencia_clientes(id) on delete cascade,
  fecha date not null default current_date,
  periodo text not null check (periodo ~ '^\d{4}-\d{2}$'),
  monto numeric(14,2) not null check (monto > 0),
  moneda text not null default 'USD' check (moneda in ('USD', 'ARS')),
  medio text not null default '',
  nota text not null default '',
  creado timestamptz not null default now()
);
create index if not exists agencia_pagos_cliente on public.agencia_pagos (cliente_id, periodo);

alter table public.agencia_clientes enable row level security;
alter table public.agencia_pagos enable row level security;
drop policy if exists agencia_clientes_admin on public.agencia_clientes;
create policy agencia_clientes_admin on public.agencia_clientes for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists agencia_pagos_admin on public.agencia_pagos;
create policy agencia_pagos_admin on public.agencia_pagos for all using (public.es_admin()) with check (public.es_admin());
revoke all on public.agencia_clientes, public.agencia_pagos from anon;
grant select, insert, update, delete on public.agencia_clientes, public.agencia_pagos to authenticated;
