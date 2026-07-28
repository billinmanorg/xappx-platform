-- rewards-service · owns: action_catalog, reward_programs, reward_rules, reward_accounts, reward_transactions, ledger_entries, redemptions, token_batches
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


create table action_catalog (
  action_code text primary key,
  description text
);

create table reward_programs (
  program_id uuid primary key default gen_random_uuid(),
  app_id     uuid not null,
  name       text not null,
  currency   text not null default 'points',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table reward_rules (
  rule_id     uuid primary key default gen_random_uuid(),
  program_id  uuid not null references reward_programs(program_id) on delete cascade,
  action_code text not null references action_catalog(action_code),
  amount      bigint not null,
  beneficiary text not null default 'actor'
              check (beneficiary in ('actor','referrer','referee','client')),
  conditions  jsonb not null default '{}'::jsonb,
  requires_approval boolean not null default false,
  window_start timestamptz,
  window_end   timestamptz,
  active       boolean not null default true
);

create table reward_accounts (
  account_id uuid primary key default gen_random_uuid(),
  program_id uuid not null references reward_programs(program_id) on delete cascade,
  user_id    uuid,                        -- identity-service
  kind       text not null default 'user' check (kind in ('user','pool','merchant')),
  balance    bigint not null default 0,   -- projection; the ledger is the truth
  created_at timestamptz not null default now(),
  unique (program_id, user_id, kind)
);

create table reward_transactions (
  transaction_id uuid primary key default gen_random_uuid(),
  program_id     uuid not null references reward_programs(program_id),
  rule_id        uuid references reward_rules(rule_id),
  action_code    text references action_catalog(action_code),
  source_event   text,                    -- CloudEvent id that caused this
  status         text not null default 'pending'
                 check (status in ('pending','completed','reversed','cancelled')),
  reverses       uuid references reward_transactions(transaction_id),
  approved_by    uuid,
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);
-- Consuming the same event twice must not grant points twice.
create unique index reward_transactions_source on reward_transactions (source_event)
  where source_event is not null;

create table ledger_entries (
  entry_id       bigserial primary key,
  transaction_id uuid not null references reward_transactions(transaction_id) on delete cascade,
  account_id     uuid not null references reward_accounts(account_id),
  type           text not null check (type in ('debit','credit')),
  amount         bigint not null check (amount > 0),
  description    text,
  created_at     timestamptz not null default now()
);
create index on ledger_entries (account_id);
create index on ledger_entries (transaction_id);

create or replace function assert_transaction_balances() returns trigger as $$
declare net bigint;
begin
  select coalesce(sum(case when type = 'credit' then amount else -amount end), 0)
    into net from ledger_entries where transaction_id = new.transaction_id;
  if net <> 0 then
    raise exception 'transaction % does not balance (net %)', new.transaction_id, net;
  end if;
  return null;
end;
$$ language plpgsql;

create constraint trigger ledger_entries_balance
  after insert on ledger_entries
  deferrable initially deferred
  for each row execute function assert_transaction_balances();

create or replace function block_completed_ledger_writes() returns trigger as $$
begin
  if exists (select 1 from reward_transactions t
              where t.transaction_id = old.transaction_id and t.status = 'completed') then
    raise exception 'ledger entries for completed transactions are immutable';
  end if;
  return old;
end;
$$ language plpgsql;

create trigger ledger_entries_immutable
  before update or delete on ledger_entries
  for each row execute function block_completed_ledger_writes();

create table redemptions (
  redemption_id  uuid primary key default gen_random_uuid(),
  account_id     uuid not null references reward_accounts(account_id),
  transaction_id uuid references reward_transactions(transaction_id),
  item           text not null,
  points         bigint not null,
  status         text not null default 'pending',
  created_at     timestamptz not null default now()
);

-- Gated: schema present, no implementation in v1.
create table token_batches (
  batch_id     uuid primary key default gen_random_uuid(),
  program_id   uuid not null references reward_programs(program_id),
  status       text not null default 'draft',
  jurisdiction text,
  kyc_verified boolean not null default false,
  chain_ref    text,
  created_at   timestamptz not null default now()
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
