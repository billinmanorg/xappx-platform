-- export-service · owns: export_jobs, export_artifacts
--
-- Separate database. Cross-service identifiers (app_id, client_id) are plain uuid columns
-- with NO foreign keys - the referenced rows live in another service's database.
-- Referential integrity across services is maintained by events and reconciliation,
-- never by the database. Validate at the API edge.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Tenant context, set per request by the service before any query.
create or replace function current_app_id() returns uuid as $$
  select nullif(current_setting('xappx.app_id', true), '')::uuid;
$$ language sql stable;


create table export_jobs (
  export_id         uuid primary key default gen_random_uuid(),
  client_id         uuid not null,
  app_id            uuid,
  target            text not null default 'full' check (target in ('full','config','data')),
  encryption_key_id text,
  status            text not null default 'queued'
                    check (status in ('queued','running','complete','failed')),
  manifest          jsonb,
  requested_by      uuid,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

-- One row per contributing service, so a partial export is visible rather than silent.
create table export_artifacts (
  artifact_id  uuid primary key default gen_random_uuid(),
  export_id    uuid not null references export_jobs(export_id) on delete cascade,
  service      text not null,
  storage_key  text,
  row_count    bigint,
  checksum     text,
  status       text not null default 'pending'
               check (status in ('pending','complete','failed')),
  error        text,
  unique (export_id, service)
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
