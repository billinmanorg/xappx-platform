-- clients-service · owns: clients, applications, products, app_products, legal_documents
--
-- Separate database. Cross-service identifiers (none) are plain uuid columns
-- with NO foreign keys - the referenced rows live in another service's database.
-- Referential integrity across services is maintained by events and reconciliation,
-- never by the database. Validate at the API edge.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Tenant context, set per request by the service before any query.
create or replace function current_app_id() returns uuid as $$
  select nullif(current_setting('xappx.app_id', true), '')::uuid;
$$ language sql stable;


create table clients (
  client_id     uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  status        text not null default 'active'
                check (status in ('active','suspended','archived')),
  jurisdiction  text,
  billing_email text,
  admin_email   text,
  created_at    timestamptz not null default now()
);

-- An application IS a brand instance: a configuration record, never a codebase.
create table applications (
  app_id         uuid primary key default gen_random_uuid(),
  client_id      uuid not null references clients(client_id) on delete restrict,
  name           text not null,
  slug           text not null unique,
  primary_domain text unique,
  status         text not null default 'draft'
                 check (status in ('draft','published','suspended','archived')),
  theme          jsonb not null default '{}'::jsonb,
  copy           jsonb not null default '{}'::jsonb,
  taxonomy       jsonb not null default '{}'::jsonb,
  navigation     jsonb not null default '[]'::jsonb,
  feature_flags  jsonb not null default '{}'::jsonb,  -- experiments only, NOT products
  manifest_version text not null default '1',
  created_at     timestamptz not null default now(),
  published_at   timestamptz
);
create index on applications (client_id);

create table products (
  code        text primary key,
  name        text not null,
  description text,
  requires    text[] not null default '{}',
  billable    boolean not null default false,
  admin_only  boolean not null default false
);

create table app_products (
  app_id       uuid not null references applications(app_id) on delete cascade,
  product_code text not null references products(code),
  enabled      boolean not null default false,
  display_name text,
  config       jsonb not null default '{}'::jsonb,
  changed_at   timestamptz not null default now(),
  changed_by   uuid,                     -- user_id, owned by identity-service
  primary key (app_id, product_code)
);

create or replace function assert_product_dependencies() returns trigger as $$
declare
  missing text;
begin
  if new.enabled then
    select p.code into missing
      from products parent
      cross join lateral unnest(parent.requires) as p(code)
      left join app_products ap
        on ap.app_id = new.app_id and ap.product_code = p.code and ap.enabled
     where parent.code = new.product_code and ap.product_code is null
     limit 1;
    if missing is not null then
      raise exception 'product % requires % to be enabled first', new.product_code, missing;
    end if;
  else
    select ap.product_code into missing
      from app_products ap
      join products p on p.code = ap.product_code
     where ap.app_id = new.app_id and ap.enabled
       and new.product_code = any (p.requires)
     limit 1;
    if missing is not null then
      raise exception 'cannot disable %: % depends on it', new.product_code, missing;
    end if;
  end if;
  new.changed_at := now();
  return new;
end;
$$ language plpgsql;

create trigger app_products_dependencies
  before insert or update on app_products
  for each row execute function assert_product_dependencies();

-- Any toggle change bumps the manifest version so every downstream cache invalidates.
create or replace function bump_manifest_version() returns trigger as $$
begin
  update applications
     set manifest_version = (manifest_version::bigint + 1)::text
   where app_id = new.app_id;
  return new;
end;
$$ language plpgsql;

create trigger app_products_bump_manifest
  after insert or update on app_products
  for each row execute function bump_manifest_version();

create table legal_documents (
  document_id  uuid primary key default gen_random_uuid(),
  app_id       uuid not null references applications(app_id) on delete cascade,
  kind         text not null check (kind in ('terms','privacy','disclosure')),
  version      text not null,
  body         text not null,
  effective_at timestamptz not null default now(),
  unique (app_id, kind, version)
);

alter table app_products enable row level security;
create policy app_products_tenant on app_products using (app_id = current_app_id());

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
