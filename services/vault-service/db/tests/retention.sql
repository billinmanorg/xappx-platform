\set ON_ERROR_STOP 0
insert into vaults (vault_id, client_id, app_id, owner_id, name, encryption_key_id)
values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1',
        'My Vault','kms://key-1');
insert into files (file_id, vault_id, app_id, name, checksum, storage_key, size_bytes)
values ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000f1',
        '00000000-0000-0000-0000-0000000000a1','contract.pdf','sha256:abc','s3://x/1',1024);

\echo '=== 1. EXPECT PASS: downgrade opens a 6-month hold and deletes nothing'
insert into retention_holds (app_id, user_id, vault_id, reason, delete_after, source_event)
values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1',
        '00000000-0000-0000-0000-0000000000f1','downgrade', now() + interval '6 months','evt-downgrade-001');
select 'files present: ' || count(*)::text as result from files where deleted_at is null;
select 'deletes after: ' || to_char(delete_after,'YYYY-MM-DD') as result from retention_holds;

\echo '=== 2. EXPECT FAIL: redelivered event cannot restart the clock'
insert into retention_holds (app_id, user_id, vault_id, reason, delete_after, source_event)
values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1',
        '00000000-0000-0000-0000-0000000000f1','downgrade', now() + interval '6 months','evt-downgrade-001');

\echo '=== 3. EXPECT FAIL: vault frozen while the hold is active'
insert into files (vault_id, app_id, name, checksum, storage_key)
values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a1','new.pdf','sha256:def','s3://x/2');

\echo '=== 4. EXPECT PASS: nothing due for deletion yet'
select 'due now: ' || count(*)::text as result from retention_due;

\echo '=== 5. EXPECT PASS: resubscribing restores the hold, files intact'
select restore_retention_hold(hold_id) from retention_holds where status = 'active';
select 'hold status: ' || status as result from retention_holds;
select 'files present: ' || count(*)::text as result from files where deleted_at is null;

\echo '=== 6. EXPECT PASS: vault writable again after restore'
insert into files (vault_id, app_id, name, checksum, storage_key)
values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a1','new.pdf','sha256:def','s3://x/2');
select 'files present: ' || count(*)::text as result from files where deleted_at is null;

\echo '=== 7. EXPECT PASS: an expired hold appears in the deletion queue'
insert into retention_holds (app_id, user_id, vault_id, reason, delete_after, source_event)
values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1',
        '00000000-0000-0000-0000-0000000000f1','downgrade', now() - interval '1 day','evt-downgrade-002');
select 'due now: ' || count(*)::text || ' hold, ' || sum(live_files)::text || ' files, scope=' || min(deletion_scope) as result
  from retention_due;
