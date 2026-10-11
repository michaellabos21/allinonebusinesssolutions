/**
 * Turns a Supabase Auth sign-up failure into something a person can act on.
 *
 * Most of these are set-up problems on a new hosted project (email delivery,
 * keys, missing tables), so the message says who can fix it. Codes come from
 * https://supabase.com/docs/guides/auth/debugging/error-codes. Unknown failures
 * keep the generic wording but show the code, which is safe to display and is
 * what anyone debugging needs first.
 */
export type AuthFailure = { code?: string; status?: number; message: string };

export function explainSignUpError(error: AuthFailure): {
  error: string;
  fieldErrors?: Record<string, string>;
} {
  const code = error.code ?? "";
  const message = error.message ?? "";

  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") {
    return {
      error:
        "Too many sign-up emails have been sent from this site. Wait an hour and try again. If you run this site, set up email delivery in Supabase, or turn off email confirmation.",
    };
  }
  if (code === "email_address_not_authorized") {
    return {
      error:
        "This site can’t send a confirmation email to that address yet. If you run this site, set up email delivery in Supabase, or turn off email confirmation.",
    };
  }
  if (code === "email_address_invalid") {
    return {
      error: "That email address can’t be used for an account.",
      fieldErrors: { email: "Try a different email address." },
    };
  }
  if (code === "signup_disabled" || code === "email_provider_disabled") {
    return { error: "New sign-ups are switched off for this site." };
  }
  if (/database error saving new user/i.test(message)) {
    return {
      error:
        "The account database isn’t set up yet. If you run this site, apply the database migrations (npx supabase db push).",
    };
  }
  if (/invalid api key/i.test(message) || error.status === 401) {
    return {
      error:
        "This site can’t connect to its database. If you run this site, check the Supabase URL and anon key in your hosting settings, then redeploy.",
    };
  }
  if (/error sending confirmation (email|mail)/i.test(message)) {
    return {
      error:
        "We couldn’t send the confirmation email. If you run this site, set up email delivery in Supabase, or turn off email confirmation.",
    };
  }
  if (error.status === 0 || /fetch failed|failed to fetch/i.test(message)) {
    return {
      error:
        "This site couldn’t reach its database. Try again in a moment. If you run this site, check the Supabase URL in your hosting settings.",
    };
  }
  return {
    error: `We couldn’t create your account. Try again in a moment. (Error: ${code || error.status || "unknown"})`,
  };
}
