import { WORKSPACE_DEFAULTS } from "@/config/app";
import { teamMembers } from "@/mocks/team";
import type { TeamMember } from "@/mocks/types";

/**
 * Workspace settings that formatting helpers need but cannot get from React
 * context, because they are plain functions called from many places.
 *
 * The session store is the source of truth. When a setting changes it calls
 * `applyRuntime` and then remounts the page (see `settingsVersion` in the app
 * shell), so every screen re-reads these values. A real backend would replace
 * this with per-request settings, not a module-level snapshot.
 */
export type Runtime = {
  currency: string;
  /** Number formatting locale that goes with the currency. */
  locale: string;
  /** `en-GB` writes 11 Oct 2026; `en-US` writes Oct 11, 2026. */
  dateLocale: "en-GB" | "en-US";
  /** 0 is Sunday, 1 is Monday. */
  weekStartsOn: 0 | 1;
  taxRateBps: number;
  paymentTermDays: number;
  /** IANA time zone of the workspace; decides what "today" is. */
  timezone: string;
  /** Everyone whose name may need showing: real members, plus the fictional people on sample records. */
  team: TeamMember[];
};

const runtime: Runtime = {
  currency: WORKSPACE_DEFAULTS.currency,
  locale: WORKSPACE_DEFAULTS.locale,
  dateLocale: "en-GB",
  weekStartsOn: 0,
  taxRateBps: WORKSPACE_DEFAULTS.taxRateBps,
  paymentTermDays: WORKSPACE_DEFAULTS.paymentTermDays,
  timezone: "Asia/Manila",
  team: teamMembers,
};

export const getRuntime = (): Readonly<Runtime> => runtime;

export function applyRuntime(patch: Partial<Runtime>) {
  Object.assign(runtime, patch);
}

export const memberName = (id: string) =>
  runtime.team.find((member) => member.id === id)?.name ?? "Unassigned";

/** A member's profile photo path, or null when they have none. */
export const memberPhoto = (id: string) =>
  runtime.team.find((member) => member.id === id)?.photoPath ?? null;

/**
 * Today's date (`YYYY-MM-DD`) in the workspace's time zone, used for
 * "overdue", "due today", "expired" and form defaults.
 */
export function getToday(now: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: runtime.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
