import { requireSupabase, throwIfError } from "../lib/supabase.js";

const bucket = "restaurant-media";
const importBucket = "menu-import-sources";
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxSize = 10 * 1024 * 1024;

export async function uploadRestaurantImage(restaurantId, kind, file) {
  if (!file) return "";
  if (!allowedTypes.has(file.type)) throw new Error("Use a JPG, PNG, WebP, or GIF image.");
  if (file.size > maxSize) throw new Error("Images must be smaller than 10 MB.");

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${restaurantId}/${kind}/${crypto.randomUUID()}.${extension}`;
  const client = requireSupabase();
  const { error } = await client.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  throwIfError(error);

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function removeRestaurantImage(publicUrl) {
  if (!publicUrl) return;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const path = decodeURIComponent(publicUrl.split(marker)[1] ?? "");
  if (!path) return;

  const { error } = await requireSupabase().storage.from(bucket).remove([path]);
  throwIfError(error);
}

export async function uploadMenuImportSource(restaurantId, file) {
  if (!file) throw new Error("Choose a menu photo.");
  if (!allowedTypes.has(file.type) || file.type === "image/gif") {
    throw new Error("Use a JPG, PNG, or WebP menu photo.");
  }
  if (file.size > maxSize) {
    throw new Error("Menu photos must be smaller than 10 MB after processing.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${restaurantId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await requireSupabase().storage
    .from(importBucket)
    .upload(path, file, {
      cacheControl: "300",
      upsert: false,
      contentType: file.type,
    });
  throwIfError(error);
  return path;
}

export async function removeMenuImportSource(path) {
  if (!path) return;
  const { error } = await requireSupabase().storage
    .from(importBucket)
    .remove([path]);
  throwIfError(error);
}
