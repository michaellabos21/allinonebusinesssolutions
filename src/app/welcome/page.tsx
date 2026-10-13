import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";
import { MARKETING_NAME, PRODUCT_DESCRIPTION, PRODUCT_TAGLINE } from "@/config/app";

const title = `${MARKETING_NAME}: ${PRODUCT_TAGLINE}`;

export const metadata: Metadata = {
  title: { absolute: title },
  description: PRODUCT_DESCRIPTION,
  // Served at `/` by the request proxy, so that is its one official address.
  // Open Graph and Twitter tags come from the root layout, filled in with
  // this title and description.
  alternates: { canonical: "/" },
};

/** Visitors who aren't signed in see this at `/`; the request proxy serves it there. */
export default function Page() {
  return <LandingPage />;
}
