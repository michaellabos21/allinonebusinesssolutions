import type { Metadata } from "next";

import { TeamScreen } from "@/components/workspace/team-screen";

export const metadata: Metadata = { title: "Team" };

export default function Page() {
  return <TeamScreen />;
}
