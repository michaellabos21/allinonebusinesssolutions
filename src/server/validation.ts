import { z } from "zod";

import { CURRENCY_OPTIONS, TAX_OPTIONS } from "@/config/app";
import { ASSIGNABLE_ROLES } from "@/server/permissions";

/**
 * Input rules shared by server actions. Every action parses its input with one
 * of these before doing anything else; the database repeats the important
 * limits as constraints.
 */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter an email address.")
  .max(254, "That email address is too long.")
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter an email address like name@company.com.");

const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use 72 characters or fewer.");

const timezone = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid time zone.");

const currencyCodes = CURRENCY_OPTIONS.map((option) => option.code) as [string, ...string[]];
const taxRates = TAX_OPTIONS.map((option) => option.bps) as number[];

export const signUpSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(120, "Use 120 characters or fewer."),
  email,
  password,
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

export const emailOnlySchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((value) => value.password === value.confirm, {
    path: ["confirm"],
    message: "The two passwords don’t match.",
  });

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Enter a workspace name.").max(80, "Use 80 characters or fewer."),
  timezone,
  country: z.string().regex(/^[A-Z]{2}$/, "Choose a country."),
  currency: z.enum(currencyCodes, "Choose a currency."),
});

export const workspaceSettingsSchema = z.object({
  name: z.string().trim().min(1, "Enter a workspace name.").max(80, "Use 80 characters or fewer."),
  currency: z.enum(currencyCodes, "Choose a currency."),
  taxRateBps: z.coerce
    .number()
    .refine((value) => taxRates.includes(value), "Choose one of the listed tax options."),
  paymentTermDays: z.coerce
    .number("Enter a whole number of days from 0 to 90.")
    .int("Enter a whole number of days from 0 to 90.")
    .min(0, "Enter a whole number of days from 0 to 90.")
    .max(90, "Enter a whole number of days from 0 to 90."),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(120, "Use 120 characters or fewer."),
  jobTitle: z.string().trim().max(120, "Use 120 characters or fewer."),
});

export const preferencesSchema = z.object({
  dateFormat: z.enum(["dmy", "mdy"]),
  weekStartsOn: z.coerce.number().refine((value) => value === 0 || value === 1),
});

export const NOTIFICATION_COLUMNS = {
  invoiceOverdue: "notify_invoice_overdue",
  paymentReceived: "notify_payment_received",
  taskDue: "notify_task_due",
  mentions: "notify_mentions",
  weeklySummary: "notify_weekly_summary",
} as const;

export const notificationPrefSchema = z.object({
  id: z.enum(Object.keys(NOTIFICATION_COLUMNS) as [keyof typeof NOTIFICATION_COLUMNS]),
  enabled: z.boolean(),
});

export const inviteSchema = z.object({
  email,
  role: z.enum(ASSIGNABLE_ROLES, "Choose a role."),
});

export const memberRoleSchema = z.object({
  membershipId: z.uuid(),
  role: z.enum(ASSIGNABLE_ROLES),
});

export const idSchema = z.uuid();

/** Turns a Zod failure into one message per field, for showing beside inputs. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
