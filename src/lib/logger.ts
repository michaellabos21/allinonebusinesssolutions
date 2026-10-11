/**
 * One logging entry point for the app.
 *
 * Every entry is an event name plus structured fields, written as a single
 * JSON line so a log platform can index it later without code changes.
 * Rules: name events `area.what_happened`; never log passwords, tokens,
 * secrets or request bodies; log ids, not personal data.
 */
type Fields = Record<string, string | number | boolean | null | undefined>;
type Level = "info" | "warn" | "error";

function write(level: Level, event: string, fields: Fields = {}) {
  const entry = JSON.stringify({ level, event, at: new Date().toISOString(), ...fields });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export const logger = {
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};
