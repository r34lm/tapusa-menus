import { describe, expect, it } from "vitest";
import { throwIfError } from "../src/lib/supabase.js";

describe("backend errors", () => {
  it("preserves Supabase errors for UI reporting", () => {
    const error = new Error("Row-level security denied this update");
    expect(() => throwIfError(error)).toThrow(error);
  });

  it("does nothing when a request succeeds", () => {
    expect(() => throwIfError(null)).not.toThrow();
  });
});
