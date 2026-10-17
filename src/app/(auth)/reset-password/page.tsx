import type { Metadata } from "next";
import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "New password", robots: { index: false } };

export default function Page() {
  // The form reads the URL's query string, which is only known at request time.
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
