"use client";

import { Building2, FolderKanban, Handshake, ListChecks, ReceiptText, Search, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { NAV_ITEMS } from "@/config/navigation";
import { formatMoney } from "@/lib/format";

/** Topbar trigger: a search field look on wide screens, an icon button on small ones. */
export function SearchTrigger() {
  const { setSearchOpen } = useDemoStore();
  return (
    <>
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="hidden h-8 w-56 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-muted-foreground outline-none hover:border-foreground/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:flex xl:w-72"
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 text-left">Search</span>
        <kbd className="rounded-sm border bg-muted px-1 font-sans text-xs" aria-hidden>
          ⌘K
        </kbd>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Search"
        onClick={() => setSearchOpen(true)}
      >
        <Search aria-hidden />
      </Button>
    </>
  );
}

/** Command palette over pages and the current demo records. Opens with ⌘K / Ctrl+K. */
export function GlobalSearch() {
  const router = useRouter();
  const store = useDemoStore();
  const { searchOpen, setSearchOpen, projects, tasks, invoices, companyName } = store;
  const contacts = store.contacts.filter((contact) => !contact.archived);
  const companies = store.companies.filter((company) => !company.archived);
  const deals = store.deals.filter((deal) => !deal.archived);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setSearchOpen]);

  function go(href: string) {
    setSearchOpen(false);
    router.push(href);
  }

  const contactName = store.contactCompanyName;

  return (
    <CommandDialog
      open={searchOpen}
      onOpenChange={setSearchOpen}
      title="Search"
      description="Search pages, contacts, companies, deals, projects, tasks and invoices"
    >
      <Command>
        <CommandInput placeholder="Search pages and records" />
        <CommandList>
          <CommandEmpty>No pages or records match that search.</CommandEmpty>
          <CommandGroup heading="Pages">
            {NAV_ITEMS.map((item) => (
              <CommandItem
                key={item.href}
                value={`page ${item.title}`}
                onSelect={() => go(item.href)}
              >
                <item.icon aria-hidden />
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
          {contacts.length > 0 ? (
          <CommandGroup heading="Contacts">
            {contacts.map((contact) => (
              <CommandItem
                key={contact.id}
                value={`contact ${contact.name} ${companyName(contact.companyId)} ${contact.id}`}
                onSelect={() => go(`/crm/contacts/${contact.id}`)}
              >
                <UserRound aria-hidden />
                <span className="truncate">{contact.name}</span>
                <span className="ml-auto truncate text-xs text-muted-foreground">
                  {companyName(contact.companyId)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {companies.length > 0 ? (
          <CommandGroup heading="Companies">
            {companies.map((company) => (
              <CommandItem
                key={company.id}
                value={`company ${company.name} ${company.id}`}
                onSelect={() => go(`/crm/companies/${company.id}`)}
              >
                <Building2 aria-hidden />
                <span className="truncate">{company.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {deals.length > 0 ? (
          <CommandGroup heading="Deals">
            {deals.map((deal) => (
              <CommandItem
                key={deal.id}
                value={`deal ${deal.name} ${companyName(deal.companyId)} ${deal.id}`}
                onSelect={() => go("/crm/deals")}
              >
                <Handshake aria-hidden />
                <span className="truncate">{deal.name}</span>
                <span className="truncate text-muted-foreground">{companyName(deal.companyId)}</span>
                <span className="tabular ml-auto text-xs text-muted-foreground">
                  {formatMoney(deal.valueMinor)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {projects.length > 0 ? (
            <CommandGroup heading="Projects">
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={`project ${project.name} ${project.id}`}
                  onSelect={() => go(`/work/projects/${project.id}`)}
                >
                  <FolderKanban aria-hidden />
                  <span className="truncate">{project.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {tasks.length > 0 ? (
            <CommandGroup heading="Tasks">
              {tasks.map((task) => (
                <CommandItem
                  key={task.id}
                  value={`task ${task.title} ${task.id}`}
                  onSelect={() => go("/work/tasks")}
                >
                  <ListChecks aria-hidden />
                  <span className="truncate">{task.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {invoices.length > 0 ? (
            <CommandGroup heading="Invoices">
              {invoices.map((invoice) => (
                <CommandItem
                  key={invoice.id}
                  value={`invoice ${invoice.number} ${contactName(invoice.contactId)} ${invoice.description}`}
                  onSelect={() => go(`/money/invoices/${invoice.id}`)}
                >
                  <ReceiptText aria-hidden />
                  <span className="tabular">{invoice.number}</span>
                  <span className="truncate text-muted-foreground">
                    {contactName(invoice.contactId)}
                  </span>
                  <span className="tabular ml-auto text-xs text-muted-foreground">
                    {formatMoney(invoice.amountMinor)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
