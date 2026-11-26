import { describe, expect, it } from "vitest";
import { canCompleteTask, coversWindow } from "./coverage";
import type { PlannerCoverage, PlannerState, Task } from "./types";

const task = { id: "one", repeat: null, overrideOf: null } as Task;
const partial: PlannerCoverage = {
  phase: "partial", metadata: true,
  today: { start: "2026-11-01", end: "2026-11-30" },
  calendar: { start: "2026-11-07", end: "2026-11-14" },
  taskRecords: "partial", eventRecords: "partial", outbox: "complete",
};
const state = (ready: boolean, coverage?: PlannerCoverage) => ({ ready, coverage, tasks: [task] }) as unknown as PlannerState;

describe("hydration coverage", () => {
  it("accepts legacy full readiness without coverage metadata", () => {
    expect(coversWindow(state(true), "calendar", "1900-01-01", "2100-01-01")).toBe(true);
    expect(canCompleteTask(state(true), { ...task, repeat: {} as Task["repeat"] })).toBe(true);
  });
  it("accepts inclusive covered ranges but rejects dates outside and other windows", () => {
    const current = state(false, partial);
    expect(coversWindow(current, "calendar", "2026-11-07", "2026-11-14")).toBe(true);
    expect(coversWindow(current, "calendar", "2026-11-06", "2026-11-14")).toBe(false);
    expect(coversWindow(current, "calendar", "2026-11-07", "2026-11-15")).toBe(false);
    expect(coversWindow(current, "today", "2026-11-01", "2026-11-30")).toBe(true);
  });
  it("rejects failed and incomplete metadata phases", () => {
    expect(coversWindow(state(false, { ...partial, phase: "failed" }), "today", "2026-11-07", "2026-11-07")).toBe(false);
    expect(canCompleteTask(state(false, { ...partial, phase: "failed" }), task)).toBe(false);
    expect(coversWindow(state(false, { ...partial, metadata: false }), "today", "2026-11-07", "2026-11-07")).toBe(false);
  });
  it("allows a loaded one-off but blocks repeats, overrides and missing records", () => {
    const current = state(false, partial);
    expect(canCompleteTask(current, task)).toBe(true);
    expect(canCompleteTask(current, { ...task, repeat: {} as Task["repeat"] })).toBe(false);
    expect(canCompleteTask(current, { ...task, overrideOf: { id: "series", date: "2026-11-07" } })).toBe(false);
    expect(canCompleteTask(current, { ...task, id: "missing" })).toBe(false);
  });
});
