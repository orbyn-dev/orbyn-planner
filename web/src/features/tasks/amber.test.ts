import { describe, expect, it } from "vitest";
import type { Task } from "../../core/planner/types";
import { needsAction } from "./selectors";

const NOW = new Date(2026, 10, 7, 10, 0);
const task = (due: string | null, done = false) => ({ due, done }) as Task;

describe("amber dates", () => {
  it("a task is amber only when it is overdue or due within the hour", () => {
    expect(needsAction(task("2026-11-06"), NOW)).toBe(true); // overdue
    expect(needsAction(task("2026-11-07T09:30"), NOW)).toBe(true); // past
    expect(needsAction(task("2026-11-07T10:45"), NOW)).toBe(true); // within the hour
    expect(needsAction(task("2026-11-07T11:00"), NOW)).toBe(true); // exactly an hour
    expect(needsAction(task("2026-11-07T11:01"), NOW)).toBe(false); // later today
    expect(needsAction(task("2026-11-07"), NOW)).toBe(false); // today, no time
    expect(needsAction(task("2026-11-09T09:00"), NOW)).toBe(false);
    expect(needsAction(task(null), NOW)).toBe(false);
    expect(needsAction(task("2026-11-06", true), NOW)).toBe(false); // done
  });
});

import { groupTasks } from "./selectors";

describe("group names (Planner Designs v49)", () => {
  const t = (due: string) => ({ id: due, due, done: false, createdAt: due, deletedAt: null }) as unknown as Task;
  it("the days after today are Next week when all of them fall in the following week, and This week while any is still in this one", () => {
    // Saturday 7 Nov 2026: the week (Monday start) ends on Sunday 8, so Mon 9 to Fri 13 are next week.
    expect(groupTasks([t("2026-11-09"), t("2026-11-12")], new Date(2026, 10, 7, 10, 0)).map((g) => g.label)).toEqual(["Next week"]);
    expect(groupTasks([t("2026-11-08"), t("2026-11-12")], new Date(2026, 10, 7, 10, 0)).map((g) => g.label)).toEqual(["This week"]);
    // Monday 2 Nov: Tue 3 to Fri 6 are this week.
    expect(groupTasks([t("2026-11-04")], new Date(2026, 10, 2, 10, 0)).map((g) => g.label)).toEqual(["This week"]);
  });
});
