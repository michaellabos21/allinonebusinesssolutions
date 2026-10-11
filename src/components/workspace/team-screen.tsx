"use client";

import { MailPlus, Send, ShieldCheck, UserRound, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageHeader } from "@/components/common/page-header";
import { Panel } from "@/components/common/panel";
import { RecordForm } from "@/components/common/record-form";
import { RowActions } from "@/components/common/row-actions";
import { EmptyState } from "@/components/common/states";
import { Pill } from "@/components/common/status-badge";
import { UserAvatar } from "@/components/common/user-avatar";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { useFocusReturn } from "@/lib/use-focus-return";
import type { Invitation, TeamRole } from "@/mocks";

const ROLE_TONE: Record<TeamRole, "primary" | "success" | "neutral"> = {
  Owner: "primary",
  Admin: "success",
  Member: "neutral",
};

const ROLE_NOTES: { role: TeamRole; note: string }[] = [
  {
    role: "Owner",
    note: "Full access, including billing and deleting the workspace. One per workspace.",
  },
  { role: "Admin", note: "Manages members, settings, invoices and every project." },
  { role: "Member", note: "Works on the projects and tasks they are part of." },
];

export function TeamScreen() {
  const { team, invitations, tasks, currentUser, inviteMember, cancelInvitation, setMemberRole } =
    useDemoStore();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Invitation | null>(null);
  const returnFocus = useFocusReturn(inviteOpen);

  const openTasks = (memberId: string) =>
    tasks.filter((task) => task.assigneeId === memberId && task.status !== "done").length;

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Team"
        description={`${team.length} ${team.length === 1 ? "member" : "members"} and ${invitations.length} pending ${invitations.length === 1 ? "invitation" : "invitations"}.`}
        actions={
          <Button className="hover:bg-primary-hover" onClick={() => setInviteOpen(true)}>
            <MailPlus data-icon="inline-start" aria-hidden />
            Invite member
          </Button>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <section aria-label="Members" className="overflow-hidden rounded-lg border bg-card">
            <ul className="divide-y">
              {team.map((member) => {
                const count = openTasks(member.id);
                return (
                  <li key={member.id} className="flex items-center gap-3 px-5 py-3">
                    <UserAvatar name={member.name} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 font-medium">
                        <span className="truncate">{member.name}</span>
                        {member.id === currentUser.id ? (
                          <span className="text-caption font-normal text-muted-foreground">
                            You
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-caption text-muted-foreground">
                        {member.title ? `${member.title}, ` : ""}
                        {member.email}
                      </p>
                    </div>
                    <span className="tabular hidden shrink-0 text-caption text-muted-foreground sm:block">
                      {count} open {count === 1 ? "task" : "tasks"}
                    </span>
                    <Pill tone={ROLE_TONE[member.role]}>{member.role}</Pill>
                    {member.role === "Owner" ? (
                      <span className="size-7 shrink-0" aria-hidden />
                    ) : (
                      <RowActions
                        label={`Change role for ${member.name}`}
                        actions={[
                          member.role === "Member"
                            ? {
                                label: "Make admin",
                                icon: ShieldCheck,
                                onSelect: () => {
                                  setMemberRole(member.id, "Admin");
                                  toast.success(`${member.name} is now an admin`, {
                                    description: "Kept for this session only.",
                                  });
                                },
                              }
                            : {
                                label: "Make member",
                                icon: UserRound,
                                onSelect: () => {
                                  setMemberRole(member.id, "Member");
                                  toast.success(`${member.name} is now a member`, {
                                    description: "Kept for this session only.",
                                  });
                                },
                              },
                        ]}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <Panel
            title="Pending invitations"
            description="Invitations are simulated. No email is sent and nobody can accept one."
            bodyClassName="px-2 pb-2"
          >
            {invitations.length === 0 ? (
              <EmptyState
                icon={MailPlus}
                title="No pending invitations"
                description="Invite a teammate and they will be listed here until they join."
                action={
                  <Button variant="outline" onClick={() => setInviteOpen(true)}>
                    Invite member
                  </Button>
                }
              />
            ) : (
              <ul>
                {invitations.map((invitation) => (
                  <li
                    key={invitation.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{invitation.email}</p>
                      <p className="text-caption text-muted-foreground">
                        Invited as {invitation.role.toLowerCase()} on{" "}
                        {formatDate(invitation.invitedOn, "long")}
                      </p>
                    </div>
                    <Pill tone="warning">Pending</Pill>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          toast.info(`Reminder for ${invitation.email} noted`, {
                            description: "Simulated. No email was sent.",
                          })
                        }
                      >
                        <Send data-icon="inline-start" aria-hidden />
                        Resend
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setCancelTarget(invitation)}>
                        <X data-icon="inline-start" aria-hidden />
                        Cancel
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title="Roles" description="What each role can do." className="self-start">
          <dl className="space-y-4">
            {ROLE_NOTES.map(({ role, note }) => (
              <div key={role}>
                <dt>
                  <Pill tone={ROLE_TONE[role]}>{role}</Pill>
                </dt>
                <dd className="mt-1 text-muted-foreground">{note}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            Roles are labels in this prototype. Permissions are not enforced yet.
          </p>
        </Panel>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md" onCloseAutoFocus={returnFocus}>
          {inviteOpen ? (
            <RecordForm
              spec={{
                title: "Invite a team member",
                description: "Adds a pending invitation to the list. Simulated: no email is sent.",
                submitLabel: "Add invitation",
                fields: [
                  {
                    name: "email",
                    label: "Work email",
                    type: "email",
                    required: true,
                    missing: "Enter the person’s email address.",
                    placeholder: "name@company.com",
                  },
                  {
                    name: "role",
                    label: "Role",
                    type: "select",
                    required: true,
                    options: [
                      { value: "Member", label: "Member" },
                      { value: "Admin", label: "Admin" },
                    ],
                  },
                ],
                initial: { email: "", role: "Member" },
                check: (values) => {
                  const email = values.email.trim().toLowerCase();
                  if (team.some((member) => member.email.toLowerCase() === email)) {
                    return { email: "This person is already on the team." };
                  }
                  if (invitations.some((invitation) => invitation.email.toLowerCase() === email)) {
                    return { email: "This person already has a pending invitation." };
                  }
                  return {};
                },
                submit: (values) => {
                  const invitation = inviteMember({
                    email: values.email.trim().toLowerCase(),
                    role: values.role as Invitation["role"],
                  });
                  return { message: `Invitation for ${invitation.email} added` };
                },
              }}
              onCancel={() => setInviteOpen(false)}
              onSaved={(result) => {
                toast.success(result.message, { description: "Simulated. No email was sent." });
                setInviteOpen(false);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel this invitation?"
        description={`${cancelTarget?.email ?? "This person"} will be removed from the pending list. You can invite them again later.`}
        confirmLabel="Cancel invitation"
        cancelLabel="Keep invitation"
        onConfirm={() => {
          if (!cancelTarget) return;
          cancelInvitation(cancelTarget.id);
          toast.success(`Invitation for ${cancelTarget.email} cancelled`);
          setCancelTarget(null);
        }}
      />
    </div>
  );
}
