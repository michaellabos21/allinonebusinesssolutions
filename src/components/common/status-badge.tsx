import { cn } from "@/lib/utils";
import {
  type CompanyType,
  type ContactStatus,
  DEAL_STAGES,
  type DealStage,
  type InvoiceDisplayStatus,
  type ProjectStatus,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from "@/mocks";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

/** Small status pill. The label always carries the meaning; colour only reinforces it. */
export function Pill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-sm px-1.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const INVOICE_STATUS: Record<InvoiceDisplayStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Sent", tone: "primary" },
  paid: { label: "Paid", tone: "success" },
  overdue: { label: "Overdue", tone: "danger" },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceDisplayStatus }) {
  const { label, tone } = INVOICE_STATUS[status];
  return <Pill tone={tone}>{label}</Pill>;
}

const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "primary" },
  on_hold: { label: "On hold", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const { label, tone } = PROJECT_STATUS[status];
  return <Pill tone={tone}>{label}</Pill>;
}

const CONTACT_STATUS: Record<ContactStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  lead: { label: "Lead", tone: "primary" },
  inactive: { label: "Inactive", tone: "neutral" },
};

export function ContactStatusBadge({ status, archived }: { status: ContactStatus; archived?: boolean }) {
  if (archived) return <Pill tone="warning">Archived</Pill>;
  const { label, tone } = CONTACT_STATUS[status];
  return <Pill tone={tone}>{label}</Pill>;
}

export function CompanyTypeBadge({ type, archived }: { type: CompanyType; archived?: boolean }) {
  if (archived) return <Pill tone="warning">Archived</Pill>;
  return <Pill tone={type === "client" ? "success" : "primary"}>{type === "client" ? "Client" : "Prospect"}</Pill>;
}

const STAGE_TONE: Record<DealStage, Tone> = {
  lead: "neutral",
  qualified: "neutral",
  proposal: "primary",
  negotiation: "primary",
  won: "success",
  lost: "danger",
};

export function DealStageBadge({ stage, archived }: { stage: DealStage; archived?: boolean }) {
  if (archived) return <Pill tone="warning">Archived</Pill>;
  return <Pill tone={STAGE_TONE[stage]}>{DEAL_STAGES.find((item) => item.id === stage)?.label}</Pill>;
}

const TASK_STATUS_TONE: Record<TaskStatus, Tone> = {
  todo: "neutral",
  in_progress: "primary",
  done: "success",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Pill tone={TASK_STATUS_TONE[status]}>{TASK_STATUSES.find((item) => item.id === status)?.label}</Pill>;
}

const PRIORITY: Record<TaskPriority, { label: string; tone: Tone }> = {
  low: { label: "Low", tone: "neutral" },
  medium: { label: "Medium", tone: "neutral" },
  high: { label: "High", tone: "warning" },
};

export function PriorityBadge({ priority, short }: { priority: TaskPriority; short?: boolean }) {
  const { label, tone } = PRIORITY[priority];
  return <Pill tone={tone}>{short ? label : `${label} priority`}</Pill>;
}
