create or replace function public.transfer_restaurant_menu(
  source_restaurant_id uuid,
  destination_restaurant_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_slug text;
  destination_slug text;
  source_published boolean;
  destination_published boolean;
  temporary_slug text;
  source_category_count integer;
  source_item_count integer;
  replaced_category_count integer;
  replaced_item_count integer;
begin
  if source_restaurant_id = destination_restaurant_id then
    raise exception 'Source and destination portals must be different';
  end if;

  perform id
  from public.restaurants
  where id = any(array[source_restaurant_id, destination_restaurant_id])
  order by id
  for update;

  if (
    select count(*)
    from public.restaurants
    where id = any(array[source_restaurant_id, destination_restaurant_id])
  ) <> 2 then
    raise exception 'Source or destination portal was not found';
  end if;

  select slug, published
  into source_slug, source_published
  from public.restaurants
  where id = source_restaurant_id;

  select slug, published
  into destination_slug, destination_published
  from public.restaurants
  where id = destination_restaurant_id;

  select count(*)
  into source_category_count
  from public.menu_categories
  where restaurant_id = source_restaurant_id;

  if source_category_count = 0 then
    raise exception 'The source portal has no menu to transfer';
  end if;

  select count(*)
  into source_item_count
  from public.menu_items item
  join public.menu_categories category on category.id = item.category_id
  where category.restaurant_id = source_restaurant_id;

  select count(*)
  into replaced_category_count
  from public.menu_categories
  where restaurant_id = destination_restaurant_id;

  select count(*)
  into replaced_item_count
  from public.menu_items item
  join public.menu_categories category on category.id = item.category_id
  where category.restaurant_id = destination_restaurant_id;

  delete from public.menu_categories
  where restaurant_id = destination_restaurant_id;

  update public.menu_categories
  set restaurant_id = destination_restaurant_id
  where restaurant_id = source_restaurant_id;

  update public.menu_items item
  set image_url = replace(
    item.image_url,
    source_restaurant_id::text || '/items/',
    destination_restaurant_id::text || '/items/'
  )
  from public.menu_categories category
  where item.category_id = category.id
    and category.restaurant_id = destination_restaurant_id
    and item.image_url is not null;

  temporary_slug :=
    'transfer-' ||
    replace(source_restaurant_id::text, '-', '') ||
    '-' ||
    replace(destination_restaurant_id::text, '-', '');

  update public.restaurants
  set slug = temporary_slug
  where id = source_restaurant_id;

  update public.restaurants
  set slug = source_slug,
      published = source_published
  where id = destination_restaurant_id;

  update public.restaurants
  set slug = destination_slug,
      published = destination_published
  where id = source_restaurant_id;

  return jsonb_build_object(
    'source_restaurant_id', source_restaurant_id,
    'destination_restaurant_id', destination_restaurant_id,
    'source_slug_before', source_slug,
    'destination_slug_before', destination_slug,
    'source_slug_after', destination_slug,
    'destination_slug_after', source_slug,
    'category_count', source_category_count,
    'item_count', source_item_count,
    'replaced_category_count', replaced_category_count,
    'replaced_item_count', replaced_item_count
  );
end;
$$;

revoke execute on function public.transfer_restaurant_menu(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.transfer_restaurant_menu(uuid, uuid)
to service_role;
