import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { ClockProvider } from "../../state/clock";
import { LocalStore } from "../../data/local/LocalStore";
import { MemoryPersistence } from "../../data/local/persistence";

const NOW = new Date(2026, 10, 7, 10, 0);
beforeEach(() => vi.unstubAllGlobals());

describe("New task, laid out as drawn", () => {
  it("the fields are Title, Due and List, then the rows Repeat, Reminder and Priority", async () => {
    window.history.replaceState(null, "", "/tasks");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => NOW });
    await store.ready;
    render(
      <ClockProvider value={() => NOW}>
        <App store={store} />
      </ClockProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Add a task" }));
    const dialog = screen.getByRole("dialog", { name: "New task" });
    const labels = Array.from(dialog.querySelectorAll("form label")).map((l) => l.textContent);
    expect(labels.slice(0, 5)).toEqual(["Title", "Due", "List", "Repeat", "Reminder"]);
    expect(labels.indexOf("Priority")).toBeGreaterThan(labels.indexOf("Reminder"));
    expect(dialog.querySelector(".kv label[for='nt-priority']")).not.toBeNull(); // Priority is a row, not a field
  });
});

describe("New task", () => {
  it("adds a task with a due date, time and priority", async () => {
    window.history.replaceState(null, "", "/tasks");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => NOW });
    await store.ready;
    render(
      <ClockProvider value={() => NOW}>
        <App store={store} />
      </ClockProvider>,
    );
    const opener = screen.getByRole("button", { name: "Add a task" });
    await userEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "New task" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add task" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Title"), "Book the dentist");
    await userEvent.type(screen.getByLabelText("Due"), "2026-11-14 15:00");
    await userEvent.selectOptions(screen.getByLabelText("Priority"), "high");
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));
    expect(store.getState().tasks[0]).toMatchObject({ title: "Book the dentist", due: "2026-11-14T15:00", priority: "high" });
    expect(screen.queryByRole("dialog", { name: "New task" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
