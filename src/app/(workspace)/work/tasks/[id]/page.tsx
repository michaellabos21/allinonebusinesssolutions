import type { Metadata } from "next";

import { TaskPage } from "@/components/work/task-page";
import { getTaskDetail } from "@/server/task-detail";

export const metadata: Metadata = { title: "Task" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getTaskDetail(id);
  return <TaskPage taskId={id} detail={detail} />;
}
