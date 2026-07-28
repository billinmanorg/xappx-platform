-- twins-service · owns: twins, twin_training_sources
--
-- Separate database. Cross-service identifiers (app_id, client_id, owner_id, file_id, avatar_id) are plain uuid columns
-- with NO foreign keys - the referenced rows live in another service's database.
-- Referential integrity across services is maintained by events and reconciliation,
-- never by the database. Validate at the API edge.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Tenant context, set per request by the service before any query.
create or replace function current_app_id() returns uuid as $$
  select nullif(current_setting('xappx.app_id', true), '')::uuid;
$$ language sql stable;


create table twins (
  twin_id    uuid primary key default gen_random_uuid(),
  client_id  uuid not null,
  app_id     uuid not null,
  owner_id   uuid,                       -- identity-service
  name       text not null,
  status     text not null default 'draft'
             check (status in ('draft','training','ready','disabled')),
  avatar_id  uuid,                       -- media-service
  model      text,
  parameters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table twin_training_sources (
  source_id  uuid primary key default gen_random_uuid(),
  twin_id    uuid not null references twins(twin_id) on delete cascade,
  file_id    uuid,                       -- vault-service
  kind       text not null,
  status     text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table twins enable row level security;
create policy twins_tenant on twins using (app_id = current_app_id());

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
