import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { ClockProvider } from "../../app/clock";
import { LocalStore } from "../../store/LocalStore";
import { MemoryPersistence } from "../../store/persistence";
import { repeatEvery } from "../../store/repeat";
import { repeatSummary } from "./RowPopovers";

// Saturday 7 November 2026, 10:00.
const NOW = new Date(2026, 10, 7, 10, 0);

async function open(seed: (s: LocalStore) => void, route = "/tasks", name: string | RegExp = "Review") {
  window.history.replaceState(null, "", route);
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
  const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => NOW, broadcast: false });
  await store.ready;
  seed(store);
  const root = document.createElement("div");
  root.id = "root";
  document.body.appendChild(root);
  render(
    <ClockProvider value={() => NOW}>
      <App store={store} />
    </ClockProvider>,
    { container: root },
  );
  await userEvent.click(await screen.findByRole("button", { name }));
  return { store, panel: screen.getByRole("complementary", { name: route === "/tasks" ? "Task" : "Event" }) };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  document.getElementById("root")?.remove();
});

const row = (panel: HTMLElement, label: string) => within(panel).getByRole("button", { name: new RegExp(`^${label},`) });

describe("repeatSummary", () => {
  it("says a rule in the words of the menu", () => {
    expect(repeatSummary(null, "2026-11-09")).toBe("Never");
    expect(repeatSummary(repeatEvery("daily"), "2026-11-09")).toBe("Every day");
    expect(repeatSummary({ ...repeatEvery("weekly"), weekdays: ["mon", "tue", "wed", "thu", "fri"] }, "2026-11-09")).toBe("Every weekday");
    expect(repeatSummary({ ...repeatEvery("weekly"), weekdays: ["mon"] }, "2026-11-09")).toBe("Every week");
    expect(repeatSummary({ ...repeatEvery("daily"), interval: 2 }, "2026-11-09")).toBe("Every 2 days");
  });
});

describe("task panel row popovers", () => {
  it("Due: picking a day applies at once, the time field and No time work, and Escape returns focus to the row", async () => {
    const { store, panel } = await open((s) => s.addTask({ title: "Review", due: "2026-11-09T09:00" }));
    await userEvent.click(row(panel, "Due"));
    const pop = screen.getByRole("dialog", { name: "Due" });
    expect(within(pop).getByRole("button", { name: "Monday 9 November" })).toHaveFocus(); // opens on the day grid
    expect(within(pop).getByRole("button", { name: "Saturday 7 November" })).toHaveClass("today");
    await userEvent.keyboard("{ArrowRight}{ArrowDown}{Enter}"); // Tue 10 then Tue 17
    expect(store.getState().tasks[0]!.due).toBe("2026-11-17T09:00");
    const time = within(pop).getByRole("textbox", { name: "Due time" });
    await userEvent.clear(time);
    await userEvent.type(time, "17:30{Enter}");
    expect(store.getState().tasks[0]!.due).toBe("2026-11-17T17:30");
    await userEvent.click(within(pop).getByRole("button", { name: "No time" }));
    expect(store.getState().tasks[0]!.due).toBe("2026-11-17");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Due" })).toBeNull();
    expect(row(panel, "Due")).toHaveFocus();
  });

  it("Due: the shortcuts and a click outside", async () => {
    const { store, panel } = await open((s) => s.addTask({ title: "Review", due: "2026-11-09" }));
    await userEvent.click(row(panel, "Due"));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Due" })).getByRole("button", { name: "Tomorrow" }));
    expect(store.getState().tasks[0]!.due).toBe("2026-11-08");
    expect(screen.queryByRole("dialog", { name: "Due" })).toBeNull();
    await userEvent.click(row(panel, "Due"));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Due" })).getByRole("button", { name: "No date" }));
    expect(store.getState().tasks[0]!.due).toBeNull();
    await userEvent.click(row(panel, "Due"));
    await userEvent.click(within(panel).getByRole("textbox", { name: "Title" }));
    expect(screen.queryByRole("dialog", { name: "Due" })).toBeNull();
  });

  it("Priority uses words and applies at once", async () => {
    const { store, panel } = await open((s) => s.addTask({ title: "Review" }));
    await userEvent.click(row(panel, "Priority"));
    const menu = within(screen.getByRole("dialog", { name: "Priority" }));
    expect(menu.getAllByRole("menuitemradio").map((o) => o.textContent)).toEqual(["None", "Low", "Medium", "High"]);
    await userEvent.click(menu.getByRole("menuitemradio", { name: "High" }));
    expect(store.getState().tasks[0]!.priority).toBe("high");
    expect(row(panel, "Priority")).toHaveTextContent("High");
    expect(row(panel, "Priority")).toHaveFocus();
  });

  it("List searches, moves to No list, and makes a new list", async () => {
    const { store, panel } = await open((s) => {
      s.addList("Work", "c1");
      s.addList("Home", "c2");
      s.addTask({ title: "Review" });
    });
    await userEvent.click(row(panel, "List"));
    const pop = screen.getByRole("dialog", { name: "List" });
    await userEvent.type(within(pop).getByRole("textbox", { name: "Search lists" }), "ho");
    expect(within(pop).queryByRole("menuitemradio", { name: "Work" })).toBeNull();
    await userEvent.click(within(pop).getByRole("menuitemradio", { name: "Home" }));
    expect(store.getState().tasks[0]!.listId).toBe(store.getState().lists.find((l) => l.name === "Home")!.id);
    await userEvent.click(row(panel, "List"));
    await userEvent.click(within(screen.getByRole("dialog", { name: "List" })).getByRole("menuitemradio", { name: "New list…" }));
    await userEvent.type(screen.getByRole("textbox", { name: "New list name" }), "Errands{Enter}");
    const errands = store.getState().lists.find((l) => l.name === "Errands")!;
    expect(store.getState().tasks[0]!.listId).toBe(errands.id);
    await userEvent.click(row(panel, "List"));
    await userEvent.click(within(screen.getByRole("dialog", { name: "List" })).getByRole("menuitemradio", { name: "No list" }));
    expect(store.getState().tasks[0]!.listId).toBe(store.getState().lists.find((l) => l.isInbox)!.id);
  });

  it("Repeat: Every weekday, and Custom… opens the recurrence dialog", async () => {
    const { store, panel } = await open((s) => s.addTask({ title: "Review", due: "2026-11-09" }));
    await userEvent.click(row(panel, "Repeat"));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Repeat" })).getByRole("menuitemradio", { name: "Every weekday" }));
    expect(store.getState().tasks[0]!.repeat!.repeat.weekdays).toHaveLength(5);
    expect(row(panel, "Repeat")).toHaveTextContent("Every weekday");
    await userEvent.click(row(panel, "Repeat"));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Repeat" })).getByRole("menuitemradio", { name: "Custom…" }));
    const dialogs = screen.getAllByRole("dialog", { name: "Repeat" });
    const custom = dialogs.find((d) => within(d).queryByRole("spinbutton", { name: "Every" }))!;
    expect(custom).toBeDefined();
  });

  it("Reminder: a listed time, and Custom… takes hours", async () => {
    const { store, panel } = await open((s) => s.addTask({ title: "Review", due: "2026-11-09T09:00" }));
    await userEvent.click(row(panel, "Reminder"));
    const pop = within(screen.getByRole("dialog", { name: "Reminder" }));
    expect(pop.getAllByRole("menuitemradio").map((o) => o.textContent)).toEqual(["None", "At time", "5 minutes before", "15 minutes before", "30 minutes before", "1 hour before", "1 day before", "Custom…"]);
    await userEvent.click(pop.getByRole("menuitemradio", { name: "At time" }));
    expect(store.getState().tasks[0]!.reminder).toBe(0);
    await userEvent.click(row(panel, "Reminder"));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Reminder" })).getByRole("menuitemradio", { name: "Custom…" }));
    const amount = screen.getByRole("spinbutton", { name: "Time before" });
    await userEvent.clear(amount);
    await userEvent.type(amount, "2");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Unit" }), "hours");
    await userEvent.click(screen.getByRole("button", { name: "Set" }));
    expect(store.getState().tasks[0]!.reminder).toBe(120);
    expect(row(panel, "Reminder")).toHaveTextContent("2 hours before");
  });
});

describe("event panel row popovers", () => {
  it("Calendar lists the calendars with a search, and Repeat and Reminder open the same popovers", async () => {
    const { panel } = await open(
      (s) => {
        s.addCalendar("Family", "c3");
        s.addEvent({ title: "Review", start: "2026-11-07T15:00", end: "2026-11-07T16:00" });
      },
      "/calendar",
      /Review/,
    );
    await userEvent.click(row(panel, "Calendar"));
    const pop = within(screen.getByRole("dialog", { name: "Calendar" }));
    expect(pop.getByRole("textbox", { name: "Search calendars" })).toBeInTheDocument();
    await userEvent.click(pop.getByRole("menuitemradio", { name: "Family" }));
    expect(row(panel, "Calendar")).toHaveTextContent("Family");
    await userEvent.click(row(panel, "Repeat"));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Repeat" })).getByRole("menuitemradio", { name: "Every month" }));
    expect(row(panel, "Repeat")).toHaveTextContent("Every month");
    await userEvent.click(row(panel, "Reminder"));
    expect(within(screen.getByRole("dialog", { name: "Reminder" })).getByRole("menuitemradio", { name: "At time" })).toBeInTheDocument();
  });

  it("When shows the line as text and opens the combined control with the same focus rule", async () => {
    const { store, panel } = await open(
      (s) => s.addEvent({ title: "Review", start: "2026-11-07T15:00", end: "2026-11-07T17:00" }),
      "/calendar",
      /Review/,
    );
    expect(row(panel, "When")).toHaveTextContent("Sat 7 Nov, 15:00 – 17:00");
    await userEvent.click(row(panel, "When"));
    const pop = within(screen.getByRole("dialog", { name: "When" }));
    expect(pop.getByRole("button", { name: "Saturday 7 November" })).toHaveFocus();
    await userEvent.click(pop.getByRole("button", { name: "Monday 9 November" }));
    expect(row(panel, "When")).toHaveTextContent("Mon 9 Nov, 15:00 – 17:00");
    await userEvent.click(pop.getByRole("button", { name: "Done" }));
    expect(row(panel, "When")).toHaveFocus();
    await userEvent.click(within(panel).getByRole("button", { name: "Save" }));
    expect(store.getState().events[0]).toMatchObject({ start: "2026-11-09T15:00", end: "2026-11-09T17:00" });
  });
});
