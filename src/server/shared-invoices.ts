import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { BillTo, InvoiceItem } from "@/mocks";

export type SharedInvoice = {
  businessName: string;
  number: string;
  status: "sent" | "partially_paid" | "paid" | "void";
  currency: string;
  issuedOn: string;
  dueOn: string;
  /** Today in the business's time zone, for "overdue". */
  today: string;
  billTo: BillTo | null;
  items: InvoiceItem[];
  subtotalMinor: number;
  discountMinor: number;
  taxRateBps: number;
  taxMinor: number;
  totalMinor: number;
  paidMinor: number;
  notes: string;
};

/**
 * One invoice as its client sees it, looked up by the token in its link. The
 * database function returns nothing for an unknown link or a draft, and never
 * anything else about the business.
 */
export async function getSharedInvoice(token: string): Promise<SharedInvoice | null> {
  if (!/^[0-9a-f]{36}$/.test(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_shared_invoice", { link_token: token });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as Record<string, any> | null;
  if (!row) return null;
  return {
    businessName: row.business_name,
    number: row.number,
    status: row.status,
    currency: row.currency,
    issuedOn: row.issued_on,
    dueOn: row.due_on,
    today: row.today,
    billTo: row.bill_to?.name ? row.bill_to : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (row.items ?? []).map((item: Record<string, any>) => ({
      id: item.id,
      description: item.description,
      quantityMilli: Number(item.quantity_milli),
      unitPriceMinor: Number(item.unit_price_minor),
      amountMinor: Number(item.amount_minor),
      catalogItemId: null,
    })),
    subtotalMinor: Number(row.subtotal_minor),
    discountMinor: Number(row.discount_minor),
    taxRateBps: row.tax_rate_bps,
    taxMinor: Number(row.tax_minor),
    totalMinor: Number(row.total_minor),
    paidMinor: Number(row.paid_minor),
    notes: row.notes,
  };
}
