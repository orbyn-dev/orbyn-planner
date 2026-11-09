import { useRef, useState } from "react";
import { useNow } from "../../state/clock";
import { usePrefs } from "../../state/prefs";
import { useUi } from "../../ui/product/UiProvider";
import { Portal } from "../../ui/primitives/Portal";
import { WhenField } from "../../ui/primitives/WhenField";
import type { When } from "../../core/planner/whenParser";
import { useDialog } from "../../ui/primitives/useDialog";
import { dateKey } from "../../core/planner/dates";
import { usePlanner, useStore } from "../../state/store";
import { REMINDERS, REPEAT_CHOICES, parsePeople, ruleOf, type RepeatChoice } from "./eventForm";

const pad = (n: number) => String(n).padStart(2, "0");

/** The "New event" card: title and when first, then calendar, repeat, reminder and people. */
export function NewEventDialog() {
  const store = useStore();
  const { calendars } = usePlanner();
  const ui = useUi();
  const now = useNow();
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, ui.closeNewEvent);

  const nextHour = ui.newEventTime ? Number(ui.newEventTime.slice(0, 2)) : Math.min(now.getHours() + 1, 22);
  const [title, setTitle] = useState(ui.newEventTitle);
  const firstDay = ui.newEventDate || dateKey(now);
  const [when, setWhen] = useState<When>({ allDay: false, startDay: firstDay, startTime: `${pad(nextHour)}:00`, endDay: firstDay, endTime: `${pad(Math.min(nextHour + 1, 23))}:00` });
  const { prefs } = usePrefs();
  const writable = calendars.filter((c) => c.kind.type === "local");
  const [calendarId, setCalendarId] = useState(writable[0]?.id ?? "");
  const [repeat, setRepeat] = useState<RepeatChoice>("never");
  const [reminder, setReminder] = useState<number | null>(null);
  const [people, setPeople] = useState("");

  const start = when.allDay ? when.startDay : `${when.startDay}T${when.startTime}`;
  const end = when.allDay ? when.endDay : `${when.endDay}T${when.endTime}`;
  const bad = title.trim() === "" || end < start;

  const submit = () => {
    if (bad) return;
    const event = store.addEvent({
      title,
      calendarId,
      allDay: when.allDay,
      start,
      end,
      reminder,
      people: parsePeople(people),
      repeat: ruleOf(repeat) ?? null,
    });
    ui.closeNewEvent();
    ui.showToast(`Added “${event.title}”`);
  };

  return (
    <Portal>
      <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && ui.closeNewEvent()}>
        <div ref={ref} className="authcard" style={{ width: "var(--sp-480)" }} role="dialog" aria-modal="true" aria-label="New event" tabIndex={-1}>
          <b className="card-title">New event</b>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label htmlFor="ne-title">Title</label>
            <input id="ne-title" className="field" data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} />
            <WhenField label="When" kind="event" value={when} now={now} weekStart={prefs.weekStart} onChange={(w) => w && setWhen(w)} />
            <label htmlFor="ne-cal">Calendar</label>
            <select id="ne-cal" className="field" value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
              {writable.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="kv">
              <label htmlFor="ne-repeat">Repeat</label>
              <b className="ctl">
                <select id="ne-repeat" className="inp" value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatChoice)}>
                  {REPEAT_CHOICES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </b>
            </div>
            <div className="kv">
              <label htmlFor="ne-reminder">Reminder</label>
              <b className="ctl">
                <select id="ne-reminder" className="inp" value={reminder ?? ""} onChange={(e) => setReminder(e.target.value === "" ? null : Number(e.target.value))}>
                  {REMINDERS.map((r) => (
                    <option key={r.label} value={r.value ?? ""}>{r.label}</option>
                  ))}
                </select>
              </b>
            </div>
            <div className="kv">
              <label htmlFor="ne-people">Invite people</label>
              <b className="ctl">
                <input id="ne-people" className="inp" placeholder="Add by email" value={people} onChange={(e) => setPeople(e.target.value)} />
              </b>
            </div>
            <div className="dialog-actions">
              <button type="button" className="ghost" onClick={ui.closeNewEvent}>Cancel</button>
              <button type="submit" className="btn" disabled={bad}>Add event</button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
