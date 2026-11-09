import type { Task } from "./types";

/** Where an open task stands. Done is not a status: it is `done`, and the status stays as it was while a task is done. */
export const STATUSES = ["todo", "in_progress", "blocked"] as const;
export type Status = (typeof STATUSES)[number];

/** The lanes of the Tasks board: the three statuses and Done. */
export type Lane = Status | "done";
export const LANES: readonly Lane[] = ["todo", "in_progress", "blocked", "done"];

export const STATUS_LABELS: Record<Status, string> = { todo: "To do", in_progress: "In progress", blocked: "Blocked" };
export const LANE_LABELS: Record<Lane, string> = { ...STATUS_LABELS, done: "Done" };

const isStatus = (v: unknown): v is Status => typeof v === "string" && (STATUSES as readonly string[]).includes(v);

/**
 * The status a record reads as: a missing or null one, and one a newer client added that this version does not know, read as To do.
 * (An unknown value is kept as it is on the record, and not rewritten unless the person moves the task.)
 */
export const statusOf = (task: Pick<Task, "status">): Status => (isStatus(task.status) ? task.status : "todo");

/** The lane a task is in: Done when it is done, otherwise its status. */
export const laneOf = (task: Pick<Task, "status" | "done">): Lane => (task.done ? "done" : statusOf(task));

/**
 * What moving a task to a lane writes (the shared contract of `task-status.json`). Between the open lanes only `status` changes. To Done:
 * `done` and `completedAt` are set (unless it is already done) and the status is left as it was. Out of Done: `done` and `completedAt` are
 * cleared and the status becomes the lane's. A move to the lane the task is in writes nothing, so an unknown status is not rewritten by it.
 */
export function moveTo(task: Pick<Task, "status" | "done" | "completedAt">, lane: Lane, nowIso: string): Partial<Pick<Task, "status" | "done" | "completedAt">> {
  const from = laneOf(task);
  if (from === lane) return {};
  if (lane === "done") return { done: true, completedAt: task.completedAt ?? nowIso };
  if (task.done) return { done: false, completedAt: null, status: lane };
  return { status: lane };
}

/** The `.ics` properties of a task: done is COMPLETED; In progress is IN-PROCESS; Blocked is NEEDS-ACTION with `X-ORBYN-STATUS:BLOCKED`. */
export function icsStatus(task: Pick<Task, "status" | "done">): { STATUS: string; X_ORBYN_STATUS: string | null } {
  if (task.done) return { STATUS: "COMPLETED", X_ORBYN_STATUS: null };
  const status = statusOf(task);
  if (status === "in_progress") return { STATUS: "IN-PROCESS", X_ORBYN_STATUS: null };
  return { STATUS: "NEEDS-ACTION", X_ORBYN_STATUS: status === "blocked" ? "BLOCKED" : null };
}
