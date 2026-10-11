/**
 * Where to send someone after signing in. Only same-site paths are allowed, so
 * a crafted link cannot bounce a user to another website.
 */
export function safeNext(value: FormDataEntryValue | string | null | undefined, fallback = "/") {
  if (typeof value !== "string") return fallback;
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("://")
  ) {
    return fallback;
  }
  return value;
}
