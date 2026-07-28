export function mapRestaurant(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    logo: row.logo_url ?? "",
    banner: row.banner_url ?? "",
    status: row.status,
    published: row.published,
    createdAt: row.created_at,
  };
}

export function mapItem(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    price: row.price_cents / 100,
    image: row.image_url ?? "",
    available: row.available,
    position: row.position,
    emoji: "🍽️",
  };
}

export function mapCategory(row) {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    items: (row.menu_items ?? row.items ?? [])
      .map(mapItem)
      .sort((a, b) => a.position - b.position),
  };
}

export function mapWorkspace(restaurantRow, categoryRows = []) {
  return {
    restaurant: mapRestaurant(restaurantRow),
    categories: categoryRows
      .map(mapCategory)
      .sort((a, b) => a.position - b.position),
  };
}

export function mapPublicMenu(payload) {
  if (!payload?.restaurant) return null;
  return mapWorkspace(
    payload.restaurant,
    (payload.categories ?? []).map((category) => ({
      ...category,
      menu_items: category.items ?? [],
    })),
  );
}

export function mapAdminRestaurant(row) {
  const membership = row.restaurant_memberships?.[0];
  const owner = membership?.profiles;
  const itemCount = (row.menu_categories ?? []).reduce(
    (total, category) => total + (category.menu_items?.[0]?.count ?? 0),
    0,
  );

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerId: membership?.user_id ?? owner?.id ?? "",
    owner: owner?.full_name ?? "Unassigned",
    email: owner?.email ?? row.email ?? "",
    status: row.status,
    items: itemCount,
    joined: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(row.created_at)),
  };
}
