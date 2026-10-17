import Link from "next/link";

import { LogoMark } from "@/components/common/logo-mark";
import { CONTACT_EMAIL, LEGAL_UPDATED_ON, PRODUCT_NAME } from "@/config/app";

/** The frame for the Privacy Policy and Terms: a readable column of headings and text. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4 sm:px-6">
          <Link
            href="/"
            aria-label={`${PRODUCT_NAME} home`}
            className="flex items-center gap-2 font-display font-semibold"
          >
            <LogoMark className="size-7" />
            {PRODUCT_NAME}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">{title}</h1>
        <p className="mt-2 text-caption text-muted-foreground">Last updated {LEGAL_UPDATED_ON}</p>
        <div className="mt-8 space-y-4 leading-relaxed [&_a]:font-medium [&_a]:text-primary [&_a]:hover:underline [&_h2]:pt-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-2">
          {children}
        </div>
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-x-4 gap-y-2 px-4 py-6 text-caption text-muted-foreground sm:px-6">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-foreground">
            {CONTACT_EMAIL}
          </a>
        </div>
      </footer>
    </div>
  );
}

/** The contact address as a link, for use inside the text. */
export function ContactLink() {
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
}
