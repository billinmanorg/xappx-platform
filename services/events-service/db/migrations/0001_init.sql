-- events-service · owns: events_log, webhooks, webhook_deliveries, engagements
--
-- Separate database. Cross-service identifiers (app_id, user_id) are plain uuid columns
-- with NO foreign keys - the referenced rows live in another service's database.
-- Referential integrity across services is maintained by events and reconciliation,
-- never by the database. Validate at the API edge.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Tenant context, set per request by the service before any query.
create or replace function current_app_id() returns uuid as $$
  select nullif(current_setting('xappx.app_id', true), '')::uuid;
$$ language sql stable;


create table events_log (
  event_id    uuid primary key,            -- the CloudEvent id, not a new one
  client_id   uuid,
  app_id      uuid,
  type        text not null,
  source      text not null,
  subject     text,
  data        jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now()
);
create index on events_log (app_id, type, occurred_at desc);

create table webhooks (
  webhook_id  uuid primary key default gen_random_uuid(),
  app_id      uuid not null,
  url         text not null,
  secret_ref  text not null,
  event_types text[] not null default '{}',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table webhook_deliveries (
  delivery_id  bigserial primary key,
  webhook_id   uuid not null references webhooks(webhook_id) on delete cascade,
  event_id     uuid,
  status_code  int,
  attempts     int not null default 0,
  next_retry_at timestamptz,
  last_error   text,
  delivered_at timestamptz
);

-- Per-user action history: built once, reported per brand.
create table engagements (
  engagement_id bigserial primary key,
  app_id        uuid not null,
  user_id       uuid,
  subject_type  text,
  subject_id    text,
  action        text not null,
  duration_ms   int,
  metadata      jsonb not null default '{}'::jsonb,
  occurred_at   timestamptz not null default now()
);
create index on engagements (app_id, user_id, occurred_at desc);

alter table engagements enable row level security;
create policy engagements_tenant on engagements using (app_id = current_app_id());

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
