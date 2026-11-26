import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { ClockProvider } from "../../state/clock";
import { LocalStore } from "../../data/local/LocalStore";
import { MemoryPersistence } from "../../data/local/persistence";
import type { Task } from "../../core/planner/types";
import { TodayRow } from "../tasks";

afterEach(() => vi.unstubAllGlobals());

it("renders only the changed Today row after completing a task and none after an unrelated event", async () => {
  const now = new Date(2026, 10, 7, 10);
  const previousFirstRun = localStorage.getItem("orbyn-planner.first-run.local");
  localStorage.setItem("orbyn-planner.first-run.local", "done");
  window.history.replaceState(null, "", "/today");
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
  vi.stubGlobal("ResizeObserver", undefined);
  const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => now, broadcast: false });
  await store.ready;
  const tasks = Array.from({ length: 45 }, (_, i) => store.addTask({ title: `Task ${i}`, due: "2026-11-07" }));
  const counts = new Map<string, number>();
  const memo = TodayRow as unknown as { type: (props: { task: Task }) => ReturnType<typeof TodayRow> };
  const original = memo.type;
  memo.type = (props) => { counts.set(props.task.id, (counts.get(props.task.id) ?? 0) + 1); return original(props); };
  try {
    const view = render(<ClockProvider value={() => now}><App store={store} /></ClockProvider>);
    expect(screen.getAllByRole("checkbox", { name: /^Complete Task / })).toHaveLength(45);
    const changed = tasks[44]!.id;
    const untouched = tasks[0]!.id;
    const beforeChanged = counts.get(changed) ?? 0;
    const beforeUntouched = counts.get(untouched) ?? 0;
    expect(beforeChanged).toBeGreaterThan(0);
    expect(beforeUntouched).toBeGreaterThan(0);
    act(() => store.setDone(changed, true));
    expect(counts.get(changed)).toBeGreaterThan(beforeChanged);
    expect(counts.get(untouched)).toBe(beforeUntouched);
    const afterCompletion = new Map(counts);
    act(() => { store.addEvent({ title: "Another day", start: "2026-11-09T11:00", end: "2026-11-09T12:00" }); });
    expect(counts).toEqual(afterCompletion);
    view.unmount();
  } finally {
    memo.type = original;
    if (previousFirstRun === null) localStorage.removeItem("orbyn-planner.first-run.local");
    else localStorage.setItem("orbyn-planner.first-run.local", previousFirstRun);
  }
});
