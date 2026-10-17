"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type Attribution,
  EMBED_MESSAGE,
  type FormField,
  type FormValues,
  MAX_ANSWER,
  checkAnswers,
  readAttribution,
} from "@/lib/lead-forms";
import { cn } from "@/lib/utils";
import { recordLeadFormViewAction, submitLeadFormAction } from "@/server/actions/public-form";
import type { PublicLeadForm as Form } from "@/server/public-forms";

const AUTOCOMPLETE: Record<string, string> = {
  name: "name",
  email: "email",
  phone: "tel",
  company: "organization",
};

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-danger";

export function PublicLeadForm({
  token,
  form,
  embedded = false,
  hostPage = null,
  hostReferrer = null,
}: {
  token: string;
  form: Form;
  /** Shown inside another website through the embed code. */
  embedded?: boolean;
  /** The website page an embedded form sits on, and how the visitor reached it. */
  hostPage?: string | null;
  hostReferrer?: string | null;
}) {
  const id = useId();
  const [values, setValues] = useState<FormValues>({});
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const attribution = useRef<Attribution>({});
  const root = useRef<HTMLDivElement>(null);

  // Where the visitor came from, and one view per browser tab for the conversion rate.
  useEffect(() => {
    attribution.current = readAttribution({
      formUrl: window.location.href,
      hostPageUrl: hostPage,
      referrer: embedded ? hostReferrer : document.referrer,
    });
    const seen = `lead-form-view:${token}`;
    try {
      if (sessionStorage.getItem(seen)) return;
      sessionStorage.setItem(seen, "1");
    } catch {
      // Storage can be blocked inside another site's frame; count the view anyway.
    }
    void recordLeadFormViewAction(token);
  }, [token, embedded, hostPage, hostReferrer]);

  // An embedded form tells the page around it how tall it is, so it never scrolls inside a box.
  useEffect(() => {
    if (!embedded || !root.current || window.parent === window) return;
    // The form's full height on the page, padding included, so the frame never cuts it off.
    const post = () =>
      window.parent.postMessage(
        {
          type: EMBED_MESSAGE,
          height: Math.ceil(root.current!.getBoundingClientRect().bottom + window.scrollY) + 8,
        },
        "*",
      );
    const observer = new ResizeObserver(post);
    observer.observe(root.current);
    post();
    return () => observer.disconnect();
  }, [embedded]);

  const set = (key: string, value: string | string[]) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = checkAnswers(form.fields, values, {
      required: form.consentText !== "",
      given: consent,
    });
    setErrors(next);
    setError("");
    if (Object.keys(next).length > 0) {
      const first = form.fields.find((field) => next[field.key]);
      if (first) document.getElementById(`${id}-${first.key}`)?.focus();
      return;
    }

    setBusy(true);
    try {
      const result = await submitLeadFormAction(token, {
        values,
        consent,
        attribution: attribution.current,
        website,
      });
      if (!result.ok) {
        setError(result.error);
        setErrors(result.fieldErrors ?? {});
        return;
      }
      if (form.redirectUrl) {
        // From inside another site's frame the whole page moves on, not just the form.
        try {
          (embedded ? window.top! : window).location.href = form.redirectUrl;
          return;
        } catch {
          // The host page didn't allow it; show the message instead.
        }
      }
      setDone(result.data?.message ?? "Thanks, we’ll be in touch soon.");
    } catch {
      setError("We couldn’t send that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const accentStyle = {
    "--primary": form.accentColor,
    "--primary-hover": form.accentColor,
    "--ring": form.accentColor,
  } as React.CSSProperties;

  return (
    <div ref={root} style={accentStyle}>
      {done ? (
        <div className="space-y-3 py-4 text-center" role="status">
          <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden />
          <h1 className="font-display text-xl font-semibold">Message sent</h1>
          <p>{done}</p>
        </div>
      ) : (
        <form noValidate onSubmit={submit} className="grid gap-4">
          <div>
            <p className="text-caption text-muted-foreground">{form.businessName}</p>
            <h1 className="font-display text-xl font-semibold">{form.formName}</h1>
            {form.intro ? <p className="mt-1 whitespace-pre-wrap">{form.intro}</p> : null}
          </div>
          {error ? (
            <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger">
              {error}
            </p>
          ) : null}
          {form.fields.map((field) => (
            <Question
              key={field.key}
              id={`${id}-${field.key}`}
              field={field}
              value={values[field.key]}
              error={errors[field.key]}
              onChange={(value) => set(field.key, value)}
            />
          ))}
          {/* A trap for bots. Hidden from sight and from screen readers, and skipped by tab. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor={`${id}-website`}>Website</label>
            <input
              id={`${id}-website`}
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>
          {form.consentText ? (
            <div className="grid gap-1.5">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="mt-0.5 size-4 accent-primary"
                  aria-invalid={Boolean(errors.consent)}
                />
                <span className="whitespace-pre-wrap">{form.consentText}</span>
              </label>
              {errors.consent ? <p className="text-caption text-danger">{errors.consent}</p> : null}
            </div>
          ) : null}
          <Button type="submit" className="hover:opacity-90" disabled={busy}>
            {busy ? "Sending…" : form.buttonLabel}
          </Button>
        </form>
      )}
    </div>
  );
}

function Question({
  id,
  field,
  value,
  error,
  onChange,
}: {
  id: string;
  field: FormField;
  value: string | string[] | undefined;
  error?: string;
  onChange: (value: string | string[]) => void;
}) {
  const label = field.required ? field.label : `${field.label} (optional)`;
  const described = error ? `${id}-error` : undefined;
  const message = error ? (
    <p id={`${id}-error`} className="text-caption text-danger">
      {error}
    </p>
  ) : null;

  if (field.type === "checkboxes") {
    const picked = Array.isArray(value) ? value : [];
    return (
      <fieldset className="grid gap-1.5" aria-describedby={described}>
        <legend className="mb-1.5 text-sm font-medium">{label}</legend>
        {(field.options ?? []).map((option, index) => (
          <label key={option} className="flex items-center gap-2 text-sm">
            <input
              id={index === 0 ? id : undefined}
              type="checkbox"
              className="size-4 accent-primary"
              checked={picked.includes(option)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...picked, option]
                    : picked.filter((item) => item !== option),
                )
              }
            />
            {option}
          </label>
        ))}
        {message}
      </fieldset>
    );
  }

  const text = typeof value === "string" ? value : "";
  const common = {
    id,
    "aria-invalid": Boolean(error),
    "aria-describedby": described,
  };
  let input: React.ReactNode;
  if (field.type === "long_text") {
    input = (
      <Textarea
        {...common}
        value={text}
        maxLength={MAX_ANSWER.long_text}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  } else if (field.type === "dropdown") {
    input = (
      <select
        {...common}
        className={cn(SELECT_CLASS, !text && "text-muted-foreground")}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Choose…</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  } else {
    input = (
      <Input
        {...common}
        type={
          field.type === "email"
            ? "email"
            : field.type === "phone"
              ? "tel"
              : field.type === "date"
                ? "date"
                : "text"
        }
        value={text}
        maxLength={field.key === "name" || field.key === "company" ? 120 : MAX_ANSWER[field.type]}
        placeholder={field.placeholder}
        autoComplete={AUTOCOMPLETE[field.key]}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {input}
      {message}
    </div>
  );
}
