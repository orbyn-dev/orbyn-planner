import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { CompletedPage } from "./CompletedPage";
import type { PlannerState, Task } from "../../core/planner/types";

const model = vi.hoisted(() => ({ tasks: [] as Task[], lists: [] }));
vi.mock("../../state/store", () => ({ useStore: () => ({ restoreTask: vi.fn() }), usePlannerSelector: (select: (s: PlannerState) => unknown) => select(model as unknown as PlannerState) }));
vi.mock("../../state/clock", () => ({ useNow: () => new Date("2026-11-27T10:00:00Z") }));
vi.mock("./TaskRow", () => ({ TaskRow: ({ task }: { task: Task }) => <li>{task.title}</li> }));
// A deterministic small viewport: this exercises the page/adapter integration without browser geometry.
vi.mock("../../ui/primitives/VirtualList", () => ({ VirtualList: ({ items, children }: {items: Task[]; children: (t: Task, i: number) => React.ReactNode}) => <ul>{items.slice(0, 2).map((item, i) => children(item, i))}</ul> }));

it("bounds completed and deleted rows and keeps their newest-first ordering", async () => {
  model.tasks = Array.from({length: 4}, (_, i) => ({ id: `c${i}`, title: `Completed ${i}`, done: true, deletedAt: null, completedAt: `2026-11-2${i + 1}T00:00:00Z` } as Task)).concat(
    Array.from({length: 4}, (_, i) => ({ id: `d${i}`, title: `Deleted ${i}`, done: false, deletedAt: `2026-11-2${i + 1}T00:00:00Z`, completedAt: null } as Task)));
  render(<CompletedPage />);
  expect(screen.getByText("Completed 3")).toBeInTheDocument();
  expect(screen.queryByText("Completed 0")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: "Deleted" }));
  expect(screen.getByText("Deleted 3")).toBeInTheDocument();
  expect(screen.queryByText("Deleted 0")).not.toBeInTheDocument();
});
