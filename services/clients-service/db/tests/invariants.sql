\set ON_ERROR_STOP 0
\echo '=== 1. EXPECT FAIL: vault_premium with no vault (Angel Token)'
insert into app_products (app_id, product_code, enabled)
values ('00000000-0000-0000-0000-0000000000a3','vault_premium', true);

\echo '=== 2. EXPECT FAIL: disable vault while vault_premium is on (Angel Twin)'
update app_products set enabled = false
 where app_id = '00000000-0000-0000-0000-0000000000a1' and product_code = 'vault';

\echo '=== 3. EXPECT PASS: manifest version bumps on every toggle change'
select 'version before: ' || manifest_version as result
  from applications where app_id = '00000000-0000-0000-0000-0000000000a2';
update app_products set enabled = false
 where app_id = '00000000-0000-0000-0000-0000000000a2' and product_code = 'community';
select 'version after:  ' || manifest_version as result
  from applications where app_id = '00000000-0000-0000-0000-0000000000a2';

\echo '=== 4. EXPECT PASS: RLS scopes toggles to the current brand'
do $$ begin
  if not exists (select 1 from pg_roles where rolname='app_user') then create role app_user nologin; end if;
end $$;
grant select on app_products to app_user;
set role app_user;
select set_config('xappx.app_id','00000000-0000-0000-0000-0000000000a1', false) is not null as ok;
select 'angel-twin sees ' || count(*)::text as result from app_products;
select set_config('xappx.app_id','00000000-0000-0000-0000-0000000000a3', false) is not null as ok;
select 'angel-token sees ' || count(*)::text as result from app_products;
reset role;
