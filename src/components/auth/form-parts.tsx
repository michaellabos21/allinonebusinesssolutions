"use client";

import { CircleAlert, CircleCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/server/types";

/** Heading block at the top of an auth card. */
export function AuthHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="font-display text-title">{title}</h1>
      {children ? <p className="mt-1 text-muted-foreground">{children}</p> : null}
    </div>
  );
}

/** A labelled input wired to the field errors a server action returned. */
export function AuthField({
  name,
  label,
  state,
  hint,
  ...input
}: {
  name: string;
  label: string;
  state: ActionResult<unknown> | null;
  hint?: string;
} & Omit<React.ComponentProps<typeof Input>, "name" | "id">) {
  const error = state && !state.ok ? state.fieldErrors?.[name] : undefined;
  // After a failed submit the browser clears the form; put back what was typed.
  const typedValue = state && !state.ok ? state.values?.[name] : undefined;
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...input}
        defaultValue={typedValue ?? input.defaultValue}
      />
      {hint && !error ? (
        <p id={`${name}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${name}-error`} className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The action's overall result: an error summary or a success note. */
export function FormMessage({ state }: { state: ActionResult<unknown> | null }) {
  if (!state) return null;
  if (!state.ok) {
    return (
      <p
        role="alert"
        className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-danger"
      >
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        {state.error}
      </p>
    );
  }
  if (!state.message) return null;
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-md bg-success-soft px-3 py-2 text-success"
    >
      <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
      {state.message}
    </p>
  );
}

export function SubmitButton({
  pending,
  children,
  pendingLabel,
}: {
  pending: boolean;
  children: string;
  pendingLabel: string;
}) {
  return (
    <Button type="submit" disabled={pending} className="h-9 w-full hover:bg-primary-hover">
      {pending ? pendingLabel : children}
    </Button>
  );
}
