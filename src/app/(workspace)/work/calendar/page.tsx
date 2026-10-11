import type { Metadata } from "next";

import { CalendarScreen } from "@/components/work/calendar-screen";

export const metadata: Metadata = { title: "Calendar" };

export default function Page() {
  return <CalendarScreen />;
}
