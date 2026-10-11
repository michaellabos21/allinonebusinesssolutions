/**
 * A document line's description is one text field. Its first line is the
 * service or product name; anything after it is detail, shown beneath the
 * name on the invoice or estimate. Keeping both in one field means details
 * need no extra column, and documents saved before details existed read as
 * a name with no details.
 */

/** The most the database accepts for a line's description, name and details together. */
export const LINE_TEXT_MAX = 500;

export function splitLineText(text: string) {
  const normalized = text.replace(/\r\n?/g, "\n");
  const end = normalized.indexOf("\n");
  if (end === -1) return { name: normalized.trim(), details: "" };
  return { name: normalized.slice(0, end).trim(), details: normalized.slice(end + 1).trim() };
}

export function joinLineText(name: string, details: string) {
  const title = name.replace(/\s+/g, " ").trim();
  const extra = details.replace(/\r\n?/g, "\n").trim();
  return extra ? `${title}\n${extra}` : title;
}
