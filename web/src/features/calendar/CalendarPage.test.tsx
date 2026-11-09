import { act, render, screen, waitFor, within } from "@testing-library/react";
import { firstRunDoneForTests } from "../../test-setup";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { ClockProvider } from "../../state/clock";
import { LocalStore } from "../../data/local/LocalStore";
import { MemoryPersistence } from "../../data/local/persistence";
import { repeatEvery } from "../../core/planner/repeat";
import { viewDays, weekRange } from "./CalendarPage";

// Friday 6 November 2026, 10:00. The week is Monday 2 to Friday 6, ISO week 45.
const NOW = new Date(2026, 10, 6, 10, 0);

async function open(options: { path?: string; seed?: (store: LocalStore) => void; fetchImpl?: typeof fetch } = {}) {
  window.history.replaceState(null, "", options.path ?? "/calendar");
  const fetchImpl = options.fetchImpl ?? (() => Promise.reject(new TypeError("offline")));
  vi.stubGlobal("fetch", vi.fn(fetchImpl));
  const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => NOW, broadcast: false });
  await store.ready;
  options.seed?.(store);
  const root = document.createElement("div");
  root.id = "root";
  document.body.appendChild(root);
  render(
    <ClockProvider value={() => NOW}>
      <App store={store} />
    </ClockProvider>,
    { container: root },
  );
  return store;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  firstRunDoneForTests();
});
afterEach(() => {
  document.getElementById("root")?.remove();
  document.body.style.overflow = "";
});

const seedWeek = (s: LocalStore) => {
  s.addEvent({ title: "Team planning", start: "2026-11-06T09:00", end: "2026-11-06T11:00", place: "Room 3" });
  s.addEvent({ title: "Book club", start: "2026-11-06T10:30", end: "2026-11-06T12:00" });
  s.addEvent({ title: "Lunch with Maya", start: "2026-11-05T13:00", end: "2026-11-05T14:00" });
  s.addEvent({ title: "Maya’s birthday", allDay: true, start: "2026-11-02", end: "2026-11-02" });
  s.addTask({ title: "Prepare the launch slides", due: "2026-11-05" });
  s.addTask({ title: "Book the dentist", due: "2026-11-30" });
};

describe("Week view", () => {
  it("places events by time, overlaps side by side with an amber note, and counts them", async () => {
    await open({ seed: seedWeek });
    expect(screen.getByRole("heading", { level: 1, name: "November 2026" })).toBeInTheDocument();
    expect(screen.getByText("Week 45")).toBeInTheDocument();
    expect(Array.from(document.querySelectorAll(".dh")).map((d) => d.textContent)).toEqual(["Mon 2", "Tue 3", "Wed 4", "Thu 5", "Fri 6", "Sat 7", "Sun 8"]);

    const planning = screen.getByRole("button", { name: /Team planning/ });
    const club = screen.getByRole("button", { name: /Book club/ });
    expect(planning).toHaveClass("clash");
    expect(club).toHaveClass("clash");
    expect(club).toHaveTextContent("overlaps");
    expect(screen.getByRole("button", { name: /Lunch with Maya/ })).not.toHaveClass("clash");
    // 09:00 is 9 hours down at 52px an hour; side by side takes half the column each.
    expect(planning.style.top).toBe(`${9 * 52}px`);
    expect(planning.style.width).toContain("50%");
    expect(club.style.left).toContain("50%");

    const side = screen.getByRole("complementary", { name: "This week" });
    expect(within(side).getByText("Events").nextSibling).toHaveTextContent("4");
    expect(within(side).queryByText("Overlaps")).toBeNull(); // the frame has Events only (Planner Designs v49 calendar-week)
    expect(within(side).getByText("Prepare the launch slides")).toBeInTheDocument();
    expect(within(side).queryByText("Book the dentist")).not.toBeInTheDocument();
  });

  it("Due this week lists the late tasks and today's, and says \"1 day late\" for a late one", async () => {
    await open({
      seed: (s) => {
        s.addTask({ title: "Late one", due: "2026-11-05" });
        s.addTask({ title: "Later", due: "2026-11-03" });
        s.addTask({ title: "Today at noon", due: "2026-11-06T12:00" });
      },
    });
    const side = within(screen.getByRole("complementary", { name: "This week" }));
    expect(side.getByText("1 day late")).toBeInTheDocument();
    expect(side.getByText("3 days late")).toBeInTheDocument();
    expect(side.getByText("Today 12:00")).toBeInTheDocument();
    expect(side.queryByText(/Overdue/)).toBeNull();
    expect(side.getByText("Today at noon")).toBeInTheDocument();
  });

  it("the Day and Agenda toolbars have the range between the arrows, as Week does", async () => {
    await open({ seed: seedWeek });
    const range = () => document.querySelector(".ph .range")?.textContent;
    expect(range()).toBe("2 – 8 Nov");
    await userEvent.click(screen.getByRole("radio", { name: "Day" }));
    expect(range()).toBe("Fri 6 Nov");
    await userEvent.click(screen.getByRole("radio", { name: "Agenda" }));
    expect(range()).toBe("Fri 6 – Thu 12 Nov");
    await userEvent.click(screen.getByRole("radio", { name: "Month" }));
    expect(range()).toBeUndefined();
  });

  it("Day lists the tasks of the day with a time first, by time, then the ones with only a date", async () => {
    await open({
      path: "/calendar",
      seed: (s) => {
        s.addTask({ title: "Date only", due: "2026-11-06" });
        s.addTask({ title: "Evening", due: "2026-11-06T17:00" });
        s.addTask({ title: "Noon", due: "2026-11-06T12:00" });
      },
    });
    await userEvent.click(screen.getByRole("radio", { name: "Day" }));
    const side = screen.getByRole("complementary", { name: "Tasks today" });
    expect(Array.from(side.querySelectorAll(".row .what")).map((e) => e.textContent)).toEqual(["Noon", "Evening", "Date only"]);
  });

  it("shows an all-day row and the red current-time line in today's column only", async () => {
    await open({ seed: seedWeek });
    const chip = screen.getByRole("button", { name: "Maya’s birthday" });
    expect(chip.closest(".adc")).not.toBeNull();
    const now = screen.getByTestId("now");
    expect(now.parentElement).toHaveAttribute("data-day", "2026-11-06");
    expect(now.style.top).toBe(`${(10 * 60 * 52) / 60}px`);
    expect(screen.getAllByTestId("now")).toHaveLength(1);
  });

  it("moves with the arrows and Today", async () => {
    await open({ seed: seedWeek });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Week 46")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Team planning/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Week 44")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByText("Week 45")).toBeInTheDocument();
  });

  it("switches to the Day view", async () => {
    await open({ seed: seedWeek });
    await userEvent.click(screen.getByRole("radio", { name: "Day" }));
    expect(screen.getByRole("heading", { level: 1, name: "Friday 6 November" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Team planning/ })).toHaveTextContent("09:00 to 11:00 · Room 3");
  });

  it("switches to the Agenda view", async () => {
    await open({ seed: seedWeek });
    await userEvent.click(screen.getByRole("radio", { name: "Agenda" }));
    expect(screen.getByText("Today · Fri 6")).toBeInTheDocument();
    expect(screen.getByText("Room 3")).toBeInTheDocument(); // the place alone, not "Room 3 · 2h"
    expect(screen.queryByText(/·\s*2h/)).toBeNull();
  });

  it("shows the whole week by default, and Monday to Friday when asked", async () => {
    await open({ seed: seedWeek });
    expect(document.querySelectorAll(".dh")).toHaveLength(7);
    document.getElementById("root")?.remove();
    localStorage.setItem("orbyn-planner.prefs", JSON.stringify({ weekStart: "mon", weekDays: 5 }));
    await open({ seed: seedWeek });
    expect(Array.from(document.querySelectorAll(".dh")).map((d) => d.textContent)).toEqual(["Mon 2", "Tue 3", "Wed 4", "Thu 5", "Fri 6"]);
  });
});

describe("Day, Month and Agenda", () => {
  it("Day lists the day's tasks and all-day events beside the grid", async () => {
    await open({
      seed: (s) => {
        s.addTask({ title: "Send the brief", due: "2026-11-06T12:00" });
        s.addEvent({ title: "Family day", allDay: true, start: "2026-11-06", end: "2026-11-06" });
      },
    });
    await userEvent.click(screen.getByRole("radio", { name: "Day" }));
    const side = screen.getByRole("complementary", { name: "Tasks today" });
    expect(within(side).getByText("Send the brief")).toBeInTheDocument();
    expect(within(side).getByRole("button", { name: "Family day" })).toBeInTheDocument();
  });

  it("Month shows events in their cells, and a day number opens that day", async () => {
    await open({ seed: seedWeek });
    await userEvent.click(screen.getByRole("radio", { name: "Month" }));
    const cell = document.querySelector('[data-day="2026-11-06"]') as HTMLElement;
    expect(within(cell).getByRole("button", { name: "Team planning" })).toBeInTheDocument();
    expect(cell).toHaveClass("today");
    await userEvent.click(within(cell).getByRole("button", { name: "6 Friday" }));
    expect(screen.getByRole("heading", { level: 1, name: "Friday 6 November" })).toBeInTheDocument();
  });

  it("Month shows the days before the first with their numbers, and leaves the days after the last empty", async () => {
    await open({ seed: seedWeek });
    await userEvent.click(screen.getByRole("radio", { name: "Month" }));
    // November 2026 runs Sun 1 to Mon 30: the week of Mon 26 Oct leads in with numbers, and Tue 1 to Sun 6 Dec are blank.
    expect(document.querySelector('[data-day="2026-10-26"] .n')?.textContent).toBe("26");
    expect(document.querySelector('[data-day="2026-11-30"] .n')?.textContent).toBe("30");
    expect(document.querySelector('[data-day="2026-12-01"]')).toBeNull();
    const after = Array.from(document.querySelectorAll(".md.after"));
    expect(after).toHaveLength(6);
    for (const cell of after) {
      expect(cell.textContent).toBe("");
      expect(cell).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("Month's arrow keys stop at the last day of the month", async () => {
    await open({ path: "/calendar?month=2026-11" });
    await userEvent.click(screen.getByRole("radio", { name: "Month" }));
    const last = document.querySelector('[data-day="2026-11-30"]') as HTMLElement;
    last.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(last);
    expect(last.tabIndex).toBe(0); // the Tab stop did not move to a blank cell
  });

  it("Month starts weeks on Sunday when asked", async () => {
    localStorage.setItem("orbyn-planner.prefs", JSON.stringify({ weekStart: "sun", weekDays: 5 }));
    await open();
    await userEvent.click(screen.getByRole("radio", { name: "Month" }));
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)[0]).toBe("Sun");
  });

  it("Agenda rows repeat every 52 px, with the first 12 px under its header", async () => {
    const nodeFs = "node:fs";
    const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
    const css = fs.readFileSync(`${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src/styles/app.css`, "utf8");
    const i = css.indexOf(".agenda-rows {");
    expect(i).toBeGreaterThan(-1);
    expect(css.slice(i, css.indexOf("}", i))).toMatch(/gap: var\(--sp-14\); margin-top: var\(--sp-12\)/);
    await open({ seed: (s) => s.addEvent({ title: "Soon", start: "2026-11-06T09:00", end: "2026-11-06T10:00" }) });
    await userEvent.click(screen.getByRole("radio", { name: "Agenda" }));
    expect(document.querySelector("ul.agenda-rows")).not.toBeNull();
  });

  it("Agenda rows say the place, or without one the length, never both, and nothing for an all-day event", async () => {
    await open({
      seed: (s) => {
        s.addEvent({ title: "With place", start: "2026-11-06T09:00", end: "2026-11-06T10:00", place: "Room 3" });
        s.addEvent({ title: "No place", start: "2026-11-06T11:00", end: "2026-11-06T12:00" });
        s.addEvent({ title: "Half hour", start: "2026-11-06T13:00", end: "2026-11-06T13:30" });
        s.addEvent({ title: "Birthday", allDay: true, start: "2026-11-06", end: "2026-11-06", place: "Home" });
      },
    });
    await userEvent.click(screen.getByRole("radio", { name: "Agenda" }));
    const meta = (title: string) => screen.getByRole("button", { name: title }).closest("li")!.querySelector(".meta")!.textContent;
    expect(meta("With place")).toBe("Room 3");
    expect(meta("No place")).toBe("1 h"); // durations are written with a space: 1 h, 30 min (Planner Designs v55)
    expect(meta("Half hour")).toBe("30 min");
    expect(meta("Birthday")).toBe("");
  });

  it("Agenda says when nothing is coming up", async () => {
    await open();
    await userEvent.click(screen.getByRole("radio", { name: "Agenda" }));
    expect(screen.getByRole("heading", { name: "Nothing coming up" })).toBeInTheDocument();
  });
});

describe("Event panel", () => {
  it("opens from an event, edits a plain event and saves", async () => {
    const store = await open({ seed: seedWeek });
    await userEvent.click(screen.getByRole("button", { name: /Lunch with Maya/ }));
    const panel = screen.getByRole("complementary", { name: "Event" });
    // Paste instead of typing a key at a time: the test is about what is saved, and per-key typing made it slow under load.
    const title = within(panel).getByRole("textbox", { name: "Title" });
    await userEvent.clear(title);
    await userEvent.click(title);
    await userEvent.paste("Lunch with Maya and Jo");
    await userEvent.click(within(panel).getByRole("textbox", { name: "Where" }));
    await userEvent.paste("Cafe");
    await userEvent.click(within(panel).getByRole("button", { name: /^Reminder,/ }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "30 minutes before" }));
    const person = within(panel).getByRole("textbox", { name: "Add a person" });
    await userEvent.click(person);
    await userEvent.paste("jo@example.com");
    await userEvent.keyboard("{Enter}");
    await userEvent.click(within(panel).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(store.getState().events.find((e) => e.title.startsWith("Lunch"))).toMatchObject({
        title: "Lunch with Maya and Jo",
        place: "Cafe",
        reminder: 30,
        people: [{ email: "jo@example.com", response: "none" }],
      }),
    );
  });

  it("an end time before the start ends the next day, so an event cannot end before it starts", async () => {
    await open({ seed: seedWeek });
    await userEvent.click(screen.getByRole("button", { name: /Lunch with Maya/ }));
    const panel = screen.getByRole("complementary", { name: "Event" });
    await userEvent.click(within(panel).getByRole("button", { name: /^When,/ }));
    const end = screen.getByRole("textbox", { name: "End time" });
    await userEvent.clear(end);
    await userEvent.type(end, "12:00{Enter}");
    expect(within(panel).getByRole("button", { name: /^When,/ })).toHaveTextContent("Thu 5 Nov, 13:00 – Fri 6 Nov, 12:00");
    expect(within(panel).getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("asks which events an edit reaches when the event repeats", async () => {
    const store = await open({
      seed: (s) => s.addEvent({ title: "Stand-up", start: "2026-11-02T09:00", end: "2026-11-02T09:30", repeat: repeatEvery("weekly") }),
    });
    await userEvent.click(screen.getByRole("button", { name: /Stand-up/ })); // Monday 2 November
    // Go to this Friday's week-mate: open the occurrence on Monday 2, then change the title.
    const panel = screen.getByRole("complementary", { name: "Event" });
    const title = within(panel).getByRole("textbox", { name: "Title" });
    await userEvent.clear(title);
    await userEvent.type(title, "Stand-up (new room)");
    await userEvent.click(within(panel).getByRole("button", { name: "Save" }));
    const scope = screen.getByRole("dialog", { name: "Change a repeating event" });
    // Planner Designs v61 p-event-recurring: three rows, the first chosen, with Cancel and Save; no line about guests.
    expect(within(scope).getAllByRole("radio").map((r) => r.querySelector(".scope-label")?.textContent)).toEqual(["Only this event", "This and following events", "All events in the series"]);
    expect(within(scope).getAllByRole("radio").map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
    expect(within(scope).getByText("Mon 2 Nov and every later one")).toBeInTheDocument();
    expect(within(scope).getByText("Every week, from Mon 2 Nov")).toBeInTheDocument();
    expect(scope).not.toHaveTextContent(/guest/i);
    await userEvent.click(within(scope).getByRole("button", { name: "Save" })); // the first row is chosen
    const events = store.getState().events;
    expect(events).toHaveLength(2);
    expect(events.find((e) => e.repeat)!.repeat!.skipped).toEqual(["2026-11-02"]);
    expect(events.find((e) => !e.repeat)).toMatchObject({ title: "Stand-up (new room)", start: "2026-11-02T09:00" });
  });

  it("All events changes the series, and Cancel changes nothing", async () => {
    const store = await open({
      seed: (s) => s.addEvent({ title: "Stand-up", start: "2026-11-02T09:00", end: "2026-11-02T09:30", repeat: repeatEvery("weekly") }),
    });
    await userEvent.click(screen.getByRole("button", { name: /Stand-up/ }));
    let panel = screen.getByRole("complementary", { name: "Event" });
    await userEvent.type(within(panel).getByRole("textbox", { name: "Where" }), "Room 9");
    await userEvent.click(within(panel).getByRole("button", { name: "Save" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(store.getState().events[0]!.place).toBe("");
    await userEvent.click(within(panel).getByRole("button", { name: "Save" }));
    await userEvent.click(screen.getByRole("radio", { name: /^All events in the series/ }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Change a repeating event" })).getByRole("button", { name: "Save" }));
    expect(store.getState().events[0]!.place).toBe("Room 9");
    panel = await screen.findByRole("complementary", { name: "Event" });
    expect(within(panel).getByRole("textbox", { name: "Where" })).toHaveValue("Room 9");
  });

  it("deletes with an Undo, and asks the scope for a repeating event", async () => {
    const store = await open({
      seed: (s) => {
        s.addEvent({ title: "Stand-up", start: "2026-11-02T09:00", end: "2026-11-02T09:30", repeat: repeatEvery("daily") });
        s.addEvent({ title: "One-off", start: "2026-11-05T15:00", end: "2026-11-05T16:00" });
      },
    });
    await userEvent.click(screen.getByRole("button", { name: /One-off/ }));
    await userEvent.click(within(screen.getByRole("complementary", { name: "Event" })).getByRole("button", { name: "Delete" }));
    expect(screen.queryByRole("button", { name: /One-off/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByRole("button", { name: /One-off/ })).toBeInTheDocument();

    const tuesday = document.querySelector('[data-day="2026-11-03"]') as HTMLElement;
    await userEvent.click(within(tuesday).getByRole("button", { name: /Stand-up/ }));
    await userEvent.click(within(screen.getByRole("complementary", { name: "Event" })).getByRole("button", { name: "Delete" }));
    const ask = screen.getByRole("dialog", { name: "Delete “Stand-up”?" }); // Planner Designs v61 p-event-delete
    expect(within(ask).getAllByRole("radio")).toHaveLength(3);
    expect(ask).toHaveTextContent("Deleted events are kept for 30 days in Completed and deleted.");
    expect(ask).not.toHaveTextContent(/guest/i);
    expect(within(ask).getByRole("button", { name: "Delete event" })).toHaveClass("danger");
    await userEvent.click(within(ask).getByRole("button", { name: "Delete event" })); // the first row, Only this event, is chosen
    expect(within(document.querySelector('[data-day="2026-11-03"]') as HTMLElement).queryByRole("button", { name: /Stand-up/ })).not.toBeInTheDocument();
    expect(within(document.querySelector('[data-day="2026-11-04"]') as HTMLElement).getByRole("button", { name: /Stand-up/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(within(document.querySelector('[data-day="2026-11-03"]') as HTMLElement).getByRole("button", { name: /Stand-up/ })).toBeInTheDocument();
    expect(store.getState().events.find((e) => e.title === "Stand-up")!.deletedAt).toBeNull();
  });

  it("duplicates an event", async () => {
    const store = await open({ seed: seedWeek });
    await userEvent.click(screen.getByRole("button", { name: /Lunch with Maya/ }));
    await userEvent.click(within(screen.getByRole("complementary", { name: "Event" })).getByRole("button", { name: "Duplicate" }));
    expect(store.getState().events.filter((e) => e.title === "Lunch with Maya")).toHaveLength(2);
  });
});

describe("New event", () => {
  it("Escape closes the When calendar first and the dialog only on the next press", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "New event" }));
    const dialog = screen.getByRole("dialog", { name: "New event" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Open the calendar" }));
    expect(within(dialog).getByRole("dialog", { name: "When" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(within(dialog).queryByRole("dialog", { name: "When" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "New event" })).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox", { name: "When" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "New event" })).toBeNull();
  });

  it("adds an event with its calendar, repeat, reminder and people", async () => {
    const store = await open();
    await userEvent.click(screen.getByRole("button", { name: "New event" }));
    const dialog = screen.getByRole("dialog", { name: "New event" });
    expect(within(dialog).getByRole("button", { name: "Add event" })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText("Title"), "Dentist");
    await userEvent.clear(within(dialog).getByLabelText("When"));
    await userEvent.type(within(dialog).getByLabelText("When"), "2026-11-13 15:00-15:45");
    await userEvent.selectOptions(within(dialog).getByLabelText("Repeat"), "monthly");
    await userEvent.selectOptions(within(dialog).getByLabelText("Reminder"), "60");
    await userEvent.type(within(dialog).getByLabelText("Invite people"), "maya@example.com, alex@example.com");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add event" }));
    expect(store.getState().events[0]).toMatchObject({
      title: "Dentist",
      start: "2026-11-13T15:00",
      end: "2026-11-13T15:45",
      reminder: 60,
      repeat: { start: "2026-11-13", repeat: { frequency: "monthly" } },
    });
    expect(store.getState().events[0]!.people.map((p) => p.email)).toEqual(["maya@example.com", "alex@example.com"]);
  });
});

/** Manage calendars in the toolbar popover opens Settings › Calendars. */
async function openManage() {
  await userEvent.click(screen.getByRole("button", { name: "Calendars" }));
  await userEvent.click(screen.getByRole("menuitem", { name: /Manage calendars/ }));
  await screen.findByRole("list", { name: "Calendars" });
}

describe("Calendar toolbar (Planner Designs v47)", () => {
  it("is the same in Month, Week, Day and Agenda: arrows, the view switch, Calendars, then New event, and nothing else", async () => {
    await open();
    for (const view of ["Month", "Week", "Day", "Agenda"]) {
      await userEvent.click(screen.getByRole("radio", { name: view }));
      expect(screen.getByRole("radio", { name: view })).toBeChecked();
      const acts = document.querySelector(".ph .acts")!;
      const order = [...acts.querySelectorAll("button, [role=radiogroup]")].filter((e) => !e.closest("[role=radiogroup]") || e.getAttribute("role") === "radiogroup").map((e) => e.getAttribute("aria-label") ?? e.textContent?.trim());
      expect(order.filter((x) => x !== "Today"), view).toEqual(["Previous", "Next", "View", "Calendars", "New event"]);
      expect(within(acts as HTMLElement).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Month", "Week", "Day", "Agenda"]);
    }
  });

  it("the Today button sits between the arrows and only shows when another period is shown", async () => {
    await open();
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    const buttons = [...document.querySelectorAll(".ph .acts > button")].map((b) => b.getAttribute("aria-label") ?? b.textContent?.trim());
    expect(buttons.slice(0, 3)).toEqual(["Previous", "Today", "Next"]);
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
  });

  it("Calendars keeps its name and a tooltip when only its icon shows", async () => {
    await open();
    const button = screen.getByRole("button", { name: "Calendars" });
    expect(button).toHaveAttribute("title", "Calendars");
    expect(button.querySelector(".lbl")).not.toBeNull();
  });
});

describe("Calendars popover", () => {
  it("lists the calendars with a checkbox each; unchecking one hides its events from every view", async () => {
    const store = await open({ seed: seedWeek });
    const button = screen.getByRole("button", { name: "Calendars" });
    await userEvent.click(button);
    const menu = screen.getByRole("menu", { name: "Calendars" });
    expect(within(menu).getByRole("menuitemcheckbox", { name: "Personal" })).toBeChecked();
    expect(within(menu).getByRole("menuitem", { name: /Manage calendars/ })).toBeInTheDocument();
    await userEvent.click(within(menu).getByRole("menuitemcheckbox", { name: "Personal" }));
    expect(store.getState().calendars[0]!.visible).toBe(false);
    expect(within(menu).getByRole("menuitemcheckbox", { name: "Personal" })).not.toBeChecked();
    expect(screen.queryByRole("button", { name: /Team planning/ })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu", { name: "Calendars" })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("marks a subscribed calendar, and a click outside closes it", async () => {
    const store = await open();
    store.addCalendar("Library events", "c4");
    const feed = store.getState().calendars.find((c) => c.name === "Library events")!;
    store.updateCalendar(feed.id, {});
    await userEvent.click(screen.getByRole("button", { name: "Calendars" }));
    const menu = screen.getByRole("menu", { name: "Calendars" });
    expect(within(menu).getAllByRole("menuitemcheckbox").map((i) => i.textContent)).toContain("Library events");
    await userEvent.click(document.body);
    expect(screen.queryByRole("menu", { name: "Calendars" })).not.toBeInTheDocument();
  });
});

describe("Calendars (in Settings)", () => {
  const feedBody = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20261106", "SUMMARY:Bonfire night", "END:VEVENT", "END:VCALENDAR"].join("\r\n");

  it("hides a calendar's events, renames it and adds another", async () => {
    const store = await open({ seed: seedWeek });
    await openManage();
    const dialog = screen.getByRole("main");
    await userEvent.click(within(dialog).getByRole("button", { name: "Hide Personal" }));
    expect(store.getState().calendars[0]!.visible).toBe(false);
    await userEvent.click(within(dialog).getByRole("button", { name: "Rename" }));
    const name = within(dialog).getByRole("textbox", { name: "Calendar name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Home{Enter}");
    expect(store.getState().calendars[0]!.name).toBe("Home");
    await userEvent.click(within(dialog).getByRole("button", { name: "New calendar" }));
    await userEvent.type(within(dialog).getByLabelText("Name"), "Work");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add calendar" }));
    expect(store.getState().calendars.map((c) => c.name)).toEqual(["Home", "Work"]);
  });

  it("subscribes by link and shows the feed's events read-only", async () => {
    const store = await open({
      fetchImpl: async (url) => (String(url).endsWith(".ics") ? new Response(feedBody) : Promise.reject(new TypeError("offline"))),
    });
    await openManage();
    const dialog = screen.getByRole("main");
    await userEvent.click(within(dialog).getByRole("button", { name: "Subscribe to a calendar" }));
    await userEvent.type(within(dialog).getByLabelText("Name"), "Holidays");
    await userEvent.type(within(dialog).getByLabelText("Subscribe by link"), "webcal://example.com/holidays.ics");
    await userEvent.click(within(dialog).getByRole("button", { name: "Subscribe" }));
    await waitFor(() => expect(store.getState().events.map((e) => e.title)).toEqual(["Bonfire night"]));
    expect(store.getState().events[0]!.readOnly).toBe(true);
    expect(vi.mocked(fetch).mock.calls.some(([u]) => u === "https://example.com/holidays.ics")).toBe(true);
    // A subscribed calendar takes one of the four calendar colours, like any calendar, and its colour picker offers those four (Planner Designs v53).
    const feed = store.getState().calendars.find((c) => c.kind.type === "subscribed")!;
    expect(["c1", "c2", "c3", "c4"]).toContain(feed.colour);
    expect(within(await screen.findByRole("radiogroup", { name: "Colour of Holidays" })).getAllByRole("radio").map((r) => r.getAttribute("aria-label"))).toEqual(["Blue", "Green", "Purple", "Orange"]);
    await userEvent.click(within(screen.getByRole("navigation", { name: "Primary" })).getByRole("link", { name: "Calendar" }));
    await userEvent.click(await screen.findByRole("button", { name: "Bonfire night" }));
    const panel = screen.getByRole("complementary", { name: "Event" });
    expect(within(panel).getByText(/can’t be changed here/)).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("the subscribe form refuses an http:// link", async () => {
    const store = await open();
    await openManage();
    const dialog = screen.getByRole("main");
    await userEvent.click(within(dialog).getByRole("button", { name: "Subscribe to a calendar" }));
    await userEvent.type(within(dialog).getByLabelText("Name"), "Holidays");
    await userEvent.type(within(dialog).getByLabelText("Subscribe by link"), "http://example.com/h.ics");
    await userEvent.click(within(dialog).getByRole("button", { name: "Subscribe" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Use an https:// link");
    expect(store.getState().calendars).toHaveLength(1);
  });

  it("a feed that blocks the browser shows a red Retry and says why", async () => {
    let allow = false;
    const store = await open({
      fetchImpl: async (url) => {
        if (!String(url).endsWith(".ics")) throw new TypeError("offline");
        if (!allow) throw new TypeError("Failed to fetch");
        return new Response(feedBody);
      },
    });
    await openManage();
    const dialog = screen.getByRole("main");
    await userEvent.click(within(dialog).getByRole("button", { name: "Subscribe to a calendar" }));
    await userEvent.type(within(dialog).getByLabelText("Name"), "Holidays");
    await userEvent.type(within(dialog).getByLabelText("Subscribe by link"), "https://example.com/h.ics");
    await userEvent.click(within(dialog).getByRole("button", { name: "Subscribe" }));
    const retry = await within(dialog).findByRole("button", { name: "Couldn’t refresh · Retry" });
    expect(retry).toHaveClass("red-text");
    expect(within(dialog).getByText(/doesn’t allow browser access yet/)).toBeInTheDocument();
    allow = true;
    await userEvent.click(retry);
    await waitFor(() => expect(store.getState().events.map((e) => e.title)).toEqual(["Bonfire night"]));
    expect(within(dialog).queryByRole("button", { name: /Retry/ })).not.toBeInTheDocument();
  });
});

describe("Settings · Calendars", () => {
  it("lists the calendars and lets the week be set", async () => {
    await open({ path: "/settings" });
    expect(screen.getByRole("radio", { name: "7 days" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "5 days" }));
    expect(JSON.parse(localStorage.getItem("orbyn-planner.prefs")!)).toMatchObject({ weekDays: 5 });
    await userEvent.click(screen.getByRole("button", { name: "Calendars" }));
    expect(screen.getByRole("list", { name: "Calendars" })).toHaveTextContent("Personal");
    expect(screen.getByRole("button", { name: "Subscribe to a calendar" })).toBeInTheDocument();
  });
});

describe("Today with events", () => {
  it("lists today's events with its tasks in time order", async () => {
    await open({
      path: "/today",
      seed: (s) => {
        s.addEvent({ title: "Team planning", start: "2026-11-06T09:00", end: "2026-11-06T11:00", place: "Room 3" });
        s.addEvent({ title: "Book club", start: "2026-11-06T15:00", end: "2026-11-06T17:00" });
        s.addTask({ title: "Send the brief", due: "2026-11-06T11:30" });
        s.addTask({ title: "Pick up dry cleaning", due: "2026-11-06" });
        s.addEvent({ title: "Family day", allDay: true, start: "2026-11-06", end: "2026-11-06" });
      },
    });
    const rows = Array.from(document.querySelectorAll(".row .what")).map((el) => el.textContent);
    // All-day events sit in their own group at the top; then the timed ones and the tasks in time order.
    expect(rows).toEqual(["Family day", "Team planning", "Send the brief", "Book club", "Pick up dry cleaning"]);
    expect(screen.getByText("Room 3")).toBeInTheDocument(); // the place, no "Event" word
    expect(screen.getByText(/3 events, 2 tasks/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Book club" }));
    expect(screen.getByRole("complementary", { name: "Event" })).toBeInTheDocument();
  });
});

describe("after Undo of a deleted event", () => {
  it("focus returns to the restored event", async () => {
    await open({ seed: seedWeek });
    await userEvent.click(screen.getByRole("button", { name: /Lunch with Maya/ }));
    await userEvent.click(within(screen.getByRole("complementary", { name: "Event" })).getByRole("button", { name: "Delete" }));
    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
    const back = await screen.findByRole("button", { name: /Lunch with Maya/ });
    await waitFor(() => expect(back).toHaveFocus());
  });
});

describe("the week: the full week from the week-start setting, never ending on today", () => {
  const week = (anchor: string, weekDays: 5 | 7 = 7, weekStart: "mon" | "sun" = "mon") => viewDays("week", anchor, weekStart, weekDays);
  it("seven days Monday to Sunday by default, whichever day of the week is the anchor", () => {
    for (const anchor of ["2026-11-02", "2026-11-04", "2026-11-07", "2026-11-08"]) {
      expect(week(anchor)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
    }
  });
  it("Monday to Friday when only weekdays are shown, even when today is the Saturday", () => {
    expect(week("2026-11-07", 5)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]);
    expect(week("2026-11-09", 5)[0]).toBe("2026-11-09");
  });
  it("a Sunday start shows Sunday to Saturday, and five days from a Sunday start are its first five", () => {
    expect(week("2026-11-07", 7, "sun")).toEqual(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"]);
    expect(week("2026-11-07", 5, "sun")).toHaveLength(5);
    expect(week("2026-11-07", 5, "sun")[0]).toBe("2026-11-01");
  });
  it("the date range names the whole week, across a month too", () => {
    expect(weekRange("2026-11-04", "mon")).toBe("2 – 8 Nov");
    expect(weekRange("2026-11-30", "mon")).toBe("30 Nov – 6 Dec");
    expect(weekRange("2026-11-04", "sun")).toBe("1 – 7 Nov");
  });
});

describe("the week header, today's column and the arrow keys", () => {
  const openAt = async (now: Date, prefs?: object) => {
    if (prefs) localStorage.setItem("orbyn-planner.prefs", JSON.stringify(prefs));
    window.history.replaceState(null, "", "/calendar");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("offline"))));
    const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => now, broadcast: false });
    await store.ready;
    render(
      <ClockProvider value={() => now}>
        <App store={store} />
      </ClockProvider>,
    );
  };
  const saturday = new Date(2026, 10, 7, 10, 0);
  const dh = () => Array.from(document.querySelectorAll(".dh")).map((d) => d.textContent);

  it("seven columns Mon 2 to Sun 8, today has the pill and a soft fill, the range is beside the arrows, and no Today button on the current week", async () => {
    await openAt(saturday);
    expect(dh()).toEqual(["Mon 2", "Tue 3", "Wed 4", "Thu 5", "Fri 6", "Sat 7", "Sun 8"]);
    expect(document.querySelector(".dh.today")).toHaveTextContent("Sat 7");
    expect(document.querySelector('.dcol.today')).toHaveAttribute("data-day", "2026-11-07");
    expect(document.querySelectorAll(".dcol.today")).toHaveLength(1);
    expect(screen.getByText("2 – 8 Nov")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
  });

  it("weekdays only: Mon to Fri, no column marked, no current-time line, no Today button (this is the current week)", async () => {
    await openAt(saturday, { weekStart: "mon", weekDays: 5 });
    expect(dh()).toEqual(["Mon 2", "Tue 3", "Wed 4", "Thu 5", "Fri 6"]);
    expect(document.querySelector(".dh.today")).toBeNull();
    expect(document.querySelector(".dcol.today")).toBeNull();
    expect(screen.queryByTestId("now")).toBeNull();
    expect(screen.getByText("2 – 8 Nov")).toBeInTheDocument(); // the range is the whole week
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
  });

  it("another week: the arrows step a week, Today appears and jumps back, and nothing is marked as today", async () => {
    await openAt(saturday);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(dh()).toEqual(["Mon 9", "Tue 10", "Wed 11", "Thu 12", "Fri 13", "Sat 14", "Sun 15"]);
    expect(screen.getByText("9 – 15 Nov")).toBeInTheDocument();
    expect(screen.getByText("Week 46")).toBeInTheDocument();
    expect(document.querySelector(".dh.today")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByText("2 – 8 Nov")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
  });

  it("the left and right arrow keys step a week when nothing has focus, and do nothing while something does", async () => {
    await openAt(saturday);
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByText("9 – 15 Nov")).toBeInTheDocument();
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByText("26 Oct – 1 Nov")).toBeInTheDocument();
    screen.getByRole("button", { name: "Next" }).focus(); // something has focus
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByText("26 Oct – 1 Nov")).toBeInTheDocument();
  });
});

describe("keyboard", () => {
  it("Month: days are in rows, arrows move between them, Enter adds an event on that day", async () => {
    await open({ seed: seedWeek });
    await userEvent.click(screen.getByRole("radio", { name: "Month" }));
    const grid = screen.getByRole("grid", { name: "Month" });
    expect(within(grid).getAllByRole("row").length).toBeGreaterThanOrEqual(6);
    expect(within(within(grid).getAllByRole("row")[1]!).getAllByRole("gridcell")).toHaveLength(7);
    const today = document.querySelector('[data-day="2026-11-06"]') as HTMLElement;
    expect(today).toHaveAttribute("tabindex", "0");
    expect(document.querySelectorAll('[role="gridcell"][tabindex="0"]')).toHaveLength(1);
    today.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.querySelector('[data-day="2026-11-07"]')).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(document.querySelector('[data-day="2026-11-14"]')).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}{ArrowUp}");
    expect(document.querySelector('[data-day="2026-11-06"]')).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}{Enter}");
    const dialog = screen.getByRole("dialog", { name: "New event" });
    expect(within(dialog).getByLabelText("When")).toHaveValue("Sat 7 Nov, 11:00 – 12:00");
  });

  it("Week: a focused hour slot takes Enter to add an event at that time", async () => {
    await open();
    const slot = document.querySelector('[data-slot="2026-11-06T14"]') as HTMLElement;
    slot.focus();
    expect(slot).toHaveAccessibleName(/Friday 6, 14:00/);
    await userEvent.keyboard("{ArrowDown}");
    expect(document.querySelector('[data-slot="2026-11-06T15"]')).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}{Enter}");
    const dialog = screen.getByRole("dialog", { name: "New event" });
    expect(within(dialog).getByLabelText("When")).toHaveValue("Thu 5 Nov, 15:00 – 16:00");
  });

  it("Week: clicking a slot also adds an event there", async () => {
    await open();
    await userEvent.click(document.querySelector('[data-slot="2026-11-04T10"]') as HTMLElement);
    expect(within(screen.getByRole("dialog", { name: "New event" })).getByLabelText("When")).toHaveValue("Wed 4 Nov, 10:00 – 11:00");
  });
});

describe("a move the repeat cannot say", () => {
  it("is explained in the panel and changes nothing", async () => {
    const store = await open({
      seed: (s) => s.addEvent({ title: "Swim", start: "2026-11-07T09:00", end: "2026-11-07T10:00", repeat: { ...repeatEvery("weekly"), interval: 2, weekdays: ["sat", "sun"] } }),
    });
    await userEvent.click(screen.getAllByRole("button", { name: /Swim/ })[0]!);
    const panel = screen.getByRole("complementary", { name: "Event" });
    await userEvent.click(within(panel).getByRole("button", { name: /^When,/ }));
    await userEvent.click(screen.getByRole("button", { name: "Sunday 8 November" }));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await userEvent.click(within(panel).getByRole("button", { name: "Save" }));
    await userEvent.click(screen.getByRole("radio", { name: /^All events in the series/ }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Change a repeating event" })).getByRole("button", { name: "Save" }));
    expect(await within(panel).findByRole("alert")).toHaveTextContent("some of its days would fall in a different week of the cycle");
    expect(store.getState().events[0]!.start).toBe("2026-11-07T09:00");
  });
});

describe("Calendar loading and sync error (Planner Designs p-cal-loading, p-cal-sync-error)", () => {
  it("loading: the header and grid are there at once, nothing shows for 400 ms, then Loading this week’s events", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      window.history.replaceState(null, "", "/calendar");
      vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
      const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => NOW });
      await store.ready;
      const notReady = { ...store.getState(), ready: false }; // one object: a new one each call would loop
      const loading = Object.assign(Object.create(store) as LocalStore, { getState: () => notReady });
      render(<ClockProvider value={() => NOW}><App store={loading} /></ClockProvider>);
      expect(screen.getByRole("button", { name: "New event" })).toBeInTheDocument(); // the header stays
      expect(screen.queryByText("Loading this week’s events")).toBeNull();
      await act(async () => void (await vi.advanceTimersByTimeAsync(450)));
      expect(screen.getByText("Loading this week’s events")).toHaveAttribute("role", "status");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a calendar from outside Orbyn that failed to sync says so with when its events are from; Try again reads it again", async () => {
    let id = "";
    await open({
      seed: (s) => {
        const c = s.addSubscription("School holidays", "c3", "https://example.com/school.ics");
        id = c.id;
        s.replaceFeedEvents(c.id, []);
        s.failSubscription(c.id, "The calendar’s server took too long to answer.");
      },
    });
    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("Couldn’t sync School holidays, a calendar from outside Orbyn. Showing what it had at 10:00.");
    expect(banner).toHaveClass("banner", "err");
    expect(within(banner).getByRole("button", { name: "Open settings" })).toBeInTheDocument();
    const fetched = vi.mocked(fetch);
    fetched.mockClear();
    await userEvent.click(within(banner).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(fetched).toHaveBeenCalledWith("https://example.com/school.ics", expect.anything()));
    expect(id).not.toBe("");
  });

  it("no banner when every calendar synced", async () => {
    await open({ seed: (s) => { const c = s.addSubscription("School holidays", "c3", "https://example.com/school.ics"); s.replaceFeedEvents(c.id, []); } });
    expect(screen.queryByText(/Couldn’t sync/)).toBeNull();
  });
});
