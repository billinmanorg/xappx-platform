-- audit-service · owns: audit_log, consents
--
-- Separate database. Cross-service identifiers (app_id, client_id, actor_id) are plain uuid columns
-- with NO foreign keys - the referenced rows live in another service's database.
-- Referential integrity across services is maintained by events and reconciliation,
-- never by the database. Validate at the API edge.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Tenant context, set per request by the service before any query.
create or replace function current_app_id() returns uuid as $$
  select nullif(current_setting('xappx.app_id', true), '')::uuid;
$$ language sql stable;


create table audit_log (
  entry_id    bigserial primary key,
  client_id   uuid,
  app_id      uuid,
  actor_id    uuid,
  service     text not null,
  resource    text,
  record_id   text,
  action      text not null,
  before      jsonb,
  after       jsonb,
  occurred_at timestamptz not null default now()
);
create index on audit_log (app_id, occurred_at desc);

create or replace function block_audit_mutation() returns trigger as $$
begin
  raise exception 'audit_log is append-only';
end;
$$ language plpgsql;

create trigger audit_log_append_only
  before update or delete on audit_log
  for each row execute function block_audit_mutation();

create table consents (
  consent_id  uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  app_id      uuid not null,
  kind        text not null check (kind in ('terms','privacy','marketing')),
  version     text not null,
  granted     boolean not null,
  occurred_at timestamptz not null default now()
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
