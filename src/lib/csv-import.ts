import { type ImportRow, fieldErrorsOf, importRowSchema } from "@/server/validation";

/**
 * Contact CSV import, browser side: parse the file, map its columns to contact
 * fields, and check every row before anything is sent. The server checks each
 * row again, and the database writes them in one transaction.
 */

export const IMPORT_FIELDS = [
  { id: "name", label: "Name", required: true },
  { id: "email", label: "Email", required: true },
  { id: "phone", label: "Phone", required: false },
  { id: "title", label: "Job title", required: false },
  { id: "company", label: "Company", required: false },
  { id: "status", label: "Status", required: false },
  { id: "tags", label: "Tags", required: false },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["id"];
/** Column index for each field; -1 means the field is not imported. */
export type ColumnMapping = Record<ImportField, number>;

/** Largest file accepted, well above 500 rows of contact details. */
export const IMPORT_MAX_BYTES = 1024 * 1024;

/**
 * Parses CSV text (RFC 4180: quoted fields, doubled quotes, commas and line
 * breaks inside quotes, CRLF or LF). Drops a leading byte-order mark and
 * blank lines.
 */
export function parseCsv(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const endRow = () => {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    row = [];
    field = "";
  };

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      endRow();
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

const HEADER_HINTS: Record<ImportField, string[]> = {
  name: ["name", "full name", "fullname", "contact", "contact name"],
  email: ["email", "e-mail", "email address", "mail"],
  phone: ["phone", "phone number", "mobile", "telephone", "tel"],
  title: ["title", "job title", "role", "position"],
  company: ["company", "company name", "organization", "organisation", "account"],
  status: ["status"],
  tags: ["tags", "tag", "labels"],
};

const normalize = (header: string) =>
  header
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ");

/** Matches columns to fields by their header names. Unmatched fields get -1. */
export function guessMapping(headers: string[]): ColumnMapping {
  const names = headers.map(normalize);
  const mapping = {} as ColumnMapping;
  for (const field of IMPORT_FIELDS) {
    mapping[field.id] = names.findIndex((name) => HEADER_HINTS[field.id].includes(name));
  }
  return mapping;
}

export type PreviewRow = {
  /** Line number in the file, counting the header as line 1. */
  line: number;
  data: ImportRow;
};
export type PreviewError = { line: number; messages: string[] };
export type ImportPreview = {
  /** Rows that will be sent. */
  ready: PreviewRow[];
  /** Rows left out, with the reasons, for the error report. */
  errors: PreviewError[];
};

/**
 * Applies the mapping to every data row and validates it with the same rules
 * the server uses. Rows whose email already exists in the workspace, or appears
 * earlier in the file, are reported rather than sent.
 */
export function buildPreview(
  dataRows: string[][],
  mapping: ColumnMapping,
  existingEmails: Iterable<string>,
): ImportPreview {
  const known = new Set([...existingEmails].map((email) => email.toLowerCase()));
  const seen = new Map<string, number>();
  const ready: PreviewRow[] = [];
  const errors: PreviewError[] = [];

  dataRows.forEach((cells, index) => {
    const line = index + 2;
    const cell = (field: ImportField) =>
      mapping[field] === -1 ? "" : (cells[mapping[field]] ?? "").trim();
    const status = cell("status").toLowerCase();
    const parsed = importRowSchema.safeParse({
      name: cell("name"),
      email: cell("email"),
      phone: cell("phone"),
      title: cell("title"),
      company: cell("company"),
      status: status === "" ? undefined : status,
      tags: cell("tags")
        .split(/[;,|]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    });

    if (!parsed.success) {
      errors.push({
        line,
        // One message per field: an empty email would otherwise fail two rules.
        messages: Object.values(fieldErrorsOf(parsed.error)),
      });
      return;
    }
    const email = parsed.data.email;
    if (known.has(email)) {
      errors.push({ line, messages: ["A contact with this email already exists."] });
      return;
    }
    const earlier = seen.get(email);
    if (earlier !== undefined) {
      errors.push({ line, messages: [`Same email as line ${earlier}.`] });
      return;
    }
    seen.set(email, line);
    ready.push({ line, data: parsed.data });
  });

  return { ready, errors };
}
