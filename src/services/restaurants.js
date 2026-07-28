import { requireSupabase, throwIfError } from "../lib/supabase.js";
import {
  mapAdminRestaurant,
  mapPublicMenu,
  mapRestaurant,
  mapWorkspace,
} from "./mappers.js";

export async function loadRestaurantWorkspace(restaurantId) {
  const client = requireSupabase();
  const { data: restaurant, error: restaurantError } = await client
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .single();
  throwIfError(restaurantError);

  const { data: categories, error: categoryError } = await client
    .from("menu_categories")
    .select("*, menu_items(*)")
    .eq("restaurant_id", restaurantId)
    .order("position")
    .order("position", { referencedTable: "menu_items" });
  throwIfError(categoryError);

  return mapWorkspace(restaurant, categories);
}

export async function loadOwnerWorkspace(userId) {
  const client = requireSupabase();
  const { data: membership, error } = await client
    .from("restaurant_memberships")
    .select("restaurant_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  throwIfError(error);
  if (!membership) return null;
  return loadRestaurantWorkspace(membership.restaurant_id);
}

export async function updateRestaurant(restaurantId, changes) {
  const payload = {
    name: changes.name,
    slug: changes.slug,
    description: changes.description,
    phone: changes.phone,
    email: changes.email,
    address: changes.address,
  };
  if ("logo" in changes) payload.logo_url = changes.logo || null;
  if ("banner" in changes) payload.banner_url = changes.banner || null;

  const { data, error } = await requireSupabase()
    .from("restaurants")
    .update(payload)
    .eq("id", restaurantId)
    .select()
    .single();
  throwIfError(error);
  return mapRestaurant(data);
}

export async function setPublished(restaurantId, published) {
  const { data, error } = await requireSupabase()
    .from("restaurants")
    .update({ published })
    .eq("id", restaurantId)
    .select()
    .single();
  throwIfError(error);
  return mapRestaurant(data);
}

export async function getPublicMenu(slug) {
  const { data, error } = await requireSupabase().rpc("get_public_menu", {
    menu_slug: slug,
  });
  throwIfError(error);
  return mapPublicMenu(data);
}

export async function listAdminRestaurants() {
  const { data, error } = await requireSupabase()
    .from("restaurants")
    .select(`
      *,
      restaurant_memberships(
        user_id,
        profiles(id, full_name, email)
      ),
      menu_categories(
        menu_items(count)
      )
    `)
    .order("created_at", { ascending: false });
  throwIfError(error);
  return (data ?? []).map(mapAdminRestaurant);
}
