create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('super_admin', 'owner');
create type public.restaurant_status as enum ('active', 'disabled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.app_role not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  logo_url text,
  banner_url text,
  status public.restaurant_status not null default 'active',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.restaurant_memberships (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, position)
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  image_url text,
  available boolean not null default true,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, position)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  target_user_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index restaurants_status_published_idx
  on public.restaurants (status, published);
create index memberships_user_idx
  on public.restaurant_memberships (user_id, restaurant_id);
create index categories_restaurant_position_idx
  on public.menu_categories (restaurant_id, position);
create index items_category_position_idx
  on public.menu_items (category_id, position);
create index audit_events_created_idx
  on public.audit_events (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger restaurants_set_updated_at
before update on public.restaurants
for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
before update on public.menu_categories
for each row execute function public.set_updated_at();

create trigger items_set_updated_at
before update on public.menu_items
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

create or replace function public.owns_restaurant(target_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurant_memberships
    where restaurant_id = target_restaurant_id and user_id = auth.uid()
  );
$$;

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
    and new.role is distinct from old.role
    and not public.is_super_admin()
  then
    raise exception 'Only super administrators may change account roles';
  end if;
  if auth.uid() is not null
    and new.email is distinct from old.email
    and not public.is_super_admin()
  then
    raise exception 'Email must be changed through the authentication service';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_privileges
before update on public.profiles
for each row execute function public.protect_profile_privileges();

grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.owns_restaurant(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_memberships enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles_select_self_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_super_admin());

create policy "profiles_update_self_or_admin"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_super_admin())
with check (id = auth.uid() or public.is_super_admin());

create policy "restaurants_public_read"
on public.restaurants for select
to anon, authenticated
using (
  (status = 'active' and published)
  or public.owns_restaurant(id)
  or public.is_super_admin()
);

create policy "restaurants_admin_insert"
on public.restaurants for insert
to authenticated
with check (public.is_super_admin());

create policy "restaurants_owner_or_admin_update"
on public.restaurants for update
to authenticated
using (public.owns_restaurant(id) or public.is_super_admin())
with check (public.owns_restaurant(id) or public.is_super_admin());

create policy "restaurants_admin_delete"
on public.restaurants for delete
to authenticated
using (public.is_super_admin());

create policy "memberships_select_related_or_admin"
on public.restaurant_memberships for select
to authenticated
using (user_id = auth.uid() or public.is_super_admin());

create policy "memberships_admin_write"
on public.restaurant_memberships for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "categories_public_read"
on public.menu_categories for select
to anon, authenticated
using (
  exists (
    select 1
    from public.restaurants r
    where r.id = restaurant_id
      and r.status = 'active'
      and r.published
  )
  or public.owns_restaurant(restaurant_id)
  or public.is_super_admin()
);

create policy "categories_owner_or_admin_insert"
on public.menu_categories for insert
to authenticated
with check (public.owns_restaurant(restaurant_id) or public.is_super_admin());

create policy "categories_owner_or_admin_update"
on public.menu_categories for update
to authenticated
using (public.owns_restaurant(restaurant_id) or public.is_super_admin())
with check (public.owns_restaurant(restaurant_id) or public.is_super_admin());

create policy "categories_owner_or_admin_delete"
on public.menu_categories for delete
to authenticated
using (public.owns_restaurant(restaurant_id) or public.is_super_admin());

create policy "items_public_read"
on public.menu_items for select
to anon, authenticated
using (
  (
    available
    and exists (
      select 1
      from public.menu_categories c
      join public.restaurants r on r.id = c.restaurant_id
      where c.id = category_id
        and r.status = 'active'
        and r.published
    )
  )
  or exists (
    select 1
    from public.menu_categories c
    where c.id = category_id
      and (public.owns_restaurant(c.restaurant_id) or public.is_super_admin())
  )
);

create policy "items_owner_or_admin_insert"
on public.menu_items for insert
to authenticated
with check (
  exists (
    select 1 from public.menu_categories c
    where c.id = category_id
      and (public.owns_restaurant(c.restaurant_id) or public.is_super_admin())
  )
);

create policy "items_owner_or_admin_update"
on public.menu_items for update
to authenticated
using (
  exists (
    select 1 from public.menu_categories c
    where c.id = category_id
      and (public.owns_restaurant(c.restaurant_id) or public.is_super_admin())
  )
)
with check (
  exists (
    select 1 from public.menu_categories c
    where c.id = category_id
      and (public.owns_restaurant(c.restaurant_id) or public.is_super_admin())
  )
);

create policy "items_owner_or_admin_delete"
on public.menu_items for delete
to authenticated
using (
  exists (
    select 1 from public.menu_categories c
    where c.id = category_id
      and (public.owns_restaurant(c.restaurant_id) or public.is_super_admin())
  )
);

create policy "audit_admin_read"
on public.audit_events for select
to authenticated
using (public.is_super_admin());

create policy "audit_admin_insert"
on public.audit_events for insert
to authenticated
with check (public.is_super_admin() and actor_id = auth.uid());

create or replace function public.reorder_categories(
  target_restaurant_id uuid,
  ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_count integer;
begin
  if not (public.owns_restaurant(target_restaurant_id) or public.is_super_admin()) then
    raise exception 'Not authorized';
  end if;

  select count(*) into category_count
  from public.menu_categories
  where restaurant_id = target_restaurant_id;

  if category_count <> cardinality(ordered_ids)
    or exists (
      select 1 from unnest(ordered_ids) category_id
      where not exists (
        select 1 from public.menu_categories c
        where c.id = category_id and c.restaurant_id = target_restaurant_id
      )
    )
  then
    raise exception 'Category order must contain every category exactly once';
  end if;

  update public.menu_categories
  set position = position + 1000000
  where restaurant_id = target_restaurant_id;

  update public.menu_categories c
  set position = ordered.ordinality - 1
  from unnest(ordered_ids) with ordinality as ordered(id, ordinality)
  where c.id = ordered.id;
end;
$$;

create or replace function public.reorder_items(
  target_category_id uuid,
  ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_restaurant_id uuid;
  item_count integer;
begin
  select restaurant_id into target_restaurant_id
  from public.menu_categories
  where id = target_category_id;

  if target_restaurant_id is null
    or not (public.owns_restaurant(target_restaurant_id) or public.is_super_admin())
  then
    raise exception 'Not authorized';
  end if;

  select count(*) into item_count
  from public.menu_items
  where category_id = target_category_id;

  if item_count <> cardinality(ordered_ids)
    or exists (
      select 1 from unnest(ordered_ids) item_id
      where not exists (
        select 1 from public.menu_items i
        where i.id = item_id and i.category_id = target_category_id
      )
    )
  then
    raise exception 'Item order must contain every item exactly once';
  end if;

  update public.menu_items
  set position = position + 1000000
  where category_id = target_category_id;

  update public.menu_items i
  set position = ordered.ordinality - 1
  from unnest(ordered_ids) with ordinality as ordered(id, ordinality)
  where i.id = ordered.id;
end;
$$;

grant execute on function public.reorder_categories(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_items(uuid, uuid[]) to authenticated;

create or replace function public.get_public_menu(menu_slug text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'restaurant', jsonb_build_object(
      'id', r.id,
      'name', r.name,
      'slug', r.slug,
      'description', r.description,
      'phone', r.phone,
      'email', r.email,
      'address', r.address,
      'logo_url', r.logo_url,
      'banner_url', r.banner_url
    ),
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'position', c.position,
          'items', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', i.id,
                'name', i.name,
                'description', i.description,
                'price_cents', i.price_cents,
                'image_url', i.image_url,
                'available', i.available,
                'position', i.position
              )
              order by i.position
            )
            from public.menu_items i
            where i.category_id = c.id and i.available
          ), '[]'::jsonb)
        )
        order by c.position
      )
      from public.menu_categories c
      where c.restaurant_id = r.id
    ), '[]'::jsonb)
  )
  from public.restaurants r
  where r.slug = menu_slug
    and r.status = 'active'
    and r.published;
$$;

grant execute on function public.get_public_menu(text) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-media',
  'restaurant-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "restaurant_media_public_read"
on storage.objects for select
to public
using (bucket_id = 'restaurant-media');

create policy "restaurant_media_owner_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'restaurant-media'
  and (
    public.owns_restaurant(((storage.foldername(name))[1])::uuid)
    or public.is_super_admin()
  )
);

create policy "restaurant_media_owner_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'restaurant-media'
  and (
    public.owns_restaurant(((storage.foldername(name))[1])::uuid)
    or public.is_super_admin()
  )
)
with check (
  bucket_id = 'restaurant-media'
  and (
    public.owns_restaurant(((storage.foldername(name))[1])::uuid)
    or public.is_super_admin()
  )
);

create policy "restaurant_media_owner_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'restaurant-media'
  and (
    public.owns_restaurant(((storage.foldername(name))[1])::uuid)
    or public.is_super_admin()
  )
);
