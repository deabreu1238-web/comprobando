-- Esquema inicial de Comprobado (multi-cuenta).
create extension if not exists pgcrypto;

create table accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  public_key text not null unique,            -- va en el script de la landing; no es secreto
  currency text not null default 'ARS',
  approval_mode text not null default 'manual' check (approval_mode in ('manual', 'auto')),
  auto_min_confidence numeric not null default 0.85,
  recipient_keywords text[] not null default '{}',  -- nombres, alias o CBU propios: si el comprobante no los menciona, va a revisión
  message_template text not null default 'Hola! mi código es {code}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  email text not null unique,
  password_hash text not null,
  role text not null default 'owner' check (role in ('owner', 'member')),
  is_superadmin boolean not null default false,
  created_at timestamptz not null default now()
);

create table sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null
);

-- Números de WhatsApp que rotan en la landing.
create table lines (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  label text not null,
  phone text not null,                         -- solo dígitos, formato internacional (ej. 5491155555555)
  weight integer not null default 1 check (weight between 1 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (account_id, phone)
);

create table meta_configs (
  account_id uuid primary key references accounts(id) on delete cascade,
  pixel_id text not null,
  capi_token_enc text,                         -- cifrado con APP_ENCRYPTION_KEY
  test_event_code text,
  inject_pixel boolean not null default true,  -- el script de la landing carga el píxel
  updated_at timestamptz not null default now()
);

create table kommo_configs (
  account_id uuid primary key references accounts(id) on delete cascade,
  base_url text not null,
  token_enc text not null,
  webhook_secret text not null,
  won_keywords text[] not null default '{ganado,compró,compro,venta,vendido,won,cerrado,aprobado,pagado}',
  pipelines_cache jsonb,
  pipelines_cached_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Un lead por clic en la landing.
create table leads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  code text not null,
  line_id uuid references lines(id) on delete set null,
  status text not null default 'clicked' check (status in ('clicked', 'contacted', 'won')),
  fbclid text, fbc text, fbp text,
  client_ip text, user_agent text, landing_url text,
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  customer_phone text, customer_name text,
  kommo_lead_id bigint, kommo_contact_id bigint,
  first_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (account_id, code)
);
create index leads_kommo on leads (account_id, kommo_lead_id);
create index leads_created on leads (account_id, created_at desc);

create table receipts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  source text not null check (source in ('kommo', 'upload')),
  source_ref text,                             -- id del mensaje de origen, para no procesar dos veces
  media_type text,
  image bytea,
  status text not null default 'processing'
    check (status in ('processing', 'not_receipt', 'review', 'accepted', 'duplicate', 'error')),
  is_receipt boolean,
  amount numeric(14, 2), currency text, operation_id text, bank text, receipt_date text,
  payer_name text, recipient_name text, confidence numeric,
  ai_result jsonb, error text,
  created_at timestamptz not null default now(),
  unique (account_id, source, source_ref)
);
create unique index receipts_operation on receipts (account_id, operation_id)
  where operation_id is not null and status in ('accepted', 'review');

create table sales (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  receipt_id uuid references receipts(id) on delete set null,
  source text not null check (source in ('receipt', 'kommo_stage', 'manual')),
  amount numeric(14, 2) not null,
  currency text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_reason text,
  capi_status text not null default 'not_sent' check (capi_status in ('not_sent', 'sent', 'error', 'skipped')),
  capi_event_id text,
  capi_response jsonb,
  approved_at timestamptz, sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index sales_account on sales (account_id, created_at desc);
create index sales_lead on sales (lead_id, created_at desc);

-- Registro crudo de lo que llega por webhook (para depurar integraciones).
create table webhook_events (
  id bigserial primary key,
  account_id uuid references accounts(id) on delete cascade,
  provider text not null,
  payload jsonb not null,
  result text,
  created_at timestamptz not null default now()
);
