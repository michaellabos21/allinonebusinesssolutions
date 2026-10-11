"use server";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/server/types";
import { fieldErrorsOf, publicLeadSchema } from "@/server/validation";

/**
 * Accepts a submission from a public lead form. The visitor sends only the
 * form's token and their details; the database works out the workspace from
 * the token and applies the rate limits. A hidden field that people never see
 * catches simple bots: when it is filled in, the bot is thanked and nothing is
 * saved.
 */
export async function submitLeadFormAction(
  token: unknown,
  input: unknown,
): Promise<ActionResult<{ message: string }>> {
  if (typeof token !== "string" || !/^[0-9a-f]{36}$/.test(token)) {
    return { ok: false, error: "This form is no longer available." };
  }
  const honeypot = (input as { website?: unknown } | null)?.website;
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return { ok: true, data: { message: "Thanks, we’ll be in touch soon." } };
  }
  const parsed = publicLeadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }

  // The visitor's address is hashed with the form's token, so the stored value
  // identifies neither the person nor which other forms they used.
  const forwarded = (await headers()).get("x-forwarded-for") ?? "";
  const address = forwarded.split(",")[0]?.trim() || "unknown";
  const clientKey = createHash("sha256").update(`${token}:${address}`).digest("hex");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_lead_form", {
    form_token: token,
    payload: { ...parsed.data, consent: parsed.data.consent ? "true" : "" },
    client_key: clientKey,
  });
  if (error) {
    if (error.message.includes("rate_limited")) {
      return { ok: false, error: "Too many messages from here. Try again in a few minutes." };
    }
    if (error.message.includes("form_not_found")) {
      return { ok: false, error: "This form is no longer available." };
    }
    if (error.message.includes("invalid_submission")) {
      return {
        ok: false,
        error: "Check your details and try again.",
        fieldErrors: parsed.data.consent ? undefined : { consent: "Tick the box to continue." },
      };
    }
    logger.error("lead_form.submit_failed", { code: error.code ?? "unknown" });
    return { ok: false, error: "We couldn’t send that. Try again in a moment." };
  }
  return { ok: true, data: { message: data as string } };
}
