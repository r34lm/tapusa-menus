import { requireSupabase, throwIfError } from "../lib/supabase.js";

async function invokeAdmin(body) {
  const { data, error } = await requireSupabase().functions.invoke(
    "admin-restaurants",
    { body },
  );
  throwIfError(error);
  if (data?.error) throw new Error(data.error);
  return data?.data;
}

export function createRestaurantAccount(account) {
  return invokeAdmin({
    action: "create",
    name: account.name,
    slug: account.slug,
    ownerName: account.owner,
    email: account.email,
  });
}

export function updateRestaurantAccount(account) {
  return invokeAdmin({
    action: "update",
    restaurantId: account.id,
    ownerId: account.ownerId,
    name: account.name,
    slug: account.slug,
    ownerName: account.owner,
    email: account.email,
  });
}

export function setRestaurantAccountStatus(restaurantId, status) {
  return invokeAdmin({ action: "set_status", restaurantId, status });
}

export function resetOwnerPassword(email) {
  return invokeAdmin({ action: "reset_password", email });
}

export function deleteRestaurantAccount(restaurantId, ownerId) {
  return invokeAdmin({ action: "delete", restaurantId, ownerId });
}
