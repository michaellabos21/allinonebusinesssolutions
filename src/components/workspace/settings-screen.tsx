"use client";

import {
  Bell,
  Building2,
  Check,
  type LucideIcon,
  Palette,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/page-header";
import { SegmentedControl } from "@/components/common/table-toolbar";
import { PhotoPicker } from "@/components/common/photo-picker";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ACCENTS, CURRENCY_OPTIONS, NOTIFICATION_OPTIONS, TAX_OPTIONS } from "@/config/app";
import { formatMoney } from "@/lib/format";
import { getToday } from "@/lib/runtime";
import { cn } from "@/lib/utils";
import {
  setNotificationPrefAction,
  updatePreferencesAction,
  updateProfileAction,
} from "@/server/actions/profile";
import { removeProfilePhotoAction, uploadProfilePhotoAction } from "@/server/actions/photos";
import { updateWorkspaceSettingsAction } from "@/server/actions/workspace";
import { can } from "@/server/permissions";
import type { ActionResult } from "@/server/types";

type SectionId = "profile" | "workspace" | "preferences" | "notifications" | "appearance";

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
];

/**
 * Saving a profile, workspace or preference change remounts the page so every
 * formatted value is re-read. This remembers which section was open across that.
 */
let lastSection: SectionId = "profile";

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby="settings-section-title" className="rounded-lg border bg-card">
      <div className="border-b px-5 py-4">
        <h2 id="settings-section-title" className="text-section">
          {title}
        </h2>
        <p className="mt-0.5 max-w-[65ch] text-caption text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function FormFooter({ dirty, pending }: { dirty: boolean; pending: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
      <p className="text-xs text-muted-foreground">
        {dirty ? "You have unsaved changes." : "No changes to save."}
      </p>
      <Button type="submit" disabled={!dirty || pending} className="hover:bg-primary-hover">
        {pending ? "Saving" : "Save changes"}
      </Button>
    </div>
  );
}

/** Runs a server action from a form and reports the outcome. */
function useSave() {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setErrors({});
        toast.success(result.message ?? "Saved");
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });
  return { pending, errors, setErrors, save };
}

function ProfileSection() {
  const { user } = useDemoStore().account;
  const id = useId();
  const { pending, errors, save } = useSave();
  const [fullName, setFullName] = useState(user.fullName);
  const [jobTitle, setJobTitle] = useState(user.jobTitle);
  const dirty = fullName !== user.fullName || jobTitle !== user.jobTitle;

  return (
    <SectionCard
      title="Profile"
      description="How you appear to teammates in this and every other workspace you belong to."
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save(() => updateProfileAction({ fullName, jobTitle }));
        }}
      >
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <PhotoPicker
              name={fullName || user.fullName}
              photoPath={user.avatarPath}
              onUpload={uploadProfilePhotoAction}
              onRemove={removeProfilePhotoAction}
              avatarClassName="size-14 [&_[data-slot=avatar-fallback]]:text-lg"
            />
            <p className="mt-2 text-caption text-muted-foreground">
              Shown to people in your workspaces. It’s cropped to a square and made smaller before
              upload.
            </p>
          </div>
          <Field id={`${id}-fullName`} label="Full name" error={errors.fullName}>
            <Input
              id={`${id}-fullName`}
              value={fullName}
              autoComplete="name"
              onChange={(event) => setFullName(event.target.value)}
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? `${id}-fullName-error` : undefined}
            />
          </Field>
          <Field id={`${id}-jobTitle`} label="Job title" error={errors.jobTitle}>
            <Input
              id={`${id}-jobTitle`}
              value={jobTitle}
              autoComplete="organization-title"
              onChange={(event) => setJobTitle(event.target.value)}
              aria-invalid={Boolean(errors.jobTitle)}
              aria-describedby={errors.jobTitle ? `${id}-jobTitle-error` : undefined}
            />
          </Field>
          <Field
            id={`${id}-email`}
            label="Sign-in email"
            hint="Changing your sign-in email isn’t available yet."
          >
            <Input
              id={`${id}-email`}
              value={user.email}
              readOnly
              aria-describedby={`${id}-email-hint`}
            />
          </Field>
        </div>
        <FormFooter dirty={dirty} pending={pending} />
      </form>
    </SectionCard>
  );
}

function WorkspaceSection() {
  const { workspace } = useDemoStore().account;
  const id = useId();
  const { pending, errors, save } = useSave();
  const editable = can(workspace.role, "workspace.update_settings");
  const [name, setName] = useState(workspace.name);
  const [currency, setCurrency] = useState(workspace.currency);
  const [taxRateBps, setTaxRateBps] = useState(String(workspace.taxRateBps));
  const [terms, setTerms] = useState(String(workspace.paymentTermDays));
  const [invoicePrefix, setInvoicePrefix] = useState(workspace.invoicePrefix);
  const [estimatePrefix, setEstimatePrefix] = useState(workspace.estimatePrefix);
  const dirty =
    name !== workspace.name ||
    currency !== workspace.currency ||
    taxRateBps !== String(workspace.taxRateBps) ||
    terms !== String(workspace.paymentTermDays) ||
    invoicePrefix !== workspace.invoicePrefix ||
    estimatePrefix !== workspace.estimatePrefix;

  return (
    <SectionCard
      title="Workspace"
      description="The business name on your invoices and the defaults for money."
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save(() =>
            updateWorkspaceSettingsAction({
              name,
              currency,
              taxRateBps,
              paymentTermDays: terms,
              invoicePrefix,
              estimatePrefix,
            }),
          );
        }}
      >
        <fieldset disabled={!editable} className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <legend className="sr-only">Workspace settings</legend>
          {editable ? null : (
            <p className="rounded-md bg-muted/60 px-3 py-2.5 text-muted-foreground sm:col-span-2">
              Only an owner or admin can change workspace settings. You can see them here.
            </p>
          )}
          <div className="sm:col-span-2">
            <Field
              id={`${id}-name`}
              label="Workspace name"
              error={errors.name}
              hint="Shown in the sidebar, on the overview and at the top of invoices."
            >
              <Input
                id={`${id}-name`}
                value={name}
                autoComplete="off"
                onChange={(event) => setName(event.target.value)}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? `${id}-name-error` : `${id}-name-hint`}
              />
            </Field>
          </div>
          <Field
            id={`${id}-currency`}
            label="Currency"
            error={errors.currency}
            hint="Changes how amounts are shown. Existing amounts are relabelled, not converted."
          >
            <Select value={currency} onValueChange={setCurrency} disabled={!editable}>
              <SelectTrigger
                id={`${id}-currency`}
                className="w-full"
                aria-describedby={`${id}-currency-hint`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((option) => (
                  <SelectItem key={option.code} value={option.code}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            id={`${id}-tax`}
            label="Default tax on new invoices"
            error={errors.taxRateBps}
            hint="A starting point you can change on each invoice. Check your local rules; this is not tax advice."
          >
            <Select value={taxRateBps} onValueChange={setTaxRateBps} disabled={!editable}>
              <SelectTrigger
                id={`${id}-tax`}
                className="w-full"
                aria-describedby={`${id}-tax-hint`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAX_OPTIONS.map((option) => (
                  <SelectItem key={option.bps} value={String(option.bps)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            id={`${id}-paymentTermDays`}
            label="Payment terms (days)"
            error={errors.paymentTermDays}
            hint="Sets the due date on a new invoice."
          >
            <Input
              id={`${id}-paymentTermDays`}
              inputMode="numeric"
              value={terms}
              autoComplete="off"
              className="tabular"
              onChange={(event) => setTerms(event.target.value)}
              aria-invalid={Boolean(errors.paymentTermDays)}
              aria-describedby={
                errors.paymentTermDays
                  ? `${id}-paymentTermDays-error`
                  : `${id}-paymentTermDays-hint`
              }
            />
          </Field>
          <Field
            id={`${id}-invoicePrefix`}
            label="Invoice number prefix"
            error={errors.invoicePrefix}
            hint={`Invoice numbers will look like ${invoicePrefix}0001. Changing it doesn’t renumber issued invoices.`}
          >
            <Input
              id={`${id}-invoicePrefix`}
              value={invoicePrefix}
              maxLength={12}
              autoComplete="off"
              className="tabular"
              onChange={(event) => setInvoicePrefix(event.target.value)}
              aria-invalid={Boolean(errors.invoicePrefix)}
              aria-describedby={
                errors.invoicePrefix ? `${id}-invoicePrefix-error` : `${id}-invoicePrefix-hint`
              }
            />
          </Field>
          <Field
            id={`${id}-estimatePrefix`}
            label="Estimate number prefix"
            error={errors.estimatePrefix}
            hint={`Estimate numbers will look like ${estimatePrefix}0001.`}
          >
            <Input
              id={`${id}-estimatePrefix`}
              value={estimatePrefix}
              maxLength={12}
              autoComplete="off"
              className="tabular"
              onChange={(event) => setEstimatePrefix(event.target.value)}
              aria-invalid={Boolean(errors.estimatePrefix)}
              aria-describedby={
                errors.estimatePrefix ? `${id}-estimatePrefix-error` : `${id}-estimatePrefix-hint`
              }
            />
          </Field>
          <div className="rounded-md bg-muted/60 px-3 py-2.5 sm:col-span-2">
            <p className="text-caption text-muted-foreground">
              Amounts currently look like{" "}
              <span className="tabular font-medium text-foreground">{formatMoney(1_234_550)}</span>.
            </p>
          </div>
        </fieldset>
        {editable ? <FormFooter dirty={dirty} pending={pending} /> : null}
      </form>
    </SectionCard>
  );
}

function PreferencesSection() {
  const { user } = useDemoStore().account;
  const id = useId();
  const { pending, save } = useSave();
  const [dateFormat, setDateFormat] = useState(user.dateFormat);
  const [weekStartsOn, setWeekStartsOn] = useState(String(user.weekStartsOn));
  const dirty = dateFormat !== user.dateFormat || weekStartsOn !== String(user.weekStartsOn);
  const sample = (locale: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${getToday()}T00:00:00Z`));

  return (
    <SectionCard
      title="Preferences"
      description="How dates and the calendar are laid out for you, in every workspace."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save(() => updatePreferencesAction({ dateFormat, weekStartsOn }));
        }}
      >
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <Field id={`${id}-date`} label="Date format">
            <Select
              value={dateFormat}
              onValueChange={(value) => setDateFormat(value as typeof dateFormat)}
            >
              <SelectTrigger id={`${id}-date`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dmy">Day first: {sample("en-GB")}</SelectItem>
                <SelectItem value="mdy">Month first: {sample("en-US")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id={`${id}-week`} label="Week starts on" hint="Used by the calendar’s month view.">
            <Select value={weekStartsOn} onValueChange={setWeekStartsOn}>
              <SelectTrigger
                id={`${id}-week`}
                className="w-full"
                aria-describedby={`${id}-week-hint`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sunday</SelectItem>
                <SelectItem value="1">Monday</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <FormFooter dirty={dirty} pending={pending} />
      </form>
    </SectionCard>
  );
}

function NotificationsSection() {
  const { notifications } = useDemoStore().account.user;
  const id = useId();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <SectionCard
      title="Notifications"
      description="Choose what you want to hear about. Your choices are saved, but nothing is sent yet: notifications arrive in a later phase."
    >
      <ul className="divide-y">
        {NOTIFICATION_OPTIONS.map((option) => (
          <li key={option.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div className="min-w-0">
              <label htmlFor={`${id}-${option.id}`} className="font-medium">
                {option.label}
              </label>
              <p id={`${id}-${option.id}-note`} className="text-caption text-muted-foreground">
                {option.description}
              </p>
            </div>
            <Switch
              id={`${id}-${option.id}`}
              checked={notifications[option.id]}
              disabled={pendingId === option.id}
              aria-describedby={`${id}-${option.id}-note`}
              onCheckedChange={(enabled) => {
                setPendingId(option.id);
                startTransition(async () => {
                  const result = await setNotificationPrefAction({ id: option.id, enabled });
                  setPendingId(null);
                  if (result.ok) toast.success(`${option.label}: ${enabled ? "on" : "off"}`);
                  else toast.error(result.error);
                });
              }}
            />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function AppearanceSection() {
  const { appearance, setAppearance } = useDemoStore();
  return (
    <SectionCard
      title="Appearance"
      description="Applies straight away in this browser tab and resets when you reload. Light theme only for now."
    >
      <div className="space-y-6 px-5 py-5">
        <fieldset>
          <legend className="font-medium">Accent colour</legend>
          <p className="text-caption text-muted-foreground">
            Used for primary buttons, links and selected states.
          </p>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Accent colour">
            {ACCENTS.map((accent) => {
              const selected = appearance.accent === accent.id;
              return (
                <button
                  key={accent.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setAppearance({ accent: accent.id })}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-md border px-2.5 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected && "border-foreground/40 bg-muted/60 font-medium",
                  )}
                >
                  <span
                    className="flex size-5 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: accent.primary }}
                    aria-hidden
                  >
                    {selected ? <Check className="size-3" /> : null}
                  </span>
                  {accent.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div>
          <p className="font-medium" id="density-label">
            Density
          </p>
          <p className="mb-3 text-caption text-muted-foreground">
            Compact tightens page spacing and table rows.
          </p>
          <div className="inline-flex">
            <SegmentedControl
              label="Density"
              options={[
                { value: "comfortable", label: "Comfortable" },
                { value: "compact", label: "Compact" },
              ]}
              value={appearance.density}
              onChange={(density) => setAppearance({ density })}
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

const SECTION_COMPONENTS: Record<SectionId, () => React.ReactNode> = {
  profile: ProfileSection,
  workspace: WorkspaceSection,
  preferences: PreferencesSection,
  notifications: NotificationsSection,
  appearance: AppearanceSection,
};

export function SettingsScreen() {
  const [section, setSection] = useState<SectionId>(lastSection);
  const Section = SECTION_COMPONENTS[section];

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Settings"
        description="Your profile, workspace defaults and how the app looks."
      />
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav
          aria-label="Settings sections"
          className="relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
          <ul className="flex gap-1 lg:flex-col">
            {SECTIONS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={section === item.id ? "page" : undefined}
                  onClick={() => {
                    lastSection = item.id;
                    setSection(item.id);
                  }}
                  className={cn(
                    "flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 whitespace-nowrap text-foreground/80 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                    section === item.id && "bg-muted font-medium text-foreground",
                  )}
                >
                  <item.icon
                    className={cn(
                      "size-4",
                      section === item.id ? "text-primary" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="max-w-2xl min-w-0">
          <Section key={section} />
        </div>
      </div>
    </div>
  );
}
