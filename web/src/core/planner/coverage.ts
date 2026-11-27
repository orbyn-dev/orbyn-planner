import type { PlannerState, Task } from "./types";

export function coversWindow(state: PlannerState, kind: "today" | "calendar", start: string, end: string): boolean {
  if (state.ready) return true;
  const coverage = state.coverage;
  const window = coverage?.[kind];
  return coverage?.phase === "partial" && coverage.metadata && window !== undefined && window.start <= start && window.end >= end;
}

/** The store revalidates this permission against the authoritative record inside its write transaction. */
export function canCompleteTask(state: PlannerState, task: Task): boolean {
  return state.ready || state.coverage?.phase === "partial" && state.coverage.metadata && !task.repeat && !task.overrideOf && state.tasks.some((record) => record.id === task.id);
}
