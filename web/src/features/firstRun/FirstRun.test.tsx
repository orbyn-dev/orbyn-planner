import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { ClockProvider } from "../../state/clock";
import { PREFS_KEY } from "../../state/prefs";
import { LocalStore } from "../../data/local/LocalStore";
import { MemoryPersistence } from "../../data/local/persistence";
import { firstRunKey } from "./useFirstRun";

const NOW = new Date(2026, 10, 7, 10, 0);

async function open(seed?: (s: LocalStore) => void, fetchImpl?: (url: string) => Promise<Response>, path = "/today") {
  window.history.replaceState(null, "", path);
  vi.stubGlobal("fetch", vi.fn((url: string) => (fetchImpl ? fetchImpl(String(url)) : Promise.reject(new TypeError("offline")))));
  const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => NOW, broadcast: false });
  await store.ready;
  seed?.(store);
  render(
    <ClockProvider value={() => NOW}>
      <App store={store} />
    </ClockProvider>,
  );
  return store;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  localStorage.removeItem(firstRunKey(null)); // first run is not marked done here
  vi.spyOn(navigator, "language", "get").mockReturnValue("en-GB"); // Monday by region
});

const welcome = () => screen.findByRole("region", { name: "Welcome to Orbyn Planner" });
const start = async () => {
  await userEvent.click(within(await welcome()).getByRole("button", { name: "Start" }));
};

describe("First run", () => {
  it("shows the welcome once, with the three steps and Skip for now and Start", async () => {
    await open();
    const card = await welcome();
    expect(within(card).getByText("Set up your week in a minute. You can change all of this later in Settings.")).toBeInTheDocument();
    expect(within(card).getAllByRole("listitem").map((l) => l.textContent)).toEqual(["Step 1When your week starts", "Step 2Add a calendar", "Step 3Make your first list"]);
  });

  it("Skip for now opens the planner with the defaults and the welcome never returns", async () => {
    const store = await open();
    await userEvent.click(within(await welcome()).getByRole("button", { name: "Skip for now" }));
    expect(await screen.findByRole("heading", { name: "Nothing planned today" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toMatchObject({ weekStart: "mon", weekDays: 7 });
    expect(localStorage.getItem(firstRunKey(null))).toBe("done");
    expect(store.getState().calendars.map((c) => c.name)).toEqual(["Personal"]);
    expect(store.getState().lists.map((l) => l.name)).toEqual(["Inbox"]);
  });

  it("it does not return on a later visit to an empty planner", async () => {
    localStorage.setItem(firstRunKey(null), "done");
    await open();
    expect(await screen.findByRole("heading", { name: "Nothing planned today" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Welcome to Orbyn Planner" })).toBeNull();
  });

  it("a planner that already holds something is marked done without being shown", async () => {
    await open((s) => s.addTask({ title: "Existing" }));
    await waitFor(() => expect(localStorage.getItem(firstRunKey(null))).toBe("done"));
    expect(screen.queryByRole("region", { name: "Welcome to Orbyn Planner" })).toBeNull();
  });

  it("step 1: Monday is preselected by region, Saturday is offered, and both choices are the Settings › Planning settings", async () => {
    await open();
    await start();
    const step = screen.getByRole("region", { name: "First run, step 1 of 3" });
    expect(within(step).getByText("Step 1 of 3")).toBeInTheDocument();
    const monday = within(step).getByRole("radio", { name: /Monday/ });
    expect(monday).toBeChecked();
    expect(monday).toHaveTextContent("Suggested for your region");
    expect(within(step).getByRole("radio", { name: /Sunday/ })).toHaveTextContent("Week 1 begins on a Sunday");
    await userEvent.click(within(step).getByRole("radio", { name: /Saturday/ }));
    await userEvent.click(within(step).getByRole("radio", { name: "Weekdays only" }));
    await userEvent.click(within(step).getByRole("button", { name: "Continue" }));
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toMatchObject({ weekStart: "sat", weekDays: 5 });
  });

  it("step 2: Create a calendar names the Personal calendar that already exists, and an empty name stops with one line", async () => {
    const store = await open();
    await start();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    const step = screen.getByRole("region", { name: "First run, step 2 of 3" });
    expect(within(step).getByRole("radio", { name: "Create a calendar" })).toBeChecked();
    expect(within(step).getByRole("radio", { name: "Subscribe to a calendar feed" })).toBeInTheDocument();
    expect(within(step).getByText("Connect Google or Outlook")).toBeInTheDocument();
    expect(within(step).getByText("Not available yet.")).toBeInTheDocument();
    const name = within(step).getByRole("textbox", { name: "Calendar name" });
    expect(name).toHaveValue("Personal");
    await userEvent.clear(name);
    await userEvent.click(within(step).getByRole("button", { name: "Continue" }));
    expect(within(step).getByRole("alert")).toHaveTextContent("Give the calendar a name.");
    expect(store.getState().calendars).toHaveLength(1); // nothing was created
    await userEvent.type(name, "Family");
    await userEvent.click(within(step).getByRole("radio", { name: "Purple" }));
    await userEvent.click(within(step).getByRole("button", { name: "Continue" }));
    expect(store.getState().calendars).toMatchObject([{ name: "Family", colour: "c3" }]);
    expect(screen.getByRole("region", { name: "First run, step 3 of 3" })).toBeInTheDocument();
  });

  it("step 2: a feed address that can't be read says so, adds nothing and keeps Continue available", async () => {
    const store = await open();
    await start();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(screen.getByRole("radio", { name: "Subscribe to a calendar feed" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Feed address" }), "https://calendar.example.com/feed.ics");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That address didn’t work. Check it and try again.");
    expect(store.getState().calendars).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Feed address" })).toHaveClass("err");
  });

  it("step 2: a readable feed is subscribed and Continue goes to step 3", async () => {
    const ics = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20261106", "SUMMARY:Bonfire night", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const store = await open(undefined, async (url) => (url.endsWith(".ics") ? new Response(ics) : Promise.reject(new TypeError("offline"))));
    await start();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(screen.getByRole("radio", { name: "Subscribe to a calendar feed" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Feed address" }), "https://calendar.example.com/feed.ics");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("region", { name: "First run, step 3 of 3" });
    expect(store.getState().calendars.map((c) => c.kind.type)).toContain("subscribed");
    expect(store.getState().events.map((e) => e.title)).toEqual(["Bonfire night"]);
  });

  it("step 3: Start planning makes the list and opens Today; an empty name, or I’ll make lists later, makes none", async () => {
    const store = await open();
    await start();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    const step = screen.getByRole("region", { name: "First run, step 3 of 3" });
    expect(within(step).getByText("Lists keep tasks together, like Work or Errands. Your Inbox already exists.")).toBeInTheDocument();
    expect(within(step).getByRole("textbox", { name: "List name" })).toHaveAttribute("placeholder", "Work, Home, Errands");
    expect(within(step).getByRole("button", { name: "I’ll make lists later" })).toBeInTheDocument();
    await userEvent.type(within(step).getByRole("textbox", { name: "List name" }), "Errands");
    expect(within(step).getByRole("button", { name: "Skip for now" })).toBeInTheDocument(); // a name is typed
    await userEvent.click(within(step).getByRole("button", { name: "Start planning" }));
    expect(await screen.findByRole("heading", { name: "Nothing planned today" })).toBeInTheDocument();
    expect(store.getState().lists.map((l) => l.name)).toEqual(["Inbox", "Errands"]);
    expect(localStorage.getItem(firstRunKey(null))).toBe("done");
  });

  it("I’ll make lists later ends first run without a list", async () => {
    const store = await open();
    await start();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(screen.getByRole("button", { name: "I’ll make lists later" }));
    expect(await screen.findByRole("heading", { name: "Nothing planned today" })).toBeInTheDocument();
    expect(store.getState().lists).toHaveLength(1);
  });

  it("Back goes up a step, and from step 1 to the welcome", async () => {
    await open();
    await start();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("region", { name: "First run, step 1 of 3" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await welcome()).toBeInTheDocument();
  });

  it("Settings › Planning offers Saturday too", async () => {
    localStorage.setItem(firstRunKey(null), "done");
    await open(undefined, undefined, "/settings");
    expect(await screen.findByRole("radio", { name: "Saturday" })).toBeInTheDocument();
  });
});

describe("First run, as the frames draw it (Planner Designs fr-week, fr-calendar, fr-list, fr-phone)", () => {
  const bars = (step: HTMLElement) => [...step.querySelectorAll(".fr-bars i")].map((i) => i.getAttribute("data-on"));

  it("a progress bar of three segments fills one more on each step", async () => {
    await open();
    await start();
    const step1 = screen.getByRole("region", { name: "First run, step 1 of 3" });
    expect(bars(step1)).toEqual(["true", "false", "false"]);
    await userEvent.click(within(step1).getByRole("button", { name: "Continue" }));
    expect(bars(screen.getByRole("region", { name: "First run, step 2 of 3" }))).toEqual(["true", "true", "false"]);
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(bars(screen.getByRole("region", { name: "First run, step 3 of 3" }))).toEqual(["true", "true", "true"]);
  });

  it("Days shown is the segmented control, not pills, and week starts are radio cards with a drawn radio", async () => {
    await open();
    await start();
    const step = screen.getByRole("region", { name: "First run, step 1 of 3" });
    const days = within(step).getByRole("radiogroup", { name: "Days shown" });
    expect(days).toHaveClass("seg");
    expect(within(days).getAllByRole("radio")).toHaveLength(2);
    expect(step.querySelector(".pill")).toBeNull();
    for (const card of within(within(step).getByRole("radiogroup", { name: "Week starts on" })).getAllByRole("radio")) {
      expect(card.querySelector(".fr-radio")).not.toBeNull();
    }
  });

  it("step 1: the phone form drops the sentence under the title, the Sunday and Saturday notes and the footnote", async () => {
    await open();
    await start();
    const step = screen.getByRole("region", { name: "First run, step 1 of 3" });
    const gone = [...step.querySelectorAll(".fr-more")].map((e) => e.textContent);
    expect(gone).toEqual([
      "This sets the first column of your calendar and the week in Today.",
      "Week 1 begins on a Sunday",
      "Week 1 begins on a Saturday",
      "You can change both later in Settings › Planning.",
    ]);
  });

  it("step 2: the empty-name line sits inside the chosen row, between the field and the colours", async () => {
    await open();
    await start();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.clear(screen.getByRole("textbox", { name: "Calendar name" }));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Give the calendar a name.");
    const row = alert.closest(".fr-choice")!;
    expect(row.contains(screen.getByRole("textbox", { name: "Calendar name" }))).toBe(true);
    const order = [...row.children];
    expect(order.indexOf(screen.getByRole("textbox", { name: "Calendar name" }))).toBeLessThan(order.indexOf(alert));
    expect(order.indexOf(alert)).toBeLessThan(order.indexOf(row.querySelector(".fr-colours")!));
  });

  it("step 2: the options keep their short names; the connect row is dimmed, Planned and not selectable", async () => {
    await open();
    await start();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    const planned = screen.getByText("Connect Google or Outlook").closest(".fr-choice")!;
    expect(planned).toHaveAttribute("aria-disabled", "true");
    expect(within(planned as HTMLElement).getByText("Planned")).toBeInTheDocument();
    expect(within(planned as HTMLElement).queryByRole("radio")).toBeNull();
  });

  it("the tab bar is not shown under first run, and comes back once it is done", async () => {
    await open();
    await welcome();
    expect(screen.queryByRole("navigation", { name: "Tabs" })).toBeNull();
    await userEvent.click(within(await welcome()).getByRole("button", { name: "Skip for now" }));
    await screen.findByRole("heading", { name: "Nothing planned today" });
    expect(screen.getByRole("navigation", { name: "Tabs", hidden: true })).toBeInTheDocument();
  });

  it("step 3: Start planning and the quiet skip are the last row; the colour picker is the five-dot row", async () => {
    await open();
    await start();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    const step = screen.getByRole("region", { name: "First run, step 3 of 3" });
    expect(within(step).getByRole("radiogroup", { name: "Colour" })).toHaveClass("fr-colours");
    expect(step.querySelector(".fr-actions")!.textContent).toBe("BackI’ll make lists laterStart planning");
  });
});
