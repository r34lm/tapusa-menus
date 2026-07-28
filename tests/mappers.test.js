import { describe, expect, it } from "vitest";
import {
  mapItem,
  mapPublicMenu,
  mapWorkspace,
} from "../src/services/mappers.js";

describe("backend row mappers", () => {
  it("converts integer cents to display prices", () => {
    expect(
      mapItem({
        id: "item-1",
        name: "Burger",
        description: "",
        price_cents: 1899,
        image_url: null,
        available: true,
        position: 0,
      }).price,
    ).toBe(18.99);
  });

  it("sorts categories and items by backend positions", () => {
    const workspace = mapWorkspace(
      {
        id: "restaurant-1",
        name: "Test",
        slug: "test",
        status: "active",
        published: true,
      },
      [
        {
          id: "category-2",
          name: "Second",
          position: 1,
          menu_items: [],
        },
        {
          id: "category-1",
          name: "First",
          position: 0,
          menu_items: [
            {
              id: "item-2",
              name: "Second item",
              price_cents: 200,
              position: 1,
              available: true,
            },
            {
              id: "item-1",
              name: "First item",
              price_cents: 100,
              position: 0,
              available: true,
            },
          ],
        },
      ],
    );

    expect(workspace.categories.map((category) => category.name)).toEqual([
      "First",
      "Second",
    ]);
    expect(workspace.categories[0].items.map((item) => item.name)).toEqual([
      "First item",
      "Second item",
    ]);
  });

  it("maps the public RPC payload and rejects empty results", () => {
    expect(mapPublicMenu(null)).toBeNull();
    expect(
      mapPublicMenu({
        restaurant: {
          id: "restaurant-1",
          name: "Ember & Oak",
          slug: "ember-and-oak",
          logo_url: "logo.webp",
        },
        categories: [],
      }).restaurant.logo,
    ).toBe("logo.webp");
  });
});
