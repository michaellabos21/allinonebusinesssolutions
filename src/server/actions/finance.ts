"use server";

import { randomUUID } from "node:crypto";

import { refresh } from "next/cache";

import { FORBIDDEN, context, explain, invalid } from "@/server/action-helpers";
import type { ActionResult } from "@/server/types";
import {
  RECEIPT_MAX_BYTES,
  RECEIPT_TYPES,
  archiveSchema,
  estimateDraftSchema,
  expenseSchema,
  idSchema,
  invoiceDraftSchema,
  paymentSchema,
  voidSchema,
} from "@/server/validation";

/**
 * Server actions for estimates, invoices, payments and expenses. Invoices,
 * estimates and payments change only through the database functions in
 * `supabase/migrations/20261011000004_finance.sql`, which check the role again,
 * compute every total and allow only the documented status changes. Nothing
 * here computes money that gets stored.
 */

type Saved = { id: string; name: string };
type Result<T = Saved> = ActionResult<T>;

/** The line fields the database reads; anything else the client sent is dropped. */
const linesFor = (
  items: {
    description: string;
    quantityMilli: number;
    unitPriceMinor: number;
    catalogItemId: string | null;
  }[],
) =>
  items.map((item) => ({
    description: item.description,
    quantityMilli: item.quantityMilli,
    unitPriceMinor: item.unitPriceMinor,
    catalogItemId: item.catalogItemId,
  }));

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export async function saveInvoiceDraftAction(input: unknown, id?: string): Promise<Result> {
  const parsed = invoiceDraftSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (id !== undefined && !idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("finance.manage");
  if (!ctx.allowed) return ctx.failure;

  const { items, ...header } = parsed.data;
  const { data, error } = await ctx.supabase.rpc("save_invoice_draft", {
    target_workspace: ctx.workspace.id,
    target_invoice: id ?? null,
    header,
    items: linesFor(items),
  });
  if (error) return explain(error, "invoice.save_failed");
  refresh();
  return { ok: true, data: { id: data as string, name: "Draft invoice" } };
}

export async function deleteInvoiceDraftAction(id: unknown): Promise<Result<undefined>> {
  if (!idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("finance.manage");
  if (!ctx.allowed) return ctx.failure;
  const { error } = await ctx.supabase.rpc("delete_invoice_draft", { target_invoice: id });
  if (error) return explain(error, "invoice.delete_failed");
  refresh();
  return { ok: true };
}

/**
 * Issues a draft and gives it its number. Email delivery isn't configured, so
 * nothing is sent: the person downloads or prints the invoice and sends it.
 */
export async function issueInvoiceAction(id: unknown): Promise<Result<{ number: string }>> {
  if (!idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("finance.manage");
  if (!ctx.allowed) return ctx.failure;
  const { data, error } = await ctx.supabase.rpc("issue_invoice", { target_invoice: id });
  if (error) return explain(error, "invoice.issue_failed");
  refresh();
  return { ok: true, data: { number: data as string } };
}

export async function recordPaymentAction(input: unknown): Promise<Result<undefined>> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await context("finance.manage");
  if (!ctx.allowed) return ctx.failure;
  const { error } = await ctx.supabase.rpc("record_payment", {
    target_invoice: parsed.data.invoiceId,
    amount: parsed.data.amountMinor,
    paid: parsed.data.paidOn,
    pay_method: parsed.data.method,
    pay_reference: parsed.data.reference,
    pay_note: parsed.data.note,
  });
  if (error) return explain(error, "invoice.payment_failed");
  refresh();
  return { ok: true };
}

export async function voidInvoiceAction(input: unknown): Promise<Result<undefined>> {
  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await context("finance.manage");
  if (!ctx.allowed) return ctx.failure;
  const { error } = await ctx.supabase.rpc("void_invoice", {
    target_invoice: parsed.data.id,
    reason: parsed.data.reason,
  });
  if (error) return explain(error, "invoice.void_failed");
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Estimates
// ---------------------------------------------------------------------------

export async function saveEstimateDraftAction(input: unknown, id?: string): Promise<Result> {
  const parsed = estimateDraftSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (id !== undefined && !idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("finance.manage");
  if (!ctx.allowed) return ctx.failure;

  const { items, ...header } = parsed.data;
  const { data, error } = await ctx.supabase.rpc("save_estimate_draft", {
    target_workspace: ctx.workspace.id,
    target_estimate: id ?? null,
    header,
    items: linesFor(items),
  });
  if (error) return explain(error, "estimate.save_failed");
  refresh();
  return { ok: true, data: { id: data as string, name: "Draft estimate" } };
}

export async function deleteEstimateDraftAction(id: unknown): Promise<Result<undefined>> {
  if (!idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("finance.manage");
  if (!ctx.allowed) return ctx.failure;
  const { error } = await ctx.supabase.rpc("delete_estimate_draft", { target_estimate: id });
  if (error) return explain(error, "estimate.delete_failed");
  refresh();
  return { ok: true };
}

export async function sendEstimateAction(id: unknown): Promise<Result<{ number: string }>> {
  if (!idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("finance.manage");
  if (!ctx.allowed) return ctx.failure;
  const { data, error } = await ctx.supabase.rpc("send_estimate", { target_estimate: id });
  if (error) return explain(error, "estimate.send_failed");
  refresh();
  return { ok: true, data: { number: data as string } };
}

export async function decideEstimateAction(
  id: unknown,
  accepted: unknown,
): Promise<Result<undefined>> {
  if (!idSchema.safeParse(id).success || typeof accepted !== "boolean") return FORBIDDEN;
  const ctx = await context("finance.manage");
  if (!ctx.allowed) return ctx.failure;
  const { error } = await ctx.supabase.rpc("decide_estimate", { target_estimate: id, accepted });
  if (error) return explain(error, "estimate.decide_failed");
  refresh();
  return { ok: true };
}

/** Makes a draft invoice from an accepted estimate, due after the usual payment terms. */
export async function convertEstimateAction(id: unknown): Promise<Result<{ invoiceId: string }>> {
  if (!idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("finance.manage");
  if (!ctx.allowed) return ctx.failure;
  const due = new Date(Date.now() + ctx.workspace.paymentTermDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const { data, error } = await ctx.supabase.rpc("convert_estimate_to_invoice", {
    target_estimate: id,
    due,
  });
  if (error?.message.includes("already_converted")) {
    return { ok: false, error: "This estimate has already been turned into an invoice." };
  }
  if (error) return explain(error, "estimate.convert_failed");
  refresh();
  return { ok: true, data: { invoiceId: data as string } };
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export async function saveExpenseAction(input: unknown, id?: string): Promise<Result> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (id !== undefined && !idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("finance.manage");
  if (!ctx.allowed) return ctx.failure;

  const values = {
    spent_on: parsed.data.date,
    vendor: parsed.data.vendor,
    category: parsed.data.category,
    description: parsed.data.description,
    amount_minor: parsed.data.amountMinor,
    payment_method: parsed.data.paymentMethod,
    notes: parsed.data.notes,
    project_id: parsed.data.projectId,
  };
  const query = id
    ? ctx.supabase.from("expenses").update(values).eq("id", id).eq("workspace_id", ctx.workspace.id)
    : ctx.supabase
        .from("expenses")
        .insert({ ...values, workspace_id: ctx.workspace.id, currency: ctx.workspace.currency });
  const { data, error } = await query.select("id, vendor");
  if (error || !data?.length) return explain(error, "expense.save_failed");
  refresh();
  return { ok: true, data: { id: data[0].id, name: data[0].vendor } };
}

export async function setExpenseArchivedAction(input: unknown): Promise<Result<undefined>> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return FORBIDDEN;
  const ctx = await context("finance.manage");
  if (!ctx.allowed) return ctx.failure;
  const { data, error } = await ctx.supabase
    .from("expenses")
    .update({ archived_at: parsed.data.archived ? new Date().toISOString() : null })
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id");
  if (error || !data?.length) return explain(error, "expense.archive_failed");
  refresh();
  return { ok: true };
}

const RECEIPTS_UNAVAILABLE: ActionResult<never> = {
  ok: false,
  error: "Receipt storage isn’t set up for this site yet, so files can’t be attached.",
};

const EXTENSIONS: Record<(typeof RECEIPT_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

/**
 * Stores a receipt in the private bucket under <workspace>/<expense>/ with a
 * random name, then links it. Storage rules let only finance staff of that
 * workspace read or write the folder.
 */
export async function attachReceiptAction(formData: FormData): Promise<Result<undefined>> {
  const expenseId = formData.get("expenseId");
  const file = formData.get("file");
  if (!idSchema.safeParse(expenseId).success || !(file instanceof File)) return FORBIDDEN;
  if (!RECEIPT_TYPES.includes(file.type as (typeof RECEIPT_TYPES)[number])) {
    return { ok: false, error: "Attach a JPEG, PNG, WebP, HEIC or PDF file." };
  }
  if (file.size === 0 || file.size > RECEIPT_MAX_BYTES) {
    return { ok: false, error: "Receipts can be up to 5 MB." };
  }
  const ctx = await context("finance.manage");
  if (!ctx.allowed) return ctx.failure;

  const { data: expense } = await ctx.supabase
    .from("expenses")
    .select("id, receipt_path")
    .eq("id", expenseId as string)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();
  if (!expense) return FORBIDDEN;

  const path = `${ctx.workspace.id}/${expense.id}/${randomUUID()}.${EXTENSIONS[file.type as (typeof RECEIPT_TYPES)[number]]}`;
  const upload = await ctx.supabase.storage
    .from("receipts")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) {
    return /not found|bucket/i.test(upload.error.message)
      ? RECEIPTS_UNAVAILABLE
      : explain({ message: upload.error.message }, "expense.receipt_upload_failed");
  }

  const { error } = await ctx.supabase
    .from("expenses")
    .update({ receipt_path: path })
    .eq("id", expense.id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return explain(error, "expense.receipt_link_failed");
  if (expense.receipt_path) {
    await ctx.supabase.storage.from("receipts").remove([expense.receipt_path]);
  }
  refresh();
  return { ok: true };
}

/** A link to view a receipt that works for one minute, made after checking access. */
export async function receiptLinkAction(expenseId: unknown): Promise<Result<{ url: string }>> {
  if (!idSchema.safeParse(expenseId).success) return FORBIDDEN;
  const ctx = await context("finance.manage");
  if (!ctx.allowed) return ctx.failure;
  const { data: expense } = await ctx.supabase
    .from("expenses")
    .select("receipt_path")
    .eq("id", expenseId as string)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();
  if (!expense?.receipt_path) return { ok: false, error: "This expense has no receipt." };
  const { data, error } = await ctx.supabase.storage
    .from("receipts")
    .createSignedUrl(expense.receipt_path, 60);
  if (error || !data) return RECEIPTS_UNAVAILABLE;
  return { ok: true, data: { url: data.signedUrl } };
}
