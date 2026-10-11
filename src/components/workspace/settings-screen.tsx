"use client";

import { Bell, Building2, Check, type LucideIcon, Palette, SlidersHorizontal, UserRound } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/page-header";
import { SegmentedControl } from "@/components/common/table-toolbar";
import { UserAvatar } from "@/components/common/user-avatar";
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
import { ACCENTS, CURRENCY_OPTIONS, DEMO_TODAY, NOTIFICATION_OPTIONS, TAX_OPTIONS } from "@/config/app";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAVED_NOTE = "Kept for this session only.";

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

function FormFooter({ dirty }: { dirty: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
      <p className="text-xs text-muted-foreground">{dirty ? "You have unsaved changes." : "No changes to save."}</p>
      <Button type="submit" disabled={!dirty} className="hover:bg-primary-hover">
        Save changes
      </Button>
    </div>
  );
}

function ProfileSection() {
  const { currentUser, updateProfile } = useDemoStore();
  const id = useId();
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [title, setTitle] = useState(currentUser.title);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = name !== currentUser.name || email !== currentUser.email || title !== currentUser.title;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = "Enter your name.";
    if (!email.trim()) found.email = "Enter your email address.";
    else if (!EMAIL_PATTERN.test(email.trim())) found.email = "Enter an email address like name@company.com.";
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    updateProfile({ name: name.trim(), email: email.trim(), title: title.trim() });
    toast.success("Profile updated", { description: SAVED_NOTE });
  }

  return (
    <SectionCard title="Profile" description="How you appear to teammates, on tasks you are assigned and in the activity log.">
      <form onSubmit={submit} noValidate>
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <div className="flex items-center gap-3 sm:col-span-2">
            <UserAvatar name={name || currentUser.name} className="size-12 [&_[data-slot=avatar-fallback]]:text-base" />
            <p className="text-caption text-muted-foreground">
              Your avatar uses your initials. Photo uploads are not part of this prototype.
            </p>
          </div>
          <Field id={`${id}-name`} label="Full name" error={errors.name}>
            <Input
              id={`${id}-name`}
              value={name}
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? `${id}-name-error` : undefined}
            />
          </Field>
          <Field id={`${id}-title`} label="Job title">
            <Input id={`${id}-title`} value={title} autoComplete="off" onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field id={`${id}-email`} label="Email" error={errors.email} hint="No confirmation email is sent in this prototype.">
            <Input
              id={`${id}-email`}
              type="email"
              value={email}
              autoComplete="off"
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? `${id}-email-error` : `${id}-email-hint`}
            />
          </Field>
        </div>
        <FormFooter dirty={dirty} />
      </form>
    </SectionCard>
  );
}

function WorkspaceSection() {
  const { workspace, settings, updateWorkspace } = useDemoStore();
  const id = useId();
  const [name, setName] = useState(workspace.name);
  const [currency, setCurrency] = useState(settings.currency);
  const [taxRateBps, setTaxRateBps] = useState(String(settings.taxRateBps));
  const [terms, setTerms] = useState(String(settings.paymentTermDays));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty =
    name !== workspace.name ||
    currency !== settings.currency ||
    taxRateBps !== String(settings.taxRateBps) ||
    terms !== String(settings.paymentTermDays);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = "Enter a workspace name.";
    if (!/^\d{1,2}$/.test(terms.trim()) || Number(terms) > 90) found.terms = "Enter a whole number of days from 0 to 90.";
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    updateWorkspace({
      name: name.trim(),
      currency,
      taxRateBps: Number(taxRateBps),
      paymentTermDays: Number(terms),
    });
    toast.success("Workspace settings saved", { description: SAVED_NOTE });
  }

  return (
    <SectionCard title="Workspace" description="The business name on your invoices and the defaults for money.">
      <form onSubmit={submit} noValidate>
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field id={`${id}-name`} label="Workspace name" error={errors.name} hint="Shown in the sidebar, on the overview and at the top of invoices.">
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
            hint="Changes how amounts are shown. Existing amounts are relabelled, not converted."
          >
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id={`${id}-currency`} className="w-full" aria-describedby={`${id}-currency-hint`}>
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
          <Field id={`${id}-tax`} label="Default tax on new invoices" hint="Demo rates only, not tax advice.">
            <Select value={taxRateBps} onValueChange={setTaxRateBps}>
              <SelectTrigger id={`${id}-tax`} className="w-full" aria-describedby={`${id}-tax-hint`}>
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
          <Field id={`${id}-terms`} label="Payment terms (days)" error={errors.terms} hint="Sets the due date on a new invoice.">
            <Input
              id={`${id}-terms`}
              inputMode="numeric"
              value={terms}
              autoComplete="off"
              className="tabular"
              onChange={(event) => setTerms(event.target.value)}
              aria-invalid={Boolean(errors.terms)}
              aria-describedby={errors.terms ? `${id}-terms-error` : `${id}-terms-hint`}
            />
          </Field>
          <div className="rounded-md bg-muted/60 px-3 py-2.5 sm:col-span-2">
            <p className="text-caption text-muted-foreground">
              Amounts currently look like <span className="tabular font-medium text-foreground">{formatMoney(1_234_550)}</span>.
            </p>
          </div>
        </div>
        <FormFooter dirty={dirty} />
      </form>
    </SectionCard>
  );
}

function PreferencesSection() {
  const { settings, updatePreferences } = useDemoStore();
  const id = useId();
  const [dateLocale, setDateLocale] = useState(settings.dateLocale);
  const [weekStartsOn, setWeekStartsOn] = useState(String(settings.weekStartsOn));
  const dirty = dateLocale !== settings.dateLocale || weekStartsOn !== String(settings.weekStartsOn);
  const sample = (locale: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${DEMO_TODAY}T00:00:00Z`),
    );

  return (
    <SectionCard title="Preferences" description="How dates and the calendar are laid out across the workspace.">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          updatePreferences({ dateLocale, weekStartsOn: weekStartsOn === "1" ? 1 : 0 });
          toast.success("Preferences saved", { description: SAVED_NOTE });
        }}
      >
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <Field id={`${id}-date`} label="Date format">
            <Select value={dateLocale} onValueChange={(value) => setDateLocale(value as typeof dateLocale)}>
              <SelectTrigger id={`${id}-date`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en-GB">Day first: {sample("en-GB")}</SelectItem>
                <SelectItem value="en-US">Month first: {sample("en-US")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id={`${id}-week`} label="Week starts on" hint="Used by the calendar’s month view.">
            <Select value={weekStartsOn} onValueChange={setWeekStartsOn}>
              <SelectTrigger id={`${id}-week`} className="w-full" aria-describedby={`${id}-week-hint`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sunday</SelectItem>
                <SelectItem value="1">Monday</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <FormFooter dirty={dirty} />
      </form>
    </SectionCard>
  );
}

function NotificationsSection() {
  const { notificationPrefs, setNotificationPref } = useDemoStore();
  const id = useId();
  return (
    <SectionCard
      title="Notifications"
      description="Choose what you want to hear about. Switches save as you change them. Nothing is sent in this prototype."
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
              checked={notificationPrefs[option.id]}
              aria-describedby={`${id}-${option.id}-note`}
              onCheckedChange={(checked) => {
                setNotificationPref(option.id, checked);
                toast.success(`${option.label}: ${checked ? "on" : "off"}`, { description: SAVED_NOTE });
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
    <SectionCard title="Appearance" description="Changes apply straight away, for this session. The prototype has a light theme only.">
      <div className="space-y-6 px-5 py-5">
        <fieldset>
          <legend className="font-medium">Accent colour</legend>
          <p className="text-caption text-muted-foreground">Used for primary buttons, links and selected states.</p>
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
          <p className="mb-3 text-caption text-muted-foreground">Compact tightens page spacing and table rows.</p>
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
        description="Your profile, workspace defaults and how the app looks. Everything here is kept for this session only."
      />
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
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
                  <item.icon className={cn("size-4", section === item.id ? "text-primary" : "text-muted-foreground")} aria-hidden />
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
