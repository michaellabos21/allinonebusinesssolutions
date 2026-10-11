import { createHash, randomBytes } from "node:crypto";

/** How long an invitation link works. */
export const INVITATION_TTL_DAYS = 7;

/**
 * A new invitation token and its hash. The token goes into the link given to
 * the inviter; only the hash is stored, so the database never holds anything
 * that could be used to accept an invitation.
 */
export function createInvitationToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Tokens are 32 random bytes in base64url: 43 characters from a fixed alphabet. */
export function looksLikeInvitationToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
