"use client";

import { Ellipsis, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type RowAction = {
  label: string;
  icon: LucideIcon;
  href?: string;
  onSelect?: () => void;
  /** Drawn after a separator, in the danger colour. */
  destructive?: boolean;
};

/** The "more" menu at the end of a table row or card. */
export function RowActions({ label, actions }: { label: string; actions: RowAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label}>
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {actions.map((action) => (
          <div key={action.label}>
            {action.destructive ? <DropdownMenuSeparator /> : null}
            {action.href ? (
              <DropdownMenuItem asChild>
                <Link href={action.href}>
                  <action.icon aria-hidden />
                  {action.label}
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                variant={action.destructive ? "destructive" : "default"}
                onSelect={action.onSelect}
              >
                <action.icon aria-hidden />
                {action.label}
              </DropdownMenuItem>
            )}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
