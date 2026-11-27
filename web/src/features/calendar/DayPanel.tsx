import { useMemo, useRef, useState } from "react";
import { Icon } from "../../ui/primitives/Icon";
import { VirtualList } from "../../ui/primitives/VirtualList";
import { usePopover } from "../../ui/primitives/usePopover";
import { useUi } from "../../ui/product/UiProvider";
import { dateOf, dueDayKey, formatTime, parseDue, WEEKDAYS, MONTHS } from "../../core/planner/dates";
import { expandEvents } from "../../core/planner/occurrences";
import { touchesDay } from "../../core/planner/wall";
import { usePlannerSelector } from "../../state/store";
import { Check, useTaskActions } from "../tasks";
import { colourOf } from "./presentation";
import { eventMeta } from "./presentation";
import type { Task } from "../../core/planner/types";

const dayName = (day: string) => {
  const d = dateOf(day);
  return `${WEEKDAYS[d.getDay()]!.slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()]!.slice(0, 3)}`;
};

function TaskLine({ task, listName }: { task: Task; listName: string }) {
  const { open } = useTaskActions(task);
  return (
    <li className={task.done ? "row done" : "row"} data-row-id={task.id} data-done={task.done} style={{ gridTemplateColumns: "var(--sp-44) var(--sp-16) minmax(0,1fr) auto" }}>
      <span className="time">{task.due && parseDue(task.due).hasTime ? formatTime(parseDue(task.due).date) : "Any"}</span>
      <Check task={task} />
      <button type="button" className="what link-btn" onClick={open}>{task.title}</button>
      <span className="meta">{listName}</span>
    </li>
  );
}

/**
 * A day's agenda, over the page, from a tap on a day of the narrow month (Planner Designs v70 p-narrow-month-agenda-480): a back arrow to the
 * Calendar, the day's events and tasks in the usual rows, and Add (an event or a task).
 */
export function DayPanel() {
  const ui = useUi();
  const events = usePlannerSelector((state) => state.events);
  const calendars = usePlannerSelector((state) => state.calendars);
  const tasks = usePlannerSelector((state) => state.tasks);
  const lists = usePlannerSelector((state) => state.lists);
  const day = ui.dayKey;
  const [menu, setMenu] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const popover = usePopover(menu, () => setMenu(false), anchor);
  const items = useMemo(() => {
    if (day === null) return { occurrences: [], dayTasks: [] as Task[] };
    const visible = new Set(calendars.filter((c) => c.visible).map((c) => c.id));
    const occurrences = expandEvents(events.filter((e) => visible.has(e.calendarId)), day, day).filter((o) => touchesDay(o, day));
    const dayTasks = tasks.filter((t) => t.deletedAt === null && t.due !== null && dueDayKey(t.due) === day);
    return { occurrences, dayTasks };
  }, [events, calendars, tasks, day]);
  if (day === null) return null;
  const { occurrences, dayTasks } = items;
  const name = dayName(day);
  const parts = [occurrences.length > 0 && `${occurrences.length} ${occurrences.length === 1 ? "event" : "events"}`, dayTasks.length > 0 && `${dayTasks.length} ${dayTasks.length === 1 ? "task" : "tasks"}`].filter(Boolean).join(" · ");

  return (
    <aside className="task-panel day-panel" role="complementary" aria-label="Day agenda" tabIndex={-1}>
      <div className="pnltop">
        <button type="button" className="ghost sm" onClick={ui.closeDay}>
          <Icon name="left" small />
          Calendar
        </button>
        <span style={{ flex: 1 }} />
        <div className="sync-wrap">
          <button ref={anchor} type="button" className="btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
            <Icon name="plus" small />
            Add
            <Icon name="down" small />
          </button>
          {menu && (
            <div ref={popover} className="card popover cal-menu" role="menu" aria-label="Add">
              <button type="button" role="menuitem" className="mi" onClick={() => { setMenu(false); ui.openNewEvent(day); }}>
                <Icon name="cal" small />
                <span className="what">Event</span>
              </button>
              <button type="button" role="menuitem" className="mi" onClick={() => { setMenu(false); ui.openNewTask(); }}>
                <Icon name="check" small />
                <span className="what">Task</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="agttl"><b>{name}</b><span>{parts}</span></div>
      {occurrences.length === 0 && dayTasks.length === 0 ? (
        <div className="agempty">
          <b>Nothing on {name}.</b>
          <span>Add an event or a task for the day.</span>
        </div>
      ) : (
        <>
          {occurrences.length > 0 && (
            <>
              <div className="bh"><b>Events</b><span>{occurrences.length}</span></div>
              <VirtualList className="blk" items={occurrences} getKey={(o) => `event:${o.event.id}:${o.date}`} getRowId={(o) => o.event.id}>
                {(o) => (
                  <li className="row" data-row-id={o.event.id} style={{ gridTemplateColumns: "var(--sp-44) var(--sp-16) minmax(0,1fr) auto" }}>
                    <span className="time">{o.allDay ? "All day" : formatTime(parseDue(o.start).date)}</span>
                    <span className="sw" style={{ background: colourOf(calendars, o.event) }} aria-hidden="true" />
                    <button type="button" className="what link-btn" onClick={() => ui.openEvent(o.event.id, o.date)}>{o.event.title}</button>
                    <span className="meta">{eventMeta(o)}</span>
                  </li>
                )}
              </VirtualList>
            </>
          )}
          {dayTasks.length > 0 && (
            <>
              <div className="bh"><b>Tasks</b><span>{dayTasks.length}</span></div>
              <VirtualList className="blk" items={dayTasks} getKey={(t) => `task:${t.id}`} getRowId={(t) => t.id}>
                {(t) => <TaskLine task={t} listName={lists.find((l) => l.id === t.listId)?.name ?? ""} />}
              </VirtualList>
            </>
          )}
        </>
      )}
    </aside>
  );
}
