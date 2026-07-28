import { describe, expect, it } from "vitest";
import { slugify } from "../src/utils/slug.js";

describe("slugify", () => {
  it("creates URL-safe restaurant slugs", () => {
    expect(slugify("  Ember & Oak  ")).toBe("ember-oak");
    expect(slugify("Casa   Verde!")).toBe("casa-verde");
  });

  it("removes leading and trailing separators", () => {
    expect(slugify("---North & Main---")).toBe("north-main");
  });
});
