"use client";

import {
  AtSign,
  Bell,
  CalendarClock,
  CircleAlert,
  type LucideIcon,
  MessageSquare,
  Settings,
  UserPlus,
  Wallet,
  Inbox,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NotificationKind } from "@/mocks/types";
import {
  loadNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/actions/notifications";

/** How often an open tab checks for new notifications. */
const CHECK_EVERY_MS = 60_000;

const KIND_ICON: Record<NotificationKind, { icon: LucideIcon; tone: string }> = {
  task_assigned: { icon: UserPlus, tone: "bg-primary/10 text-primary" },
  task_mentioned: { icon: AtSign, tone: "bg-primary/10 text-primary" },
  task_comment: { icon: MessageSquare, tone: "bg-muted text-muted-foreground" },
  task_due: { icon: CalendarClock, tone: "bg-warning-soft text-warning" },
  invoice_paid: { icon: Wallet, tone: "bg-success-soft text-success" },
  invoice_overdue: { icon: CircleAlert, tone: "bg-danger-soft text-danger" },
  lead_new: { icon: Inbox, tone: "bg-primary/10 text-primary" },
};

export function NotificationsMenu() {
  const router = useRouter();
  const {
    notifications,
    unreadNotifications: unread,
    receiveNotifications,
    markNotificationRead,
    markAllNotificationsRead,
  } = useDemoStore();
  const [open, setOpen] = useState(false);

  const check = useCallback(async () => {
    const feed = await loadNotificationsAction().catch(() => null);
    if (feed) receiveNotifications(feed);
  }, [receiveNotifications]);

  // New notifications show up without a reload: checked every minute while
  // the tab is visible, and as soon as it becomes visible again.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  async function markAll() {
    markAllNotificationsRead();
    const result = await markAllNotificationsReadAction();
    if (!result.ok) toast.error(result.error);
    await check();
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void check();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell aria-hidden />
          {unread > 0 ? (
            <span
              aria-hidden
              className="tabular absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-none font-semibold text-white"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <p className="font-semibold">
            Notifications
            {unread > 0 ? (
              <span className="tabular ml-1.5 font-normal text-muted-foreground">
                {unread} unread
              </span>
            ) : null}
          </p>
          <Button variant="ghost" size="xs" disabled={unread === 0} onClick={() => void markAll()}>
            Mark all read
          </Button>
        </div>
        <DropdownMenuSeparator className="my-0" />
        {notifications.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="font-medium">You’re all caught up</p>
            <p className="mt-1 text-caption text-muted-foreground">
              Assignments, mentions, comments, due tasks, payments and new leads show up here.
            </p>
          </div>
        ) : (
          <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-1">
            {notifications.map((notification) => {
              const { icon: Icon, tone } = KIND_ICON[notification.kind] ?? KIND_ICON.task_comment;
              return (
                <DropdownMenuItem
                  key={notification.id}
                  className="items-start gap-2.5 py-2"
                  onSelect={() => {
                    if (!notification.read) {
                      markNotificationRead(notification.id);
                      void markNotificationReadAction(notification.id).then(check);
                    }
                    router.push(notification.href);
                  }}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                      tone,
                    )}
                    aria-hidden
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "line-clamp-2 block",
                        notification.read ? "text-foreground/80" : "font-medium",
                      )}
                    >
                      {notification.title}
                      {notification.read ? null : <span className="sr-only"> (unread)</span>}
                    </span>
                    {notification.body ? (
                      <span className="block truncate text-caption text-muted-foreground">
                        {notification.body}
                      </span>
                    ) : null}
                    <span className="block text-caption text-muted-foreground">
                      {formatRelativeTime(notification.at)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "mt-2 size-2 shrink-0 rounded-full",
                      notification.read ? "bg-transparent" : "bg-primary",
                    )}
                    aria-hidden
                  />
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
        <DropdownMenuSeparator className="my-0" />
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <p className="text-caption text-muted-foreground">Shown in the app only, not emailed.</p>
          <Button variant="ghost" size="xs" asChild>
            <Link href="/settings?section=notifications" onClick={() => setOpen(false)}>
              <Settings data-icon="inline-start" aria-hidden />
              Settings
            </Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
