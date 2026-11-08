import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { ClockProvider } from "../../app/clock";
import { UiProvider } from "../../app/ui";
import { LocalStore } from "../../store/LocalStore";
import { MemoryPersistence } from "../../store/persistence";
import { TaskPanelState } from "./TaskPanel";

// The task panel's loading and error states (Planner Designs p-task-loading, p-task-error).
const NOW = new Date(2026, 10, 7, 10, 0);

afterEach(() => vi.useRealTimers());

describe("the task panel while its task is not there", () => {
  it("loading: nothing for 400 ms, then a skeleton of the rows with Loading this task", async () => {
    vi.useFakeTimers();
    render(
      <UiProvider>
        <TaskPanelState taskId="x" ready={false} />
      </UiProvider>,
    );
    expect(screen.queryByRole("complementary", { name: "Task" })).toBeNull();
    await act(async () => void (await vi.advanceTimersByTimeAsync(450)));
    const panel = screen.getByRole("complementary", { name: "Task" });
    expect(panel).toHaveAttribute("aria-busy", "true");
    expect(within(panel).getByRole("status")).toHaveTextContent("Loading this task");
    expect(panel.querySelectorAll(".skel").length).toBeGreaterThanOrEqual(6);
    expect(Array.from(panel.querySelectorAll(".kv > span:first-child")).map((e) => e.textContent)).toEqual(["Due", "List", "Priority", "Repeat", "Reminder"]);
  });

  it("error: a task that is gone says so, with Close and Try again, in red only because it failed", async () => {
    window.history.replaceState(null, "", "/tasks");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => NOW, broadcast: false });
    await store.ready;
    const task = store.addTask({ title: "water plants" });
    render(
      <ClockProvider value={() => NOW}>
        <App store={store} />
      </ClockProvider>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "water plants" }));
    expect(screen.getByRole("complementary", { name: "Task" })).toBeInTheDocument();
    // It was deleted on another device while the panel was open.
    await act(async () => store.deleteTask(task.id));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn’t open this task");
    expect(alert).toHaveTextContent("It may have been deleted on another device, or your connection dropped. Your other tasks are fine.");
    expect(alert).toHaveClass("red-ring");
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("alert")).toBeInTheDocument(); // still gone: it says so again
    await userEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("complementary", { name: "Task" })).toBeNull();
  });
});
