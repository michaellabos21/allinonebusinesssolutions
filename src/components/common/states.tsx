import { CircleAlert, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shown where a list or screen has nothing in it yet; always offers a next step. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-4 py-8 text-center", className)}>
      <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <p className="mt-3 font-medium">{title}</p>
      {description ? (
        <p className="mt-1 max-w-[42ch] text-caption text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Says what failed and offers a retry. */
export function ErrorState({
  title = "This screen couldn’t load",
  description = "Something failed while rendering. Try again, or go back to the overview.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center px-4 py-12 text-center", className)}
    >
      <span className="flex size-9 items-center justify-center rounded-md bg-danger-soft text-danger">
        <CircleAlert className="size-4.5" aria-hidden />
      </span>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 max-w-[46ch] text-caption text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
