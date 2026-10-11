"use client";

import { useActionState, useSyncExternalStore } from "react";

import { AuthField, AuthHeading, FormMessage, SubmitButton } from "@/components/auth/form-parts";
import { useNavigateOnSuccess } from "@/components/auth/navigate";
import { Label } from "@/components/ui/label";
import { COUNTRY_OPTIONS, CURRENCY_OPTIONS } from "@/config/app";
import { createWorkspaceAction } from "@/server/actions/workspace";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const DEFAULT_TIMEZONE = "Asia/Manila";
const noSubscription = () => () => {};

/** The browser's time zone list and current zone; a fixed default while rendering on the server. */
function useTimezones() {
  const detected = useSyncExternalStore(
    noSubscription,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE,
    () => DEFAULT_TIMEZONE,
  );
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const zones =
    hydrated && "supportedValuesOf" in Intl
      ? Intl.supportedValuesOf("timeZone")
      : [DEFAULT_TIMEZONE];
  return { detected, zones: zones.includes(detected) ? zones : [detected, ...zones] };
}

/** First-run form: creates a workspace and makes the signed-in user its owner. */
export function WorkspaceForm({ firstWorkspace }: { firstWorkspace: boolean }) {
  const [state, action, pending] = useActionState(createWorkspaceAction, null);
  const leaving = useNavigateOnSuccess(state);
  const { detected, zones } = useTimezones();

  return (
    <form action={action} noValidate className="grid gap-4">
      <AuthHeading title={firstWorkspace ? "Set up your workspace" : "Create another workspace"}>
        A workspace holds one business: its clients, work, invoices and team.
      </AuthHeading>
      <FormMessage state={state} />
      <AuthField
        name="name"
        label="Business name"
        autoComplete="organization"
        placeholder="Cruz Design Studio"
        state={state}
        required
      />
      <div className="grid gap-1.5">
        <Label htmlFor="country">Country</Label>
        <select id="country" name="country" defaultValue="PH" className={selectClass}>
          {COUNTRY_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="currency">Currency</Label>
        <select
          id="currency"
          name="currency"
          defaultValue="PHP"
          className={selectClass}
          aria-describedby="currency-hint"
        >
          {CURRENCY_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
        <p id="currency-hint" className="text-xs text-muted-foreground">
          Used for invoices and reports. You can change it later in settings.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="timezone">Time zone</Label>
        {/* Keyed on the detected zone so the default updates once the browser's zone is known. */}
        <select
          id="timezone"
          name="timezone"
          key={detected}
          defaultValue={detected}
          className={selectClass}
        >
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton pending={pending || leaving} pendingLabel="Creating workspace">
        Create workspace
      </SubmitButton>
    </form>
  );
}
