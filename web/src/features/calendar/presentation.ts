import { parseDue } from "../../core/planner/dates";
import { wallMinutes } from "../../core/planner/wall";
import type { Occurrence } from "../../core/planner/occurrences";
import type { CalendarEvent } from "../../core/planner/types";

export function colourOf(calendars: readonly { id: string; colour: string }[], event: CalendarEvent): string {
  return `var(--${calendars.find((c) => c.id === event.calendarId)?.colour ?? "c1"})`;
}

/** "30 min", "1 h", "1 h 30 min": how long a timed event lasts. */
export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h > 0 && `${h} h`, m > 0 && `${m} min`].filter(Boolean).join(" ") || "0 min";
}

/** What an event row says after its title: the place, or if it has none its length, never both; an all-day event says neither. */
export function phoneEventMeta(o: Pick<Occurrence, "allDay" | "start" | "end"> & { event: { place: string } }): string {
  if (o.allDay) return "";
  if (o.event.place) return o.event.place;
  const minutes = wallMinutes(o.end) - wallMinutes(o.start);
  return minutes > 0 ? duration(minutes) : "";
}

function length(o: Occurrence): string {
  const minutes = Math.round((parseDue(o.end).date.getTime() - parseDue(o.start).date.getTime()) / 60_000);
  return o.allDay || minutes <= 0 ? "" : duration(minutes);
}

/** What an event row says after its title (Planner Designs: the place; with no place its length; never both; an all-day event says neither). */
export function eventMeta(o: Occurrence): string {
  if (o.allDay) return "";
  return o.event.place || length(o);
}
