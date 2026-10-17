"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { AuthField, AuthHeading, FormMessage, SubmitButton } from "@/components/auth/form-parts";
import { useNavigateOnSuccess } from "@/components/auth/navigate";
import { Button } from "@/components/ui/button";
import {
  requestPasswordResetAction,
  signInAction,
  signInWithGoogleAction,
  signUpAction,
  updatePasswordAction,
} from "@/server/actions/auth";
import { acceptInvitationAction } from "@/server/actions/team";

const linkClass = "font-medium text-primary hover:underline";

/** Google's "G" mark, as Google's sign-in branding asks for it. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-[18px]">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending} className="h-9 w-full gap-2.5">
      <GoogleMark />
      {pending ? "Opening Google…" : "Continue with Google"}
    </Button>
  );
}

/** "Continue with Google", then a divider before the email form. */
function GoogleSignIn({ next }: { next: string }) {
  return (
    <>
      <form action={signInWithGoogleAction}>
        <input type="hidden" name="next" value={next} />
        <GoogleButton />
      </form>
      <div className="flex items-center gap-3 text-caption text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        or with email
        <span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}

const GOOGLE_FAILED = {
  ok: false as const,
  error: "Google sign-in didn’t finish. Try again, or use your email and password.",
};

/** Carries `?next=` through sign-in and sign-up so an invitation link survives them. */
function useNextParam() {
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  return { next, query: next ? `?next=${encodeURIComponent(next)}` : "", params };
}

export function LoginForm({ google = false }: { google?: boolean }) {
  const [state, action, pending] = useActionState(signInAction, null);
  const leaving = useNavigateOnSuccess(state);
  const { next, query, params } = useNextParam();
  return (
    <div className="grid gap-4">
      <AuthHeading title="Sign in">Welcome back.</AuthHeading>
      {params.get("error") === "link" ? (
        <FormMessage
          state={{
            ok: false,
            error: "That link has expired or was already used. Request a new one.",
          }}
        />
      ) : null}
      {params.get("error") === "google" ? <FormMessage state={GOOGLE_FAILED} /> : null}
      {google ? <GoogleSignIn next={next} /> : null}
      <form action={action} noValidate className="grid gap-4">
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
    </div>
  );
}

export function SignupForm({ google = false }: { google?: boolean }) {
  const [state, action, pending] = useActionState(signUpAction, null);
  const leaving = useNavigateOnSuccess(state);
  const { next, query, params } = useNextParam();
  // Success without a destination means a confirmation email was sent instead.
  const done = state?.ok === true && !leaving;
  return (
    <div className="grid gap-4">
      <AuthHeading title="Create your account">
        Set up a workspace for your business in a minute.
      </AuthHeading>
      {google && !done ? <GoogleSignIn next={next} /> : null}
      <form action={action} noValidate className="grid gap-4">
        <FormMessage state={state} />
        {done ? null : (
          <>
            <input type="hidden" name="next" value={next} />
            <AuthField
              name="fullName"
              label="Full name"
              autoComplete="name"
              state={state}
              required
            />
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
        {done ? null : (
          <p className="text-caption text-muted-foreground">
            By creating an account you agree to the{" "}
            <Link href="/terms" className={linkClass}>
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className={linkClass}>
              Privacy Policy
            </Link>
            .
          </p>
        )}
        <p className="text-caption">
          Already have an account?{" "}
          <Link href={`/login${query}`} className={linkClass}>
            Sign in
          </Link>
        </p>
      </form>
    </div>
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
