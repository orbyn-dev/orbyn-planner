import { MONTHS, WEEKDAYS, addDays, dateKey, dateOf, startOfDay, startOfWeek } from "./dates";

/**
 * The value of a When (event) or Due (task) line: a day and a time range, in local time. `endDay` is the day the event ends on, which is
 * the day after `startDay` when it crosses midnight. Times are `HH:mm`, or empty for an all-day event or a task with no time.
 */
export interface When {
  allDay: boolean;
  startDay: string;
  startTime: string;
  endDay: string;
  endTime: string;
}

export type WhenKind = "event" | "task";

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (h: number, m: number) => `${pad(h)}:${pad(m)}`;

/** The time field takes 24-hour `H:mm` or `HH:mm`; anything else is not a time. */
export function readTime(text: string): string | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(text);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1]!.padStart(2, "0")}:${m[2]}`;
}

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

const FULL_WEEKDAYS = new Map<string, number>(WEEKDAYS.map((name, i) => [name.toLowerCase(), i]));
const SHORT_WEEKDAYS = new Map<string, number>([
  ["sun", 0], ["mon", 1], ["tue", 2], ["tues", 2], ["wed", 3], ["thu", 4], ["thur", 4], ["thurs", 4], ["fri", 5], ["sat", 6],
]);
const weekdayOf = (word: string) => FULL_WEEKDAYS.get(word) ?? SHORT_WEEKDAYS.get(word);

const MONTH_NAMES = new Map<string, number>();
MONTHS.forEach((name, i) => {
  MONTH_NAMES.set(name.toLowerCase(), i);
  MONTH_NAMES.set(name.slice(0, 3).toLowerCase(), i);
});
MONTH_NAMES.set("sept", 8);

interface Clock {
  h: number;
  m: number;
  /** Whether am or pm, or a 24-hour colon form, said which half of the day. Bare numbers in a range borrow it from the other end. */
  meridiem: "am" | "pm" | null;
  explicit: boolean;
}

const TIME = String.raw`(?:noon|midnight|\d{1,2}(?::\d{2})?\s?(?:am|pm)?)`;

function readClock(text: string): Clock | null {
  if (text === "noon") return { h: 12, m: 0, meridiem: "pm", explicit: true };
  if (text === "midnight") return { h: 0, m: 0, meridiem: "am", explicit: true };
  const m = /^(\d{1,2})(?::(\d{2}))?\s?(am|pm)?$/.exec(text);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = m[2] === undefined ? 0 : Number(m[2]);
  const ap = m[3] as "am" | "pm" | undefined;
  if (minute > 59) return null;
  if (ap) {
    if (hour < 1 || hour > 12) return null;
    return { h: (hour % 12) + (ap === "pm" ? 12 : 0), m: minute, meridiem: ap, explicit: true };
  }
  if (hour > 23) return null;
  // A colon says it is a time of day on the 24-hour clock; a bare number is not a time until another part of the range says so.
  return { h: hour, m: minute, meridiem: null, explicit: m[2] !== undefined };
}

/** Every time of day written in `text`, in order; bare numbers do not count. */
function clocksIn(text: string): { index: number; length: number; clock: Clock }[] {
  const out: { index: number; length: number; clock: Clock }[] = [];
  const all = new RegExp(String.raw`(?:^| )(${TIME})(?= |$)`, "g");
  for (const m of text.matchAll(all)) {
    const clock = readClock(m[1]!);
    if (clock?.explicit) out.push({ index: m.index + m[0].length - m[1]!.length, length: m[1]!.length, clock });
  }
  return out;
}

/** `h` on the 12-hour clock moved into the other half of the day. */
const flip = (c: Clock): Clock => ({ ...c, h: (c.h + 12) % 24 });

const DURATION = /\bfor\s+(?:(an?|\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)(?:\s*(\d+)\s*(m|min|mins|minute|minutes))?|(\d+)\s*(m|min|mins|minute|minutes)|half an hour)\b/;

function durationMinutes(text: string): { minutes: number; rest: string } | null {
  const m = DURATION.exec(text);
  if (!m) return null;
  let minutes: number;
  if (m[0].endsWith("half an hour")) minutes = 30;
  else if (m[5] !== undefined) minutes = Number(m[5]);
  else {
    const hours = m[1] === "a" || m[1] === "an" ? 1 : Number(m[1]);
    minutes = Math.round(hours * 60) + (m[3] === undefined ? 0 : Number(m[3]));
  }
  if (!(minutes >= 1) || minutes > 24 * 60) return null;
  return { minutes, rest: text.replace(DURATION, " ") };
}

/** A date phrase on its own: today, tomorrow, a weekday, next week, in 3 days, 13 Nov, Fri 13 Nov 2026, 2026-11-13. */
function readDay(phrase: string, now: Date): Date | null {
  const today = startOfDay(now);
  const words = phrase.split(" ").filter(Boolean);
  if (words.length === 0) return null;
  const only = words.join(" ");
  if (only === "today" || only === "tonight") return today;
  if (only === "tomorrow" || only === "tmrw" || only === "tmr") return addDays(today, 1);
  if (only === "yesterday") return addDays(today, -1);
  if (only === "next week") return addDays(startOfWeek(today), 7);
  const rel = /^in (a|an|\d{1,3}) (day|days|week|weeks)$/.exec(only);
  if (rel) {
    const n = rel[1] === "a" || rel[1] === "an" ? 1 : Number(rel[1]);
    return addDays(today, n * (rel[2]!.startsWith("week") ? 7 : 1));
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(only);
  if (iso) return exact(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  // A weekday alone is its next occurrence after today; "next fri" is that day in the following Monday to Sunday week.
  let rest = words;
  let weekday: number | undefined;
  let next = false;
  if (rest[0] === "next" || rest[0] === "this") {
    next = rest[0] === "next";
    rest = rest.slice(1);
  }
  if (rest.length > 0 && weekdayOf(rest[0]!) !== undefined) {
    weekday = weekdayOf(rest[0]!);
    rest = rest.slice(1);
  }
  if (rest.length === 0) {
    if (weekday === undefined) return null;
    return next ? addDays(startOfWeek(today), 7 + ((weekday + 6) % 7)) : addDays(today, ((weekday - today.getDay() + 6) % 7) + 1);
  }
  if (next) return null;

  // 13 nov, 13th november, nov 13, nov 13th, each with an optional year; a weekday in front must agree with the date.
  const dm = /^(\d{1,2})(?:st|nd|rd|th)?$/;
  let day: number | undefined;
  let month: number | undefined;
  let year: number | undefined;
  if (dm.test(rest[0]!) && MONTH_NAMES.has(rest[1] ?? "")) {
    day = Number(dm.exec(rest[0]!)![1]);
    month = MONTH_NAMES.get(rest[1]!);
    if (rest.length === 3) year = /^\d{4}$/.test(rest[2]!) ? Number(rest[2]) : NaN;
    else if (rest.length !== 2) return null;
  } else if (MONTH_NAMES.has(rest[0]!) && dm.test(rest[1] ?? "")) {
    month = MONTH_NAMES.get(rest[0]!);
    day = Number(dm.exec(rest[1]!)![1]);
    if (rest.length === 3) year = /^\d{4}$/.test(rest[2]!) ? Number(rest[2]) : NaN;
    else if (rest.length !== 2) return null;
  } else return null;
  if (month === undefined || day === undefined || Number.isNaN(year)) return null;
  let date: Date | null = null;
  if (year !== undefined) date = exact(year, month, day);
  else {
    // This year, or the next one that has the date, once it has passed.
    for (let y = today.getFullYear(); y <= today.getFullYear() + 4 && !date; y++) {
      const d = exact(y, month, day);
      if (d && d.getTime() >= today.getTime()) date = d;
    }
  }
  if (date && weekday !== undefined && date.getDay() !== weekday) return null;
  return date;
}

function exact(y: number, month: number, d: number): Date | null {
  const date = new Date(y, month, d);
  return date.getFullYear() === y && date.getMonth() === month && date.getDate() === d ? date : null;
}

/**
 * Reads a When or Due line typed in plain English: "tomorrow 3pm", "Fri 14:00–15:00", "13 Nov 9am to 10:30am", "mon 9 for 1h",
 * "Sat all day", "23:00-01:00" (it ends the next day). Everything typed must be understood, or the answer is null. Rules: a weekday is its
 * next occurrence after today; a time with no day is today, or tomorrow once it has passed; a bare number is not a time (it needs a colon
 * or am/pm); in a range one end may lend its am/pm to the other ("2-3pm", "11-1pm" is 11am to 1pm); an end earlier than the start ends the
 * next day. A day alone is all day for an event, and no time for a task. A task takes one time only. Pure: `now` is the only clock used.
 */
export function parseWhen(input: string, now: Date, kind: WhenKind): When | null {
  let text = input
    .toLowerCase()
    .replace(/[‒-―−]/g, "-")
    .replace(/,|\.(?!\d)/g, " ")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (text === "") return null;

  let duration: number | null = null;
  const d = durationMinutes(text);
  if (d) {
    duration = d.minutes;
    text = d.rest.replace(/\s+/g, " ").trim();
  } else if (/\bfor\b/.test(text)) return null;

  let allDay = false;
  if (/\ball[ -]?day\b/.test(text)) {
    allDay = true;
    text = text.replace(/\ball[ -]?day\b/, " ").replace(/\s+/g, " ").trim();
  }

  // "9 to 10", "9am until 10am": the word joins two times into a range.
  text = text.replace(new RegExp(String.raw`(${TIME})\s+(?:to|until|till|thru)\s+(?=${TIME}(?:\s|$))`, "g"), "$1-");
  // Filler that carries no meaning of its own.
  text = text.replace(/\b(?:at|on|from|the|by|due|of)\b/g, " ").replace(/\s+/g, " ").trim();

  let start: Clock | null = null;
  let end: Clock | null = null;
  const range = new RegExp(String.raw`(?:^| )(${TIME})-(${TIME})(?= |$)`).exec(text);
  if (range) {
    start = readClock(range[1]!);
    end = readClock(range[2]!);
    if (!start || !end) return null;
    text = (text.slice(0, range.index) + " " + text.slice(range.index + range[0].length)).replace(/\s+/g, " ").trim();
    // One end lends its am/pm to a bare number on the other: "2-3pm", "9-5pm", "11-1pm".
    const bare = (c: Clock) => !c.explicit;
    if (bare(start) && bare(end)) return null;
    if (bare(start) && end.meridiem) {
      start = { ...start, h: start.h % 12, meridiem: end.meridiem };
      if (end.meridiem === "pm") start = flip(start);
      if (minutesOf(clock(start.h, start.m)) > minutesOf(clock(end.h, end.m)) && start.h >= 12) start = flip(start);
    } else if (bare(end) && start.meridiem) {
      end = { ...end, h: end.h % 12 };
      if (start.meridiem === "pm") end = flip(end);
      if (minutesOf(clock(end.h, end.m)) < minutesOf(clock(start.h, start.m)) && end.h < 12) end = flip(end);
    }
  } else {
    // The times written alone: a bare number such as the 13 in "13 nov" is part of the date, not a time.
    const found = clocksIn(text);
    if (found.length > 1) return null; // "3pm 4pm" is not understood
    if (found[0]) {
      start = found[0].clock;
      text = (text.slice(0, found[0].index) + " " + text.slice(found[0].index + found[0].length)).replace(/\s+/g, " ").trim();
    }
  }
  if (range && clocksIn(text).length > 0) return null;

  if (kind === "task" && (end || duration !== null || allDay)) return null;
  if (allDay && (start || duration !== null)) return null;
  if (duration !== null && (end || !start)) return null;
  if (kind === "task" && text === "" && !start) return null;

  const today = startOfDay(now);
  let day: Date | null;
  if (text === "") {
    day = today;
    if (start && new Date(day.getFullYear(), day.getMonth(), day.getDate(), start.h, start.m).getTime() < now.getTime()) day = addDays(today, 1);
  } else {
    day = readDay(text, now);
  }
  if (!day) return null;
  const startDay = dateKey(day);

  if (allDay || (!start && kind === "event")) return { allDay: true, startDay, startTime: "", endDay: startDay, endTime: "" };
  if (!start) return { allDay: false, startDay, startTime: "", endDay: startDay, endTime: "" };

  const startTime = clock(start.h, start.m);
  let endTime = "";
  let endDay = startDay;
  if (end) {
    endTime = clock(end.h, end.m);
    // An end that is not after the start crosses midnight; one equal to it is no span at all.
    if (minutesOf(endTime) === minutesOf(startTime)) return null;
    if (minutesOf(endTime) < minutesOf(startTime)) {
      endDay = dateKey(addDays(dateOf(startDay), 1));
    }
  } else if (kind === "event") {
    const total = minutesOf(startTime) + (duration ?? 60);
    endDay = dateKey(addDays(dateOf(startDay), Math.floor(total / 1440)));
    endTime = clock(Math.floor((total % 1440) / 60), total % 60);
  }
  return { allDay: false, startDay, startTime, endDay, endTime };
}

const shortDay = (day: string, now: Date) => {
  const d = dateOf(day);
  const base = `${WEEKDAYS[d.getDay()]!.slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()]!.slice(0, 3)}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
};

/** How a When reads on its line and in the live preview: "Fri 13 Nov, 14:00 – 15:00", "Sat 14 Nov, all day", "Fri 13 Nov, 23:00 – Sat 14 Nov, 01:00". */
export function formatWhen(w: When, now: Date, kind: WhenKind): string {
  const first = shortDay(w.startDay, now);
  if (kind === "task") return w.startTime ? `${first}, ${w.startTime}` : first;
  if (w.allDay) return w.endDay === w.startDay ? `${first}, all day` : `${first} – ${shortDay(w.endDay, now)}, all day`;
  if (w.endDay !== w.startDay) return `${first}, ${w.startTime} – ${shortDay(w.endDay, now)}, ${w.endTime}`;
  return `${first}, ${w.startTime} – ${w.endTime}`;
}
