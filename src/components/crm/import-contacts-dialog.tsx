"use client";

import { FileUp } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type ColumnMapping,
  IMPORT_FIELDS,
  IMPORT_MAX_BYTES,
  type ImportField,
  buildPreview,
  guessMapping,
  parseCsv,
} from "@/lib/csv-import";
import { importContactsAction } from "@/server/actions/records";
import { IMPORT_ROW_LIMIT } from "@/server/validation";

const NOT_IMPORTED = "-1";
const PREVIEW_ROWS = 5;

type Loaded = { fileName: string; headers: string[]; rows: string[][] };

/**
 * Three steps: choose a CSV file, match its columns to contact fields while a
 * preview shows what will happen, then import the valid rows. Nothing is
 * written until the last step, and rows with problems are listed by line.
 */
export function ImportContactsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { contacts } = useDemoStore();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [fileError, setFileError] = useState("");
  const [busy, setBusy] = useState(false);

  const preview = useMemo(
    () =>
      loaded && mapping
        ? buildPreview(
            loaded.rows,
            mapping,
            contacts.map((contact) => contact.email),
          )
        : null,
    [loaded, mapping, contacts],
  );
  const missingRequired = mapping
    ? IMPORT_FIELDS.filter((field) => field.required && mapping[field.id] === -1)
    : [];

  function reset() {
    setLoaded(null);
    setMapping(null);
    setFileError("");
  }

  async function chooseFile(file: File | undefined) {
    reset();
    if (!file) return;
    if (file.size > IMPORT_MAX_BYTES) {
      setFileError("That file is larger than 1 MB. Split it into smaller files.");
      return;
    }
    const [headers, ...rows] = parseCsv(await file.text());
    if (!headers || rows.length === 0) {
      setFileError("That file has no rows under its header line.");
      return;
    }
    if (rows.length > IMPORT_ROW_LIMIT) {
      setFileError(
        `Import up to ${IMPORT_ROW_LIMIT} contacts at a time. This file has ${rows.length}.`,
      );
      return;
    }
    setLoaded({ fileName: file.name, headers, rows });
    setMapping(guessMapping(headers));
  }

  async function runImport() {
    if (!preview || preview.ready.length === 0) return;
    setBusy(true);
    try {
      const result = await importContactsAction(preview.ready.map((row) => row.data));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (!result.data) return;
      const { imported, skipped } = result.data;
      toast.success(`Imported ${imported} ${imported === 1 ? "contact" : "contacts"}`, {
        description:
          skipped.length > 0
            ? `Skipped lines ${skipped.map((item) => preview.ready[item.row - 1]?.line).join(", ")}: their emails were added by someone else meanwhile.`
            : undefined,
      });
      reset();
      onOpenChange(false);
    } catch {
      toast.error("We couldn’t reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import contacts</DialogTitle>
          <DialogDescription>
            Upload a CSV file with a header row. You’ll see what will be imported before anything is
            saved. Contacts whose email is already here are skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="import-file" className="text-sm font-medium">
            CSV file
          </label>
          <input
            id="import-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => chooseFile(event.target.files?.[0])}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
            aria-describedby={fileError ? "import-file-error" : undefined}
          />
          {fileError ? (
            <p id="import-file-error" role="alert" className="text-sm text-danger">
              {fileError}
            </p>
          ) : null}
        </div>

        {loaded && mapping && preview ? (
          <>
            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-medium">Match columns</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {IMPORT_FIELDS.map((field) => (
                  <MappingSelect
                    key={field.id}
                    field={field.id}
                    label={field.required ? `${field.label} (required)` : field.label}
                    headers={loaded.headers}
                    value={mapping[field.id]}
                    onChange={(column) => setMapping({ ...mapping, [field.id]: column })}
                  />
                ))}
              </div>
            </fieldset>

            {missingRequired.length > 0 ? (
              <p role="alert" className="text-sm text-danger">
                Choose a column for {missingRequired.map((field) => field.label).join(" and ")}.
              </p>
            ) : (
              <section aria-label="Import preview" className="space-y-3">
                <p className="text-sm" aria-live="polite">
                  <strong>{preview.ready.length}</strong> of {loaded.rows.length} rows from{" "}
                  {loaded.fileName} are ready to import.
                  {preview.errors.length > 0 ? ` ${preview.errors.length} will be left out.` : null}
                </p>

                {preview.ready.length > 0 ? (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">First rows to import</caption>
                      <thead className="bg-muted/50 text-caption text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Line</th>
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Email</th>
                          <th className="px-3 py-2 font-medium">Company</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.ready.slice(0, PREVIEW_ROWS).map((row) => (
                          <tr key={row.line} className="border-t">
                            <td className="tabular px-3 py-2 text-muted-foreground">{row.line}</td>
                            <td className="px-3 py-2">{row.data.name}</td>
                            <td className="px-3 py-2">{row.data.email}</td>
                            <td className="px-3 py-2">{row.data.company || "None"}</td>
                            <td className="px-3 py-2 capitalize">{row.data.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {preview.errors.length > 0 ? (
                  <div className="rounded-md border border-danger/30 bg-danger/5 p-3">
                    <h3 className="mb-2 text-sm font-medium">Rows that won’t be imported</h3>
                    <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                      {preview.errors.map((error) => (
                        <li key={error.line}>
                          <span className="tabular font-medium">Line {error.line}:</span>{" "}
                          {error.messages.join(" ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            )}
          </>
        ) : null}

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="hover:bg-primary-hover"
            disabled={busy || !preview || missingRequired.length > 0 || preview.ready.length === 0}
            onClick={runImport}
          >
            <FileUp data-icon="inline-start" aria-hidden />
            {busy
              ? "Importing…"
              : preview && preview.ready.length > 0
                ? `Import ${preview.ready.length} ${preview.ready.length === 1 ? "contact" : "contacts"}`
                : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MappingSelect({
  field,
  label,
  headers,
  value,
  onChange,
}: {
  field: ImportField;
  label: string;
  headers: string[];
  value: number;
  onChange: (column: number) => void;
}) {
  const id = `import-map-${field}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      <Select value={String(value)} onValueChange={(next) => onChange(Number(next))}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NOT_IMPORTED}>Don’t import</SelectItem>
          {headers.map((header, index) => (
            <SelectItem key={index} value={String(index)}>
              {header.trim() || `Column ${index + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
