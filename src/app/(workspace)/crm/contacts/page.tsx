import type { Metadata } from "next";

import { ContactsScreen } from "@/components/crm/contacts-screen";

export const metadata: Metadata = { title: "Contacts" };

export default function Page() {
  return <ContactsScreen />;
}
