"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useDemoStore } from "@/components/providers/demo-store";
import { findNavEntry } from "@/config/navigation";

/**
 * Section, page and (on detail routes) record for the current URL. Groups have
 * no page of their own, so they are plain text.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const { contacts, companies, projects, invoices } = useDemoStore();
  const entry = findNavEntry(pathname);
  const pageTitle = entry?.item.title ?? "Page not found";
  const section = entry?.group.label;

  // Detail routes are `<list>/<id>` and may end in `/edit`.
  const [recordId = null, action] =
    entry && pathname !== entry.item.href ? pathname.slice(entry.item.href.length + 1).split("/") : [];
  const recordLists: Record<string, { id: string; name: string }[]> = {
    "/crm/contacts": contacts,
    "/crm/companies": companies,
    "/work/projects": projects,
    "/money/invoices": invoices.map((invoice) => ({ id: invoice.id, name: invoice.number })),
  };
  const recordName = (recordLists[entry?.item.href ?? ""] ?? []).find((item) => item.id === recordId)?.name;
  const record = !recordId
    ? null
    : recordId === "new"
      ? "New"
      : `${action === "edit" ? "Edit " : ""}${recordName ?? "Not found"}`;

  const separator = <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />;

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5">
        {section ? (
          <li className="hidden items-center gap-1.5 text-muted-foreground sm:flex">
            {section}
            {separator}
          </li>
        ) : null}
        {record && entry ? (
          <>
            <li className="hidden items-center gap-1.5 sm:flex">
              <Link href={entry.item.href} className="text-muted-foreground hover:text-foreground">
                {pageTitle}
              </Link>
              {separator}
            </li>
            <li aria-current="page" className="truncate font-medium">
              {record}
            </li>
          </>
        ) : (
          <li aria-current="page" className="truncate font-medium">
            {pageTitle}
          </li>
        )}
      </ol>
    </nav>
  );
}
