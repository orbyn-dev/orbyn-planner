import { describe, expect, it } from "vitest";
import type { Task } from "../../store/types";
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
