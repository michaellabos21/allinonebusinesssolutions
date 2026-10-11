import { runAction } from "@/lib/run-action";
import {
  addNoteAction,
  setCatalogItemArchivedAction,
  setCompanyArchivedAction,
  setContactArchivedAction,
  setTaskStatusAction,
} from "@/server/actions/records";
import {
  moveDealAction,
  setDealArchivedAction,
  setLeadArchivedAction,
} from "@/server/actions/sales";
import type { TaskStatus } from "@/mocks";

/**
 * One-click record changes for use in event handlers. Each resolves to true
 * when the server accepted the change, and has already shown the error when it
 * did not, so callers only add their own success message.
 */
export const setContactArchived = (id: string, archived: boolean) =>
  runAction(setContactArchivedAction({ id, archived }));

export const setCompanyArchived = (id: string, archived: boolean) =>
  runAction(setCompanyArchivedAction({ id, archived }));

export const setCatalogItemArchived = (id: string, archived: boolean) =>
  runAction(setCatalogItemArchivedAction({ id, archived }));

export const setTaskStatus = (id: string, status: TaskStatus) =>
  runAction(setTaskStatusAction({ id, status }));

export const addNote = (contactId: string, body: string) =>
  runAction(addNoteAction({ contactId, body }));

export const moveDeal = (id: string, stageId: string, lostReason = "") =>
  runAction(moveDealAction({ id, stageId, lostReason }));

export const setDealArchived = (id: string, archived: boolean) =>
  runAction(setDealArchivedAction({ id, archived }));

export const setLeadArchived = (id: string, archived: boolean) =>
  runAction(setLeadArchivedAction({ id, archived }));
