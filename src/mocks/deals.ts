import type { Deal, DealStage, StageKind } from "./types";

/** Same names, order and kinds as the stages every new workspace starts with. */
export const DEAL_STAGES: DealStage[] = (
  [
    ["s1", "Discovery", "open"],
    ["s2", "Qualified", "open"],
    ["s3", "Proposal", "open"],
    ["s4", "Negotiation", "open"],
    ["s5", "Won", "won"],
    ["s6", "Lost", "lost"],
  ] as const
).map(([id, name, kind], position) => ({ id, name, position, kind, archived: false }));

export const OPEN_DEAL_STAGES = DEAL_STAGES.filter((stage) => stage.kind === "open");

const kindOf = (stageId: string): StageKind =>
  DEAL_STAGES.find((stage) => stage.id === stageId)?.kind ?? "open";

const deal = (
  id: string,
  name: string,
  companyId: string,
  contactId: string,
  ownerId: string,
  stageId: string,
  valueMinor: number,
  expectedCloseOn: string,
): Deal => ({
  id,
  name,
  companyId,
  contactId,
  ownerId,
  stageId,
  stageKind: kindOf(stageId),
  valueMinor,
  currency: "PHP",
  expectedCloseOn,
  closedOn: kindOf(stageId) === "open" ? null : expectedCloseOn,
  lostReason: kindOf(stageId) === "lost" ? "Chose another supplier" : "",
  leadId: null,
  archived: false,
});

export const deals: Deal[] = [
  deal("d1", "Loyalty app", "co1", "c1", "u2", "s3", 18_000_000, "2026-11-15"),
  deal("d2", "E-commerce store", "co2", "c2", "u2", "s4", 24_000_000, "2026-10-30"),
  deal("d3", "Clinic website", "co7", "c9", "u2", "s2", 9_500_000, "2026-11-28"),
  deal("d4", "Merch design", "co4", "c4", "u1", "s1", 3_800_000, "2026-12-12"),
  deal("d5", "Annual design retainer", "co6", "c6", "u1", "s3", 14_400_000, "2026-11-06"),
  deal("d6", "Rebrand", "co8", "c10", "u1", "s2", 12_000_000, "2026-12-01"),
  deal("d7", "Tour brochure", "co9", "c11", "u3", "s1", 2_600_000, "2026-11-20"),
  deal("d8", "Annual report layout", "co5", "c5", "u1", "s5", 9_600_000, "2026-07-10"),
  deal("d9", "Property photo shoot", "co4", "c4", "u3", "s6", 3_000_000, "2026-08-20"),
];
