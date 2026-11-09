import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { When, WhenKind } from "../../core/planner/whenParser";
import { WhenField, withAllDay, withDay, withEnd, withStart } from "./WhenField";

// Saturday 7 November 2026, 10:00.
const NOW = new Date(2026, 10, 7, 10, 0);
const w = (startDay: string, startTime: string, endDay: string, endTime: string, allDay = false): When => ({ allDay, startDay, startTime, endDay, endTime });

function Harness({ kind, initial, onValue }: { kind: WhenKind; initial: When | null; onValue?: (v: When | null) => void }) {
  const [value, setValue] = useState<When | null>(initial);
  return (
    <WhenField label={kind === "task" ? "Due" : "When"} kind={kind} value={value} now={NOW} weekStart="mon" onChange={(v) => { setValue(v); onValue?.(v); }} />
  );
}

describe("When helpers", () => {
  it("picking a day keeps the span, and an end before the start crosses midnight", () => {
    expect(withDay(w("2026-11-12", "23:00", "2026-11-13", "01:00"), "2026-11-20")).toEqual(w("2026-11-20", "23:00", "2026-11-21", "01:00"));
    expect(withEnd(w("2026-11-12", "09:00", "2026-11-12", "10:00"), "08:00").endDay).toBe("2026-11-13");
    expect(withStart(w("2026-11-12", "09:00", "2026-11-13", "01:00"), "00:30").endDay).toBe("2026-11-12");
    // A longer span is left alone.
    expect(withEnd(w("2026-11-12", "09:00", "2026-11-15", "10:00"), "08:00").endDay).toBe("2026-11-15");
  });

  it("All day drops the times and turning it off starts from 09:00 to 10:00", () => {
    expect(withAllDay(w("2026-11-12", "09:00", "2026-11-12", "10:00"), true)).toEqual(w("2026-11-12", "", "2026-11-12", "", true));
    expect(withAllDay(w("2026-11-12", "", "2026-11-12", "", true), false)).toEqual(w("2026-11-12", "09:00", "2026-11-12", "10:00"));
  });
});

describe("WhenField for an event", () => {
  const start = w("2026-11-12", "09:00", "2026-11-12", "10:00");

  it("shows the value as text and a live preview while typing", async () => {
    render(<Harness kind="event" initial={start} />);
    const line = screen.getByRole("textbox", { name: "When" });
    expect(line).toHaveValue("Thu 12 Nov, 09:00 – 10:00");
    await userEvent.clear(line);
    await userEvent.type(line, "Fri 14:00–15:00");
    expect(screen.getByText("Fri 13 Nov, 14:00 – 15:00")).toBeInTheDocument();
    await userEvent.tab(); // moves to the calendar icon: the line shows the value as text again
    expect(line).toHaveValue("Fri 13 Nov, 14:00 – 15:00");
  });

  it("says quietly when it cannot read, keeps what was typed, and leaves the value", async () => {
    const seen: (When | null)[] = [];
    render(<Harness kind="event" initial={start} onValue={(v) => seen.push(v)} />);
    const line = screen.getByRole("textbox", { name: "When" });
    await userEvent.clear(line);
    await userEvent.type(line, "sometime next fortnight maybe");
    expect(screen.getByText("Couldn’t read that")).toBeInTheDocument();
    expect(screen.getByText("Try “tomorrow 3pm” or pick from the calendar.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    await userEvent.tab();
    expect(line).toHaveValue("sometime next fortnight maybe");
    expect(seen.some((v) => v?.startDay === "2026-11-12" && v.startTime === "09:00")).toBe(false);
  });

  it("the calendar icon opens a month, times and All day; Done and Escape return focus to the line", async () => {
    render(<Harness kind="event" initial={start} />);
    const line = screen.getByRole("textbox", { name: "When" });
    await userEvent.click(screen.getByRole("button", { name: "Open the calendar" }));
    const pop = within(screen.getByRole("dialog", { name: "When" }));
    expect(pop.getByRole("button", { name: "Thursday 12 November" })).toHaveFocus();
    await userEvent.click(pop.getByRole("button", { name: "Friday 13 November" }));
    expect(line).toHaveValue("Fri 13 Nov, 09:00 – 10:00");
    const end = pop.getByRole("textbox", { name: "End time" });
    await userEvent.clear(end);
    await userEvent.type(end, "11:30{Enter}");
    expect(line).toHaveValue("Fri 13 Nov, 09:00 – 11:30");
    await userEvent.click(pop.getByRole("switch", { name: "All day" }));
    expect(line).toHaveValue("Fri 13 Nov, all day");
    expect(pop.queryByRole("textbox", { name: "Start time" })).toBeNull();
    await userEvent.click(pop.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog", { name: "When" })).toBeNull();
    expect(line).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Open the calendar" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "When" })).toBeNull();
    expect(line).toHaveFocus();
  });

  it("a time that wraps past midnight is shown with both days", async () => {
    render(<Harness kind="event" initial={start} />);
    const line = screen.getByRole("textbox", { name: "When" });
    await userEvent.clear(line);
    await userEvent.type(line, "fri 23:00-01:00");
    await userEvent.tab();
    expect(line).toHaveValue("Fri 13 Nov, 23:00 – Sat 14 Nov, 01:00");
  });
});

describe("WhenField for a task", () => {
  it("takes a day and one time, and an empty line is no date", async () => {
    let last: When | null = null;
    render(<Harness kind="task" initial={null} onValue={(v) => (last = v)} />);
    const line = screen.getByRole("textbox", { name: "Due" });
    expect(line).toHaveValue("");
    await userEvent.type(line, "tomorrow 3pm");
    expect(screen.getByText("Sun 8 Nov, 15:00")).toBeInTheDocument();
    expect(last).toMatchObject({ startDay: "2026-11-08", startTime: "15:00" });
    await userEvent.clear(line);
    expect(last).toBeNull();
    await userEvent.type(line, "fri 14:00-15:00");
    expect(screen.getByText("Couldn’t read that")).toBeInTheDocument();
  });

  it("the popover has one time with No time, four shortcuts and Done", async () => {
    let last: When | null = null;
    render(<Harness kind="task" initial={w("2026-11-12", "17:00", "2026-11-12", "")} onValue={(v) => (last = v)} />);
    await userEvent.click(screen.getByRole("button", { name: "Open the due calendar" }));
    const pop = within(screen.getByRole("dialog", { name: "Due" }));
    expect(pop.queryByRole("switch", { name: "All day" })).toBeNull();
    expect(pop.queryByRole("textbox", { name: "End time" })).toBeNull();
    await userEvent.click(pop.getByRole("button", { name: "No time" }));
    expect(last).toMatchObject({ startDay: "2026-11-12", startTime: "" });
    await userEvent.click(pop.getByRole("button", { name: "Tomorrow" }));
    expect(last).toMatchObject({ startDay: "2026-11-08" });
    await userEvent.click(pop.getByRole("button", { name: "No date" }));
    expect(last).toBeNull();
    expect(screen.getByRole("textbox", { name: "Due" })).toHaveValue("");
  });
});
