import { useUi } from "../../app/ui";
import { EmptyState } from "../../components/EmptyState";
import { dateOf, formatTime, parseDue, shortDay } from "../../lib/dates";
import { touchesDay } from "../../lib/wall";
import { usePlanner } from "../../store/context";
import type { Occurrence } from "../../store/occurrences";
import { duration } from "./PhoneCalendar";
import { colourOf } from "./TimeGrid";

function length(o: Occurrence): string {
  const minutes = Math.round((parseDue(o.end).date.getTime() - parseDue(o.start).date.getTime()) / 60_000);
  return o.allDay || minutes <= 0 ? "" : duration(minutes);
}

/** What an event row says after its title (Planner Designs: the place; with no place its length; never both; an all-day event says neither). */
export function eventMeta(o: Occurrence): string {
  if (o.allDay) return "";
  return o.event.place || length(o);
}

export function AgendaView({ days, occurrences, today }: { days: string[]; occurrences: Occurrence[]; today: string }) {
  const { calendars } = usePlanner();
  const ui = useUi();
  const groups = days
    .map((day) => ({ day, items: occurrences.filter((o) => touchesDay(o, day)) }))
    .filter((g) => g.items.length > 0);

  if (groups.length === 0) {
    return <EmptyState title="Nothing coming up" body="Events for the next 7 days will appear here." />;
  }
  return (
    <div className="pad">
      {groups.map((g, i) => (
        <section key={g.day} aria-label={g.day}>
          <div className="bh" style={i === 0 ? { paddingTop: 0 } : undefined}>
            <b>{g.day === today ? `Today · ${shortDay(dateOf(g.day))}` : shortDay(dateOf(g.day))}</b>
          </div>
          <ul className="agenda-rows">
            {g.items.map((o) => {
              const meta = eventMeta(o);
              return (
                <li
                  className="row"
                  data-row-id={o.event.id}
                  key={`${o.event.id}-${o.date}-${g.day}`}
                  style={ui.eventKey?.id === o.event.id && ui.eventKey.date === o.date ? { background: "var(--sel)", borderRadius: "var(--r-8)", padding: "0 var(--sp-8)" } : undefined}
                >
                  <span className="time">{o.allDay ? "All day" : formatTime(parseDue(o.start).date)}</span>
                  <span className="sw" style={{ background: colourOf(calendars, o.event) }} aria-hidden="true" />
                  <button type="button" className="what link-btn" onClick={() => ui.openEvent(o.event.id, o.date)}>{o.event.title}</button>
                  <span className="meta">{meta}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
