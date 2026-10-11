import type { Metadata } from "next";
import { Suspense } from "react";

import { PublicLeadForm } from "@/components/public/public-lead-form";
import { getPublicLeadForm } from "@/server/public-forms";

export const metadata: Metadata = {
  title: "Get in touch",
  // A form's link is shared on purpose; it shouldn't be found by searching.
  robots: { index: false, follow: false },
};

async function FormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const form = await getPublicLeadForm(token);
  if (!form) {
    return (
      <div className="space-y-2">
        <h1 className="font-display text-xl font-semibold">This form isn’t available</h1>
        <p className="text-muted-foreground">
          The link may be incomplete, or the business has switched the form off.
        </p>
      </div>
    );
  }
  return <PublicLeadForm token={token} form={form} />;
}

/** A business's public enquiry form. Nobody needs to be signed in. */
export default function Page({ params }: { params: Promise<{ token: string }> }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
      <main className="w-full max-w-md rounded-lg border bg-card px-5 py-6 sm:px-6">
        <Suspense fallback={<p className="text-muted-foreground">Loading</p>}>
          <FormPage params={params} />
        </Suspense>
      </main>
    </div>
  );
}
