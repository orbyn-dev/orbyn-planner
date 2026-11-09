// DEVELOPMENT AND TESTS ONLY. This folder is never imported by src/ and never reaches a production or staging build
// (tools/match/guard.test.ts builds both and fails if anything here, or any sample string below, is in the output).
// It never touches an account or the engine: it seeds an in-memory planner and nothing else. Read docs/match-kit.md.
import type { ListColour, PlannerStore } from "../../src/core/planner/types";

/** Sat 7 Nov 2026, 08:30 UTC: the day every design frame is drawn on. */
export const PINNED_NOW = "2026-11-07T08:30:00.000Z";
export const TIME_ZONE = "UTC";
export const LOCALE = "en-GB";
/** The pretend signed-in account of the phone frames and of every frame drawn with the sidebar's account row. */
export const ACCOUNT = { name: "Sam Arden", email: "sam@example.test", password: "correct horse battery staple" } as const;
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
  "today-event",
  "lists-empty",
  "first-run",
  "task-panel-tags",
  "board",
  "board-moved",
  "project-board",
  "today-long",
  "today-week-empty",
  "today-overnight",
  "today-overnight-long",
  "month",
  "agenda",
  "week-all-day",
  "task-panel",
  "task-panel-progress",
  "task-panel-blocked",
  "search-data",
  "week-sync-error",
  "lists-groceries",
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
  const cal = (name: string, colour: ListColour) => {
    // A new planner already has a "Personal" calendar; it takes the colour the frames draw it in.
    const found = store.getState().calendars.find((c) => c.name === name);
    if (!found) return store.addCalendar(name, colour);
    if (found.colour !== colour) store.updateCalendar(found.id, { colour });
    return found;
  };
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
  const task = (title: string, due: string, listId: string, extra: { priority?: "high" | "low"; reminder?: number } = {}) => store.addTask({ title, due, listId, ...extra });
  task("Send the launch brief to Priya", `${day(7)}T12:00`, w.workList, { priority: "high" });
  task("Fix the sign-up email bug", `${day(7)}T17:00`, w.workList, { priority: "high", reminder: 60 });
  task("Pick up dry cleaning", day(7), w.errands);
  store.setDone(task("Reply to the school about the trip", day(7), w.inbox).id, true);
  task("Review the Q2 budget", day(6), w.workList, { priority: "high" });
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
  // A first launch has nothing in it: the Inbox and the Personal calendar every planner starts with.
  if (scenario === "first-run") return;
  if (scenario === "week-sync-error") {
    // The week, plus a calendar from outside Orbyn that read once and then failed (p-cal-sync-error).
    seed(store, "week");
    const holidays = store.addSubscription("School holidays", "c4", "https://calendar.example.com/school.ics");
    store.replaceFeedEvents(holidays.id, []);
    store.failSubscription(holidays.id, "The calendar’s server took too long to answer.");
    return;
  }
  const w = world(store, scenario !== "tasks" && scenario !== "board" && scenario !== "board-moved" && scenario !== "project-board");
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
      // Sun 8 holds the tiling alone in this frame, so the week list reads its title and "day 4 of 4".
      for (const t of store.getState().tasks) if (t.title === "Birthday candles") store.deleteTask(t.id);
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
      if (scenario === "week") {
        store.addTask({ title: "Send the launch brief to Priya", due: `${day(7)}T12:00`, listId: w.workList });
        store.addTask({ title: "Fix the sign-up email bug", due: `${day(7)}T17:00`, listId: w.workList });
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
      store.addEvent({ title: "Launch stand-up", calendarId: w.work, start: `${day(3)}T09:00`, end: `${day(3)}T09:30` });
      store.addEvent({ title: "Dentist", calendarId: w.work, start: `${day(4)}T10:00`, end: `${day(4)}T11:00`, place: "Dr Lee" });
      store.addEvent({ title: "Call with Priya", calendarId: w.family, start: `${day(4)}T14:00`, end: `${day(4)}T14:45` });
      return;
    case "phone-day-empty-wed":
    case "phone-day-empty-fri":
      return;
    case "today-event": {
      // The event panel frames: Book club with a place, a repeat and a reminder, and Monday's agenda items.
      todayData(store, w);
      const club = store.getState().events.find((e) => e.title === "Book club")!;
      store.deleteEvent(club.id);
      store.addEvent({
        title: "Book club",
        calendarId: w.personal,
        start: `${day(7)}T15:00`,
        end: `${day(7)}T17:00`,
        place: "Library, level 2",
        reminder: 30,
        repeat: { frequency: "weekly", interval: 2, weekdays: [], end: { type: "never" } },
      });
      store.addEvent({ title: "Launch stand-up", calendarId: w.work, start: `${day(9)}T09:00`, end: `${day(9)}T09:30` });
      store.addEvent({ title: "Swim", calendarId: w.personal, start: `${day(9)}T18:00`, end: `${day(9)}T19:00` });
      return;
    }
    case "lists-groceries": {
      // The Lists frame: Groceries selected with Oat milk and Coffee beans due today, Birthday candles tomorrow and Bread done; Work, Home, Errands beside it.
      const groceries = store.addList("Groceries", "c2");
      const home = store.addList("Home", "c3");
      store.addTask({ title: "Oat milk", listId: groceries.id, due: day(7) });
      store.addTask({ title: "Coffee beans", listId: groceries.id, due: day(7) });
      store.addTask({ title: "Birthday candles", listId: groceries.id, due: day(8) });
      store.setDone(store.addTask({ title: "Bread", listId: groceries.id }).id, true);
      for (const t of ["Draft the agenda", "Book the venue"]) store.addTask({ title: t, listId: w.workList });
      store.addTask({ title: "Fix the shelf", listId: home.id });
      return;
    }
    case "lists-empty": {
      const groceries = store.addList("Groceries", "c2");
      const home = store.addList("Home", "c4");
      for (const t of ["Oat milk", "Coffee beans", "Bread"]) store.addTask({ title: t, listId: groceries.id });
      for (const t of ["Water the plants", "Fix the shelf"]) store.addTask({ title: t, listId: home.id });
      for (const t of ["Reply to the school", "Renew library books", "Book the dentist"]) store.addTask({ title: t, listId: w.inbox });
      return;
    }
    case "today-long": {
      todayData(store, w);
      const home = store.addList("Home", "c3");
      const club = store.addList("Book club", "c3");
      const ev = (title: string, from: string, to: string, calendarId: string, place: string) =>
        store.addEvent({ title, calendarId, start: `${day(7)}T${from}`, end: `${day(7)}T${to}`, place });
      ev("Swim", "07:30", "08:15", w.personal, "Pool");
      ev("Call with the builder", "11:00", "11:30", w.work, "Video");
      ev("Spanish lesson", "18:30", "19:30", w.personal, "");
      store.addTask({ title: "Order the tile samples", due: `${day(7)}T10:00`, listId: home.id });
      store.addTask({ title: "Book a table for the book club", due: `${day(7)}T12:30`, listId: club.id });
      store.addTask({ title: "Reply to Priya about the timeline", due: `${day(7)}T14:00`, listId: w.workList });
      store.addTask({ title: "Collect the parcel", due: `${day(7)}T16:00`, listId: w.errands });
      store.addTask({ title: "Water the plants", due: day(7), listId: home.id });
      return;
    }
    case "today-week-empty": {
      todayData(store, w);
      store.addEvent({ title: "Dentist visit", calendarId: w.personal, start: `${day(8)}T10:00`, end: `${day(8)}T11:00` });
      for (const t of store.getState().tasks) if (t.due && [day(9), day(11)].includes(t.due.slice(0, 10))) store.deleteTask(t.id);
      for (const e of store.getState().events) if (e.start.slice(0, 10) === day(9)) store.deleteEvent(e.id);
      return;
    }
    case "today-overnight": {
      todayData(store, w);
      const night = store.addCalendar("Home", "c4").id;
      store.addEvent({ title: "Night shift: ward 4", calendarId: night, start: `${day(6)}T22:00`, end: `${day(7)}T06:00` });
      store.addEvent({ title: "Night shift: ward 4", calendarId: night, start: `${day(7)}T22:00`, end: `${day(8)}T06:00` });
      return;
    }
    case "today-overnight-long": {
      store.addEvent({ title: "Conference: Lisbon", calendarId: w.work, allDay: true, start: day(5), end: day(9) });
      store.addEvent({ title: "On-call: platform", calendarId: w.work, start: `${day(4)}T22:00`, end: `${day(7)}T06:00` });
      store.addEvent({ title: "Team planning: spring launch", calendarId: w.work, start: `${day(7)}T09:00`, end: `${day(7)}T10:00`, place: "Room 3" });
      store.addEvent({ title: "Release freeze", calendarId: w.work, start: `${day(7)}T22:00`, end: `${day(10)}T06:00` });
      store.addEvent({ title: "Dentist", calendarId: w.personal, start: `${day(8)}T15:00`, end: `${day(8)}T16:00` });
      store.addTask({ title: "Birthday candles", due: day(11), listId: w.errands });
      return;
    }
    case "month": {
      const ev = (title: string, d: number, from: string, to: string, calendarId: string) =>
        store.addEvent({ title, calendarId, start: `${day(d)}T${from}`, end: `${day(d)}T${to}` });
      ev("Call with the builder", 4, "11:00", "12:00", w.personal);
      ev("Lunch", 5, "13:00", "14:00", w.family);
      ev("Book club", 6, "15:00", "17:00", w.personal);
      ev("Book club", 7, "15:00", "17:00", w.personal);
      const home = store.addCalendar("Home", "c4");
      store.addEvent({ title: "Swim", calendarId: home.id, start: `${day(11)}T18:00`, end: `${day(11)}T19:00` });
      for (const d of [3, 5, 7]) ev("Work", d, "09:00", "10:00", w.work);
      store.addEvent({ title: "Lab report due", calendarId: w.work, allDay: true, start: day(12), end: day(12) });
      store.addEvent({ title: "Exam", calendarId: w.work, allDay: true, start: day(16), end: day(16) });
      return;
    }
    case "agenda": {
      store.addEvent({ title: "Team planning: spring launch", calendarId: w.work, start: `${day(7)}T09:00`, end: `${day(7)}T10:00`, place: "Room 3" });
      store.addEvent({ title: "Lunch with Maya", calendarId: w.family, start: `${day(7)}T13:00`, end: `${day(7)}T14:00` });
      store.addEvent({ title: "Book club", calendarId: w.personal, start: `${day(7)}T15:00`, end: `${day(7)}T17:00`, place: "Library, level 2" });
      store.addEvent({ title: "Launch stand-up", calendarId: w.work, start: `${day(9)}T09:00`, end: `${day(9)}T09:30` });
      store.addEvent({ title: "Swim", calendarId: store.addCalendar("Home", "c4").id, start: `${day(9)}T18:00`, end: `${day(9)}T19:00` });
      store.addEvent({ title: "Site visit with Jordan", calendarId: w.personal, start: `${day(10)}T10:00`, end: `${day(10)}T11:00`, place: "Home" });
      store.addEvent({ title: "Spanish lesson", calendarId: w.family, start: `${day(10)}T19:00`, end: `${day(10)}T20:00`, repeat: { frequency: "weekly", interval: 1, weekdays: [], end: { type: "never" } } });
      return;
    }
    case "week-all-day": {
      const event = (title: string, d: number, from: string, to: string, calendarId: string) =>
        store.addEvent({ title, calendarId, start: `${day(d)}T${from}`, end: `${day(d)}T${to}` });
      event("Call with the builder", 4, "11:00", "12:00", w.personal);
      event("Lunch with Maya", 5, "13:00", "14:00", w.family);
      event("Team planning", 7, "09:00", "11:00", w.work);
      event("Book club", 6, "15:00", "17:00", w.personal);
      const home = store.addCalendar("Home", "c3");
      store.addEvent({ title: "Home renovation: tiling", calendarId: home.id, allDay: true, start: day(5), end: day(8) });
      store.addEvent({ title: "Maya’s birthday", calendarId: w.family, allDay: true, start: day(7), end: day(7) });
      return;
    }
    case "task-panel":
    case "task-panel-tags":
    case "task-panel-progress":
    case "task-panel-blocked": {
      todayData(store, w);
      const bug = store.getState().tasks.find((t) => t.title === "Fix the sign-up email bug")!;
      store.updateTask(bug.id, {
        notes: scenario === "task-panel-blocked" ? "Waiting on the logs from support." : "The welcome email is sent twice when someone signs up with a passkey.",
        checklist: [
          { id: "c1", title: "Reproduce it", done: true, order: "a" },
          { id: "c2", title: "Ship the fix", done: false, order: "b" },
          { id: "c3", title: "Tell support", done: false, order: "c" },
        ],
        status: scenario === "task-panel" || scenario === "task-panel-tags" ? null : scenario === "task-panel-progress" ? "in_progress" : "blocked",
      });
      if (scenario === "task-panel-tags") {
        // Planner Designs task-panel-tags and p-row-tags: errands, bug and email exist; the task carries bug and email.
        const errands = store.addTag("errands", "c4");
        const bugTag = store.addTag("bug", "c1");
        const email = store.addTag("email", "c2");
        void errands;
        store.setTaskTag(bug.id, bugTag.id, true);
        store.setTaskTag(bug.id, email.id, true);
      }
      return;
    }
    case "board":
    case "board-moved": {
      // The Tasks board frames (p-board-card-*): four lanes, the card in focus In progress.
      const work = store.getState().lists.find((l) => l.name === "Work")!;
      const personal = store.addList("Personal", "c4");
      const club = store.addList("Book club", "c3");
      const reno = store.addList("Home renovation", "c3");
      const add = (title: string, listId: string, due: string | null, status: "todo" | "in_progress" | "blocked") => {
        const t = store.addTask({ title, listId, due });
        if (status !== "todo") store.updateTask(t.id, { status });
        return t;
      };
      add("Prepare the launch slides", work.id, day(12), "todo");
      add("Renew library books", personal.id, day(13), "todo");
      const brief = add("Launch brief", work.id, `${day(7)}T12:00`, "in_progress");
      // Three of five steps done: the card's bar reads 60 percent (work-board).
      store.updateTask(brief.id, { checklist: ["a", "b", "c", "d", "e"].map((order, i) => ({ id: `s${i}`, title: `Step ${i + 1}`, done: i < 3, order })) });
      add("Choose kitchen tiles", reno.id, day(9), "in_progress");
      if (scenario === "board") add("Book a table for the book club", club.id, null, "blocked");
      else {
        add("Book a table for the book club", club.id, null, "todo");
        add("Fix the sign-up email bug", work.id, `${day(7)}T17:00`, "blocked");
      }
      const done = store.addTask({ title: "Reply to the school", listId: w.workList });
      store.setDone(done.id, true);
      return;
    }
    case "project-board": {
      // p-board-card-project: Home renovation with Kitchen and Bathroom lanes and a Done lane.
      const project = store.addProject({ name: "Home renovation", colour: "c3", goal: `2027-01-30` });
      const kitchen = store.addSection(project.id, "Kitchen");
      const bath = store.addSection(project.id, "Bathroom");
      const add = (title: string, due: string, sectionId: string) => store.addTask({ title, due, projectId: project.id, sectionId, listId: w.workList });
      add("Choose kitchen tiles", day(9), kitchen.id);
      add("Send the deposit to the builder", day(11), kitchen.id);
      add("Get three plumbing quotes", "2026-11-20", bath.id);
      add("Pick a shower screen", "2026-12-01", bath.id);
      store.setDone(add("Measure the cabinets", day(3), kitchen.id).id, true);
      return;
    }
    case "search-data": {
      todayData(store, w);
      store.addTask({ title: "Book the dentist", due: day(13), listId: w.errands });
      store.addEvent({ title: "Dentist check-up", calendarId: w.personal, start: "2026-08-14T10:00", end: "2026-08-14T11:00" });
      return;
    }
    case "tasks": {
      const home = store.addList("Book club", "c3");
      const reno = store.addList("Home renovation", "c4");
      store.addTask({ title: "Review the Q2 budget", due: day(6), listId: w.workList, priority: "high" });
      store.addTask({ title: "Send the launch brief to Priya", due: `${day(7)}T12:00`, listId: w.workList, priority: "high" });
      store.addTask({ title: "Fix the sign-up email bug", due: `${day(7)}T17:00`, listId: w.workList, priority: "high" });
      const table = store.addTask({ title: "Book a table for the book club", due: day(7), listId: home.id, priority: "medium" });
      store.updateTask(table.id, { status: "blocked" });
      store.addTask({ title: "Book the dentist", due: day(13), listId: w.errands, priority: "medium" });
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
    ACCOUNT.name,
    ACCOUNT.password,
    FIXTURE_MARKER,
  ].filter((text) => text.length > 0);
}
