import type { Metadata } from "next";
import { Suspense } from "react";

import { SignupForm } from "@/components/auth/forms";
import { isGoogleSignInEnabled } from "@/server/auth-providers";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Create a Kasama Space workspace for your business: contacts, deals, projects, tasks and invoices in one place.",
  alternates: { canonical: "/signup" },
};

export default function Page() {
  // The form reads the URL's query string, which is only known at request time.
  return (
    <Suspense fallback={null}>
      <SignupFormWithProviders />
    </Suspense>
  );
}

/** Shows "Continue with Google" once Google sign-in is switched on in Supabase. */
async function SignupFormWithProviders() {
  return <SignupForm google={await isGoogleSignInEnabled()} />;
}
