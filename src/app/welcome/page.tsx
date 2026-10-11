import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";
import { MARKETING_NAME, PRODUCT_TAGLINE } from "@/config/app";

export const metadata: Metadata = {
  title: { absolute: `${MARKETING_NAME}: ${PRODUCT_TAGLINE}` },
  description:
    "Contacts, sales pipeline, projects, tasks, invoices and payments in one workspace your whole team shares.",
};

/** Visitors who aren't signed in see this at `/`; the request proxy serves it there. */
export default function Page() {
  return <LandingPage />;
}
