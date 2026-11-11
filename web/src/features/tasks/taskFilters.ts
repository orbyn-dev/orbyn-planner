import type { Priority, Task } from "../../core/planner/types";
import { statusOf } from "../../core/planner/taskStatus";
import { activeTasks, isLive, matchesDue } from "./selectors";

export type StatusKey = "open" | "done" | "blocked";
/** The Due chips of the Filters sheet: the Tasks page's own due filters, and tasks without a date. */
export type DueKey = "overdue" | "today" | "week" | "none";

/** What Tasks shows, by group. Several choices in a group are alternatives; the groups all apply (Planner Designs v70 p-narrow-tasks-filters-480). */
export interface TaskFilters {
  statuses: StatusKey[];
  lists: string[];
  priorities: Priority[];
  dues: DueKey[];
  tags: string[];
}

export const NO_FILTERS: TaskFilters = { statuses: ["open"], lists: [], priorities: [], dues: [], tags: [] };

export const STATUS_CHOICES: readonly { id: StatusKey; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "done", label: "Done" },
  { id: "blocked", label: "Blocked" },
];
export const DUE_CHOICES: readonly { id: DueKey; label: string }[] = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "week", label: "Next 7 days" },
  { id: "none", label: "No date" },
];
export const PRIORITY_CHOICES: readonly { id: Priority; label: string }[] = [
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
  { id: "none", label: "None" },
];

const isDefaultStatus = (f: TaskFilters) => f.statuses.length === 1 && f.statuses[0] === "open";

/** How many choices are on that are not the default (Open alone is the default status and is not counted). */
export function filterCount(f: TaskFilters): number {
  return f.lists.length + f.priorities.length + f.dues.length + f.tags.length + (isDefaultStatus(f) ? 0 : f.statuses.length);
}

export const toggle = <T,>(list: readonly T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

function matchesStatus(task: Task, f: TaskFilters, now: Date, showCompleted: boolean): boolean {
  if (isDefaultStatus(f)) return (showCompleted ? isLive(task) : activeTasks([task], now).length > 0);
  if (!isLive(task)) return false;
  return f.statuses.some((s) => (s === "open" ? !task.done : s === "done" ? task.done : !task.done && statusOf(task) === "blocked"));
}

/** `showCompleted` is the view option that keeps finished tasks in the list; Open alone then means every live task, as it did before the sheet. */
export function applyFilters(tasks: readonly Task[], f: TaskFilters, now: Date, showCompleted: boolean): Task[] {
  return tasks.filter(
    (t) =>
      matchesStatus(t, f, now, showCompleted) &&
      (f.dues.length === 0 || f.dues.some((d) => (d === "none" ? t.due === null : matchesDue(t, d, now)))) &&
      (f.priorities.length === 0 || f.priorities.includes(t.priority)) &&
      (f.lists.length === 0 || f.lists.includes(t.listId)) &&
      (f.tags.length === 0 || t.tags.some((id) => f.tags.includes(id))),
  );
}
