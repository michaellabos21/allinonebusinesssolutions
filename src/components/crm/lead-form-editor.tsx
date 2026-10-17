"use client";

import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ACCENT_PRESETS,
  BUILT_IN_FIELDS,
  type BuiltInKey,
  DEFAULT_ACCENT,
  DEFAULT_FIELDS,
  FIELD_TYPE_LABEL,
  type FormField,
  type FormFieldType,
  MAX_FIELDS,
  contrastWithWhite,
  isBuiltIn,
  isLocked,
  newCustomKey,
} from "@/lib/lead-forms";
import { cn } from "@/lib/utils";
import type { LeadForm } from "@/mocks";
import { saveLeadFormAction } from "@/server/actions/sales";

const DEFAULT_SUCCESS = "Thanks, we’ll be in touch soon.";
const CUSTOM_TYPES: FormFieldType[] = [
  "short_text",
  "long_text",
  "dropdown",
  "checkboxes",
  "date",
  "email",
  "phone",
];
const hasChoices = (type: FormFieldType) => type === "dropdown" || type === "checkboxes";

/** A question while it is being edited: choices are typed one per line. */
type Draft = FormField & { optionsText: string };

const toDraft = (field: FormField): Draft => ({
  ...field,
  optionsText: (field.options ?? []).join("\n"),
});

const fromDraft = ({ optionsText, ...field }: Draft): FormField => {
  const out: FormField = {
    key: field.key,
    type: field.type,
    label: field.label,
    required: field.required,
  };
  if (hasChoices(field.type)) {
    out.options = [
      ...new Set(
        optionsText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      ),
    ];
  } else if (field.placeholder?.trim()) {
    out.placeholder = field.placeholder.trim();
  }
  return out;
};

const SELECT_CLASS =
  "h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Create or change a lead form: its questions, look and wording. */
export function LeadFormEditor({
  form,
  busy,
  setBusy,
  onClose,
}: {
  form: LeadForm | null;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [values, setValues] = useState({
    name: form?.name ?? "",
    intro: form?.intro ?? "",
    consentText: form?.consentText ?? "",
    successMessage: form?.successMessage ?? DEFAULT_SUCCESS,
    active: form?.active ?? true,
    accentColor: form?.accentColor ?? DEFAULT_ACCENT,
    buttonLabel: form?.buttonLabel ?? "Send",
    redirectUrl: form?.redirectUrl ?? "",
  });
  const [fields, setFields] = useState<Draft[]>(() =>
    (form?.fields ?? DEFAULT_FIELDS).map(toDraft),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (name: keyof typeof values, value: string | boolean) =>
    setValues((current) => ({ ...current, [name]: value }));
  const update = (index: number, patch: Partial<Draft>) =>
    setFields((current) =>
      current.map((field, i) => (i === index ? { ...field, ...patch } : field)),
    );
  const move = (index: number, by: -1 | 1) =>
    setFields((current) => {
      const next = [...current];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  const remove = (index: number) => setFields((current) => current.filter((_, i) => i !== index));

  const missingBuiltIns = (Object.keys(BUILT_IN_FIELDS) as BuiltInKey[]).filter(
    (key) => !fields.some((field) => field.key === key),
  );
  const addBuiltIn = (key: BuiltInKey) =>
    setFields((current) => [
      ...current,
      toDraft({
        key,
        type: BUILT_IN_FIELDS[key].type,
        label: BUILT_IN_FIELDS[key].label,
        required: false,
      }),
    ]);
  const addCustom = (type: FormFieldType) =>
    setFields((current) => [
      ...current,
      {
        key: newCustomKey(),
        type,
        label: "",
        required: false,
        optionsText: hasChoices(type) ? "Option 1\nOption 2" : "",
      },
    ]);

  const accentOk = /^#[0-9a-fA-F]{6}$/.test(values.accentColor);
  const accentReadable = accentOk && contrastWithWhite(values.accentColor.toLowerCase()) >= 4.5;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await saveLeadFormAction(
        { ...values, fields: fields.map(fromDraft) },
        form?.id,
      );
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(form ? "Form saved" : "Form created. Copy its link or embed code to share it.");
      onClose();
    } catch {
      toast.error("We couldn’t reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-6">
      <DialogHeader>
        <DialogTitle>{form ? `Edit ${form.name}` : "New lead form"}</DialogTitle>
        <DialogDescription>
          Each enquiry becomes a new, unassigned lead, with the answers and where the visitor came
          from.
        </DialogDescription>
      </DialogHeader>

      <section className="grid gap-4" aria-labelledby={`${id}-details`}>
        <h3 id={`${id}-details`} className="font-semibold">
          Details
        </h3>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-name`}>Form name</Label>
          <Input
            id={`${id}-name`}
            value={values.name}
            maxLength={80}
            placeholder="Website enquiry"
            onChange={(event) => set("name", event.target.value)}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name ? <p className="text-caption text-danger">{errors.name}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-intro`}>Introduction (optional)</Label>
          <Textarea
            id={`${id}-intro`}
            value={values.intro}
            maxLength={500}
            placeholder="Tell us about your project and we’ll reply within a day."
            onChange={(event) => set("intro", event.target.value)}
          />
        </div>
      </section>

      <section className="grid gap-3" aria-labelledby={`${id}-questions`}>
        <div className="flex items-center justify-between gap-2">
          <h3 id={`${id}-questions`} className="font-semibold">
            Questions
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={fields.length >= MAX_FIELDS}
              >
                <Plus data-icon="inline-start" aria-hidden />
                Add question
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {missingBuiltIns.length > 0 ? (
                <>
                  <DropdownMenuLabel>Saved on the lead</DropdownMenuLabel>
                  {missingBuiltIns.map((key) => (
                    <DropdownMenuItem key={key} onSelect={() => addBuiltIn(key)}>
                      {BUILT_IN_FIELDS[key].label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuLabel>Your own question</DropdownMenuLabel>
              {CUSTOM_TYPES.map((type) => (
                <DropdownMenuItem key={type} onSelect={() => addCustom(type)}>
                  {FIELD_TYPE_LABEL[type]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {errors.fields ? <p className="text-caption text-danger">{errors.fields}</p> : null}
        <ol className="grid gap-2" aria-label="Questions">
          {fields.map((field, index) => {
            const locked = isLocked(field.key);
            const fieldId = `${id}-field-${field.key}`;
            const error = errors[`fields.${index}`];
            return (
              <li key={field.key} className="grid gap-2 rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id={fieldId}
                    aria-label={`Question ${index + 1}`}
                    className="h-8 min-w-0 flex-1"
                    value={field.label}
                    maxLength={80}
                    placeholder="Your question"
                    aria-invalid={Boolean(error)}
                    onChange={(event) => update(index, { label: event.target.value })}
                  />
                  {isBuiltIn(field.key) ? (
                    <span className="text-caption text-muted-foreground">
                      {FIELD_TYPE_LABEL[field.type]}
                    </span>
                  ) : (
                    <select
                      aria-label={`Answer type for question ${index + 1}`}
                      className={SELECT_CLASS}
                      value={field.type}
                      onChange={(event) => {
                        const type = event.target.value as FormFieldType;
                        update(index, {
                          type,
                          optionsText:
                            hasChoices(type) && !field.optionsText
                              ? "Option 1\nOption 2"
                              : field.optionsText,
                        });
                      }}
                    >
                      {CUSTOM_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {FIELD_TYPE_LABEL[type]}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      aria-label={`Move question ${index + 1} up`}
                    >
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label={`Move question ${index + 1} down`}
                    >
                      <ArrowDown aria-hidden />
                    </Button>
                    {locked ? null : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => remove(index)}
                        aria-label={`Remove question ${index + 1}`}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={field.required}
                      disabled={locked}
                      onChange={(event) => update(index, { required: event.target.checked })}
                    />
                    Required
                  </label>
                  {locked ? (
                    <span className="text-caption text-muted-foreground">
                      Every form asks for this.
                    </span>
                  ) : null}
                  {!hasChoices(field.type) && field.type !== "date" ? (
                    <Input
                      aria-label={`Hint inside question ${index + 1} (optional)`}
                      className="h-8 min-w-40 flex-1"
                      value={field.placeholder ?? ""}
                      maxLength={120}
                      placeholder="Hint inside the box (optional)"
                      onChange={(event) => update(index, { placeholder: event.target.value })}
                    />
                  ) : null}
                </div>
                {hasChoices(field.type) ? (
                  <div className="grid gap-1">
                    <Label htmlFor={`${fieldId}-options`} className="text-caption">
                      Choices, one per line
                    </Label>
                    <Textarea
                      id={`${fieldId}-options`}
                      rows={3}
                      value={field.optionsText}
                      onChange={(event) => update(index, { optionsText: event.target.value })}
                    />
                  </div>
                ) : null}
                {error ? <p className="text-caption text-danger">{error}</p> : null}
              </li>
            );
          })}
        </ol>
        <p className="text-caption text-muted-foreground">
          Name, email, phone, company and message fill in the lead itself. Answers to your own
          questions are kept with the lead as they were asked.
        </p>
      </section>

      <section className="grid gap-4" aria-labelledby={`${id}-look`}>
        <h3 id={`${id}-look`} className="font-semibold">
          Look and sending
        </h3>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Button colour</legend>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Use ${color}`}
                aria-pressed={values.accentColor.toLowerCase() === color}
                onClick={() => set("accentColor", color)}
                className="flex size-8 items-center justify-center rounded-full ring-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:ring-2 aria-pressed:ring-foreground"
                style={{ backgroundColor: color }}
              >
                {values.accentColor.toLowerCase() === color ? (
                  <Check className="size-4 text-white" aria-hidden />
                ) : null}
              </button>
            ))}
            <Input
              aria-label="Button colour, as a hex code"
              className="h-8 w-28 font-mono"
              value={values.accentColor}
              maxLength={7}
              onChange={(event) => set("accentColor", event.target.value.trim())}
              aria-invalid={Boolean(errors.accentColor) || (accentOk && !accentReadable)}
            />
            <span
              aria-hidden
              className={cn(
                "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-white",
                !accentOk && "bg-muted text-muted-foreground",
              )}
              style={accentOk ? { backgroundColor: values.accentColor } : undefined}
            >
              {values.buttonLabel || "Send"}
            </span>
          </div>
          {errors.accentColor || (accentOk && !accentReadable) ? (
            <p className="text-caption text-danger">
              {errors.accentColor ??
                "Pick a darker colour so the white button text stays readable."}
            </p>
          ) : null}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-button`}>Button text</Label>
            <Input
              id={`${id}-button`}
              value={values.buttonLabel}
              maxLength={40}
              onChange={(event) => set("buttonLabel", event.target.value)}
              aria-invalid={Boolean(errors.buttonLabel)}
            />
            {errors.buttonLabel ? (
              <p className="text-caption text-danger">{errors.buttonLabel}</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-success`}>Message after sending</Label>
            <Input
              id={`${id}-success`}
              value={values.successMessage}
              maxLength={300}
              onChange={(event) => set("successMessage", event.target.value)}
              aria-invalid={Boolean(errors.successMessage)}
            />
            {errors.successMessage ? (
              <p className="text-caption text-danger">{errors.successMessage}</p>
            ) : null}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-redirect`}>Then go to a page on your website (optional)</Label>
          <Input
            id={`${id}-redirect`}
            type="url"
            value={values.redirectUrl}
            maxLength={500}
            placeholder="https://yourbusiness.com/thank-you"
            onChange={(event) => set("redirectUrl", event.target.value)}
            aria-invalid={Boolean(errors.redirectUrl)}
          />
          {errors.redirectUrl ? (
            <p className="text-caption text-danger">{errors.redirectUrl}</p>
          ) : (
            <p className="text-caption text-muted-foreground">
              Leave empty to show the message above instead.
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-consent`}>Consent checkbox text (optional)</Label>
          <Textarea
            id={`${id}-consent`}
            value={values.consentText}
            maxLength={1000}
            placeholder="I agree to be contacted about my enquiry."
            onChange={(event) => set("consentText", event.target.value)}
          />
          <p className="text-caption text-muted-foreground">
            When filled in, visitors must tick a box with this text. Write it to suit your own
            privacy obligations; this app doesn’t provide legal wording.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={values.active}
            onChange={(event) => set("active", event.target.checked)}
            className="size-4 accent-primary"
          />
          Accepting enquiries
        </label>
      </section>

      <DialogFooter>
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" className="hover:bg-primary-hover" disabled={busy}>
          {form ? "Save form" : "Create form"}
        </Button>
      </DialogFooter>
    </form>
  );
}
