import { useEffect, useRef, useState } from "react";
import { dateKey, dateOf, MONTHS, WEEKDAYS, weekLead, weekOrder, type WeekStart } from "../../core/planner/dates";
import { Icon } from "../primitives/Icon";

const shift = (day: string, n: number) => {
  const d = dateOf(day);
  return dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};
const monthOf = (day: string) => {
  const d = dateOf(day);
  return dateKey(new Date(d.getFullYear(), d.getMonth(), 1));
};
const dayName = (day: string) => {
  const d = dateOf(day);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/**
 * A month of days for choosing one (Planner Designs p-row-due, p-row-event-when): today is dotted, the chosen day is filled, the days of
 * the neighbouring months are quiet. One day is in the Tab order; arrow keys move by a day or a week (into the next month when they
 * cross it), Page Up and Page Down by a month, and Enter or Space picks. `value` is `YYYY-MM-DD` or empty.
 */
export function MonthGrid({ value, today, weekStart, label = "Days", autoFocus, onPick }: { value: string; today: string; weekStart: WeekStart; label?: string; autoFocus?: boolean; onPick: (day: string) => void }) {
  const [focus, setFocus] = useState(value || today);
  const [month, setMonth] = useState(() => monthOf(value || today));
  const grid = useRef<HTMLDivElement>(null);
  const moved = useRef(autoFocus === true);

  useEffect(() => {
    if (!moved.current) return;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focus}"]`)?.focus();
  }, [focus, month]);

  const first = dateOf(month);
  const lead = weekLead(first, weekStart);
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const total = Math.ceil((lead + count) / 7) * 7;
  const cells = Array.from({ length: total }, (_, i) => shift(month, i - lead));
  const heads = weekOrder(weekStart);
  // The day that takes the Tab stop: the focused one when it is on this page, else the first of the month.
  const stop = cells.includes(focus) && monthOf(focus) === month ? focus : month;

  const go = (day: string) => {
    moved.current = true;
    setFocus(day);
    setMonth(monthOf(day));
  };
  const page = (by: number) => {
    const d = first;
    setMonth(dateKey(new Date(d.getFullYear(), d.getMonth() + by, 1)));
  };
  const onKey = (e: React.KeyboardEvent) => {
    const from = stop;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step !== undefined) {
      e.preventDefault();
      go(shift(from, step));
    } else if (e.key === "PageDown" || e.key === "PageUp") {
      e.preventDefault();
      const d = dateOf(from);
      const by = e.key === "PageDown" ? 1 : -1;
      go(dateKey(new Date(d.getFullYear(), d.getMonth() + by, Math.min(d.getDate(), new Date(d.getFullYear(), d.getMonth() + by + 1, 0).getDate()))));
    }
  };

  return (
    <div className="month-grid">
      <div className="ms-head">
        <button type="button" className="ghost icon" aria-label="Previous month" onClick={() => page(-1)}><Icon name="left" small /></button>
        <b>{MONTHS[first.getMonth()]} {first.getFullYear()}</b>
        <button type="button" className="ghost icon" aria-label="Next month" onClick={() => page(1)}><Icon name="right" small /></button>
      </div>
      <div ref={grid} className="ms-grid" role="grid" aria-label={label} onKeyDown={onKey}>
        {heads.map((d) => <span key={d} className="ms-dow" aria-hidden="true">{WEEKDAYS[d]!.slice(0, 1)}</span>)}
        {cells.map((d) => (
          <button
            key={d}
            type="button"
            data-day={d}
            tabIndex={d === stop ? 0 : -1}
            className={[d === value && "on", d === today && "today", dateOf(d).getMonth() !== first.getMonth() && "quiet"].filter(Boolean).join(" ") || undefined}
            aria-pressed={d === value}
            aria-label={dayName(d)}
            onClick={() => { setFocus(d); onPick(d); }}
          >
            {dateOf(d).getDate()}
          </button>
        ))}
      </div>
    </div>
  );
}
