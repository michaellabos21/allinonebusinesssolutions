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
];

const SIMULATED = [
  "Contacts, companies, deals, projects, tasks, invoices, expenses and the catalog are sample data.",
  "Anything you add, edit or archive in those areas stays until you reload.",
  "Marking an invoice as sent or paid only changes its status. Nothing is emailed and no money moves.",
  "Invitation links are shown for you to send; the app does not email them yet.",
];

export function HelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Help: what is real and what is sample data">
          <CircleHelp aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>About {PRODUCT_NAME}</DialogTitle>
          <DialogDescription>{PROTOTYPE_NOTICE}</DialogDescription>
        </DialogHeader>
        <div>
          <h3 className="font-semibold">What is real</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {REAL.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold">What is still sample data</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {SIMULATED.map((line) => (
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
