import { useUi } from "../../ui/product/UiProvider";
import { EmptyState } from "../../ui/primitives/EmptyState";
import { VirtualList } from "../../ui/primitives/VirtualList";
import { dateOf, formatTime, parseDue, shortDay } from "../../core/planner/dates";
import { touchesDay } from "../../core/planner/wall";
import { usePlannerSelector } from "../../state/store";
import type { Occurrence } from "../../core/planner/occurrences";
import { colourOf, eventMeta } from "./presentation";
export { eventMeta } from "./presentation";

export function AgendaView({ days, occurrences, today }: { days: string[]; occurrences: Occurrence[]; today: string }) {
  const calendars = usePlannerSelector((state) => state.calendars);
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
          <VirtualList className="agenda-rows" totalCount={groups.reduce((n, group) => n + group.items.length, 0)} items={g.items} getKey={(o) => `event:${o.event.id}:${o.date}:${g.day}`}>
            {(o) => {
              const meta = eventMeta(o);
              return (
                <li
                  className="row"
                  data-row-id={o.event.id}
                  style={ui.eventKey?.id === o.event.id && ui.eventKey.date === o.date ? { background: "var(--sel)", borderRadius: "var(--r-8)", padding: "0 var(--sp-8)" } : undefined}
                >
                  <span className="time">{o.allDay ? "All day" : formatTime(parseDue(o.start).date)}</span>
                  <span className="sw" style={{ background: colourOf(calendars, o.event) }} aria-hidden="true" />
                  <button type="button" className="what link-btn" onClick={() => ui.openEvent(o.event.id, o.date)}>{o.event.title}</button>
                  <span className="meta">{meta}</span>
                </li>
              );
            }}
          </VirtualList>
        </section>
      ))}
    </div>
  );
}
