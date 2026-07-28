-- 0002 · Retention on downgrade
--
-- Policy: when a user loses a paid product, their files stay for 6 months.
-- At the end of that window they are deleted and the account reverts to the
-- free plan. Nothing is deleted at the moment of downgrade.
--
-- The window is data, not a constant in code: a brand may negotiate a different
-- one, and legal holds have to be able to extend it.

create table retention_holds (
  hold_id       uuid primary key default gen_random_uuid(),
  app_id        uuid not null,
  user_id       uuid not null,               -- identity-service
  vault_id      uuid references vaults(vault_id) on delete cascade,
  reason        text not null
                check (reason in ('downgrade','product_disabled','legal_hold')),
  effective_at  timestamptz not null default now(),
  delete_after  timestamptz not null,        -- effective_at + retention window
  status        text not null default 'active'
                check (status in ('active','restored','executed','cancelled')),
  restored_at   timestamptz,
  executed_at   timestamptz,
  source_event  text,                        -- CloudEvent id that opened the hold
  notified_at   timestamptz[] not null default '{}',
  created_at    timestamptz not null default now()
);

-- Consumer idempotency: a redelivered downgrade event must not open a second
-- hold, and must not restart the six-month clock.
create unique index retention_holds_source on retention_holds (source_event)
  where source_event is not null;

create unique index retention_holds_one_active on retention_holds (app_id, user_id, vault_id)
  where status = 'active';

create index retention_holds_due on retention_holds (delete_after)
  where status = 'active';

-- Default window. Overridable per brand; legal holds set their own.
create table retention_policies (
  app_id           uuid primary key,
  window_months    int not null default 6 check (window_months > 0),
  deletion_scope   text not null default 'over_free_quota'
                   check (deletion_scope in ('over_free_quota','all_premium')),
  warn_days_before int[] not null default '{30,7,1}'
);

-- Files under an active hold are readable but frozen. The user can download and
-- can re-subscribe to unfreeze; they cannot add more while over the free quota.
create or replace function block_writes_under_hold() returns trigger as $$
begin
  if exists (
    select 1 from retention_holds h
     where h.status = 'active'
       and h.vault_id = coalesce(new.vault_id, old.vault_id)
  ) then
    raise exception 'vault is under retention hold: read-only until the subscription is restored';
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger files_frozen_under_hold
  before insert or update on files
  for each row execute function block_writes_under_hold();

-- What the deletion job reads. Nothing deletes anything before delete_after.
create view retention_due as
  select h.hold_id, h.app_id, h.user_id, h.vault_id, h.delete_after,
         coalesce(p.deletion_scope, 'over_free_quota') as deletion_scope,
         count(f.file_id) filter (where f.deleted_at is null) as live_files,
         coalesce(sum(f.size_bytes) filter (where f.deleted_at is null), 0) as bytes
    from retention_holds h
    left join retention_policies p on p.app_id = h.app_id
    left join files f on f.vault_id = h.vault_id
   where h.status = 'active'
     and h.delete_after <= now()
   group by h.hold_id, h.app_id, h.user_id, h.vault_id, h.delete_after, p.deletion_scope;

-- Restoring a subscription cancels the hold; it never deletes anything.
create or replace function restore_retention_hold(p_hold_id uuid) returns void as $$
begin
  update retention_holds
     set status = 'restored', restored_at = now()
   where hold_id = p_hold_id and status = 'active';
end;
$$ language plpgsql;
