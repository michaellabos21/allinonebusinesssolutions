import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { computeInvoiceTotals, type LineInput } from "@/lib/money";

import {
  type TestUser,
  addMember,
  admin,
  anonymous,
  cleanUp,
  createUser,
  createWorkspace,
} from "./helpers";

/**
 * Proves the Phase 4 finance rules against a real database: server-side
 * totals that match `src/lib/money.ts`, safe numbering, status transitions,
 * partial payments, voids and who may do what.
 *
 * Cast: Ana owns workspace A, with Max (manager), Mia (member) and Cleo
 * (client). Ben owns workspace B.
 */
let ana: TestUser, max: TestUser, mia: TestUser, cleo: TestUser, ben: TestUser;
let workspaceA: string, workspaceB: string;
let contactA: string;

const TABLES = ["invoices", "invoice_items", "payments", "estimates", "estimate_items", "expenses"];
const today = new Date().toISOString().slice(0, 10);
const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const lines = (items: LineInput[]) =>
  items.map((item, index) => ({ description: `Line ${index + 1}`, ...item }));

async function draft(
  user: TestUser,
  items: LineInput[],
  header: Record<string, unknown> = {},
  workspace = workspaceA,
) {
  return user.client.rpc("save_invoice_draft", {
    target_workspace: workspace,
    target_invoice: null,
    header: { contactId: contactA, issuedOn: today, dueOn: inDays(15), ...header },
    items: lines(items),
  });
}

async function invoice(id: string) {
  const { data } = await admin.from("invoices").select("*").eq("id", id).single();
  return data!;
}

beforeAll(async () => {
  [ana, max, mia, cleo, ben] = await Promise.all(
    ["ana", "max", "mia", "cleo", "ben"].map((label) => createUser(`fin-${label}`)),
  );
  workspaceA = await createWorkspace(ana, "Finance A");
  workspaceB = await createWorkspace(ben, "Finance B");
  await addMember(ana, workspaceA, max, "manager");
  await addMember(ana, workspaceA, mia, "member");
  await addMember(ana, workspaceA, cleo, "client");
  const { data } = await ana.client
    .from("contacts")
    .insert({ workspace_id: workspaceA, name: "Bianca Soriano", email: "bianca@fin.test" })
    .select("id")
    .single();
  contactA = data!.id;
});

afterAll(cleanUp);

describe("totals", () => {
  const cases: { name: string; items: LineInput[]; discount: number; tax: number }[] = [
    {
      name: "whole quantities",
      items: [{ quantityMilli: 3000, unitPriceMinor: 1_200_000 }],
      discount: 0,
      tax: 0,
    },
    {
      name: "fractions, discount and VAT",
      items: [
        { quantityMilli: 1500, unitPriceMinor: 250_000 },
        { quantityMilli: 335, unitPriceMinor: 100 },
        { quantityMilli: 7333, unitPriceMinor: 33_333 },
      ],
      discount: 12_345,
      tax: 1200,
    },
    {
      name: "half-up tax",
      items: [{ quantityMilli: 1000, unitPriceMinor: 25 }],
      discount: 0,
      tax: 200,
    },
    {
      name: "discount larger than subtotal",
      items: [{ quantityMilli: 1000, unitPriceMinor: 10_000 }],
      discount: 99_999,
      tax: 1200,
    },
  ];

  for (const sample of cases) {
    it(`match the app's arithmetic: ${sample.name}`, async () => {
      const { data: id, error } = await draft(max, sample.items, {
        discountMinor: sample.discount,
        taxRateBps: sample.tax,
      });
      expect(error).toBeNull();
      const stored = await invoice(id);
      const expected = computeInvoiceTotals(sample.items, sample.discount, sample.tax);
      expect({
        subtotalMinor: Number(stored.subtotal_minor),
        discountMinor: Number(stored.discount_minor),
        taxMinor: Number(stored.tax_minor),
        totalMinor: Number(stored.total_minor),
      }).toEqual(expected);
      expect(stored.currency).toBe("PHP");
      expect(stored.status).toBe("draft");
      expect(stored.number).toBeNull();
    });
  }

  it("ignores line amounts and totals sent by the client", async () => {
    const { data: id } = await max.client.rpc("save_invoice_draft", {
      target_workspace: workspaceA,
      target_invoice: null,
      header: { contactId: contactA, issuedOn: today, dueOn: inDays(15), totalMinor: 1 },
      items: [
        { description: "Design", quantityMilli: 1000, unitPriceMinor: 500_000, amountMinor: 1 },
      ],
    });
    const stored = await invoice(id);
    expect(Number(stored.total_minor)).toBe(500_000);
    const { data: items } = await admin
      .from("invoice_items")
      .select("amount_minor")
      .eq("invoice_id", id);
    expect(items?.map((item) => Number(item.amount_minor))).toEqual([500_000]);
  });

  it("refuses bad lines: none, fractional minor units, zero quantity, foreign catalog items", async () => {
    for (const items of [
      [],
      [{ description: "x", quantityMilli: 1000, unitPriceMinor: 1.5 }],
      [{ description: "x", quantityMilli: 0, unitPriceMinor: 100 }],
      [{ description: "", quantityMilli: 1000, unitPriceMinor: 100 }],
    ]) {
      const { error } = await max.client.rpc("save_invoice_draft", {
        target_workspace: workspaceA,
        target_invoice: null,
        header: { contactId: contactA, issuedOn: today, dueOn: inDays(15) },
        items,
      });
      expect(error, JSON.stringify(items)).not.toBeNull();
    }
    const { data: foreignItem } = await ben.client
      .from("products_services")
      .insert({
        workspace_id: workspaceB,
        name: "B item",
        unit_price_minor: 100,
        currency: "PHP",
        unit: "x",
      })
      .select("id")
      .single();
    const { error } = await draft(max, [
      { quantityMilli: 1000, unitPriceMinor: 100, catalogItemId: foreignItem!.id } as LineInput,
    ]);
    expect(error?.message).toContain("invalid_items");
  });
});

describe("issuing and numbering", () => {
  it("numbers invoices in order when issued, and records who they were for", async () => {
    const { data: first } = await draft(max, [{ quantityMilli: 1000, unitPriceMinor: 100_000 }]);
    const { data: number, error } = await max.client.rpc("issue_invoice", {
      target_invoice: first,
    });
    expect(error).toBeNull();
    expect(number).toMatch(/^INV-\d{4}$/);
    const stored = await invoice(first);
    expect(stored.status).toBe("sent");
    expect(stored.bill_to).toMatchObject({ name: "Bianca Soriano", email: "bianca@fin.test" });

    // An issued invoice can't be edited, deleted or issued again.
    const edit = await max.client.rpc("save_invoice_draft", {
      target_workspace: workspaceA,
      target_invoice: first,
      header: { contactId: contactA, issuedOn: today, dueOn: inDays(15) },
      items: lines([{ quantityMilli: 1000, unitPriceMinor: 1 }]),
    });
    expect(edit.error?.message).toContain("not_a_draft");
    expect(
      (await max.client.rpc("delete_invoice_draft", { target_invoice: first })).error?.message,
    ).toContain("not_a_draft");
    expect(
      (await max.client.rpc("issue_invoice", { target_invoice: first })).error?.message,
    ).toContain("not_a_draft");
  });

  it("never gives two invoices the same number, even when issued at the same moment", async () => {
    const drafts = await Promise.all(
      Array.from({ length: 12 }, () =>
        draft(max, [{ quantityMilli: 1000, unitPriceMinor: 1_000 }]),
      ),
    );
    const results = await Promise.all(
      drafts.map(({ data }) => max.client.rpc("issue_invoice", { target_invoice: data })),
    );
    expect(results.every((result) => result.error === null)).toBe(true);
    const numbers = results.map((result) => Number(String(result.data).replace(/\D/g, "")));
    expect(new Set(numbers).size).toBe(12);
    const sorted = [...numbers].sort((a, b) => a - b);
    expect(sorted.at(-1)! - sorted[0]).toBe(11);
  });

  it("needs a client and a total above zero to issue", async () => {
    const { data: noContact } = await draft(max, [{ quantityMilli: 1000, unitPriceMinor: 100 }], {
      contactId: null,
    });
    expect(
      (await max.client.rpc("issue_invoice", { target_invoice: noContact })).error?.message,
    ).toContain("bill_to_required");
    const { data: zero } = await draft(max, [{ quantityMilli: 1000, unitPriceMinor: 0 }]);
    expect(
      (await max.client.rpc("issue_invoice", { target_invoice: zero })).error?.message,
    ).toContain("total_required");
  });

  it("uses the workspace's own prefix", async () => {
    await ana.client.from("workspaces").update({ invoice_prefix: "AB-" }).eq("id", workspaceA);
    const { data: id } = await draft(max, [{ quantityMilli: 1000, unitPriceMinor: 100 }]);
    const { data: number } = await max.client.rpc("issue_invoice", { target_invoice: id });
    expect(number).toMatch(/^AB-\d{4}$/);
    await ana.client.from("workspaces").update({ invoice_prefix: "INV-" }).eq("id", workspaceA);
  });
});

describe("payments", () => {
  let id: string;
  const pay = (amount: number, user = max, date = today) =>
    user.client.rpc("record_payment", {
      target_invoice: id,
      amount,
      paid: date,
      pay_method: "bank_transfer",
      pay_reference: "BT-001",
      pay_note: "",
    });

  beforeAll(async () => {
    const { data } = await draft(max, [{ quantityMilli: 1000, unitPriceMinor: 100_000 }], {
      taxRateBps: 1200,
    });
    id = data;
  });

  it("can't be recorded on a draft", async () => {
    expect((await pay(1_000)).error?.message).toContain("not_payable");
    await max.client.rpc("issue_invoice", { target_invoice: id });
  });

  it("accepts part payments and tracks the balance", async () => {
    expect((await pay(50_000)).error).toBeNull();
    let stored = await invoice(id);
    expect(stored.status).toBe("partially_paid");
    expect(Number(stored.paid_minor)).toBe(50_000);

    // Total is 1,120.00; 500.00 paid, 620.00 left. Paying 620.01 is refused.
    expect((await pay(62_001)).error?.message).toContain("overpayment");
    expect((await pay(0)).error?.message).toContain("invalid_amount");
    expect((await pay(62_000)).error).toBeNull();
    stored = await invoice(id);
    expect(stored.status).toBe("paid");
    expect(Number(stored.paid_minor)).toBe(112_000);
    expect((await pay(1)).error?.message).toContain("not_payable");
  });

  it("are refused for members, clients and outsiders", async () => {
    for (const user of [mia, cleo, ben]) {
      expect((await pay(1, user)).error?.message, user.email).toContain("not_found");
    }
  });

  it("are written to the audit log with the real person", async () => {
    const { data } = await ana.client
      .from("audit_logs")
      .select("event, actor_id")
      .eq("target_id", id)
      .order("created_at");
    expect(data?.map((row) => row.event)).toEqual([
      "invoice.issued",
      "invoice.payment_recorded",
      "invoice.payment_recorded",
    ]);
    expect(new Set(data?.map((row) => row.actor_id))).toEqual(new Set([max.id]));
  });
});

describe("voiding", () => {
  it("cancels an unpaid invoice with a reason, after which nothing changes it", async () => {
    const { data: id } = await draft(max, [{ quantityMilli: 1000, unitPriceMinor: 10_000 }]);
    expect(
      (await max.client.rpc("void_invoice", { target_invoice: id, reason: "x" })).error?.message,
    ).toContain("not_issued");
    await max.client.rpc("issue_invoice", { target_invoice: id });
    expect(
      (await max.client.rpc("void_invoice", { target_invoice: id, reason: " " })).error?.message,
    ).toContain("reason_required");
    expect(
      (await max.client.rpc("void_invoice", { target_invoice: id, reason: "Billed twice" })).error,
    ).toBeNull();
    const stored = await invoice(id);
    expect(stored.status).toBe("void");
    expect(stored.void_reason).toBe("Billed twice");
    const payment = await max.client.rpc("record_payment", {
      target_invoice: id,
      amount: 100,
      paid: today,
      pay_method: "cash",
      pay_reference: "",
      pay_note: "",
    });
    expect(payment.error?.message).toContain("not_payable");
  });

  it("is refused once anything has been paid", async () => {
    const { data: id } = await draft(max, [{ quantityMilli: 1000, unitPriceMinor: 10_000 }]);
    await max.client.rpc("issue_invoice", { target_invoice: id });
    await max.client.rpc("record_payment", {
      target_invoice: id,
      amount: 100,
      paid: today,
      pay_method: "cash",
      pay_reference: "",
      pay_note: "",
    });
    expect(
      (await max.client.rpc("void_invoice", { target_invoice: id, reason: "x" })).error?.message,
    ).toContain("has_payments");
  });
});

describe("access", () => {
  it("hides every finance table from members, clients, other workspaces and the public", async () => {
    await ana.client.from("expenses").insert({
      workspace_id: workspaceA,
      spent_on: today,
      vendor: "Printer",
      category: "Printing",
      amount_minor: 5_000,
      currency: "PHP",
    });
    for (const reader of [mia.client, cleo.client, ben.client, anonymous()]) {
      for (const table of TABLES) {
        const { data } = await reader.from(table).select("id").eq("workspace_id", workspaceA);
        expect(data ?? [], table).toEqual([]);
      }
    }
  });

  it("lets nobody write invoices, items or payments directly", async () => {
    const { data: id } = await draft(max, [{ quantityMilli: 1000, unitPriceMinor: 100 }]);
    const direct = [
      await ana.client.from("invoices").update({ total_minor: 1 }).eq("id", id),
      await ana.client.from("invoices").update({ status: "paid" }).eq("id", id),
      await ana.client.from("invoice_items").delete().eq("invoice_id", id),
      await ana.client.from("payments").insert({
        workspace_id: workspaceA,
        invoice_id: id,
        amount_minor: 1,
        paid_on: today,
        method: "cash",
      }),
      await ana.client.from("invoices").insert({
        workspace_id: workspaceA,
        currency: "PHP",
        due_on: today,
      }),
    ];
    for (const result of direct) expect(result.error).not.toBeNull();
    expect(Number((await invoice(id)).total_minor)).toBe(100);
  });

  it("refuses drafts from members and from outsiders into another workspace", async () => {
    expect(
      (await draft(mia, [{ quantityMilli: 1000, unitPriceMinor: 100 }])).error?.message,
    ).toContain("forbidden");
    expect(
      (await draft(ben, [{ quantityMilli: 1000, unitPriceMinor: 100 }], {}, workspaceA)).error
        ?.message,
    ).toContain("forbidden");
    // Nor can a draft in B bill a contact from A.
    const crossed = await draft(
      ben,
      [{ quantityMilli: 1000, unitPriceMinor: 100 }],
      {},
      workspaceB,
    );
    expect(crossed.error?.message).toContain("contact_not_found");
  });
});

describe("estimates", () => {
  it("are sent, accepted and turned into a draft invoice once, with the same totals", async () => {
    const { data: id, error } = await max.client.rpc("save_estimate_draft", {
      target_workspace: workspaceA,
      target_estimate: null,
      header: {
        contactId: contactA,
        issuedOn: today,
        validUntil: inDays(30),
        taxRateBps: 1200,
        discountMinor: 1_000,
      },
      items: lines([
        { quantityMilli: 2500, unitPriceMinor: 80_000 },
        { quantityMilli: 1000, unitPriceMinor: 15_050 },
      ]),
    });
    expect(error).toBeNull();
    expect(
      (await max.client.rpc("decide_estimate", { target_estimate: id, accepted: true })).error
        ?.message,
    ).toContain("not_sent");
    const { data: number } = await max.client.rpc("send_estimate", { target_estimate: id });
    expect(number).toMatch(/^EST-\d{4}$/);
    expect(
      (
        await max.client.rpc("convert_estimate_to_invoice", {
          target_estimate: id,
          due: inDays(15),
        })
      ).error?.message,
    ).toContain("not_accepted");
    expect(
      (await max.client.rpc("decide_estimate", { target_estimate: id, accepted: true })).error,
    ).toBeNull();

    const { data: invoiceId, error: convertError } = await max.client.rpc(
      "convert_estimate_to_invoice",
      {
        target_estimate: id,
        due: inDays(15),
      },
    );
    expect(convertError).toBeNull();
    const { data: estimate } = await admin.from("estimates").select("*").eq("id", id).single();
    const stored = await invoice(invoiceId);
    expect(stored.status).toBe("draft");
    expect(stored.estimate_id).toBe(id);
    expect(Number(stored.total_minor)).toBe(Number(estimate!.total_minor));
    expect(Number(stored.total_minor)).toBe(
      computeInvoiceTotals(
        [
          { quantityMilli: 2500, unitPriceMinor: 80_000 },
          { quantityMilli: 1000, unitPriceMinor: 15_050 },
        ],
        1_000,
        1200,
      ).totalMinor,
    );
    const { data: copied } = await admin
      .from("invoice_items")
      .select("description")
      .eq("invoice_id", invoiceId);
    expect(copied).toHaveLength(2);
    expect(
      (
        await max.client.rpc("convert_estimate_to_invoice", {
          target_estimate: id,
          due: inDays(15),
        })
      ).error?.message,
    ).toContain("already_converted");
  });
});

describe("expenses", () => {
  it("are kept by managers, refused to members, and receipts must sit under their own expense", async () => {
    const { data, error } = await max.client
      .from("expenses")
      .insert({
        workspace_id: workspaceA,
        spent_on: today,
        vendor: "Adobe",
        category: "Software",
        amount_minor: 125_000,
        currency: "PHP",
        payment_method: "card",
      })
      .select("id, created_by")
      .single();
    expect(error).toBeNull();
    expect(data?.created_by).toBe(max.id);

    const member = await mia.client.from("expenses").insert({
      workspace_id: workspaceA,
      spent_on: today,
      vendor: "x",
      category: "x",
      amount_minor: 1,
      currency: "PHP",
    });
    expect(member.error).not.toBeNull();

    const wrongPath = await max.client
      .from("expenses")
      .update({ receipt_path: `${workspaceB}/${data!.id}/receipt.pdf` })
      .eq("id", data!.id);
    expect(wrongPath.error).not.toBeNull();
    const rightPath = await max.client
      .from("expenses")
      .update({ receipt_path: `${workspaceA}/${data!.id}/receipt.pdf` })
      .eq("id", data!.id);
    expect(rightPath.error).toBeNull();

    await ana.client.from("expenses").delete().eq("id", data!.id);
    expect((await admin.from("expenses").select("id").eq("id", data!.id)).data).toHaveLength(1);
  });
});

describe("reconciliation", () => {
  it("issued totals, payments and balances agree", async () => {
    const { data: invoices } = await max.client
      .from("invoices")
      .select("id, status, total_minor, paid_minor")
      .eq("workspace_id", workspaceA);
    const { data: payments } = await max.client
      .from("payments")
      .select("invoice_id, amount_minor")
      .eq("workspace_id", workspaceA);
    for (const row of invoices ?? []) {
      const paid = (payments ?? [])
        .filter((payment) => payment.invoice_id === row.id)
        .reduce((sum, payment) => sum + Number(payment.amount_minor), 0);
      expect(Number(row.paid_minor), row.id).toBe(paid);
      if (row.status === "paid") expect(paid).toBe(Number(row.total_minor));
      if (row.status === "draft" || row.status === "void") expect(paid).toBe(0);
    }
  });
});
