"use client";

import { CheckCircle2 } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitLeadFormAction } from "@/server/actions/public-form";
import type { PublicLeadForm as Form } from "@/server/public-forms";

type Values = {
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  consent: boolean;
  /** Hidden from people; only bots fill it in. */
  website: string;
};

const EMPTY: Values = {
  name: "",
  email: "",
  phone: "",
  company: "",
  message: "",
  consent: false,
  website: "",
};

export function PublicLeadForm({ token, form }: { token: string; form: Form }) {
  const id = useId();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const set = (name: keyof Values, value: string | boolean) =>
    setValues((current) => ({ ...current, [name]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!values.name.trim()) next.name = "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      next.email = "Enter an email address like name@company.com.";
    }
    if (form.consentText && !values.consent) next.consent = "Tick the box to continue.";
    setErrors(next);
    setError("");
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const result = await submitLeadFormAction(token, values);
      if (result.ok) {
        setDone(result.data?.message ?? "Thanks, we’ll be in touch soon.");
      } else {
        setError(result.error);
        setErrors(result.fieldErrors ?? {});
      }
    } catch {
      setError("We couldn’t send that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-3 text-center" role="status">
        <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden />
        <h1 className="font-display text-xl font-semibold">Message sent</h1>
        <p>{done}</p>
      </div>
    );
  }

  const field = (name: keyof Values, label: string, input: React.ReactNode, hint?: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`${id}-${name}`}>{label}</Label>
      {input}
      {errors[name] ? (
        <p id={`${id}-${name}-error`} className="text-caption text-danger">
          {errors[name]}
        </p>
      ) : hint ? (
        <p className="text-caption text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
  const inputProps = (name: keyof Values) => ({
    id: `${id}-${name}`,
    value: values[name] as string,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(name, event.target.value),
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${id}-${name}-error` : undefined,
  });

  return (
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
      {field(
        "name",
        "Your name",
        <Input {...inputProps("name")} maxLength={120} autoComplete="name" />,
      )}
      {field(
        "email",
        "Email",
        <Input {...inputProps("email")} type="email" maxLength={254} autoComplete="email" />,
      )}
      {field(
        "phone",
        "Phone (optional)",
        <Input {...inputProps("phone")} type="tel" maxLength={40} autoComplete="tel" />,
      )}
      {field(
        "company",
        "Company (optional)",
        <Input {...inputProps("company")} maxLength={120} autoComplete="organization" />,
      )}
      {field(
        "message",
        "How can we help? (optional)",
        <Textarea {...inputProps("message")} maxLength={2000} />,
      )}
      {/* A trap for bots. Hidden from sight and from screen readers, and skipped by tab. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${id}-website`}>Website</label>
        <input
          id={`${id}-website`}
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={(event) => set("website", event.target.value)}
        />
      </div>
      {form.consentText ? (
        <div className="grid gap-1.5">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.consent}
              onChange={(event) => set("consent", event.target.checked)}
              className="mt-0.5 size-4 accent-primary"
              aria-invalid={Boolean(errors.consent)}
            />
            <span className="whitespace-pre-wrap">{form.consentText}</span>
          </label>
          {errors.consent ? <p className="text-caption text-danger">{errors.consent}</p> : null}
        </div>
      ) : null}
      <Button type="submit" className="hover:bg-primary-hover" disabled={busy}>
        {busy ? "Sending…" : "Send"}
      </Button>
    </form>
  );
}
