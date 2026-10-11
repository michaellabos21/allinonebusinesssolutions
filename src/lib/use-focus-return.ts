import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Returns keyboard focus to whatever opened a dialog, sheet or confirm.
 *
 * These overlays are opened from state rather than from a Radix trigger, so
 * Radix has nothing to return focus to and it would land on the page body.
 * Pass the result to the content's `onCloseAutoFocus`.
 */
export function useFocusReturn(open: boolean) {
  const opener = useRef<HTMLElement | null>(null);

  // A layout effect runs before Radix moves focus into the overlay, so the
  // active element is still the control that opened it.
  useLayoutEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;
    // Opened from a menu item: the item is about to unmount, so use the menu's trigger.
    const menu = active.closest("[role=menu]");
    const menuTrigger = menu ? document.getElementById(menu.getAttribute("aria-labelledby") ?? "") : null;
    opener.current = menuTrigger ?? active;
  }, [open]);

  return useCallback((event: Event) => {
    const target = opener.current;
    if (target?.isConnected) {
      event.preventDefault();
      target.focus();
    }
  }, []);
}
