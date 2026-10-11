import { describe, expect, it } from "vitest";

import { safeNext } from "@/server/safe-next";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/crm/contacts")).toBe("/crm/contacts");
    expect(safeNext("/invite/abc?x=1")).toBe("/invite/abc?x=1");
  });

  it("falls back for anything that could leave the site", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "",
      "/a://b",
    ]) {
      expect(safeNext(value), value).toBe("/");
    }
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined, "/home")).toBe("/home");
  });
});
