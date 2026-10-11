"use client";

import { CircleHelp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PRODUCT_NAME, PROTOTYPE_NOTICE } from "@/config/app";

const SHORTCUTS = [
  { keys: "⌘K or Ctrl+K", action: "Open search" },
  { keys: "Tab", action: "Move between controls" },
  { keys: "Esc", action: "Close a menu or dialog" },
];

const REAL = [
  "Your account, sign-in and password reset.",
  "Workspaces, their settings, and switching between them.",
  "Team members, roles and invitations, enforced on the server and in the database.",
  "Contacts, companies, notes, the catalog, projects, tasks and the activity feed.",
  "Leads, deals, pipeline stages and public lead forms.",
  "Estimates, invoices, payments you record, expenses with receipts, and reports.",
  "Notifications in the app, under the bell: assignments, mentions, comments, tasks due, payments, overdue invoices and new leads.",
];

const NOT_YET = [
  "Nothing is emailed: invitation links, invoices and estimates are shown for you to send yourself.",
  "Payments are recorded by hand. No money moves through this app.",
  "Notifications appear in the app only; none are emailed or pushed to your phone.",
  "Tax and invoice rules differ by country. Check yours before relying on the app for compliance.",
];

export function HelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Help: what works and what doesn’t yet">
          <CircleHelp aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>About {PRODUCT_NAME}</DialogTitle>
          <DialogDescription>{PROTOTYPE_NOTICE}</DialogDescription>
        </DialogHeader>
        <div>
          <h3 className="font-semibold">What works</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {REAL.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold">What it doesn’t do yet</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {NOT_YET.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold">Keyboard</h3>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            {SHORTCUTS.map((shortcut) => (
              <div key={shortcut.keys} className="contents">
                <dt>
                  <kbd className="rounded-sm border bg-muted px-1.5 py-0.5 font-sans text-xs">
                    {shortcut.keys}
                  </kbd>
                </dt>
                <dd className="text-muted-foreground">{shortcut.action}</dd>
              </div>
            ))}
          </dl>
        </div>
      </DialogContent>
    </Dialog>
  );
}
