create table public.menu_imports (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  source_image_count integer not null check (source_image_count between 1 and 3),
  category_count integer not null default 0 check (category_count >= 0),
  item_count integer not null default 0 check (item_count >= 0),
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index menu_imports_restaurant_created_idx
  on public.menu_imports (restaurant_id, created_at desc);

alter table public.menu_imports enable row level security;

create policy "menu_imports_select_own"
on public.menu_imports for select
to authenticated
using (
  user_id = auth.uid()
  and public.owns_restaurant(restaurant_id)
);

create policy "menu_imports_insert_own"
on public.menu_imports for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.owns_restaurant(restaurant_id)
);

create policy "menu_imports_update_own"
on public.menu_imports for update
to authenticated
using (
  user_id = auth.uid()
  and public.owns_restaurant(restaurant_id)
)
with check (
  user_id = auth.uid()
  and public.owns_restaurant(restaurant_id)
);

create or replace function public.reserve_menu_import(
  target_restaurant_id uuid,
  image_count integer
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  import_id uuid;
  imports_this_month integer;
begin
  if not public.owns_restaurant(target_restaurant_id) then
    raise exception 'Not authorized to import this menu';
  end if;

  if image_count < 1 or image_count > 3 then
    raise exception 'Upload between one and three menu images';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_restaurant_id::text, 0));

  select count(*) into imports_this_month
  from public.menu_imports
  where restaurant_id = target_restaurant_id
    and created_at >= date_trunc('month', now());

  if imports_this_month >= 5 then
    raise exception 'MENU_IMPORT_LIMIT_REACHED';
  end if;

  insert into public.menu_imports (restaurant_id, user_id, source_image_count)
  values (target_restaurant_id, auth.uid(), image_count)
  returning id into import_id;

  return import_id;
end;
$$;

create or replace function public.import_menu(
  target_restaurant_id uuid,
  menu_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  category_record record;
  item_record record;
  new_category_id uuid;
  category_position integer;
  imported_categories integer := 0;
  imported_items integer := 0;
  category_name text;
  item_name text;
  item_description text;
  item_price_cents integer;
begin
  if not public.owns_restaurant(target_restaurant_id) then
    raise exception 'Not authorized to import this menu';
  end if;

  if jsonb_typeof(menu_payload) <> 'array'
    or jsonb_array_length(menu_payload) < 1
    or jsonb_array_length(menu_payload) > 30
  then
    raise exception 'Menu must contain between 1 and 30 categories';
  end if;

  select coalesce(max(position), -1) + 1 into category_position
  from public.menu_categories
  where restaurant_id = target_restaurant_id;

  for category_record in
    select value, ordinality
    from jsonb_array_elements(menu_payload) with ordinality
  loop
    category_name := btrim(category_record.value->>'name');
    if category_name is null or char_length(category_name) not between 1 and 80 then
      raise exception 'Every category needs a name between 1 and 80 characters';
    end if;

    if jsonb_typeof(category_record.value->'items') <> 'array'
      or jsonb_array_length(category_record.value->'items') > 100
    then
      raise exception 'Each category must contain at most 100 items';
    end if;

    insert into public.menu_categories (restaurant_id, name, position)
    values (
      target_restaurant_id,
      category_name,
      category_position + category_record.ordinality - 1
    )
    returning id into new_category_id;

    imported_categories := imported_categories + 1;

    for item_record in
      select value, ordinality
      from jsonb_array_elements(category_record.value->'items') with ordinality
    loop
      item_name := btrim(item_record.value->>'name');
      item_description := coalesce(btrim(item_record.value->>'description'), '');

      begin
        item_price_cents := (item_record.value->>'price_cents')::integer;
      exception when others then
        raise exception 'Every item needs a valid price';
      end;

      if item_name is null or char_length(item_name) not between 1 and 120 then
        raise exception 'Every item needs a name between 1 and 120 characters';
      end if;

      if item_price_cents < 0 or item_price_cents > 100000000 then
        raise exception 'Item prices must be between 0 and 1,000,000';
      end if;

      insert into public.menu_items (
        category_id,
        name,
        description,
        price_cents,
        available,
        position
      )
      values (
        new_category_id,
        item_name,
        item_description,
        item_price_cents,
        true,
        item_record.ordinality - 1
      );

      imported_items := imported_items + 1;
      if imported_items > 500 then
        raise exception 'A single import can contain at most 500 items';
      end if;
    end loop;
  end loop;

  if imported_items = 0 then
    raise exception 'The imported menu does not contain any items';
  end if;

  return jsonb_build_object(
    'category_count', imported_categories,
    'item_count', imported_items
  );
end;
$$;

grant execute on function public.reserve_menu_import(uuid, integer) to authenticated;
grant execute on function public.import_menu(uuid, jsonb) to authenticated;
