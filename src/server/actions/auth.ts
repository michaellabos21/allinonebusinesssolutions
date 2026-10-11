"use server";

import { headers } from "next/headers";

import { getSiteUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/server/safe-next";
import type { NavigateResult } from "@/server/types";
import {
  emailOnlySchema,
  fieldErrorsOf,
  newPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/server/validation";

/**
 * Success that changes who is signed in. The browser then does a full page
 * load to the destination, which discards every page it had cached for the
 * previous session. A client-side redirect would reuse those cached pages.
 */
const go = (redirectTo: string): NavigateResult => ({ ok: true, data: { redirectTo } });

/** The non-secret fields of a submitted form, returned on failure so they are not lost. */
function typed(formData: FormData) {
  const values: Record<string, string> = {};
  for (const name of ["email", "fullName"]) {
    const value = formData.get(name);
    if (typeof value === "string") values[name] = value;
  }
  return values;
}

/** The site's own origin, for links in emails. Falls back to configuration. */
async function siteOrigin() {
  const origin = (await headers()).get("origin");
  return origin && /^https?:\/\/[^/]+$/.test(origin) ? origin : getSiteUrl();
}

export async function signUpAction(
  _previous: NavigateResult | null,
  formData: FormData,
): Promise<NavigateResult> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      values: typed(formData),
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    if (error.code === "user_already_exists" || /already registered/i.test(error.message)) {
      return {
        ok: false,
        values: typed(formData),
        error: "An account with this email already exists.",
        fieldErrors: { email: "This email already has an account. Sign in instead." },
      };
    }
    if (error.code === "weak_password") {
      return {
        ok: false,
        values: typed(formData),
        error: "Choose a stronger password.",
        fieldErrors: { password: error.message },
      };
    }
    logger.warn("auth.sign_up_failed", { code: error.code ?? "unknown" });
    return {
      ok: false,
      values: typed(formData),
      error: "We couldn’t create your account. Try again in a moment.",
    };
  }

  // With email confirmation switched on there is no session until the link is opened.
  if (!data.session) {
    return {
      ok: true,
      message: `We sent a confirmation link to ${parsed.data.email}. Open it to finish signing up.`,
    };
  }
  return go(next);
}

export async function signInAction(
  _previous: NavigateResult | null,
  formData: FormData,
): Promise<NavigateResult> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      values: typed(formData),
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        ok: false,
        values: typed(formData),
        error: "Confirm your email first. Open the link we sent when you signed up.",
      };
    }
    // One message for a wrong email and a wrong password, so neither can be probed.
    return {
      ok: false,
      values: typed(formData),
      error: "That email and password don’t match an account.",
    };
  }
  return go(safeNext(formData.get("next")));
}

export async function signOutAction(): Promise<NavigateResult> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return go("/login");
}

export async function requestPasswordResetAction(
  _previous: NavigateResult | null,
  formData: FormData,
): Promise<NavigateResult> {
  const parsed = emailOnlySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      values: typed(formData),
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
  });
  if (error?.status === 429) {
    return {
      ok: false,
      values: typed(formData),
      error: "Too many requests. Wait a minute, then try again.",
    };
  }
  if (error) logger.warn("auth.reset_request_failed", { code: error.code ?? "unknown" });
  // Same answer whether or not the address has an account.
  return {
    ok: true,
    message: `If ${parsed.data.email} has an account, a reset link is on its way. It works for one hour.`,
  };
}

export async function updatePasswordAction(
  _previous: NavigateResult | null,
  formData: FormData,
): Promise<NavigateResult> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      values: typed(formData),
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      values: typed(formData),
      error: "This reset link has expired. Request a new one.",
    };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return {
        ok: false,
        values: typed(formData),
        error: "Choose a password you haven’t used here before.",
        fieldErrors: { password: "This is your current password." },
      };
    }
    return {
      ok: false,
      values: typed(formData),
      error: "We couldn’t update your password. Request a new reset link and try again.",
    };
  }
  return go("/");
}
