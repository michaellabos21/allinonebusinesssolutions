"use client";

import { useEffect, useTransition } from "react";

import { signOutAction } from "@/server/actions/auth";
import type { NavigateResult } from "@/server/types";

/**
 * Leaves the page with a full load, not a client-side transition.
 *
 * Signing in or out, creating or joining a workspace, and switching workspace
 * all change what every page should show. A full load throws away the pages
 * the browser cached for the previous state, so none of them can be replayed.
 */
export function hardNavigate(to: string) {
  window.location.assign(to);
}

/** Follows the destination a session-changing action returned. */
export function useNavigateOnSuccess(state: NavigateResult | null) {
  const destination = state?.ok ? state.data?.redirectTo : undefined;
  useEffect(() => {
    if (destination) hardNavigate(destination);
  }, [destination]);
  /** True from success until the browser has left the page. */
  return Boolean(destination);
}

/** Rendered by server components in place of a redirect, for the same reason. */
export function HardRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return <div className="min-h-dvh bg-canvas" aria-busy="true" />;
}

export function SignOutButton({
  className,
  children = "Sign out",
}: {
  className?: string;
  children?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          const result = await signOutAction();
          hardNavigate(result.ok ? (result.data?.redirectTo ?? "/login") : "/login");
        })
      }
    >
      {pending ? "Signing out" : children}
    </button>
  );
}
