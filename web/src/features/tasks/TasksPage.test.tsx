import { act, render, screen, waitFor, within } from "@testing-library/react";
import { firstRunDoneForTests } from "../../test-setup";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { ClockProvider } from "../../app/clock";
import { formatDue } from "../../lib/dates";
import { TOAST_MS } from "../../app/ui";
import { LocalStore } from "../../store/LocalStore";
import { MemoryPersistence } from "../../store/persistence";

const NOW = new Date(2026, 10, 7, 10, 0);

async function openTasks() {
  window.history.replaceState(null, "", "/tasks");
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
  const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => NOW });
  render(
    <ClockProvider value={() => NOW}>
      <App store={store} />
    </ClockProvider>,
  );
  await store.ready;
  const field = screen.getByRole("textbox", { name: "Add a task" });
  await waitFor(() => expect(field).toBeEnabled());
  return { store, field };
}

async function add(field: HTMLElement, text: string) {
  await userEvent.type(field, `${text}{Enter}`);
}

/** Open a filter chip and choose one of its choices. */
async function pickChip(label: string, choice: string) {
  await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}:`) }));
  await userEvent.click(screen.getByRole("menuitemradio", { name: choice }));
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.useRealTimers());

describe("Tasks page", () => {
  it("adds a task from plain words", async () => {
    const { field } = await openTasks();
    await add(field, "dentist friday 3pm !high");
    const row = (await screen.findByRole("button", { name: "dentist" })).closest("li")!;
    expect(within(row).getByText("Fri 13 15:00")).toBeInTheDocument();
    expect(within(row).getByText("High")).toBeInTheDocument();
    expect(field).toHaveValue("");
  });

  it("strikes a completed task through in place", async () => {
    const { field } = await openTasks();
    await add(field, "alpha tomorrow");
    await add(field, "beta");
    const box = await screen.findByRole("checkbox", { name: "Complete alpha" });
    const rows = () => screen.getAllByRole("listitem").map((li) => li.textContent);
    const before = rows();
    await userEvent.click(box);
    expect(box).toBeChecked();
    expect(box.closest("li")).toHaveAttribute("data-done", "true");
    expect(rows()).toEqual(before);
  });

  it("deletes with an Undo that brings the task back", async () => {
    const { field, store } = await openTasks();
    await add(field, "water plants");
    await userEvent.click(await screen.findByRole("button", { name: "water plants" }));
    const panel = screen.getByRole("complementary", { name: "Task" });
    await userEvent.click(within(panel).getByRole("button", { name: "Delete" }));
    expect(screen.queryByRole("button", { name: "water plants" })).not.toBeInTheDocument();
    expect(store.getState().tasks[0]!.deletedAt).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByRole("button", { name: "water plants" })).toBeInTheDocument();
    expect(store.getState().tasks[0]!.deletedAt).toBeNull();
  });

  it("drops the Undo toast after six seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { field } = await openTasks();
    await add(field, "short lived");
    expect(screen.getByRole("status")).toHaveTextContent("Added");
    await act(async () => {
      vi.advanceTimersByTime(TOAST_MS + 10);
    });
    expect(screen.queryByText(/Added/)).not.toBeInTheDocument();
  });

  it("filters by due date and by list", async () => {
    const { field, store } = await openTasks();
    store.addList("Errands", "c3");
    await add(field, "one today");
    await add(field, "two tomorrow");
    await add(field, "three #errands");
    await pickChip("Due date", "Today");
    expect(screen.getByRole("button", { name: "one" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "two" })).not.toBeInTheDocument();
    await pickChip("Due date", "Any due date");
    await pickChip("List", "Errands");
    expect(screen.getByRole("button", { name: "three" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "one" })).not.toBeInTheDocument();
  });

  it("the filters are chips without a chevron: Any due date, Any priority, Any list; the Owner filter stays out until sharing exists", async () => {
    const { field } = await openTasks();
    await add(field, "plain");
    await add(field, "urgent !high");
    const chips = [...document.querySelectorAll(".filters .chip")].map((c) => c.textContent);
    expect(chips).toEqual(["Any due date", "Any priority", "Any list"]);
    expect(document.querySelector(".filters .chip svg")).toBeNull(); // no chevron
    expect(document.querySelector(".filters select")).toBeNull();
    expect(screen.queryByRole("button", { name: /Anyone|Owner/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Due date: Any due date" }));
    expect(within(screen.getByRole("menu", { name: "Due date" })).getAllByRole("menuitemradio").map((o) => o.textContent)).toEqual(["Any due date", "Today", "This week", "Overdue"]);
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Priority: Any priority" }));
    expect(within(screen.getByRole("menu", { name: "Priority" })).getAllByRole("menuitemradio").map((o) => o.textContent)).toEqual(["Any priority", "High", "Medium", "Low", "None"]);
    await userEvent.click(screen.getByRole("menuitemradio", { name: "High" }));
    expect(screen.getByRole("button", { name: "Priority: High" })).toHaveTextContent("High");
    expect(screen.getByRole("button", { name: "urgent" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "plain" })).toBeNull();
    await pickChip("Priority", "Any priority");
    expect(screen.getByRole("button", { name: "plain" })).toBeInTheDocument();
  });

  it("shows the board lanes", async () => {
    const { field } = await openTasks();
    await add(field, "card");
    await userEvent.click(screen.getByRole("radio", { name: "Board" }));
    expect(within(screen.getByRole("region", { name: "To do" })).getByRole("button", { name: "card" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "List" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Complete card" }));
    await userEvent.click(screen.getByRole("radio", { name: "Board" }));
    expect(within(screen.getByRole("region", { name: "Done" })).getByRole("button", { name: "card" })).toBeInTheDocument();
  });
});

describe("quick add preview", () => {
  it("shows what was read and can keep the text as typed", async () => {
    const { field, store } = await openTasks();
    await userEvent.type(field, "dentist friday 3pm !high");
    expect(screen.getByText("dentist · due Fri 13 Nov 15:00 · High")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Keep as typed" }));
    await userEvent.type(field, "{Enter}");
    expect(store.getState().tasks[0]).toMatchObject({ title: "dentist friday 3pm !high", due: null, priority: "none" });
  });

  it("says nothing for plain words", async () => {
    const { field } = await openTasks();
    await userEvent.type(field, "wear sun hat");
    expect(screen.queryByRole("checkbox", { name: "Keep as typed" })).not.toBeInTheDocument();
    await userEvent.type(field, "{Enter}");
    expect(await screen.findByRole("button", { name: "wear sun hat" })).toBeInTheDocument();
  });

  it("View options groups, hides completed tasks, remembers and holds Completed and deleted", async () => {
    window.localStorage.clear();
    firstRunDoneForTests();
    const { field } = await openTasks();
    await add(field, "alpha tomorrow");
    await add(field, "beta !high");
    await userEvent.click(await screen.findByRole("checkbox", { name: "Complete beta" }));
    expect(screen.queryByRole("link", { name: "Completed and deleted" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "View options" }));
    const pop = screen.getByRole("dialog", { name: "View options" });
    expect(within(within(pop).getByRole("radiogroup", { name: "Group by" })).getByRole("radio", { name: "Due date" })).toBeChecked();
    await userEvent.click(within(within(pop).getByRole("radiogroup", { name: "Group by" })).getByRole("radio", { name: "Priority" }));
    expect(screen.getByRole("region", { name: "High" })).toBeInTheDocument();
    await userEvent.click(within(pop).getByRole("switch", { name: "Show completed tasks" }));
    expect(screen.queryByRole("button", { name: "beta" })).toBeNull();
    expect(within(pop).getByRole("link", { name: /Completed and deleted/ })).toHaveAttribute("href", "/completed");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "View options" })).toBeNull();
    expect(screen.getByRole("button", { name: "View options" })).toHaveFocus();
    expect(window.localStorage.getItem("orbyn-planner.tasks-view")).toContain('"groupBy":"priority"');
  });

  it("completing a task says “Marked done.” with Undo, which brings it back; nothing moves", async () => {
    const { field, store } = await openTasks();
    await add(field, "alpha");
    await userEvent.click(await screen.findByRole("checkbox", { name: "Complete alpha" }));
    expect(store.getState().tasks[0]!.done).toBe(true);
    expect(screen.getByText("Marked done.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(store.getState().tasks[0]!.done).toBe(false);
    expect(screen.getByRole("checkbox", { name: "Complete alpha" })).not.toBeChecked();
  });

  it("the Marked done toast stays for five seconds", async () => {
    const { field } = await openTasks();
    await add(field, "alpha");
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await userEvent.click(await screen.findByRole("checkbox", { name: "Complete alpha" }));
      expect(screen.getByText("Marked done.")).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4_900);
      });
      expect(screen.getByText("Marked done.")).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      expect(screen.queryByText("Marked done.")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("View options is a 280 px list: rows with Selected at the right, a two-part direction switch, not chips", async () => {
    await openTasks();
    await userEvent.click(screen.getByRole("button", { name: "View options" }));
    const pop = screen.getByRole("dialog", { name: "View options" });
    expect(pop.className).toContain("view-options");
    const group = within(within(pop).getByRole("radiogroup", { name: "Group by" }));
    expect(group.getAllByRole("radio").map((r) => r.getAttribute("aria-label"))).toEqual(["None", "Due date", "List", "Priority"]);
    expect(group.getByRole("radio", { name: "Due date" })).toHaveTextContent("Selected");
    expect(group.getByRole("radio", { name: "None" })).not.toHaveTextContent("Selected");
    expect(within(pop).getByRole("radiogroup", { name: "Sort direction" })).toHaveClass("seg");
    expect(pop.querySelector(".pills")).toBeNull();
    const nodeFs = "node:fs";
    const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
    const rules = fs.readFileSync(`${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src/styles/app.css`, "utf8");
    expect(rules).toMatch(/\.view-options \{[^}]*width: var\(--sp-280\)/);
  });

  it("a due date in the next six days reads with its day number (Planner Designs v49 work-list: Mon 9)", async () => {
    await openTasks();
    expect(formatDue("2026-11-09", new Date(2026, 10, 7, 10, 0))).toBe("Mon 9");
    expect(formatDue("2026-11-12T15:00", new Date(2026, 10, 7, 10, 0))).toBe("Thu 12 15:00");
    expect(formatDue("2026-11-08", new Date(2026, 10, 7, 10, 0))).toBe("Tomorrow");
    expect(formatDue("2026-11-14", new Date(2026, 10, 7, 10, 0))).toBe("14 Nov");
  });

  it("a group counts its open tasks: a finished one stays in the group but not in the number", async () => {
    const { field } = await openTasks();
    await add(field, "alpha today");
    await add(field, "beta today");
    await userEvent.click(await screen.findByRole("checkbox", { name: "Complete alpha" }));
    const header = screen.getByText("Today (planned or due)").closest(".bh")!;
    expect(header.querySelector("span")?.textContent).toBe("1");
    expect(screen.getAllByRole("listitem").filter((li) => /alpha|beta/.test(li.textContent ?? ""))).toHaveLength(2);
  });

  it("the quick-add line is not pushed to the foot of the page", async () => {
    const nodeFs = "node:fs";
    const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
    const css = fs.readFileSync(`${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src/styles/app.css`, "utf8");
    const i = css.indexOf(".addbar {");
    expect(css.slice(i, css.indexOf("}", i))).not.toContain("margin-top: auto");
  });

  it("within a day, a task with a time comes before one with only a date", async () => {
    const { field } = await openTasks();
    await add(field, "gamma today");
    await add(field, "delta today 9am");
    await screen.findByRole("button", { name: "delta" });
    const titles = screen.getAllByRole("listitem").map((li) => li.textContent ?? "").filter((t) => /gamma|delta/.test(t));
    expect(titles[0]).toContain("delta");
    expect(titles[1]).toContain("gamma");
  });
});
