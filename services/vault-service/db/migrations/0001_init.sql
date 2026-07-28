-- vault-service · owns: vaults, files, file_acl
--
-- Separate database. Cross-service identifiers (app_id, client_id, owner_id) are plain uuid columns
-- with NO foreign keys - the referenced rows live in another service's database.
-- Referential integrity across services is maintained by events and reconciliation,
-- never by the database. Validate at the API edge.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Tenant context, set per request by the service before any query.
create or replace function current_app_id() returns uuid as $$
  select nullif(current_setting('xappx.app_id', true), '')::uuid;
$$ language sql stable;


create table vaults (
  vault_id          uuid primary key default gen_random_uuid(),
  client_id         uuid not null,
  app_id            uuid not null,
  owner_id          uuid,                -- identity-service
  name              text not null,
  type              text not null default 'user'
                    check (type in ('user','project','knowledge','system')),
  encryption_key_id text not null,       -- KMS reference only
  quota_bytes       bigint,
  created_at        timestamptz not null default now(),
  unique (app_id, owner_id, name)
);

create table files (
  file_id        uuid primary key default gen_random_uuid(),
  vault_id       uuid not null references vaults(vault_id) on delete cascade,
  app_id         uuid not null,
  name           text not null,
  content_type   text,
  size_bytes     bigint not null default 0,
  checksum       text not null,
  storage_key    text not null,
  version        int not null default 1,
  extracted_text text,
  uploaded_by    uuid,
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index on files (vault_id, deleted_at);

create table file_acl (
  file_id    uuid not null references files(file_id) on delete cascade,
  grantee    text not null,              -- user:<id> | role:<id> | public
  permission text not null check (permission in ('read','write','owner')),
  primary key (file_id, grantee, permission)
);

alter table vaults enable row level security;
alter table files  enable row level security;
create policy vaults_tenant on vaults using (app_id = current_app_id());
create policy files_tenant  on files  using (app_id = current_app_id());

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
