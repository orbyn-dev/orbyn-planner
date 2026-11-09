import { useEffect, useMemo, useState } from "react";
import { useNow } from "../../state/clock";
import { usePrefs } from "../../state/prefs";
import { useUi } from "../../ui/product/UiProvider";
import { PageHeader } from "../../ui/primitives/EmptyState";
import { Icon } from "../../ui/primitives/Icon";
import { PHONE_QUERY, useMediaQuery } from "../../ui/primitives/useMediaQuery";
import { addDays, dateKey, dateOf, formatTime, isoWeek, MONTHS, WEEKDAYS, type WeekStart, weekStartOf } from "../../core/planner/dates";
import { setSettingsTarget } from "../../state/settingsTarget";
import { useRouter } from "../../state/router";
import { useSlow } from "../../lib/useSlow";
import { usePlanner, useStore } from "../../state/store";
import { expandEvents } from "../../core/planner/occurrences";
import { AgendaView } from "./AgendaView";
import { CalendarsMenu } from "./CalendarsMenu";
import { MonthView } from "./MonthView";
import { PhoneCalendar } from "./PhoneCalendar";
import { refreshCalendar } from "../../state/subscriptions";
import { TimeGrid } from "./TimeGrid";

export type View = "month" | "week" | "day" | "agenda";
const VIEWS: readonly { id: View; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
  { id: "agenda", label: "Agenda" },
];

/** The days a view shows around `anchor`. */
export function viewDays(view: View, anchor: string, weekStart: WeekStart, weekDays: 5 | 7): string[] {
  const a = dateOf(anchor);
  if (view === "day") return [anchor];
  if (view === "agenda") return Array.from({ length: 7 }, (_, i) => dateKey(addDays(a, i)));
  if (view === "week") {
    // The full week from the week-start setting, with as many columns as "days shown" says (all seven, or the first five).
    // It never ends on today and is never centred on a day; today is marked only if it falls inside.
    const first = weekStartOf(a, weekStart);
    return Array.from({ length: weekDays }, (_, i) => dateKey(addDays(first, i)));
  }
  const gridStart = weekStartOf(new Date(a.getFullYear(), a.getMonth(), 1), weekStart);
  return Array.from({ length: 42 }, (_, i) => dateKey(addDays(gridStart, i)));
}

/** "2 – 8 Nov", or "30 Nov – 6 Dec" across a month: the seven days of the week that holds `anchor`, whatever "days shown" says. */
export function weekRange(anchor: string, weekStart: WeekStart): string {
  const first = weekStartOf(dateOf(anchor), weekStart);
  const last = addDays(first, 6);
  const m = (d: Date) => MONTHS[d.getMonth()]!.slice(0, 3);
  return first.getMonth() === last.getMonth() ? `${first.getDate()} – ${last.getDate()} ${m(last)}` : `${first.getDate()} ${m(first)} – ${last.getDate()} ${m(last)}`;
}

/** The label between the arrows of the Day and Agenda toolbars: "Sat 7 Nov", "Sat 7 – Fri 13 Nov", or "Mon 30 Nov – Sun 6 Dec" across a month. */
export function dayRange(first: string, last: string): string {
  const a = dateOf(first);
  const b = dateOf(last);
  const m = (d: Date) => MONTHS[d.getMonth()]!.slice(0, 3);
  const w = (d: Date) => WEEKDAYS[d.getDay()]!.slice(0, 3);
  if (first === last) return `${w(a)} ${a.getDate()} ${m(a)}`;
  return a.getMonth() === b.getMonth() ? `${w(a)} ${a.getDate()} – ${w(b)} ${b.getDate()} ${m(b)}` : `${w(a)} ${a.getDate()} ${m(a)} – ${w(b)} ${b.getDate()} ${m(b)}`;
}

function shift(view: View, anchor: string, direction: 1 | -1): string {
  const a = dateOf(anchor);
  if (view === "day") return dateKey(addDays(a, direction));
  if (view === "month") return dateKey(new Date(a.getFullYear(), a.getMonth() + direction, 1));
  return dateKey(addDays(a, 7 * direction));
}

/**
 * A calendar from outside Orbyn that failed to sync keeps its last events and says when they're from (Planner Designs
 * p-cal-sync-error): one banner per failed calendar, with Open settings and Try again.
 */
function CalendarSyncErrors() {
  const { calendars } = usePlanner();
  const store = useStore();
  const router = useRouter();
  const failed = calendars.filter((c) => c.kind.type === "subscribed" && c.kind.error);
  if (failed.length === 0) return null;
  return (
    <div className="cal-banners">
      {failed.map((c) => {
        const at = c.kind.type === "subscribed" && c.kind.lastRefreshed ? formatTime(new Date(c.kind.lastRefreshed)) : null;
        return (
          <div key={c.id} className="banner err" role="alert">
            <Icon name="alert" small />
            <span>Couldn’t sync {c.name}, a calendar from outside Orbyn.{at ? ` Showing what it had at ${at}.` : ""}</span>
            <span className="end">
              <button type="button" className="ghost sm" onClick={() => { setSettingsTarget("Calendars"); router.navigate("/settings"); }}>Open settings</button>
              <button type="button" className="btn sm" onClick={() => void refreshCalendar(store, c)}>Try again</button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CalendarPage() {
  const phone = useMediaQuery(PHONE_QUERY);
  const now = useNow();
  // On a phone the Calendar is the day strip and the day's list; the grids are for larger screens.
  if (phone) return <PhoneCalendar today={dateKey(now)} />;
  return <CalendarGrid />;
}

function CalendarGrid() {
  const { events, calendars, ready } = usePlanner();
  const loading = useSlow(!ready);
  const now = useNow();
  const ui = useUi();
  const { prefs } = usePrefs();
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => dateKey(now));

  const days = useMemo(() => viewDays(view, anchor, prefs.weekStart, prefs.weekDays), [view, anchor, prefs.weekStart, prefs.weekDays]);
  const shown = useMemo(() => {
    const visible = new Set(calendars.filter((c) => c.visible).map((c) => c.id));
    return events.filter((e) => visible.has(e.calendarId));
  }, [events, calendars]);
  const occurrences = useMemo(() => expandEvents(shown, days[0]!, days.at(-1)!), [shown, days]);

  const a = dateOf(anchor);
  const title =
    view === "day" ? `${WEEKDAYS[a.getDay()]} ${a.getDate()} ${MONTHS[a.getMonth()]}` : view === "agenda" ? "Agenda" : `${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
  const sub = view === "week" ? `Week ${isoWeek(dateOf(days[0]!))}` : view === "day" ? "Day" : view === "agenda" ? "Next 7 days" : "";
  const today = dateKey(now);
  // Today comes back only when another period than the current one is showing.
  const elsewhere =
    view === "week" ? dateKey(weekStartOf(a, prefs.weekStart)) !== dateKey(weekStartOf(dateOf(today), prefs.weekStart))
    : view === "month" ? anchor.slice(0, 7) !== today.slice(0, 7)
    : anchor !== today;

  // The left and right arrow keys step a week when nothing else has focus (and no dialog is open).
  useEffect(() => {
    if (view !== "week") return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const active = document.activeElement;
      if (active && active !== document.body) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      setAnchor((cur) => shift("week", cur, e.key === "ArrowLeft" ? -1 : 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [view]);

  return (
    <>
      <PageHeader title={title} sub={sub}>
        <button type="button" className="ghost icon" aria-label="Previous" onClick={() => setAnchor(shift(view, anchor, -1))}>
          <Icon name="left" small />
        </button>
        {elsewhere && <button type="button" className="ghost" onClick={() => setAnchor(today)}>Today</button>}
        {view === "week" && <span className="range">{weekRange(anchor, prefs.weekStart)}</span>}
        {(view === "day" || view === "agenda") && <span className="range">{dayRange(days[0]!, days.at(-1)!)}</span>}
        <button type="button" className="ghost icon" aria-label="Next" onClick={() => setAnchor(shift(view, anchor, 1))}>
          <Icon name="right" small />
        </button>
        <div role="radiogroup" aria-label="View" className="pills">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" role="radio" aria-checked={view === v.id} className="pill" onClick={() => setView(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
        <CalendarsMenu />
        <button type="button" className="btn keep" onClick={() => ui.openNewEvent(view === "day" ? anchor : today)}>
          <Icon name="plus" small />
          New event
        </button>
      </PageHeader>

      {loading && (
        <div className="cal-loading">
          <span role="status" className="t3 cal-loading-line"><span className="spin" aria-hidden="true" />{view === "week" ? "Loading this week’s events" : "Loading events"}</span>
        </div>
      )}
      <CalendarSyncErrors />
      {view === "month" ? (
        <MonthView days={days} anchor={anchor} occurrences={occurrences} today={today} weekStart={prefs.weekStart} onDay={(d) => { setAnchor(d); setView("day"); }} />
      ) : view === "agenda" ? (
        <AgendaView days={days} occurrences={occurrences} today={today} />
      ) : (
        <TimeGrid days={days} occurrences={occurrences} today={today} now={now} mode={view} />
      )}
    </>
  );
}
