import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PlannerState, PlannerStore } from "../core/planner/types";
import { StoreProvider, usePlannerSelector } from "./store";

function fixture() {
  let state: PlannerState = { ready: true, tasks: [], lists: [], events: [], calendars: [], projects: [], tags: [], outbox: [], persistence: { status: "ok" } };
  const listeners = new Set<() => void>();
  // Only the subscription port is used by these probes.
  const store = { getState: () => state, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; } } as unknown as PlannerStore;
  return { store, listeners, update(patch: Partial<PlannerState>) { state = { ...state, ...patch }; for (const listener of listeners) listener(); } };
}

describe("usePlannerSelector", () => {
  it("ignores unrelated collection updates and unsubscribes under StrictMode", () => {
    const source = fixture();
    let renders = 0;
    function Probe() { const tasks = usePlannerSelector((s) => s.tasks); renders++; return <span>{tasks.length}</span>; }
    const view = render(<StrictMode><StoreProvider store={source.store}><Probe /></StoreProvider></StrictMode>);
    const initial = renders;
    act(() => source.update({ events: [] }));
    expect(renders).toBe(initial);
    act(() => source.update({ tasks: [] }));
    expect(renders).toBeGreaterThan(initial);
    expect(source.listeners.size).toBe(1);
    view.unmount();
    expect(source.listeners.size).toBe(0);
  });

  it("caches allocated selections and honors changed selectors and equality", () => {
    const source = fixture();
    let renders = 0;
    const select = (s: PlannerState) => ({ ready: s.ready });
    const equal = (a: { ready: boolean }, b: { ready: boolean }) => a.ready === b.ready;
    function Probe({ invert = false, compare = equal }) {
      const value = usePlannerSelector(invert ? (s) => ({ ready: !s.ready }) : select, compare);
      renders++;
      return <span>{String(value.ready)}</span>;
    }
    const view = render(<StoreProvider store={source.store}><Probe /></StoreProvider>);
    const initial = renders;
    act(() => source.update({ events: [] }));
    expect(renders).toBe(initial);
    view.rerender(<StoreProvider store={source.store}><Probe invert /></StoreProvider>);
    expect(screen.getByText("false")).toBeInTheDocument();
    view.rerender(<StoreProvider store={source.store}><Probe compare={() => true} /></StoreProvider>);
    expect(screen.getByText("true")).toBeInTheDocument();
  });

  it("switches stores without retaining the previous store's snapshot or subscription", () => {
    const first = fixture();
    const second = fixture();
    second.update({ ready: false });
    function Probe() { return <span>{String(usePlannerSelector((s) => s.ready))}</span>; }
    const view = render(<StoreProvider store={first.store}><Probe /></StoreProvider>);
    view.rerender(<StoreProvider store={second.store}><Probe /></StoreProvider>);
    expect(screen.getByText("false")).toBeInTheDocument();
    expect(first.listeners.size).toBe(0);
    expect(second.listeners.size).toBe(1);
    act(() => first.update({ ready: false }));
    expect(screen.getByText("false")).toBeInTheDocument();
  });
});
