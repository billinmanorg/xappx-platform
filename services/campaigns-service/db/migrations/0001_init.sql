-- campaigns-service · owns: contents, campaigns, projects
--
-- Separate database. Cross-service identifiers (app_id, owner_id, media_id) are plain uuid columns
-- with NO foreign keys - the referenced rows live in another service's database.
-- Referential integrity across services is maintained by events and reconciliation,
-- never by the database. Validate at the API edge.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Tenant context, set per request by the service before any query.
create or replace function current_app_id() returns uuid as $$
  select nullif(current_setting('xappx.app_id', true), '')::uuid;
$$ language sql stable;


create table contents (
  content_id   uuid primary key default gen_random_uuid(),
  app_id       uuid not null,
  type         text not null check (type in ('article','video','course','event','page')),
  title        text not null,
  slug         text,
  body         text,
  media_id     uuid,                      -- media-service
  status       text not null default 'draft'
               check (status in ('draft','review','published','archived')),
  topics       text[] not null default '{}',
  author_id    uuid,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (app_id, slug)
);

create table campaigns (
  campaign_id uuid primary key default gen_random_uuid(),
  app_id      uuid not null,
  name        text not null,
  type        text not null default 'outreach',
  owner_id    uuid,
  status      text not null default 'planned',
  starts_at   timestamptz,
  ends_at     timestamptz,
  metadata    jsonb not null default '{}'::jsonb
);

create table projects (
  project_id uuid primary key default gen_random_uuid(),
  app_id     uuid not null,
  name       text not null,
  owner_id   uuid,
  status     text not null default 'active',
  created_at timestamptz not null default now()
);

alter table contents enable row level security;
create policy contents_tenant on contents using (app_id = current_app_id());

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
