import { describe, expect, it } from "vitest";
import { buildMenuImportPayload } from "../src/services/menu-import.js";

describe("buildMenuImportPayload", () => {
  it("normalizes reviewed prices to integer cents", () => {
    expect(
      buildMenuImportPayload([
        {
          name: "  Lunch  ",
          items: [
            {
              name: "  Soup  ",
              description: "  Tomato and basil  ",
              price: "12.95",
            },
          ],
        },
      ]),
    ).toEqual([
      {
        name: "Lunch",
        items: [
          {
            name: "Soup",
            description: "Tomato and basil",
            price_cents: 1295,
          },
        ],
      },
    ]);
  });
});
