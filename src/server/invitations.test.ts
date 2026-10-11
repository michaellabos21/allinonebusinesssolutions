import { describe, expect, it } from "vitest";

import {
  createInvitationToken,
  hashInvitationToken,
  looksLikeInvitationToken,
} from "@/server/invitations";

describe("invitation tokens", () => {
  it("creates a URL-safe token and a matching SHA-256 hash", () => {
    const { token, tokenHash } = createInvitationToken();
    expect(looksLikeInvitationToken(token)).toBe(true);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInvitationToken(token)).toBe(tokenHash);
  });

  it("never repeats", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => createInvitationToken().token));
    expect(tokens.size).toBe(50);
  });

  it("does not store anything that reveals the token", () => {
    const { token, tokenHash } = createInvitationToken();
    expect(tokenHash).not.toContain(token);
  });

  it("rejects strings that are not tokens", () => {
    for (const value of [
      "",
      "short",
      "a".repeat(44),
      "has spaces in it".padEnd(43, "x"),
      "../../etc/passwd".padEnd(43, "x"),
    ]) {
      expect(looksLikeInvitationToken(value), value).toBe(false);
    }
  });
});
