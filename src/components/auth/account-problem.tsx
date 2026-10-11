import { SignOutButton } from "@/components/auth/navigate";
import { PRODUCT_NAME } from "@/config/app";
import type { AccountProblem } from "@/server/session";

const COPY: Record<AccountProblem, { title: string; body: string; fix: string }> = {
  database_not_set_up: {
    title: "The database isn’t set up yet",
    body: "You’re signed in, but the app’s tables don’t exist in this Supabase project.",
    fix: "If you run this site, apply the migrations in supabase/migrations (npx supabase db push, or run each file in order in Supabase’s SQL Editor). Then delete this account under Authentication → Users and sign up again.",
  },
  profile_missing: {
    title: "This account has no profile",
    body: "You’re signed in, but your account was created before the database was set up, so its profile was never made.",
    fix: "If you run this site, delete this account in Supabase under Authentication → Users, then sign up again.",
  },
};

/** The explanation and a way out, for pages that already have a frame. */
export function AccountProblemMessage({ problem }: { problem: AccountProblem }) {
  const copy = COPY[problem];
  return (
    <div className="space-y-3">
      <h1 className="font-display text-xl font-semibold">{copy.title}</h1>
      <p>{copy.body}</p>
      <p className="text-muted-foreground">{copy.fix}</p>
      <SignOutButton className="font-medium text-primary hover:underline" />
    </div>
  );
}

/**
 * Shown instead of redirecting when a signed-in user cannot be loaded, which
 * would otherwise bounce between the workspace and the sign-in page forever.
 */
export function AccountProblemNotice({ problem }: { problem: AccountProblem }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <p className="font-display text-lg font-semibold">{PRODUCT_NAME}</p>
        <main className="mt-6 rounded-lg border bg-card px-5 py-6 sm:px-6">
          <AccountProblemMessage problem={problem} />
        </main>
      </div>
    </div>
  );
}
