import { describe, expect, it } from "vitest";
import { formatWhen, parseWhen, readTime, type When } from "./whenParser";

// Saturday 7 November 2026, 10:00, local time.
const NOW = new Date(2026, 10, 7, 10, 0);
const ev = (t: string, now = NOW) => parseWhen(t, now, "event");
const task = (t: string, now = NOW) => parseWhen(t, now, "task");
const w = (startDay: string, startTime: string, endDay: string, endTime: string, allDay = false): When => ({ allDay, startDay, startTime, endDay, endTime });

describe("readTime", () => {
  it("takes 24-hour times only", () => {
    expect(readTime("17:00")).toBe("17:00");
    expect(readTime(" 9:05 ")).toBe("09:05");
    for (const bad of ["24:00", "12:60", "5pm", "17", "", "1:5"]) expect(readTime(bad)).toBeNull();
  });
});

describe("parseWhen days", () => {
  it("reads today, tomorrow and relative words", () => {
    expect(ev("today 3pm")).toEqual(w("2026-11-07", "15:00", "2026-11-07", "16:00"));
    expect(ev("tomorrow 3pm")).toEqual(w("2026-11-08", "15:00", "2026-11-08", "16:00"));
    expect(ev("tmrw 9:30")).toEqual(w("2026-11-08", "09:30", "2026-11-08", "10:30"));
    expect(ev("in 3 days")?.startDay).toBe("2026-11-10");
    expect(ev("in 2 weeks 10:00")?.startDay).toBe("2026-11-21");
    expect(ev("in a week")?.startDay).toBe("2026-11-14");
    expect(ev("next week")?.startDay).toBe("2026-11-09");
    expect(ev("yesterday")?.startDay).toBe("2026-11-06");
  });

  it("a weekday is its next occurrence after today; next fri is in the following week", () => {
    // Saturday: Fri is six days on, Sat is a week on.
    expect(ev("fri 14:00")?.startDay).toBe("2026-11-13");
    expect(ev("friday 14:00")?.startDay).toBe("2026-11-13");
    expect(ev("sat 14:00")?.startDay).toBe("2026-11-14");
    expect(ev("sunday 14:00")?.startDay).toBe("2026-11-08");
    expect(ev("this thu 9am")?.startDay).toBe("2026-11-12");
    expect(ev("next fri 9am")?.startDay).toBe("2026-11-13");
    expect(ev("next mon 9am")?.startDay).toBe("2026-11-09");
    expect(ev("next sun 9am")?.startDay).toBe("2026-11-15");
  });

  it("reads dates, with or without a weekday or year, and rolls a passed date to next year", () => {
    expect(ev("13 nov 2pm")?.startDay).toBe("2026-11-13");
    expect(ev("13th November 2pm")?.startDay).toBe("2026-11-13");
    expect(ev("nov 13 2pm")?.startDay).toBe("2026-11-13");
    expect(ev("Fri 13 Nov 14:00")?.startDay).toBe("2026-11-13");
    expect(ev("2026-12-24 18:00")?.startDay).toBe("2026-12-24");
    expect(ev("3 nov")?.startDay).toBe("2027-11-03");
    expect(ev("7 nov")?.startDay).toBe("2026-11-07");
    expect(ev("1 jan 2028")?.startDay).toBe("2028-01-01");
    expect(ev("29 feb")?.startDay).toBe("2028-02-29");
    expect(ev("sept 9")?.startDay).toBe("2027-09-09");
  });

  it("refuses dates that do not exist or disagree", () => {
    expect(ev("31 nov")).toBeNull();
    expect(ev("29 feb 2027")).toBeNull();
    expect(ev("Fri 14 Nov")).toBeNull(); // 14 Nov 2026 is a Saturday
    expect(ev("2026-13-01")).toBeNull();
    expect(ev("next 13 nov")).toBeNull();
  });
});

describe("parseWhen times", () => {
  it("reads 12-hour and 24-hour times", () => {
    expect(task("tomorrow 3pm")?.startTime).toBe("15:00");
    expect(task("tomorrow 3:30 pm")?.startTime).toBe("15:30");
    expect(task("tomorrow 12am")?.startTime).toBe("00:00");
    expect(task("tomorrow 12pm")?.startTime).toBe("12:00");
    expect(task("tomorrow 12:30am")?.startTime).toBe("00:30");
    expect(task("tomorrow 15:00")?.startTime).toBe("15:00");
    expect(task("tomorrow 0:05")?.startTime).toBe("00:05");
    expect(task("tomorrow at 9am")?.startTime).toBe("09:00");
    expect(task("tomorrow noon")?.startTime).toBe("12:00");
    expect(task("tomorrow midnight")?.startTime).toBe("00:00");
    expect(task("TOMORROW 3PM")?.startTime).toBe("15:00");
  });

  it("does not take bare numbers or impossible times as times", () => {
    expect(task("tomorrow 3")).toBeNull();
    expect(task("tomorrow 25:00")).toBeNull();
    expect(task("tomorrow 13pm")).toBeNull();
    expect(task("tomorrow 0pm")).toBeNull();
    expect(task("tomorrow 10:61")).toBeNull();
    expect(task("tomorrow 3pm 4pm")).toBeNull();
  });

  it("a time with no day is today, or tomorrow once it has passed", () => {
    expect(task("11:00")).toEqual({ allDay: false, startDay: "2026-11-07", startTime: "11:00", endDay: "2026-11-07", endTime: "" });
    expect(task("9am")?.startDay).toBe("2026-11-08");
    expect(task("10:00")?.startDay).toBe("2026-11-07"); // not yet passed at 10:00
    expect(ev("9am-10am")?.startDay).toBe("2026-11-08");
  });

  it("an event with a start only lasts an hour, and may run past midnight", () => {
    expect(ev("fri 3pm")).toEqual(w("2026-11-13", "15:00", "2026-11-13", "16:00"));
    expect(ev("fri 23:30")).toEqual(w("2026-11-13", "23:30", "2026-11-14", "00:30"));
  });
});

describe("parseWhen ranges and durations", () => {
  it("reads ranges with dashes, en dashes and words", () => {
    const fri = w("2026-11-13", "14:00", "2026-11-13", "15:00");
    expect(ev("Fri 14:00–15:00")).toEqual(fri);
    expect(ev("Fri 14:00-15:00")).toEqual(fri);
    expect(ev("Fri 14:00 — 15:00")).toEqual(fri);
    expect(ev("Fri 14:00 to 15:00")).toEqual(fri);
    expect(ev("Fri from 14:00 until 15:00")).toEqual(fri);
    expect(ev("fri 2pm - 3pm")).toEqual(fri);
    expect(ev("14:00-15:00 fri")).toEqual(fri);
    expect(ev("fri 9am to 10:30am")?.endTime).toBe("10:30");
  });

  it("lets one end lend its am/pm to the other", () => {
    expect(ev("fri 2-3pm")).toEqual(w("2026-11-13", "14:00", "2026-11-13", "15:00"));
    expect(ev("fri 9-5pm")).toEqual(w("2026-11-13", "09:00", "2026-11-13", "17:00"));
    expect(ev("fri 11-1pm")).toEqual(w("2026-11-13", "11:00", "2026-11-13", "13:00"));
    expect(ev("fri 9am-5")).toEqual(w("2026-11-13", "09:00", "2026-11-13", "17:00"));
    expect(ev("fri 9-5")).toBeNull();
  });

  it("an end that is not after the start ends the next day (midnight wrap)", () => {
    expect(ev("fri 23:00-01:00")).toEqual(w("2026-11-13", "23:00", "2026-11-14", "01:00"));
    expect(ev("fri 10pm-2am")).toEqual(w("2026-11-13", "22:00", "2026-11-14", "02:00"));
    expect(ev("fri 8pm-midnight")).toEqual(w("2026-11-13", "20:00", "2026-11-14", "00:00"));
    expect(ev("fri 14:00-14:00")).toBeNull();
  });

  it("reads a duration after a start time", () => {
    expect(ev("mon 9 for 1h")).toBeNull(); // 9 alone is not a time
    expect(ev("mon 9:00 for 1h")).toEqual(w("2026-11-09", "09:00", "2026-11-09", "10:00"));
    expect(ev("mon 9am for 90 minutes")?.endTime).toBe("10:30");
    expect(ev("mon 9am for 1.5 hours")?.endTime).toBe("10:30");
    expect(ev("mon 9am for 1 hour 15 min")?.endTime).toBe("10:15");
    expect(ev("mon 9am for an hour")?.endTime).toBe("10:00");
    expect(ev("mon 9am for half an hour")?.endTime).toBe("09:30");
    expect(ev("mon 11pm for 2h")).toEqual(w("2026-11-09", "23:00", "2026-11-10", "01:00"));
    expect(ev("mon for 1h")).toBeNull();
    expect(ev("mon 9am-10am for 1h")).toBeNull();
    expect(ev("mon 9am for ever")).toBeNull();
  });
});

describe("parseWhen all day, tasks and unreadable", () => {
  it("a day alone, or all day, is an all-day event", () => {
    expect(ev("sat")).toEqual(w("2026-11-14", "", "2026-11-14", "", true));
    expect(ev("sat all day")).toEqual(w("2026-11-14", "", "2026-11-14", "", true));
    expect(ev("all-day tomorrow")).toEqual(w("2026-11-08", "", "2026-11-08", "", true));
    expect(ev("sat all day 3pm")).toBeNull();
  });

  it("a task takes a day and one time", () => {
    expect(task("fri")).toEqual({ allDay: false, startDay: "2026-11-13", startTime: "", endDay: "2026-11-13", endTime: "" });
    expect(task("fri 14:00-15:00")).toBeNull();
    expect(task("fri 3pm for 1h")).toBeNull();
    expect(task("fri all day")).toBeNull();
  });

  it("says null for what it cannot read, and for nothing", () => {
    for (const bad of ["", "   ", "sometime next fortnight maybe", "fri banana", "tomorrow tomorrow-ish", "soon", "next", "3pm-"]) expect(ev(bad)).toBeNull();
  });

  it("uses the local clock it is given, not the machine's", () => {
    const late = new Date(2026, 11, 31, 23, 30);
    expect(ev("tomorrow 9am", late)?.startDay).toBe("2027-01-01");
    expect(ev("9am", late)?.startDay).toBe("2027-01-01");
    expect(ev("fri", late)?.startDay).toBe("2027-01-01");
    // Across a clock change the day arithmetic stays on calendar days: Sunday 1 Nov 2026 is the US fall-back date.
    expect(ev("tomorrow 1:30am", new Date(2026, 10, 1, 12, 0))?.startDay).toBe("2026-11-02");
    expect(ev("in 7 days", new Date(2026, 9, 31, 12, 0))?.startDay).toBe("2026-11-07");
  });
});

describe("formatWhen", () => {
  it("writes the line and the preview", () => {
    expect(formatWhen(w("2026-11-13", "14:00", "2026-11-13", "15:00"), NOW, "event")).toBe("Fri 13 Nov, 14:00 – 15:00");
    expect(formatWhen(w("2026-11-14", "", "2026-11-14", "", true), NOW, "event")).toBe("Sat 14 Nov, all day");
    expect(formatWhen(w("2026-11-13", "23:00", "2026-11-14", "01:00"), NOW, "event")).toBe("Fri 13 Nov, 23:00 – Sat 14 Nov, 01:00");
    expect(formatWhen(w("2026-11-13", "", "2026-11-15", "", true), NOW, "event")).toBe("Fri 13 Nov – Sun 15 Nov, all day");
    expect(formatWhen(w("2027-01-04", "09:00", "2027-01-04", "10:00"), NOW, "event")).toBe("Mon 4 Jan 2027, 09:00 – 10:00");
    expect(formatWhen(w("2026-11-13", "17:00", "2026-11-13", ""), NOW, "task")).toBe("Fri 13 Nov, 17:00");
    expect(formatWhen(w("2026-11-13", "", "2026-11-13", ""), NOW, "task")).toBe("Fri 13 Nov");
  });
});
