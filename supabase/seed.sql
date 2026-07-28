-- Local development accounts only. Never use these passwords in production.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'admin@tapusa.local',
    extensions.crypt('TapUSA-Demo-2026!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"TapUSA Admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'owner@emberandoak.local',
    extensions.crypt('TapUSA-Demo-2026!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Maya Chen"}',
    now(),
    now()
  )
on conflict (id) do nothing;

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'admin@tapusa.local',
    '{"sub":"10000000-0000-0000-0000-000000000001","email":"admin@tapusa.local"}',
    'email',
    now(),
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'owner@emberandoak.local',
    '{"sub":"10000000-0000-0000-0000-000000000002","email":"owner@emberandoak.local"}',
    'email',
    now(),
    now(),
    now()
  )
on conflict (provider_id, provider) do nothing;

update public.profiles
set role = 'super_admin'
where id = '10000000-0000-0000-0000-000000000001';

insert into public.restaurants (
  id,
  name,
  slug,
  description,
  phone,
  email,
  address,
  status,
  published
)
values (
  '30000000-0000-0000-0000-000000000001',
  'Ember & Oak',
  'ember-and-oak',
  'Seasonal comfort food, wood-fired favorites, and thoughtful cocktails made with locally sourced ingredients.',
  '(512) 555-0148',
  'hello@emberandoak.com',
  '214 West Monroe St, Austin, TX',
  'active',
  true
)
on conflict (id) do nothing;

insert into public.restaurant_memberships (restaurant_id, user_id)
values (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002'
)
on conflict do nothing;

insert into public.menu_categories (id, restaurant_id, name, position)
values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Small Plates', 0),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'From the Fire', 1),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'Dessert', 2)
on conflict (id) do nothing;

insert into public.menu_items (
  id,
  category_id,
  name,
  description,
  price_cents,
  available,
  position
)
values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Whipped Feta', 'Charred grapes, pistachio, warm flatbread', 1200, true, 0),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'Crispy Calamari', 'Calabrian chili, lemon aioli, parsley', 1600, true, 1),
  ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', 'Roasted Beet Salad', 'Goat cheese, citrus, toasted hazelnuts', 1400, false, 2),
  ('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', 'Oak-Grilled Chicken', 'Herb jus, crispy potatoes, market greens', 2600, true, 0),
  ('50000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000002', 'Ember Burger', 'Dry-aged beef, smoked cheddar, house pickles', 1900, true, 1),
  ('50000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000002', 'Cedar Plank Salmon', 'Brown butter, wild rice, grilled lemon', 2900, true, 2),
  ('50000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000003', 'Dark Chocolate Tart', 'Sea salt, olive oil, vanilla cream', 1100, true, 0)
on conflict (id) do nothing;
