-- 0002 · Downgrade tracking
--
-- Billing owns the fact that a subscription ended. Vault owns what happens to
-- the files. They meet at one event: com.xappx.subscription.downgraded.

alter table subscriptions
  add column downgraded_at   timestamptz,
  add column retention_until timestamptz;

-- Who is currently paying for a product. clients-service queries this before
-- allowing a product to be toggled off for a brand.
create or replace view active_subscribers_by_product as
  select s.app_id, p.product_code, count(*) as subscriber_count
    from subscriptions s
    join plans p on p.plan_id = s.plan_id
   where s.status in ('trialing','active','past_due')
     and p.product_code is not null
   group by s.app_id, p.product_code;

-- Everyone inside a retention window right now, for support and for the
-- storage-cost forecast that six months of retained files creates.
create view retention_window_open as
  select s.app_id, s.user_id, p.product_code, s.downgraded_at, s.retention_until
    from subscriptions s
    join plans p on p.plan_id = s.plan_id
   where s.status = 'cancelled'
     and s.retention_until is not null
     and s.retention_until > now();
