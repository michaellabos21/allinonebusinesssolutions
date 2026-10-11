/**
 * Builds a CSV file (RFC 4180) from rows, for exporting lists. Cells that
 * start with = + - @ are prefixed with an apostrophe so spreadsheet apps show
 * them as text instead of running them as formulas.
 */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const cell = (value: string | number | null) => {
    let text = value === null ? "" : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** Offers the CSV to the browser as a download. */
export function downloadCsv(fileName: string, csv: string) {
  // The byte-order mark makes Excel read the file as UTF-8, so ₱ and accents survive.
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
