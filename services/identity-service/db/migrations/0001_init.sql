-- identity-service · owns: users, roles, memberships, sessions
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


create table users (
  user_id       uuid primary key default gen_random_uuid(),
  email         citext not null unique,
  name          text,
  auth_provider text not null default 'password',
  external_id   text,
  status        text not null default 'active'
                check (status in ('active','disabled','deleted')),
  created_at    timestamptz not null default now()
);

create table roles (
  role_id     uuid primary key default gen_random_uuid(),
  app_id      uuid not null,             -- clients-service
  name        text not null,
  permissions jsonb not null default '[]'::jsonb,
  unique (app_id, name)
);

-- Membership is per brand instance, never global.
create table memberships (
  membership_id uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(user_id) on delete cascade,
  client_id     uuid not null,           -- clients-service
  app_id        uuid not null,           -- clients-service
  role_id       uuid references roles(role_id),
  status        text not null default 'active'
                check (status in ('invited','active','suspended','left')),
  joined_at     timestamptz not null default now(),
  unique (user_id, app_id)
);
create index on memberships (app_id, status);

-- Local projection of brand existence, maintained from application.created events.
-- Lets this service reject a membership for an unknown brand without a sync call.
create table known_applications (
  app_id     uuid primary key,
  client_id  uuid not null,
  slug       text not null,
  synced_at  timestamptz not null default now()
);

create table sessions (
  session_id uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(user_id) on delete cascade,
  app_id     uuid not null,
  issued_at  timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

alter table memberships enable row level security;
create policy memberships_tenant on memberships using (app_id = current_app_id());

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
