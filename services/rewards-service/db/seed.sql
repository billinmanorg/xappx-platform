-- Rewards seed. The XAPPX economy runs on Twin Points, which convert to Twin
-- Tokens. Points are live from day one; conversion is gated (ADR-007) until the
-- compliance work is done, but the currency and the batch table exist now so
-- conversion is not a retrofit onto a live ledger.

insert into action_catalog (action_code, description) values
  ('user.signup',          'User completed signup'),
  ('onboarding.completed', 'User finished onboarding'),
  ('twin.created',         'User created a twin'),
  ('course.completed',     'User completed a course'),
  ('referral.registered',  'Referred user registered'),
  ('referral.qualified',   'Referral met qualification criteria'),
  ('purchase.completed',   'User completed a purchase');

-- currency = twin_points. The ledger is currency-agnostic: a token program is
-- another program row with a different currency, and conversion is a transfer
-- between them - never an edit to a completed entry.
insert into reward_programs (program_id, app_id, name, currency, active) values
  ('00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000a1',
   'Twin Points', 'twin_points', true);

-- Every program needs a pool account: points are issued FROM somewhere, so
-- total debits equal total credits and the ledger stays provable.
insert into reward_accounts (account_id, program_id, kind) values
  ('00000000-0000-0000-0000-0000000000c0','00000000-0000-0000-0000-0000000000b1','pool');
