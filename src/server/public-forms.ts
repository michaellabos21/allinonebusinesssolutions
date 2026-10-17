import "server-only";

import { DEFAULT_ACCENT, DEFAULT_FIELDS, type FormField } from "@/lib/lead-forms";
import { createClient } from "@/lib/supabase/server";

export type PublicLeadForm = {
  formName: string;
  businessName: string;
  intro: string;
  consentText: string;
  fields: FormField[];
  accentColor: string;
  buttonLabel: string;
  redirectUrl: string;
};

/**
 * What a visitor needs to draw a lead form, looked up by the token in its link.
 * The database function returns nothing for an unknown or switched-off form,
 * and never anything about the workspace's records.
 */
export async function getPublicLeadForm(token: string): Promise<PublicLeadForm | null> {
  if (!/^[0-9a-f]{36}$/.test(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_lead_form", { form_token: token });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = (data as Record<string, any>[] | null)?.[0];
  if (!row) return null;
  return {
    formName: row.form_name,
    businessName: row.business_name,
    intro: row.intro,
    consentText: row.consent_text,
    // Fallbacks keep the page working if the database hasn't been updated yet.
    fields: Array.isArray(row.fields) ? row.fields : DEFAULT_FIELDS,
    accentColor: row.accent_color ?? DEFAULT_ACCENT,
    buttonLabel: row.button_label ?? "Send",
    redirectUrl: row.redirect_url ?? "",
  };
}
