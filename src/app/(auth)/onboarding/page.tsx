import type { Metadata } from "next";
import { Suspense } from "react";

import { HardRedirect, SignOutButton } from "@/components/auth/navigate";
import { WorkspaceForm } from "@/components/auth/workspace-form";
import { getSession } from "@/server/session";

export const metadata: Metadata = { title: "Set up workspace" };

async function Onboarding() {
  const session = await getSession();
  if (!session) return <HardRedirect to="/login" />;

  return (
    <>
      <WorkspaceForm firstWorkspace={session.workspaces.length === 0} />
      <p className="mt-5 border-t pt-4 text-caption text-muted-foreground">
        Signed in as {session.user.email}.{" "}
        <SignOutButton className="font-medium text-primary hover:underline" />
      </p>
    </>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading</p>}>
      <Onboarding />
    </Suspense>
  );
}
