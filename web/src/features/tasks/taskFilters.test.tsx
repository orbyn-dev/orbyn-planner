import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Tag, Task, TaskList } from "../../core/planner/types";
import { NO_FILTERS, applyFilters, filterCount, toggle, type TaskFilters } from "./taskFilters";
import { ActiveFilters, FiltersSheet, Highlighted, matchesQuery } from "./FiltersSheet";

const NOW = new Date(2026, 10, 7, 10, 0);
const task = (over: Partial<Task>): Task => ({
  id: "t", title: "Task", notes: "", listId: "work", due: null, priority: "none", done: false, completedAt: null, deletedAt: null, checklist: [], tags: [],
  projectId: null, sectionId: null, repeat: null, reminder: null, completions: [], overrideOf: null, createdAt: "2026-11-01T09:00", updatedAt: "2026-11-01T09:00", ...over,
});
const lists: TaskList[] = [
  { id: "work", name: "Work", colour: "c1" } as TaskList,
  { id: "home", name: "Home", colour: "c2" } as TaskList,
];
const tags: Tag[] = [{ id: "g1", name: "urgent", colour: "c3", deletedAt: null }];

describe("task filters", () => {
  const open = task({ id: "a", title: "Send the launch brief", due: "2026-11-07T12:00" });
  const blocked = task({ id: "b", title: "Book a table", listId: "home", status: "blocked", priority: "high" });
  const done = task({ id: "c", title: "Reply to the school", done: true, completedAt: "2026-11-01T09:00" });
  const all = [open, blocked, done];

  it("Open alone is the default and counts as no filter", () => {
    expect(filterCount(NO_FILTERS)).toBe(0);
    expect(applyFilters(all, NO_FILTERS, NOW, false).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("several choices in a group are alternatives, and the groups all apply", () => {
    const f: TaskFilters = { ...NO_FILTERS, lists: ["work", "home"], priorities: ["high"] };
    expect(filterCount(f)).toBe(3);
    expect(applyFilters(all, f, NOW, false).map((t) => t.id)).toEqual(["b"]);
    expect(applyFilters(all, { ...NO_FILTERS, dues: ["today", "none"] }, NOW, false).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("Status picks Done and Blocked tasks", () => {
    expect(applyFilters(all, { ...NO_FILTERS, statuses: ["done"] }, NOW, false).map((t) => t.id)).toEqual(["c"]);
    expect(applyFilters(all, { ...NO_FILTERS, statuses: ["blocked"] }, NOW, false).map((t) => t.id)).toEqual(["b"]);
    expect(filterCount({ ...NO_FILTERS, statuses: ["open", "done"] })).toBe(2);
  });

  it("toggle adds and removes a choice", () => {
    expect(toggle(["a"], "b")).toEqual(["a", "b"]);
    expect(toggle(["a", "b"], "a")).toEqual(["b"]);
  });

  it("the narrow search looks at the title, the list and the tags", () => {
    expect(matchesQuery(open, "launch", lists, tags)).toBe(true);
    expect(matchesQuery(blocked, "home", lists, tags)).toBe(true);
    expect(matchesQuery(task({ tags: ["g1"] }), "urgent", lists, tags)).toBe(true);
    expect(matchesQuery(open, "invoices", lists, tags)).toBe(false);
  });

  it("picks the typed words out of a title", () => {
    render(<Highlighted text="Send the launch brief" query="launch" />);
    expect(screen.getByText("launch")).toHaveClass("hl");
  });
});

describe("Filters sheet", () => {
  it("turns a chip on, says how many are selected and clears them", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<FiltersSheet filters={NO_FILTERS} onChange={onChange} lists={lists} tags={tags} onClose={() => undefined} />);
    expect(screen.getByText("0 selected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Work" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, lists: ["work"] });
    rerender(<FiltersSheet filters={{ ...NO_FILTERS, lists: ["work"] }} onChange={onChange} lists={lists} tags={tags} onClose={() => undefined} />);
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Work" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenLastCalledWith(NO_FILTERS);
  });

  it("Done closes it", async () => {
    const onClose = vi.fn();
    render(<FiltersSheet filters={NO_FILTERS} onChange={() => undefined} lists={lists} tags={tags} onClose={onClose} />);
    // The Status group has a Done chip too: the sheet's own button is the last.
    await userEvent.click(screen.getAllByRole("button", { name: "Done" }).at(-1)!);
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Active filters", () => {
  it("names each filter on, removes one, and Clear all removes them all", async () => {
    const onChange = vi.fn();
    const f: TaskFilters = { ...NO_FILTERS, lists: ["work"], dues: ["today"] };
    render(<ActiveFilters filters={f} onChange={onChange} lists={lists} tags={tags} />);
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove Work" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...f, lists: [] });
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onChange).toHaveBeenLastCalledWith(NO_FILTERS);
  });

  it("shows nothing while only the default status is on", () => {
    const { container } = render(<ActiveFilters filters={NO_FILTERS} onChange={() => undefined} lists={lists} tags={tags} />);
    expect(container).toBeEmptyDOMElement();
  });
});
