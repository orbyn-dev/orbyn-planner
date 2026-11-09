import { useId, useRef, useState } from "react";
import { addDays, dateKey, dateOf, type WeekStart } from "../../core/planner/dates";
import { formatWhen, parseWhen, readTime, type When, type WhenKind } from "../../core/planner/whenParser";
import { Icon } from "./Icon";
import { MonthGrid } from "../product/MonthGrid";
import { Toggle } from "./Toggle";
import { usePopover } from "./usePopover";

const shiftDay = (day: string, n: number) => dateKey(addDays(dateOf(day), n));
const daysBetween = (from: string, to: string) => Math.round((dateOf(to).getTime() - dateOf(from).getTime()) / 86_400_000);
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** The When after another day is picked: the span (one night, a few days) goes with it. */
export function withDay(w: When, day: string): When {
  return { ...w, startDay: day, endDay: shiftDay(day, daysBetween(w.startDay, w.endDay)) };
}

/** An end that is not after the start crosses midnight (when the event spans a day or less); a longer span is left alone. */
function settle(w: When): When {
  if (w.allDay || w.endTime === "" || daysBetween(w.startDay, w.endDay) > 1) return w;
  return { ...w, endDay: minutes(w.endTime) <= minutes(w.startTime) ? shiftDay(w.startDay, 1) : w.startDay };
}

export const withStart = (w: When, time: string): When => settle({ ...w, startTime: time });
export const withEnd = (w: When, time: string): When => settle({ ...w, endTime: time });

/** All day on drops the times; off gives an hour from 09:00 to start from. */
export function withAllDay(w: When, allDay: boolean): When {
  if (allDay) return { ...w, allDay, startTime: "", endTime: "" };
  return { ...w, allDay, startTime: "09:00", endTime: "10:00", endDay: w.endDay < w.startDay ? w.startDay : w.endDay };
}

function TimeField({ label, time, onCommit }: { label: string; time: string; onCommit: (time: string) => void }) {
  const [bad, setBad] = useState(false);
  const commit = (text: string) => {
    const t = readTime(text);
    setBad(t === null);
    if (t !== null && t !== time) onCommit(t);
  };
  return (
    <input
      key={time}
      className="inp narrow"
      aria-label={label}
      aria-invalid={bad || undefined}
      placeholder="HH:mm"
      inputMode="numeric"
      defaultValue={time}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit(e.currentTarget.value))}
    />
  );
}

/**
 * What the calendar popover holds (Planner Designs p-when-event, p-due-task, p-row-event-when): a month, then for an event a start and an
 * end time and an All day switch, for a task one time with No time and four shortcuts. Changes apply as you go; Done closes.
 */
export function WhenBody({ kind, value, today, weekStart, onChange, onDone }: { kind: WhenKind; value: When; today: string; weekStart: WeekStart; onChange: (w: When | null) => void; onDone: () => void }) {
  const quick = (label: string, to: string) => (
    <button key={label} type="button" className="pill" onClick={() => onChange(withDay(value, to))}>{label}</button>
  );
  return (
    <>
      <MonthGrid value={value.startDay} today={today} weekStart={weekStart} label={kind === "task" ? "Due day" : "Day"} autoFocus onPick={(d) => onChange(withDay(value, d))} />
      {kind === "event" ? (
        <>
          {!value.allDay && (
            <div className="rp-time">
              <TimeField label="Start time" time={value.startTime} onCommit={(t) => onChange(withStart(value, t))} />
              <span className="t3">to</span>
              <TimeField label="End time" time={value.endTime} onCommit={(t) => onChange(withEnd(value, t))} />
            </div>
          )}
          <div className="kv"><span>All day</span><Toggle label="All day" on={value.allDay} onChange={(on) => onChange(withAllDay(value, on))} /></div>
        </>
      ) : (
        <>
          <div className="rp-time">
            <TimeField label="Due time" time={value.startTime} onCommit={(t) => onChange({ ...value, startTime: t })} />
            <button type="button" className="ghost" disabled={value.startTime === ""} onClick={() => onChange({ ...value, startTime: "" })}>No time</button>
          </div>
          <div className="rp-quick">
            {quick("Today", today)}
            {quick("Tomorrow", shiftDay(today, 1))}
            {quick("Next week", shiftDay(today, 7))}
            <button type="button" className="pill" onClick={() => onChange(null)}>No date</button>
          </div>
        </>
      )}
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onDone}>Done</button>
      </div>
    </>
  );
}

/**
 * One combined date-and-time line (Planner Designs p-when-event, p-when-event-typing, p-when-unreadable, p-due-task). It shows the value
 * as text. Typing plain words ("tomorrow 3pm", "Fri 14:00–15:00") is understood as you type, with a line under the field saying how;
 * words that cannot be read leave the value as it was, keep what was typed, and say so quietly. The calendar icon opens the popover; Escape
 * closes it and focus returns to the line. A task's line may be empty (no date).
 */
export function WhenField({ label, kind, value, now, weekStart, onChange }: { label: string; kind: WhenKind; value: When | null; now: Date; weekStart: WeekStart; onChange: (w: When | null) => void }) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pop = usePopover(open, () => setOpen(false), input);
  const today = dateKey(now);

  const shown = value ? formatWhen(value, now, kind) : "";
  const typed = draft?.trim() ?? "";
  const parsed = draft !== null && typed !== "" ? parseWhen(draft, now, kind) : null;
  const unreadable = draft !== null && typed !== "" && parsed === null;
  const hint = parsed ? formatWhen(parsed, now, kind) : unreadable ? "Couldn’t read that" : "";

  const base: When = value ?? { allDay: false, startDay: today, startTime: "", endDay: today, endTime: "" };
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="when sync-wrap">
        <div className="when-line">
          <input
            ref={input}
            id={id}
            className="field"
            autoComplete="off"
            value={draft ?? shown}
            placeholder={kind === "task" ? "No date" : undefined}
            aria-describedby={`${id}-hint`}
            onChange={(e) => {
              setDraft(e.target.value);
              const text = e.target.value;
              if (text.trim() === "") return kind === "task" ? onChange(null) : undefined;
              const parsed = parseWhen(text, now, kind);
              if (parsed) onChange(parsed);
            }}
            onBlur={() => {
              // What was read is now the value, shown as text; words that were not read stay as typed.
              if (draft !== null && (draft.trim() === "" ? kind === "task" : parseWhen(draft, now, kind) !== null)) setDraft(null);
            }}
          />
          <button type="button" className="icon-btn" aria-label={kind === "task" ? "Open the due calendar" : "Open the calendar"} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
            <Icon name="cal" small />
          </button>
        </div>
        <p id={`${id}-hint`} className="t3 when-hint" aria-live="polite">
          {hint}
          {unreadable && <span className="when-hint2">Try “tomorrow 3pm” or pick from the calendar.</span>}
        </p>
        {open && (
          <div ref={pop} className="card popover row-pop wide when-pop" role="dialog" aria-label={kind === "task" ? "Due" : "When"}>
            <WhenBody
              kind={kind}
              value={base}
              today={today}
              weekStart={weekStart}
              onChange={(w) => {
                setDraft(null);
                onChange(w);
              }}
              onDone={() => {
                setOpen(false);
                input.current?.focus();
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}
