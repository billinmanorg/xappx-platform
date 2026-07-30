-- clients-service · additive: application taxonomy (Bill's brief §6 + §7)
--
-- Widens the application lifecycle from 4 states to the 11 the brief specifies,
-- and records what each application IS (application_type) and who it serves
-- (audience_model: B2C / B2B / B2B2C). Purely additive — existing rows keep
-- their status, and the two new columns are nullable so the three seeded apps
-- (angel-token, angel-twin, twin-protocol) are untouched. No data is destroyed.

-- The old constraint allowed 'suspended', which the new lifecycle retires in
-- favour of 'paused'/'archived'. Migrate any such row before re-constraining so
-- the widen never fails on existing data.
update applications set status = 'paused' where status = 'suspended';

alter table applications drop constraint if exists applications_status_check;
alter table applications
  add constraint applications_status_check
  check (status in (
    'discovery',        -- being scoped, not yet a real config
    'draft',            -- default: exists, not launched
    'configuring',      -- modules/theme being set up
    'in_development',   -- custom work in progress
    'testing',          -- pre-launch validation
    'pending_approval', -- awaiting a human gate
    'published',        -- live to members
    'paused',           -- temporarily off
    'archived',         -- retired, retained
    'exporting',        -- data export in flight
    'independent'       -- graduated off the shared platform
  ));

-- What the application is. Open-ended by design (the brief lists "at least
-- these" types and ends with "Custom application"), so this is free text
-- validated at the API edge, not a DB enum. Nullable: legacy apps predate it.
alter table applications add column if not exists application_type text;

-- Who it serves. A closed set, so the DB enforces it. Nullable for legacy apps.
alter table applications add column if not exists audience_model text
  check (audience_model is null or audience_model in ('b2c','b2b','b2b2c'));

-- The app list filters by status / type / audience / client (brief §6).
create index if not exists applications_status_idx on applications (status);
create index if not exists applications_type_idx on applications (application_type);
create index if not exists applications_audience_idx on applications (audience_model);
