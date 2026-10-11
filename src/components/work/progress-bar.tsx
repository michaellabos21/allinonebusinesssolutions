import { cn } from "@/lib/utils";

/** Done-over-total bar with the count beside it, so the figure is never colour-only. */
export function ProgressBar({
  done,
  total,
  className,
}: {
  done: number;
  total: number;
  className?: string;
}) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={`${done} of ${total} tasks done`}
        className="h-1.5 min-w-12 flex-1 rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="tabular shrink-0 text-caption whitespace-nowrap text-muted-foreground">
        {total === 0 ? "No tasks" : `${done} of ${total}`}
      </span>
    </div>
  );
}
