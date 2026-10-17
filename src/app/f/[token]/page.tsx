import type { Metadata } from "next";
import { Suspense } from "react";

import { PublicLeadForm } from "@/components/public/public-lead-form";
import { cn } from "@/lib/utils";
import { getPublicLeadForm } from "@/server/public-forms";

export const metadata: Metadata = {
  title: "Get in touch",
  // A form's link is shared on purpose; it shouldn't be found by searching.
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ token: string }>;
  /** embed=1 when shown inside a website; page and ref describe that website's page. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? null;

async function FormPage({ params, searchParams }: Props) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const embedded = first(query.embed) === "1";
  const form = await getPublicLeadForm(token);
  return (
    <main
      className={cn(
        "w-full",
        embedded ? "p-1" : "max-w-md rounded-lg border bg-card px-5 py-6 sm:px-6",
      )}
    >
      {form ? (
        <PublicLeadForm
          token={token}
          form={form}
          embedded={embedded}
          hostPage={embedded ? first(query.page) : null}
          hostReferrer={embedded ? first(query.ref) : null}
        />
      ) : (
        <div className="space-y-2">
          <h1 className="font-display text-xl font-semibold">This form isn’t available</h1>
          <p className="text-muted-foreground">
            The link may be incomplete, or the business has switched the form off.
          </p>
        </div>
      )}
    </main>
  );
}

/** A business's public enquiry form. Nobody needs to be signed in. */
export default function Page(props: Props) {
  return (
    <Suspense fallback={<p className="p-6 text-muted-foreground">Loading</p>}>
      <FormFrame {...props} />
    </Suspense>
  );
}

async function FormFrame(props: Props) {
  const embedded = first((await props.searchParams).embed) === "1";
  // Inside another website the form sits on that site's own background.
  return embedded ? (
    <>
      {/* The host page's own background shows through the frame. */}
      <style>{"html, body { background: transparent !important; }"}</style>
      <FormPage {...props} />
    </>
  ) : (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
      <FormPage {...props} />
    </div>
  );
}
