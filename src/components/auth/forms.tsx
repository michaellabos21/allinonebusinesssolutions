"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";

import { AuthField, AuthHeading, FormMessage, SubmitButton } from "@/components/auth/form-parts";
import { useNavigateOnSuccess } from "@/components/auth/navigate";
import {
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "@/server/actions/auth";
import { acceptInvitationAction } from "@/server/actions/team";

const linkClass = "font-medium text-primary hover:underline";

/** Carries `?next=` through sign-in and sign-up so an invitation link survives them. */
function useNextParam() {
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  return { next, query: next ? `?next=${encodeURIComponent(next)}` : "", params };
}

export function LoginForm() {
  const [state, action, pending] = useActionState(signInAction, null);
  const leaving = useNavigateOnSuccess(state);
  const { next, query, params } = useNextParam();
  return (
    <form action={action} noValidate className="grid gap-4">
      <AuthHeading title="Sign in">Welcome back.</AuthHeading>
      {params.get("error") === "link" ? (
        <FormMessage
          state={{
            ok: false,
            error: "That link has expired or was already used. Request a new one.",
          }}
        />
      ) : null}
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <AuthField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        state={state}
        required
      />
      <AuthField
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        state={state}
        required
      />
      <SubmitButton pending={pending || leaving} pendingLabel="Signing in">
        Sign in
      </SubmitButton>
      <p className="flex flex-wrap justify-between gap-2 text-caption">
        <Link href="/forgot-password" className={linkClass}>
          Forgot your password?
        </Link>
        <Link href={`/signup${query}`} className={linkClass}>
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signUpAction, null);
  const leaving = useNavigateOnSuccess(state);
  const { next, query, params } = useNextParam();
  // Success without a destination means a confirmation email was sent instead.
  const done = state?.ok === true && !leaving;
  return (
    <form action={action} noValidate className="grid gap-4">
      <AuthHeading title="Create your account">
        Set up a workspace for your business in a minute.
      </AuthHeading>
      <FormMessage state={state} />
      {done ? null : (
        <>
          <input type="hidden" name="next" value={next} />
          <AuthField name="fullName" label="Full name" autoComplete="name" state={state} required />
          <AuthField
            name="email"
            label="Work email"
            type="email"
            autoComplete="email"
            defaultValue={params.get("email") ?? ""}
            state={state}
            required
          />
          <AuthField
            name="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters."
            state={state}
            required
          />
          <SubmitButton pending={pending || leaving} pendingLabel="Creating account">
            Create account
          </SubmitButton>
        </>
      )}
      <p className="text-caption">
        Already have an account?{" "}
        <Link href={`/login${query}`} className={linkClass}>
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, null);
  return (
    <form action={action} noValidate className="grid gap-4">
      <AuthHeading title="Reset your password">
        Enter your email and we’ll send a link to choose a new one.
      </AuthHeading>
      <FormMessage state={state} />
      <AuthField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        state={state}
        required
      />
      <SubmitButton pending={pending} pendingLabel="Sending link">
        Send reset link
      </SubmitButton>
      <p className="text-caption">
        <Link href="/login" className={linkClass}>
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, null);
  const leaving = useNavigateOnSuccess(state);
  return (
    <form action={action} noValidate className="grid gap-4">
      <AuthHeading title="Choose a new password" />
      <FormMessage state={state} />
      <AuthField
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        state={state}
        required
      />
      <AuthField
        name="confirm"
        label="Repeat new password"
        type="password"
        autoComplete="new-password"
        state={state}
        required
      />
      <SubmitButton pending={pending || leaving} pendingLabel="Saving">
        Save new password
      </SubmitButton>
    </form>
  );
}

export function AcceptInvitationForm({
  token,
  workspaceName,
}: {
  token: string;
  workspaceName: string;
}) {
  const [state, action, pending] = useActionState(acceptInvitationAction, null);
  const leaving = useNavigateOnSuccess(state);
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <SubmitButton pending={pending || leaving} pendingLabel="Joining">
        {`Join ${workspaceName}`}
      </SubmitButton>
    </form>
  );
}
