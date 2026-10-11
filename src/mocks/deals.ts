import type { Deal, DealStage } from "./types";

export const DEAL_STAGES: { id: DealStage; label: string; open: boolean }[] = [
  { id: "lead", label: "Lead", open: true },
  { id: "qualified", label: "Qualified", open: true },
  { id: "proposal", label: "Proposal", open: true },
  { id: "negotiation", label: "Negotiation", open: true },
  { id: "won", label: "Won", open: false },
  { id: "lost", label: "Lost", open: false },
];

export const OPEN_DEAL_STAGES = DEAL_STAGES.filter((stage) => stage.open);

const deal = (
  id: string,
  name: string,
  companyId: string,
  contactId: string,
  ownerId: string,
  stage: DealStage,
  valueMinor: number,
  expectedCloseOn: string,
): Deal => ({
  id,
  name,
  companyId,
  contactId,
  ownerId,
  stage,
  valueMinor,
  expectedCloseOn,
  archived: false,
});

export const deals: Deal[] = [
  deal("d1", "Loyalty app", "co1", "c1", "u2", "proposal", 18_000_000, "2026-11-15"),
  deal("d2", "E-commerce store", "co2", "c2", "u2", "negotiation", 24_000_000, "2026-10-30"),
  deal("d3", "Clinic website", "co7", "c9", "u2", "qualified", 9_500_000, "2026-11-28"),
  deal("d4", "Merch design", "co4", "c4", "u1", "lead", 3_800_000, "2026-12-12"),
  deal("d5", "Annual design retainer", "co6", "c6", "u1", "proposal", 14_400_000, "2026-11-06"),
  deal("d6", "Rebrand", "co8", "c10", "u1", "qualified", 12_000_000, "2026-12-01"),
  deal("d7", "Tour brochure", "co9", "c11", "u3", "lead", 2_600_000, "2026-11-20"),
  deal("d8", "Annual report layout", "co5", "c5", "u1", "won", 9_600_000, "2026-07-10"),
  deal("d9", "Property photo shoot", "co4", "c4", "u3", "lost", 3_000_000, "2026-08-20"),
];
