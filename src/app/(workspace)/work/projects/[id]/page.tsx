import type { Metadata } from "next";

import { ProjectDetail } from "@/components/work/project-detail";

export const metadata: Metadata = { title: "Project" };

export default function Page() {
  return <ProjectDetail />;
}
