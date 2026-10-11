import { ArrowLeft, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Panel } from "@/components/common/panel";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-6 items-center gap-1.5 text-caption font-medium text-muted-foreground hover:text-foreground print:hidden"
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      {label}
    </Link>
  );
}

/** Shown when a detail URL points at a record this session doesn't hold, e.g. after a reload. */
export function MissingRecord({
  icon,
  noun,
  listHref,
  listLabel,
}: {
  icon: LucideIcon;
  noun: string;
  listHref: string;
  listLabel: string;
}) {
  return (
    <div className="page-container">
      <EmptyState
        icon={icon}
        title={`This ${noun} isn’t available`}
        description={`It may have been added in an earlier session, which the prototype doesn’t keep, or demo data may be switched off.`}
        action={
          <Button asChild variant="outline">
            <Link href={listHref}>{listLabel}</Link>
          </Button>
        }
        className="py-20"
      />
    </div>
  );
}

export type RelatedRow = {
  id: string;
  primary: string;
  secondary?: string;
  meta?: React.ReactNode;
  href?: string;
};

/** Compact list of records linked to the one being viewed. */
export function RelatedList({
  title,
  rows,
  empty,
  action,
}: {
  title: string;
  rows: RelatedRow[];
  empty: string;
  action?: React.ReactNode;
}) {
  return (
    <Panel
      title={title}
      description={rows.length === 0 ? empty : undefined}
      action={action}
      bodyClassName="px-2 pb-2 pt-1"
    >
      {rows.length > 0 ? (
        <ul>
          {rows.map((row) => {
            const body = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{row.primary}</span>
                  {row.secondary ? (
                    <span className="block truncate text-caption text-muted-foreground">
                      {row.secondary}
                    </span>
                  ) : null}
                </span>
                {row.meta ? <span className="tabular shrink-0 text-right">{row.meta}</span> : null}
              </>
            );
            const className = "flex items-center gap-3 rounded-md px-3 py-2";
            return (
              <li key={row.id}>
                {row.href ? (
                  <Link href={row.href} className={`${className} hover:bg-muted/50`}>
                    {body}
                  </Link>
                ) : (
                  <div className={className}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </Panel>
  );
}
