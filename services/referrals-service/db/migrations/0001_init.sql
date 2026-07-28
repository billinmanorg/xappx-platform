-- referrals-service · owns: referrals
--
-- Separate database. Cross-service identifiers (app_id, referrer_id, referee_id) are plain uuid columns
-- with NO foreign keys - the referenced rows live in another service's database.
-- Referential integrity across services is maintained by events and reconciliation,
-- never by the database. Validate at the API edge.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Tenant context, set per request by the service before any query.
create or replace function current_app_id() returns uuid as $$
  select nullif(current_setting('xappx.app_id', true), '')::uuid;
$$ language sql stable;


create table referrals (
  referral_id   uuid primary key default gen_random_uuid(),
  app_id        uuid not null,
  referrer_id   uuid,                     -- identity-service
  referee_email citext,
  referee_id    uuid,
  campaign      text,
  external_ref  text,                     -- proof captured at signup
  status        text not null default 'registered'
                check (status in ('registered','qualified','converted','rejected')),
  created_at    timestamptz not null default now(),
  converted_at  timestamptz
);
create index on referrals (app_id, status);

alter table referrals enable row level security;
create policy referrals_tenant on referrals using (app_id = current_app_id());

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
