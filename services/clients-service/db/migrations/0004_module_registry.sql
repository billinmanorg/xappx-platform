-- clients-service · additive: module registry state (Bill's Phase 2)
--
-- A module (product) now carries its own lifecycle state, separate from whether
-- any given app has it switched on. This is the platform catalogue's view of a
-- module: is it generally available, in beta, announced but not ready, or
-- retired. Purely additive — every existing module defaults to 'available', and
-- sort_order defaults to 0 (registry falls back to alphabetical).
alter table products add column if not exists status text not null default 'available'
  check (status in ('available', 'beta', 'coming_soon', 'retired'));
alter table products add column if not exists sort_order int not null default 0;
create index if not exists products_status_idx on products (status);
