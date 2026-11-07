import { browserStorage } from "../../lib/browserStorage";
import { compareDue } from "../../lib/dates";
import type { Priority, Task, TaskList } from "../../store/types";
import { LANES, LANE_LABELS, laneOf, type Lane } from "../../store/taskStatus";
import { groupTasks, sortByDue, type TaskGroup } from "./selectors";

/** How the Tasks list and board are arranged. Kept on this device only, as a convenience. */
export interface ViewOptions {
  /** The list: how tasks are grouped. */
  groupBy: "none" | "due" | "list" | "priority";
  /** The list: what orders the tasks inside a group. */
  sort: "due" | "priority" | "created" | "name";
  /** The list: the sort direction, reversed. */
  descending: boolean;
  /** The list: show completed tasks (those finished today stay where they were; with this off they are hidden). */
  showCompleted: boolean;
  /** The board: what orders the cards inside a lane. */
  boardSort: "due" | "priority" | "created";
  /** The board: show the Done lane. */
  showDone: boolean;
}

export const DEFAULT_VIEW_OPTIONS: ViewOptions = { groupBy: "due", sort: "due", descending: false, showCompleted: true, boardSort: "due", showDone: true };

const KEY = "orbyn-planner.tasks-view";
const pick = <T extends string>(v: unknown, all: readonly T[], fallback: T): T => (all.includes(v as T) ? (v as T) : fallback);

export function loadViewOptions(): ViewOptions {
  try {
    const raw = JSON.parse(browserStorage.get(KEY) ?? "{}") as Partial<ViewOptions>;
    const d = DEFAULT_VIEW_OPTIONS;
    return {
      groupBy: pick(raw.groupBy, ["none", "due", "list", "priority"], d.groupBy),
      sort: pick(raw.sort, ["due", "priority", "created", "name"], d.sort),
      descending: raw.descending === true,
      showCompleted: raw.showCompleted !== false,
      boardSort: pick(raw.boardSort, ["due", "priority", "created"], d.boardSort),
      showDone: raw.showDone !== false,
    };
  } catch {
    return DEFAULT_VIEW_OPTIONS;
  }
}

export function saveViewOptions(options: ViewOptions): void {
  try {
    browserStorage.set(KEY, JSON.stringify(options));
  } catch {
    // Not remembered; the choice holds for this visit.
  }
}

const RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 };

/** Orders tasks by `by`; a task without a date comes last, and `descending` reverses the whole order. */
export function sortTasks(tasks: readonly Task[], by: "due" | "priority" | "created" | "name", descending = false): Task[] {
  const compare = (a: Task, b: Task): number => {
    if (by === "due") return compareDue(a.due, b.due) || a.createdAt.localeCompare(b.createdAt);
    if (by === "priority") return RANK[a.priority] - RANK[b.priority] || compareDue(a.due, b.due) || a.createdAt.localeCompare(b.createdAt);
    if (by === "created") return a.createdAt.localeCompare(b.createdAt);
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) || a.createdAt.localeCompare(b.createdAt);
  };
  const sorted = [...tasks].sort(compare);
  return descending ? sorted.reverse() : sorted;
}

const PRIORITY_LABEL: Record<Priority, string> = { high: "High", medium: "Medium", low: "Low", none: "No priority" };

/** The groups of the list view: by due date (Overdue, Today, This week, Later, No date), by list, by priority, or one group with no header. */
export function groupFor(tasks: readonly Task[], lists: readonly TaskList[], now: Date, options: ViewOptions): TaskGroup[] {
  const order = (group: Task[]) => sortTasks(group, options.sort, options.descending);
  if (options.groupBy === "due") return groupTasks(tasks, now).map((g) => ({ ...g, tasks: order(g.tasks) }));
  if (options.groupBy === "none") return tasks.length === 0 ? [] : [{ key: "all", label: "", amber: false, tasks: order([...tasks]) }];
  if (options.groupBy === "priority") {
    return (["high", "medium", "low", "none"] as const)
      .map((p) => ({ key: p, label: PRIORITY_LABEL[p], amber: false, tasks: order(tasks.filter((t) => t.priority === p)) }))
      .filter((g) => g.tasks.length > 0);
  }
  return lists
    .map((l) => ({ key: l.id, label: l.name, amber: false, tasks: order(tasks.filter((t) => t.listId === l.id)) }))
    .filter((g) => g.tasks.length > 0);
}

/** The lanes of the Tasks board: To do, In progress, Blocked and, if shown, Done, each ordered by `boardSort`. A lane is the task's status; Done when it is done. */
export function lanesFor(tasks: readonly Task[], options: ViewOptions): { lane: Lane; label: string; tasks: Task[] }[] {
  const order = (list: Task[]) => (options.boardSort === "due" ? sortByDue(list) : sortTasks(list, options.boardSort));
  const lanes = LANES.filter((lane) => lane !== "done" || options.showDone);
  return lanes.map((lane) => ({ lane, label: LANE_LABELS[lane], tasks: order(tasks.filter((t) => laneOf(t) === lane)) }));
}
