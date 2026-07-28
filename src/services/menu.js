import { requireSupabase, throwIfError } from "../lib/supabase.js";
import { mapCategory, mapItem } from "./mappers.js";

async function nextPosition(table, foreignKey, foreignId) {
  const { data, error } = await requireSupabase()
    .from(table)
    .select("position")
    .eq(foreignKey, foreignId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(error);
  return (data?.position ?? -1) + 1;
}

export async function createCategory(restaurantId, name) {
  const position = await nextPosition("menu_categories", "restaurant_id", restaurantId);
  const { data, error } = await requireSupabase()
    .from("menu_categories")
    .insert({ restaurant_id: restaurantId, name, position })
    .select()
    .single();
  throwIfError(error);
  return mapCategory({ ...data, menu_items: [] });
}

export async function updateCategory(categoryId, name) {
  const { data, error } = await requireSupabase()
    .from("menu_categories")
    .update({ name })
    .eq("id", categoryId)
    .select()
    .single();
  throwIfError(error);
  return mapCategory({ ...data, menu_items: [] });
}

export async function deleteCategory(categoryId) {
  const { error } = await requireSupabase()
    .from("menu_categories")
    .delete()
    .eq("id", categoryId);
  throwIfError(error);
}

export async function reorderCategories(restaurantId, orderedIds) {
  const { error } = await requireSupabase().rpc("reorder_categories", {
    target_restaurant_id: restaurantId,
    ordered_ids: orderedIds,
  });
  throwIfError(error);
}

export async function createMenuItem(categoryId, item) {
  const position = await nextPosition("menu_items", "category_id", categoryId);
  const { data, error } = await requireSupabase()
    .from("menu_items")
    .insert({
      category_id: categoryId,
      name: item.name,
      description: item.description,
      price_cents: Math.round(Number(item.price) * 100),
      image_url: item.image || null,
      available: item.available,
      position,
    })
    .select()
    .single();
  throwIfError(error);
  return mapItem(data);
}

export async function updateMenuItem(itemId, oldCategoryId, categoryId, item) {
  const payload = {
    category_id: categoryId,
    name: item.name,
    description: item.description,
    price_cents: Math.round(Number(item.price) * 100),
    image_url: item.image || null,
    available: item.available,
  };
  if (oldCategoryId !== categoryId) {
    payload.position = await nextPosition("menu_items", "category_id", categoryId);
  }

  const { data, error } = await requireSupabase()
    .from("menu_items")
    .update(payload)
    .eq("id", itemId)
    .select()
    .single();
  throwIfError(error);
  return mapItem(data);
}

export async function setItemAvailability(itemId, available) {
  const { data, error } = await requireSupabase()
    .from("menu_items")
    .update({ available })
    .eq("id", itemId)
    .select()
    .single();
  throwIfError(error);
  return mapItem(data);
}

export async function deleteMenuItem(itemId) {
  const { error } = await requireSupabase()
    .from("menu_items")
    .delete()
    .eq("id", itemId);
  throwIfError(error);
}

export async function reorderMenuItems(categoryId, orderedIds) {
  const { error } = await requireSupabase().rpc("reorder_items", {
    target_category_id: categoryId,
    ordered_ids: orderedIds,
  });
  throwIfError(error);
}
