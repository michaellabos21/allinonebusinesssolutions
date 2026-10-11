import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthHeading } from "@/components/auth/form-parts";
import { AcceptInvitationForm } from "@/components/auth/forms";
import { HardRedirect, SignOutButton } from "@/components/auth/navigate";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { hashInvitationToken, looksLikeInvitationToken } from "@/server/invitations";
import { ROLE_LABEL, type Role } from "@/server/permissions";
import { getSession } from "@/server/session";

export const metadata: Metadata = { title: "Invitation" };

const PROBLEMS: Record<string, { title: string; body: string }> = {
  missing: {
    title: "This invitation link isn’t valid",
    body: "It may have been copied incompletely or cancelled. Ask the person who invited you for a new link.",
  },
  expired: {
    title: "This invitation has expired",
    body: "Ask the person who invited you to send a new one.",
  },
  revoked: {
    title: "This invitation was cancelled",
    body: "Ask the person who invited you for a new link.",
  },
  accepted: {
    title: "This invitation has already been used",
    body: "If that was you, sign in to open the workspace.",
  },
};

function Problem({ kind }: { kind: keyof typeof PROBLEMS }) {
  return (
    <>
      <AuthHeading title={PROBLEMS[kind].title}>{PROBLEMS[kind].body}</AuthHeading>
      <Button asChild variant="outline" className="h-9 w-full">
        <Link href="/login">Go to sign in</Link>
      </Button>
    </>
  );
}

async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!looksLikeInvitationToken(token)) return <Problem kind="missing" />;

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invitation_preview", {
    invite_token_hash: hashInvitationToken(token),
  });
  const invitation = (
    data as { workspace_name: string; email: string; role: Role; state: string }[] | null
  )?.[0];
  if (!invitation) return <Problem kind="missing" />;
  const session = await getSession();
  // The person who accepted it lands here straight after joining (the page
  // re-renders when the action finishes) or by reopening their link later.
  // Either way, take them into the workspace with a full page load.
  if (invitation.state === "accepted" && session?.user.email === invitation.email) {
    return <HardRedirect to="/" />;
  }
  if (invitation.state !== "pending") return <Problem kind={invitation.state} />;

  const next = encodeURIComponent(`/invite/${token}`);
  const role = ROLE_LABEL[invitation.role].toLowerCase();

  if (!session) {
    return (
      <>
        <AuthHeading title={`Join ${invitation.workspace_name}`}>
          You’ve been invited as {role === "admin" ? "an" : "a"} {role}. The invitation is for{" "}
          {invitation.email}.
        </AuthHeading>
        <div className="grid gap-2">
          <Button asChild className="h-9 w-full hover:bg-primary-hover">
            <Link href={`/signup?next=${next}&email=${encodeURIComponent(invitation.email)}`}>
              Create an account
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-9 w-full">
            <Link href={`/login?next=${next}`}>I already have an account</Link>
          </Button>
        </div>
      </>
    );
  }

  if (session.user.email !== invitation.email) {
    return (
      <>
        <AuthHeading title="This invitation is for someone else">
          It was sent to {invitation.email}, and you’re signed in as {session.user.email}. Sign out,
          then open the link again with the invited account.
        </AuthHeading>
        <SignOutButton className="h-9 w-full rounded-lg border bg-background font-medium hover:bg-muted" />
      </>
    );
  }

  return (
    <>
      <AuthHeading title={`Join ${invitation.workspace_name}`}>
        You’ve been invited as {role === "admin" ? "an" : "a"} {role}.
      </AuthHeading>
      <AcceptInvitationForm token={token} workspaceName={invitation.workspace_name} />
    </>
  );
}

export default function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Checking your invitation</p>}>
      <Invitation params={params} />
    </Suspense>
  );
}
