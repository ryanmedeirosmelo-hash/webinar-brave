-- Compras reais via webhook da Hotmart (Postback 2.0).
-- 1 linha por evento recebido; a métrica conta PURCHASE_APPROVED distintos por
-- transação. Atribuição à live: sck no link do checkout (exata) ou e-mail do
-- comprador × registrations (fallback) — pode ficar nula ("sem atribuição").

create table if not exists purchases (
  id             uuid primary key default gen_random_uuid(),
  webinar_id     uuid references webinars(id) on delete set null,
  session_start  timestamptz,          -- a live específica (quando atribuível)
  event          text not null,        -- PURCHASE_APPROVED, PURCHASE_REFUNDED…
  transaction_id text,                 -- id da transação Hotmart (dedup)
  buyer_name     text,
  buyer_email    text,
  product_name   text,
  price_value    numeric,
  price_currency text,
  raw            jsonb not null,       -- payload completo (auditoria/futuro)
  occurred_at    timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- Hotmart reenvia webhooks em caso de falha → mesmo evento+transação só 1x.
create unique index if not exists purchases_txn_event_key
  on purchases (transaction_id, event) where transaction_id is not null;
create index if not exists purchases_webinar_session_idx
  on purchases (webinar_id, session_start);

alter table purchases enable row level security;
-- sem policy: acesso só server-side via service_role (BYPASSRLS).
grant select, insert, update, delete on purchases to service_role;
