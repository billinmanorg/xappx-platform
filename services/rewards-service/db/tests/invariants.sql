\set ON_ERROR_STOP 0
insert into action_catalog (action_code, description) values ('user.signup','User completed signup');
insert into reward_programs (program_id, app_id, name)
values ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1','Onboarding Bonus');
insert into reward_accounts (account_id, program_id, kind)
values ('00000000-0000-0000-0000-0000000000c0','00000000-0000-0000-0000-0000000000b1','pool');
insert into reward_accounts (account_id, program_id, user_id, kind)
values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000e1','user');

\echo '=== 1. EXPECT FAIL: one-sided ledger transaction'
begin;
insert into reward_transactions (transaction_id, program_id, action_code)
values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000b1','user.signup');
insert into ledger_entries (transaction_id, account_id, type, amount)
values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c0','credit',100);
commit;

\echo '=== 2. EXPECT PASS: balanced double-entry transaction'
begin;
insert into reward_transactions (transaction_id, program_id, action_code, status, source_event)
values ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000b1','user.signup','completed','evt-signup-001');
insert into ledger_entries (transaction_id, account_id, type, amount, description) values
  ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000c0','debit', 100,'Onboarding'),
  ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000c1','credit',100,'Onboarding');
commit;
select 'balance: ' || coalesce(sum(case when type='credit' then amount else -amount end),0)::text as result
  from ledger_entries where account_id = '00000000-0000-0000-0000-0000000000c1';

\echo '=== 3. EXPECT FAIL: redelivery of the same event cannot grant twice'
insert into reward_transactions (program_id, action_code, status, source_event)
values ('00000000-0000-0000-0000-0000000000b1','user.signup','completed','evt-signup-001');

\echo '=== 4. EXPECT FAIL: mutating a completed ledger entry'
update ledger_entries set amount = 999
 where transaction_id = '00000000-0000-0000-0000-0000000000d2';
