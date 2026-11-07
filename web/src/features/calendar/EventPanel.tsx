import { useMemo, useRef, useState } from "react";
import { useNow } from "../../app/clock";
import { usePrefs } from "../../app/prefs";
import { useUi } from "../../app/ui";
import { Icon } from "../../components/Icon";
import { PopoverRow } from "../../components/PopoverRow";
import { Portal } from "../../components/Portal";
import { WhenBody } from "../../components/WhenField";
import { dateKey } from "../../lib/dates";
import { formatWhen, type When } from "../../lib/whenParser";
import { PHONE_QUERY, useMediaQuery } from "../../components/useMediaQuery";
import { useDialog } from "../../components/useDialog";
import { usePlanner, useStore } from "../../store/context";
import { CannotMoveSeries, undoableEvents, deleteOccurrence, duplicateOccurrence, editOccurrence, type Scope } from "../../store/eventScope";
import { expandEvents, type Occurrence } from "../../store/occurrences";
import type { Repeat } from "../../store/repeat";
import type { Person, Response } from "../../store/types";
import { RESPONSE_LABELS, parsePeople } from "./eventForm";
import { CalendarRow } from "./CalendarRow";
import { ReminderRow, RepeatRow } from "../tasks/RowPopovers";
import { ScopeDialog } from "./ScopeDialog";

const timePart = (value: string) => (value.length > 10 ? value.slice(11, 16) : "");

function Panel({ occ }: { occ: Occurrence }) {
  const store = useStore();
  const { calendars } = usePlanner();
  const ui = useUi();
  const ref = useRef<HTMLElement>(null);
  const phone = useMediaQuery(PHONE_QUERY);
  useDialog(ref, ui.closeEvent, phone);

  const event = occ.event;
  const locked = event.readOnly;
  const calendar = calendars.find((c) => c.id === event.calendarId);

  const [title, setTitle] = useState(event.title);
  const [when, setWhen] = useState<When>({
    allDay: occ.allDay,
    startDay: occ.start.slice(0, 10),
    startTime: timePart(occ.start) || "09:00",
    endDay: occ.end.slice(0, 10),
    endTime: timePart(occ.end) || "10:00",
  });
  const { allDay, startDay, startTime, endDay, endTime } = when;
  const now = useNow();
  const { prefs } = usePrefs();
  const [calendarId, setCalendarId] = useState(event.calendarId);
  const [place, setPlace] = useState(event.place);
  const [repeatRule, setRepeatRule] = useState<Repeat | null>(event.repeat?.repeat ?? null);
  const [repeatChanged, setRepeatChanged] = useState(false);
  const [reminder, setReminder] = useState<number | null>(event.reminder);
  const [people, setPeople] = useState<Person[]>(event.people);
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState(event.notes);
  const [ask, setAsk] = useState<null | "save" | "delete">(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const start = allDay ? startDay : `${startDay}T${startTime}`;
  const end = allDay ? endDay : `${endDay}T${endTime}`;
  const invalid = title.trim() === "" || end < start;
  const editable = useMemo(() => calendars.filter((c) => c.kind.type === "local" || c.id === event.calendarId), [calendars, event.calendarId]);

  const save = (scope: Scope) => {
    let created: ReturnType<typeof editOccurrence>;
    let undo: (() => void) | undefined;
    try {
      const done = undoableEvents(store, () => editOccurrence(store, occ, scope, {
        title: title.trim(),
        allDay,
        start,
        end,
        calendarId,
        place: place.trim(),
        notes,
        people,
        reminder,
        // Only a changed repeat is sent; the same one must not reset the dates skipped from it.
        repeat: repeatChanged ? repeatRule : undefined,
      }));
      created = done.result;
      // A change that reached a series (this one, this and following, all) can be taken back.
      if (event.repeat) undo = done.undo;
    } catch (e) {
      // A move the repeat cannot say: nothing was changed, and the person is told why.
      setAsk(null);
      setSaveError(e instanceof CannotMoveSeries ? e.message : "Couldn’t save that change.");
      return;
    }
    setAsk(null);
    setSaveError(null);
    ui.openEvent(created?.id ?? event.id, startDay);
    ui.showToast("Event saved", undo);
  };

  const remove = (scope: Scope) => {
    const undo = deleteOccurrence(store, occ, scope);
    setAsk(null);
    ui.closeEvent();
    ui.showToast("Event deleted", undo, { focusUndo: true, focusRowOnUndo: event.id });
  };

  const duplicate = () => {
    const copy = duplicateOccurrence(store, occ);
    ui.openEvent(copy.id, copy.start.slice(0, 10));
    ui.showToast("Event duplicated");
  };

  const panel = (
    <aside ref={ref} className="task-panel" role={phone ? "dialog" : "complementary"} aria-modal={phone ? "true" : undefined} aria-label="Event" tabIndex={-1}>
      <div className="tp-head">
        <span className="sw" style={{ background: `var(--${calendar?.colour ?? "c1"})` }} aria-hidden="true" />
        <input className="tp-title" aria-label="Title" value={title} data-autofocus disabled={locked} onChange={(e) => setTitle(e.target.value)} />
        <button type="button" className="icon-btn" aria-label="Close" onClick={ui.closeEvent}>
          <Icon name="x" />
        </button>
      </div>
      {locked && <p className="t3">From the subscribed calendar “{calendar?.name}”. It can’t be changed here.</p>}

      <PopoverRow label="When" value={formatWhen(when, now, "event")} disabled={locked} wide>
        {({ close }) => <WhenBody kind="event" value={when} today={dateKey(now)} weekStart={prefs.weekStart} onChange={(w) => w && setWhen(w)} onDone={close} />}
      </PopoverRow>
      <CalendarRow calendars={editable} value={calendarId} disabled={locked} onChange={setCalendarId} />
      <div className="kv">
        <span>Where</span>
        <b className="ctl"><input className="inp" aria-label="Where" value={place} disabled={locked} onChange={(e) => setPlace(e.target.value)} /></b>
      </div>
      <RepeatRow rule={repeatRule} start={startDay} disabled={locked} onChange={(rule) => { setRepeatRule(rule); setRepeatChanged(true); }} />
      <ReminderRow value={reminder} disabled={locked} onChange={setReminder} />

      {!locked || people.length > 0 ? (
        <>
          <div className="bh"><b>People</b><span>{people.length || ""}</span></div>
          <ul>
            {people.map((p) => (
              <li className="kv person-row" key={p.email}>
                <span>{p.email}</span>
                <b className={p.response === "none" ? "t3" : undefined}>
                  <select className="inp" aria-label={`Reply from ${p.email}`} value={p.response} disabled={locked} onChange={(e) => setPeople(people.map((q) => (q === p ? { ...q, response: e.target.value as Response } : q)))}>
                    {(Object.keys(RESPONSE_LABELS) as Response[]).map((r) => (
                      <option key={r} value={r}>{RESPONSE_LABELS[r]}</option>
                    ))}
                  </select>
                  {!locked && (
                    <button type="button" className="icon-btn" aria-label={`Remove ${p.email}`} onClick={() => setPeople(people.filter((q) => q !== p))}>
                      <Icon name="x" small />
                    </button>
                  )}
                </b>
              </li>
            ))}
          </ul>
          {!locked && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPeople(parsePeople(email, people));
                setEmail("");
              }}
            >
              <input className="field" aria-label="Add a person" placeholder="Add by email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </form>
          )}
        </>
      ) : null}

      <div className="bh"><b>Notes</b><span></span></div>
      <textarea className="field notes" aria-label="Notes" rows={4} value={notes} disabled={locked} onChange={(e) => setNotes(e.target.value)} />

      {saveError && <p className="err" role="alert">{saveError}</p>}
      <div className="tp-foot">
        {!locked && <button type="button" className="ghost red" onClick={() => (event.repeat ? setAsk("delete") : remove("all"))}>Delete</button>}
        <button type="button" className="ghost" onClick={duplicate}>Duplicate</button>
        {!locked && (
          <button type="button" className="btn" disabled={invalid} onClick={() => (event.repeat ? setAsk("save") : save("all"))}>
            Save
          </button>
        )}
      </div>

      {ask && <ScopeDialog title={ask === "save" ? "Save changes to" : "Delete"} onCancel={() => setAsk(null)} onChoose={(scope) => (ask === "save" ? save(scope) : remove(scope))} />}
    </aside>
  );
  return phone ? <Portal>{panel}</Portal> : panel;
}

export function EventPanel() {
  const { events } = usePlanner();
  const { eventKey } = useUi();
  const occ = useMemo(() => {
    if (!eventKey) return null;
    const event = events.find((e) => e.id === eventKey.id && e.deletedAt === null);
    return event ? (expandEvents([event], eventKey.date, eventKey.date).find((o) => o.date === eventKey.date) ?? null) : null;
  }, [events, eventKey]);
  // A fresh form for each occurrence and each saved version of the event.
  return occ ? <Panel key={`${occ.event.id}-${occ.date}-${occ.event.updatedAt}`} occ={occ} /> : null;
}
