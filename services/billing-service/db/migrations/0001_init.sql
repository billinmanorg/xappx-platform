-- billing-service · owns: plans, subscriptions, usage_metrics
--
-- Separate database. Cross-service identifiers (app_id, client_id, user_id) are plain uuid columns
-- with NO foreign keys - the referenced rows live in another service's database.
-- Referential integrity across services is maintained by events and reconciliation,
-- never by the database. Validate at the API edge.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Tenant context, set per request by the service before any query.
create or replace function current_app_id() returns uuid as $$
  select nullif(current_setting('xappx.app_id', true), '')::uuid;
$$ language sql stable;


create table plans (
  plan_id      uuid primary key default gen_random_uuid(),
  app_id       uuid not null,
  code         text not null,
  name         text not null,
  price_cents  int not null default 0,
  interval     text not null default 'month' check (interval in ('month','year','once')),
  product_code text,                      -- the toggle this plan sells
  active       boolean not null default true,
  unique (app_id, code)
);

create table subscriptions (
  subscription_id uuid primary key default gen_random_uuid(),
  app_id          uuid not null,
  user_id         uuid not null,
  plan_id         uuid not null references plans(plan_id),
  status          text not null default 'active'
                  check (status in ('trialing','active','past_due','cancelled')),
  processor_ref   text,
  started_at      timestamptz not null default now(),
  cancelled_at    timestamptz
);
create index on subscriptions (app_id, status);

-- Answers "who is paying for this product right now", which the toggle-off
-- guard in clients-service queries before allowing a product to be disabled.
create view active_subscribers_by_product as
  select s.app_id, p.product_code, count(*) as subscriber_count
    from subscriptions s
    join plans p on p.plan_id = s.plan_id
   where s.status in ('trialing','active','past_due')
     and p.product_code is not null
   group by s.app_id, p.product_code;

create table usage_metrics (
  metric_id bigserial primary key,
  client_id uuid not null,
  app_id    uuid,
  metric    text not null,
  value     bigint not null,
  period    date not null,
  unique (app_id, metric, period)
);

-- ---------------------------------------------------------------- plumbing
-- Transactional outbox. Services never publish to the broker directly; they
-- write here in the same transaction as the state change, and a relay drains it.
create table outbox (
  outbox_id    bigserial primary key,
  aggregate    text not null,
  event_type   text not null,
  subject      text,
  payload      jsonb not null,
  occurred_at  timestamptz not null default now(),
  published_at timestamptz
);
create index outbox_unpublished on outbox (occurred_at) where published_at is null;

create table idempotency_keys (
  key           text not null,
  app_id        uuid not null,
  endpoint      text not null,
  request_hash  text not null,
  response_body jsonb,
  status_code   int,
  created_at    timestamptz not null default now(),
  primary key (app_id, key, endpoint)
);
