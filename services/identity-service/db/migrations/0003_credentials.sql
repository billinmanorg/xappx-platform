-- identity-service · 0003 — password credentials
--
-- Real authentication lives here now: identity-service owns users and sessions,
-- so it is the cohesive home for the secret that proves a user is who they say.
-- Credentials are kept in their own table, one row per user, so nothing that
-- reads a user profile ever selects a password hash by accident.
--
-- The hash is a scrypt digest (salt embedded), never a password. Additive
-- migration; 0001 and 0002 have already run and are never edited.

create table credentials (
  user_id       uuid primary key references users(user_id) on delete cascade,
  password_hash text not null,          -- scrypt$N$r$p$salt$hash — never the password
  updated_at    timestamptz not null default now()
);
