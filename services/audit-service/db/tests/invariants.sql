\set ON_ERROR_STOP 0
insert into audit_log (app_id, actor_id, service, resource, action)
values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1','clients-service','app_products','product.disabled');
\echo '=== 1. EXPECT FAIL: updating an audit row'
update audit_log set action = 'tampered' where service = 'clients-service';
\echo '=== 2. EXPECT FAIL: deleting an audit row'
delete from audit_log where service = 'clients-service';
\echo '=== 3. EXPECT PASS: the row is still there, unchanged'
select 'action still: ' || action as result from audit_log where service = 'clients-service';
