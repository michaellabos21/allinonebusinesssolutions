import { describe, expect, it } from "vitest";

import {
  CUSTOM_KEY,
  DEFAULT_FIELDS,
  type FormField,
  checkAnswers,
  contrastWithWhite,
  embedSnippet,
  newCustomKey,
  readAttribution,
} from "@/lib/lead-forms";
import { leadFormSchema } from "@/server/validation";

const fields: FormField[] = [
  ...DEFAULT_FIELDS,
  { key: "c_budget1", type: "dropdown", label: "Budget", required: true, options: ["S", "L"] },
  {
    key: "c_svc1234",
    type: "checkboxes",
    label: "Services",
    required: true,
    options: ["Logo", "Web"],
  },
  { key: "c_start12", type: "date", label: "Start", required: false },
];
const noConsent = { required: false, given: false };
const good = { name: "Ana", email: "ana@cruz.example", c_budget1: "L", c_svc1234: ["Web"] };

describe("checkAnswers", () => {
  it("accepts a complete set of answers", () => {
    expect(checkAnswers(fields, good, noConsent)).toEqual({});
  });

  it("names each problem against its question", () => {
    expect(
      checkAnswers(
        fields,
        { name: " ", email: "nope", c_budget1: "XL", c_svc1234: [], c_start12: "2026-02-30" },
        { required: true, given: false },
      ),
    ).toEqual({
      name: "Fill this in.",
      email: "Enter an email address like name@company.com.",
      c_budget1: "Choose from the options shown.",
      c_svc1234: "Choose at least one.",
      c_start12: "Enter a real date.",
      consent: "Tick the box to continue.",
    });
  });

  it("refuses ticked boxes that aren't on the form, and over-long answers", () => {
    expect(checkAnswers(fields, { ...good, c_svc1234: ["Catering"] }, noConsent)).toEqual({
      c_svc1234: "Choose from the options shown.",
    });
    expect(checkAnswers(fields, { ...good, name: "x".repeat(121) }, noConsent)).toEqual({
      name: "That’s too long.",
    });
  });
});

describe("readAttribution", () => {
  it("reads campaign tags from the website page an embedded form sits on", () => {
    expect(
      readAttribution({
        formUrl: "https://kasama.space/f/abc?embed=1",
        hostPageUrl: "https://studio.example/contact?utm_source=google&utm_medium=cpc",
        referrer: "https://www.google.com/",
      }),
    ).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      page_url: "https://studio.example/contact?utm_source=google&utm_medium=cpc",
      referrer: "https://www.google.com/",
    });
  });

  it("falls back to the form's own link, and ignores addresses that aren't web pages", () => {
    expect(
      readAttribution({
        formUrl: "https://kasama.space/f/abc?utm_source=facebook&utm_campaign=october",
        hostPageUrl: null,
        referrer: "javascript:alert(1)",
      }),
    ).toEqual({ utm_source: "facebook", utm_campaign: "october" });
  });
});

describe("look and embed", () => {
  it("measures contrast against white button text", () => {
    expect(contrastWithWhite("#34479e")).toBeGreaterThan(4.5);
    expect(contrastWithWhite("#ffee88")).toBeLessThan(2);
  });

  it("builds embed code that only listens to its own form", () => {
    const code = embedSnippet("https://kasama.space", "a".repeat(36), 'Quote "request"');
    expect(code).toContain(`https://kasama.space/f/${"a".repeat(36)}?embed=1&page=`);
    expect(code).toContain('event.origin !== "https://kasama.space"');
    expect(code).toContain("event.source !== frame.contentWindow");
    expect(code).toContain('frame.title = "Quote request"');
  });

  it("makes keys the database accepts", () => {
    for (let i = 0; i < 20; i += 1) expect(newCustomKey()).toMatch(CUSTOM_KEY);
  });
});

describe("leadFormSchema", () => {
  const form = {
    name: "Quote request",
    intro: "",
    consentText: "",
    successMessage: "Thanks.",
    active: true,
    fields,
    accentColor: "#0F6B66",
    buttonLabel: "Request a quote",
    redirectUrl: "",
  };

  it("accepts a valid form and tidies colours and choices", () => {
    const parsed = leadFormSchema.parse({
      ...form,
      fields: [...DEFAULT_FIELDS, { ...fields[6], placeholder: "ignored", options: ["Logo", ""] }],
    });
    expect(parsed.accentColor).toBe("#0f6b66");
    expect(parsed.fields.at(-1)).toEqual({
      key: "c_svc1234",
      type: "checkboxes",
      label: "Services",
      required: true,
      options: ["Logo"],
    });
  });

  it("keeps name and email required, and refuses unreadable colours and plain-http redirects", () => {
    const issues = (input: object) =>
      leadFormSchema.safeParse({ ...form, ...input }).error?.issues.map((issue) => issue.message);
    expect(
      issues({ fields: [{ ...DEFAULT_FIELDS[0], required: false }, DEFAULT_FIELDS[1]] }),
    ).toContain("Name and email are always required.");
    expect(issues({ fields: [DEFAULT_FIELDS[0], DEFAULT_FIELDS[2]] })).toContain(
      "A form always asks for a name and an email.",
    );
    expect(issues({ accentColor: "#ffee88" })).toContain(
      "Pick a darker colour so the white button text stays readable.",
    );
    expect(issues({ redirectUrl: "http://studio.example" })).toContain(
      "Use a full https:// address, or leave it empty.",
    );
  });
});
