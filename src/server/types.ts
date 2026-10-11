import type { Role } from "@/server/permissions";

/** Shapes passed from the server to the client. Plain data only. */

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string;
  timezone: string;
  dateFormat: "dmy" | "mdy";
  weekStartsOn: 0 | 1;
  notifications: {
    invoiceOverdue: boolean;
    paymentReceived: boolean;
    taskDue: boolean;
    mentions: boolean;
    weeklySummary: boolean;
  };
};

export type SessionWorkspace = {
  id: string;
  name: string;
  timezone: string;
  country: string;
  currency: string;
  taxRateBps: number;
  paymentTermDays: number;
  /** The signed-in user's role in this workspace. */
  role: Role;
};

export type TeamMemberRow = {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  jobTitle: string;
  role: Role;
};

export type InvitationRow = {
  id: string;
  email: string;
  role: Role;
  invitedOn: string;
  expiresOn: string;
  expired: boolean;
};

export type Session = {
  user: SessionUser;
  workspaces: SessionWorkspace[];
  /** The active workspace; null when the user belongs to none yet. */
  workspace: SessionWorkspace | null;
};

/** Result of an action that may end by sending the browser somewhere else. */
export type NavigateResult = ActionResult<{ redirectTo: string }>;

/** What a server action returns to the form that called it. */
export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string>;
      /** What the person typed, so the form can show it again. Never includes passwords. */
      values?: Record<string, string>;
    };
