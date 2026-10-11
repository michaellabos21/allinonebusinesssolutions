import type { Metadata } from "next";

import { ContactDetail } from "@/components/crm/contact-detail";

export const metadata: Metadata = { title: "Contact" };

export default function Page() {
  return <ContactDetail />;
}
