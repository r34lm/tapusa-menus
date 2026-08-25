import { FunctionsHttpError } from "@supabase/supabase-js";
import { requireSupabase, throwIfError } from "../lib/supabase.js";

async function invokeAdmin(body) {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  throwIfError(sessionError);
  if (!sessionData.session?.access_token) {
    throw new Error("Your session has expired. Sign in again and retry.");
  }

  const { data, error } = await client.functions.invoke(
    "admin-restaurants",
    {
      body,
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    },
  );
  if (error instanceof FunctionsHttpError) {
    let message = error.message;
    try {
      const payload = await error.context.json();
      message = payload?.error || payload?.message || message;
    } catch {
      // The response was not JSON; retain the SDK error message.
    }
    throw new Error(message);
  }
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

export function transferRestaurantMenu(sourceRestaurantId, destinationRestaurantId) {
  return invokeAdmin({
    action: "transfer_menu",
    restaurantId: sourceRestaurantId,
    destinationRestaurantId,
  });
}
