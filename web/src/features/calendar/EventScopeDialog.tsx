import { useRef, useState } from "react";
import { Portal } from "../../ui/primitives/Portal";
import { useDialog } from "../../ui/primitives/useDialog";
import { MONTHS, WEEKDAYS, dateOf } from "../../core/planner/dates";
import type { Scope } from "../../core/planner/eventScope";
import { ruleLabel } from "../../core/planner/occurrences";
import type { CalendarEvent } from "../../core/planner/types";

/** "Sat 7 Nov". */
const dayName = (key: string): string => {
  const d = dateOf(key);
  return `${WEEKDAYS[d.getDay()]!.slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()]!.slice(0, 3)}`;
};

/**
 * Which events of a repeating series a change or a delete reaches (Planner Designs v61 p-event-recurring and p-event-delete): three
 * rows to choose from, the first chosen, then one button: Save, or the red Delete event. There are no guest lines: telling guests
 * returns when guests and invitations exist.
 */
export function EventScopeDialog({ mode, event, date, onChoose, onCancel }: { mode: "save" | "delete"; event: CalendarEvent; date: string; onChoose: (scope: Scope) => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, onCancel);
  const [scope, setScope] = useState<Scope>("this");
  const title = mode === "delete" ? `Delete “${event.title}”?` : "Change a repeating event";
  const rows: { scope: Scope; label: string; hint: string | null }[] = [
    { scope: "this", label: "Only this event", hint: dayName(date) },
    { scope: "following", label: "This and following events", hint: `${dayName(date)} and every later one` },
    { scope: "all", label: "All events in the series", hint: mode === "save" && event.repeat ? `${ruleLabel(event.repeat.repeat)}, from ${dayName(event.start.slice(0, 10))}` : null },
  ];
  return (
    <Portal>
      <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
        <div ref={ref} className="authcard scope-dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
          <b className="card-title">{title}</b>
          <div role="radiogroup" aria-label="Which events" className="scope-rows">
            {rows.map((r, i) => (
              <button key={r.scope} type="button" role="radio" aria-checked={scope === r.scope} className="scope-row" data-autofocus={i === 0 ? "" : undefined} onClick={() => setScope(r.scope)}>
                <span className="scope-radio" aria-hidden="true" />
                <span>
                  <span className="scope-label">{r.label}</span>
                  {r.hint && <small className="t3">{r.hint}</small>}
                </span>
              </button>
            ))}
          </div>
          {mode === "delete" && <p className="t3">Deleted events are kept for 30 days in Completed and deleted.</p>}
          <div className="dialog-actions">
            <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
            {mode === "delete" ? (
              <button type="button" className="danger" onClick={() => onChoose(scope)}>Delete event</button>
            ) : (
              <button type="button" className="btn" onClick={() => onChoose(scope)}>Save</button>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
