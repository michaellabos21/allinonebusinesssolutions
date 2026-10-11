import { describe, expect, it } from "vitest";

import { explainSignUpError } from "@/server/auth-errors";

describe("explainSignUpError", () => {
  it("names the set-up problems a new hosted project usually has", () => {
    expect(
      explainSignUpError({ code: "over_email_send_rate_limit", status: 429, message: "x" }).error,
    ).toMatch(/Too many sign-up emails/);
    expect(
      explainSignUpError({ code: "email_address_not_authorized", status: 400, message: "x" }).error,
    ).toMatch(/can’t send a confirmation email/);
    expect(
      explainSignUpError({
        code: "unexpected_failure",
        status: 500,
        message: "Database error saving new user",
      }).error,
    ).toMatch(/database isn’t set up/);
    expect(explainSignUpError({ status: 401, message: "Invalid API key" }).error).toMatch(
      /can’t connect to its database/,
    );
    expect(
      explainSignUpError({
        code: "unexpected_failure",
        status: 500,
        message: "Error sending confirmation email",
      }).error,
    ).toMatch(/couldn’t send the confirmation email/);
    expect(explainSignUpError({ code: "signup_disabled", message: "x" }).error).toMatch(
      /switched off/,
    );
  });

  it("points at the email field for an address Supabase refuses", () => {
    expect(explainSignUpError({ code: "email_address_invalid", message: "x" }).fieldErrors).toEqual(
      { email: "Try a different email address." },
    );
  });

  it("shows the code for anything else, and never the raw message", () => {
    const result = explainSignUpError({ code: "something_new", status: 500, message: "secret" });
    expect(result.error).toContain("(Error: something_new)");
    expect(result.error).not.toContain("secret");
    expect(explainSignUpError({ status: 503, message: "x" }).error).toContain("(Error: 503)");
  });
});
