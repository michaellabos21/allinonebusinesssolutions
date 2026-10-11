import type { Metadata } from "next";

import { TasksScreen } from "@/components/work/tasks-screen";

export const metadata: Metadata = { title: "Tasks" };

export default function Page() {
  return <TasksScreen />;
}
