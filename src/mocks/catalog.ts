import type { CatalogItem } from "./types";

const item = (
  id: string,
  name: string,
  type: CatalogItem["type"],
  unitPriceMinor: number,
  unit: string,
  description: string,
): CatalogItem => ({ id, name, type, unitPriceMinor, unit, description, archived: false });

/** Rates match the lines on the demo invoices. */
export const catalogItems: CatalogItem[] = [
  item(
    "k1",
    "Design retainer hours",
    "service",
    250_000,
    "hour",
    "Ongoing design work billed by the hour.",
  ),
  item(
    "k2",
    "Page design",
    "service",
    1_200_000,
    "page",
    "One designed page, with two rounds of changes.",
  ),
  item("k3", "Website build days", "service", 800_000, "day", "Front-end build, billed per day."),
  item(
    "k4",
    "Logo and brand kit",
    "service",
    3_000_000,
    "project",
    "Logo, palette, type and usage guide.",
  ),
  item(
    "k5",
    "Label design",
    "service",
    560_000,
    "label",
    "One packaging label, including regulatory panel.",
  ),
  item(
    "k6",
    "Signage template",
    "service",
    400_000,
    "template",
    "Editable signage layout in the brand style.",
  ),
  item(
    "k7",
    "Discovery workshop",
    "service",
    1_800_000,
    "session",
    "Half-day session to agree goals and scope.",
  ),
  item(
    "k8",
    "Print-ready file prep",
    "service",
    550_000,
    "file",
    "Final artwork checked and exported for print.",
  ),
  item(
    "k9",
    "Stock photo licence",
    "product",
    120_000,
    "image",
    "Licensed image passed on at cost.",
  ),
  item(
    "k10",
    "Printed proof set",
    "product",
    395_000,
    "set",
    "Colour-accurate printed proofs, delivered.",
  ),
];
