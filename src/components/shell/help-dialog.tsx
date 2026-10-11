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

const SIMULATED = [
  "Workspaces, notifications and the signed-in profile are sample data.",
  "Anything you add, edit or archive stays until you reload.",
  "Marking an invoice as sent or paid only changes its status. Nothing is emailed and no money moves.",
  "Invitations, role changes and notification switches change what you see here and nothing else.",
];

export function HelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Help and prototype notes">
          <CircleHelp aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>About this {PRODUCT_NAME} prototype</DialogTitle>
          <DialogDescription>{PROTOTYPE_NOTICE}</DialogDescription>
        </DialogHeader>
        <div>
          <h3 className="font-semibold">What is simulated</h3>
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
