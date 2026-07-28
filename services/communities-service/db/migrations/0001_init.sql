-- communities-service · owns: communities, community_members, posts
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


create table communities (
  community_id uuid primary key default gen_random_uuid(),
  app_id       uuid not null,
  name         text not null,
  type         text not null default 'forum' check (type in ('forum','cohort','chapter')),
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create table community_members (
  community_id uuid not null references communities(community_id) on delete cascade,
  user_id      uuid not null,             -- identity-service
  role         text not null default 'member',
  joined_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table posts (
  post_id      uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(community_id) on delete cascade,
  app_id       uuid not null,
  author_id    uuid,
  parent_id    uuid references posts(post_id),
  body         text not null,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

alter table communities enable row level security;
create policy communities_tenant on communities using (app_id = current_app_id());

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
