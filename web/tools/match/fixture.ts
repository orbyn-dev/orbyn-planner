// DEVELOPMENT AND TESTS ONLY. This folder is never imported by src/ and never reaches a production or staging build
// (tools/match/guard.test.ts builds both and fails if anything here, or any sample string below, is in the output).
// It never touches an account or the engine: it seeds an in-memory planner and nothing else. Read docs/match-kit.md.
import type { ListColour, PlannerStore } from "../../src/store/types";

/** Sat 7 Nov 2026, 08:30 UTC: the day every design frame is drawn on. */
export const PINNED_NOW = "2026-11-07T08:30:00.000Z";
export const TIME_ZONE = "UTC";
export const LOCALE = "en-GB";
export const FIXTURE_MARKER = "orbyn-match-fixture-v1";

export const SCENARIOS = [
  "today",
  "today-empty",
  "today-all-day",
  "phone-today",
  "week",
  "day",
  "phone-week",
  "phone-week-tue",
  "phone-day-wed",
  "phone-day-empty-wed",
  "phone-day-empty-fri",
  "tasks",
] as const;
export type Scenario = (typeof SCENARIOS)[number];

export function isScenario(name: string): name is Scenario {
  return (SCENARIOS as readonly string[]).includes(name);
}

/** The sample people the frames mention: Sam is the signed-in person; the others appear on tasks and events. */
export const PEOPLE = {
  sam: "sam@example.test",
  maya: "maya@example.test",
  priya: "priya@example.test",
  jordan: "jordan@example.test",
} as const;

interface World {
  work: string;
  personal: string;
  family: string;
  workList: string;
  errands: string;
  inbox: string;
  spring: string;
}

const day = (n: number) => `2026-11-${String(n).padStart(2, "0")}`;

function lists(store: PlannerStore) {
  const state = store.getState();
  const find = (name: string, colour: ListColour) => state.lists.find((l) => l.name === name) ?? store.addList(name, colour);
  return { work: find("Work", "c1"), errands: find("Errands", "c2"), inbox: state.lists.find((l) => l.isInbox)! };
}

/** Calendars, lists and the Spring launch project (70% done, goal today), which every frame shares. */
function world(store: PlannerStore, withProject = true): World {
  const cal = (name: string, colour: ListColour) => store.getState().calendars.find((c) => c.name === name) ?? store.addCalendar(name, colour);
  // The frames draw Lunch with Maya and Maya’s birthday green, Book club and the Home tiling purple.
  const work = cal("Work", "c1");
  const family = cal("Family", "c2");
  const personal = cal("Personal", "c3");
  const { work: workList, errands, inbox } = lists(store);
  const spring = store.addProject({ name: "Spring launch", colour: "c1", goal: day(7) });
  for (let i = 0; i < (withProject ? 10 : 0); i += 1) {
    const task = store.addTask({ title: `Launch step ${i + 1}`, listId: workList.id, projectId: spring.id });
    if (i < 7) {
      store.setDone(task.id, true);
      store.updateTask(task.id, { completedAt: `2026-11-0${1 + (i % 5)}T10:00` });
    }
  }
  return { work: work.id, personal: personal.id, family: family.id, workList: workList.id, errands: errands.id, inbox: inbox.id, spring: spring.id };
}

/** Today, as the Today frame draws it: three events, four tasks (one done), one overdue, the week ahead. */
function todayData(store: PlannerStore, w: World): void {
  const event = (title: string, calendarId: string, d: number, from: string, to: string, extra: { place?: string; people?: string[] } = {}) =>
    store.addEvent({
      title,
      calendarId,
      start: `${day(d)}T${from}`,
      end: `${day(d)}T${to}`,
      place: extra.place ?? "",
      people: (extra.people ?? []).map((email) => ({ email, response: "accepted" as const })),
    });
  event("Team planning: spring launch", w.work, 7, "09:00", "10:00", { place: "Room 3", people: [PEOPLE.sam, PEOPLE.priya] });
  event("Lunch with Maya", w.family, 7, "13:00", "14:00", { people: [PEOPLE.maya] });
  event("Book club", w.personal, 7, "15:00", "16:00", { place: "Library" });
  event("Standup", w.work, 9, "09:30", "10:00");
  event("Design review", w.work, 10, "11:00", "12:00");
  event("Dentist", w.personal, 13, "15:00", "16:00");
  const task = (title: string, due: string, listId: string) => store.addTask({ title, due, listId });
  task("Send the launch brief to Priya", `${day(7)}T12:00`, w.workList);
  task("Fix the sign-up email bug", `${day(7)}T17:00`, w.workList);
  task("Pick up dry cleaning", day(7), w.errands);
  store.setDone(task("Reply to the school about the trip", day(7), w.inbox).id, true);
  task("Review the Q2 budget", day(6), w.workList);
  task("Birthday candles", day(8), w.errands);
  for (const title of ["Draft the agenda", "Book the venue", "Order the cake"]) task(title, day(9), w.workList);
  task("Confirm the guest list", day(10), w.workList);
  task("Print the posters", day(10), w.workList);
  task("Send the deposit", day(11), w.workList);
  task("Prepare the launch slides", day(12), w.workList);
}

function clearToday(store: PlannerStore): void {
  for (const t of store.getState().tasks) if (t.due && t.due.slice(0, 10) <= day(7) && !t.projectId) store.deleteTask(t.id);
  for (const e of store.getState().events) if (e.start.slice(0, 10) === day(7)) store.deleteEvent(e.id);
}

/** Seeds one scenario into an empty store: the data one design frame is drawn with. */
export function seed(store: PlannerStore, scenario: Scenario): void {
  const w = world(store, scenario !== "tasks");
  switch (scenario) {
    case "today":
      todayData(store, w);
      return;
    case "phone-today":
      todayData(store, w);
      // The phone frame writes the shorter titles.
      for (const [from, to] of [["Team planning: spring launch", "Team planning"], ["Send the launch brief to Priya", "Send the launch brief"], ["Reply to the school about the trip", "Reply to the school"]] as const) {
        const task = store.getState().tasks.find((t) => t.title === from);
        const event = store.getState().events.find((e) => e.title === from);
        if (task) store.updateTask(task.id, { title: to });
        if (event) store.updateEvent(event.id, { title: to });
      }
      return;
    case "today-empty":
      todayData(store, w);
      clearToday(store);
      return;
    case "today-all-day": {
      todayData(store, w);
      const home = store.addCalendar("Home", "c3");
      store.addEvent({ title: "Home renovation: tiling", calendarId: home.id, allDay: true, start: day(5), end: day(8) });
      store.addEvent({ title: "Maya’s birthday", calendarId: w.family, allDay: true, start: day(7), end: day(7) });
      return;
    }
    case "week":
    case "day": {
      const event = (title: string, d: number, from: string, to: string, calendarId: string, place = "") =>
        store.addEvent({ title, calendarId, start: `${day(d)}T${from}`, end: `${day(d)}T${to}`, place });
      event("Launch stand-up", 2, "09:00", "09:30", w.work);
      event("Team planning", 3, "09:00", "10:00", w.work);
      event("Call with the builder", 4, "11:00", "12:00", w.personal);
      event("Lunch with Maya", 5, "13:00", "14:00", w.family);
      event("Book club", 6, "15:00", "17:00", w.personal);
      event("Dentist", 6, "15:30", "16:30", w.work);
      if (scenario === "day") {
        event("Team planning: spring launch", 7, "09:00", "11:00", w.work, "Room 3");
        event("Lunch with Maya", 7, "13:00", "14:00", w.family);
        event("Book club", 7, "15:00", "17:00", w.personal, "Library");
        store.addEvent({ title: "Maya’s birthday", calendarId: w.family, allDay: true, start: day(7), end: day(7) });
        store.addTask({ title: "Send the launch brief", due: `${day(7)}T12:00`, listId: w.workList });
        store.addTask({ title: "Pick up dry cleaning", due: day(7), listId: w.errands });
        store.setDone(store.addTask({ title: "Reply to the school", due: day(7), listId: w.inbox }).id, true);
      } else {
        event("Team planning", 7, "09:00", "11:00", w.work);
      }
      store.addTask({ title: "Review the Q2 budget", due: day(6), listId: w.workList });
      store.addTask({ title: "Prepare the launch slides", due: day(12), listId: w.workList });
      store.addTask({ title: "Book the dentist", due: day(13), listId: w.errands });
      return;
    }
    case "phone-week":
      store.addEvent({ title: "Launch stand-up", calendarId: w.work, start: `${day(3)}T09:00`, end: `${day(3)}T09:30` });
      store.addEvent({ title: "Team planning", calendarId: w.work, start: `${day(7)}T09:00`, end: `${day(7)}T10:00`, place: "Room 3" });
      store.addEvent({ title: "Lunch with Maya", calendarId: w.family, start: `${day(7)}T13:00`, end: `${day(7)}T14:00` });
      store.addEvent({ title: "Book club", calendarId: w.personal, start: `${day(7)}T15:00`, end: `${day(7)}T16:00`, place: "Library" });
      store.addTask({ title: "Pick up dry cleaning", due: day(7), listId: w.errands });
      return;
    case "phone-week-tue":
      store.addEvent({ title: "Launch stand-up", calendarId: w.work, start: `${day(3)}T09:00`, end: `${day(3)}T09:30` });
      return;
    case "phone-day-wed":
      store.addEvent({ title: "Dentist", calendarId: w.work, start: `${day(4)}T10:00`, end: `${day(4)}T11:00`, place: "Dr Lee" });
      store.addEvent({ title: "Call with Priya", calendarId: w.family, start: `${day(4)}T14:00`, end: `${day(4)}T14:45` });
      return;
    case "phone-day-empty-wed":
    case "phone-day-empty-fri":
      return;
    case "tasks": {
      const home = store.addList("Book club", "c3");
      const reno = store.addList("Home renovation", "c4");
      store.addTask({ title: "Review the Q2 budget", due: day(6), listId: w.workList, priority: "high" });
      store.addTask({ title: "Send the launch brief to Priya", due: `${day(7)}T12:00`, listId: w.workList, priority: "high" });
      store.addTask({ title: "Book a table for the book club", due: day(7), listId: home.id, priority: "medium" });
      store.addTask({ title: "Choose kitchen tiles", due: day(9), listId: reno.id, priority: "medium" });
      store.addTask({ title: "Prepare the launch slides", due: day(12), listId: w.workList, priority: "low" });
      store.setDone(store.addTask({ title: "Reply to the school about the trip", due: day(7), listId: w.workList }).id, true);
      return;
    }
  }
}

/** Every distinctive title, place and person in a scenario (list and calendar names are ordinary words of the app, so they are left out), for the guard that keeps them out of the shipped build. */
export function sampleStrings(store: PlannerStore): string[] {
  const s = store.getState();
  return [
    ...s.tasks.map((t) => t.title),
    ...s.events.map((e) => e.title),
    ...s.events.flatMap((e) => [e.place, ...e.people.map((p) => p.email)]),
    ...s.projects.map((p) => p.name),
    ...Object.values(PEOPLE),
    FIXTURE_MARKER,
  ].filter((text) => text.length > 0);
}
