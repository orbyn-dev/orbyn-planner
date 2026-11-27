import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useUi } from "../../ui/product/UiProvider";
import { WEEKDAYS, dateOf, formatTime, isOverdue, parseDue, startOfDay } from "../../core/planner/dates";
import { lastDayOf, touchesDay } from "../../core/planner/wall";
import { usePlannerSelector } from "../../state/store";
import type { Occurrence } from "../../core/planner/occurrences";
import type { Task } from "../../core/planner/types";
import { dueText, isOpen, needsAction, sortByDue } from "../tasks";
import { TodayRow, useTaskActions } from "../tasks";
import { HOUR_PX } from "../../styles/tokens";
import { isAllDayLike, layoutDay } from "./layout";
import { VirtualList } from "../../ui/primitives/VirtualList";
import { colourOf } from "./presentation";
export { colourOf } from "./presentation";

const px = (minutes: number) => (minutes * HOUR_PX) / 60;
const eventKey = (day: string, occurrence: Occurrence) => JSON.stringify([day, occurrence.event.id, occurrence.date]);
type GridFocus = { key: string; top: number; slot: boolean };

function range(occ: Occurrence): string {
  if (occ.allDay) return "All day";
  const a = parseDue(occ.start).date;
  const b = parseDue(occ.end).date;
  // An hour or less reads as its start, a longer one as the whole range (Planner Designs calendar-day).
  return b.getTime() - a.getTime() <= 3_600_000 ? formatTime(a) : `${formatTime(a)} to ${formatTime(b)}`;
}

/** The line under a task in the side column: "1 day late" for an overdue one, otherwise its due text ("Today 12:00"). */
function cardDue(task: Task, now: Date): string {
  if (task.due !== null && !task.done && isOverdue(task.due, now)) {
    const days = Math.round((startOfDay(now).getTime() - startOfDay(parseDue(task.due).date).getTime()) / 86_400_000);
    if (days > 0) return `${days} ${days === 1 ? "day" : "days"} late`;
  }
  return dueText(task, now);
}

function TaskCard({ task, now }: { task: Task; now: Date }) {
  const { open } = useTaskActions(task);
  return (
    <li className="tcard" data-done={task.done}>
      <button type="button" className="tt link-btn" onClick={open}>{task.title}</button>
      <span className="m" style={needsAction(task, now) ? { color: "var(--amber-text)" } : undefined}>{cardDue(task, now)}</span>
    </li>
  );
}

export function TimeGrid({ days, occurrences, today, now, mode, side = true }: { days: string[]; occurrences: Occurrence[]; today: string; now: Date; mode: "week" | "day"; /** The column beside the grid (This week, Tasks today); the 3-day narrow week leaves it out. */ side?: boolean }) {
  const calendars = usePlannerSelector((state) => state.calendars);
  const tasks = usePlannerSelector((state) => state.tasks);
  const ready = usePlannerSelector((state) => state.ready);
  const ui = useUi();
  const scroller = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<{ top: number; bottom: number } | null>(null);
  const [focusedEvent, setFocusedEvent] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<GridFocus | null>(null);
  const tabEntry = useRef<"first" | "last" | null>(null);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const byDay = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const d of days) map.set(d, occurrences.filter((o) => touchesDay(o, d)));
    return map;
  }, [days, occurrences]);
  const placed = useMemo(() => new Map(days.map((day) => [day, layoutDay(byDay.get(day)!, day)])), [days, byDay]);

  useEffect(() => {
    const element = scroller.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (element.clientHeight > 0) setViewport({ top: element.scrollTop, bottom: element.scrollTop + element.clientHeight });
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener("scroll", measure, { passive: true });
    const reveal = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      const position = [...placed.values()].flat().find((item) => item.occ.event.id === id);
      if (!position) return;
      setFocusedEvent(id);
      element.scrollTop = px(position.top);
      measure();
    };
    document.addEventListener("planner:reveal-row", reveal);
    measure();
    return () => { observer.disconnect(); element.removeEventListener("scroll", measure); document.removeEventListener("planner:reveal-row", reveal); cancelAnimationFrame(frame); };
  }, [placed]);
  const allDay = occurrences.filter(isAllDayLike);
  // An event lasting several days is one bar across the columns it covers; a one-day all-day event is a chip in its column.
  const bars = useMemo(() => {
    const out: { occ: Occurrence; start: number; len: number; from: string; to: string }[] = [];
    for (const occ of occurrences.filter(isAllDayLike)) {
      const from = occ.start.slice(0, 10);
      const to = lastDayOf(occ.start, occ.end, occ.allDay);
      if (from >= to) continue;
      const shown = days.map((d, i) => ({ d, i })).filter(({ d }) => d >= from && d <= to);
      if (shown.length > 0 && days.length > 1) out.push({ occ, start: shown[0]!.i, len: shown.length, from, to });
    }
    return out;
  }, [days, occurrences]);
  const barIds = new Set(bars.map((b) => b.occ));
  const singles = allDay.filter((o) => !barIds.has(o));
  const dayWord = (d: string) => `${WEEKDAYS[dateOf(d).getDay()]!.slice(0, 3)} ${dateOf(d).getDate()}`;

  useEffect(() => {
    const el = scroller.current;
    // The 3-day narrow week starts at 07:00 whatever the time (Planner Designs v69 p-narrow-week-480).
    if (el) el.scrollTop = px(side && days.includes(today) ? Math.max(nowMinutes - 120, 0) : 7 * 60);
    // Scroll once per set of days, not on every tick of the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join(",")]);

  // One slot takes the Tab stop; arrows move between hours and days, Enter adds an event there.
  const [stop, setStop] = useState({ day: days[0]!, hour: 9 });
  if (!days.includes(stop.day)) setStop({ day: days.includes(today) ? today : days[0]!, hour: stop.hour });
  // Match the unfiltered DOM order: each day's one roving slot (if any), then all its timed events.
  const focusOrder = useMemo(() => days.flatMap((day): GridFocus[] => [
    ...(stop.day === day ? [{ key: `slot:${day}T${stop.hour}`, top: px(stop.hour * 60), slot: true }] : []),
    ...placed.get(day)!.map((position) => ({ key: eventKey(day, position.occ), top: px(position.top), slot: false })),
  ]), [days, placed, stop]);
  useEffect(() => {
    let expiry: ReturnType<typeof setTimeout>;
    const reset = () => { tabEntry.current = null; clearTimeout(expiry); };
    const keyDown = (event: globalThis.KeyboardEvent) => {
      reset();
      if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
      tabEntry.current = event.shiftKey ? "last" : "first";
      // Native Tab focuses during this key event; later programmatic focus must keep its own destination.
      expiry = setTimeout(reset, 0);
    };
    document.addEventListener("keydown", keyDown, true);
    document.addEventListener("pointerdown", reset, true);
    return () => { reset(); document.removeEventListener("keydown", keyDown, true); document.removeEventListener("pointerdown", reset, true); };
  }, []);
  const focusTarget = (target: GridFocus) => {
    const element = scroller.current;
    if (!element) return;
    element.scrollTop = target.top;
    if (element.clientHeight > 0) setViewport({ top: element.scrollTop, bottom: element.scrollTop + element.clientHeight });
    setPendingFocus(target);
  };
  const onGridTab = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
    const current = (event.target as HTMLElement).closest<HTMLElement>("[data-event-key], [data-slot]");
    if (!current) return;
    const key = current.dataset.eventKey ?? `slot:${current.dataset.slot}`;
    const index = focusOrder.findIndex((item) => item.key === key);
    if (index < 0) return;
    const target = focusOrder[index + (event.shiftKey ? -1 : 1)];
    // Native Tab leaves the grid at either logical boundary, including its all-day and side controls.
    if (!target) return;
    event.preventDefault();
    focusTarget(target);
  };
  useLayoutEffect(() => {
    if (!pendingFocus) return;
    const selector = pendingFocus.slot ? "[data-slot]" : "[data-event-key]";
    const target = Array.from(scroller.current?.querySelectorAll<HTMLElement>(selector) ?? [])
      .find((element) => (pendingFocus.slot ? `slot:${element.dataset.slot}` : element.dataset.eventKey) === pendingFocus.key);
    if (target) target.focus({ preventScroll: true });
    else queueMicrotask(() => setPendingFocus((current) => current === pendingFocus ? null : current));
  }, [pendingFocus]);
  const slotLabel = (d: string) => {
    const date = dateOf(d);
    return `${WEEKDAYS[date.getDay()]} ${date.getDate()}`;
  };
  const onSlotKey = (event: KeyboardEvent<HTMLElement>, day: string, hour: number) => {
    const delta = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[event.key];
    if (delta) {
      event.preventDefault();
      const nextDay = days[days.indexOf(day) + delta[0]!];
      const nextHour = hour + delta[1]!;
      if (nextDay !== undefined && nextHour >= 0 && nextHour < 24) {
        setStop({ day: nextDay, hour: nextHour });
        scroller.current?.querySelector<HTMLElement>(`[data-slot="${nextDay}T${nextHour}"]`)?.focus();
      }
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      ui.openNewEvent(day, `${String(hour).padStart(2, "0")}:00`);
    }
  };

  const columns = `var(--sp-44) repeat(${days.length}, minmax(0, 1fr))`;
  const first = days[0]!;
  const last = days.at(-1)!;
  const dueTasks = sortByDue(tasks.filter((t) => isOpen(t) && t.due !== null && t.due.slice(0, 10) >= first && t.due.slice(0, 10) <= last));
  const todayTasks = tasks.filter((t) => t.deletedAt === null && t.due !== null && t.due.slice(0, 10) === first);

  return (
    <div className={`calwrap${mode === "day" ? " day" : ""}${side ? "" : " single"}`}>
      <div className="calmain">
        <div className="cal" style={{ gridTemplateColumns: columns }}>
          <div />
          {days.map((d) => {
            const date = dateOf(d);
            return (
              <div key={d} className={d === today ? "dh today" : "dh"}>
                {WEEKDAYS[date.getDay()]!.slice(0, 3)} <b>{date.getDate()}</b>
              </div>
            );
          })}
          {mode === "week" && allDay.length > 0 && (
            <>
              <div className="adl" style={{ gridRow: `2 / span ${bars.length + (singles.length > 0 ? 1 : 0)}` }}>All day</div>
              {bars.map((b, k) => (
                <div key={`${b.occ.event.id}-${b.occ.date}`} className="adb" style={{ gridColumn: `${b.start + 2} / span ${b.len}`, gridRow: 2 + k }}>
                  <button type="button" className="chipx allday" style={{ borderLeft: `var(--bw-3) solid ${colourOf(calendars, b.occ.event)}` }} onClick={() => ui.openEvent(b.occ.event.id, b.occ.date)}>
                    {b.occ.event.title} · {dayWord(b.from)} to {dayWord(b.to)}
                  </button>
                </div>
              ))}
              {singles.length > 0 && days.map((d, i) => (
                <div key={d} className="adc" style={{ gridColumn: i + 2, gridRow: 2 + bars.length }}>
                  {byDay.get(d)!.filter((o) => singles.includes(o)).map((o) => (
                    <button key={`${o.event.id}-${o.date}`} type="button" className="chipx allday" style={{ borderLeft: `var(--bw-3) solid ${colourOf(calendars, o.event)}` }} onClick={() => ui.openEvent(o.event.id, o.date)}>
                      {o.event.title}
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
        <div className="calscroll" ref={scroller} onKeyDownCapture={onGridTab} onFocusCapture={(event) => {
          const direction = tabEntry.current;
          tabEntry.current = null;
          if (!event.currentTarget.contains(event.relatedTarget) && direction && !pendingFocus) {
            const target = direction === "last" ? focusOrder.at(-1) : focusOrder[0];
            const current = event.target as HTMLElement;
            const key = current.dataset.eventKey ?? `slot:${current.dataset.slot}`;
            if (target && target.key !== key) { focusTarget(target); return; }
            if (target && (target.top < event.currentTarget.scrollTop || target.top >= event.currentTarget.scrollTop + event.currentTarget.clientHeight)) {
              event.currentTarget.scrollTop = target.top;
              if (event.currentTarget.clientHeight > 0) setViewport({ top: event.currentTarget.scrollTop, bottom: event.currentTarget.scrollTop + event.currentTarget.clientHeight });
            }
          }
          setFocusedEvent((event.target as HTMLElement).closest<HTMLElement>("[data-row-id]")?.dataset.rowId ?? null);
          setPendingFocus(null);
        }} onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) { setFocusedEvent(null); setPendingFocus(null); }
        }}>
          <div className="cal" style={{ gridTemplateColumns: columns }}>
            <div>
              {Array.from({ length: 24 }, (_, h) => (
                <div className="hr" key={h}>{h === 0 ? "" : `${h}:00`}</div>
              ))}
            </div>
            {days.map((d) => (
              <div className={d === today ? "dcol today" : "dcol"} key={d} data-day={d}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    className="slot"
                    key={h}
                    role="button"
                    data-slot={`${d}T${h}`}
                    tabIndex={stop.day === d && stop.hour === h ? 0 : -1}
                    aria-label={`${slotLabel(d)}, ${h}:00. Enter adds an event.`}
                    onFocus={() => setStop({ day: d, hour: h })}
                    onClick={() => ui.openNewEvent(d, `${String(h).padStart(2, "0")}:00`)}
                    onKeyDown={(e) => onSlotKey(e, d, h)}
                  />
                ))}
                {placed.get(d)!.filter((p) => !viewport || pendingFocus?.key === eventKey(d, p.occ) || p.occ.event.id === focusedEvent || ui.eventKey?.id === p.occ.event.id || px(p.top + p.height) >= viewport.top - HOUR_PX && px(p.top) <= viewport.bottom + HOUR_PX).map((p) => {
                  const o = p.occ;
                  const width = 100 / p.columns;
                  const label = mode === "day" ? `${range(o)}${o.event.place ? ` · ${o.event.place}` : ""}` : formatTime(parseDue(o.start).date);
                  return (
                    <button
                      key={`${o.event.id}-${o.date}`}
                      type="button"
                      data-row-id={o.event.id}
                      data-event-key={eventKey(d, o)}
                      className={p.overlaps ? "ev clash" : "ev"}
                      aria-current={ui.eventKey?.id === o.event.id && ui.eventKey.date === o.date ? "true" : undefined}
                      style={{
                        top: px(p.top),
                        height: `calc(${px(p.height)}px - var(--sp-2))`,
                        left: `calc(${p.column * width}% + var(--sp-4))`,
                        width: `calc(${width}% - var(--sp-8))`,
                        borderLeftColor: colourOf(calendars, o.event),
                      }}
                      onClick={() => ui.openEvent(o.event.id, o.date)}
                    >
                      {o.event.title}
                      <small>
                        {label}
                        {p.overlaps && <span className="amber"> · overlaps</span>}
                      </small>
                    </button>
                  );
                })}
                {d === today && <div className="now" style={{ top: px(nowMinutes) }} data-testid="now" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {side && <aside className="cal-side" aria-label={mode === "day" ? "Tasks today" : "This week"}>
        {!ready ? <p role="status" className="quiet">Loading page…</p> : mode === "week" ? (
          <>
            <div className="bh"><b>This week</b></div>
            <div className="kv"><span>Events</span><b>{occurrences.length}</b></div>
            <div className="bh"><b>Due this week</b></div>
            {dueTasks.length === 0 ? (
              <p className="quiet">No tasks due.</p>
            ) : (
              <VirtualList className="cards" items={dueTasks} getKey={(task) => task.id}>
                {(task) => <TaskCard task={task} now={now} />}
              </VirtualList>
            )}
          </>
        ) : (
          <>
            <div className="bh"><b>Tasks today</b><span>{todayTasks.length}</span></div>
            {todayTasks.length === 0 ? (
              <p className="quiet">No tasks for this day.</p>
            ) : (
              <VirtualList items={sortByDue(todayTasks)} getKey={(task) => task.id}>
                {(task) => <TodayRow task={task} compact />}
              </VirtualList>
            )}
            {allDay.length > 0 && (
              <>
                <div className="bh"><b>All day</b></div>
                <ul className="cards">
                  {allDay.map((o) => (
                    <li className="tcard" key={`${o.event.id}-${o.date}`}>
                      <button type="button" className="tt link-btn" onClick={() => ui.openEvent(o.event.id, o.date)}>{o.event.title}</button>
                      <span className="m">
                        <span className="sw" style={{ background: colourOf(calendars, o.event) }} />
                        {calendars.find((c) => c.id === o.event.calendarId)?.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </aside>}
    </div>
  );
}
