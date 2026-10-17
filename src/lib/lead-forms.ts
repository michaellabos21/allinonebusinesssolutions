/**
 * The questions a lead form asks, shared by the form builder, the public form
 * and the server. The database checks the same rules again
 * (private.valid_lead_form_fields and public.submit_lead_form).
 */

export const FIELD_TYPES = [
  "short_text",
  "long_text",
  "email",
  "phone",
  "dropdown",
  "checkboxes",
  "date",
] as const;
export type FormFieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABEL: Record<FormFieldType, string> = {
  short_text: "Short answer",
  long_text: "Paragraph",
  email: "Email",
  phone: "Phone",
  dropdown: "Dropdown",
  checkboxes: "Checkboxes",
  date: "Date",
};

export type FormField = {
  /** name, email, phone, company or message for the lead's own columns; c_<random> otherwise. */
  key: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  /** Choices for dropdown and checkboxes fields. */
  options?: string[];
};

/** Questions that fill in the lead's own columns. Their type is fixed. */
export const BUILT_IN_FIELDS = {
  name: { type: "short_text", label: "Your name", alwaysRequired: true },
  email: { type: "email", label: "Email", alwaysRequired: true },
  phone: { type: "phone", label: "Phone", alwaysRequired: false },
  company: { type: "short_text", label: "Company", alwaysRequired: false },
  message: { type: "long_text", label: "How can we help?", alwaysRequired: false },
} as const satisfies Record<
  string,
  { type: FormFieldType; label: string; alwaysRequired: boolean }
>;
export type BuiltInKey = keyof typeof BUILT_IN_FIELDS;

export const isBuiltIn = (key: string): key is BuiltInKey => key in BUILT_IN_FIELDS;

/** Name and email can be reworded but never removed or made optional. */
export const isLocked = (key: string) => isBuiltIn(key) && BUILT_IN_FIELDS[key].alwaysRequired;

export const MAX_FIELDS = 25;
export const MAX_OPTIONS = 30;
export const CUSTOM_KEY = /^c_[a-z0-9]{6,12}$/;

/** What a new form asks, and what forms made before custom fields ask. */
export const DEFAULT_FIELDS: FormField[] = (Object.keys(BUILT_IN_FIELDS) as BuiltInKey[]).map(
  (key) => ({
    key,
    type: BUILT_IN_FIELDS[key].type,
    label: BUILT_IN_FIELDS[key].label,
    required: BUILT_IN_FIELDS[key].alwaysRequired,
  }),
);

/** A key for a new custom question; random, so renaming a question never changes it. */
export function newCustomKey() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `c_${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}

/** Longest answer accepted for each kind of question. */
export const MAX_ANSWER: Record<FormFieldType, number> = {
  short_text: 200,
  long_text: 2000,
  email: 254,
  phone: 40,
  dropdown: 80,
  checkboxes: 80,
  date: 10,
};
const maxLength = (field: FormField) =>
  field.key === "name" || field.key === "company" ? 120 : MAX_ANSWER[field.type];

export type FormValues = Record<string, string | string[]>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isCalendarDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Checks a visitor's answers against the form's questions. Returns a message
 * per field key (and `consent`) that needs fixing; empty when all is well.
 */
export function checkAnswers(
  fields: FormField[],
  values: FormValues,
  consent: { required: boolean; given: boolean },
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const raw = values[field.key];
    if (field.type === "checkboxes") {
      const picked = Array.isArray(raw) ? raw : [];
      if (field.required && picked.length === 0) errors[field.key] = "Choose at least one.";
      else if (picked.some((value) => !field.options?.includes(value))) {
        errors[field.key] = "Choose from the options shown.";
      }
      continue;
    }
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) {
      if (field.required) {
        errors[field.key] =
          field.type === "dropdown" || field.type === "date" ? "Choose one." : "Fill this in.";
      }
      continue;
    }
    if (value.length > maxLength(field)) errors[field.key] = "That’s too long.";
    else if (field.type === "email" && !EMAIL.test(value)) {
      errors[field.key] = "Enter an email address like name@company.com.";
    } else if (field.type === "dropdown" && !field.options?.includes(value)) {
      errors[field.key] = "Choose from the options shown.";
    } else if (field.type === "date" && !isCalendarDay(value)) {
      errors[field.key] = "Enter a real date.";
    }
  }
  if (consent.required && !consent.given) errors.consent = "Tick the box to continue.";
  return errors;
}

// ---------------------------------------------------------------------------
// Where an enquiry came from
// ---------------------------------------------------------------------------

export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "referrer",
  "page_url",
] as const;
export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];
export type Attribution = Partial<Record<AttributionKey, string>>;

export const ATTRIBUTION_LABEL: Record<AttributionKey, string> = {
  utm_source: "Source",
  utm_medium: "Medium",
  utm_campaign: "Campaign",
  utm_term: "Term",
  utm_content: "Content",
  referrer: "Came from",
  page_url: "Form page",
};

const UTM_KEYS = ATTRIBUTION_KEYS.filter((key) => key.startsWith("utm_"));

const webAddress = (value: string | null | undefined) => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href.slice(0, 500)
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Reads UTM tags from the page the form sits on (falling back to the form's
 * own address, for a shared link), plus the page and the referring site.
 */
export function readAttribution({
  formUrl,
  hostPageUrl,
  referrer,
}: {
  formUrl: string;
  /** The website page an embedded form sits on, when there is one. */
  hostPageUrl?: string | null;
  referrer?: string | null;
}): Attribution {
  const out: Attribution = {};
  const page = webAddress(hostPageUrl) ?? webAddress(formUrl);
  for (const source of [hostPageUrl, formUrl]) {
    const url = webAddress(source);
    if (!url) continue;
    const params = new URL(url).searchParams;
    for (const key of UTM_KEYS) {
      const value = params.get(key)?.trim();
      if (value && !out[key]) out[key] = value.slice(0, 150);
    }
  }
  // The form page itself is only worth recording when it is someone's website.
  if (hostPageUrl && page) out.page_url = page;
  const from = webAddress(referrer);
  if (from) out.referrer = from;
  return out;
}

// ---------------------------------------------------------------------------
// Look
// ---------------------------------------------------------------------------

export const DEFAULT_ACCENT = "#34479e";

/** Suggested button colours, each dark enough for white text. */
export const ACCENT_PRESETS = ["#34479e", "#0f6b66", "#6b3a7d", "#3b4658", "#b4322a", "#1e7a4c"];

function luminance(hex: string) {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG contrast ratio between white text and a `#rrggbb` colour. */
export function contrastWithWhite(hex: string) {
  return 1.05 / (luminance(hex) + 0.05);
}

/** The message the embedded form posts to the page around it as its height changes. */
export const EMBED_MESSAGE = "kasama-form-height";

/** Code to paste into a website to show a form there, sized to fit. */
export function embedSnippet(origin: string, token: string, title: string) {
  const id = `kasama-form-${token.slice(0, 8)}`;
  const safeTitle = title.replace(/[<>"&]/g, "");
  return `<div id="${id}"></div>
<script>
(function () {
  var box = document.getElementById("${id}");
  var frame = document.createElement("iframe");
  frame.src = "${origin}/f/${token}?embed=1&page=" + encodeURIComponent(location.href) +
    "&ref=" + encodeURIComponent(document.referrer);
  frame.title = "${safeTitle}";
  frame.loading = "lazy";
  frame.style.cssText = "width:100%;border:0;min-height:480px";
  box.appendChild(frame);
  window.addEventListener("message", function (event) {
    if (event.origin !== "${origin}" || event.source !== frame.contentWindow) return;
    if (event.data && event.data.type === "${EMBED_MESSAGE}") frame.style.height = event.data.height + "px";
  });
})();
</script>`;
}
