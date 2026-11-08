import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { ClockProvider } from "../../app/clock";
import { LocalStore } from "../../store/LocalStore";
import { MemoryPersistence } from "../../store/persistence";

const NOW = new Date(2026, 10, 7, 10, 0);

async function open() {
  window.history.replaceState(null, "", "/today");
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
  const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => NOW });
  await store.ready;
  const errands = store.addList("Errands", "c4");
  act(() => {
    store.addTask({ title: "Book the dentist", listId: errands.id });
    store.addTask({ title: "Buy stamps" });
  });
  render(
    <ClockProvider value={() => NOW}>
      <App store={store} />
    </ClockProvider>,
  );
  return { store, errands };
}

beforeEach(() => vi.unstubAllGlobals());

const options = () => screen.getAllByRole("option").map((o) => o.textContent);

describe("Search or add", () => {
  it("opens with Ctrl+K, finds tasks and lists as you type, and closes with Escape returning focus", async () => {
    await open();
    const field = screen.getByRole("button", { name: "Search or add" });
    field.focus();
    await userEvent.keyboard("{Control>}k{/Control}");
    const input = screen.getByRole("combobox", { name: "Search or add" });
    expect(input).toHaveFocus();
    await userEvent.type(input, "err");
    expect(options()).toEqual(["Add task “err”", "Add event “err”", "Errands"]);
    await userEvent.clear(input);
    await userEvent.type(input, "dent");
    expect(options()).toContain("Book the dentistErrands");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Search or add" })).not.toBeInTheDocument();
    expect(field).toHaveFocus();
  });

  it("moves with the arrow keys and opens the picked task", async () => {
    const { store } = await open();
    await userEvent.keyboard("{Control>}k{/Control}");
    const input = screen.getByRole("combobox", { name: "Search or add" });
    await userEvent.type(input, "b");
    // Add first (a task, then an event), then the two tasks and the Inbox list.
    expect(options()).toEqual(["Add task “b”", "Add event “b”", "Book the dentistErrands", "Buy stampsInbox", "Inbox"]);
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(screen.getAllByRole("option")[3]).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(screen.getAllByRole("option")[4]).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowUp}");
    await userEvent.keyboard("{Enter}");
    const panel = await screen.findByRole("complementary", { name: "Task" });
    expect(within(panel).getByRole("textbox", { name: "Title" })).toHaveValue("Buy stamps");
    expect(store.getState().tasks).toHaveLength(2);
  });

  it("offers to add a task in plain words when nothing matches, and Enter adds it", async () => {
    const { store, errands } = await open();
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.type(screen.getByRole("combobox", { name: "Search or add" }), "call mum friday 3pm #errands !high");
    await userEvent.keyboard("{ArrowDown}{Enter}"); // the event is first when a time is written; the task is second
    await waitFor(() => expect(store.getState().tasks).toHaveLength(3));
    const added = store.getState().tasks.find((t) => t.title === "Call mum")!;
    expect(added).toMatchObject({ due: "2026-11-13T15:00", priority: "high", listId: errands.id });
    expect(screen.queryByRole("dialog", { name: "Search or add" })).not.toBeInTheDocument();
  });

  it("does not offer Add when a task has exactly that title", async () => {
    await open();
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.type(screen.getByRole("combobox", { name: "Search or add" }), "buy stamps");
    expect(options()).toEqual(["Buy stampsInbox"]);
  });

  it("opens a list on the Lists page", async () => {
    const { errands } = await open();
    await userEvent.click(screen.getByRole("button", { name: "Search or add" }));
    await userEvent.type(screen.getByRole("combobox", { name: "Search or add" }), "errands");
    await userEvent.click(screen.getByRole("option", { name: "Errands" }));
    expect(window.location.pathname).toBe("/lists");
    expect(screen.getByRole("heading", { level: 1, name: "Errands" })).toBeInTheDocument();
    expect(errands.name).toBe("Errands");
  });

  it("keeps Tab inside the dialog", async () => {
    await open();
    await userEvent.keyboard("{Control>}k{/Control}");
    const input = screen.getByRole("combobox", { name: "Search or add" });
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole("dialog", { name: "Search or add" }).contains(document.activeElement)).toBe(true);
    expect(input).toBeInTheDocument();
  });

  it("a time in the words offers an event first, with its day and time, then the task with its day only", async () => {
    await open();
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.type(screen.getByRole("combobox", { name: "Search or add" }), "dentist friday 3pm");
    expect(options().slice(0, 2)).toEqual(["Add event “Dentist” · Fri 13 Nov, 15:00", "Add task “Dentist” · due Fri 13 Nov"]);
    expect(screen.getByText("Enter to add")).toBeInTheDocument();
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
  });

  it("Enter on the event adds it for an hour at that time", async () => {
    const { store } = await open();
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.type(screen.getByRole("combobox", { name: "Search or add" }), "call dentist friday 3pm{Enter}");
    await waitFor(() => expect(store.getState().events).toHaveLength(1));
    expect(store.getState().events[0]).toMatchObject({ title: "Call dentist", start: "2026-11-13T15:00", end: "2026-11-13T16:00", allDay: false });
  });

  it("an event with no day or time opens the New event card with the title in", async () => {
    await open();
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.type(screen.getByRole("combobox", { name: "Search or add" }), "plumber invoice");
    await userEvent.click(screen.getByRole("option", { name: "Add event “plumber invoice”" }));
    const dialog = await screen.findByRole("dialog", { name: "New event" });
    expect(within(dialog).getByLabelText("Title")).toHaveValue("plumber invoice");
  });

  it("finds events under Calendar and opens one in the calendar", async () => {
    const { store } = await open();
    act(() => {
      store.addEvent({ title: "Dentist check-up", start: "2026-08-14T09:00", end: "2026-08-14T10:00" });
    });
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.type(screen.getByRole("combobox", { name: "Search or add" }), "dentist");
    const group = screen.getByRole("group", { name: "Calendar" });
    expect(within(group).getByRole("option")).toHaveTextContent("Dentist check-up · Fri 14 Aug");
    await userEvent.click(within(group).getByRole("option"));
    expect(window.location.pathname).toBe("/calendar");
    expect(await screen.findByRole("complementary", { name: "Event" })).toBeInTheDocument();
  });

  it("finds projects, completed tasks and tasks deleted in the last 30 days", async () => {
    const { store } = await open();
    act(() => {
      store.addProject({ name: "Kitchen plumbing", colour: "c2" });
      const done = store.addTask({ title: "Plumber visit" });
      store.updateTask(done.id, { done: true, completedAt: NOW.toISOString() });
      const gone = store.addTask({ title: "Plumber quote" });
      store.deleteTask(gone.id);
    });
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.type(screen.getByRole("combobox", { name: "Search or add" }), "plumb");
    expect(within(screen.getByRole("group", { name: "Projects" })).getByRole("option")).toHaveTextContent("Kitchen plumbing");
    const tasks = within(screen.getByRole("group", { name: "Tasks" })).getAllByRole("option").map((o) => o.textContent);
    expect(tasks).toEqual(["Plumber visitInbox", "Plumber quoteDeleted"]);
  });

  it("no results still offers the task and the event, and says what was searched", async () => {
    await open();
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.type(screen.getByRole("combobox", { name: "Search or add" }), "plumber invoice");
    expect(options()).toEqual(["Add task “plumber invoice”", "Add event “plumber invoice”"]);
    const note = screen.getByText("No results for “plumber invoice”").parentElement!;
    expect(note).toHaveTextContent("No results for “plumber invoice”");
    expect(note).toHaveTextContent("Nothing in tasks, events, lists or projects matches. Search covers completed tasks and the last 30 days of deleted ones.");
  });

  it("searches the words, not the date written after them: dentist friday 3pm lists Tasks, Calendar and Lists matching dentist", async () => {
    const { store } = await open();
    store.addEvent({ title: "Dentist check-up", start: "2026-08-14T10:00", end: "2026-08-14T11:00" });
    store.addList("Dentist notes", "c2");
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.type(screen.getByRole("combobox", { name: "Search or add" }), "dentist friday 3pm");
    const dialog = screen.getByRole("dialog", { name: "Search or add" });
    const groups = Array.from(dialog.querySelectorAll(".grp")).map((g) => g.textContent);
    expect(groups).toEqual(["Add", "Tasks", "Calendar", "Lists"]);
    expect(within(dialog).getByText("Book the dentist")).toBeInTheDocument(); // the open() planner already has this task
    expect(within(dialog).getByText(/Dentist check-up/)).toBeInTheDocument();
    expect(within(dialog).getByText("Dentist notes")).toBeInTheDocument();
  });

  it("has no Keep as typed box: the dialog is the field and its rows", async () => {
    await open();
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.type(screen.getByRole("combobox", { name: "Search or add" }), "dentist friday 3pm");
    expect(screen.queryByRole("checkbox", { name: /Keep as typed/ })).toBeNull();
  });

  it("typed words with nothing read out of them stay as typed", async () => {
    await open();
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.type(screen.getByRole("combobox", { name: "Search or add" }), "plumber invoice");
    expect(options()).toEqual(["Add task “plumber invoice”", "Add event “plumber invoice”"]);
  });
});
