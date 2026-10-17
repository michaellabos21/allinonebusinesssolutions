"use server";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { checkAnswers } from "@/lib/lead-forms";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getPublicLeadForm } from "@/server/public-forms";
import type { ActionResult } from "@/server/types";
import { publicLeadSchema } from "@/server/validation";

const TOKEN = /^[0-9a-f]{36}$/;
const GONE = "This form is no longer available.";

/**
 * Accepts a submission from a public lead form. The visitor sends only the
 * form's token, their answers and where they came from; the database works out
 * the workspace from the token, checks every answer against the form and
 * applies the rate limits. A hidden field that people never see catches simple
 * bots: when it is filled in, the bot is thanked and nothing is saved.
 */
export async function submitLeadFormAction(
  token: unknown,
  input: unknown,
): Promise<ActionResult<{ message: string }>> {
  if (typeof token !== "string" || !TOKEN.test(token)) return { ok: false, error: GONE };
  const honeypot = (input as { website?: unknown } | null)?.website;
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return { ok: true, data: { message: "Thanks, we’ll be in touch soon." } };
  }
  const parsed = publicLeadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check your details and try again." };

  const form = await getPublicLeadForm(token);
  if (!form) return { ok: false, error: GONE };
  const fieldErrors = checkAnswers(form.fields, parsed.data.values, {
    required: form.consentText !== "",
    given: parsed.data.consent,
  });
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  }

  // The visitor's address is hashed with the form's token, so the stored value
  // identifies neither the person nor which other forms they used.
  const forwarded = (await headers()).get("x-forwarded-for") ?? "";
  const address = forwarded.split(",")[0]?.trim() || "unknown";
  const clientKey = createHash("sha256").update(`${token}:${address}`).digest("hex");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_lead_form", {
    form_token: token,
    payload: {
      values: parsed.data.values,
      consent: parsed.data.consent ? "true" : "",
      attribution: parsed.data.attribution,
    },
    client_key: clientKey,
  });
  if (error) {
    if (error.message.includes("rate_limited")) {
      return { ok: false, error: "Too many messages from here. Try again in a few minutes." };
    }
    if (error.message.includes("form_not_found")) return { ok: false, error: GONE };
    if (error.message.includes("invalid_submission")) {
      return { ok: false, error: "Check your details and try again." };
    }
    logger.error("lead_form.submit_failed", { code: error.code ?? "unknown" });
    return { ok: false, error: "We couldn’t send that. Try again in a moment." };
  }
  return { ok: true, data: { message: data as string } };
}

/** Counts one visit to a form, for its conversion rate. Failures are ignored. */
export async function recordLeadFormViewAction(token: unknown): Promise<void> {
  if (typeof token !== "string" || !TOKEN.test(token)) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_lead_form_view", { form_token: token });
  if (error) logger.warn("lead_form.view_failed", { code: error.code ?? "unknown" });
}
