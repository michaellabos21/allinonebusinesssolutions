import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/forms";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Kasama Space workspace.",
  alternates: { canonical: "/login" },
};

export default function Page() {
  // The form reads the URL's query string, which is only known at request time.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
