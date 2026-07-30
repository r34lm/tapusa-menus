import { requireSupabase, throwIfError } from "../lib/supabase.js";
import {
  removeMenuImportSource,
  uploadMenuImportSource,
} from "./storage.js";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxSourceSize = 20 * 1024 * 1024;
const maxDimension = 2200;

async function compressMenuImage(file) {
  if (!allowedTypes.has(file.type)) {
    throw new Error("Use JPG, PNG, or WebP menu photos.");
  }
  if (file.size > maxSourceSize) {
    throw new Error("Each menu photo must be smaller than 20 MB.");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error("Unable to prepare this image.")),
      "image/jpeg",
      0.88,
    );
  });

  const baseName = file.name.replace(/\.[^.]+$/, "") || "menu";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}

export async function extractMenuFromImages(restaurantId, files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > 3) {
    throw new Error("Choose between one and three menu photos.");
  }

  const client = requireSupabase();
  const { data: sessionData, error: sessionError } =
    await client.auth.getSession();
  throwIfError(sessionError);
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Sign in again before importing a menu.");

  const uploadedPaths = [];
  try {
    for (const file of files) {
      const preparedFile = await compressMenuImage(file);
      uploadedPaths.push(
        await uploadMenuImportSource(restaurantId, preparedFile),
      );
    }

    const response = await fetch("/api/import-menu", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        restaurantId,
        imagePaths: uploadedPaths,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "The menu could not be imported.");
    }
    return payload;
  } finally {
    await Promise.allSettled(uploadedPaths.map(removeMenuImportSource));
  }
}

export function buildMenuImportPayload(categories) {
  return categories.map((category) => ({
    name: category.name.trim(),
    items: category.items.map((item) => ({
      name: item.name.trim(),
      description: item.description.trim(),
      price_cents: Math.round(Number(item.price) * 100),
    })),
  }));
}

export async function commitImportedMenu(restaurantId, importId, categories) {
  const menuPayload = buildMenuImportPayload(categories);
  const { data, error } = await requireSupabase().rpc("import_menu", {
    target_restaurant_id: restaurantId,
    target_import_id: importId,
    menu_payload: menuPayload,
  });
  throwIfError(error);
  return data;
}
