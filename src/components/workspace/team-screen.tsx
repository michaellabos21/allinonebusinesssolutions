"use client";

import { Check, Copy, MailPlus, ShieldCheck, UserMinus, X } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageHeader } from "@/components/common/page-header";
import { Panel } from "@/components/common/panel";
import { RowActions } from "@/components/common/row-actions";
import { EmptyState } from "@/components/common/states";
import { Pill } from "@/components/common/status-badge";
import { UserAvatar } from "@/components/common/user-avatar";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { useFocusReturn } from "@/lib/use-focus-return";
import {
  inviteMemberAction,
  removeMemberAction,
  revokeInvitationAction,
  setMemberRoleAction,
} from "@/server/actions/team";
import {
  type AssignableRole,
  ROLES,
  ROLE_LABEL,
  type Role,
  assignableRolesFor,
  can,
  canManageMember,
} from "@/server/permissions";
import type { InvitationRow, TeamMemberRow } from "@/server/types";

const ROLE_TONE: Record<Role, "primary" | "success" | "neutral"> = {
  owner: "primary",
  admin: "success",
  manager: "neutral",
  member: "neutral",
  client: "neutral",
};

const ROLE_NOTES: Record<Role, string> = {
  owner: "Full control of the workspace. One per workspace; the role can’t be reassigned yet.",
  admin: "Changes workspace settings, invites people and manages everyone except other admins.",
  manager: "Sees the team. Will run projects and finances as those areas go live.",
  member: "Sees the team. Will work on the projects and tasks they are part of.",
  client:
    "An outside contact. Will see only what is shared with them, once the client portal exists.",
};

function InviteDialog({
  open,
  onOpenChange,
  roles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: AssignableRole[];
}) {
  const id = useId();
  const returnFocus = useFocusReturn(open);
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("member");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<{ link: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setEmail("");
      setRole("member");
      setErrors({});
      setCreated(null);
      setCopied(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await inviteMemberAction({ email, role });
      if (!result.ok) {
        setErrors({ form: result.fieldErrors ? "" : result.error, ...result.fieldErrors });
        document.getElementById(`${id}-email`)?.focus();
        return;
      }
      setErrors({});
      setCreated(result.data ?? null);
    });
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.link);
      setCopied(true);
      toast.success("Invitation link copied");
    } catch {
      toast.error("Couldn’t copy. Select the link and copy it by hand.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" onCloseAutoFocus={returnFocus}>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Send this link to {created.email}</DialogTitle>
              <DialogDescription>
                No email was sent: email delivery isn’t set up yet. Copy the link and pass it on
                yourself. It works for 7 days, once, and only for that address.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5 py-2">
              <Label htmlFor={`${id}-link`}>Invitation link</Label>
              <Input
                id={`${id}-link`}
                readOnly
                value={created.link}
                onFocus={(event) => event.target.select()}
                aria-describedby={`${id}-link-note`}
              />
              <p id={`${id}-link-note`} className="text-xs text-muted-foreground">
                This is the only time the link is shown. If it’s lost, cancel the invitation and
                create a new one.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Done
              </Button>
              <Button type="button" className="hover:bg-primary-hover" onClick={copy}>
                {copied ? (
                  <Check data-icon="inline-start" aria-hidden />
                ) : (
                  <Copy data-icon="inline-start" aria-hidden />
                )}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <DialogHeader>
              <DialogTitle>Invite a team member</DialogTitle>
              <DialogDescription>
                Creates a personal link for this person to join the workspace.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-5">
              {errors.form ? (
                <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-danger">
                  {errors.form}
                </p>
              ) : null}
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-email`}>Work email</Label>
                <Input
                  id={`${id}-email`}
                  type="email"
                  autoComplete="off"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (errors.email) setErrors((current) => ({ ...current, email: "" }));
                  }}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? `${id}-email-error` : undefined}
                />
                {errors.email ? (
                  <p id={`${id}-email-error`} className="text-caption text-danger">
                    {errors.email}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-role`}>Role</Label>
                <Select value={role} onValueChange={(value) => setRole(value as AssignableRole)}>
                  <SelectTrigger
                    id={`${id}-role`}
                    className="w-full"
                    aria-describedby={`${id}-role-note`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((option) => (
                      <SelectItem key={option} value={option}>
                        {ROLE_LABEL[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p id={`${id}-role-note`} className="text-xs text-muted-foreground">
                  {errors.role || ROLE_NOTES[role]}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending} className="hover:bg-primary-hover">
                {pending ? "Creating link" : "Create invitation link"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function TeamScreen() {
  const { account } = useDemoStore();
  const { members, invitations, user, workspace } = account;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMemberRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<InvitationRow | null>(null);
  const [, startTransition] = useTransition();

  const canInvite = can(workspace.role, "members.invite");
  const roles = assignableRolesFor(workspace.role);

  /** Runs a server action and reports its result. */
  function run(action: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message ?? "Done");
      else toast.error(result.error ?? "Something went wrong. Try again.");
    });
  }

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Team"
        description={`${members.length} ${members.length === 1 ? "member" : "members"} in ${workspace.name}${
          canInvite
            ? `, ${invitations.length} pending ${invitations.length === 1 ? "invitation" : "invitations"}.`
            : "."
        }`}
        actions={
          canInvite ? (
            <Button className="hover:bg-primary-hover" onClick={() => setInviteOpen(true)}>
              <MailPlus data-icon="inline-start" aria-hidden />
              Invite member
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <section aria-label="Members" className="overflow-hidden rounded-lg border bg-card">
            <ul className="divide-y">
              {members.map((member) => {
                const isSelf = member.userId === user.id;
                const manageable = canManageMember(workspace.role, member.role, isSelf);
                const otherRoles = roles.filter((role) => role !== member.role);
                return (
                  <li key={member.membershipId} className="flex items-center gap-3 px-5 py-3">
                    <UserAvatar
                      name={member.fullName}
                      photoPath={member.avatarPath}
                      className="size-9"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 font-medium">
                        <span className="truncate">{member.fullName}</span>
                        {isSelf ? (
                          <span className="text-caption font-normal text-muted-foreground">
                            You
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-caption text-muted-foreground">
                        {member.jobTitle ? `${member.jobTitle}, ` : ""}
                        {member.email}
                      </p>
                    </div>
                    <Pill tone={ROLE_TONE[member.role]}>{ROLE_LABEL[member.role]}</Pill>
                    {manageable ? (
                      <RowActions
                        label={`Manage ${member.fullName}`}
                        actions={[
                          ...otherRoles.map((role) => ({
                            label: `Make ${ROLE_LABEL[role].toLowerCase()}`,
                            icon: ShieldCheck,
                            onSelect: () =>
                              run(() =>
                                setMemberRoleAction({ membershipId: member.membershipId, role }),
                              ),
                          })),
                          {
                            label: "Remove from workspace",
                            icon: UserMinus,
                            destructive: true,
                            onSelect: () => setRemoveTarget(member),
                          },
                        ]}
                      />
                    ) : (
                      <span className="size-7 shrink-0" aria-hidden />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {canInvite ? (
            <Panel
              title="Pending invitations"
              description="People who have a link but haven’t joined yet. Links work for 7 days."
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
                          Invited as {ROLE_LABEL[invitation.role].toLowerCase()} on{" "}
                          {formatDate(invitation.invitedOn, "long")}
                        </p>
                      </div>
                      {invitation.expired ? (
                        <Pill tone="danger">Expired</Pill>
                      ) : (
                        <Pill tone="warning">Pending until {formatDate(invitation.expiresOn)}</Pill>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setCancelTarget(invitation)}>
                        <X data-icon="inline-start" aria-hidden />
                        Cancel
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}
        </div>

        <Panel title="Roles" description="What each role can do today." className="self-start">
          <dl className="space-y-4">
            {ROLES.map((role) => (
              <div key={role}>
                <dt>
                  <Pill tone={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Pill>
                </dt>
                <dd className="mt-1 text-muted-foreground">{ROLE_NOTES[role]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            Team and settings permissions are enforced on the server and in the database. Clients,
            work and money screens still run on sample data, so roles don’t restrict them yet.
          </p>
        </Panel>
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} roles={roles} />

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Remove ${removeTarget?.fullName ?? "this member"}?`}
        description="They lose access to this workspace straight away. Their account is not deleted, and you can invite them again later."
        confirmLabel="Remove member"
        onConfirm={() => {
          if (!removeTarget) return;
          const target = removeTarget;
          setRemoveTarget(null);
          run(() => removeMemberAction(target.membershipId));
        }}
      />

      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel this invitation?"
        description={`The link sent to ${cancelTarget?.email ?? "this person"} stops working. You can invite them again later.`}
        confirmLabel="Cancel invitation"
        cancelLabel="Keep invitation"
        onConfirm={() => {
          if (!cancelTarget) return;
          const target = cancelTarget;
          setCancelTarget(null);
          run(() => revokeInvitationAction(target.id));
        }}
      />
    </div>
  );
}
