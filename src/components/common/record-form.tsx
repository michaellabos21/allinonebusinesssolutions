"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseAmountToMinor } from "@/lib/format";
import { cn } from "@/lib/utils";

export type FormValues = Record<string, string>;
export type FormOption = { value: string; label: string };

export type FormField = {
  name: string;
  label: string;
  /** `combo` is free text with suggestions; `amount` is money typed in major units. */
  type: "text" | "textarea" | "email" | "tel" | "date" | "amount" | "select" | "combo";
  required?: boolean;
  /** Error shown when a required field is left empty. */
  missing?: string;
  placeholder?: string;
  hint?: string;
  /** Options may depend on what has been entered so far. */
  options?: FormOption[] | ((values: FormValues) => FormOption[]);
  /** Takes half the row on wider screens. */
  half?: boolean;
};

export type FormResult = { message: string; viewLabel?: string; href?: string };

export type FormSpec = {
  title: string;
  description: string;
  submitLabel: string;
  fields: FormField[];
  initial: FormValues;
  /** Notice shown above the fields, e.g. a missing prerequisite. */
  warning?: string;
  /** Cross-field or uniqueness checks, run after the built-in ones. */
  check?: (values: FormValues) => Record<string, string | undefined>;
  /** Saves to session state and returns the confirmation to show. */
  submit: (values: FormValues) => FormResult;
};

/** Value used by optional selects for "nothing chosen"; Radix selects cannot hold an empty string. */
export const NONE = "none";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(spec: FormSpec, values: FormValues) {
  const errors: FormValues = {};
  for (const field of spec.fields) {
    const value = (values[field.name] ?? "").trim();
    if (field.required && (!value || value === NONE)) {
      errors[field.name] = field.missing ?? `${field.label} is required.`;
      continue;
    }
    if (!value) continue;
    if (field.type === "email" && !EMAIL_PATTERN.test(value)) {
      errors[field.name] = "Enter an email address like name@company.com.";
    }
    if (field.type === "amount") {
      const minor = parseAmountToMinor(value);
      if (minor === null || minor <= 0) {
        errors[field.name] = "Enter an amount above zero, like 12500 or 12,500.50.";
      }
    }
  }
  for (const [name, message] of Object.entries(spec.check?.(values) ?? {})) {
    if (message && !errors[name]) errors[name] = message;
  }
  return errors;
}

/**
 * Renders a create/edit form from a spec, inside a dialog. Validates on
 * submit, focuses the first invalid field, and reports the result to `onSaved`.
 */
export function RecordForm({
  spec,
  onSaved,
  onCancel,
}: {
  spec: FormSpec;
  onSaved: (result: FormResult) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<FormValues>(spec.initial);
  const [errors, setErrors] = useState<FormValues>({});

  const setValue = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: "" }));
  };

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate(spec, values);
    setErrors(found);
    const firstInvalid = spec.fields.find((field) => found[field.name]);
    if (firstInvalid) {
      document.getElementById(`field-${firstInvalid.name}`)?.focus();
      return;
    }
    onSaved(spec.submit(values));
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>{spec.title}</DialogTitle>
        <DialogDescription>{spec.description}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-5 sm:grid-cols-2">
        {spec.warning ? (
          <p className="rounded-md bg-warning-soft px-3 py-2 text-caption text-warning sm:col-span-2">
            {spec.warning}
          </p>
        ) : null}
        {spec.fields.map((field) => {
          const id = `field-${field.name}`;
          const error = errors[field.name];
          const describedBy =
            [error ? `${id}-error` : "", field.hint ? `${id}-hint` : ""]
              .filter(Boolean)
              .join(" ") || undefined;
          const options =
            typeof field.options === "function" ? field.options(values) : (field.options ?? []);

          return (
            <div
              key={field.name}
              className={cn("grid content-start gap-1.5", !field.half && "sm:col-span-2")}
            >
              <Label htmlFor={id}>
                {field.label}
                {field.required ? null : (
                  <span className="font-normal text-muted-foreground">(optional)</span>
                )}
              </Label>
              {field.type === "select" ? (
                <Select
                  value={values[field.name]}
                  onValueChange={(value) => setValue(field.name, value)}
                >
                  <SelectTrigger
                    id={id}
                    className="w-full"
                    aria-invalid={Boolean(error)}
                    aria-describedby={describedBy}
                  >
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === "textarea" ? (
                <Textarea
                  id={id}
                  rows={3}
                  placeholder={field.placeholder}
                  value={values[field.name]}
                  onChange={(event) => setValue(field.name, event.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={describedBy}
                />
              ) : (
                <>
                  <Input
                    id={id}
                    type={field.type === "amount" || field.type === "combo" ? "text" : field.type}
                    inputMode={field.type === "amount" ? "decimal" : undefined}
                    list={field.type === "combo" ? `${id}-options` : undefined}
                    autoComplete="off"
                    placeholder={field.placeholder}
                    value={values[field.name]}
                    onChange={(event) => setValue(field.name, event.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={describedBy}
                  />
                  {field.type === "combo" ? (
                    <datalist id={`${id}-options`}>
                      {options.map((option) => (
                        <option key={option.value} value={option.value} />
                      ))}
                    </datalist>
                  ) : null}
                </>
              )}
              {field.hint && !error ? (
                <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                  {field.hint}
                </p>
              ) : null}
              {error ? (
                <p id={`${id}-error`} className="text-caption text-danger">
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <DialogFooter className="items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">Prototype: saved for this session only.</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" className="hover:bg-primary-hover">
            {spec.submitLabel}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
