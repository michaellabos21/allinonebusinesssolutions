"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";

import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEMO_TODAY } from "@/config/app";
import { formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotificationsMenu() {
  const router = useRouter();
  const { notifications, markNotificationRead, markAllNotificationsRead } = useDemoStore();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <DropdownMenu>
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
              className="absolute top-1 right-1 flex size-3.5 items-center justify-center rounded-full bg-danger text-[10px] leading-none font-semibold text-white"
            >
              {unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <p className="font-semibold">Notifications</p>
          <Button
            variant="ghost"
            size="xs"
            disabled={unread === 0}
            onClick={markAllNotificationsRead}
          >
            Mark all read
          </Button>
        </div>
        <DropdownMenuSeparator className="my-0" />
        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-muted-foreground">No notifications yet.</p>
        ) : (
          <div className="p-1">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="items-start gap-2.5 py-2"
                onSelect={() => {
                  markNotificationRead(notification.id);
                  router.push(notification.href);
                }}
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    notification.read ? "bg-transparent" : "bg-primary",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className={cn("block", !notification.read && "font-medium")}>
                    {notification.title}
                    {notification.read ? null : <span className="sr-only"> (unread)</span>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {notification.body}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatRelativeDay(notification.at, DEMO_TODAY)}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        <DropdownMenuSeparator className="my-0" />
        <p className="px-3 py-2 text-xs text-muted-foreground">
          Demo notifications. No emails or push alerts are sent.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
