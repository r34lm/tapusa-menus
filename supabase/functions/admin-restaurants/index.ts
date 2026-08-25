import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AdminAction =
  | "create"
  | "update"
  | "set_status"
  | "reset_password"
  | "transfer_menu"
  | "delete";

interface AdminRequest {
  action: AdminAction;
  restaurantId?: string;
  destinationRestaurantId?: string;
  ownerId?: string;
  name?: string;
  slug?: string;
  ownerName?: string;
  email?: string;
  status?: "active" | "disabled";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const siteUrl = (Deno.env.get("SITE_URL") ?? "http://localhost:4173").replace(/\/$/, "");
  const authorization = request.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return json({ error: "Function environment or authorization is missing" }, 401);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Invalid session" }, 401);

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profileError || profile?.role !== "super_admin") {
    return json({ error: "Super administrator access required" }, 403);
  }

  try {
    const body = (await request.json()) as AdminRequest;
    let restaurantId = body.restaurantId ?? null;
    let targetUserId = body.ownerId ?? null;
    let result: Record<string, unknown> = {};
    let actionMetadata: Record<string, unknown> = {};

    if (body.action === "create") {
      const name = requireString(body.name, "name");
      const slug = requireString(body.slug, "slug");
      const ownerName = requireString(body.ownerName, "ownerName");
      const email = requireString(body.email, "email").toLowerCase();

      const { data: invited, error: inviteError } =
        await adminClient.auth.admin.inviteUserByEmail(email, {
          data: { full_name: ownerName },
          redirectTo: `${siteUrl}/set-password`,
        });
      if (inviteError || !invited.user) throw inviteError ?? new Error("Owner invitation failed");
      targetUserId = invited.user.id;

      const { data: restaurant, error: restaurantError } = await adminClient
        .from("restaurants")
        .insert({ name, slug, email })
        .select("id, name, slug, status")
        .single();

      if (restaurantError) {
        await adminClient.auth.admin.deleteUser(targetUserId);
        throw restaurantError;
      }
      restaurantId = restaurant.id;

      const { error: membershipError } = await adminClient
        .from("restaurant_memberships")
        .insert({ restaurant_id: restaurantId, user_id: targetUserId });
      if (membershipError) {
        await adminClient.from("restaurants").delete().eq("id", restaurantId);
        await adminClient.auth.admin.deleteUser(targetUserId);
        throw membershipError;
      }

      result = { restaurant, ownerId: targetUserId };
    } else if (body.action === "update") {
      restaurantId = requireString(body.restaurantId, "restaurantId");
      targetUserId = requireString(body.ownerId, "ownerId");
      const restaurantChanges: Record<string, string> = {};

      if (body.name) restaurantChanges.name = body.name.trim();
      if (body.slug) restaurantChanges.slug = body.slug.trim();
      if (body.email) restaurantChanges.email = body.email.trim().toLowerCase();

      const { data: restaurant, error } = await adminClient
        .from("restaurants")
        .update(restaurantChanges)
        .eq("id", restaurantId)
        .select("id, name, slug, status")
        .single();
      if (error) throw error;

      if (body.ownerName || body.email) {
        const authChanges: { email?: string; user_metadata?: Record<string, string> } = {};
        if (body.email) authChanges.email = body.email.trim().toLowerCase();
        if (body.ownerName) authChanges.user_metadata = { full_name: body.ownerName.trim() };
        const { error: authError } = await adminClient.auth.admin.updateUserById(
          targetUserId,
          authChanges,
        );
        if (authError) throw authError;

        const profileChanges: { email?: string; full_name?: string } = {};
        if (body.email) profileChanges.email = body.email.trim().toLowerCase();
        if (body.ownerName) profileChanges.full_name = body.ownerName.trim();
        const { error: ownerError } = await adminClient
          .from("profiles")
          .update(profileChanges)
          .eq("id", targetUserId);
        if (ownerError) throw ownerError;
      }
      result = { restaurant, ownerId: targetUserId };
    } else if (body.action === "set_status") {
      restaurantId = requireString(body.restaurantId, "restaurantId");
      const status = body.status;
      if (status !== "active" && status !== "disabled") throw new Error("Invalid status");

      const { data: memberships, error: membershipError } = await adminClient
        .from("restaurant_memberships")
        .select("user_id")
        .eq("restaurant_id", restaurantId);
      if (membershipError) throw membershipError;

      const { data: restaurant, error } = await adminClient
        .from("restaurants")
        .update({ status, published: status === "disabled" ? false : undefined })
        .eq("id", restaurantId)
        .select("id, name, slug, status")
        .single();
      if (error) throw error;

      for (const membership of memberships ?? []) {
        await adminClient.auth.admin.updateUserById(membership.user_id, {
          ban_duration: status === "disabled" ? "876000h" : "none",
        });
      }
      result = { restaurant };
    } else if (body.action === "reset_password") {
      const email = requireString(body.email, "email").toLowerCase();
      const { error } = await callerClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/set-password`,
      });
      if (error) throw error;
      result = { sent: true };
    } else if (body.action === "transfer_menu") {
      restaurantId = requireString(body.restaurantId, "restaurantId");
      const destinationRestaurantId = requireString(
        body.destinationRestaurantId,
        "destinationRestaurantId",
      );
      if (restaurantId === destinationRestaurantId) {
        throw new Error("Source and destination portals must be different");
      }

      const bucket = adminClient.storage.from("restaurant-media");
      const sourcePrefix = `${restaurantId}/items`;
      const destinationPrefix = `${destinationRestaurantId}/items`;
      const [
        { data: sourceFiles, error: sourceListError },
        { data: destinationFiles, error: destinationListError },
      ] = await Promise.all([
        bucket.list(sourcePrefix, { limit: 1000 }),
        bucket.list(destinationPrefix, { limit: 1000 }),
      ]);
      if (sourceListError) throw sourceListError;
      if (destinationListError) throw destinationListError;

      const sourcePaths = (sourceFiles ?? []).map(
        (file) => `${sourcePrefix}/${file.name}`,
      );
      const oldDestinationPaths = (destinationFiles ?? []).map(
        (file) => `${destinationPrefix}/${file.name}`,
      );
      const copiedPaths: string[] = [];

      try {
        for (const sourcePath of sourcePaths) {
          const fileName = sourcePath.slice(sourcePath.lastIndexOf("/") + 1);
          const destinationPath = `${destinationPrefix}/${fileName}`;
          const { error: copyError } = await bucket.copy(
            sourcePath,
            destinationPath,
          );
          if (copyError) throw copyError;
          copiedPaths.push(destinationPath);
        }

        const { data: transfer, error: transferError } = await adminClient.rpc(
          "transfer_restaurant_menu",
          {
            source_restaurant_id: restaurantId,
            destination_restaurant_id: destinationRestaurantId,
          },
        );
        if (transferError) throw transferError;

        const cleanupPaths = [...sourcePaths, ...oldDestinationPaths];
        if (cleanupPaths.length) {
          const { error: cleanupError } = await bucket.remove(cleanupPaths);
          if (cleanupError) {
            console.error("Menu transfer storage cleanup failed", cleanupError);
          }
        }

        result = {
          transfer,
          copiedItemImages: copiedPaths.length,
          destinationRestaurantId,
        };
        actionMetadata = {
          ...(typeof transfer === "object" && transfer ? transfer : {}),
          source_restaurant_id: restaurantId,
          destination_restaurant_id: destinationRestaurantId,
          copied_item_images: copiedPaths.length,
        };
      } catch (error) {
        if (copiedPaths.length) {
          const { error: rollbackError } = await bucket.remove(copiedPaths);
          if (rollbackError) {
            console.error("Menu transfer storage rollback failed", rollbackError);
          }
        }
        throw error;
      }
    } else if (body.action === "delete") {
      restaurantId = requireString(body.restaurantId, "restaurantId");
      targetUserId = requireString(body.ownerId, "ownerId");

      for (const kind of ["logo", "banner", "items"]) {
        const { data: files } = await adminClient.storage
          .from("restaurant-media")
          .list(`${restaurantId}/${kind}`, { limit: 1000 });
        const paths = (files ?? []).map(
          (file) => `${restaurantId}/${kind}/${file.name}`,
        );
        if (paths.length) {
          await adminClient.storage.from("restaurant-media").remove(paths);
        }
      }

      const { error: restaurantError } = await adminClient
        .from("restaurants")
        .delete()
        .eq("id", restaurantId);
      if (restaurantError) throw restaurantError;

      const { error: userDeleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
      if (userDeleteError) throw userDeleteError;
      result = { deleted: true };
    } else {
      return json({ error: "Unsupported action" }, 400);
    }

    await adminClient.from("audit_events").insert({
      actor_id: userData.user.id,
      restaurant_id:
        body.action === "delete"
          ? null
          : body.action === "transfer_menu"
            ? body.destinationRestaurantId
            : restaurantId,
      target_user_id: targetUserId,
      action: `restaurant.${body.action}`,
      metadata: {
        ...actionMetadata,
        restaurant_id: restaurantId,
        destination_restaurant_id: body.destinationRestaurantId ?? null,
        status: body.status ?? null,
        email: body.email ?? null,
      },
    });

    return json({ data: result });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unexpected admin operation error";
    return json({ error: message }, 400);
  }
});
