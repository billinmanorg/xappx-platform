-- Phase 1 fixture: the three brands, created by configuration only.
insert into products (code, name, description, requires, billable, admin_only) values
  ('twins',         'Twins',           'AI twin creation and management',      '{}',        true,  false),
  ('agents',        'Agents',          'Chat, voice and task agents',          '{twins}',   true,  false),
  ('vault',         'Vault',           'Free base vault for every user',       '{}',        false, false),
  ('vault_premium', 'Vault Premium',   'Extra storage + chat with documents',  '{vault}',   true,  false),
  ('video_plan',    'Video Plan',      'Video generation credits',             '{twins}',   true,  false),
  ('community',     'Community',       'Groups, forums and messaging',         '{}',        false, false),
  ('zap_dev',       'Zap Development', 'Client development engagements',       '{}',        true,  true);

insert into clients (client_id, name, slug, jurisdiction)
values ('00000000-0000-0000-0000-000000000001', 'XAPPX', 'xappx', 'US');

insert into applications (app_id, client_id, name, slug, status) values
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','Angel Twin',   'angel-twin',   'draft'),
  ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000001','Twin Protocol','twin-protocol','draft'),
  ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000001','Angel Token',  'angel-token',  'draft');

-- Angel Twin: agents OFF permanently.
insert into app_products (app_id, product_code, enabled, display_name) values
  ('00000000-0000-0000-0000-0000000000a1','twins',         true,  null),
  ('00000000-0000-0000-0000-0000000000a1','vault',         true,  null),
  ('00000000-0000-0000-0000-0000000000a1','vault_premium', true,  'Twin Vault Premium'),
  ('00000000-0000-0000-0000-0000000000a1','video_plan',    true,  'Angel Twin with Video'),
  ('00000000-0000-0000-0000-0000000000a1','community',     true,  null),
  ('00000000-0000-0000-0000-0000000000a1','agents',        false, null);

-- Twin Protocol: agents ON.
insert into app_products (app_id, product_code, enabled) values
  ('00000000-0000-0000-0000-0000000000a2','twins',     true),
  ('00000000-0000-0000-0000-0000000000a2','agents',    true),
  ('00000000-0000-0000-0000-0000000000a2','vault',     true),
  ('00000000-0000-0000-0000-0000000000a2','community', true);

-- Angel Token: info-only.
insert into app_products (app_id, product_code, enabled) values
  ('00000000-0000-0000-0000-0000000000a3','community', true),
  ('00000000-0000-0000-0000-0000000000a3','twins',     false),
  ('00000000-0000-0000-0000-0000000000a3','agents',    false);
