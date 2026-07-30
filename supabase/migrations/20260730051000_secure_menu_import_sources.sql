insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-import-sources',
  'menu-import-sources',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "menu_import_sources_owner_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'menu-import-sources'
  and public.owns_restaurant(((storage.foldername(name))[1])::uuid)
);

create policy "menu_import_sources_owner_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'menu-import-sources'
  and public.owns_restaurant(((storage.foldername(name))[1])::uuid)
);

create policy "menu_import_sources_owner_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'menu-import-sources'
  and public.owns_restaurant(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'menu-import-sources'
  and public.owns_restaurant(((storage.foldername(name))[1])::uuid)
);

create policy "menu_import_sources_owner_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'menu-import-sources'
  and public.owns_restaurant(((storage.foldername(name))[1])::uuid)
);

alter table public.menu_imports
  add column if not exists source_paths text[] not null default '{}';

alter table public.menu_imports
  drop constraint if exists menu_imports_status_check;

update public.menu_imports
set status = 'extracted'
where status = 'completed';

alter table public.menu_imports
  add constraint menu_imports_status_check
  check (status in ('processing', 'extracted', 'confirmed', 'failed'));

drop function if exists public.reserve_menu_import(uuid, integer);

create or replace function public.reserve_menu_import(
  target_restaurant_id uuid,
  image_count integer,
  paths text[]
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

  if image_count < 1
    or image_count > 3
    or cardinality(paths) <> image_count
  then
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

  insert into public.menu_imports (
    restaurant_id,
    user_id,
    source_image_count,
    source_paths
  )
  values (
    target_restaurant_id,
    auth.uid(),
    image_count,
    paths
  )
  returning id into import_id;

  return import_id;
end;
$$;

drop function if exists public.import_menu(uuid, jsonb);

create or replace function public.import_menu(
  target_restaurant_id uuid,
  target_import_id uuid,
  menu_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  import_record public.menu_imports%rowtype;
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

  select * into import_record
  from public.menu_imports
  where id = target_import_id
    and restaurant_id = target_restaurant_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Menu import not found';
  end if;

  if import_record.status = 'confirmed' then
    return jsonb_build_object(
      'category_count', import_record.category_count,
      'item_count', import_record.item_count
    );
  end if;

  if import_record.status <> 'extracted' then
    raise exception 'Menu import is not ready to confirm';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_restaurant_id::text, 1));

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

  update public.menu_imports
  set status = 'confirmed',
      category_count = imported_categories,
      item_count = imported_items,
      completed_at = now()
  where id = target_import_id;

  return jsonb_build_object(
    'category_count', imported_categories,
    'item_count', imported_items
  );
end;
$$;

grant execute on function public.reserve_menu_import(uuid, integer, text[]) to authenticated;
grant execute on function public.import_menu(uuid, uuid, jsonb) to authenticated;
