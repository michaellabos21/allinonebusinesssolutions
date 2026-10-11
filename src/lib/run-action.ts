import { toast } from "sonner";

import type { ActionResult } from "@/server/types";

/**
 * Awaits a server action from a click handler and reports failure in a toast.
 * Resolves to true on success, so the caller can show its own confirmation.
 */
export async function runAction<T>(action: Promise<ActionResult<T>>): Promise<boolean> {
  try {
    const result = await action;
    if (!result.ok) toast.error(result.error);
    return result.ok;
  } catch {
    toast.error("We couldn’t reach the server. Check your connection and try again.");
    return false;
  }
}
