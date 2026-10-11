import { Suspense } from "react";

import { AccountProblemNotice } from "@/components/auth/account-problem";
import { HardRedirect } from "@/components/auth/navigate";
import { AppShell } from "@/components/shell/app-shell";
import { getNotifications } from "@/server/notifications";
import { getWorkspaceRecords } from "@/server/records";
import { getAccountProblem, getOpenInvitations, getSession, getTeam } from "@/server/session";

/**
 * Every workspace page sits behind this layout. It verifies the session on the
 * server and loads the account before anything renders; the request proxy
 * redirects signed-out visitors earlier, but this is the check that counts.
 */
async function AuthedShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  // Not `redirect()`: the browser caches a streamed redirect with the page and
  // would replay it after the user signs in or creates a workspace.
  if (!session) {
    const problem = await getAccountProblem();
    return problem ? <AccountProblemNotice problem={problem} /> : <HardRedirect to="/login" />;
  }
  if (!session.workspace) return <HardRedirect to="/onboarding" />;

  const [members, invitations, records, notifications] = await Promise.all([
    getTeam(session.workspace.id),
    getOpenInvitations(session.workspace.id, session.workspace.role),
    getWorkspaceRecords(session.workspace.id, session.workspace.role),
    getNotifications(session.workspace.id),
  ]);

  return (
    <AppShell
      account={{
        user: session.user,
        workspace: session.workspace,
        workspaces: session.workspaces,
        members,
        invitations,
      }}
      records={records}
      notifications={notifications}
    >
      {children}
    </AppShell>
  );
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    // The session is only known at request time, so the shell streams in.
    <Suspense fallback={<div className="min-h-dvh bg-canvas" aria-busy="true" />}>
      <AuthedShell>{children}</AuthedShell>
    </Suspense>
  );
}
