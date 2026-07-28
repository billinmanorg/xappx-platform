-- ai-orchestrator · owns: ai_routes, ai_requests
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


create table ai_routes (
  route_id   uuid primary key default gen_random_uuid(),
  app_id     uuid,                        -- null = platform default
  capability text not null,               -- text.generate | doc.qa | video.generate
  provider   text not null,
  model      text,
  priority   int not null default 100,
  active     boolean not null default true
);

create table ai_requests (
  request_id    uuid primary key default gen_random_uuid(),
  app_id        uuid not null,
  user_id       uuid,
  capability    text not null,
  provider      text,
  input_tokens  int,
  output_tokens int,
  cost_cents    int,
  latency_ms    int,
  status        text not null default 'ok',
  created_at    timestamptz not null default now()
);
create index on ai_requests (app_id, created_at desc);

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
